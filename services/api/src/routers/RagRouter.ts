// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Enterprise RAG Router
// Production RAG procedures (AI-RUNTIME-002): ingest, search (vector with
// keyword fallback), delete and collection stats. Every procedure is
// user-scoped: collections are tenant/user keys validated at the boundary,
// and the shared auth + IDOR + rate-limit middleware guards each call.
// ─────────────────────────────────────────────────────────────────────────────

import type { RagApplicationService } from '@vedmoulya/rag';
import type { TRPCContext } from '../router.js';
import { successResponse, type ApiResponse } from '../services/ResponseMapper.js';

export interface RagHandlers {
  ingest: (
    input: {
      userId: string;
      collection: string;
      sourceId: string;
      title: string;
      content: string;
      metadata?: Record<string, unknown>;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  search: (
    input: {
      userId: string;
      collection: string;
      query: string;
      topK?: number;
      minScore?: number;
      metadataFilter?: Record<string, unknown>;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  deleteSource: (
    input: { userId: string; collection: string; sourceId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getStats: (
    input: { userId: string; collection?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  /**
   * Production RAG health + readiness (AI-RUNTIME-002 C-01): reports whether
   * the vector store is reachable, whether a real embedding provider is
   * configured (vs the deterministic mock), and the strict-mode readiness
   * verdict. NEVER silently serves synthetic RAG in production — when the
   * production repository is in use the status must be 'healthy' for RAG to
   * be considered ready.
   */
  getHealth: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getReadiness: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createRagRouter(rag: RagApplicationService): RagHandlers {
  return {
    ingest: async (input, _ctx) =>
      successResponse(
        await rag.ingestDocument({
          userId: input.userId,
          collection: input.collection,
          sourceId: input.sourceId,
          title: input.title,
          content: input.content,
          metadata: input.metadata,
        }),
      ),
    search: async (input, _ctx) =>
      successResponse(
        await rag.search({
          userId: input.userId,
          collection: input.collection,
          query: input.query,
          topK: input.topK,
          minScore: input.minScore,
          metadataFilter: input.metadataFilter,
        }),
      ),
    deleteSource: async (input, _ctx) =>
      successResponse(
        await rag.deleteSource({
          userId: input.userId,
          collection: input.collection,
          sourceId: input.sourceId,
        }),
      ),
    getStats: async (input, _ctx) => successResponse(await rag.getStats(input.collection)),
    // Health/readiness are gateway-level reports scoped by the session — the
    // handler input is validated by the router middleware but not consumed here.
    getHealth: async (_input, _ctx) => successResponse(await buildRagHealth(rag)),
    getReadiness: async (_input, _ctx) => successResponse(await buildRagReadiness(rag)),
  };
}

interface RagHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  vectorStoreReady: boolean;
  embeddingConfigured: boolean;
  productionRepository: boolean;
  embeddingModel: string;
  detail: string;
}

/**
 * Build the RAG health report without requiring a live SQL client here: the
 * repository reachability probe is the authoritative check, and the embedding
 * model name reveals whether the deterministic mock is in use. Production
 * strictness comes from NODE_ENV (the same gate `createProductionRagRepository`
 * uses for its fail-fast migration).
 */
async function buildRagHealth(rag: RagApplicationService): Promise<RagHealthReport> {
  const env: string = process.env.NODE_ENV ?? 'development';
  const isStrict = env === 'production' || env === 'staging';
  const embeddingModel = rag.embeddingModel;
  const embeddingConfigured = !embeddingModel.includes('mock');

  let vectorStoreReady = false;
  try {
    await rag.getStats();
    vectorStoreReady = true;
  } catch {
    vectorStoreReady = false;
  }

  if (!vectorStoreReady) {
    return {
      status: isStrict ? 'unhealthy' : 'degraded',
      vectorStoreReady: false,
      embeddingConfigured,
      productionRepository: isStrict,
      embeddingModel,
      detail: isStrict
        ? 'RAG vector store is not reachable. Production RAG must fail fast — check the pgvector database and rerun the migration.'
        : 'RAG vector store is not reachable (development may use the in-memory fallback).',
    };
  }
  if (isStrict && !embeddingConfigured) {
    return {
      status: 'unhealthy',
      vectorStoreReady: true,
      embeddingConfigured: false,
      productionRepository: true,
      embeddingModel,
      detail:
        'Production RAG is configured with the deterministic mock embedding provider. Set AI_OPENAI_API_KEY (or OPENAI_API_KEY) to enable real embeddings.',
    };
  }
  return {
    status: 'healthy',
    vectorStoreReady: true,
    embeddingConfigured,
    productionRepository: isStrict,
    embeddingModel,
    detail: 'RAG vector store ready and embedding provider configured.',
  };
}

/** Readiness is a boolean verdict derived from the health report. */
async function buildRagReadiness(
  rag: RagApplicationService,
): Promise<{ ready: boolean; health: RagHealthReport }> {
  const health = await buildRagHealth(rag);
  return { ready: health.status === 'healthy', health };
}
