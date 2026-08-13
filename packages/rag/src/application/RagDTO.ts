// ──────────────────────────────────────────────────────────────────
// VedMoulya — RAG DTOs
// Boundary DTOs for the rag.* gateway namespace (auth + IDOR + zod
// validated; internal domain objects never cross the boundary).
// AI-RUNTIME-002.
// ──────────────────────────────────────────────────────────────────

import type { RagSearchResult, RagStats } from '../types/rag-types.js';

export interface RagIngestRequestDTO {
  userId: string;
  /** Tenant/user-scoped collection key (e.g. `org:<orgId>` or `user:<userId>`). */
  collection: string;
  sourceId: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RagIngestResultDTO {
  sourceId: string;
  chunkCount: number;
  totalTokens: number;
  embeddingModel: string;
}

export interface RagSearchRequestDTO {
  userId: string;
  collection: string;
  query: string;
  topK?: number;
  minScore?: number;
  metadataFilter?: Record<string, unknown>;
}

export interface RagSearchResultDTO {
  query: string;
  collection: string;
  strategy: 'vector' | 'keyword_fallback';
  results: RagSearchResult[];
  total: number;
  latencyMs: number;
  embeddingModel: string;
}

export interface RagStatsDTO {
  stats: RagStats;
}

export interface RagDeleteResultDTO {
  sourceId: string;
  deleted: number;
}
