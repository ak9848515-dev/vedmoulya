// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Domain Types
//
// The planning boundary between a raw user goal and the frozen
// Agent Execution Intelligence kernel. Distinct concepts (never
// collapsed):
//   GOAL             — what the user wants (raw + normalized)
//   GOALUNDERSTANDING— the normalized, explained interpretation
//   PLAN             — the AgentPlan produced (reuses the frozen
//                      execution type — never redefined here)
//   PLANSTEP/ACTION  — AgentPlanStep / AgentActionSpec (frozen types)
//   VERIFICATIONSPEC — VerificationPolicy (frozen type)
//   RECOVERYSPEC     — StepRecoveryPolicy (frozen type)
//   PLANCONSTRAINT   — user/tenant constraints the planner must obey
//   PLANREADINESS    — deterministic READY | BLOCKED result
//   PLANGENERATIONRESULT — observability wrapper around a generation
//
// The planner PROPOSES. The execution engine executes. Governance
// authorizes. Verification determines evidence of success. This layer
// never calls provider SDKs, never re-implements routing/tools/
// verification/recovery/costs — every capability flows through the
// frozen estate via narrow ports.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type {
  AgentAutonomyLevel,
  AgentExecutionRun,
  AgentPlan,
  AgentRunBudgetConfig,
  AgentRunUsage,
  PlanValidationIssue,
  ToolPermissionClass,
  VerificationPolicy,
} from '@vedmoulya/agent-execution';

// ── Goal ─────────────────────────────────────────────────────────

/** The raw, uninterpreted user goal plus optional context. */
export interface GoalInput {
  /** Owner scope (optional at planning time; required at execution). */
  userId?: string;
  /** The natural-language goal. */
  goal: string;
  /** Optional surrounding context the planner may use. */
  context?: string;
  /** Optional explicit constraints. */
  constraints?: PlanConstraint;
}

// ── PlanConstraint (the planner can never exceed these) ───────────

/**
 * Constraints the planner must respect. The planner CANNOT grant itself
 * permission: grantedPermissionClasses is the ceiling for every tool it
 * selects; autonomy/budget bound recovery and size. Provider/model
 * preferences are deliberately absent — routing is a runtime
 * responsibility and the planner never bypasses it.
 */
export interface PlanConstraint {
  /** Autonomy ceiling. Default SUPERVISED (frozen execution default). */
  autonomyLevel?: AgentAutonomyLevel;
  /** Budget envelope (merged over the frozen defaults). */
  budget?: Partial<AgentRunBudgetConfig>;
  /** Maximum number of plan steps. Default 12. */
  maxSteps?: number;
  /** Tools the principal is permitted to use (union with registry). */
  allowedTools?: string[];
  /** Permission classes the principal holds. Default ['READ']. */
  grantedPermissionClasses?: ToolPermissionClass[];
  /** When true, every meaningful step must declare a verification policy. */
  requireVerification?: boolean;
  /**
   * Bounded recovery ceilings (never looser than the engine allows).
   * maxAttempts is capped at 3, maxRevisions at 2 by the planner.
   */
  recovery?: { maxAttempts?: number; maxRevisions?: number };
}

/** The frozen execution budget, merged with explicit overrides. */
export type PlanningBudget = AgentRunBudgetConfig;

// ── GoalUnderstanding ─────────────────────────────────────────────

/**
 * The normalized interpretation of a goal. Every derivation is recorded
 * in `derivationReasons`; anything that could not be determined is
 * listed in `unknownAspects` — the planner NEVER invents unavailable
 * tools, permissions or system state.
 */
export interface GoalUnderstanding {
  goalId: string;
  userId?: string;
  /** The trimmed raw goal. */
  rawGoal: string;
  /** Normalized goal (whitespace-collapsed, deterministic). */
  normalizedGoal: string;
  /** Primary capability, when inferable deterministically. */
  primaryCapability?: CapabilityType;
  /** ALL hard capability requirements — never collapsed to [primary]. */
  requiredCapabilities: CapabilityType[];
  /** Deterministic keyword-derived constraints. */
  constraints: string[];
  /** Expected outcome when inferable; undefined = unknown. */
  expectedOutcome?: string;
  /** What verification would look like for this goal (deterministic). */
  verificationExpectations: string[];
  /** Autonomy ceiling (frozen defaults when not explicit). */
  autonomyLevel: AgentAutonomyLevel;
  /** Budget envelope (frozen defaults when not explicit). */
  budget: PlanningBudget;
  /** True when the goal is too ambiguous to plan reliably. */
  clarificationNeeded?: { reason: string };
  /** Everything that could NOT be determined — never inferred silently. */
  unknownAspects: string[];
  /** Why every decision was made (traceable, explainable). */
  derivationReasons: string[];
}

// ── PlanReadiness ─────────────────────────────────────────────────

export type PlanReadinessStatus = 'READY' | 'BLOCKED';

export interface PlanReadinessIssue {
  code: string;
  stepId?: string;
  reason: string;
}

/** Deterministic, explainable readiness. BLOCKED ⇒ the plan must not run. */
export interface PlanReadiness {
  status: PlanReadinessStatus;
  /** Every blocking/warning issue (deterministic, deduplicated). */
  issues: PlanReadinessIssue[];
  /** Blocking reasons only (used for the BLOCKED summary). */
  blockedReasons: string[];
}

// ── Plan generation (observability) ───────────────────────────────

export type PlanGenerationSource = 'deterministic' | 'ai' | 'ai-fallback';

export interface PlannerAiUsage {
  provider?: string;
  model?: string;
  tokens?: { input: number; output: number; total: number };
  costUsd?: number;
  latencyMs?: number;
  /** True when the runtime abstained (evidence-first) or the call failed. */
  failed?: boolean;
  /** Sanitized failure reason (never raw prompts). */
  failureReason?: string;
}

/** Every meaningful verification policy kind selected in the plan. */
export type SelectedVerificationKind = VerificationPolicy['kind'];

/**
 * The complete result of one planning pass. Carries enough information to
 * explain the original goal, the normalization, the plan version, the
 * readiness result and the planner model/provider — with sanitized
 * observability (no raw prompts, no secrets).
 */
export interface PlanGenerationResult {
  goalId: string;
  planId?: string;
  originalGoal: string;
  normalizedGoal: string;
  source: PlanGenerationSource;
  planVersion: string;
  /** The validated plan — present unless generation itself failed. */
  plan?: AgentPlan;
  readiness: PlanReadiness;
  /** Full validation issues (errors + warnings), deterministic. */
  issues: PlanValidationIssue[];
  /** Capabilities the plan actually requires (preserved in FULL). */
  selectedCapabilities: CapabilityType[];
  /** Tools the plan actually selects (registry-validated). */
  selectedTools: string[];
  /** Verification policy kinds per meaningful step. */
  verificationPolicies: SelectedVerificationKind[];
  /** Bounded recovery summary (attempt/revision ceilings). */
  recoveryPolicySummary?: string;
  /** Planner AI usage when an AI proposal was attempted. */
  plannerAi?: PlannerAiUsage;
  planningLatencyMs: number;
  generatedAt: string;
}

// ── Execution chain (plan → frozen AgentExecutionService) ─────────

export interface PlanAndExecuteInput {
  userId: string;
  goal: string;
  context?: string;
  constraints?: PlanConstraint;
  /** 'deterministic' (default) | 'ai' (routing-backed proposal). */
  mode?: 'deterministic' | 'ai';
}

export interface PlanAndExecuteResult {
  understanding: GoalUnderstanding;
  planResult: PlanGenerationResult;
  /** Present only when the plan was READY and an executor was wired. */
  execution?: {
    run: AgentExecutionRun;
    usage: AgentRunUsage;
  };
}

// ── QualityTier passthrough (planner proposes, never routes) ──────
export type { QualityTier };
