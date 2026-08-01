// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — KnowledgeApplicationService unit tests
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { KnowledgeApplicationService } from '../KnowledgeApplicationService.js';
import { NotFoundError, ValidationError } from '@vedmoulya/core';
import { KnowledgeFactory, KnowledgeGraph, createKnowledgeNodeId } from '@vedmoulya/domain';
import type { KnowledgeRepository } from '@vedmoulya/domain';

function makeRepo(overrides: Record<string, unknown> = {}): KnowledgeRepository {
  const repo: Record<string, unknown> = {
    findNodeById: vi.fn(),
    findNodesByCategory: vi.fn(),
    findNodesByLabel: vi.fn(),
    findNodesByGraph: vi.fn(),
    saveNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    nodeExists: vi.fn(),
    findEdgeById: vi.fn(),
    findEdgesBetween: vi.fn(),
    findEdgesForNode: vi.fn(),
    findEdgesByType: vi.fn(),
    findEdgesByCategory: vi.fn(),
    saveEdge: vi.fn(),
    updateEdge: vi.fn(),
    deleteEdge: vi.fn(),
    edgeExists: vi.fn(),
    findGraphById: vi.fn(),
    findAllGraphs: vi.fn(),
    saveGraph: vi.fn(),
    updateGraph: vi.fn(),
    deleteGraph: vi.fn(),
    searchNodes: vi.fn(),
    searchNodesByTags: vi.fn(),
    countNodes: vi.fn(),
    countEdges: vi.fn(),
    countNodesByCategory: vi.fn(),
    countGraphs: vi.fn(),
    ...overrides,
  };
  return repo as unknown as KnowledgeRepository;
}

function makeNode(id = 'n-1', label = 'Node 1', category = 'knowledge'): unknown {
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

function makeEdge(id = 'e-1', sourceId = 'n-1', targetId = 'n-2'): unknown {
  return KnowledgeFactory.reconstructEdge({
    id,
    graphId: 'g-1',
    sourceId,
    targetId,
    type: 'RELATED_TO',
    category: 'association',
    label: 'related to',
    weight: 1,
    accuracy: 0.9,
    completeness: 0.9,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  });
}

function makeGraph(): unknown {
  return KnowledgeGraph.create({ label: 'Graph', description: 'Desc' });
}

describe('KnowledgeApplicationService — Graph Management', () => {
  it('createGraph saves and maps the graph', async () => {
    const repo = makeRepo({ saveGraph: vi.fn().mockResolvedValue(undefined) });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.createGraph({ label: 'Graph', description: 'Desc' });
    expect(dto.label).toBe('Graph');
    expect(dto.description).toBe('Desc');
    expect(repo.saveGraph).toHaveBeenCalledOnce();
  });

  it('getGraph returns the graph DTO when found', async () => {
    const graph = makeGraph();
    const repo = makeRepo({ findGraphById: vi.fn().mockResolvedValue(graph) });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.getGraph('g-1');
    expect(dto.label).toBe('Graph');
  });

  it('getGraph throws NotFoundError when missing', async () => {
    const repo = makeRepo({ findGraphById: vi.fn().mockResolvedValue(null) });
    const service = new KnowledgeApplicationService(repo);
    await expect(service.getGraph('g-1')).rejects.toThrow(NotFoundError);
  });

  it('listGraphs maps paginated graphs', async () => {
    const repo = makeRepo({
      findAllGraphs: vi.fn().mockResolvedValue({
        data: [makeGraph()],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
    });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.listGraphs({ page: 1, limit: 10 });
    expect(dto.graphs).toHaveLength(1);
    expect(dto.total).toBe(1);
    expect(dto.totalPages).toBe(1);
  });

  it('deleteGraph deletes when found', async () => {
    const repo = makeRepo({
      findGraphById: vi.fn().mockResolvedValue(makeGraph()),
      deleteGraph: vi.fn().mockResolvedValue(undefined),
    });
    const service = new KnowledgeApplicationService(repo);
    await service.deleteGraph('g-1');
    expect(repo.deleteGraph).toHaveBeenCalledOnce();
  });

  it('deleteGraph throws NotFoundError when missing', async () => {
    const repo = makeRepo({ findGraphById: vi.fn().mockResolvedValue(null) });
    const service = new KnowledgeApplicationService(repo);
    await expect(service.deleteGraph('g-1')).rejects.toThrow(NotFoundError);
  });
});

describe('KnowledgeApplicationService — Node Management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createNode creates, saves, and maps the node', async () => {
    const repo = makeRepo({
      findGraphById: vi.fn().mockResolvedValue(makeGraph()),
      saveNode: vi.fn().mockResolvedValue(undefined),
    });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.createNode({
      graphId: 'g-1',
      category: 'goal',
      label: 'Node 1',
      description: 'Desc',
    });
    expect(dto.label).toBe('Node 1');
    expect(repo.saveNode).toHaveBeenCalledOnce();
  });

  it('createNode throws NotFoundError when graph missing', async () => {
    const repo = makeRepo({ findGraphById: vi.fn().mockResolvedValue(null) });
    const service = new KnowledgeApplicationService(repo);
    await expect(
      service.createNode({ graphId: 'g-1', category: 'goal', label: 'X' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('createNode throws ValidationError on invalid category', async () => {
    const repo = makeRepo({ findGraphById: vi.fn().mockResolvedValue(makeGraph()) });
    const service = new KnowledgeApplicationService(repo);
    await expect(
      service.createNode({ graphId: 'g-1', category: 'not-a-category', label: 'X' }),
    ).rejects.toThrow(ValidationError);
  });

  it('getNode returns the node DTO when found', async () => {
    const repo = makeRepo({ findNodeById: vi.fn().mockResolvedValue(makeNode()) });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.getNode('n-1');
    expect(dto.id).toBe('n-1');
    expect(dto.label).toBe('Node 1');
  });

  it('getNode throws NotFoundError when missing', async () => {
    const repo = makeRepo({ findNodeById: vi.fn().mockResolvedValue(null) });
    const service = new KnowledgeApplicationService(repo);
    await expect(service.getNode('n-1')).rejects.toThrow(NotFoundError);
  });

  it('updateNode updates label+description and persists', async () => {
    const node = KnowledgeFactory.reconstructNode({
      id: 'n-1',
      graphId: 'g-1',
      category: 'knowledge',
      label: 'Node 1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(node),
      updateNode: vi.fn().mockResolvedValue(undefined),
    });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.updateNode('n-1', { label: 'Renamed', description: 'New' });
    expect(dto.label).toBe('Renamed');
    expect(repo.updateNode).toHaveBeenCalledOnce();
  });

  it('updateNode updates description-only, metadata, tags, and category', async () => {
    const node = KnowledgeFactory.reconstructNode({
      id: 'n-1',
      graphId: 'g-1',
      category: 'knowledge',
      label: 'Node 1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(node),
      updateNode: vi.fn().mockResolvedValue(undefined),
    });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.updateNode('n-1', {
      description: 'Only desc',
      metadata: { key: 'value' },
      tags: ['new-tag'],
      category: 'skill',
    });
    expect(dto.description).toBe('Only desc');
    expect(node.tags).toContain('new-tag');
    expect(node.category.value).toBe('skill');
  });

  it('updateNode throws NotFoundError when missing', async () => {
    const repo = makeRepo({ findNodeById: vi.fn().mockResolvedValue(null) });
    const service = new KnowledgeApplicationService(repo);
    await expect(service.updateNode('n-1', { label: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('deleteNode deletes the node and its edges', async () => {
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(makeNode()),
      findEdgesForNode: vi.fn().mockResolvedValue([makeEdge()]),
      deleteEdge: vi.fn().mockResolvedValue(undefined),
      deleteNode: vi.fn().mockResolvedValue(undefined),
    });
    const service = new KnowledgeApplicationService(repo);
    await service.deleteNode('n-1');
    expect(repo.deleteEdge).toHaveBeenCalledOnce();
    expect(repo.deleteNode).toHaveBeenCalledOnce();
  });

  it('deleteNode throws NotFoundError when missing', async () => {
    const repo = makeRepo({ findNodeById: vi.fn().mockResolvedValue(null) });
    const service = new KnowledgeApplicationService(repo);
    await expect(service.deleteNode('n-1')).rejects.toThrow(NotFoundError);
  });

  it('listNodesByGraph maps paginated nodes', async () => {
    const repo = makeRepo({
      findNodesByGraph: vi.fn().mockResolvedValue({
        data: [makeNode()],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
    });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.listNodesByGraph('g-1', { page: 1, limit: 10 });
    expect(dto.nodes).toHaveLength(1);
    expect(dto.total).toBe(1);
  });

  it('searchNodes maps paginated results', async () => {
    const repo = makeRepo({
      searchNodes: vi.fn().mockResolvedValue({
        data: [makeNode()],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
    });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.searchNodes('query', { page: 1, limit: 10 });
    expect(dto.nodes).toHaveLength(1);
  });
});

describe('KnowledgeApplicationService — Edge Management', () => {
  it('createEdge creates, saves, and maps the edge', async () => {
    const repo = makeRepo({ saveEdge: vi.fn().mockResolvedValue(undefined) });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.createEdge({
      graphId: 'g-1',
      sourceId: 'n-1',
      targetId: 'n-2',
      relationshipType: 'RELATED_TO',
      relationshipCategory: 'association',
    });
    expect(dto.sourceId).toBe('n-1');
    expect(repo.saveEdge).toHaveBeenCalledOnce();
  });

  it('getNodeEdges maps all edges for a node', async () => {
    const repo = makeRepo({
      findEdgesForNode: vi.fn().mockResolvedValue([makeEdge(), makeEdge('e-2')]),
    });
    const service = new KnowledgeApplicationService(repo);
    const dtos = await service.getNodeEdges('n-1');
    expect(dtos).toHaveLength(2);
  });

  it('deleteEdge deletes when found', async () => {
    const repo = makeRepo({
      findEdgeById: vi.fn().mockResolvedValue(makeEdge()),
      deleteEdge: vi.fn().mockResolvedValue(undefined),
    });
    const service = new KnowledgeApplicationService(repo);
    await service.deleteEdge('e-1');
    expect(repo.deleteEdge).toHaveBeenCalledOnce();
  });

  it('deleteEdge throws NotFoundError when missing', async () => {
    const repo = makeRepo({ findEdgeById: vi.fn().mockResolvedValue(null) });
    const service = new KnowledgeApplicationService(repo);
    await expect(service.deleteEdge('e-1')).rejects.toThrow(NotFoundError);
  });
});

describe('KnowledgeApplicationService — Traversal & Advanced', () => {
  it('traverse maps path steps', async () => {
    const node = KnowledgeFactory.reconstructNode({
      id: 'n-1',
      graphId: 'g-1',
      category: 'knowledge',
      label: 'Node 1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(node),
      findEdgesForNode: vi.fn().mockResolvedValue([]),
    });
    const service = new KnowledgeApplicationService(repo);
    const result = await service.traverse('n-1', 3);
    expect(result.path).toHaveLength(1);
    expect(result.depth).toBe(3);
  });

  it('findShortestPath returns null when no path exists', async () => {
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(makeNode()),
      findEdgesForNode: vi.fn().mockResolvedValue([]),
    });
    const service = new KnowledgeApplicationService(repo);
    expect(await service.findShortestPath('n-1', 'n-9')).toBeNull();
  });

  it('findRelatedKnowledge maps related nodes', async () => {
    const repo = makeRepo({
      findNodeById: vi
        .fn()
        .mockImplementation(async (id: unknown) =>
          String(id) === 'n-1' ? makeNode() : makeNode('n-2', 'Node 2'),
        ),
      findEdgesForNode: vi.fn().mockResolvedValue([makeEdge()]),
    });
    const service = new KnowledgeApplicationService(repo);
    const result = await service.findRelatedKnowledge('n-1');
    expect(result.nodes).toHaveLength(1);
    expect(result.relevance).toBe(1);
  });

  it('analyzeImpact maps affected nodes/edges', async () => {
    const repo = makeRepo({
      findEdgesForNode: vi.fn().mockResolvedValue([makeEdge(), makeEdge('e-2')]),
      findNodeById: vi.fn().mockResolvedValue(makeNode('n-2', 'Node 2')),
    });
    const service = new KnowledgeApplicationService(repo);
    const result = await service.analyzeImpact('n-1');
    expect(result.affectedEdges).toHaveLength(2);
    expect(result.impactLevel).toBe('low');
    expect(result.description).toContain('2 relationships');
  });

  it('detectCycles returns no cycles for acyclic graphs', async () => {
    const repo = makeRepo({
      findNodesByGraph: vi.fn().mockResolvedValue({ data: [makeNode()], total: 1 }),
      findEdgesForNode: vi.fn().mockResolvedValue([]),
    });
    const service = new KnowledgeApplicationService(repo);
    const result = await service.detectCycles('g-1');
    expect(result.hasCycle).toBe(false);
    expect(result.cycles).toEqual([]);
  });

  it('getGraphStatistics returns computed stats', async () => {
    const repo = makeRepo({
      countNodes: vi.fn().mockResolvedValue(5),
      countEdges: vi.fn().mockResolvedValue(4),
      countNodesByCategory: vi.fn().mockResolvedValue({ goal: 5 }),
    });
    const service = new KnowledgeApplicationService(repo);
    const stats = await service.getGraphStatistics('g-1');
    expect(stats.nodeCount).toBe(5);
    expect(stats.edgeCount).toBe(4);
    expect(stats.categoryDistribution).toEqual({ goal: 5 });
    expect(stats.averageConnectivity).toBe((2 * 4) / 5);
  });

  it('mergeNodes merges into the target node', async () => {
    const target = KnowledgeFactory.reconstructNode({
      id: 'n-2',
      graphId: 'g-1',
      category: 'knowledge',
      label: 'Target',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(target),
      findEdgesForNode: vi.fn().mockResolvedValue([]),
      updateNode: vi.fn().mockResolvedValue(undefined),
      deleteNode: vi.fn().mockResolvedValue(undefined),
    });
    const service = new KnowledgeApplicationService(repo);
    const dto = await service.mergeNodes({
      sourceId: 'n-1',
      targetId: 'n-2',
      mergedLabel: 'Merged',
      mergedDescription: 'Merged desc',
    });
    expect(dto.label).toBe('Merged');
    expect(repo.updateNode).toHaveBeenCalledOnce();
  });

  it('mergeNodes throws NotFoundError when target missing', async () => {
    const repo = makeRepo({ findNodeById: vi.fn().mockResolvedValue(null) });
    const service = new KnowledgeApplicationService(repo);
    await expect(
      service.mergeNodes({ sourceId: 'n-1', targetId: 'n-2', mergedLabel: 'X' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('splitNode creates two nodes and deletes the original', async () => {
    const original = KnowledgeFactory.reconstructNode({
      id: 'n-1',
      graphId: 'g-1',
      category: 'knowledge',
      label: 'Original',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const repo = makeRepo({
      findNodeById: vi.fn().mockResolvedValue(original),
      saveNode: vi.fn().mockResolvedValue(undefined),
      deleteNode: vi.fn().mockResolvedValue(undefined),
    });
    const service = new KnowledgeApplicationService(repo);
    const result = await service.splitNode({
      nodeId: 'n-1',
      firstLabel: 'First',
      firstDescription: 'A',
      secondLabel: 'Second',
      secondDescription: 'B',
    });
    expect(result.first.label).toBe('First');
    expect(result.second.label).toBe('Second');
    expect(repo.saveNode).toHaveBeenCalledTimes(2);
    expect(repo.deleteNode).toHaveBeenCalledOnce();
  });

  it('splitNode throws NotFoundError when original missing', async () => {
    const repo = makeRepo({ findNodeById: vi.fn().mockResolvedValue(null) });
    const service = new KnowledgeApplicationService(repo);
    await expect(
      service.splitNode({ nodeId: 'n-1', firstLabel: 'A', secondLabel: 'B' }),
    ).rejects.toThrow(NotFoundError);
  });
});
