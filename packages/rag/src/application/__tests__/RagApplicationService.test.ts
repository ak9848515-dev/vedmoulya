import { describe, it, expect, vi } from 'vitest';
import { RagApplicationService } from '../RagApplicationService.js';
import { InMemoryRagRepository } from '../../infrastructure/InMemoryRagRepository.js';
import { MockEmbeddingProvider } from '../../domain/services/EmbeddingProvider.js';
import type { EmbeddingProvider } from '../../domain/services/EmbeddingProvider.js';

const DOC = {
  userId: 'user-1',
  collection: 'org:vedmoulya',
  sourceId: 'kb-1',
  title: 'Onboarding',
  content: [
    'The content agency onboards clients through lead capture, brand definition, and project scoping.',
    'Brand guidelines are stable context reused across generation runs.',
    'AI content is reviewed by a human account manager before delivery.',
  ].join('\n\n'),
  metadata: { category: 'playbook' },
};

describe('RagApplicationService', () => {
  it('ingests a document and retrieves it with vector search', async () => {
    const service = new RagApplicationService({
      repository: new InMemoryRagRepository(),
      embeddingProvider: new MockEmbeddingProvider(),
    });

    const ingest = await service.ingestDocument(DOC);
    expect(ingest.sourceId).toBe('kb-1');
    expect(ingest.chunkCount).toBeGreaterThan(0);
    expect(ingest.embeddingModel).toBe('mock-embedding');

    const search = await service.search({
      userId: 'user-1',
      collection: 'org:vedmoulya',
      query: 'client onboarding brand definition',
      topK: 3,
    });
    expect(search.strategy).toBe('vector');
    expect(search.total).toBeGreaterThan(0);
    expect(search.results[0].sourceId).toBe('kb-1');
    expect(search.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('falls back to keyword search when the embedding pipeline fails', async () => {
    // Ingest succeeds (first embed) then the pipeline fails during search.
    let embedCalls = 0;
    const failingEmbedder: EmbeddingProvider = {
      dimension: 8,
      model: 'mock-embedding',
      embed: vi.fn(async (texts: readonly string[]) => {
        embedCalls += 1;
        if (embedCalls > 1) {
          throw new Error('embedding provider unavailable');
        }
        return new MockEmbeddingProvider().embed(texts);
      }),
    };
    const service = new RagApplicationService({
      repository: new InMemoryRagRepository(),
      embeddingProvider: failingEmbedder,
    });

    await service.ingestDocument({ ...DOC, sourceId: 'kb-2' });

    const search = await service.search({
      userId: 'user-1',
      collection: 'org:vedmoulya',
      query: 'brand guidelines stable context',
      topK: 3,
    });
    expect(search.strategy).toBe('keyword_fallback');
    expect(search.total).toBeGreaterThan(0);
    expect(search.results[0].sourceId).toBe('kb-2');
    expect(search.embeddingModel).toBe('keyword_fallback');
  });

  it('validates required inputs', async () => {
    const service = new RagApplicationService({
      repository: new InMemoryRagRepository(),
      embeddingProvider: new MockEmbeddingProvider(),
    });

    await expect(service.ingestDocument({ ...DOC, collection: '  ' })).rejects.toThrow(
      'collection is required',
    );
    await expect(
      service.search({ userId: 'user-1', collection: 'org:x', query: '   ' }),
    ).rejects.toThrow('collection and query are required');
  });

  it('rejects empty documents before touching the embedding provider', async () => {
    const embedder = vi.mocked({
      dimension: 8,
      model: 'mock-embedding',
      embed: vi.fn(async () => []),
    });
    const service = new RagApplicationService({
      repository: new InMemoryRagRepository(),
      embeddingProvider: embedder,
    });

    await expect(service.ingestDocument({ ...DOC, content: '   \n\n  ' })).rejects.toThrow(
      'sourceId and content are required',
    );
    expect(embedder.embed).not.toHaveBeenCalled();
  });

  it('ingests a document without metadata (defaults to empty object)', async () => {
    const service = new RagApplicationService({
      repository: new InMemoryRagRepository(),
      embeddingProvider: new MockEmbeddingProvider(),
    });

    const { sourceId, title, collection } = DOC;
    const ingest = await service.ingestDocument({
      userId: 'user-1',
      collection,
      sourceId: 'kb-no-meta',
      title,
      content: DOC.content,
    });
    expect(ingest.sourceId).toBe('kb-no-meta');
    expect(ingest.chunkCount).toBeGreaterThan(0);

    // Strong-match query: retrieval applies a default relevance floor
    // (DEFAULT_MIN_SCORE) that excludes clearly-irrelevant chunks, so the
    // probe must be semantically aligned with the content.
    const search = await service.search({
      userId: 'user-1',
      collection: 'org:vedmoulya',
      query: 'content agency onboards clients lead capture brand definition project scoping',
      topK: 3,
    });
    expect(search.total).toBeGreaterThan(0);
    // No metadata supplied → the service defaulted to {} (no `category`
    // leaked from DOC.metadata), while the repository attached the title.
    expect(search.results[0].metadata?.category).toBeUndefined();
    expect(search.results[0].metadata?.title).toBe('Onboarding');
  });

  it('deletes a source and reports stats', async () => {
    const service = new RagApplicationService({
      repository: new InMemoryRagRepository(),
      embeddingProvider: new MockEmbeddingProvider(),
    });
    await service.ingestDocument(DOC);

    const stats = await service.getStats('org:vedmoulya');
    expect(stats.stats.chunkCount).toBeGreaterThan(0);

    const del = await service.deleteSource({
      userId: 'user-1',
      collection: 'org:vedmoulya',
      sourceId: 'kb-1',
    });
    expect(del.deleted).toBeGreaterThan(0);

    const after = await service.getStats('org:vedmoulya');
    expect(after.stats.chunkCount).toBe(0);
  });
});
