// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Knowledge Repository Tests
// Covers every repository method with a mocked chainable Drizzle query builder.
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  KnowledgeFactory,
  KnowledgeGraph,
  KnowledgeEdge as KnowledgeEdgeEntity,
  RelationshipType,
} from '@vedmoulya/domain';
import type {
  KnowledgeNodeRow,
  KnowledgeEdgeRow,
  KnowledgeGraphRow,
} from '../../../schema/knowledge.js';

const getDatabaseMock = vi.hoisted(() => vi.fn());

vi.mock('../DatabaseConnection.js', () => ({
  getDatabase: getDatabaseMock,
}));

const { PostgresKnowledgeRepository } = await import('../PostgresKnowledgeRepository.js');

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeNodeRow(overrides: Partial<KnowledgeNodeRow> = {}): KnowledgeNodeRow {
  return {
    id: 'node_1',
    graphId: 'graph_1',
    category: 'goal',
    label: 'Launch',
    description: 'Launch the platform',
    metadata: {},
    tags: ['work'],
    statusState: 'active',
    statusReason: null,
    confidenceLevel: 'high',
    confidenceScore: 0.9,
    sourceType: 'system_generated',
    sourceDetail: null,
    sourceTimestamp: null,
    qualityAccuracy: 0.9,
    qualityCompleteness: 0.8,
    qualityConsistency: 0.7,
    qualityTimeliness: 1.0,
    qualityRelevance: 0.6,
    versionMajor: 1,
    versionMinor: 2,
    versionPatch: 3,
    entityStatus: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeEdgeRow(overrides: Partial<KnowledgeEdgeRow> = {}): KnowledgeEdgeRow {
  return {
    id: 'edge_1',
    graphId: 'graph_1',
    sourceId: 'node_1',
    targetId: 'node_2',
    type: 'supports',
    typeCategory: 'dependency',
    label: 'supports',
    weight: 0.8,
    metadata: {},
    confidenceLevel: 'high',
    confidenceScore: 0.9,
    statusState: 'active',
    statusReason: null,
    sourceType: 'system_generated',
    sourceDetail: null,
    entityStatus: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeGraphRow(overrides: Partial<KnowledgeGraphRow> = {}): KnowledgeGraphRow {
  return {
    id: 'graph_1',
    label: 'Main graph',
    description: 'A graph',
    statusState: 'active',
    statusReason: null,
    metadata: {},
    entityStatus: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeNode(): ReturnType<typeof KnowledgeFactory.reconstructNode> {
  return KnowledgeFactory.reconstructNode({
    id: 'node_1',
    graphId: 'graph_1',
    category: 'goal',
    label: 'Launch',
    description: 'Launch the platform',
    status: 'active',
    confidence: 'high',
    sourceType: 'system_generated',
    tags: ['work'],
  });
}

function makeEdge(): KnowledgeEdgeEntity {
  return new KnowledgeEdgeEntity({
    id: 'edge_1',
    graphId: 'graph_1',
    sourceId: 'node_1',
    targetId: 'node_2',
    type: new RelationshipType('supports', 'dependency', 'supports'),
    label: 'supports',
    weight: 0.8,
  });
}

function makeGraph(): KnowledgeGraph {
  return new KnowledgeGraph({
    graphId: 'graph_1',
    label: 'Main graph',
    description: 'A graph',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });
}

type Builder = {
  then: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

type Db = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makeBuilder(results: unknown[]): Builder {
  const builder = {} as Builder;
  const then = vi.fn();
  for (const r of results) {
    then.mockImplementationOnce((resolve: (v: unknown) => void) => {
      resolve(r);
    });
  }
  builder.then = then;
  for (const key of [
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'groupBy',
    'values',
    'set',
  ] as const) {
    builder[key] = vi.fn(() => builder);
  }
  return builder;
}

function makeDb(): Db {
  return { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
}

function repo(): PostgresKnowledgeRepository {
  return new PostgresKnowledgeRepository();
}

describe('PostgresKnowledgeRepository', () => {
  let db: Db;
  let repository: PostgresKnowledgeRepository;

  beforeEach(() => {
    db = makeDb();
    getDatabaseMock.mockReturnValue(db);
    repository = repo();
  });

  // ── Node operations ────────────────────────────────────────────────────

  it('findNodeById returns a reconstructed node', async () => {
    db.select.mockReturnValue(makeBuilder([[makeNodeRow()]]));

    const node = await repository.findNodeById('node_1');

    expect(node).not.toBeNull();
    expect(node?.id).toBe('node_1');
    expect(node?.label).toBe('Launch');
    expect(node?.category.value).toBe('goal');
  });

  it('findNodeById returns null when not found', async () => {
    db.select.mockReturnValue(makeBuilder([[]]));

    await expect(repository.findNodeById('nope')).resolves.toBeNull();
  });

  it('findNodesByCategory paginates and counts', async () => {
    db.select.mockReturnValue(makeBuilder([[makeNodeRow()], [{ count: 1 }]]));

    const result = await repository.findNodesByCategory('goal', { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('findNodesByLabel searches by label', async () => {
    db.select.mockReturnValue(makeBuilder([[makeNodeRow()], [{ count: 1 }]]));

    const result = await repository.findNodesByLabel('Launch', { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('findNodesByGraph filters by graph', async () => {
    db.select.mockReturnValue(makeBuilder([[makeNodeRow()], [{ count: 1 }]]));

    const result = await repository.findNodesByGraph('graph_1', { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
  });

  it('saveNode inserts the mapped row', async () => {
    const builder = makeBuilder([undefined]);
    db.insert.mockReturnValue(builder);

    await expect(repository.saveNode(makeNode())).resolves.toBeUndefined();

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(builder.values).toHaveBeenCalledTimes(1);
  });

  it('updateNode sets the mapped row', async () => {
    const builder = makeBuilder([undefined]);
    db.update.mockReturnValue(builder);

    await expect(repository.updateNode(makeNode())).resolves.toBeUndefined();

    expect(builder.set).toHaveBeenCalledTimes(1);
    expect(builder.where).toHaveBeenCalledTimes(1);
  });

  it('deleteNode filters by id', async () => {
    db.delete.mockReturnValue(makeBuilder([undefined]));

    await expect(repository.deleteNode('node_1')).resolves.toBeUndefined();

    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it('nodeExists returns true/false based on the count', async () => {
    db.select.mockReturnValue(makeBuilder([[{ count: 1 }]]));
    await expect(repository.nodeExists('node_1')).resolves.toBe(true);

    db.select.mockReturnValue(makeBuilder([[{ count: 0 }]]));
    await expect(repository.nodeExists('node_1')).resolves.toBe(false);
  });

  // ── Edge operations ────────────────────────────────────────────────────

  it('findEdgeById returns a reconstructed edge', async () => {
    db.select.mockReturnValue(makeBuilder([[makeEdgeRow()]]));

    const edge = await repository.findEdgeById('edge_1');

    expect(edge).not.toBeNull();
    expect(edge?.id).toBe('edge_1');
    expect(edge?.sourceId).toBe('node_1');
    expect(edge?.targetId).toBe('node_2');
  });

  it('findEdgeById returns null when not found', async () => {
    db.select.mockReturnValue(makeBuilder([[]]));

    await expect(repository.findEdgeById('nope')).resolves.toBeNull();
  });

  it('findEdgesBetween filters by both endpoints', async () => {
    db.select.mockReturnValue(makeBuilder([[makeEdgeRow()]]));

    const edges = await repository.findEdgesBetween('node_1', 'node_2');

    expect(edges).toHaveLength(1);
  });

  it('findEdgesForNode uses an OR condition', async () => {
    db.select.mockReturnValue(makeBuilder([[makeEdgeRow()]]));

    const edges = await repository.findEdgesForNode('node_1');

    expect(edges).toHaveLength(1);
  });

  it('findEdgesByType paginates by type', async () => {
    db.select.mockReturnValue(makeBuilder([[makeEdgeRow()], [{ count: 1 }]]));

    const result = await repository.findEdgesByType('supports', { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('findEdgesByCategory paginates by category', async () => {
    db.select.mockReturnValue(makeBuilder([[makeEdgeRow()], [{ count: 1 }]]));

    const result = await repository.findEdgesByCategory('dependency', { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
  });

  it('saveEdge, updateEdge, deleteEdge, and edgeExists work', async () => {
    db.insert.mockReturnValue(makeBuilder([undefined]));
    await expect(repository.saveEdge(makeEdge())).resolves.toBeUndefined();
    expect(db.insert).toHaveBeenCalledTimes(1);

    db.update.mockReturnValue(makeBuilder([undefined]));
    await expect(repository.updateEdge(makeEdge())).resolves.toBeUndefined();
    expect(db.update).toHaveBeenCalledTimes(1);

    db.delete.mockReturnValue(makeBuilder([undefined]));
    await expect(repository.deleteEdge('edge_1')).resolves.toBeUndefined();
    expect(db.delete).toHaveBeenCalledTimes(1);

    db.select.mockReturnValue(makeBuilder([[{ count: 1 }]]));
    await expect(repository.edgeExists('edge_1')).resolves.toBe(true);
  });

  // ── Graph operations ───────────────────────────────────────────────────

  it('findGraphById reconstructs the graph with nodes and edges', async () => {
    // Both edge endpoints must exist in the graph or addEdge skips the edge.
    db.select.mockReturnValue(
      makeBuilder([
        [makeGraphRow()],
        [makeNodeRow(), makeNodeRow({ id: 'node_2' })],
        [makeEdgeRow()],
      ]),
    );

    const graph = await repository.findGraphById('graph_1');

    expect(graph).not.toBeNull();
    expect(graph?.label).toBe('Main graph');
    expect(graph?.getNodes().length).toBe(2);
    expect(graph?.getEdges().length).toBe(1);
  });

  it('findGraphById returns null when missing', async () => {
    db.select.mockReturnValue(makeBuilder([[]]));

    await expect(repository.findGraphById('nope')).resolves.toBeNull();
  });

  it('findAllGraphs paginates', async () => {
    db.select.mockReturnValue(makeBuilder([[makeGraphRow()], [{ count: 1 }]]));

    const result = await repository.findAllGraphs({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('saveGraph inserts the mapped row', async () => {
    const builder = makeBuilder([undefined]);
    db.insert.mockReturnValue(builder);

    await expect(repository.saveGraph(makeGraph())).resolves.toBeUndefined();

    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('updateGraph sets label, description, and status', async () => {
    const builder = makeBuilder([undefined]);
    db.update.mockReturnValue(builder);

    await expect(repository.updateGraph(makeGraph())).resolves.toBeUndefined();

    expect(builder.set).toHaveBeenCalledTimes(1);
    expect(builder.where).toHaveBeenCalledTimes(1);
  });

  it('deleteGraph deletes nodes, edges, and the graph', async () => {
    // Three deletes run through Promise.all on the same chainable builder.
    db.delete.mockReturnValue(makeBuilder([undefined, undefined, undefined]));

    await expect(repository.deleteGraph('graph_1')).resolves.toBeUndefined();

    expect(db.delete).toHaveBeenCalledTimes(3);
  });

  // ── Search ─────────────────────────────────────────────────────────────

  it('searchNodes searches label and description', async () => {
    db.select.mockReturnValue(makeBuilder([[makeNodeRow()], [{ count: 1 }]]));

    const result = await repository.searchNodes('launch', { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('searchNodesByTags filters by tag overlap', async () => {
    db.select.mockReturnValue(makeBuilder([[makeNodeRow()], [{ count: 1 }]]));

    const result = await repository.searchNodesByTags(['work'], { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
  });

  // ── Statistics ─────────────────────────────────────────────────────────

  it('countNodes, countEdges, and countGraphs return counts', async () => {
    // Each method awaits the same mocked builder — provide one result per await.
    db.select.mockReturnValue(makeBuilder([[{ count: 5 }], [{ count: 5 }], [{ count: 5 }]]));
    await expect(repository.countNodes('graph_1')).resolves.toBe(5);
    await expect(repository.countEdges('graph_1')).resolves.toBe(5);
    await expect(repository.countGraphs()).resolves.toBe(5);
  });

  it('countNodesByCategory groups by category', async () => {
    db.select.mockReturnValue(makeBuilder([[{ category: 'goal', count: 3 }]]));

    const result = await repository.countNodesByCategory('graph_1');

    expect(result.goal).toBe(3);
  });

  // ── Mapping edge cases ─────────────────────────────────────────────────

  it('rowToNode handles missing optional fields', async () => {
    db.select.mockReturnValue(
      makeBuilder([[makeNodeRow({ description: null, tags: null, statusReason: null })]]),
    );

    const node = await repository.findNodeById('node_1');

    // The node entity defaults description to '' when the column is null.
    expect(node?.description).toBe('');
    expect(node?.tags).toEqual([]);
  });

  it('rowToEdge reconstructs type, confidence, status, and source', async () => {
    db.select.mockReturnValue(
      makeBuilder([
        [makeEdgeRow({ sourceType: 'manual', sourceDetail: 'imported', statusState: 'archived' })],
      ]),
    );

    const edge = await repository.findEdgeById('edge_1');

    expect(edge?.type.type).toBe('supports');
    expect(edge?.type.category).toBe('dependency');
    expect(edge?.status.state).toBe('archived');
    expect(edge?.source.type).toBe('manual');
    expect(edge?.source.detail).toBe('imported');
  });

  // ── Empty-result fallbacks ─────────────────────────────────────────────

  it('pagination falls back to total 0 when the count query is empty', async () => {
    db.select.mockReturnValue(makeBuilder([[makeNodeRow()], []]));

    const result = await repository.findNodesByCategory('goal', { page: 1, limit: 10 });

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('nodeExists and edgeExists return false on empty counts', async () => {
    db.select.mockReturnValue(makeBuilder([[]]));
    await expect(repository.nodeExists('node_1')).resolves.toBe(false);

    db.select.mockReturnValue(makeBuilder([[]]));
    await expect(repository.edgeExists('edge_1')).resolves.toBe(false);
  });

  it('count methods return 0 on empty results', async () => {
    db.select.mockReturnValue(makeBuilder([[], [], []]));
    await expect(repository.countNodes('graph_1')).resolves.toBe(0);
    await expect(repository.countEdges('graph_1')).resolves.toBe(0);
    await expect(repository.countGraphs()).resolves.toBe(0);
  });

  it('countNodesByCategory returns an empty record when no rows match', async () => {
    db.select.mockReturnValue(makeBuilder([[]]));

    const result = await repository.countNodesByCategory('graph_1');

    expect(result).toEqual({});
  });

  it('findGraphById skips duplicate nodes and edges with missing endpoints', async () => {
    // Two rows with the same id → the second addNode throws and is skipped;
    // the edge targets node_2 which is never loaded → addEdge throws and is skipped.
    db.select.mockReturnValue(
      makeBuilder([[makeGraphRow()], [makeNodeRow(), makeNodeRow()], [makeEdgeRow()]]),
    );

    const graph = await repository.findGraphById('graph_1');

    expect(graph).not.toBeNull();
    expect(graph?.getNodes().length).toBe(1);
    expect(graph?.getEdges().length).toBe(0);
  });

  it('findGraphById and findAllGraphs tolerate a null graph description', async () => {
    db.select.mockReturnValue(
      makeBuilder([[makeGraphRow({ description: null })], [makeNodeRow()], []]),
    );

    const graph = await repository.findGraphById('graph_1');
    expect(graph).not.toBeNull();
    expect(graph?.label).toBe('Main graph');

    db.select.mockReturnValue(makeBuilder([[makeGraphRow({ description: null })], [{ count: 1 }]]));
    const result = await repository.findAllGraphs({ page: 1, limit: 10 });
    expect(result.data[0]?.label).toBe('Main graph');
  });

  it('saveNode maps an empty description to null in the row', async () => {
    const builder = makeBuilder([undefined]);
    db.insert.mockReturnValue(builder);

    const node = KnowledgeFactory.reconstructNode({
      id: 'node_1',
      graphId: 'graph_1',
      category: 'goal',
      label: 'Launch',
      description: '',
      status: 'active',
      confidence: 'high',
      sourceType: 'system_generated',
      tags: ['work'],
    });
    await repository.saveNode(node);

    expect(builder.values).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
  });
});

export type { KnowledgeEdgeRow, KnowledgeGraphRow };
