// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Domain Types
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// The Enterprise Brain is the highest decision-making layer of
// VedMoulya. It is NOT another AI model, orchestrator, or provider —
// it coordinates every Enterprise Intelligence Engine and DECIDES.
// It never executes.
//
// A `BrainDecision` is one explained choice (goal priority, provider
// selection, budget strategy, …) with full explainability: why,
// evidence, confidence, trade-offs, alternatives, and risks. Decisions
// are grouped into `BrainDecisionPlan`s — one per goal — produced by
// the decision pipeline (Receive Goal → Analyze → Consult every engine
// → Generate Plan → Explain → Pass to Execution Orchestrator).
// ──────────────────────────────────────────────────────────────────

// ── Decision Types (the 14 things the Enterprise Brain decides) ────────────

export type BrainDecisionType =
  | 'goal_priority'
  | 'task_priority'
  | 'execution_order'
  | 'capability_selection'
  | 'provider_selection'
  | 'context_strategy'
  | 'execution_strategy'
  | 'budget_strategy'
  | 'quality_threshold'
  | 'risk_assessment'
  | 'retry_policy'
  | 'fallback_policy'
  | 'learning_feedback'
  | 'business_objectives';

export const BRAIN_DECISION_TYPES: readonly BrainDecisionType[] = [
  'goal_priority',
  'task_priority',
  'execution_order',
  'capability_selection',
  'provider_selection',
  'context_strategy',
  'execution_strategy',
  'budget_strategy',
  'quality_threshold',
  'risk_assessment',
  'retry_policy',
  'fallback_policy',
  'learning_feedback',
  'business_objectives',
] as const;

/** Human labels used by the explainer, dashboards, and reports. */
export const BRAIN_DECISION_TYPE_LABELS: Record<BrainDecisionType, string> = {
  goal_priority: 'Goal Priority',
  task_priority: 'Task Priority',
  execution_order: 'Execution Order',
  capability_selection: 'Capability Selection',
  provider_selection: 'Provider Selection',
  context_strategy: 'Context Strategy',
  execution_strategy: 'Execution Strategy',
  budget_strategy: 'Budget Strategy',
  quality_threshold: 'Quality Thresholds',
  risk_assessment: 'Risk Assessment',
  retry_policy: 'Retry Policy',
  fallback_policy: 'Fallback Policy',
  learning_feedback: 'Learning Feedback',
  business_objectives: 'Business Objectives',
};

// ── Lifecycle ───────────────────────────────────────────────────────────────

export type BrainDecisionStatus =
  'proposed' | 'approved' | 'rejected' | 'handed_off' | 'superseded';

export const BRAIN_DECISION_STATUSES: readonly BrainDecisionStatus[] = [
  'proposed',
  'approved',
  'rejected',
  'handed_off',
  'superseded',
] as const;

export type BrainPlanStatus = BrainDecisionStatus;

export type BrainDecisionAction = 'created' | 'approved' | 'rejected' | 'handed_off' | 'superseded';

// ── Confidence ──────────────────────────────────────────────────────────────

export type BrainConfidenceLevel = 'low' | 'medium' | 'high';

export interface BrainDecisionConfidence {
  /** Composite confidence score in [0, 1]. */
  score: number;
  level: BrainConfidenceLevel;
  /** Human-readable factors that raised/lowered confidence. */
  factors: string[];
}

// ── Recommendation (what to do) ─────────────────────────────────────────────

export interface BrainRecommendation {
  entityType: string;
  entityId: string;
  entityLabel: string;
  /** Imperative action the orchestrator/human should take. */
  action: string;
  /** Machine-readable parameters for the handoff. */
  params: Record<string, unknown>;
}

// ── Reason (explainability: why + evidence + trade-offs + alternatives + risks) ──

export interface BrainDecisionReason {
  why: string;
  evidence: string[];
  tradeoffs: string[];
  alternatives: string[];
  risks: string[];
}

// ── Context (the situation the decision was made in) ────────────────────────

export interface BrainDecisionContext {
  goalId: string;
  goalTitle: string;
  goalCategory: string;
  goalPriority: string;
  business: string[];
  budgetUsd?: number;
  /** Which Enterprise Intelligence engines were consulted for this decision. */
  engineSources: string[];
  observedAt: string;
}

// ── Audit / History ─────────────────────────────────────────────────────────

export interface BrainAuditEntry {
  auditId: string;
  action: BrainDecisionAction;
  version: number;
  actor: string;
  note?: string;
  timestamp: string;
}

/** Flattened, queryable version-history record (DecisionHistory). */
export interface BrainHistoryEntry {
  historyId: string;
  decisionId: string;
  planId: string;
  goalId: string;
  type: BrainDecisionType;
  version: number;
  action: BrainDecisionAction;
  actor: string;
  note?: string;
  timestamp: string;
}

// ── The Decision ────────────────────────────────────────────────────────────

export interface BrainDecision {
  decisionId: string;
  planId: string;
  goalId: string;
  type: BrainDecisionType;
  title: string;
  description: string;
  recommendation: BrainRecommendation;
  confidence: BrainDecisionConfidence;
  reason: BrainDecisionReason;
  context: BrainDecisionContext;
  status: BrainDecisionStatus;
  /** Bumped on every state transition. */
  version: number;
  actor: string;
  history: BrainAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

// ── The Plan (one per goal, produced by the decision pipeline) ──────────────

export interface BrainPipelineStep {
  step: string;
  engine: string;
  consulted: boolean;
  note?: string;
}

export interface BrainDecisionPlan {
  planId: string;
  goalId: string;
  goalTitle: string;
  status: BrainPlanStatus;
  /** The 14 explained decisions for this goal. */
  decisions: BrainDecision[];
  /** Weighted average of the decisions' confidence scores. */
  overallConfidence: number;
  /** Trace of the decision pipeline (Receive Goal → … → Pass to Orchestrator). */
  pipeline: BrainPipelineStep[];
  version: number;
  actor: string;
  createdAt: string;
  updatedAt: string;
}

// ── Metrics / Analytics ─────────────────────────────────────────────────────

export interface BrainTrendPoint {
  /** YYYY-MM-DD bucket. */
  date: string;
  decisions: number;
  avgConfidence: number;
}

export interface BrainDecisionMetrics {
  totals: {
    decisions: number;
    plans: number;
    proposed: number;
    approved: number;
    rejected: number;
    handedOff: number;
    superseded: number;
  };
  byType: Record<BrainDecisionType, { count: number; avgConfidence: number }>;
  byStatus: Record<BrainDecisionStatus, number>;
  avgConfidence: number;
  highConfidenceCount: number;
  trend: BrainTrendPoint[];
}

// ── Dashboard aggregate ─────────────────────────────────────────────────────

export interface BrainDashboardData {
  totals: {
    decisions: number;
    plans: number;
    proposed: number;
    approved: number;
    rejected: number;
    handedOff: number;
    superseded: number;
    pendingApprovals: number;
  };
  byType: Record<BrainDecisionType, number>;
  byStatus: Record<BrainDecisionStatus, number>;
  avgConfidence: number;
  highConfidenceCount: number;
  trend: BrainTrendPoint[];
  recentDecisions: BrainDecision[];
  recentPlans: BrainDecisionPlan[];
}
