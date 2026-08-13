/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic vector indexing below uses FNV-1a hash arithmetic over the fixed
   closed dimension set — never attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Embedding Provider Port
// Provider-independent embedding seam. Business engines never import
// provider SDKs: the runtime injects an implementation (Mock for CI,
// SDK-backed OpenAI for production). AI-RUNTIME-002.
// ──────────────────────────────────────────────────────────────────

export interface EmbeddingProvider {
  /** Dimensionality of produced vectors (drives the pgvector schema). */
  readonly dimension: number;
  /** Model label surfaced in telemetry (e.g. 'text-embedding-3-small'). */
  readonly model: string;
  /** Embed one or more texts. Rejects on provider failure (caller decides fallback). */
  embed(texts: readonly string[]): Promise<number[][]>;
}

/**
 * Deterministic in-memory embedding for CI and development: a
 * bag-of-character-ngrams projection into a fixed-dimension unit vector.
 *
 * Every character 4-gram hashes to one coordinate and contributes +1, so
 * text sharing subword structure (morphology, word fragments, common
 * function words) lands closer in cosine space while unrelated text has
 * low expected overlap. With 512 dimensions the hash collisions are
 * negligible and the score distribution resembles real embedding behavior
 * (related 0.3–0.6, unrelated < 0.25), which keeps the deterministic smoke
 * test (C-02), the RAG evaluation dataset (C-09), and hermetically sealed
 * retrieval tests meaningful. Never used in production.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = 512;
  readonly model = 'mock-embedding';

  async embed(texts: readonly string[]): Promise<number[][]> {
    const vectors = texts.map((text) => this.embedOne(text));
    return await Promise.resolve(vectors);
  }

  private embedOne(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

    for (let i = 0; i <= normalized.length - 4; i++) {
      const gram = normalized.slice(i, i + 4);
      const position = this.fnv1a(gram) % this.dimension;
      vector[position] = (vector[position] ?? 0) + 1;
    }

    return this.normalize(vector);
  }

  private fnv1a(input: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  private normalize(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) {
      // Zero vector is a valid embedding for empty content; keep it as-is
      // (cosine similarity against it is defined as 0 by repositories).
      return vector;
    }
    return vector.map((v) => v / magnitude);
  }
}
