// ──────────────────────────────────────────────────────────────────
// VedMoulya — RAG Health & Readiness Checks
// AI-RUNTIME-002 C-01 — Production RAG / pgvector.
//
// Provides a health check (is the vector store reachable + schema
// present?) and a readiness check (can the RAG pipeline serve
// requests?) that fail fast in production instead of silently
// degrading to an unsafe in-memory fallback.
// ──────────────────────────────────────────────────────────────────

import type { Sql } from 'postgres';
import type { RagRepository } from '../domain/repository/RagRepository.js';

export interface RagHealthStatus {
  /** Overall health: 'healthy' | 'degraded' | 'unhealthy'. */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** True when the vector store is reachable and the schema exists. */
  vectorStoreReady: boolean;
  /** True when the embedding provider is configured (not the mock). */
  embeddingConfigured: boolean;
  /** True when the repository is the production Postgres implementation. */
  productionRepository: boolean;
  /** Human-readable detail for operators. */
  detail: string;
  /** Optional error message when unhealthy. */
  error?: string;
}

export interface RagReadinessOptions {
  /** The RAG repository to probe. */
  repository: RagRepository;
  /** True when a real embedding provider is configured (not the mock). */
  embeddingConfigured: boolean;
  /** True when the repository is the production Postgres implementation. */
  productionRepository: boolean;
  /** Optional SQL client for a live schema probe. */
  sql?: Sql;
  /** The expected vector dimension (default 1536). */
  dimension?: number;
}

/**
 * Probe the RAG vector store: verify the `rag_chunks` table exists and
 * the `vector` extension is available. Returns true when the schema is
 * ready. Never throws — failures are reported through the status.
 */
export async function probeRagSchema(sql: Sql, _dimension: number): Promise<boolean> {
  try {
    const rows = (await sql.unsafe(
      `SELECT 1 AS ok
       FROM information_schema.tables
       WHERE table_name = 'rag_chunks'`,
    )) as Array<Record<string, unknown>>;
    if (rows.length === 0) return false;

    // Verify the embedding column is a pgvector `vector` type.
    // information_schema returns 'USER-DEFINED' for pgvector columns
    // (typcategory='U'), so we query pg_type directly which is
    // authoritative across all PostgreSQL + pgvector versions.
    const vecType = (await sql.unsafe(
      `SELECT 1 AS ok
       FROM pg_type t
       JOIN pg_attribute a ON a.atttypid = t.oid
       JOIN pg_class c ON c.oid = a.attrelid
       WHERE c.relname = 'rag_chunks'
         AND a.attname = 'embedding'
         AND t.typname = 'vector'`,
    )) as Array<Record<string, unknown>>;
    if (vecType.length === 0) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Compute the RAG health status. In production, a missing vector store
 * or a mock embedding provider is reported as `unhealthy` (fail-fast) —
 * the runtime must never silently serve synthetic RAG in production.
 */
export async function checkRagHealth(options: RagReadinessOptions): Promise<RagHealthStatus> {
  const { repository, embeddingConfigured, productionRepository, sql, dimension } = options;

  // Probe the repository with a lightweight stats call (no data needed).
  let repositoryReachable = false;
  try {
    await repository.getStats();
    repositoryReachable = true;
  } catch {
    repositoryReachable = false;
  }

  let schemaReady = true;
  if (sql) {
    schemaReady = await probeRagSchema(sql, dimension ?? 1536);
  }

  const vectorStoreReady = repositoryReachable && schemaReady;

  if (!vectorStoreReady) {
    return {
      status: productionRepository ? 'unhealthy' : 'degraded',
      vectorStoreReady: false,
      embeddingConfigured,
      productionRepository,
      detail: productionRepository
        ? 'RAG vector store is not ready (repository unreachable or schema missing). Production RAG must fail fast.'
        : 'RAG vector store is not ready (in-memory fallback in use).',
      error: 'vector_store_unavailable',
    };
  }

  if (productionRepository && !embeddingConfigured) {
    return {
      status: 'unhealthy',
      vectorStoreReady: true,
      embeddingConfigured: false,
      productionRepository,
      detail:
        'Production RAG is configured with the deterministic mock embedding provider. ' +
        'Set AI_OPENAI_API_KEY (or OPENAI_API_KEY) to enable real embeddings.',
      error: 'embedding_provider_missing',
    };
  }

  return {
    status: 'healthy',
    vectorStoreReady: true,
    embeddingConfigured,
    productionRepository,
    detail: 'RAG vector store ready and embedding provider configured.',
  };
}

/**
 * Readiness check: can the RAG pipeline serve requests right now?
 * Returns true only when the vector store is ready AND (in production)
 * a real embedding provider is configured.
 */
export async function isRagReady(options: RagReadinessOptions): Promise<boolean> {
  const health = await checkRagHealth(options);
  return health.status === 'healthy';
}
