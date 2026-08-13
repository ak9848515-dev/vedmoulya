// ──────────────────────────────────────────────────────────────────
// VedMoulya — RAG Core Types
// AI-RUNTIME-002 — Production RAG (pgvector + chunking + embeddings)
// ──────────────────────────────────────────────────────────────────

/** A source document submitted for ingestion. */
export interface RagDocument {
  /** Stable source identifier (e.g. knowledge item id, file id). */
  sourceId: string;
  title: string;
  content: string;
  /** Free-form metadata preserved with every chunk (tags, category, url, …). */
  metadata?: Record<string, unknown>;
}

/** A single persisted, vectorised chunk of a source document. */
export interface RagChunk {
  chunkId: string;
  sourceId: string;
  title: string;
  content: string;
  /** Position within the source document (0-based). */
  index: number;
  /** Deterministic character length of the chunk content. */
  size: number;
  estimatedTokens: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Search query over an isolated collection. */
export interface RagSearchQuery {
  collection: string;
  query: string;
  topK?: number;
  /** Minimum cosine similarity (0..1) — results below this are dropped. */
  minScore?: number;
  /** Metadata equality filter, e.g. { category: 'client' }. */
  metadataFilter?: Record<string, unknown>;
}

/** One ranked retrieval hit. */
export interface RagSearchResult {
  chunkId: string;
  sourceId: string;
  title: string;
  content: string;
  index: number;
  /** Cosine similarity 0..1 (1 = identical direction). */
  score: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Collection statistics for the diagnostics view. */
export interface RagStats {
  collection?: string;
  chunkCount: number;
  sourceCount: number;
  totalChars: number;
  totalTokens: number;
}

/** Result of an ingestion run. */
export interface RagIngestResult {
  sourceId: string;
  chunkCount: number;
  totalTokens: number;
}
