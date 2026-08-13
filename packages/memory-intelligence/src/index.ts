// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/memory-intelligence
// Enterprise Memory Intelligence Platform (EI-010)
// The Enterprise Memory Layer of VedMoulya — it records, retrieves,
// ranks, compresses, consolidates and evolves experience across the
// entire operating system. NOT chat memory, NOT a vector database,
// NOT conversation memory.
//
//   Knowledge represents authoritative facts (EI-009).
//   Memory represents evolving experience (EI-010).
//
// The two systems remain architecturally separate but tightly
// integrated: memories carry citations back to knowledge items and
// knowledge usage is recorded as memory events.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────
export type {
  MemoryType,
  MemorySourceType,
  MemoryLifecycleStatus,
  MemoryCompressionState,
  MemoryRetentionPolicy,
  MemoryRelationshipType,
  MemoryLevel,
  MemoryImportance,
  MemoryConfidence,
  MemoryCitation,
  MemoryRelationship,
  MemoryConsumer,
  MemoryConsumerType,
  MemoryUsage,
  MemoryAuditAction,
  MemoryAuditEntry,
  MemoryItem,
  MemoryMatchType,
  MemorySearchResult,
  MemoryValidationReport,
  MemorySummaryResult,
  MemoryExplanation,
  MemoryTrendPoint,
  MemoryAnalytics,
  MemoryDashboardData,
  MemoryTimelineEntry,
  MemoryGraphTraversal,
} from './types/memory-types.js';
export {
  MEMORY_TYPES,
  MEMORY_TYPE_LABELS,
  MEMORY_SOURCE_TYPES,
  MEMORY_SOURCE_RELIABILITY,
  MEMORY_LIFECYCLE_STATUSES,
  MEMORY_COMPRESSION_STATES,
  MEMORY_RETENTION_POLICIES,
  MEMORY_RETENTION_DAYS,
  MEMORY_TYPE_DEFAULT_RETENTION,
  MEMORY_RELATIONSHIP_TYPES,
  MEMORY_RELATIONSHIP_LABELS,
  MEMORY_MATCH_TYPES,
} from './types/memory-types.js';

// ── Contracts (engine ports) ──────────────────────────────────────
export type {
  MemoryGoalEnginePort,
  MemoryCapabilityEnginePort,
  MemoryProviderEnginePort,
  MemoryContextEnginePort,
  MemoryStrategyEnginePort,
  MemoryOrchestratorEnginePort,
  MemoryLearningEnginePort,
  MemoryBrainEnginePort,
  MemoryKnowledgeEnginePort,
  MemoryEngines,
} from './contracts/memory-engines.js';

// ── Domain ────────────────────────────────────────────────────────
export {
  createMemoryId,
  generateMemoryId,
  generateMemoryRelationshipId,
  generateMemoryCitationId,
  generateMemoryConsumerId,
  generateMemoryAuditId,
} from './domain/value-objects/MemoryId.js';
export type { MemoryId, MemoryRelationshipId } from './domain/value-objects/MemoryId.js';
export type { MemoryRepository, MemoryItemSearch } from './domain/repository/MemoryRepository.js';
export type { MemoryGraph } from './domain/graph/MemoryGraph.js';
export {
  memoryTypeRule,
  sourceTypeRule,
  lifecycleStatusRule,
  compressionStateRule,
  retentionPolicyRule,
  relationshipTypeRule,
  scoreRule,
  nonNegativeRule,
  entityRule,
  titleRule,
  validateItem,
  validateRelationship,
  canTransitionLifecycle,
  validate,
} from './domain/rules/MemoryRules.js';
export type { RuleResult } from './domain/rules/MemoryRules.js';
export { MemoryCaptureService } from './domain/services/MemoryCaptureService.js';
export type { CaptureResult } from './domain/services/MemoryCaptureService.js';
export {
  MemoryImportanceService,
  MEMORY_TYPE_SALIENCE,
} from './domain/services/MemoryImportanceService.js';
export type { ImportanceOptions } from './domain/services/MemoryImportanceService.js';
export {
  MemoryRankingService,
  DEFAULT_MEMORY_RANKING_WEIGHTS,
} from './domain/services/MemoryRankingService.js';
export type { MemoryRankingWeights, RankedMemory } from './domain/services/MemoryRankingService.js';
export { MemoryRetrievalService } from './domain/services/MemoryRetrievalService.js';
export type { MemoryRetrievalQuery } from './domain/services/MemoryRetrievalService.js';
export {
  MemoryCompressionService,
  COMPRESSION_STAGE,
} from './domain/services/MemoryCompressionService.js';
export type { CompressionOptions } from './domain/services/MemoryCompressionService.js';
export { MemoryConsolidationService } from './domain/services/MemoryConsolidationService.js';
export type {
  ConsolidationCandidate,
  ConsolidationResult,
} from './domain/services/MemoryConsolidationService.js';
export { MemoryExpirationService } from './domain/services/MemoryExpirationService.js';
export type {
  ExpirationOptions,
  ExpirationResult,
} from './domain/services/MemoryExpirationService.js';
export { MemoryLifecycleService } from './domain/services/MemoryLifecycleService.js';
export type { LifecycleResult } from './domain/services/MemoryLifecycleService.js';
export { MemoryAnalyticsService } from './domain/services/MemoryAnalyticsService.js';
export { MemoryCitationService } from './domain/services/MemoryCitationService.js';
export type { CitationInput } from './domain/services/MemoryCitationService.js';
export { MemoryRelationshipService } from './domain/services/MemoryRelationshipService.js';
export type { DetectRelationshipOptions } from './domain/services/MemoryRelationshipService.js';

// ── Infrastructure ─────────────────────────────────────────────────
export { InMemoryMemoryRepository } from './infrastructure/InMemoryMemoryRepository.js';
export type { InMemoryMemorySeed } from './infrastructure/InMemoryMemoryRepository.js';
export { PostgresMemoryRepository } from './infrastructure/PostgresMemoryRepository.js';
export { InMemoryMemoryGraph } from './infrastructure/InMemoryMemoryGraph.js';
export { PostgresMemoryGraph } from './infrastructure/PostgresMemoryGraph.js';

// ── Application ───────────────────────────────────────────────────
export {
  MemoryApplicationService,
  MEMORY_DEFAULT_CONFIDENCE,
} from './application/MemoryApplicationService.js';
export type { MemoryResult } from './application/MemoryApplicationService.js';
export { MemoryMapper } from './application/MemoryMapper.js';
export type {
  MemoryCaptureInput,
  UpdateMemoryDTO,
  MemoryListQueryDTO,
  MemoryRetrievalDTO,
  SummarizeMemoryDTO,
  ValidateMemoryDTO,
  LifecycleMemoryDTO,
  RelateMemoryDTO,
  ConsumerUsageDTO,
  ConsolidateMemoryDTO,
  ExpireMemoryDTO,
  GraphQueryDTO,
  ShortestPathDTO,
  MemoryTimelineDTO,
  MemoryItemDTO,
  MemoryRelationshipDTO,
  MemorySearchResultDTO,
  MemoryValidationReportDTO,
  MemorySummaryResultDTO,
  MemoryAnalyticsDTO,
  MemoryGraphTraversalDTO,
  MemoryTimelineEntryDTO,
  MemoryConsumerDTO,
  MemoryTrendPointDTO,
  MemoryDashboardDTO,
} from './application/MemoryDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────
export {
  createCatalogMemoryItems,
  createCatalogMemoryRelationships,
  createCatalogMemoryItemMap,
  hasAllMemoryTypes,
  SEED_MEMORY_SIZE,
  SEED_MEMORY_RELATIONSHIPS_SIZE,
} from './catalog/memory-catalog.js';
