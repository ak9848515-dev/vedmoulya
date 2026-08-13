// ──────────────────────────────────────────────────────────────────
// VedMoulya — RAG Application Service
// Ingest (chunk → embed → persist), retrieval (embed query → vector
// search with deterministic keyword fallback when the embedding
// pipeline fails), delete, and collection stats. The embedding provider
// is injected so the service stays provider-independent; collections
// enforce tenant/user isolation at the repository boundary.
// AI-RUNTIME-002 — Production RAG.
// ──────────────────────────────────────────────────────────────────

import { generateId, ValidationError, NOOP_TELEMETRY } from '@vedmoulya/core';
import type { TelemetryPort } from '@vedmoulya/core';
import { ChunkingService } from '../domain/services/ChunkingService.js';
import type { EmbeddingProvider } from '../domain/services/EmbeddingProvider.js';
import type { RagRepository } from '../domain/repository/RagRepository.js';
import type {
  RagChunk,
  RagDocument,
  RagSearchQuery,
  RagSearchResult,
  RagStats,
} from '../types/rag-types.js';
import type {
  RagDeleteResultDTO,
  RagIngestRequestDTO,
  RagIngestResultDTO,
  RagSearchRequestDTO,
  RagSearchResultDTO,
} from './RagDTO.js';

export interface RagApplicationServiceOptions {
  repository: RagRepository;
  embeddingProvider: EmbeddingProvider;
  /**
   * EPIC-012 — optional telemetry port. When provided, ingest and search
   * operations emit spans (rag.ingest / rag.search) carrying retrieval
   * strategy, candidate counts and latency. Defaults to a NOOP.
   */
  telemetry?: TelemetryPort;
}

/**
 * Default relevance floor applied when a caller does not supply `minScore`
 * (AI-RUNTIME-002 C-02/C-09; validated AI-RUNTIME-003 Phase 2).
 * Retrieval without a relevance threshold returns every chunk up to topK,
 * flooding the model context with unrelated content.
 *
 * 0.2 is the calibrated global default — see scripts/rag-calibrate.ts.
 * The 2026-08-08 sweep showed that a higher floor (0.3) maximizes precision
 * on the extended precision-focused dataset (0.875 vs 0.611 at 0.2, +43%)
 * with recall 1.0, but it is corpus/embedding-dependent: with the
 * deterministic mock, legitimate evidence in the smoke corpus scores below
 * 0.3 and would be filtered, forcing false abstentions. A single global
 * threshold is a recall-vs-precision tradeoff; 0.2 preserves recall and
 * evidence-sufficiency across every existing corpus while still filtering
 * clear noise (unrelated mock scores are < 0.2). Callers that need stricter
 * precision can override with a per-query `minScore` (e.g. 0.3); callers
 * that need the raw topK can use `minScore: 0`.
 */
export const DEFAULT_MIN_SCORE = 0.2;

export class RagApplicationService {
  private readonly repository: RagRepository;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly chunker: ChunkingService;
  private readonly telemetry: TelemetryPort;

  constructor(options: RagApplicationServiceOptions) {
    this.repository = options.repository;
    this.embeddingProvider = options.embeddingProvider;
    this.chunker = new ChunkingService();
    this.telemetry = options.telemetry ?? NOOP_TELEMETRY;
  }

  get embeddingModel(): string {
    return this.embeddingProvider.model;
  }

  /** Ingest a document: chunk → embed → persist (idempotent per source). */
  async ingestDocument(input: RagIngestRequestDTO): Promise<RagIngestResultDTO> {
    if (!input.collection || !input.collection.trim()) {
      throw new ValidationError('collection is required');
    }
    if (!input.sourceId || !input.content.trim()) {
      throw new ValidationError('sourceId and content are required');
    }
    return this.telemetry.withSpan(
      {
        name: 'rag.ingest',
        kind: 'rag',
        userId: input.userId,
        attributes: {
          collection: input.collection,
          source_id: input.sourceId,
          content_chars: input.content.length,
        },
      },
      async (span) => {
        const result = await this.ingestInternal(input);
        span.setAttribute('chunks', result.chunkCount);
        span.setAttribute('tokens', result.totalTokens);
        span.setAttribute('embedding_model', result.embeddingModel);
        return result;
      },
    );
  }

  private async ingestInternal(input: RagIngestRequestDTO): Promise<RagIngestResultDTO> {
    const document: RagDocument = {
      sourceId: input.sourceId,
      title: input.title,
      content: input.content,
      metadata: input.metadata ?? {},
    };

    const chunkTexts = this.chunker.chunk(document.content);
    if (chunkTexts.length === 0) {
      throw new ValidationError('document contains no chunkable content');
    }

    const now = new Date().toISOString();
    const chunks: RagChunk[] = chunkTexts.map((text, index) => ({
      chunkId: generateId(),
      sourceId: document.sourceId,
      title: document.title,
      content: text,
      index,
      size: text.length,
      estimatedTokens: this.chunker.estimateTokens(text),
      metadata: { ...document.metadata, title: document.title },
      createdAt: now,
      updatedAt: now,
    }));

    const vectors = await this.embeddingProvider.embed(chunkTexts);
    const written = await this.repository.upsertChunks(
      input.collection,
      chunks,
      vectors.map((v) => [...v]),
    );

    return {
      sourceId: document.sourceId,
      chunkCount: written,
      totalTokens: chunks.reduce((sum, c) => sum + c.estimatedTokens, 0),
      embeddingModel: this.embeddingProvider.model,
    };
  }

  /**
   * Retrieval for the AI runtime: embed the query, run vector similarity,
   * and fall back to deterministic keyword search when the embedding
   * pipeline fails (e.g. provider outage) so the request can still complete.
   */
  async search(input: RagSearchRequestDTO): Promise<RagSearchResultDTO> {
    if (!input.collection || !input.collection.trim() || !input.query.trim()) {
      throw new ValidationError('collection and query are required');
    }
    return this.telemetry.withSpan(
      {
        name: 'rag.search',
        kind: 'rag',
        userId: input.userId,
        attributes: {
          collection: input.collection,
          query: input.query.slice(0, 120),
        },
      },
      async (span) => {
        const result = await this.searchInternal(input);
        span.setAttribute('strategy', result.strategy);
        span.setAttribute('candidates', result.total);
        span.setAttribute('latency_ms', result.latencyMs);
        span.setAttribute('embedding_model', result.embeddingModel);
        span.end(result.total === 0 ? 'ABSTAINED' : 'OK');
        return result;
      },
    );
  }

  private async searchInternal(input: RagSearchRequestDTO): Promise<RagSearchResultDTO> {
    const startedAt = Date.now();
    const query: RagSearchQuery = {
      collection: input.collection,
      query: input.query,
      topK: Math.min(input.topK ?? 5, 20),
      // Relevance floor: exclude clearly-irrelevant chunks from retrieval so
      // they never reach the evidence evaluator or the model context.
      minScore: input.minScore ?? DEFAULT_MIN_SCORE,
      metadataFilter: input.metadataFilter,
    };

    try {
      const queryVectors = await this.embeddingProvider.embed([input.query]);
      const queryVector = queryVectors[0] ?? [];
      const results = await this.repository.searchSimilar(input.collection, queryVector, {
        topK: query.topK ?? 5,
        minScore: query.minScore,
        metadataFilter: query.metadataFilter,
      });
      return this.toSearchResultDTO(input, query, 'vector', results, startedAt);
    } catch {
      // Controlled fallback: keyword search over the same collection, never
      // an unhandled crash. The DTO marks the strategy so telemetry can
      // surface embedding-pipeline health.
      const results = await this.repository.searchKeywords(input.collection, input.query, {
        topK: query.topK ?? 5,
        metadataFilter: query.metadataFilter,
      });
      return this.toSearchResultDTO(input, query, 'keyword_fallback', results, startedAt);
    }
  }

  /** Delete one source's chunks (idempotent). */
  async deleteSource(input: {
    userId: string;
    collection: string;
    sourceId: string;
  }): Promise<RagDeleteResultDTO> {
    const deleted = await this.repository.deleteBySource(input.collection, input.sourceId);
    return { sourceId: input.sourceId, deleted };
  }

  /** Collection statistics for the diagnostics view. */
  async getStats(collection?: string): Promise<{ stats: RagStats }> {
    return { stats: await this.repository.getStats(collection) };
  }

  private toSearchResultDTO(
    input: RagSearchRequestDTO,
    query: RagSearchQuery,
    strategy: 'vector' | 'keyword_fallback',
    results: RagSearchResult[],
    startedAt: number,
  ): RagSearchResultDTO {
    return {
      query: query.query,
      collection: input.collection,
      strategy,
      results,
      total: results.length,
      latencyMs: Date.now() - startedAt,
      embeddingModel: strategy === 'vector' ? this.embeddingProvider.model : 'keyword_fallback',
    };
  }
}
