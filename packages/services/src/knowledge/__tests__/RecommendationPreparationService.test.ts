// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — RecommendationPreparationService unit tests
// ARC-003 — Knowledge Graph Bounded Context / BLD-005 AI Orchestrator Integration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RecommendationPreparationService } from '../RecommendationPreparationService.js';
import { KnowledgeFactory } from '@vedmoulya/domain';
import type { KnowledgeRepository } from '@vedmoulya/domain';

function makeRepo(overrides: Record<string, unknown> = {}): KnowledgeRepository {
  const repo: Record<string, unknown> = {
    findNodeById: vi.fn(),
    findEdgesForNode: vi.fn(),
    searchNodes: vi.fn(),
    ...overrides,
  };
  return repo as unknown as KnowledgeRepository;
}

function makeNode(
  id: string,
  label: string,
  opts: { category?: string; description?: string; tags?: string[]; confidence?: string } = {},
): unknown {
  return KnowledgeFactory.reconstructNode({
    id,
    graphId: 'g-1',
    category: opts.category ?? 'knowledge',
    label,
    description: opts.description ?? `Desc ${label}`,
    status: 'active',
    confidence: opts.confidence ?? 'high',
    confidenceScore: 0.9,
    sourceType: 'user_input',
    sourceDetail: 'manual entry',
    tags: opts.tags ?? [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  });
}

describe('RecommendationPreparationService.assembleContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('collects the requested nodes and builds citations', async () => {
    const repo = makeRepo({
      findNodeById: vi.fn().mockImplementation(async (id: unknown) => {
        const map: Record<string, unknown> = {
          'n-1': makeNode('n-1', 'Goal'),
          'n-2': makeNode('n-2', 'Skill'),
        };
        return map[String(id)] ?? null;
      }),
    });
    const service = new RecommendationPreparationService(repo);
    const result = await service.assembleContext({ nodeIds: ['n-1', 'n-2'] });
    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(0);
    expect(result.citations).toHaveLength(2);
    expect(result.context).toContain('Goal');
    expect(result.context).toContain('Skill');
    expect(result.citations[0]).toMatchObject({
      nodeId: 'n-1',
      label: 'Goal',
      category: 'knowledge',
    });
  });

  it('deduplicates repeated node ids', async () => {
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(makeNode('n-1', 'Goal')),
    });
    const service = new RecommendationPreparationService(repo);
    const result = await service.assembleContext({ nodeIds: ['n-1', 'n-1'] });
    expect(result.nodeCount).toBe(1);
    expect(result.citations).toHaveLength(1);
  });

  it('skips missing nodes', async () => {
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(null),
    });
    const service = new RecommendationPreparationService(repo);
    const result = await service.assembleContext({ nodeIds: ['n-1'] });
    expect(result.nodeCount).toBe(0);
    expect(result.citations).toEqual([]);
  });

  it('includes related nodes when requested', async () => {
    const repo = makeRepo({
      findNodeById: vi
        .fn()
        .mockImplementation(async (id: unknown) =>
          String(id) === 'n-2' ? makeNode('n-2', 'Related') : null,
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
    const service = new RecommendationPreparationService(repo);
    const result = await service.assembleContext({
      nodeIds: ['n-1'],
      includeRelated: true,
      maxDepth: 1,
      maxNodes: 10,
    });
    expect(result.nodeCount).toBe(1);
    expect(result.citations.map((c) => c.nodeId)).toEqual(['n-2']);
  });

  it('does not fetch related nodes when includeRelated is false', async () => {
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(makeNode('n-1', 'Goal')),
      findEdgesForNode: vi.fn(),
    });
    const service = new RecommendationPreparationService(repo);
    const result = await service.assembleContext({
      nodeIds: ['n-1'],
      includeRelated: false,
      maxDepth: 2,
    });
    expect(result.nodeCount).toBe(1);
    expect(repo.findEdgesForNode).not.toHaveBeenCalled();
  });

  it('includes description and tags in the context string', async () => {
    const repo = makeRepo({
      findNodeById: vi
        .fn()
        .mockResolvedValue(
          makeNode('n-1', 'Goal', { description: 'A big goal', tags: ['career', 'growth'] }),
        ),
    });
    const service = new RecommendationPreparationService(repo);
    const result = await service.assembleContext({ nodeIds: ['n-1'] });
    expect(result.context).toContain('Description: A big goal');
    expect(result.context).toContain('Tags: career, growth');
  });
});

describe('RecommendationPreparationService.prepareExplainability', () => {
  it('builds reasoning from the node and related knowledge', async () => {
    const repo = makeRepo({
      findNodeById: vi
        .fn()
        .mockImplementation(async (id: unknown) =>
          String(id) === 'n-1' ? makeNode('n-1', 'Goal') : makeNode('n-2', 'Skill'),
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
    const service = new RecommendationPreparationService(repo);
    const result = await service.prepareExplainability('n-1');
    expect(result.reasoning).toContain('Goal');
    expect(result.reasoning).toContain('1 related knowledge areas');
    expect(result.sourceNodes).toHaveLength(1);
    expect(result.pathDescription).toContain('Related: Skill');
  });

  it('returns a not-found explanation when the node is missing', async () => {
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(null),
    });
    const service = new RecommendationPreparationService(repo);
    const result = await service.prepareExplainability('n-1');
    expect(result.reasoning).toBe('Node not found');
    expect(result.sourceNodes).toEqual([]);
    expect(result.pathDescription).toBe('');
  });
});

describe('RecommendationPreparationService.prepareSemanticContext', () => {
  it('builds context from search results', async () => {
    const repo = makeRepo({
      searchNodes: vi.fn().mockResolvedValue({
        data: [
          makeNode('n-1', 'Goal', { description: 'A big goal' }),
          makeNode('n-2', 'Skill', { description: 'A useful skill' }),
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    });
    const service = new RecommendationPreparationService(repo);
    const result = await service.prepareSemanticContext('career', 20);
    expect(result.context).toContain('## Relevant Knowledge');
    expect(result.context).toContain('Goal (knowledge): A big goal');
    expect(result.citations).toHaveLength(2);
    expect(result.nodeCount).toBe(2);
  });

  it('returns a fallback message when there are no results', async () => {
    const repo = makeRepo({
      searchNodes: vi.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
    });
    const service = new RecommendationPreparationService(repo);
    const result = await service.prepareSemanticContext('nothing');
    expect(result.context).toBe('No relevant knowledge found.');
    expect(result.citations).toEqual([]);
    expect(result.nodeCount).toBe(0);
  });

  it('defaults maxNodes to 20', async () => {
    const repo = makeRepo({
      searchNodes: vi.fn().mockResolvedValue({
        data: [makeNode('n-1', 'Goal')],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    });
    const service = new RecommendationPreparationService(repo);
    await service.prepareSemanticContext('career');
    expect(repo.searchNodes).toHaveBeenCalledWith('career', { page: 1, limit: 20 });
  });
});
