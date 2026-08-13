// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/learning-intelligence
// Enterprise Learning Intelligence Platform (EI-007)
// VedMoulya learns from every execution — goals, tasks, capabilities,
// providers, contexts, execution strategies, execution sessions,
// quality scores, user feedback, and business outcomes — and improves
// the platform over time WITHOUT bypassing human approval for
// architectural or critical behavioral changes.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────
export type {
  LearningCategory,
  LearningOutcome,
  LearningSourceRef,
  LearningEvent,
  LearningModel,
  RecommendationType,
  RecommendationStatus,
  LearningRecommendation,
  InsightSeverity,
  LearningInsight,
  LearningReport,
  LearningReportEntityRow,
  DecisionAction,
  DecisionStatus,
  LearningAuditEntry,
  LearningDecision,
  LearningTrendPoint,
  LearningCategoryStats,
  LearningDashboardData,
} from './types/learning-types.js';
export {
  LEARNING_CATEGORIES,
  LEARNING_CATEGORY_LABELS,
  LEARNING_OUTCOMES,
  RECOMMENDATION_TYPES,
} from './types/learning-types.js';

// ── Contracts (engine ports) ──────────────────────────────────────
export type {
  LearningGoalEnginePort,
  LearningCapabilityEnginePort,
  LearningProviderEnginePort,
  LearningContextEnginePort,
  LearningStrategyEnginePort,
  LearningOrchestratorEnginePort,
  LearningEngines,
} from './contracts/learning-engines.js';

// ── Domain ────────────────────────────────────────────────────────
export {
  createLearningEventId,
  generateLearningEventId,
} from './domain/value-objects/LearningEventId.js';
export type { LearningEventId } from './domain/value-objects/LearningEventId.js';
export {
  createRecommendationId,
  createDecisionId,
} from './domain/value-objects/RecommendationId.js';
export type { RecommendationId, DecisionId } from './domain/value-objects/RecommendationId.js';
export type {
  LearningRepository,
  LearningEventSearch,
} from './domain/repository/LearningRepository.js';
export {
  categoryRule,
  outcomeRule,
  entityRule,
  boundedScoreRule,
  nonNegativeRule,
  validateLearningEvent,
  recommendationEligibilityRule,
  validate,
} from './domain/rules/LearningRules.js';
export type { RuleResult, LearningSafetyThresholds } from './domain/rules/LearningRules.js';
export { DEFAULT_SAFETY_THRESHOLDS } from './domain/rules/LearningRules.js';
export { LearningAggregationService } from './domain/services/LearningAggregationService.js';
export type { AggregationOptions } from './domain/services/LearningAggregationService.js';
export { LearningRecommendationService } from './domain/services/LearningRecommendationService.js';
export type { RecommendationOptions } from './domain/services/LearningRecommendationService.js';
export { LearningInsightService } from './domain/services/LearningInsightService.js';
export type { InsightOptions } from './domain/services/LearningInsightService.js';
export { LearningReportService } from './domain/services/LearningReportService.js';
export { LearningSafetyService } from './domain/services/LearningSafetyService.js';

// ── Infrastructure ─────────────────────────────────────────────────
export { InMemoryLearningRepository } from './infrastructure/InMemoryLearningRepository.js';
export { PostgresLearningRepository } from './infrastructure/PostgresLearningRepository.js';

// ── Application ───────────────────────────────────────────────────
export { LearningIntelligenceApplicationService } from './application/LearningIntelligenceApplicationService.js';
export type {
  LearningResult,
  LearningApplicationOptions,
} from './application/LearningIntelligenceApplicationService.js';
export { LearningMapper } from './application/LearningMapper.js';
export type {
  RecordLearningEventDTO,
  LearningEventQueryDTO,
  LearningTimelineDTO,
  LearningModelQueryDTO,
  LearningCategoryQueryDTO,
  LearningApprovalDTO,
  LearningEventDTO,
  LearningModelDTO,
  LearningRecommendationDTO,
  LearningDecisionDTO,
  LearningInsightDTO,
  LearningReportDTO,
  LearningTrendPointDTO,
  LearningAnalyticsDTO,
  LearningDashboardDTO,
} from './application/LearningDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────
export { createCatalogLearningEvents, SEED_LEARNING_SIZE } from './catalog/learning-catalog.js';
