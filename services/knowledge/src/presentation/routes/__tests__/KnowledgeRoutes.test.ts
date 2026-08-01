// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Routes Tests
// Exercises the Hono router end-to-end with a mocked KnowledgeApplicationService.
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createKnowledgeRouter, knowledgeRouteConfig } from '../KnowledgeRoutes.js';
import type { KnowledgeApplicationService } from '@vedmoulya/services';

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

describe('createKnowledgeRouter', () => {
  let app: Hono;
  let service: KnowledgeApplicationService;

  beforeEach(() => {
    service = makeService();
    app = createKnowledgeRouter(service);
  });

  it('creates a graph via POST /graphs', async () => {
    const res = await app.request('/graphs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Graph' }),
    });

    expect(res.status).toBe(201);
    expect(service.createGraph).toHaveBeenCalledWith({ label: 'Graph' });
  });

  it('lists graphs via GET /graphs', async () => {
    const res = await app.request('/graphs');

    expect(res.status).toBe(200);
    expect(service.listGraphs).toHaveBeenCalled();
  });

  it('gets a graph via GET /graphs/:id', async () => {
    const res = await app.request('/graphs/graph_1');

    expect(res.status).toBe(200);
    expect(service.getGraph).toHaveBeenCalledWith('graph_1');
  });

  it('deletes a graph via DELETE /graphs/:id', async () => {
    const res = await app.request('/graphs/graph_1', { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(service.deleteGraph).toHaveBeenCalledWith('graph_1');
  });

  it('detects cycles via GET /graphs/:id/cycles', async () => {
    const res = await app.request('/graphs/graph_1/cycles');

    expect(res.status).toBe(200);
    expect(service.detectCycles).toHaveBeenCalledWith('graph_1');
  });

  it('gets statistics via GET /graphs/:id/statistics', async () => {
    const res = await app.request('/graphs/graph_1/statistics');

    expect(res.status).toBe(200);
    expect(service.getGraphStatistics).toHaveBeenCalledWith('graph_1');
  });

  it('lists nodes via GET /graphs/:graphId/nodes', async () => {
    const res = await app.request('/graphs/graph_1/nodes');

    expect(res.status).toBe(200);
    expect(service.listNodesByGraph).toHaveBeenCalled();
  });

  it('creates a node via POST /nodes', async () => {
    const res = await app.request('/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphId: 'g1', category: 'goal', label: 'N' }),
    });

    expect(res.status).toBe(201);
    expect(service.createNode).toHaveBeenCalled();
  });

  it('gets a node via GET /nodes/:id', async () => {
    const res = await app.request('/nodes/node_1');

    expect(res.status).toBe(200);
    expect(service.getNode).toHaveBeenCalledWith('node_1');
  });

  it('updates a node via PATCH /nodes/:id', async () => {
    const res = await app.request('/nodes/node_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Updated' }),
    });

    expect(res.status).toBe(200);
    expect(service.updateNode).toHaveBeenCalledWith('node_1', { label: 'Updated' });
  });

  it('deletes a node via DELETE /nodes/:id', async () => {
    const res = await app.request('/nodes/node_1', { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(service.deleteNode).toHaveBeenCalledWith('node_1');
  });

  it('merges nodes via POST /nodes/merge', async () => {
    const res = await app.request('/nodes/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: 'n1', targetId: 'n2', mergedLabel: 'M' }),
    });

    expect(res.status).toBe(200);
    expect(service.mergeNodes).toHaveBeenCalled();
  });

  it('splits a node via POST /nodes/split', async () => {
    const res = await app.request('/nodes/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: 'n1',
        firstLabel: 'A',
        secondLabel: 'B',
        edgesForFirst: [],
        edgesForSecond: [],
      }),
    });

    expect(res.status).toBe(200);
    expect(service.splitNode).toHaveBeenCalled();
  });

  it('traverses via GET /nodes/:id/traverse', async () => {
    const res = await app.request('/nodes/node_1/traverse?maxDepth=3');

    expect(res.status).toBe(200);
    expect(service.traverse).toHaveBeenCalledWith('node_1', 3);
  });

  it('finds the shortest path via GET /nodes/:id/shortest-path', async () => {
    const res = await app.request('/nodes/node_1/shortest-path?endNodeId=node_2');

    expect(res.status).toBe(200);
    expect(service.findShortestPath).toHaveBeenCalledWith('node_1', 'node_2');
  });

  it('gets related knowledge via GET /nodes/:id/related', async () => {
    const res = await app.request('/nodes/node_1/related');

    expect(res.status).toBe(200);
    expect(service.findRelatedKnowledge).toHaveBeenCalledWith('node_1');
  });

  it('analyzes impact via GET /nodes/:id/impact', async () => {
    const res = await app.request('/nodes/node_1/impact');

    expect(res.status).toBe(200);
    expect(service.analyzeImpact).toHaveBeenCalledWith('node_1');
  });

  it('gets node edges via GET /nodes/:id/edges', async () => {
    const res = await app.request('/nodes/node_1/edges');

    expect(res.status).toBe(200);
    expect(service.getNodeEdges).toHaveBeenCalledWith('node_1');
  });

  it('creates an edge via POST /edges', async () => {
    const res = await app.request('/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId: 'g1',
        sourceId: 'n1',
        targetId: 'n2',
        relationshipType: 'supports',
        relationshipCategory: 'dependency',
      }),
    });

    expect(res.status).toBe(201);
    expect(service.createEdge).toHaveBeenCalled();
  });

  it('deletes an edge via DELETE /edges/:id', async () => {
    const res = await app.request('/edges/edge_1', { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(service.deleteEdge).toHaveBeenCalledWith('edge_1');
  });

  it('searches via GET /search', async () => {
    const res = await app.request('/search?q=launch');

    expect(res.status).toBe(200);
    expect(service.searchNodes).toHaveBeenCalledWith('launch', { page: 1, limit: 20 });
  });

  it('reports healthy via GET /health', async () => {
    const res = await app.request('/health');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'healthy', service: 'knowledge' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/nope');

    expect(res.status).toBe(404);
  });
});

describe('knowledgeRouteConfig', () => {
  it('declares the base path and tags', () => {
    expect(knowledgeRouteConfig.basePath).toBe('/api/v1/knowledge');
    expect(knowledgeRouteConfig.tags).toContain('Knowledge Graph');
  });
});
