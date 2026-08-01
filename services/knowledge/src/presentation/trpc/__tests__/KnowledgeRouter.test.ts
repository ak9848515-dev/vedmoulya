// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge tRPC Router Tests
// Exercises every procedure through a tRPC caller with a mocked service.
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createKnowledgeTrpcRouter } from '../KnowledgeRouter.js';
import type { KnowledgeApplicationService } from '@vedmoulya/services';
import { NotFoundError, ConflictError, ValidationError } from '@vedmoulya/core';

function makeService(): KnowledgeApplicationService {
  const fn = () => vi.fn().mockResolvedValue({ id: 'graph_1' });
  return {
    createGraph: fn(),
    getGraph: fn(),
    listGraphs: fn(),
    deleteGraph: fn(),
    createNode: fn(),
    getNode: fn(),
    updateNode: fn(),
    deleteNode: fn(),
    listNodesByGraph: fn(),
    createEdge: fn(),
    getNodeEdges: fn(),
    deleteEdge: fn(),
    traverse: fn(),
    findShortestPath: fn(),
    findRelatedKnowledge: fn(),
    analyzeImpact: fn(),
    detectCycles: fn(),
    getGraphStatistics: fn(),
    mergeNodes: fn(),
    splitNode: fn(),
    searchNodes: fn(),
  } as unknown as KnowledgeApplicationService;
}

type Caller = {
  createGraph: (input: unknown) => Promise<{ success: boolean; data: unknown }>;
  getGraph: (input: string) => Promise<{ success: boolean; data: unknown }>;
  listGraphs: (input: {
    page?: number;
    limit?: number;
  }) => Promise<{ success: boolean; data: unknown }>;
  deleteGraph: (input: string) => Promise<{ success: boolean; data: unknown }>;
  createNode: (input: unknown) => Promise<{ success: boolean; data: unknown }>;
  getNode: (input: string) => Promise<{ success: boolean; data: unknown }>;
  updateNode: (input: {
    id: string;
    data: unknown;
  }) => Promise<{ success: boolean; data: unknown }>;
  deleteNode: (input: string) => Promise<{ success: boolean; data: unknown }>;
  listNodesByGraph: (input: {
    graphId: string;
    pagination: unknown;
  }) => Promise<{ success: boolean; data: unknown }>;
  createEdge: (input: unknown) => Promise<{ success: boolean; data: unknown }>;
  getNodeEdges: (input: string) => Promise<{ success: boolean; data: unknown }>;
  deleteEdge: (input: string) => Promise<{ success: boolean; data: unknown }>;
  traverse: (input: {
    nodeId: string;
    maxDepth?: number;
  }) => Promise<{ success: boolean; data: unknown }>;
  findShortestPath: (input: {
    startNodeId: string;
    endNodeId: string;
  }) => Promise<{ success: boolean; data: unknown }>;
  findRelatedKnowledge: (input: string) => Promise<{ success: boolean; data: unknown }>;
  analyzeImpact: (input: string) => Promise<{ success: boolean; data: unknown }>;
  detectCycles: (input: string) => Promise<{ success: boolean; data: unknown }>;
  getGraphStatistics: (input: string) => Promise<{ success: boolean; data: unknown }>;
  mergeNodes: (input: unknown) => Promise<{ success: boolean; data: unknown }>;
  splitNode: (input: unknown) => Promise<{ success: boolean; data: unknown }>;
  searchNodes: (input: unknown) => Promise<{ success: boolean; data: unknown }>;
};

describe('createKnowledgeTrpcRouter', () => {
  let service: KnowledgeApplicationService;
  let caller: Caller;

  beforeEach(() => {
    service = makeService();
    const router = createKnowledgeTrpcRouter(service) as { createCaller: (ctx: object) => Caller };
    caller = router.createCaller({});
  });

  it('createGraph calls the service', async () => {
    await caller.createGraph({ label: 'Graph' });

    expect(service.createGraph).toHaveBeenCalledWith({ label: 'Graph' });
  });

  it('getGraph calls the service with the id', async () => {
    await caller.getGraph('graph_1');

    expect(service.getGraph).toHaveBeenCalledWith('graph_1');
  });

  it('listGraphs defaults pagination', async () => {
    await caller.listGraphs({});

    expect(service.listGraphs).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('deleteGraph calls the service', async () => {
    await caller.deleteGraph('graph_1');

    expect(service.deleteGraph).toHaveBeenCalledWith('graph_1');
  });

  it('createNode calls the service', async () => {
    await caller.createNode({ graphId: 'g1', category: 'goal', label: 'N' });

    expect(service.createNode).toHaveBeenCalledWith({
      graphId: 'g1',
      category: 'goal',
      label: 'N',
    });
  });

  it('getNode calls the service', async () => {
    await caller.getNode('node_1');

    expect(service.getNode).toHaveBeenCalledWith('node_1');
  });

  it('updateNode forwards id and data', async () => {
    await caller.updateNode({ id: 'node_1', data: { label: 'Updated' } });

    expect(service.updateNode).toHaveBeenCalledWith('node_1', { label: 'Updated' });
  });

  it('deleteNode calls the service', async () => {
    await caller.deleteNode('node_1');

    expect(service.deleteNode).toHaveBeenCalledWith('node_1');
  });

  it('listNodesByGraph forwards graphId and pagination', async () => {
    await caller.listNodesByGraph({ graphId: 'graph_1', pagination: {} });

    expect(service.listNodesByGraph).toHaveBeenCalledWith('graph_1', { page: 1, limit: 20 });
  });

  it('createEdge calls the service', async () => {
    await caller.createEdge({
      graphId: 'g1',
      sourceId: 'n1',
      targetId: 'n2',
      relationshipType: 'supports',
      relationshipCategory: 'dependency',
    });

    expect(service.createEdge).toHaveBeenCalled();
  });

  it('getNodeEdges calls the service', async () => {
    await caller.getNodeEdges('node_1');

    expect(service.getNodeEdges).toHaveBeenCalledWith('node_1');
  });

  it('deleteEdge calls the service', async () => {
    await caller.deleteEdge('edge_1');

    expect(service.deleteEdge).toHaveBeenCalledWith('edge_1');
  });

  it('traverse forwards nodeId and maxDepth', async () => {
    await caller.traverse({ nodeId: 'node_1', maxDepth: 3 });

    expect(service.traverse).toHaveBeenCalledWith('node_1', 3);
  });

  it('findShortestPath forwards both node ids', async () => {
    await caller.findShortestPath({ startNodeId: 'node_1', endNodeId: 'node_2' });

    expect(service.findShortestPath).toHaveBeenCalledWith('node_1', 'node_2');
  });

  it('findRelatedKnowledge, analyzeImpact, detectCycles, and getGraphStatistics forward ids', async () => {
    await caller.findRelatedKnowledge('node_1');
    await caller.analyzeImpact('node_1');
    await caller.detectCycles('graph_1');
    await caller.getGraphStatistics('graph_1');

    expect(service.findRelatedKnowledge).toHaveBeenCalledWith('node_1');
    expect(service.analyzeImpact).toHaveBeenCalledWith('node_1');
    expect(service.detectCycles).toHaveBeenCalledWith('graph_1');
    expect(service.getGraphStatistics).toHaveBeenCalledWith('graph_1');
  });

  it('mergeNodes and splitNode forward their input', async () => {
    await caller.mergeNodes({ sourceId: 'n1', targetId: 'n2', mergedLabel: 'M' });
    await caller.splitNode({
      nodeId: 'n1',
      firstLabel: 'A',
      secondLabel: 'B',
      edgesForFirst: [],
      edgesForSecond: [],
    });

    expect(service.mergeNodes).toHaveBeenCalledWith({
      sourceId: 'n1',
      targetId: 'n2',
      mergedLabel: 'M',
    });
    expect(service.splitNode).toHaveBeenCalled();
  });

  it('searchNodes forwards the query and pagination', async () => {
    await caller.searchNodes({ q: 'launch', page: 1, limit: 10 });

    expect(service.searchNodes).toHaveBeenCalledWith('launch', { page: 1, limit: 10 });
  });

  // ── Error mapping ───────────────────────────────────────────────────────

  describe('error mapping', () => {
    const procedures = [
      ['createGraph', 'createGraph', { label: 'G' }],
      ['getGraph', 'getGraph', 'graph_1'],
      ['listGraphs', 'listGraphs', {}],
      ['deleteGraph', 'deleteGraph', 'graph_1'],
      ['createNode', 'createNode', { graphId: 'g1', category: 'goal', label: 'N' }],
      ['getNode', 'getNode', 'node_1'],
      ['updateNode', 'updateNode', { id: 'node_1', data: { label: 'X' } }],
      ['deleteNode', 'deleteNode', 'node_1'],
      ['listNodesByGraph', 'listNodesByGraph', { graphId: 'graph_1', pagination: {} }],
      [
        'createEdge',
        'createEdge',
        {
          graphId: 'g1',
          sourceId: 'n1',
          targetId: 'n2',
          relationshipType: 'supports',
          relationshipCategory: 'dependency',
        },
      ],
      ['getNodeEdges', 'getNodeEdges', 'node_1'],
      ['deleteEdge', 'deleteEdge', 'edge_1'],
      ['traverse', 'traverse', { nodeId: 'node_1', maxDepth: 3 }],
      ['findShortestPath', 'findShortestPath', { startNodeId: 'node_1', endNodeId: 'node_2' }],
      ['findRelatedKnowledge', 'findRelatedKnowledge', 'node_1'],
      ['analyzeImpact', 'analyzeImpact', 'node_1'],
      ['detectCycles', 'detectCycles', 'graph_1'],
      ['getGraphStatistics', 'getGraphStatistics', 'graph_1'],
      ['mergeNodes', 'mergeNodes', { sourceId: 'n1', targetId: 'n2', mergedLabel: 'M' }],
      [
        'splitNode',
        'splitNode',
        {
          nodeId: 'n1',
          firstLabel: 'A',
          secondLabel: 'B',
          edgesForFirst: [],
          edgesForSecond: [],
        },
      ],
      ['searchNodes', 'searchNodes', { q: 'launch', page: 1, limit: 10 }],
    ] as const;

    const errorTypes = [
      ['NotFoundError', 'NOT_FOUND', () => new NotFoundError('Graph', 'graph_1')],
      ['ConflictError', 'CONFLICT', () => new ConflictError('conflict')],
      ['ValidationError', 'BAD_REQUEST', () => new ValidationError('invalid')],
      ['Error', 'INTERNAL_SERVER_ERROR', () => new Error('boom')],
      ['unknown', 'INTERNAL_SERVER_ERROR', () => 'oops'],
    ] as const;

    const invoke = (handler: string, input: unknown): Promise<unknown> =>
      (caller as unknown as Record<string, (input: unknown) => Promise<unknown>>)[handler](input);

    for (const [errorName, code, makeError] of errorTypes) {
      it.each(procedures)(`%s maps a ${errorName} to ${code}`, async (handler, method, input) => {
        const fn = service[method as keyof KnowledgeApplicationService] as unknown as ReturnType<
          typeof vi.fn
        >;
        fn.mockRejectedValue(makeError());

        await expect(invoke(handler, input)).rejects.toMatchObject({ code });
      });
    }
  });
});
