// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Learning Intelligence Platform: Domain Types
// EI-007
// VedMoulya learns from every execution. A `LearningEvent` records a
// single observed outcome (success/failure) about an entity (provider,
// context, capability, prompt, strategy, …) together with confidence,
// cost, latency, accuracy, retries, quality, feedback, and business
// outcome. Events aggregate into `LearningModel`s; models drive
// `LearningRecommendation`s, `LearningInsight`s, and `LearningReport`s.
//
// Learning NEVER bypasses human approval for architectural or critical
// behavioral changes: recommendations are born `pending` and only become
// actionable after explicit approval (`LearningDecision` with version
// history, rollback, and an audit trail).
// ──────────────────────────────────────────────────────────────────

// ── Learning Categories (10 per EI-007) ─────────────────────────────────────

export type LearningCategory =
  | 'provider'
  | 'context'
  | 'capability'
  | 'prompt'
  | 'budget'
  | 'quality'
  | 'execution'
  | 'business'
  | 'user_preference'
  | 'failure';

export const LEARNING_CATEGORIES: readonly LearningCategory[] = [
  'provider',
  'context',
  'capability',
  'prompt',
  'budget',
  'quality',
  'execution',
  'business',
  'user_preference',
  'failure',
] as const;

/** Human labels used by the explainer, reports, and dashboards. */
export const LEARNING_CATEGORY_LABELS: Record<LearningCategory, string> = {
  provider: 'Provider Learning',
  context: 'Context Learning',
  capability: 'Capability Learning',
  prompt: 'Prompt Learning',
  budget: 'Budget Learning',
  quality: 'Quality Learning',
  execution: 'Execution Learning',
  business: 'Business Learning',
  user_preference: 'User Preference Learning',
  failure: 'Failure Learning',
};

// ── Outcomes ────────────────────────────────────────────────────────────────

export type LearningOutcome = 'success' | 'failure';

export const LEARNING_OUTCOMES: readonly LearningOutcome[] = ['success', 'failure'] as const;

// ── The Learning Event (the atom of learning) ───────────────────────────────

/** What produced this learning signal. */
export interface LearningSourceRef {
  sourceType: 'goal' | 'task' | 'session' | 'pipeline' | 'manual';
  sourceId: string;
}

export interface LearningEvent {
  eventId: string;
  /** One of the 10 learning categories. */
  category: LearningCategory;
  /** What kind of entity was learned about (e.g. 'provider', 'context'). */
  entityType: string;
  /** The entity id (e.g. a provider id, capability id, prompt key). */
  entityId: string;
  /** Human label for the entity (for reports/dashboards). */
  entityLabel: string;
  outcome: LearningOutcome;
  /** Confidence in the observation (0–1). */
  confidence: number;
  /** Cost of the run in USD. */
  costUsd: number;
  /** End-to-end latency in milliseconds. */
  latencyMs: number;
  /** Accuracy / correctness of the result (0–1). */
  accuracy: number;
  /** Number of retries before completion. */
  retries: number;
  /** Quality score of the result (0–1). */
  quality: number;
  /** User feedback score (0–1; higher is better). */
  feedback?: number;
  /** Business outcome achieved (0–1). */
  businessOutcome?: number;
  /** What produced the signal (goal/session/pipeline/manual). */
  sourceRef?: LearningSourceRef;
  /** Free-form extra context. */
  metadata: Record<string, unknown>;
  /** When the observed run happened (ISO). */
  occurredAt: string;
  createdAt: string;
}

// ── Learning Model (aggregated statistics about one entity) ─────────────────

export interface LearningModel {
  category: LearningCategory;
  entityType: string;
  entityId: string;
  entityLabel: string;
  /** Number of observed events for this entity. */
  sampleCount: number;
  successCount: number;
  failureCount: number;
  /** Observed success rate (0–1). */
  successRate: number;
  avgCostUsd: number;
  avgLatencyMs: number;
  avgAccuracy: number;
  avgRetries: number;
  avgQuality: number;
  avgFeedback: number;
  avgBusinessOutcome: number;
  /** Statistical confidence in the model (0–1), derived from sample count. */
  confidence: number;
  /** Recent-vs-earlier success rate delta (−1..1). */
  trend: number;
  /** Most recent event timestamp (ISO). */
  lastSeen: string;
}

// ── Recommendation Types (the 7 best-* recommendations) ─────────────────────

export type RecommendationType =
  | 'best_provider'
  | 'best_context'
  | 'best_strategy'
  | 'best_capability'
  | 'best_budget'
  | 'best_prompt'
  | 'best_execution_pattern';

export const RECOMMENDATION_TYPES: readonly RecommendationType[] = [
  'best_provider',
  'best_context',
  'best_strategy',
  'best_capability',
  'best_budget',
  'best_prompt',
  'best_execution_pattern',
] as const;

export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'rolled_back';

export interface LearningRecommendation {
  recommendationId: string;
  type: RecommendationType;
  category: LearningCategory;
  title: string;
  description: string;
  targetEntity: { entityType: string; entityId: string; entityLabel: string };
  /** Composite value score (0–1). */
  value: number;
  /** Confidence in the recommendation (0–1). */
  confidence: number;
  sampleCount: number;
  status: RecommendationStatus;
  /** Bumped on every safety state change. */
  version: number;
  rationale: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Insight ─────────────────────────────────────────────────────────────────

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface LearningInsight {
  insightId: string;
  category: LearningCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  evidence: string[];
  createdAt: string;
}

// ── Report ──────────────────────────────────────────────────────────────────

export interface LearningReportEntityRow {
  entityId: string;
  entityLabel: string;
  successRate: number;
  sampleCount: number;
}

export interface LearningReport {
  reportId: string;
  category: LearningCategory;
  title: string;
  generatedAt: string;
  period: { start: string; end: string };
  totalEvents: number;
  successRate: number;
  avgCostUsd: number;
  avgLatencyMs: number;
  avgQuality: number;
  topEntities: LearningReportEntityRow[];
  atRiskEntities: LearningReportEntityRow[];
  summary: string;
}

// ── Safety: decisions + audit trail ─────────────────────────────────────────

export type DecisionAction = 'created' | 'approved' | 'rejected' | 'rolled_back';

export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'rolled_back';

export interface LearningAuditEntry {
  auditId: string;
  action: DecisionAction;
  version: number;
  actor: string;
  note?: string;
  timestamp: string;
}

/**
 * The persisted human-approval record for a recommendation. Every state
 * change bumps `version` and appends an audit entry — full version history,
 * rollback, and audit trail for the learning safety workflow.
 */
export interface LearningDecision {
  decisionId: string;
  recommendationId: string;
  recommendationType: RecommendationType;
  targetEntityId: string;
  status: DecisionStatus;
  version: number;
  actor: string;
  note?: string;
  audit: LearningAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

// ── Trend / Analytics ───────────────────────────────────────────────────────

export interface LearningTrendPoint {
  /** YYYY-MM-DD bucket. */
  date: string;
  events: number;
  successRate: number;
}

export interface LearningCategoryStats {
  events: number;
  successRate: number;
  models: number;
  failures: number;
  avgCostUsd: number;
}

// ── Dashboard aggregate ─────────────────────────────────────────────────────

export interface LearningDashboardData {
  totals: {
    events: number;
    successes: number;
    failures: number;
    pendingApprovals: number;
    approved: number;
    insights: number;
    models: number;
    reports: number;
  };
  byCategory: Record<LearningCategory, LearningCategoryStats>;
  trend: LearningTrendPoint[];
  recentEvents: LearningEvent[];
  recommendations: LearningRecommendation[];
  insights: LearningInsight[];
  reports: LearningReport[];
  models: LearningModel[];
}
