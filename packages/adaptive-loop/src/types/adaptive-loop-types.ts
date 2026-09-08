// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: Domain Types
//
// The model-driven OBSERVE → DECIDE → ACT coordination boundary above
// the frozen foundations:
//
//   OBSERVATION → DECISION → ACTION PROPOSAL → VALIDATION →
//   GOVERNANCE → EXECUTION → OBSERVATION → ...
//
// The model NEVER becomes the security boundary. VedMoulya remains
// authoritative over capabilities, tools, permissions, approvals,
// budgets, routing, verification, recovery and termination. This
// package reuses (never redefines):
//   - AgentObservation / VerificationPolicy / StepRecoveryPolicy /
//     AgentPlan / CapabilityType  (frozen types)
//   - verifyAgainstPolicy / sanitizeTraceText (frozen machinery)
//   - AIOrchestrationService / ToolRuntime via narrow ports
//
// Concepts are deliberately distinct: Goal, Plan, Step, Action,
// Observation, Decision, ActionProposal, Verification, Recovery,
// Outcome. Observation and Decision are never collapsed.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  AgentAutonomyLevel,
  AgentObservation,
  AgentPlan,
  AgentRunBudgetConfig,
  AgentRunUsage,
  AgentToolInfo,
  ToolPermissionClass,
  VerificationPolicy,
  VerificationVerdict,
} from '@vedmoulya/agent-execution';

// ── Decision (the model's untrusted proposal) ─────────────────────
//
// A model decision MUST be one of this closed set — arbitrary
// model-generated commands are never accepted. The Decision carries
// ONLY whitelisted fields; provider/model/execution-directive fields
// are rejected at parse time.

export const ADAPTIVE_DECISION_KINDS = [
  'CONTINUE',
  'TOOL_CALL',
  'AI_ACTION',
  'VERIFY',
  'REVISE_STEP',
  'REPLAN',
  'COMPLETE',
  'FAIL',
  'REQUEST_APPROVAL',
  'ABSTAIN',
] as const;

export type AdaptiveDecisionKind = (typeof ADAPTIVE_DECISION_KINDS)[number];

/** The parsed, whitelisted decision (never contains routing directives). */
export interface AdaptiveDecision {
  decisionId: string;
  kind: AdaptiveDecisionKind;
  /** Bounded rationale (sanitized, length-capped). */
  rationale: string;
  /** Optional target step for VERIFY / REVISE_STEP / tool/action targeting. */
  targetStepId?: string;
  /** AI_ACTION: proposed capability (must already be allowed). */
  capability?: CapabilityType;
  /** AI_ACTION: FULL hard requirements — never collapsed to [capability]. */
  requiredCapabilities?: CapabilityType[];
  /** TOOL_CALL: the tool name (must resolve in the frozen registry). */
  tool?: string;
  /** TOOL_CALL: tool arguments (validated by the frozen ToolRuntime). */
  arguments?: Record<string, unknown>;
  /** VERIFY: optional verification policy override for the target step. */
  verification?: VerificationPolicy;
  /** REVISE_STEP: the revised instruction context (never authority fields). */
  reviseInstruction?: string;
  /** REPLAN: why a new plan is requested (bounded). */
  replanReason?: string;
  /** FAIL: why the goal cannot be completed (bounded). */
  failReason?: string;
  /** REQUEST_APPROVAL: what needs a human decision (bounded). */
  approvalReason?: string;
  /** ABSTAIN: why no safe decision exists (bounded). */
  abstainReason?: string;
}

// ── ActionProposal (validated decision → executable proposal) ─────
//
// Only a VALIDATED + GOVERNED proposal may be executed. The proposal is
// the narrow seam between the model's intent and the frozen execution
// chain (AIOrchestrationService for AI_ACTION, ToolRuntime for
// TOOL_CALL). It never carries routing/provider fields.

export interface ActionProposal {
  proposalId: string;
  decisionId: string;
  kind: 'TOOL_CALL' | 'AI_ACTION';
  stepId: string;
  actionId: string;
  capability: CapabilityType;
  /** FULL hard requirements (never reduced). */
  requiredCapabilities: CapabilityType[];
  /** TOOL_CALL only. */
  toolName?: string;
  /** TOOL_CALL only (schema-validated by the ToolRuntime at execution). */
  arguments?: Record<string, unknown>;
  /** AI_ACTION only (composed instruction for the routing stack). */
  instruction?: string;
  /** Verified permission class for tool proposals. */
  permissionClass?: ToolPermissionClass;
  /** High-risk proposals require governance (approval gate). */
  requiresApproval: boolean;
}

// ── Run state machine ─────────────────────────────────────────────

export const ADAPTIVE_RUN_STATES = [
  'EXECUTING', // an approved action is running (or the first step starts)
  'OBSERVING', // normalizing the action result into a bounded Observation
  'VERIFYING', // running frozen verification over a step attempt
  'RECOVERING', // bounded recovery after a failed/unknown attempt
  'DECIDING', // consulting the decision model (bounded context)
  'PROPOSED_ACTION', // a decision was parsed into a proposal
  'VALIDATING', // capability/tool/permission/budget validation
  'GOVERNANCE', // approval gates / escalation checks
  'WAITING_FOR_APPROVAL', // paused at a human gate — only explicit approval resumes
  'VERIFIED', // plan-level verification passed; goal ACHIEVED
  'COMPLETED', // terminal success
  'FAILED_FINAL', // bounded failure (recovery exhausted, budgets, loop)
  'BLOCKED', // invalid proposal / capability escalation / unavailable tool
  'CANCELLED', // cancelled by the caller
] as const;

export type AdaptiveRunState = (typeof ADAPTIVE_RUN_STATES)[number];

export const ADAPTIVE_TERMINAL_STATES: readonly AdaptiveRunState[] = [
  'VERIFIED',
  'COMPLETED',
  'FAILED_FINAL',
  'BLOCKED',
  'CANCELLED',
] as const;

export type AdaptiveOutcome =
  'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'FAILED' | 'BLOCKED' | 'CANCELLED';

/** Every terminal path explains WHY (never silent). */
export type AdaptiveTerminationReason =
  | 'GOAL_VERIFIED'
  | 'COMPLETE_DECISION'
  | 'DECISION_LOOP_BUDGET_EXCEEDED'
  | 'ACTION_BUDGET_EXCEEDED'
  | 'TOOL_CALL_BUDGET_EXCEEDED'
  | 'TOKEN_BUDGET_EXCEEDED'
  | 'COST_BUDGET_EXCEEDED'
  | 'WALL_CLOCK_BUDGET_EXCEEDED'
  | 'REVISION_BUDGET_EXCEEDED'
  | 'REPLAN_BUDGET_EXCEEDED'
  | 'ABSTAIN_LIMIT_EXCEEDED'
  | 'LOOP_DETECTED'
  | 'INVALID_DECISION'
  | 'CAPABILITY_ESCALATION'
  | 'PERMISSION_ESCALATION'
  | 'BUDGET_ESCALATION'
  | 'AUTONOMY_ESCALATION'
  | 'TOOL_UNAVAILABLE'
  | 'UNAUTHORIZED_TOOL'
  | 'APPROVAL_REJECTED'
  | 'FAIL_DECISION'
  | 'PERMISSION_DENIED'
  | 'MODEL_FAILURE'
  | 'VERIFICATION_BLOCKED'
  | 'RECOVERY_EXHAUSTED'
  | 'CANCELLED_BY_CALLER';

// ── Adaptive loop budgets (hard bounds) ───────────────────────────

export interface AdaptiveLoopBudgets {
  /** Max DECIDING consultations per run. Default 40. */
  maxDecisionIterations: number;
  /** Max executed actions per run. Default 24. */
  maxActions: number;
  /** Max tool calls per run. Default 8. */
  maxToolCalls: number;
  /** Max retries of a failed action (recovery). Default 2. */
  maxRetries: number;
  /** Max REVISE_STEP applications. Default 2. */
  maxRevisions: number;
  /** Max REPLAN requests. Default 2. */
  maxReplans: number;
  /** Max wall-clock run time ms. Default 300 000. */
  maxWallClockMs: number;
  /** Max cumulative estimated tokens. Default 64 000. */
  maxTokens: number;
  /** Max cumulative estimated cost USD. Default 1.0. */
  maxCostUsd: number;
  /** Repeated identical decisions/actions tolerated before LOOP_DETECTED. */
  loopThreshold: number;
  /** ABSTAIN decisions tolerated before honest failure. Default 3. */
  maxAbstains: number;
}

export const DEFAULT_ADAPTIVE_LOOP_BUDGETS: AdaptiveLoopBudgets = {
  maxDecisionIterations: 40,
  maxActions: 24,
  maxToolCalls: 8,
  maxRetries: 2,
  maxRevisions: 2,
  maxReplans: 2,
  maxWallClockMs: 300_000,
  maxTokens: 64_000,
  maxCostUsd: 1.0,
  loopThreshold: 3,
  maxAbstains: 3,
};

// ── Usage accounting ──────────────────────────────────────────────

export interface AdaptiveRunUsage extends AgentRunUsage {
  decisionIterations: number;
  replans: number;
  revisions: number;
  abstains: number;
  /** Fingerprints of executed actions (loop detection). */
  actionFingerprints: string[];
}

export const EMPTY_ADAPTIVE_USAGE: AdaptiveRunUsage = {
  attempts: 0,
  revisions: 0,
  toolCalls: 0,
  tokensUsed: 0,
  costUsd: 0,
  latencyMs: 0,
  decisionIterations: 0,
  replans: 0,
  abstains: 0,
  actionFingerprints: [],
};

// ── Traceable decision record (PHASE 18) ──────────────────────────

export interface AdaptiveDecisionRecord {
  decisionId: string;
  decisionKind: AdaptiveDecisionKind;
  stepId: string;
  actionId?: string;
  capability?: CapabilityType;
  requiredCapabilities?: CapabilityType[];
  tool?: string;
  /** Provider/model ONLY when the frozen runtime actually selected them. */
  provider?: string;
  model?: string;
  /** Sanitized, bounded rationale (never raw prompts, never secrets). */
  rationale: string;
  validation: 'APPROVED' | 'REJECTED' | 'BLOCKED';
  /** Why the decision was blocked/rejected (deterministic). */
  rejectionReasons: string[];
  attempt: number;
  revision: number;
  replanCount: number;
  /** Provider/model usage recorded by the frozen runtime (when AI). */
  tokens?: { input: number; output: number; total: number };
  costUsd?: number;
  latencyMs?: number;
  decidedAt: string;
}

// ── The run ───────────────────────────────────────────────────────

export interface AdaptiveRun {
  runId: string;
  goalId: string;
  planId: string;
  userId?: string;
  goal: string;
  plan: AgentPlan;
  state: AdaptiveRunState;
  stateHistory: AdaptiveRunState[];
  outcome?: AdaptiveOutcome;
  terminationReason?: AdaptiveTerminationReason;
  /** Bounded observations (sanitized). */
  observations: AgentObservation[];
  /** Every validated/rejected decision (traceable). */
  decisionRecords: AdaptiveDecisionRecord[];
  /** Executed proposals (the validated + governed actions). */
  executedActions: ActionProposal[];
  stepStatus: Record<string, 'pending' | 'executing' | 'verified' | 'failed' | 'blocked'>;
  verificationResults: VerificationSummary[];
  usage: AdaptiveRunUsage;
  budget: AdaptiveRunBudgetConfig;
  loopBudgets: AdaptiveLoopBudgets;
  /** Authority preserved across replan/resume (never widened). */
  autonomyLevel: AgentAutonomyLevel;
  allowedTools: string[];
  grantedPermissionClasses: ToolPermissionClass[];
  /** Bounded REVISE_STEP instruction context per step. */
  revisedInstructions: Record<string, string>;
  /** Proposal paused at an explicit human approval gate (resume target). */
  pendingApprovalProposal?: ActionProposal;
  pendingApprovalReason?: string;
  /** Execution attempts executed per step (recovery bound accounting). */
  stepAttempts: Record<string, number>;
  currentStepId?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  /** Bounded termination detail (sanitized). */
  error?: string;
}

/** The frozen execution budget, merged with explicit overrides. */
export type AdaptiveRunBudgetConfig = AgentRunBudgetConfig;

// ── Inputs ────────────────────────────────────────────────────────

export interface AdaptiveLoopInput {
  userId: string;
  goal: string;
  /** The plan (from the frozen planning boundary — READY already). */
  plan: AgentPlan;
  goalId?: string;
  planId?: string;
  /** Explicit budget overrides (never looser than the loop's ceilings). */
  budget?: Partial<AgentRunBudgetConfig>;
  loopBudgets?: Partial<AdaptiveLoopBudgets>;
  /** Tools the principal is permitted to use (constraint union). */
  allowedTools?: string[];
  /** Permission classes the principal holds. Default ['READ']. */
  grantedPermissionClasses?: ToolPermissionClass[];
  /** Autonomy level (default SUPERVISED — ASSISTED gates every tool). */
  autonomyLevel?: AgentAutonomyLevel;
  /** Optional step to start from (recovery/resume). */
  startStepId?: string;
}

export interface AdaptiveApprovalInput {
  runId: string;
  proposalId: string;
  actor: string;
}

export interface VerificationSummary {
  stepId: string;
  verdict: VerificationVerdict;
  reasons: string[];
}

export type { AgentObservation, AgentToolInfo };
