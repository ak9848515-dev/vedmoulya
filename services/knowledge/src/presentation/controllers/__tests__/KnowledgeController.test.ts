// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Controller Tests
// Covers every HTTP handler: success, validation-error (400), thrown-error paths.
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from 'hono';
import { KnowledgeController } from '../KnowledgeController.js';
import type { KnowledgeApplicationService } from '@vedmoulya/services';

type MockCtx = {
  req: {
    json: ReturnType<typeof vi.fn>;
    param: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  json: ReturnType<typeof vi.fn>;
};

function makeContext(body: unknown = {}, params: Record<string, string> = {}): MockCtx {
  const param = vi.fn((key: string) => params[key] ?? 'graph_1');
  return {
    req: {
      json: vi.fn().mockResolvedValue(body),
      param,
      query: vi.fn().mockReturnValue({}),
    },
    json: vi.fn(),
  };
}

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

function expectError(c: MockCtx, code: string, status: number): void {
  expect(c.json).toHaveBeenCalledTimes(1);
  const [body, statusCode] = c.json.mock.calls[0] as [Record<string, unknown>, number];
  expect(statusCode).toBe(status);
  expect(body).toMatchObject({ success: false, error: { code } });
}

describe('KnowledgeController', () => {
  let service: KnowledgeApplicationService;
  let controller: KnowledgeController;

  beforeEach(() => {
    service = makeService();
    controller = new KnowledgeController(service);
  });

  describe('createGraph', () => {
    it('returns 201 on success', async () => {
      const c = makeContext({ label: 'Graph' });

      await controller.createGraph(c as unknown as Context);

      expect(service.createGraph).toHaveBeenCalledWith({ label: 'Graph' });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'graph_1' } }, 201);
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ label: '' });

      await controller.createGraph(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('getGraph', () => {
    it('returns the graph on success', async () => {
      const c = makeContext();

      await controller.getGraph(c as unknown as Context);

      expect(service.getGraph).toHaveBeenCalledWith('graph_1');
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'graph_1' } });
    });
  });

  describe('listGraphs', () => {
    it('passes page and limit from the query', async () => {
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({ page: '2', limit: '5' });

      await controller.listGraphs(c as unknown as Context);

      expect(service.listGraphs).toHaveBeenCalledWith({ page: 2, limit: 5 });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'graph_1' } });
    });

    it('defaults page and limit for an empty query', async () => {
      const c = makeContext();

      await controller.listGraphs(c as unknown as Context);

      expect(service.listGraphs).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });
  });

  describe('deleteGraph', () => {
    it('returns a confirmation message', async () => {
      const c = makeContext();

      await controller.deleteGraph(c as unknown as Context);

      expect(service.deleteGraph).toHaveBeenCalledWith('graph_1');
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { message: 'Graph deleted' } });
    });
  });

  describe('createNode', () => {
    it('returns 201 on success', async () => {
      const c = makeContext({ graphId: 'graph_1', category: 'goal', label: 'Node' });

      await controller.createNode(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'graph_1' } }, 201);
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ graphId: 'graph_1', category: 'bad', label: 'Node' });

      await controller.createNode(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('updateNode', () => {
    it('updates and returns the node', async () => {
      const c = makeContext({ label: 'New' });

      await controller.updateNode(c as unknown as Context);

      expect(service.updateNode).toHaveBeenCalledWith('graph_1', { label: 'New' });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'graph_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ category: 'bad' });

      await controller.updateNode(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('deleteNode', () => {
    it('deletes the node', async () => {
      const c = makeContext();

      await controller.deleteNode(c as unknown as Context);

      expect(service.deleteNode).toHaveBeenCalledWith('graph_1');
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { message: 'Node deleted' } });
    });
  });

  describe('listNodesByGraph', () => {
    it('passes graphId and pagination', async () => {
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({ page: '1', limit: '10' });

      await controller.listNodesByGraph(c as unknown as Context);

      expect(service.listNodesByGraph).toHaveBeenCalledWith('graph_1', { page: 1, limit: 10 });
    });
  });

  describe('createEdge', () => {
    it('returns 201 on success', async () => {
      const c = makeContext({
        graphId: 'graph_1',
        sourceId: 'n1',
        targetId: 'n2',
        relationshipType: 'supports',
        relationshipCategory: 'dependency',
      });

      await controller.createEdge(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'graph_1' } }, 201);
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ relationshipCategory: 'bad' });

      await controller.createEdge(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('getNodeEdges and deleteEdge', () => {
    it('lists edges for a node', async () => {
      const c = makeContext();

      await controller.getNodeEdges(c as unknown as Context);

      expect(service.getNodeEdges).toHaveBeenCalledWith('graph_1');
    });

    it('deletes an edge', async () => {
      const c = makeContext();

      await controller.deleteEdge(c as unknown as Context);

      expect(service.deleteEdge).toHaveBeenCalledWith('graph_1');
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { message: 'Edge deleted' } });
    });
  });

  describe('traverse', () => {
    it('passes maxDepth from the query', async () => {
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({ maxDepth: '3' });

      await controller.traverse(c as unknown as Context);

      expect(service.traverse).toHaveBeenCalledWith('graph_1', 3);
    });

    it('defaults maxDepth when absent', async () => {
      const c = makeContext();

      await controller.traverse(c as unknown as Context);

      expect(service.traverse).toHaveBeenCalledWith('graph_1', 5);
    });
  });

  describe('shortestPath', () => {
    it('passes the end node id from the query', async () => {
      const c = makeContext();
      // The controller calls c.req.query('endNodeId') with a key argument.
      (c.req.query as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'endNodeId' ? 'n9' : undefined,
      );

      await controller.shortestPath(c as unknown as Context);

      expect(service.findShortestPath).toHaveBeenCalledWith('graph_1', 'n9');
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'graph_1' } });
    });

    it('returns 400 when endNodeId is missing', async () => {
      const c = makeContext();
      // The controller calls c.req.query('endNodeId') with a key — return undefined.
      (c.req.query as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);

      await controller.shortestPath(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('analysis handlers', () => {
    it.each([
      ['relatedKnowledge', 'findRelatedKnowledge'],
      ['analyzeImpact', 'analyzeImpact'],
      ['detectCycles', 'detectCycles'],
      ['graphStatistics', 'getGraphStatistics'],
    ] as const)('%s calls the service', async (handler, method) => {
      const c = makeContext();

      await (controller as unknown as Record<string, (ctx: Context) => Promise<Response>>)[handler](
        c as unknown as Context,
      );

      expect(service[method as keyof KnowledgeApplicationService]).toHaveBeenCalledWith('graph_1');
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'graph_1' } });
    });
  });

  describe('mergeNodes and splitNode', () => {
    it('merges nodes with a 200 response', async () => {
      const c = makeContext({ sourceId: 'n1', targetId: 'n2', mergedLabel: 'M' });

      await controller.mergeNodes(c as unknown as Context);

      expect(service.mergeNodes).toHaveBeenCalledWith({
        sourceId: 'n1',
        targetId: 'n2',
        mergedLabel: 'M',
      });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'graph_1' } });
    });

    it('returns 400 on merge validation failure', async () => {
      const c = makeContext({ sourceId: 'n1' });

      await controller.mergeNodes(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });

    it('splits a node', async () => {
      const c = makeContext({
        nodeId: 'n1',
        firstLabel: 'A',
        secondLabel: 'B',
        edgesForFirst: [],
        edgesForSecond: [],
      });

      await controller.splitNode(c as unknown as Context);

      expect(service.splitNode).toHaveBeenCalled();
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'graph_1' } });
    });

    it('returns 400 on split validation failure', async () => {
      const c = makeContext({ nodeId: 'n1' });

      await controller.splitNode(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('search', () => {
    it('passes the query and pagination', async () => {
      (service.searchNodes as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], total: 0 });
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({
        q: 'launch',
        page: '1',
        limit: '10',
      });

      await controller.search(c as unknown as Context);

      expect(service.searchNodes).toHaveBeenCalledWith('launch', { page: 1, limit: 10 });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { items: [], total: 0 } });
    });

    it('returns 400 when q is missing', async () => {
      const c = makeContext();

      await controller.search(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('health', () => {
    it('reports healthy', () => {
      const c = makeContext();

      controller.health(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ status: 'healthy', service: 'knowledge' });
    });
  });

  describe('thrown service errors map to INTERNAL_ERROR 500 for every handler', () => {
    it.each([
      ['createGraph', 'createGraph', { label: 'G' }],
      ['getGraph', 'getGraph', {}],
      ['listGraphs', 'listGraphs', {}],
      ['deleteGraph', 'deleteGraph', {}],
      ['createNode', 'createNode', { graphId: 'g1', category: 'goal', label: 'N' }],
      ['getNode', 'getNode', {}],
      ['updateNode', 'updateNode', { label: 'X' }],
      ['deleteNode', 'deleteNode', {}],
      ['listNodesByGraph', 'listNodesByGraph', {}],
      [
        'createEdge',
        'createEdge',
        {
          graphId: 'g1',
          sourceId: 'n1',
          targetId: 'n2',
          relationshipType: 'x',
          relationshipCategory: 'dependency',
        },
      ],
      ['getNodeEdges', 'getNodeEdges', {}],
      ['deleteEdge', 'deleteEdge', {}],
      ['traverse', 'traverse', {}],
      ['shortestPath', 'findShortestPath', {}],
      ['relatedKnowledge', 'findRelatedKnowledge', {}],
      ['analyzeImpact', 'analyzeImpact', {}],
      ['detectCycles', 'detectCycles', {}],
      ['graphStatistics', 'getGraphStatistics', {}],
      ['mergeNodes', 'mergeNodes', { sourceId: 'n1', targetId: 'n2', mergedLabel: 'M' }],
      [
        'splitNode',
        'splitNode',
        { nodeId: 'n1', firstLabel: 'A', secondLabel: 'B', edgesForFirst: [], edgesForSecond: [] },
      ],
      ['search', 'searchNodes', {}],
    ] as const)('%s -> INTERNAL_ERROR 500', async (handler, method, body) => {
      (
        service[method as keyof KnowledgeApplicationService] as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error('boom'));
      const c = makeContext(body);
      if (handler === 'listGraphs' || handler === 'listNodesByGraph' || handler === 'traverse') {
        (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({});
      }
      if (handler === 'search') {
        // searchQuery requires q — without it the handler short-circuits to 400.
        (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({ q: 'launch' });
      }

      await (controller as unknown as Record<string, (ctx: Context) => Promise<Response>>)[handler](
        c as unknown as Context,
      );

      expectError(c, 'INTERNAL_ERROR', 500);
    });
  });
});
