// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SearchService unit tests
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SearchService } from '../SearchService.js';
import { KnowledgeFactory } from '@vedmoulya/domain';
import type { KnowledgeRepository } from '@vedmoulya/domain';

function makeRepo(overrides: Record<string, unknown> = {}): KnowledgeRepository {
  const repo: Record<string, unknown> = {
    searchNodes: vi.fn(),
    findNodesByCategory: vi.fn(),
    searchNodesByTags: vi.fn(),
    findNodeById: vi.fn(),
    findEdgesForNode: vi.fn(),
    ...overrides,
  };
  return repo as unknown as KnowledgeRepository;
}

function makeNode(
  id: string,
  label: string,
  opts: { category?: string; status?: string; graphId?: string; tags?: string[] } = {},
): unknown {
  return KnowledgeFactory.reconstructNode({
    id,
    graphId: opts.graphId ?? 'g-1',
    category: opts.category ?? 'knowledge',
    label,
    description: `Desc ${label}`,
    status: opts.status ?? 'active',
    confidence: 'high',
    confidenceScore: 0.9,
    sourceType: 'user_input',
    sourceDetail: 'manual entry',
    tags: opts.tags ?? [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  });
}

const paginated = (data: unknown[]) => ({
  data,
  total: data.length,
  page: 1,
  limit: 10,
  totalPages: Math.ceil(data.length / 10),
});

describe('SearchService.search', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns all nodes when no filters are provided', async () => {
    const repo = makeRepo({
      searchNodes: vi
        .fn()
        .mockResolvedValue(paginated([makeNode('n-1', 'A'), makeNode('n-2', 'B')])),
    });
    const service = new SearchService(repo);
    const result = await service.search({ query: 'x', pagination: { page: 1, limit: 10 } });
    expect(result.nodes).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1);
  });

  it('filters by categories', async () => {
    const repo = makeRepo({
      searchNodes: vi
        .fn()
        .mockResolvedValue(
          paginated([
            makeNode('n-1', 'A', { category: 'knowledge' }),
            makeNode('n-2', 'B', { category: 'skill' }),
          ]),
        ),
    });
    const service = new SearchService(repo);
    const result = await service.search({
      query: 'x',
      filters: { categories: ['knowledge'] },
      pagination: { page: 1, limit: 10 },
    });
    expect(result.nodes.map((n) => n.id)).toEqual(['n-1']);
  });

  it('filters by status', async () => {
    const repo = makeRepo({
      searchNodes: vi
        .fn()
        .mockResolvedValue(
          paginated([
            makeNode('n-1', 'A', { status: 'active' }),
            makeNode('n-2', 'B', { status: 'draft' }),
          ]),
        ),
    });
    const service = new SearchService(repo);
    const result = await service.search({
      query: 'x',
      filters: { status: 'active' },
      pagination: { page: 1, limit: 10 },
    });
    expect(result.nodes.map((n) => n.id)).toEqual(['n-1']);
  });

  it('filters by graphId', async () => {
    const repo = makeRepo({
      searchNodes: vi
        .fn()
        .mockResolvedValue(
          paginated([
            makeNode('n-1', 'A', { graphId: 'g-1' }),
            makeNode('n-2', 'B', { graphId: 'g-2' }),
          ]),
        ),
    });
    const service = new SearchService(repo);
    const result = await service.search({
      query: 'x',
      filters: { graphId: 'g-2' },
      pagination: { page: 1, limit: 10 },
    });
    expect(result.nodes.map((n) => n.id)).toEqual(['n-2']);
  });

  it('filters by tags', async () => {
    const repo = makeRepo({
      searchNodes: vi
        .fn()
        .mockResolvedValue(
          paginated([
            makeNode('n-1', 'A', { tags: ['alpha', 'beta'] }),
            makeNode('n-2', 'B', { tags: ['gamma'] }),
          ]),
        ),
    });
    const service = new SearchService(repo);
    const result = await service.search({
      query: 'x',
      filters: { tags: ['beta'] },
      pagination: { page: 1, limit: 10 },
    });
    expect(result.nodes.map((n) => n.id)).toEqual(['n-1']);
  });
});

describe('SearchService — category/tag/related/autocomplete', () => {
  it('searchByCategory maps paginated results', async () => {
    const repo = makeRepo({
      findNodesByCategory: vi.fn().mockResolvedValue(paginated([makeNode('n-1', 'A')])),
    });
    const service = new SearchService(repo);
    const result = await service.searchByCategory('goal', { page: 1, limit: 10 });
    expect(result.nodes).toHaveLength(1);
    expect(repo.findNodesByCategory).toHaveBeenCalledOnce();
  });

  it('searchByTags maps paginated results', async () => {
    const repo = makeRepo({
      searchNodesByTags: vi.fn().mockResolvedValue(paginated([makeNode('n-1', 'A')])),
    });
    const service = new SearchService(repo);
    const result = await service.searchByTags(['beta'], { page: 1, limit: 10 });
    expect(result.nodes).toHaveLength(1);
    expect(repo.searchNodesByTags).toHaveBeenCalledOnce();
  });

  it('findRelated returns related nodes from the graph service', async () => {
    const repo = makeRepo({
      findNodeById: vi
        .fn()
        .mockImplementation(async (id: unknown) =>
          String(id) === 'n-1' ? makeNode('n-1', 'Root') : makeNode('n-2', 'Related'),
        ),
      findEdgesForNode: vi.fn().mockResolvedValue([
        KnowledgeFactory.reconstructEdge({
          id: 'e-1',
          graphId: 'g-1',
          sourceId: 'n-1',
          targetId: 'n-2',
          type: 'RELATED_TO',
          category: 'association',
          label: 'related to',
          weight: 1,
          accuracy: 0.9,
          completeness: 0.9,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-02T00:00:00Z'),
        }),
      ]),
    });
    const service = new SearchService(repo);
    const result = await service.findRelated('n-1');
    expect(result.nodes).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.relevance).toBe(1);
  });

  it('findRelated returns empty when the start node is missing', async () => {
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(null),
      findEdgesForNode: vi.fn().mockResolvedValue([]),
    });
    const service = new SearchService(repo);
    const result = await service.findRelated('n-1');
    expect(result.nodes).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('autocomplete slices results to the limit', async () => {
    const repo = makeRepo({
      searchNodes: vi
        .fn()
        .mockResolvedValue(
          paginated([makeNode('n-1', 'Alpha'), makeNode('n-2', 'Beta'), makeNode('n-3', 'Gamma')]),
        ),
    });
    const service = new SearchService(repo);
    const suggestions = await service.autocomplete('a', 2);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toHaveProperty('id');
    expect(suggestions[0]).toHaveProperty('label');
    expect(suggestions[0]).toHaveProperty('category');
  });

  it('autocomplete defaults the limit to 10', async () => {
    const repo = makeRepo({
      searchNodes: vi.fn().mockResolvedValue(paginated([makeNode('n-1', 'Alpha')])),
    });
    const service = new SearchService(repo);
    const suggestions = await service.autocomplete('a');
    expect(suggestions).toHaveLength(1);
  });
});
