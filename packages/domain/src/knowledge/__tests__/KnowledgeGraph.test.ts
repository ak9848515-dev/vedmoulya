// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Graph Aggregate + Service Tests
// Covers the KnowledgeGraph aggregate root and KnowledgeGraphService
// domain service (graph traversal, search, impact, cycles, stats).
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { KnowledgeGraph } from '../aggregates/KnowledgeGraph.js';
import { KnowledgeGraphService } from '../services/KnowledgeGraphService.js';
import { KnowledgeNode } from '../entities/KnowledgeNode.js';
import { KnowledgeEdge } from '../entities/KnowledgeEdge.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import { RelationshipType } from '../value-objects/RelationshipType.js';
import { KnowledgeSource } from '../value-objects/KnowledgeSource.js';
import { createKnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import { createKnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import { createGraphId } from '../value-objects/GraphId.js';
import type { KnowledgeRepository } from '../repository/KnowledgeRepository.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { KnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import type { GraphId } from '../value-objects/GraphId.js';
import type { PaginatedResult } from '@vedmoulya/core';

const graphId = createGraphId('g1');
const nid = (n: number): KnowledgeNodeId => createKnowledgeNodeId(`node-${String(n)}`);
const eid = (n: number): KnowledgeEdgeId => createKnowledgeEdgeId(`edge-${String(n)}`);

function makeNode(n: number): KnowledgeNode {
  return KnowledgeNode.create({
    id: nid(n),
    graphId,
    category: KnowledgeCategory.skill(),
    label: `Node ${String(n)}`,
    source: KnowledgeSource.userInput('test'),
  });
}

function makeEdge(source: number, target: number): KnowledgeEdge {
  return KnowledgeEdge.create({
    id: eid(Number(`${source}${target}`)),
    graphId,
    sourceId: nid(source),
    targetId: nid(target),
    type: RelationshipType.DEPENDS_ON(),
  });
}

describe('KnowledgeGraph aggregate', () => {
  it('creates an empty graph with defaults', () => {
    const graph = new KnowledgeGraph({ graphId, label: 'My Graph' });
    expect(graph.graphId).toBe(graphId);
    expect(graph.label).toBe('My Graph');
    expect(graph.description).toBe('');
    expect(graph.status.isActive).toBe(true);
    expect(graph.nodeCount).toBe(0);
    expect(graph.edgeCount).toBe(0);
    expect(graph.metadata).toEqual({});
    expect(graph.createdAt).toBeInstanceOf(Date);
    expect(graph.updatedAt).toBeInstanceOf(Date);
  });

  it('static create generates an id and emits a created event', () => {
    const graph = KnowledgeGraph.create({ label: 'Fresh' });
    expect(graph.label).toBe('Fresh');
    expect(graph.graphId).toBeTruthy();
    const events = graph.pullEvents();
    expect(events.some((e) => e.type === 'knowledge.graph.created')).toBe(true);
  });

  it('adds, finds, and checks nodes', () => {
    const graph = new KnowledgeGraph({ graphId, label: 'G' });
    const node = makeNode(1);
    graph.addNode(node);
    expect(graph.nodeCount).toBe(1);
    expect(graph.hasNode(nid(1))).toBe(true);
    expect(graph.getNode(nid(1))).toBe(node);
    expect(graph.getNode(nid(2))).toBeUndefined();
    expect(graph.getNodes()).toHaveLength(1);
    expect(() => graph.addNode(makeNode(1))).toThrow(/already exists/);
  });

  it('removes a node and its connected edges', () => {
    const graph = new KnowledgeGraph({ graphId, label: 'G' });
    graph.addNode(makeNode(1));
    graph.addNode(makeNode(2));
    graph.addNode(makeNode(3));
    graph.addEdge(makeEdge(1, 2));
    graph.addEdge(makeEdge(2, 3));

    graph.removeNode(nid(2));
    expect(graph.hasNode(nid(2))).toBe(false);
    expect(graph.edgeCount).toBe(0);
    expect(() => graph.removeNode(nid(9))).toThrow(/not found/);
  });

  it('adds edges with validation and emits events', () => {
    const graph = new KnowledgeGraph({ graphId, label: 'G' });
    graph.addNode(makeNode(1));
    graph.addNode(makeNode(2));
    const edge = makeEdge(1, 2);
    graph.addEdge(edge);
    expect(graph.edgeCount).toBe(1);
    expect(graph.getEdge(edge.id)).toBe(edge);
    expect(graph.hasEdge(edge.id)).toBe(true);
    expect(() => graph.addEdge(makeEdge(1, 2))).toThrow(/already exists/);
    expect(() => graph.addEdge(makeEdge(3, 1))).toThrow(/Source node not found/);
    expect(() => graph.addEdge(makeEdge(1, 3))).toThrow(/Target node not found/);
  });

  it('removes edges', () => {
    const graph = new KnowledgeGraph({ graphId, label: 'G' });
    graph.addNode(makeNode(1));
    graph.addNode(makeNode(2));
    graph.addEdge(makeEdge(1, 2));
    graph.removeEdge(eid(12));
    expect(graph.edgeCount).toBe(0);
    expect(() => graph.removeEdge(eid(99))).toThrow(/not found/);
  });

  it('detects relationships with and without a type filter', () => {
    const graph = new KnowledgeGraph({ graphId, label: 'G' });
    graph.addNode(makeNode(1));
    graph.addNode(makeNode(2));
    graph.addEdge(makeEdge(1, 2));

    expect(graph.hasRelationship(nid(1), nid(2))).toBe(true);
    expect(graph.hasRelationship(nid(1), nid(2), RelationshipType.DEPENDS_ON())).toBe(true);
    expect(graph.hasRelationship(nid(1), nid(2), RelationshipType.SUPPORTS())).toBe(false);
    expect(graph.hasRelationship(nid(1), nid(3))).toBe(false);
  });

  it('returns edges and neighbors for a node', () => {
    const graph = new KnowledgeGraph({ graphId, label: 'G' });
    graph.addNode(makeNode(1));
    graph.addNode(makeNode(2));
    graph.addNode(makeNode(3));
    graph.addEdge(makeEdge(1, 2));
    graph.addEdge(makeEdge(3, 1));

    expect(graph.getEdgesForNode(nid(1))).toHaveLength(2);
    expect(graph.getOutgoingEdges(nid(1))).toHaveLength(1);
    expect(graph.getIncomingEdges(nid(1))).toHaveLength(1);
    const neighbors = graph.getNeighbors(nid(1));
    expect(neighbors.map((n) => n.id).sort()).toEqual([nid(2), nid(3)]);
  });

  it('updates metadata, archives, snapshots, and clears', () => {
    const graph = new KnowledgeGraph({ graphId, label: 'G' });
    graph.updateMetadata({ owner: 'me' });
    expect(graph.metadata).toEqual({ owner: 'me' });

    graph.archive();
    expect(graph.status.isArchived).toBe(true);

    graph.addNode(makeNode(1));
    const snap = graph.snapshot();
    expect(snap.nodes).toHaveLength(1);
    expect(snap.timestamp).toBeInstanceOf(Date);

    graph.clear();
    expect(graph.nodeCount).toBe(0);
    expect(graph.edgeCount).toBe(0);
  });

  it('pullEvents drains aggregate, node, and edge events', () => {
    const graph = new KnowledgeGraph({ graphId, label: 'G' });
    graph.addNode(makeNode(1));
    graph.addNode(makeNode(2));
    graph.addEdge(makeEdge(1, 2));
    graph.addNode(makeNode(3));
    graph.removeNode(nid(3));

    const events = graph.pullEvents();
    expect(events.length).toBeGreaterThan(0);
    // Second pull is empty
    expect(graph.pullEvents()).toHaveLength(0);
  });
});

describe('KnowledgeGraphService', () => {
  // In-memory repository so the domain service can be exercised end-to-end.
  function createRepo(): KnowledgeRepository {
    const nodes = new Map<string, KnowledgeNode>();
    const edges = new Map<string, KnowledgeEdge>();
    const paginate = <T>(items: T[]): PaginatedResult<T> => ({
      data: items,
      total: items.length,
      page: 1,
      limit: 100,
      totalPages: 1,
    });

    return {
      findNodeById: async (id) => nodes.get(id) ?? null,
      findNodesByCategory: async (_c, _p) => paginate([...nodes.values()]),
      findNodesByLabel: async (l, _p) =>
        paginate([...nodes.values()].filter((n) => n.label.includes(l))),
      findNodesByGraph: async (_g, _p) => paginate([...nodes.values()]),
      saveNode: async (n) => {
        nodes.set(n.id, n);
      },
      updateNode: async (n) => {
        nodes.set(n.id, n);
      },
      deleteNode: async (id) => {
        nodes.delete(id);
      },
      nodeExists: async (id) => nodes.has(id),
      findEdgeById: async (id) => edges.get(id) ?? null,
      findEdgesBetween: async (s, t) =>
        [...edges.values()].filter((e) => e.sourceId === s && e.targetId === t),
      findEdgesForNode: async (nodeId) =>
        [...edges.values()].filter((e) => e.sourceId === nodeId || e.targetId === nodeId),
      findEdgesByType: async (_t, _p) => paginate([...edges.values()]),
      findEdgesByCategory: async (_c, _p) => paginate([...edges.values()]),
      saveEdge: async (e) => {
        edges.set(e.id, e);
      },
      updateEdge: async (e) => {
        edges.set(e.id, e);
      },
      deleteEdge: async (id) => {
        edges.delete(id);
      },
      edgeExists: async (id) => edges.has(id),
      findGraphById: async () => null,
      findAllGraphs: async () => paginate([]),
      saveGraph: async () => undefined,
      updateGraph: async () => undefined,
      deleteGraph: async () => undefined,
      searchNodes: async (q, _p) =>
        paginate(
          [...nodes.values()].filter((n) => n.label.includes(q) || n.description.includes(q)),
        ),
      searchNodesByTags: async (_t, _p) => paginate([]),
      countNodes: async () => nodes.size,
      countEdges: async () => edges.size,
      countNodesByCategory: async () => ({}) as Record<string, number>,
      countGraphs: async () => 0,
    };
  }

  it('createNode succeeds, rejects duplicates, and swallows errors', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    const node = makeNode(1);

    const created = await svc.createNode(node);
    expect(created.success).toBe(true);

    const dup = await svc.createNode(makeNode(1));
    expect(dup.success).toBe(false);
    expect(dup.error).toContain('already exists');

    const failing = createRepo();
    const failSvc = new KnowledgeGraphService(failing);
    vi.spyOn(failing, 'nodeExists').mockRejectedValue(new Error('db down'));
    const failed = await failSvc.createNode(node);
    expect(failed.success).toBe(false);
    expect(failed.error).toBe('db down');
  });

  it('updateNode succeeds, rejects missing, and swallows errors', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    const node = makeNode(1);

    const missing = await svc.updateNode(node);
    expect(missing.success).toBe(false);

    await repo.saveNode(node);
    const ok = await svc.updateNode(node);
    expect(ok.success).toBe(true);

    const failing = createRepo();
    vi.spyOn(failing, 'nodeExists').mockRejectedValue(new Error('x'));
    expect((await new KnowledgeGraphService(failing).updateNode(node)).success).toBe(false);
  });

  it('deleteNode removes the node and its edges', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    await repo.saveNode(makeNode(1));
    await repo.saveNode(makeNode(2));
    await repo.saveEdge(makeEdge(1, 2));

    const res = await svc.deleteNode(nid(1));
    expect(res.success).toBe(true);
    expect(await repo.findEdgeById(eid(12))).toBeNull();
  });

  it('mergeNodes redirects edges and skips duplicates', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    const a = makeNode(1);
    const b = makeNode(2);
    const c = makeNode(3);
    await repo.saveNode(a);
    await repo.saveNode(b);
    await repo.saveNode(c);
    await repo.saveEdge(makeEdge(1, 2));
    await repo.saveEdge(makeEdge(2, 3));

    const merged = await svc.mergeNodes(nid(1), nid(2), b);
    expect(merged.success).toBe(true);
    expect(await repo.nodeExists(nid(1))).toBe(false);
    expect(await repo.nodeExists(nid(2))).toBe(true);
  });

  it('splitNode redirects edges to the split nodes', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    const orig = makeNode(1);
    const first = makeNode(10);
    const second = makeNode(20);
    await repo.saveNode(orig);
    await repo.saveNode(makeNode(2));
    await repo.saveEdge(makeEdge(1, 2));

    const res = await svc.splitNode(nid(1), first, second, [eid(12)], []);
    expect(res.success).toBe(true);
    expect(await repo.nodeExists(nid(1))).toBe(false);
    expect(await repo.nodeExists(nid(10))).toBe(true);
    expect(await repo.nodeExists(nid(20))).toBe(true);
  });

  it('createRelationship validates endpoints and saves the edge', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    await repo.saveNode(makeNode(1));
    await repo.saveNode(makeNode(2));

    // makeEdge(1, 3): source nid(1) exists, target nid(3) is missing.
    const missingTarget = await svc.createRelationship(makeEdge(1, 3));
    expect(missingTarget.success).toBe(false);
    expect(missingTarget.error).toContain('Target node not found');

    // makeEdge(3, 1): source nid(3) is missing.
    const missingSource = await svc.createRelationship(makeEdge(3, 1));
    expect(missingSource.success).toBe(false);
    expect(missingSource.error).toContain('Source node not found');

    const ok = await svc.createRelationship(makeEdge(1, 2));
    expect(ok.success).toBe(true);
  });

  it('deleteRelationship removes the edge', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    await repo.saveNode(makeNode(1));
    await repo.saveNode(makeNode(2));
    await repo.saveEdge(makeEdge(1, 2));
    const res = await svc.deleteRelationship(eid(12));
    expect(res.success).toBe(true);
    expect(await repo.findEdgeById(eid(12))).toBeNull();
  });

  it('traverse walks the graph breadth-first up to maxDepth', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    for (let i = 1; i <= 3; i++) await repo.saveNode(makeNode(i));
    await repo.saveEdge(makeEdge(1, 2));
    await repo.saveEdge(makeEdge(2, 3));

    const res = await svc.traverse(nid(1));
    expect(res.path.length).toBe(3);
    expect(res.depth).toBe(5);
    expect(res.totalCost).toBe(3);
  });

  it('findShortestPath returns a path or null', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    for (let i = 1; i <= 4; i++) await repo.saveNode(makeNode(i));
    await repo.saveEdge(makeEdge(1, 2));
    await repo.saveEdge(makeEdge(2, 4));

    const path = await svc.findShortestPath(nid(1), nid(4));
    expect(path).not.toBeNull();
    expect(path?.path.length).toBe(3);

    const none = await svc.findShortestPath(nid(1), nid(3));
    expect(none).toBeNull();
  });

  it('search filters by graph id and reports relevance', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    await repo.saveNode(makeNode(1));
    const other = createGraphId('g2');
    await repo.saveNode(
      KnowledgeNode.create({
        id: nid(50),
        graphId: other,
        category: KnowledgeCategory.skill(),
        label: 'Node 1',
      }),
    );

    const all = await svc.search('Node');
    expect(all.total).toBe(2);

    const filtered = await svc.search('Node', graphId);
    expect(filtered.total).toBe(1);
    expect(filtered.relevance).toBe(0.8);
  });

  it('findRelatedKnowledge returns neighbors or empty for missing nodes', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    await repo.saveNode(makeNode(1));
    await repo.saveNode(makeNode(2));
    await repo.saveEdge(makeEdge(1, 2));

    const res = await svc.findRelatedKnowledge(nid(1));
    expect(res.total).toBe(1);
    expect(res.relevance).toBe(1.0);

    const empty = await svc.findRelatedKnowledge(nid(9));
    expect(empty.total).toBe(0);
  });

  it('getDependencyGraph separates dependencies and dependents', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    await repo.saveNode(makeNode(1));
    await repo.saveNode(makeNode(2));
    await repo.saveNode(makeNode(3));
    await repo.saveEdge(makeEdge(1, 2)); // 1 -> 2 (2 depends on 1)
    await repo.saveEdge(makeEdge(2, 3)); // 2 -> 3 (3 depends on 2)

    const deps = await svc.getDependencyGraph(nid(2));
    expect(deps.dependencies.map((n) => n.id)).toEqual([nid(1)]);
    expect(deps.dependents.map((n) => n.id)).toEqual([nid(3)]);
  });

  it('analyzeImpact classifies impact levels', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    await repo.saveNode(makeNode(1));
    await repo.saveNode(makeNode(2));
    await repo.saveEdge(makeEdge(1, 2));

    const low = await svc.analyzeImpact(nid(1));
    expect(low.impactLevel).toBe('low');
    expect(low.affectedNodes.length).toBe(1);

    // 4 edges -> medium
    const repo2 = createRepo();
    const svc2 = new KnowledgeGraphService(repo2);
    await repo2.saveNode(makeNode(1));
    for (let i = 2; i <= 5; i++) {
      await repo2.saveNode(makeNode(i));
      await repo2.saveEdge(makeEdge(1, i));
    }
    const medium = await svc2.analyzeImpact(nid(1));
    expect(medium.impactLevel).toBe('medium');
  });

  it('detectCycles finds cycles in a cyclic graph', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    await repo.saveNode(makeNode(1));
    await repo.saveNode(makeNode(2));
    await repo.saveEdge(makeEdge(1, 2));
    await repo.saveEdge(makeEdge(2, 1));

    const res = await svc.detectCycles(graphId);
    expect(res.hasCycle).toBe(true);
    expect(res.cycles.length).toBeGreaterThan(0);
  });

  it('validateNodeAddition checks label rules and duplicates', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    const node = makeNode(1);

    const valid = await svc.validateNodeAddition(node, graphId);
    expect(valid.valid).toBe(true);

    await repo.saveNode(node);
    const dup = await svc.validateNodeAddition(node, graphId);
    expect(dup.valid).toBe(false);
    expect(dup.errors.some((e) => e.includes('already exists'))).toBe(true);
  });

  it('getGraphStatistics computes density and connectivity', async () => {
    const repo = createRepo();
    const svc = new KnowledgeGraphService(repo);
    await repo.saveNode(makeNode(1));
    await repo.saveNode(makeNode(2));
    await repo.saveEdge(makeEdge(1, 2));

    const stats = await svc.getGraphStatistics(graphId);
    expect(stats.nodeCount).toBe(2);
    expect(stats.edgeCount).toBe(1);
    expect(stats.averageConnectivity).toBe(1);
    expect(stats.density).toBe(1);
  });
});
