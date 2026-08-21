// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · types
// SPRINT-030 — the provider-neutral orchestration CONTRACT.
//
// This package is a COMPOSITION layer — NOT an engine. Every type here is a
// contract or a deterministic policy over evidence produced by the frozen
// estate (provider registry, cost ledger, brain, proactive layer, execution
// bridge). The honesty rules are absolute:
//   • provider health is ONLY ever OBSERVED (UNKNOWN until evidence exists)
//   • cost is ONLY ever MEASURED or policy-checked (never fabricated; UNKNOWN
//     pricing stays UNKNOWN)
//   • autonomy levels never jump automatically
//   • selection strategies are ADVISORY rankings — the frozen routing
//     authority performs actual provider selection/execution
//   • verification chains are BOUNDED and terminate deterministically —
//     never unrestricted AI-to-AI loops
// ─────────────────────────────────────────────────────────────────────────────

// ── Provider health (G-1) ──────────────────────────────────────────────────

/** Evidence-based runtime health of a provider. UNKNOWN until observed. */
export type ProviderHealthState =
  'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'MISCONFIGURED';

/** One runtime call outcome fed into the health ledger (never fabricated). */
export interface HealthObservation {
  providerId: string;
  ownerId?: string;
  kind: 'success' | 'failure' | 'timeout' | 'quota_exhausted' | 'config_error';
  latencyMs?: number;
  errorCode?: string;
  at: string;
}

export interface ProviderHealth {
  providerId: string;
  state: ProviderHealthState;
  /** Observations counted in the active window. */
  observedCalls: number;
  /** Successes / observedCalls within the window (0 when no observations). */
  recentSuccessRate: number;
  avgLatencyMs?: number;
  /** Last observation timestamp (undefined before any observation). */
  lastObservedAt?: string;
  /** Human-readable evidence lines — the reason for the state. */
  evidence: string[];
}

// ── Cost policy (G-2) ───────────────────────────────────────────────────────

export type CostBucket = 'task' | 'daily' | 'provider' | 'workspace';

/** Fail-closed per-bucket USD caps. A missing limit = no cap for that bucket. */
export interface CostPolicyLimits {
  maxTaskCostUsd?: number;
  maxDailyCostUsd?: number;
  maxProviderCostUsd?: number;
  maxWorkspaceCostUsd?: number;
}

/** What the fabric knows about current spend per bucket (from the cost ledger). */
export interface CostSpendSnapshot {
  taskUsd?: number;
  dailyUsd?: number;
  providerUsd?: number;
  workspaceUsd?: number;
}

export interface CostPolicyDecision {
  allowed: boolean;
  /** Why (or why not) — never a bare boolean. */
  reason: string;
  /** The bucket that was at/over its cap, when the decision is a block. */
  exhaustedBucket?: CostBucket;
  /** Current spend used for the check (only what evidence supports). */
  current: CostSpendSnapshot;
}

// ── Autonomy levels (G-3) ──────────────────────────────────────────────────

/**
 * Autonomy levels (0–5). A level is NEVER jumped automatically — every action
 * is classified against the existing ActionClassPolicy (A/B/C/D over the
 * frozen SENSITIVE_ACTIONS) and the level gate is re-verified each time.
 */
export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface AutonomyDecision {
  level: AutonomyLevel;
  /** The existing action class (A/B/C/D) the action was classified as. */
  actionClass: 'A' | 'B' | 'C' | 'D';
  /** Whether the action may proceed at the current level. */
  allowed: boolean;
  reasons: string[];
  /** Which authority informed the decision. */
  authority: 'SENSITIVE_ACTIONS' | 'ACTION_CLASS_POLICY' | 'AUTONOMY_GATE';
  /** The minimum level required for this action class. */
  requiredLevel: AutonomyLevel;
}

// ── Selection strategies (G-4) ─────────────────────────────────────────────

export type SelectionStrategyKind = 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';

export type PrivacyClass = 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'PRIVATE';

/**
 * One provider candidate for advisory ranking. Fields are evidence the caller
 * (gateway over the real provider registry) supplies — the strategy never
 * invents quality/cost/latency.
 */
export interface StrategyCandidate {
  providerId: string;
  modelId?: string;
  name: string;
  capabilityMatched: boolean;
  quality?: number;
  latencyMs?: number;
  estimatedCostUsd?: number;
  freeAvailability?: 'FREE' | 'FREE_WITH_QUOTA' | 'PAID';
  localAvailability?: 'yes' | 'no';
  privacyClass?: PrivacyClass;
  /** Observed health (from the fabric's own ledger) when known. */
  healthState?: ProviderHealthState;
  /** Registry-declared availability 0..1. */
  availability?: number;
  evidence: string[];
}

export interface StrategySelection {
  strategy: SelectionStrategyKind;
  selected: StrategyCandidate | undefined;
  ranked: StrategyCandidate[];
  /** Human-readable explanation — e.g. "Selected local model because the task
   *  was classified PRIVATE." */
  reasons: string[];
}

// ── Normalized provider result (G-5) ───────────────────────────────────────

export type NormalizedResultKind = 'text' | 'structured' | 'tool' | 'error';

export interface NormalizedUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface NormalizedProviderResult {
  kind: NormalizedResultKind;
  /** For kind 'text'. */
  text?: string;
  /** For kind 'structured' — typed JSON (caller-defined shape). */
  data?: unknown;
  /** For kind 'tool' — the tool name + arguments the model requested. */
  toolCall?: { name: string; arguments?: unknown };
  /** For kind 'error' — normalized error (never raw provider internals). */
  error?: { code: string; message: string };
  metadata: Record<string, string | number | boolean>;
  usage?: NormalizedUsage;
  /** Cost ONLY when actually reported/measured — never fabricated. */
  costUsd?: number;
  latencyMs?: number;
  providerId?: string;
  modelId?: string;
  /** Confidence ONLY when explicitly provided by the model/provider. */
  confidence?: number;
}

// ── Verification chains (G-6) ──────────────────────────────────────────────

export interface VerificationChainConfig {
  maxDepth: number;
  maxProviders: number;
  timeoutMs: number;
  maxCostUsd: number;
}

export type VerificationVerdict = 'VERIFIED' | 'CONTRADICTED' | 'NEEDS_REVIEW' | 'INCONCLUSIVE';

export interface VerificationChainDecision {
  verdict: VerificationVerdict;
  /** Human-readable evidence trail. */
  reasons: string[];
  /** Depth actually used (never exceeds maxDepth — deterministic termination). */
  depthUsed: number;
  /** Providers actually consulted. */
  providersUsed: number;
  /** Whether the chain stayed within the configured bounds. */
  withinBounds: boolean;
}

// ── Workflow bounds (G-7) ──────────────────────────────────────────────────

export interface WorkflowLimits {
  maxParallelProviders: number;
  maxWorkflowDepth: number;
  maxWorkflowTasks: number;
  maxProviderCalls: number;
  maxWorkflowCostUsd: number;
  maxWorkflowTimeMs: number;
}

/** A proposed orchestration plan (produced by the EXISTING decomposer/planner —
 *  the fabric only bounds it, never executes it). */
export interface WorkflowPlan {
  taskCount: number;
  depth: number;
  maxParallelFanout: number;
  estimatedProviderCalls: number;
  estimatedCostUsd?: number;
  estimatedTimeMs?: number;
}

export interface WorkflowBoundsDecision {
  allowed: boolean;
  reason: string;
  /** Which limit was exceeded, when blocked. */
  exceeded?: 'parallel' | 'depth' | 'tasks' | 'calls' | 'cost' | 'time';
}
