// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Tests: InMemoryContextRepository
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryContextRepository } from '../../infrastructure/InMemoryContextRepository.js';
import { createCatalogContext, SEED_CONTEXT_SIZE } from '../../catalog/context-catalog.js';
import type { ContextItem } from '../../types/context-types.js';

function createMockItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    contextId: 'test_ctx_001',
    source: 'knowledge_base',
    category: 'knowledge',
    priority: 'medium',
    importance: 0.7,
    confidence: 0.85,
    freshness: 0.8,
    size: 500,
    estimatedTokens: 125,
    language: 'en',
    tags: ['test'],
    business: ['platform'],
    capability: ['reasoning'],
    version: '1.0.0',
    content: 'Test content.',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceId: 'test_source_001',
    ...overrides,
  };
}

describe('InMemoryContextRepository', () => {
  it('stores seed catalog items', () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    expect(repo.count()).resolves.toBe(SEED_CONTEXT_SIZE);
  });

  it('finds item by id', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const item = await repo.findById('ctx_user_profile_001' as any);
    expect(item).not.toBeNull();
    expect(item!.source).toBe('conversation_memory');
  });

  it('returns null for unknown id', async () => {
    const repo = new InMemoryContextRepository();
    const item = await repo.findById('nope' as any);
    expect(item).toBeNull();
  });

  it('saves and retrieves a new item', async () => {
    const repo = new InMemoryContextRepository();
    const item = createMockItem();
    await repo.save(item);
    expect(await repo.count()).toBe(1);
    const found = await repo.findById('test_ctx_001' as any);
    expect(found).toBeDefined();
    expect(found!.content).toBe('Test content.');
  });

  it('saves many items', async () => {
    const repo = new InMemoryContextRepository();
    const items = [
      createMockItem({ contextId: 'a' }),
      createMockItem({ contextId: 'b' }),
      createMockItem({ contextId: 'c' }),
    ];
    await repo.saveMany(items);
    expect(await repo.count()).toBe(3);
  });

  it('updates an existing item', async () => {
    const repo = new InMemoryContextRepository();
    await repo.save(createMockItem());
    await repo.update(createMockItem({ content: 'Updated content' }));
    const found = await repo.findById('test_ctx_001' as any);
    expect(found!.content).toBe('Updated content');
  });

  it('deletes an item', async () => {
    const repo = new InMemoryContextRepository();
    await repo.save(createMockItem());
    expect(await repo.exists('test_ctx_001' as any)).toBe(true);
    await repo.delete('test_ctx_001' as any);
    expect(await repo.exists('test_ctx_001' as any)).toBe(false);
  });

  it('checks existence', async () => {
    const repo = new InMemoryContextRepository();
    await repo.save(createMockItem());
    expect(await repo.exists('test_ctx_001' as any)).toBe(true);
    expect(await repo.exists('nope' as any)).toBe(false);
  });

  it('finds items by source', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const result = await repo.findBySource('knowledge_base', { page: 1, limit: 100 });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((i) => i.source === 'knowledge_base')).toBe(true);
  });

  it('finds items by category', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const result = await repo.findByCategory('knowledge', { page: 1, limit: 100 });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((i) => i.category === 'knowledge')).toBe(true);
  });

  it('finds items by priority', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const result = await repo.findByPriority('critical', { page: 1, limit: 100 });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((i) => i.priority === 'critical')).toBe(true);
  });

  it('finds items by capability', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const result = await repo.findByCapability('reasoning', { page: 1, limit: 100 });
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('searches by text query', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const result = await repo.search({ query: 'architecture' }, { page: 1, limit: 50 });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.some((i) => i.content.toLowerCase().includes('architecture'))).toBe(true);
  });

  it('searches with multiple filters', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const result = await repo.search(
      {
        sources: ['knowledge_base'],
        categories: ['knowledge'],
        priorities: ['critical'],
      },
      { page: 1, limit: 50 },
    );
    expect(result.data.length).toBeGreaterThan(0);
    expect(
      result.data.every(
        (i) =>
          i.source === 'knowledge_base' && i.category === 'knowledge' && i.priority === 'critical',
      ),
    ).toBe(true);
  });

  it('paginates results', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const page1 = await repo.search({}, { page: 1, limit: 10 });
    const page2 = await repo.search({}, { page: 2, limit: 10 });
    expect(page1.data.length).toBeLessThanOrEqual(10);
    expect(page2.data.length).toBeLessThanOrEqual(10);
    expect(page1.total).toBe(SEED_CONTEXT_SIZE);
    expect(page1.totalPages).toBeGreaterThanOrEqual(3);
  });

  it('counts by source', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const counts = await repo.countBySource();
    expect(Object.keys(counts).length).toBeGreaterThan(0);
    expect(counts.knowledge_base).toBeGreaterThan(0);
  });

  it('counts by category', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const counts = await repo.countByCategory();
    expect(counts.knowledge).toBeGreaterThan(0);
    expect(counts.memory).toBeGreaterThan(0);
  });

  it('counts by priority', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const counts = await repo.countByPriority();
    expect(counts.critical).toBeGreaterThan(0);
    expect(counts.background).toBeGreaterThan(0);
  });

  it('computes total tokens', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const total = await repo.totalTokens();
    expect(total).toBeGreaterThan(0);
  });

  it('lists all items', async () => {
    const repo = new InMemoryContextRepository(createCatalogContext());
    const all = await repo.listAll();
    expect(all).toHaveLength(SEED_CONTEXT_SIZE);
  });
});
