// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestrated AI Loop Engine: Domain Types
// EPIC-006 — Orchestrated AI / Loop Engine
// A controlled, measurable, evidence-first orchestration engine that
// solves complex goals by: understanding the goal (GoalSpecification),
// decomposing it into a typed TaskGraph, assigning each task to an
// AI specialist through the frozen AI runtime (AI-SELECT / EI-002 /
// EI-004 / EI-003), evaluating intermediate results with an explicit
// critic, and iterating until the quality/evidence criteria are
// satisfied — or a bounded termination reason is reached.
//
// This layer defines TYPES ONLY. It never executes AI, never calls
// providers and never re-implements the frozen AI runtime.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type { EvidenceState as RuntimeEvidenceState } from '@vedmoulya/services';

/** Re-exported evidence state (from the frozen EvidenceEvaluator contract). */
export type EvidenceState = RuntimeEvidenceState;

// ── Goal Understanding (Phase 1) ────────────────────────────────────────────

/** Recognized goal patterns — controlled interpretation, no free-form guessing. */
export type GoalPattern = 'abap-debugger' | 'app-builder' | 'ai-app-builder' | 'generic';

export type LoopRiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'critical';

export type LatencyPreference = 'latency_first' | 'balanced' | 'quality_first';

/** Evidence a task/run must satisfy (Phase 6). Collection is the RAG scope. */
export interface EvidenceRequirement {
  /** RAG collection the evidence is retrieved from (tenant/user-scoped). */
  collection: string;
  /** Retrieval query (may contain the {goal} placeholder). */
  queryTemplate: string;
  topK?: number;
  /** When true the runtime ABSTAINS instead of fabricating a grounded answer. */
  groundingRequired: boolean;
  /** Why this evidence is required (explainability). */
  reason: string;
}

/** Verifiable success criterion — checked deterministically by the critic. */
export interface SuccessCriterion {
  criterionId: string;
  description: string;
  /** Section keywords that MUST appear in the output (deterministic check). */
  requiredSections?: string[];
  /** Minimum output length in characters. */
  minLength?: number;
  /** Expected output format. */
  format?: 'text' | 'markdown' | 'code' | 'json';
}

/**
 * Typed GoalSpecification (Phase 1). A goal is converted into a
 * controlled, inspectable contract — never into uncontrolled interpretation.
 */
export interface GoalSpecification {
  goalId: string;
  /** The raw user goal text. */
  rawGoal: string;
  /** The distilled objective. */
  objective: string;
  /** Hard constraints on the solution. */
  constraints: string[];
  /** Capabilities required (from the frozen AI capability taxonomy). */
  requiredCapabilities: CapabilityType[];
  /** Evidence the goal must be grounded in. */
  evidenceRequirements: EvidenceRequirement[];
  /** Success criteria the final result must satisfy. */
  successCriteria: SuccessCriterion[];
  riskLevel: LoopRiskLevel;
  /** Execution budget envelope (Phase 4/8). */
  budget: LoopBudgetConfig;
  latencyPreference: LatencyPreference;
  /** Explicit tool allowlist (empty = no tools). */
  allowedTools: string[];
  /** Maximum refinement iterations — the loop is ALWAYS bounded. */
  maxIterations: number;
  /** Which pattern was matched. */
  pattern: GoalPattern;
  /** Human-readable reasons for every derivation decision. */
  derivationReasons: string[];
  /** Quality tier for every specialist call in this run. */
  qualityTier: QualityTier;
  /**
   * Deterministic underspecification signal: when set, the loop suspends
   * with USER_CLARIFICATION_REQUIRED instead of guessing (Phase 7/12).
   */
  clarificationNeeded?: { reason: string };
}

// ── Loop Budget (Phase 4 / Phase 8 / Phase 12) ──────────────────────────────

/**
 * The six hard bounds of the loop. Every bound is checked BEFORE the next
 * provider/tool call — the loop terminates before exhaustion, never after.
 */
export interface LoopBudgetConfig {
  /** Maximum refinement iterations. Default 8. */
  maxIterations: number;
  /** Maximum cumulative input+output tokens. */
  maxTokens: number;
  /** Maximum cumulative estimated cost in USD. */
  maxCostUsd: number;
  /** Maximum wall-clock run time in ms. */
  maxLatencyMs: number;
  /** Maximum specialist (provider) calls. */
  maxProviderCalls: number;
  /** Maximum tool calls. */
  maxToolCalls: number;
}

export const DEFAULT_LOOP_BUDGET: LoopBudgetConfig = {
  maxIterations: 8,
  maxTokens: 8_000,
  maxCostUsd: 1.0,
  maxLatencyMs: 300_000,
  maxProviderCalls: 32,
  maxToolCalls: 16,
};

export interface LoopBudgetUsage {
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  costUsd: number;
  /** Wall-clock time since the run started, in ms. */
  latencyMs: number;
  providerCalls: number;
  toolCalls: number;
  iterations: number;
}

export const EMPTY_BUDGET_USAGE: LoopBudgetUsage = {
  tokensInput: 0,
  tokensOutput: 0,
  tokensTotal: 0,
  costUsd: 0,
  latencyMs: 0,
  providerCalls: 0,
  toolCalls: 0,
  iterations: 0,
};

// ── Task Graph (Phase 2) ────────────────────────────────────────────────────

export type LoopTaskStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';

export type LoopTaskPhase =
  | 'understand'
  | 'retrieve'
  | 'analyze'
  | 'produce'
  | 'validate'
  | 'critique'
  | 'refine'
  | 'finalize';

/** One typed task in the loop graph. */
export interface LoopTask {
  taskId: string;
  title: string;
  description: string;
  capability: CapabilityType;
  qualityTier: QualityTier;
  /** TaskIds that must complete first (DAG edges). */
  dependencies: string[];
  /** Whether this task may run concurrently with its ready siblings. */
  parallelEligible: boolean;
  /** Composed prompt for the specialist. */
  input: string;
  /** What a successful task output looks like (used by the critic). */
  expectedOutput: string;
  /**
   * Slot name this task's output feeds into for dependent prompts
   * (e.g. {analysis}, {evidence}, {fix}). Optional — tasks without a slot
   * still contribute to the synthesized final answer.
   */
  slot?: string;
  /** Evidence requirement forwarded to the runtime (RAG + grounding). */
  evidenceRequirement?: {
    collection: string;
    query: string;
    topK?: number;
    groundingRequired: boolean;
  };
  /** Explicit tool allowlist for this task (empty = no tools). */
  allowedTools: string[];
  /**
   * Per-tool probe arguments (keyed by tool name). The loop executes each
   * allowed tool once as a pre-flight availability/security check before the
   * specialist runs — tools with required schema arguments (e.g. calculator
   * needs an `expression`) receive their probe arguments here so the probe
   * passes schema validation and the run is not spuriously SECURITY_BLOCKed.
   * Tools without an entry are probed with `{}` (e.g. current_time).
   */
  toolArguments?: Record<string, Record<string, unknown>>;
  /** Per-task budget envelope (checked before execution). */
  budget: { maxTokens?: number; maxCostUsd?: number; timeoutMs?: number };
  retryPolicy: { maxRetries: number; retryDelayMs: number };
  status: LoopTaskStatus;
  /** Declaration order within the graph. */
  order: number;
  phase: LoopTaskPhase;
  /** Populated when the task completes. */
  result?: LoopTaskResult;
  error?: string;
}

/** Measured outcome of one specialist execution. */
export interface LoopTaskResult {
  content: string;
  provider: string;
  model: string;
  tokens: { input: number; output: number; total: number };
  costUsd: number;
  latencyMs: number;
  abstained: boolean;
  evidenceState?: EvidenceState;
  /** Human-readable AI-SELECT / EI-002 / EI-004 explanation. */
  selectionExplanation?: string;
  validationDecision?: string;
  attempts: number;
  fallbackUsed: boolean;
}

export interface LoopTaskGraph {
  goalId: string;
  tasks: LoopTask[];
  /** TaskIds with no dependencies (graph entry points). */
  entryTaskIds: string[];
  /** TaskIds no other task depends on (final outputs). */
  terminalTaskIds: string[];
  validated: boolean;
  validationReasons: string[];
  createdAt: string;
  version: '1';
}

// ── Critic / Evaluator (Phase 5) ────────────────────────────────────────────

export type CriticVerdict = 'PASS' | 'FAIL' | 'PARTIAL' | 'ABSTAIN';

export interface CriticCheck {
  name: string;
  passed: boolean;
  detail: string;
  severity: 'critical' | 'minor';
}

export interface CriticAssessment {
  verdict: CriticVerdict;
  /** 0..1 — fraction of passed checks. */
  score: number;
  checks: CriticCheck[];
  reasons: string[];
}

// ── Adaptive Refinement (Phase 7) ───────────────────────────────────────────

/**
 * WHY another iteration is necessary. The loop NEVER simply calls the same
 * model repeatedly — every action selects a different specialist shape.
 */
export type RefinementAction =
  | 'retrieve_more_evidence'
  | 'reason_deeper'
  | 'fix_output'
  | 'verify_conflict'
  | 'clarification_required'
  | 'finish'
  | 'stop';

export interface RefinementDecision {
  action: RefinementAction;
  /** Human-readable explanation of the decision. */
  reason: string;
  /** Termination reason when action === 'stop' (or clarification). */
  terminationReason?: TerminationReason;
  /** Task title/description hints for the adaptive task (optional). */
  nextTaskHint?: string;
}

// ── Termination (Phase 12) — never silently terminate ───────────────────────

export type TerminationReason =
  | 'SUCCESS'
  | 'BUDGET_EXCEEDED'
  | 'ITERATION_LIMIT'
  | 'TIMEOUT'
  | 'EVIDENCE_INSUFFICIENT'
  | 'EVIDENCE_CONFLICT'
  | 'SECURITY_BLOCK'
  | 'TOOL_FAILURE'
  | 'PROVIDER_FAILURE'
  | 'VALIDATION_FAILURE'
  | 'USER_CLARIFICATION_REQUIRED'
  | 'CANCELLED';

export const TERMINATION_REASONS: readonly TerminationReason[] = [
  'SUCCESS',
  'BUDGET_EXCEEDED',
  'ITERATION_LIMIT',
  'TIMEOUT',
  'EVIDENCE_INSUFFICIENT',
  'EVIDENCE_CONFLICT',
  'SECURITY_BLOCK',
  'TOOL_FAILURE',
  'PROVIDER_FAILURE',
  'VALIDATION_FAILURE',
  'USER_CLARIFICATION_REQUIRED',
  'CANCELLED',
] as const;

// ── Execution Trace (Phase 11) — every loop is explainable ──────────────────

export interface LoopTraceStep {
  iteration: number;
  taskId: string;
  title: string;
  capability: CapabilityType;
  provider: string;
  model: string;
  /** Why THIS specialist was selected (AI-SELECT / EI-002 / EI-004). */
  selectionReason: string;
  tokens: { input: number; output: number; total: number };
  costUsd: number;
  latencyMs: number;
  evidenceState?: EvidenceState;
  toolCalls: number;
  critic?: CriticAssessment;
  /** The adaptive action taken after this step's iteration, if any. */
  refinementAction?: string;
  retried: boolean;
  fallbackUsed: boolean;
  status: 'completed' | 'failed' | 'skipped' | 'abstained' | 'blocked';
  message: string;
  startedAt: string;
  endedAt: string;
}

// ── Run (Phase 9 / Phase 11) ────────────────────────────────────────────────

export type LoopRunStatus =
  'pending' | 'running' | 'completed' | 'suspended' | 'cancelled' | 'failed';

/** A proposed long-term memory. NEVER persisted automatically (Phase 9). */
export interface ProposedMemory {
  type: string;
  content: string;
  source: string;
}

/** The full, explainable record of one loop run. */
export interface LoopRun {
  runId: string;
  goalId: string;
  userId: string;
  goal: string;
  specification: GoalSpecification;
  graph: LoopTaskGraph;
  steps: LoopTraceStep[];
  budgetConfig: LoopBudgetConfig;
  budgetUsage: LoopBudgetUsage;
  status: LoopRunStatus;
  terminationReason?: TerminationReason;
  finalContent?: string;
  finalCritic?: CriticAssessment;
  evidenceStates: EvidenceState[];
  /** Durable information ONLY after explicit user approval (Phase 9). */
  proposedMemories: ProposedMemory[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

/** Initial run creation input (a run is always created with a plan). */
export interface NewLoopRun {
  runId: string;
  goalId: string;
  userId: string;
  goal: string;
  specification: GoalSpecification;
  graph: LoopTaskGraph;
}
