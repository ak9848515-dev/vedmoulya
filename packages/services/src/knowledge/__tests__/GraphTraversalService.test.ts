// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — GraphTraversalService unit tests
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GraphTraversalService } from '../GraphTraversalService.js';
import { KnowledgeFactory } from '@vedmoulya/domain';
import type { KnowledgeRepository } from '@vedmoulya/domain';

function makeRepo(overrides: Record<string, unknown> = {}): KnowledgeRepository {
  const repo: Record<string, unknown> = {
    findNodeById: vi.fn(),
    findEdgesForNode: vi.fn(),
    ...overrides,
  };
  return repo as unknown as KnowledgeRepository;
}

function makeNode(id: string, label: string, category = 'knowledge'): unknown {
  return KnowledgeFactory.reconstructNode({
    id,
    graphId: 'g-1',
    category,
    label,
    description: `Desc ${label}`,
    status: 'active',
    confidence: 'high',
    confidenceScore: 0.9,
    sourceType: 'user_input',
    sourceDetail: 'manual entry',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  });
}

function makeEdge(
  id: string,
  sourceId: string,
  targetId: string,
  type = 'RELATED_TO',
  category:
    | 'ownership'
    | 'progression'
    | 'dependency'
    | 'causality'
    | 'composition'
    | 'association'
    | 'temporal' = 'association',
  score = 0.9,
): unknown {
  return KnowledgeFactory.reconstructEdge({
    id,
    graphId: 'g-1',
    sourceId,
    targetId,
    type,
    category,
    label: type.toLowerCase(),
    weight: 1,
    accuracy: score,
    completeness: score,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  });
}

/** Build a simple star graph: n-1 connects to n-2 (RELATED_TO) and n-3 (PART_OF). */
function setupStarGraph(repo: KnowledgeRepository): void {
  const nodes = new Map([
    ['n-1', makeNode('n-1', 'Root')],
    ['n-2', makeNode('n-2', 'Child A')],
    ['n-3', makeNode('n-3', 'Child B', 'skill')],
  ]);
  const edges = new Map([
    [
      'n-1',
      [
        makeEdge('e-1', 'n-1', 'n-2', 'RELATED_TO', 'association', 0.9),
        makeEdge('e-2', 'n-1', 'n-3', 'PART_OF', 'composition', 0.4),
      ],
    ],
    ['n-2', []],
    ['n-3', []],
  ]);
  (repo as unknown as { findNodeById: ReturnType<typeof vi.fn> }).findNodeById.mockImplementation(
    async (id: unknown) => nodes.get(String(id)) ?? null,
  );
  (
    repo as unknown as { findEdgesForNode: ReturnType<typeof vi.fn> }
  ).findEdgesForNode.mockImplementation(async (id: unknown) => edges.get(String(id)) ?? []);
}

describe('GraphTraversalService.traverseWithFilter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the full path when no filter is provided', async () => {
    const repo = makeRepo();
    setupStarGraph(repo);
    const service = new GraphTraversalService(repo);
    const result = await service.traverseWithFilter('n-1');
    expect(result.path).toHaveLength(3);
    expect(result.path[0].node.id).toBe('n-1');
  });

  it('filters path by relationship types', async () => {
    const repo = makeRepo();
    setupStarGraph(repo);
    const service = new GraphTraversalService(repo);
    const result = await service.traverseWithFilter('n-1', { relationshipTypes: ['RELATED_TO'] });
    // Root step has no edge (kept), n-2 step has RELATED_TO (kept), n-3 step has PART_OF (removed)
    expect(result.path).toHaveLength(2);
    expect(result.path.every((p) => !p.edge || p.edge?.type === 'RELATED_TO')).toBe(true);
  });

  it('filters path by categories', async () => {
    const repo = makeRepo();
    setupStarGraph(repo);
    const service = new GraphTraversalService(repo);
    const result = await service.traverseWithFilter('n-1', { categories: ['knowledge'] });
    // n-3 has category 'skill' -> removed
    expect(result.path).toHaveLength(2);
  });

  it('filters path by minimum confidence', async () => {
    const repo = makeRepo();
    setupStarGraph(repo);
    const service = new GraphTraversalService(repo);
    const result = await service.traverseWithFilter('n-1', { minConfidence: 'high' });
    // e-2 has confidence 0.4 (< 0.8) -> n-3 step removed
    expect(result.path).toHaveLength(2);
  });

  it('treats unknown confidence levels as low threshold', async () => {
    const repo = makeRepo();
    setupStarGraph(repo);
    const service = new GraphTraversalService(repo);
    const result = await service.traverseWithFilter('n-1', { minConfidence: 'custom' });
    expect(result.path).toHaveLength(3);
  });
});

describe('GraphTraversalService.extractSubgraph', () => {
  it('extracts unique nodes and edges', async () => {
    const repo = makeRepo();
    setupStarGraph(repo);
    const service = new GraphTraversalService(repo);
    const result = await service.extractSubgraph('n-1', 1);
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['n-1', 'n-2', 'n-3']);
    expect(result.edges.map((e) => e.id).sort()).toEqual(['e-1', 'e-2']);
  });
});

describe('GraphTraversalService.findAllPaths', () => {
  it('returns a single path when one exists', async () => {
    const repo = makeRepo();
    setupStarGraph(repo);
    const service = new GraphTraversalService(repo);
    const results = await service.findAllPaths('n-1', 'n-2');
    expect(results).toHaveLength(1);
    expect(results[0].path).toHaveLength(2);
    expect(results[0].path[1].edge?.id).toBe('e-1');
  });

  it('returns an empty array when no path exists', async () => {
    const repo = makeRepo();
    setupStarGraph(repo);
    const service = new GraphTraversalService(repo);
    const results = await service.findAllPaths('n-2', 'n-3');
    expect(results).toEqual([]);
  });
});

describe('GraphTraversalService.getDependencyChain', () => {
  it('returns empty dependency/dependent lists when no DEPENDS_ON edges exist', async () => {
    const repo = makeRepo();
    setupStarGraph(repo);
    const service = new GraphTraversalService(repo);
    const result = await service.getDependencyChain('n-1');
    expect(result.dependencies).toEqual([]);
    expect(result.dependents).toEqual([]);
  });

  it('splits DEPENDS_ON edges into dependencies and dependents', async () => {
    const repo = makeRepo();
    const nodes = new Map([
      ['n-1', makeNode('n-1', 'Root')],
      ['n-2', makeNode('n-2', 'Dep')],
      ['n-3', makeNode('n-3', 'Dependent')],
    ]);
    // getDependencyGraph only reads edges for the queried node (n-1).
    // Edge pointing INTO n-1 (n-2 -> n-1) => n-1 depends on n-2 => dependency.
    // Edge pointing OUT of n-1 (n-1 -> n-3) => n-3 depends on n-1 => dependent.
    const edges = new Map([
      [
        'n-1',
        [
          makeEdge('e-dep', 'n-2', 'n-1', 'DEPENDS_ON', 'dependency', 0.8),
          makeEdge('e-out', 'n-1', 'n-3', 'DEPENDS_ON', 'dependency', 0.8),
        ],
      ],
      ['n-2', []],
      ['n-3', []],
    ]);
    (repo as unknown as { findNodeById: ReturnType<typeof vi.fn> }).findNodeById.mockImplementation(
      async (id: unknown) => nodes.get(String(id)) ?? null,
    );
    (
      repo as unknown as { findEdgesForNode: ReturnType<typeof vi.fn> }
    ).findEdgesForNode.mockImplementation(async (id: unknown) => edges.get(String(id)) ?? []);
    const service = new GraphTraversalService(repo);
    const result = await service.getDependencyChain('n-1');
    expect(result.dependencies.map((n) => n.id)).toEqual(['n-2']);
    expect(result.dependents.map((n) => n.id)).toEqual(['n-3']);
  });
});
