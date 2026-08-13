// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/context
// Enterprise Context Intelligence Engine (EI-003)
// Before ANY AI request, VedMoulya must automatically determine
// WHAT information, HOW MUCH, WHICH, and IN WHAT ORDER to send.
// This package builds the intelligence layer — no execution.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  ContextSource,
  ContextCategory,
  ContextPriority,
  ContextConfidenceLevel,
  CompressionStrategy,
  ContextItem,
  ContextScore,
  ContextRankingInput,
  ContextFilterCriteria,
  ContextFilterResult,
  CompressionInput,
  CompressionResult,
  CompressionStep,
  EnterpriseContextPackage,
  ContextMetrics,
  ContextDiscoveryResult,
  ContextPreview,
  ContextExplanation,
  ContextSearchCriteria,
} from './types/context-types.js';
export {
  CONTEXT_SOURCES,
  CONTEXT_CATEGORIES,
  CONTEXT_PRIORITIES,
  COMPRESSION_STRATEGIES,
} from './types/context-types.js';

// ── Domain ────────────────────────────────────────────────────────────────
export { createContextId, generateContextId } from './domain/value-objects/ContextId.js';
export type { ContextId } from './domain/value-objects/ContextId.js';
export type { ContextRepository } from './domain/repository/ContextRepository.js';
export { ContextRankingService } from './domain/services/ContextRankingService.js';
export { ContextFilteringService } from './domain/services/ContextFilteringService.js';
export { ContextCompressionService } from './domain/services/ContextCompressionService.js';
export { ContextAssemblyService } from './domain/services/ContextAssemblyService.js';
export type { AssemblyOptions } from './domain/services/ContextAssemblyService.js';

// ── Infrastructure ────────────────────────────────────────────────────────
export { InMemoryContextRepository } from './infrastructure/InMemoryContextRepository.js';
export { PostgresContextRepository } from './infrastructure/PostgresContextRepository.js';

// ── Application ───────────────────────────────────────────────────────────
export { ContextApplicationService } from './application/ContextApplicationService.js';
export type { ContextResult } from './application/ContextApplicationService.js';
export { ContextMapper } from './application/ContextMapper.js';
export type {
  RegisterContextDTO,
  BulkRegisterContextDTO,
  ContextQueryDTO,
  ContextItemDTO,
  ContextScoreDTO,
  ContextRankingDTO,
  ContextFilterResultDTO,
  ContextCompressionResultDTO,
  EnterpriseContextPackageDTO,
  ContextMetricsDTO,
  ContextDiscoveryDTO,
  ContextPreviewDTO,
  ContextExplanationDTO,
  ContextRegistrySummaryDTO,
} from './application/ContextDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────────────
export { createCatalogContext, SEED_CONTEXT_SIZE } from './catalog/context-catalog.js';
