// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/knowledge-intelligence
// Enterprise Knowledge Intelligence Platform (EI-009)
// The Enterprise Knowledge Layer of VedMoulya — the authoritative
// knowledge source used by every Enterprise Intelligence Engine and
// every future business module. NOT a document management system, NOT
// a vector database, NOT a RAG library.
//
// VedMoulya knows WHAT it knows, WHERE it came from, WHO uses it,
// WHETHER it is trusted, WHETHER it is current, WHAT depends on it,
// and HOW it should be used. Knowledge is versioned, validated,
// searchable, explainable, traceable, and reusable.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────
export type {
  KnowledgeCategory,
  KnowledgeSourceType,
  KnowledgeLifecycleStatus,
  KnowledgeValidationStatus,
  KnowledgeRelationshipType,
  KnowledgeLevel,
  KnowledgeMatchType,
  KnowledgeConsumerType,
  KnowledgeAuditAction,
  KnowledgeTrustScore,
  KnowledgeConfidence,
  KnowledgeCitation,
  KnowledgeVersion,
  KnowledgeRelationship,
  KnowledgeDependency,
  KnowledgeConsumer,
  KnowledgeUsage,
  KnowledgeAuditEntry,
  KnowledgeItem,
  KnowledgeSearchResult,
  KnowledgeValidationReport,
  KnowledgeExplanation,
  KnowledgeDiff,
  KnowledgeTrendPoint,
  KnowledgeAnalytics,
  KnowledgeDashboardData,
  KnowledgeTimelineEntry,
  KnowledgeGraphTraversal,
} from './types/knowledge-types.js';
export {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_SOURCE_RELIABILITY,
  KNOWLEDGE_LIFECYCLE_STATUSES,
  KNOWLEDGE_VALIDATION_STATUSES,
  KNOWLEDGE_RELATIONSHIP_TYPES,
  KNOWLEDGE_RELATIONSHIP_LABELS,
  KNOWLEDGE_MATCH_TYPES,
} from './types/knowledge-types.js';

// ── Contracts (engine ports) ──────────────────────────────────────
export type {
  KnowledgeGoalEnginePort,
  KnowledgeCapabilityEnginePort,
  KnowledgeProviderEnginePort,
  KnowledgeContextEnginePort,
  KnowledgeStrategyEnginePort,
  KnowledgeOrchestratorEnginePort,
  KnowledgeLearningEnginePort,
  KnowledgeBrainEnginePort,
  KnowledgeEngines,
} from './contracts/knowledge-engines.js';

// ── Domain ────────────────────────────────────────────────────────
export {
  createKnowledgeId,
  generateKnowledgeId,
  generateRelationshipId,
  generateVersionId,
  generateCitationId,
  generateConsumerId,
  generateDependencyId,
  generateAuditId,
} from './domain/value-objects/KnowledgeId.js';
export type { KnowledgeId, RelationshipId, VersionId } from './domain/value-objects/KnowledgeId.js';
export type {
  KnowledgeRepository,
  KnowledgeItemSearch,
} from './domain/repository/KnowledgeRepository.js';
export type { KnowledgeGraph } from './domain/graph/KnowledgeGraph.js';
export {
  categoryRule,
  sourceTypeRule,
  lifecycleStatusRule,
  validationStatusRule,
  relationshipTypeRule,
  scoreRule,
  nonNegativeRule,
  versionNumberRule,
  entityRule,
  titleRule,
  validateItem,
  validateRelationship,
  validateVersion,
  canTransitionLifecycle,
  canTransitionValidation,
  validate,
} from './domain/rules/KnowledgeRules.js';
export type { RuleResult } from './domain/rules/KnowledgeRules.js';
export { KnowledgeTrustScoreService } from './domain/services/KnowledgeTrustScoreService.js';
export type { TrustScoreOptions } from './domain/services/KnowledgeTrustScoreService.js';
export { KnowledgeRankingService } from './domain/services/KnowledgeRankingService.js';
export type { RankedKnowledgeItem } from './domain/services/KnowledgeRankingService.js';
export { KnowledgeSearchService } from './domain/services/KnowledgeSearchService.js';
export type { KnowledgeSearchQuery } from './domain/services/KnowledgeSearchService.js';
export { KnowledgeRelationshipService } from './domain/services/KnowledgeRelationshipService.js';
export type { DetectRelationshipOptions } from './domain/services/KnowledgeRelationshipService.js';
export { KnowledgeValidationService } from './domain/services/KnowledgeValidationService.js';
export { KnowledgeLifecycleService } from './domain/services/KnowledgeLifecycleService.js';
export type { LifecycleResult } from './domain/services/KnowledgeLifecycleService.js';
export { KnowledgeVersionService } from './domain/services/KnowledgeVersionService.js';
export type { VersionResult } from './domain/services/KnowledgeVersionService.js';
export { KnowledgeAnalyticsService } from './domain/services/KnowledgeAnalyticsService.js';
export { KnowledgeCitationService } from './domain/services/KnowledgeCitationService.js';
export { KnowledgeExplainerService } from './domain/services/KnowledgeExplainerService.js';
export { KnowledgeEnrichmentService } from './domain/services/KnowledgeEnrichmentService.js';
export type { EnrichmentResult } from './domain/services/KnowledgeEnrichmentService.js';

// ── Infrastructure ─────────────────────────────────────────────────
export { InMemoryKnowledgeRepository } from './infrastructure/InMemoryKnowledgeRepository.js';
export type { InMemoryKnowledgeSeed } from './infrastructure/InMemoryKnowledgeRepository.js';
export { PostgresKnowledgeRepository } from './infrastructure/PostgresKnowledgeRepository.js';
export { InMemoryKnowledgeGraph } from './infrastructure/InMemoryKnowledgeGraph.js';
export { PostgresKnowledgeGraph } from './infrastructure/PostgresKnowledgeGraph.js';

// ── Application ───────────────────────────────────────────────────
export {
  KnowledgeApplicationService,
  KNOWLEDGE_DEFAULT_CONFIDENCE,
} from './application/KnowledgeApplicationService.js';
export type { KnowledgeResult } from './application/KnowledgeApplicationService.js';
export { KnowledgeMapper } from './application/KnowledgeMapper.js';
export type {
  CreateKnowledgeItemDTO,
  UpdateKnowledgeItemDTO,
  KnowledgeListQueryDTO,
  KnowledgeSearchQueryDTO,
  RelateKnowledgeDTO,
  VersionKnowledgeDTO,
  DiffKnowledgeDTO,
  ValidateKnowledgeDTO,
  LifecycleKnowledgeDTO,
  ConsumerUsageDTO,
  GraphQueryDTO,
  ShortestPathDTO,
  KnowledgeTimelineDTO,
  KnowledgeItemDTO,
  KnowledgeRelationshipDTO,
  KnowledgeVersionDTO,
  KnowledgeSearchResultDTO,
  KnowledgeValidationReportDTO,
  KnowledgeExplanationDTO,
  KnowledgeDiffDTO,
  KnowledgeAnalyticsDTO,
  KnowledgeGraphTraversalDTO,
  KnowledgeTimelineEntryDTO,
  KnowledgeConsumerDTO,
  KnowledgeTrendPointDTO,
  KnowledgeDashboardDTO,
} from './application/KnowledgeDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────
export {
  createCatalogKnowledgeItems,
  createCatalogKnowledgeRelationships,
  createCatalogKnowledgeItemMap,
  hasAllKnowledgeCategories,
  SEED_KNOWLEDGE_SIZE,
  SEED_RELATIONSHIPS_SIZE,
} from './catalog/knowledge-catalog.js';
