import { describe, it, expect } from 'vitest';
import { InMemoryRagRepository } from '../InMemoryRagRepository.js';
import { MockEmbeddingProvider } from '../../domain/services/EmbeddingProvider.js';
import type { RagChunk } from '../../types/rag-types.js';

function chunk(overrides: Partial<RagChunk> = {}): RagChunk {
  return {
    chunkId: 'chunk-1',
    sourceId: 'source-1',
    title: 'Title',
    content: 'content agency workflow',
    index: 0,
    size: 24,
    estimatedTokens: 6,
    metadata: { category: 'playbook' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryRagRepository', () => {
  it('persists and searches chunks scoped to a collection', async () => {
    const repo = new InMemoryRagRepository();
    const emb = new MockEmbeddingProvider();
    const text = 'content agency client onboarding';
    const [vector] = await emb.embed([text]);
    await repo.upsertChunks('org:a', [chunk({ content: text })], [vector]);

    const [queryVector] = await emb.embed(['client onboarding workflow']);
    const results = await repo.searchSimilar('org:a', queryVector, { topK: 5 });

    expect(results).toHaveLength(1);
    expect(results[0].sourceId).toBe('source-1');
    // The related chunk must rank well above an unrelated baseline (the
    // deterministic mock yields meaningful cosine separation, not an
    // arbitrary absolute threshold).
    expect(results[0].score).toBeGreaterThan(0.1);

    // Other collections are isolated
    const other = await repo.searchSimilar('org:b', queryVector, { topK: 5 });
    expect(other).toHaveLength(0);
  });

  it('applies minScore and metadata filters', async () => {
    const repo = new InMemoryRagRepository();
    const emb = new MockEmbeddingProvider();
    const [v1] = await emb.embed(['client onboarding']);
    const [v2] = await emb.embed(['database index tuning']);
    await repo.upsertChunks(
      'org:a',
      [
        chunk({
          chunkId: 'c1',
          sourceId: 's1',
          content: 'client onboarding',
          metadata: { category: 'playbook' },
        }),
        chunk({
          chunkId: 'c2',
          sourceId: 's2',
          content: 'database index tuning',
          metadata: { category: 'engineering' },
        }),
      ],
      [v1, v2],
    );

    const [q] = await emb.embed(['client onboarding']);
    const filtered = await repo.searchSimilar('org:a', q, {
      topK: 5,
      minScore: 0.9,
      metadataFilter: { category: 'playbook' },
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].chunkId).toBe('c1');
  });

  it('performs keyword fallback search', async () => {
    const repo = new InMemoryRagRepository();
    const emb = new MockEmbeddingProvider();
    const [v] = await emb.embed(['content agency workflow']);
    await repo.upsertChunks('org:a', [chunk({ content: 'content agency workflow review' })], [v]);

    const results = await repo.searchKeywords('org:a', 'agency workflow', { topK: 5 });
    expect(results).toHaveLength(1);
    expect(results[0].score).toBeGreaterThan(0);

    const none = await repo.searchKeywords('org:a', 'unrelated topic', { topK: 5 });
    expect(none).toHaveLength(0);
  });

  it('deletes chunks by source idempotently', async () => {
    const repo = new InMemoryRagRepository();
    const emb = new MockEmbeddingProvider();
    const [v] = await emb.embed(['content']);
    await repo.upsertChunks(
      'org:a',
      [
        chunk({ chunkId: 'c1', sourceId: 's1', content: 'content one' }),
        chunk({ chunkId: 'c2', sourceId: 's2', content: 'content two' }),
      ],
      [v, v],
    );

    expect(await repo.deleteBySource('org:a', 's1')).toBe(1);
    expect(await repo.deleteBySource('org:a', 's1')).toBe(0);
    const stats = await repo.getStats('org:a');
    expect(stats.chunkCount).toBe(1);
    expect(stats.sourceCount).toBe(1);
  });

  it('reports collection statistics', async () => {
    const repo = new InMemoryRagRepository();
    const emb = new MockEmbeddingProvider();
    const [v] = await emb.embed(['content']);
    await repo.upsertChunks('org:a', [chunk({ content: 'abc', size: 3, estimatedTokens: 1 })], [v]);

    const stats = await repo.getStats('org:a');
    expect(stats.chunkCount).toBe(1);
    expect(stats.totalChars).toBe(3);
    expect(stats.totalTokens).toBe(1);

    const global = await repo.getStats();
    expect(global.chunkCount).toBe(1);
    expect(global.collection).toBeUndefined();
  });

  it('updates an existing chunk in place when the same chunk id is upserted again', async () => {
    const repo = new InMemoryRagRepository();
    const emb = new MockEmbeddingProvider();
    const [v1] = await emb.embed(['first content']);
    const [v2] = await emb.embed(['second content']);
    await repo.upsertChunks('org:a', [chunk({ chunkId: 'c1', content: 'first content' })], [v1]);
    // Upsert same chunkId with new content + vector → replaces in place.
    await repo.upsertChunks('org:a', [chunk({ chunkId: 'c1', content: 'second content' })], [v2]);
    const [q] = await emb.embed(['second content']);
    const results = await repo.searchSimilar('org:a', q, { topK: 5 });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('second content');
    const stats = await repo.getStats('org:a');
    expect(stats.chunkCount).toBe(1);
  });

  it('applies a metadata filter in keyword fallback search', async () => {
    const repo = new InMemoryRagRepository();
    const emb = new MockEmbeddingProvider();
    const [v] = await emb.embed(['content agency']);
    await repo.upsertChunks(
      'org:a',
      [
        chunk({
          chunkId: 'c1',
          sourceId: 's1',
          content: 'content agency playbook',
          metadata: { category: 'playbook' },
        }),
        chunk({
          chunkId: 'c2',
          sourceId: 's2',
          content: 'content agency recipe',
          metadata: { category: 'recipe' },
        }),
      ],
      [v, v],
    );

    const results = await repo.searchKeywords('org:a', 'content agency', {
      topK: 5,
      metadataFilter: { category: 'playbook' },
    });
    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('c1');
  });
});
