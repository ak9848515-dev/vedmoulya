// ──────────────────────────────────────────────────────────────────
// VedMoulya — RAG Repository Port
// Persistence seam for vector chunks. Implementations: in-memory
// (hermetic test double) and Postgres + pgvector (production).
// Collections isolate tenants/users: every query is scoped to a
// collection key. AI-RUNTIME-002 — Production RAG.
// ──────────────────────────────────────────────────────────────────

import type { RagChunk, RagSearchResult, RagStats } from '../../types/rag-types.js';

export interface RagRepository {
  /**
   * Persist chunks with their embedding vectors. Returns the number of
   * chunks written (idempotent per (collection, chunkId)).
   */
  upsertChunks(collection: string, chunks: RagChunk[], vectors: number[][]): Promise<number>;

  /** Cosine-similarity search scoped to one collection. */
  searchSimilar(
    collection: string,
    queryVector: number[],
    options: { topK: number; minScore?: number; metadataFilter?: Record<string, unknown> },
  ): Promise<RagSearchResult[]>;

  /**
   * Deterministic keyword fallback used when the embedding pipeline fails:
   * chunks whose content contains every query term, ranked by term count.
   */
  searchKeywords(
    collection: string,
    query: string,
    options: { topK: number; metadataFilter?: Record<string, unknown> },
  ): Promise<RagSearchResult[]>;

  /** Remove all chunks for a source (idempotent). Returns deleted count. */
  deleteBySource(collection: string, sourceId: string): Promise<number>;

  /** Collection statistics (optionally scoped to one collection). */
  getStats(collection?: string): Promise<RagStats>;
}
