/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map/array-backed bodies (no I/O); async markers required for conformance. */
/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below uses closed-union keys from the domain types
   (metadata keys from the RAG DTO) — never attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory RAG Repository
// Hermetic test double + development fallback. Mirrors the Postgres
// semantics (collection isolation, cosine similarity, keyword fallback,
// stats) without a database. AI-RUNTIME-002.
// ──────────────────────────────────────────────────────────────────

import type { RagChunk, RagSearchResult, RagStats } from '../types/rag-types.js';
import type { RagRepository } from '../domain/repository/RagRepository.js';

interface StoredChunk {
  collection: string;
  chunk: RagChunk;
  vector: number[];
}

export class InMemoryRagRepository implements RagRepository {
  private readonly store: StoredChunk[] = [];

  async upsertChunks(collection: string, chunks: RagChunk[], vectors: number[][]): Promise<number> {
    let written = 0;
    chunks.forEach((chunk, index) => {
      const existing = this.store.find(
        (s) => s.collection === collection && s.chunk.chunkId === chunk.chunkId,
      );
      const vector = vectors[index] ?? [];
      if (existing) {
        existing.chunk = chunk;
        existing.vector = vector;
      } else {
        this.store.push({ collection, chunk, vector });
      }
      written += 1;
    });
    return written;
  }

  async searchSimilar(
    collection: string,
    queryVector: number[],
    options: { topK: number; minScore?: number; metadataFilter?: Record<string, unknown> },
  ): Promise<RagSearchResult[]> {
    const scored = this.store
      .filter((s) => s.collection === collection)
      .filter((s) => this.matchesFilter(s.chunk.metadata, options.metadataFilter))
      .map((s) => ({
        chunk: s.chunk,
        score: this.cosineSimilarity(queryVector, s.vector),
      }))
      .filter((s) => (options.minScore === undefined ? true : s.score >= options.minScore))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.topK);

    return scored.map((s) => this.toResult(s.chunk, s.score));
  }

  async searchKeywords(
    collection: string,
    query: string,
    options: { topK: number; metadataFilter?: Record<string, unknown> },
  ): Promise<RagSearchResult[]> {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const scored = this.store
      .filter((s) => s.collection === collection)
      .filter((s) => this.matchesFilter(s.chunk.metadata, options.metadataFilter))
      .map((s) => {
        const content = s.chunk.content.toLowerCase();
        const matches = terms.filter((t) => content.includes(t)).length;
        return { chunk: s.chunk, score: terms.length === 0 ? 0 : matches / terms.length };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.topK);

    return scored.map((s) => this.toResult(s.chunk, s.score));
  }

  async deleteBySource(collection: string, sourceId: string): Promise<number> {
    const before = this.store.length;
    for (let i = this.store.length - 1; i >= 0; i--) {
      const s = this.store[i];
      if (s && s.collection === collection && s.chunk.sourceId === sourceId) {
        this.store.splice(i, 1);
      }
    }
    return before - this.store.length;
  }

  async getStats(collection?: string): Promise<RagStats> {
    const rows = collection ? this.store.filter((s) => s.collection === collection) : this.store;
    const sourceIds = new Set(rows.map((r) => r.chunk.sourceId));
    return {
      collection,
      chunkCount: rows.length,
      sourceCount: sourceIds.size,
      totalChars: rows.reduce((sum, r) => sum + r.chunk.size, 0),
      totalTokens: rows.reduce((sum, r) => sum + r.chunk.estimatedTokens, 0),
    };
  }

  private matchesFilter(
    metadata: Record<string, unknown>,
    filter?: Record<string, unknown>,
  ): boolean {
    if (!filter) return true;
    return Object.entries(filter).every(([key, value]) => metadata[key] === value);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
      const ai = a[i] ?? 0;
      const bi = b[i] ?? 0;
      dot += ai * bi;
      magA += ai * ai;
      magB += bi * bi;
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  private toResult(chunk: RagChunk, score: number): RagSearchResult {
    return {
      chunkId: chunk.chunkId,
      sourceId: chunk.sourceId,
      title: chunk.title,
      content: chunk.content,
      index: chunk.index,
      score: Math.max(0, Math.min(1, score)),
      metadata: chunk.metadata,
      createdAt: chunk.createdAt,
    };
  }
}
