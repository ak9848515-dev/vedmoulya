// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Constants
// Shared constants for the Decision Intelligence Engine
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

// ── Decision Categories ────────────────────────────────────────────────────
export const DECISION_CATEGORIES = [
  'strategic',
  'tactical',
  'operational',
  'technical',
  'business',
  'career',
  'learning',
  'personal',
] as const;

// ── Decision Status Values ─────────────────────────────────────────────────
export const DECISION_STATUS_VALUES = [
  'requested',
  'analyzing',
  'evaluating',
  'decided',
  'implementing',
  'completed',
  'reviewed',
  'archived',
  'cancelled',
] as const;

// ── Decision Initiators ────────────────────────────────────────────────────
export const DECISION_INITIATORS = [
  'user',
  'system',
  'ai_orchestrator',
  'scheduled',
  'external',
] as const;

// ── Priority Levels ────────────────────────────────────────────────────────
export const PRIORITY_LEVELS = ['critical', 'high', 'medium', 'low', 'optional'] as const;

// ── Confidence Levels ──────────────────────────────────────────────────────
export const CONFIDENCE_LEVELS = ['very_high', 'high', 'medium', 'low', 'unknown'] as const;

// ── Risk Levels ────────────────────────────────────────────────────────────
export const RISK_LEVELS = ['critical', 'high', 'medium', 'low', 'negligible'] as const;

// ── Opportunity Levels ─────────────────────────────────────────────────────
export const OPPORTUNITY_LEVELS = [
  'transformational',
  'high',
  'moderate',
  'low',
  'minimal',
] as const;

// ── Reasoning Methods ──────────────────────────────────────────────────────
export const REASONING_METHODS = [
  'analytical',
  'comparative',
  'rule_based',
  'heuristic',
  'ai_assisted',
  'manual',
] as const;

// ── Outcome Results ────────────────────────────────────────────────────────
export const OUTCOME_RESULTS = ['success', 'partial', 'neutral', 'failure', 'unknown'] as const;

// ── Constraint Types ───────────────────────────────────────────────────────
export const CONSTRAINT_TYPES = [
  'must',
  'must_not',
  'should',
  'should_not',
  'limit',
  'requirement',
] as const;

// ── Constraint Categories ──────────────────────────────────────────────────
export const CONSTRAINT_CATEGORIES = [
  'time',
  'cost',
  'resource',
  'quality',
  'compliance',
  'strategic',
  'technical',
  'ethical',
] as const;

// ── Evidence Types ─────────────────────────────────────────────────────────
export const EVIDENCE_TYPES = [
  'knowledge',
  'memory',
  'data',
  'expert_opinion',
  'research',
  'experiment',
] as const;

// ── Scoring Thresholds ─────────────────────────────────────────────────────
export const SCORING_THRESHOLDS = {
  EXCEPTIONAL_MIN: 100,
  STRONG_MIN: 75,
  MODERATE_MIN: 50,
  WEAK_MIN: 25,
  POOR_MIN: 6,
} as const;

// ── Confidence Thresholds ──────────────────────────────────────────────────
export const CONFIDENCE_THRESHOLDS = {
  VERY_HIGH_MIN: 0.9,
  HIGH_MIN: 0.7,
  MEDIUM_MIN: 0.4,
  LOW_MIN: 0.01,
} as const;

// ── Scoring Dimension Weights (default) ────────────────────────────────────
export const DEFAULT_SCORING_WEIGHTS = {
  priority: 3,
  impact: 3,
  effort: 2,
  confidence: 2,
  urgency: 2,
  readiness: 1,
} as const;

// ── Explanation Formats ────────────────────────────────────────────────────
export const EXPLANATION_FORMATS = ['short', 'standard', 'detailed', 'raw'] as const;

// ── Domain Event Types (from DecisionEvent.ts) ─────────────────────────────
export const DECISION_EVENT_TYPES = [
  'decision.created',
  'decision.status_changed',
  'decision.made',
  'decision.completed',
  'decision.archived',
  'decision.cancelled',
  'decision.reevaluated',
  'decision.option_added',
  'decision.option_scored',
  'decision.knowledge_linked',
  'decision.memory_linked',
  'decision.confidence_updated',
  'decision.evidence_added',
  'decision.reviewed',
] as const;

// ── Pagination Defaults ────────────────────────────────────────────────────
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// ── ID Prefixes ────────────────────────────────────────────────────────────
export const ID_PREFIX = {
  DECISION: 'dec_',
  OPTION: 'opt_',
  EVIDENCE: 'ev_',
} as const;

// ── Cache Key Prefixes ────────────────────────────────────────────────────
export const CACHE_PREFIX = {
  DECISION: 'decision:',
  OPTIONS: 'options:',
  RANKINGS: 'rankings:',
  STATS: 'stats:',
} as const;

// ── Internal API Paths ─────────────────────────────────────────────────────
export const API_PATHS = {
  BASE: '/api/v1/decision',
  DECISIONS: '/decisions',
  HEALTH: '/health',
} as const;

// ── External Service API Paths ─────────────────────────────────────────────
export const EXTERNAL_API_PATHS = {
  KNOWLEDGE: {
    CONTEXT: '/api/v1/knowledge/context',
    SEARCH: '/api/v1/knowledge/search',
  },
  MEMORY: {
    QUERY: '/api/v1/memory/query',
    CONTEXT: '/api/v1/memory/context',
  },
  ORCHESTRATOR: {
    CAPABILITY: '/api/v1/orchestrator/capability',
  },
} as const;
