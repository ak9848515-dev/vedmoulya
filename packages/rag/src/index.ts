// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/rag
// Production RAG: chunking, embeddings (provider-independent port),
// pgvector persistence, retrieval with controlled fallback.
// AI-RUNTIME-002 — Production RAG.
// ──────────────────────────────────────────────────────────────────

// Types
export type {
  RagDocument,
  RagChunk,
  RagSearchQuery,
  RagSearchResult,
  RagStats,
  RagIngestResult,
} from './types/rag-types.js';

// Domain
export { ChunkingService } from './domain/services/ChunkingService.js';
export type { ChunkingOptions } from './domain/services/ChunkingService.js';
export { MockEmbeddingProvider } from './domain/services/EmbeddingProvider.js';
export type { EmbeddingProvider } from './domain/services/EmbeddingProvider.js';
export type { RagRepository } from './domain/repository/RagRepository.js';

// Infrastructure
export { InMemoryRagRepository } from './infrastructure/InMemoryRagRepository.js';
export { PostgresRagRepository, ensureRagSchema } from './infrastructure/PostgresRagRepository.js';
export {
  RAG_MIGRATIONS,
  RAG_MIGRATION_001,
  runRagMigrations,
  rollbackRagMigrations,
  ensureRagReady,
} from './infrastructure/migrations.js';
export type { RagMigration } from './infrastructure/migrations.js';
export { checkRagHealth, isRagReady, probeRagSchema } from './infrastructure/health.js';
export type { RagHealthStatus, RagReadinessOptions } from './infrastructure/health.js';

// Application
export { RagApplicationService, DEFAULT_MIN_SCORE } from './application/RagApplicationService.js';
export type { RagApplicationServiceOptions } from './application/RagApplicationService.js';
export type {
  RagIngestRequestDTO,
  RagIngestResultDTO,
  RagSearchRequestDTO,
  RagSearchResultDTO,
  RagStatsDTO,
  RagDeleteResultDTO,
} from './application/RagDTO.js';

// Catalog
export { RAG_SEED_DOCUMENTS } from './catalog/rag-seed.js';
export type { RagSeedEntry } from './catalog/rag-seed.js';
