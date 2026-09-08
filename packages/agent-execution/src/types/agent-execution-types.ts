// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Domain Types
//
// The controlled execution layer between "VedMoulya can intelligently
// choose an AI" and "VedMoulya can intelligently accomplish a goal".
//
// Distinct concepts (never collapsed into one "agent loop" class):
//   GOAL        — what the user wants (goalId + objective)
//   PLAN        — how the agent intends to accomplish it (steps)
//   STEP        — one executable unit of work (dependencies, capabilities)
//   ACTION      — a concrete operation (AI call and/or tool call)
//   OBSERVATION — what actually happened after an action
//   VERIFICATION— whether the result satisfies the expected condition
//   RECOVERY    — what to do when verification fails (bounded)
//   OUTCOME     — whether the original goal was achieved
//
// This layer defines TYPES ONLY. It never executes AI, never calls
// providers and never re-implements routing / tools / approval /
// budgets — every capability flows through the narrow ports in
// contracts/agent-execution-ports.ts and reuses the frozen estate.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';

// ── Autonomy (bounded by design — no unrestricted autonomy) ────────
//   ASSISTED             — agent proposes; tool operations require user approval
//   SUPERVISED           — low-risk actions execute; high-risk require approval
//   CONTROLLED_AUTONOMOUS— bounded execution with verification; high-risk gates remain
export type AgentAutonomyLevel = 'ASSISTED' | 'SUPERVISED' | 'CONTROLLED_AUTONOMOUS';

export const AGENT_AUTONOMY_LEVELS: readonly AgentAutonomyLevel[] = [
  'ASSISTED',
  'SUPERVISED',
  'CONTROLLED_AUTONOMOUS',
] as const;

// ── Tool permission boundary (risk ordered low → high) ─────────────
export type ToolPermissionClass =
  'READ' | 'WRITE' | 'EXECUTE' | 'DELETE' | 'NETWORK' | 'SECRETS' | 'DEPLOYMENT';

export const TOOL_PERMISSION_CLASSES: readonly ToolPermissionClass[] = [
  'READ',
  'WRITE',
  'EXECUTE',
  'DELETE',
  'NETWORK',
  'SECRETS',
  'DEPLOYMENT',
] as const;

/** Ascending risk index for a permission class (higher = riskier). */
export const TOOL_PERMISSION_RISK: Record<ToolPermissionClass, number> = {
  READ: 1,
  WRITE: 2,
  EXECUTE: 3,
  DELETE: 4,
  NETWORK: 5,
  SECRETS: 6,
  DEPLOYMENT: 7,
};

/** Classes that ALWAYS require human approval, at every autonomy level. */
export const HIGH_RISK_PERMISSION_CLASSES: readonly ToolPermissionClass[] = [
  'DELETE',
  'SECRETS',
  'DEPLOYMENT',
] as const;

// ── Agent state machine (explicit, controlled, traceable) ──────────
export type AgentRunState =
  | 'PLANNING' // plan is being validated/built before execution
  | 'READY' // validated plan, waiting to execute
  | 'EXECUTING' // a step is executing actions
  | 'VERIFYING' // an attempt is being verified
  | 'RECOVERING' // a failed/unknown attempt is being classified + recovered
  | 'WAITING_FOR_APPROVAL' // paused at a human approval gate
  | 'BLOCKED' // cannot proceed (permission, budget, unavailable, validation)
  | 'COMPLETED' // execution finished (outcome may be PARTIALLY_ACHIEVED)
  | 'FAILED_FINAL' // goal not achieved (recovery exhausted / approval rejected)
  | 'CANCELLED'; // cancelled by the user

export const AGENT_RUN_STATES: readonly AgentRunState[] = [
  'PLANNING',
  'READY',
  'EXECUTING',
  'VERIFYING',
  'RECOVERING',
  'WAITING_FOR_APPROVAL',
  'BLOCKED',
  'COMPLETED',
  'FAILED_FINAL',
  'CANCELLED',
] as const;

/** Terminal states — no further execution happens without an explicit command. */
export const AGENT_TERMINAL_STATES: readonly AgentRunState[] = [
  'BLOCKED',
  'COMPLETED',
  'FAILED_FINAL',
  'CANCELLED',
] as const;

// ── Goal outcome (distinct from step success — see §22/§23) ────────
export type GoalOutcome = 'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'FAILED' | 'BLOCKED';

export const GOAL_OUTCOMES: readonly GoalOutcome[] = [
  'ACHIEVED',
  'PARTIALLY_ACHIEVED',
  'FAILED',
  'BLOCKED',
] as const;

// ── Plan / Step ────────────────────────────────────────────────────

/** One concrete operation inside a step. The model proposes nothing
 *  outside this declared set — the orchestration layer validates every
 *  action (capability, permission, budget) before executing it. */
export type AgentActionSpec =
  | {
      actionId: string;
      kind: 'ai';
      /** Primary/routing capability (frozen CapabilityType taxonomy). */
      capability: CapabilityType;
      /** ALL hard capability requirements — never collapsed to [capability]. */
      requiredCapabilities?: CapabilityType[];
      qualityTier?: QualityTier;
      /** Instruction for the AI action. Supports {goal} and
       *  {outputOf:<stepId>} / {previousOutput} placeholder substitution. */
      instruction: string;
      expectedOutcome?: string;
    }
  | {
      actionId: string;
      kind: 'tool';
      toolName: string;
      arguments?: Record<string, unknown>;
      expectedOutcome?: string;
    };

export type AgentActionKind = AgentActionSpec['kind'];

/** One step: an executable unit of work with dependencies, capability
 *  requirements, an explicit tool allowlist and a verification policy. */
export interface AgentPlanStep {
  stepId: string;
  objective: string;
  /** Primary capability label (informational; the actions carry routing caps). */
  capability?: CapabilityType;
  /** Additional hard capability requirements for the step. */
  requiredCapabilities?: CapabilityType[];
  /** Explicit tool allowlist (empty = no tools). Enforced at execution. */
  allowedTools: string[];
  /** StepIds that must complete first (DAG edges). */
  dependencies: string[];
  /** Ordered actions executed in this step (≥ 1). */
  actions: AgentActionSpec[];
  /** What a successful step looks like (used by verification + trace). */
  expectedOutcome?: string;
  /**
   * Verification policy. Missing policy ⇒ the step verdict is UNKNOWN
   * (never auto-success). A step without verification can never make a
   * goal ACHIEVED — only PARTIALLY_ACHIEVED at best (see interpreter).
   */
  verificationPolicy?: VerificationPolicy;
  /** Bounded recovery overrides (defaults come from the run budget). */
  recoveryPolicy?: StepRecoveryPolicy;
  /** Explicit approval gate — the step pauses before executing. */
  approvalRequired?: boolean;
  metadata?: Record<string, string | number | boolean>;
}

/** The plan: how the agent intends to accomplish the goal. */
export interface AgentPlan {
  planId: string;
  goalId: string;
  objective: string;
  steps: AgentPlanStep[];
  /**
   * Optional FINAL goal-level verification evaluated only after every step
   * completed. Makes GOAL ACHIEVED distinct from STEP VERIFIED: a plan whose
   * steps all passed can still fail this check (goal not achieved).
   */
  finalVerification?: VerificationPolicy;
  /** Human-readable completion criteria (used in outcome reasons). */
  completionCriteria?: string[];
}

// ── Verification ───────────────────────────────────────────────────

export type VerificationVerdict = 'VERIFIED' | 'FAILED' | 'PARTIAL' | 'UNKNOWN' | 'BLOCKED';

export const VERIFICATION_VERDICTS: readonly VerificationVerdict[] = [
  'VERIFIED',
  'FAILED',
  'PARTIAL',
  'UNKNOWN',
  'BLOCKED',
] as const;

/** Deterministic rule checks (preferred over another AI call). */
export type AgentRuleCheck =
  | { name: string; kind: 'includes'; text: string; target?: 'output' | 'observations' }
  | { name: string; kind: 'notIncludes'; text: string; target?: 'output' | 'observations' }
  | { name: string; kind: 'minLength'; length: number; target?: 'output' | 'observations' };

/**
 * Verification policy for a step (or the final goal). Kinds:
 *  - rule:      deterministic text rules over the attempt output/observations
 *  - schema:    output must parse as JSON and contain required keys
 *  - artifact:  a named artifact must exist (or be absent) in the attempt
 *  - command:   run a declared tool and require its outcome (deterministic)
 *  - state:     an artifact must have been created / be absent (state check)
 *  - model:     model-based verification — ONLY when deterministic is impossible
 */
export type VerificationPolicy =
  | { kind: 'rule'; description: string; checks: AgentRuleCheck[] }
  | { kind: 'schema'; description: string; requiredKeys: string[] }
  | {
      kind: 'artifact';
      description: string;
      artifact: { name: string; type?: string; mustExist?: boolean };
    }
  | {
      kind: 'command';
      description: string;
      command: { toolName: string; arguments?: Record<string, unknown>; expect: 'ok' | 'fails' };
    }
  | {
      kind: 'state';
      description: string;
      state: { artifactName: string; change: 'created' | 'absent' };
    }
  | { kind: 'model'; description: string; criteria: string[]; maxOutputTokens?: number };

export type VerificationCheckStatus = 'pass' | 'fail' | 'unknown';

export interface AgentVerificationCheck {
  name: string;
  status: VerificationCheckStatus;
  detail: string;
}

export interface AgentVerificationResult {
  verdict: VerificationVerdict;
  checks: AgentVerificationCheck[];
  /** Human-readable reasons (traceable, never hidden). */
  reasons: string[];
  policyKind: VerificationPolicy['kind'] | 'none';
}

// ── Observation (what actually happened after an action) ───────────
export type AgentObservationStatus = 'succeeded' | 'failed' | 'denied' | 'blocked' | 'unknown';

export interface AgentObservation {
  observationId: string;
  actionId: string;
  stepId: string;
  runId: string;
  attempt: number;
  status: AgentObservationStatus;
  /** Sanitized summary of the result (no raw prompts, no secrets). */
  resultSummary: string;
  error?: string;
  artifacts: AgentArtifactRef[];
  provider?: string;
  model?: string;
  toolName?: string;
  capability?: CapabilityType;
  observedAt: string;
}

export interface AgentArtifactRef {
  name: string;
  type: string;
}

// ── Action execution record (traceability: who/what/how much) ──────
export interface AgentActionRecord {
  actionId: string;
  stepId: string;
  runId: string;
  kind: AgentActionKind;
  attempt: number;
  revision: number;
  fallbackUsed: boolean;
  capability?: CapabilityType;
  provider?: string;
  model?: string;
  toolName?: string;
  status: 'succeeded' | 'failed' | 'denied' | 'blocked';
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
  /** Correlates with the observation emitted for this action. */
  observationId?: string;
  startedAt: string;
  endedAt: string;
}

// ── Recovery (bounded — never an infinite retry loop) ──────────────
export type FailureClass =
  | 'TRANSIENT' // provider/runtime hiccup — retry is legitimate (bounded)
  | 'PERMISSION_DENIED' // tool/security chain refused — never bypassed
  | 'TOOL_UNAVAILABLE' // tool not registered/not allowed
  | 'VERIFICATION_FAILED' // step output did not satisfy the policy
  | 'BUDGET_EXCEEDED' // a hard run bound was reached — fail closed
  | 'ABSTRACTION' // runtime abstained (evidence-first) — not a fabricated success
  | 'UNKNOWN_FAILURE'; // cannot classify honestly

export type RecoveryStrategyType =
  | 'retry' // same action again (attempt budget)
  | 'alternate_model' // re-run through routing expecting fallback (bounded)
  | 'alternate_tool' // declared alternate tool for the step
  | 'revise_step' // change approach: revised instruction (revision budget)
  | 'request_approval' // pause at a human approval gate
  | 'block_step' // cannot proceed — explicit BLOCKED
  | 'fail_step'; // recovery exhausted — explicit FAILED

export interface AgentRecoveryRecord {
  recoveryId: string;
  stepId: string;
  attempt: number;
  failureClass: FailureClass;
  strategy: RecoveryStrategyType;
  reason: string;
  recoveredAt: string;
}

/** Per-step bounded recovery overrides (defaults come from the run). */
export interface StepRecoveryPolicy {
  maxAttempts?: number;
  maxRevisions?: number;
  /** Declared alternative tools tried when the primary tool is unavailable. */
  alternateTools?: string[];
  /**
   * Honest UNKNOWN verdict acceptance for this step. When false (default),
   * UNKNOWN is NOT success: the step enters recovery. When true, the step may
   * complete with verdict UNKNOWN and `verified:false` — the goal can then
   * only ever be PARTIALLY_ACHIEVED, never ACHIEVED.
   */
  acceptUnknown?: boolean;
}

// ── Budget (six hard bounds, checked BEFORE the next call) ─────────
export interface AgentRunBudgetConfig {
  /** Max executions per step (retries included). Default 2. */
  maxAttemptsPerStep: number;
  /** Max revised-step executions per step. Default 1. */
  maxRevisionsPerStep: number;
  /** Max tool calls across the whole run. Default 8. */
  maxToolCalls: number;
  /** Max cumulative estimated tokens. Default 64 000. */
  maxTokens: number;
  /** Max cumulative estimated cost USD. Default 1.0. */
  maxCostUsd: number;
  /** Max wall-clock run time in ms. Default 300 000. */
  maxLatencyMs: number;
}

export const DEFAULT_AGENT_RUN_BUDGET: AgentRunBudgetConfig = {
  maxAttemptsPerStep: 2,
  maxRevisionsPerStep: 1,
  maxToolCalls: 8,
  maxTokens: 64_000,
  maxCostUsd: 1.0,
  maxLatencyMs: 300_000,
};

export interface AgentRunUsage {
  attempts: number;
  revisions: number;
  toolCalls: number;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
}

export const EMPTY_AGENT_RUN_USAGE: AgentRunUsage = {
  attempts: 0,
  revisions: 0,
  toolCalls: 0,
  tokensUsed: 0,
  costUsd: 0,
  latencyMs: 0,
};

// ── Approval (governance is authoritative — the model never approves) ─
export type AgentApprovalReasonClass = ToolPermissionClass | 'EXPLICIT' | 'AUTONOMY';

export interface AgentApprovalRequest {
  approvalId: string;
  runId: string;
  stepId: string;
  stepTitle: string;
  reason: string;
  riskClass: AgentApprovalReasonClass;
  requestedAt: string;
}

export interface AgentApprovalDecision {
  approvalId: string;
  runId: string;
  stepId: string;
  decision: 'approved' | 'rejected';
  note?: string;
  decidedBy: string;
  decidedAt: string;
}

// ── Step / Run state ───────────────────────────────────────────────
export type AgentStepStatus =
  'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'blocked';

export const AGENT_STEP_STATUSES: readonly AgentStepStatus[] = [
  'pending',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'blocked',
] as const;

export interface AgentStepResult {
  stepId: string;
  objective: string;
  status: AgentStepStatus;
  /** Normalized verification verdict of the last attempt (if any). */
  verdict?: VerificationVerdict;
  /** true only when the step VERIFIED — a completed step can be unverified. */
  verified: boolean;
  verification?: AgentVerificationResult;
  /** All action executions in this step (trace correlation). */
  actions: AgentActionRecord[];
  /** Structured observations — one per meaningful action execution. */
  observations: AgentObservation[];
  /** Recovery history of this step (bounded, explainable). */
  recoveries: AgentRecoveryRecord[];
  attempts: number;
  revisions: number;
  toolCalls: number;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  /** Sanitized final output summary (fed to dependent steps + goal check). */
  output?: string;
  error?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface PlanValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  stepId?: string;
  message: string;
}

// ── The run ────────────────────────────────────────────────────────
export interface AgentExecutionRun {
  runId: string;
  goalId: string;
  planId: string;
  userId: string;
  goal: string;
  objective: string;
  autonomyLevel: AgentAutonomyLevel;
  plan: AgentPlan;
  budget: AgentRunBudgetConfig;
  usage: AgentRunUsage;
  state: AgentRunState;
  /** Every state transition (explicit + traceable). */
  stateHistory: AgentRunState[];
  stepResults: AgentStepResult[];
  currentStepId?: string;
  approvals: AgentApprovalRequest[];
  approvalDecisions: AgentApprovalDecision[];
  /** Plan validation result (errors block execution — impossible steps never run). */
  validationIssues: PlanValidationIssue[];
  outcome?: GoalOutcome;
  outcomeReasons: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

// ── Trace (every autonomous action correlated + explainable) ───────
export type AgentTracePhase =
  'planning' | 'action' | 'observation' | 'verification' | 'recovery' | 'outcome';

export interface AgentExecutionTraceRecord {
  runId: string;
  goalId: string;
  planId: string;
  stepId: string;
  actionId?: string;
  phase: AgentTracePhase;
  attempt?: number;
  revision?: number;
  kind?: AgentActionKind;
  capability?: CapabilityType;
  provider?: string;
  model?: string;
  toolName?: string;
  status: string;
  verdict?: VerificationVerdict;
  recovery?: RecoveryStrategyType;
  failureClass?: FailureClass;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  /** Sanitized message — never raw prompts, arguments or secrets. */
  message: string;
  startedAt?: string;
  endedAt?: string;
}
