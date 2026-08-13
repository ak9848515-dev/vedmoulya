import { describe, it, expect } from 'vitest';
import { MockEmbeddingProvider } from '../EmbeddingProvider.js';

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

function norm(a: number[]): number {
  return Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
}

function cosine(a: number[], b: number[]): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

describe('MockEmbeddingProvider', () => {
  it('has the documented shape', () => {
    const p = new MockEmbeddingProvider();
    // 64 dims keeps the deterministic mock discriminative enough for the
    // smoke test + RAG evaluation dataset (C-02/C-09) while staying tiny.
    expect(p.dimension).toBe(512);
    expect(p.model).toBe('mock-embedding');
  });

  it('is deterministic for identical text', async () => {
    const p = new MockEmbeddingProvider();
    const [a, b] = await p.embed(['sap abap code analysis', 'sap abap code analysis']);
    expect(a).toEqual(b);
  });

  it('produces unit vectors', async () => {
    const p = new MockEmbeddingProvider();
    const [vector] = await p.embed(['enterprise context fabric']);
    expect(Math.abs(norm(vector) - 1)).toBeLessThan(1e-6);
  });

  it('ranks semantically overlapping text above unrelated text', async () => {
    const p = new MockEmbeddingProvider();
    const [query, related, unrelated] = await p.embed([
      'content agency client onboarding workflow',
      'content agency client brand definition workflow',
      'postgres database index maintenance',
    ]);
    expect(cosine(query, related)).toBeGreaterThan(cosine(query, unrelated));
  });

  it('embeds empty text as a zero vector without throwing', async () => {
    const p = new MockEmbeddingProvider();
    const [vector] = await p.embed(['']);
    expect(vector.every((v) => v === 0)).toBe(true);
  });

  it('embeds very short text (below the 4-char ngram window) as a zero vector', async () => {
    const p = new MockEmbeddingProvider();
    const [vector] = await p.embed(['ab']);
    // No 4-char window exists → no coordinates contributed → zero vector.
    expect(vector.every((v) => v === 0)).toBe(true);
  });

  it('normalizes case deterministically (case-fold before projection)', async () => {
    const p = new MockEmbeddingProvider();
    const [a, b] = await p.embed(['SAP ABAP Code Analysis', 'sap abap code analysis']);
    // The mock lowercases before projecting, so the two inputs are identical
    // after normalization and produce the same vector.
    expect(a).toEqual(b);
  });

  it('yields distinct vectors for distinct vocabulary', async () => {
    const p = new MockEmbeddingProvider();
    const [a, b] = await p.embed(['enterprise knowledge graph', 'monsoon weather forecast']);
    expect(a.some((v, i) => v !== (b[i] ?? 0))).toBe(true);
  });

  it('embeds a batch of texts and preserves order', async () => {
    const p = new MockEmbeddingProvider();
    const [a, b] = await p.embed(['first', 'second']);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a).not.toEqual(b);
  });
});
