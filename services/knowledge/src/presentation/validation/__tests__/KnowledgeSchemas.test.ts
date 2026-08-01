// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Validation Schemas unit tests
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  paginationQuery,
  graphIdParam,
  nodeIdParam,
  edgeIdParam,
  createGraphSchema,
  createNodeSchema,
  updateNodeSchema,
  createEdgeSchema,
  traverseQuery,
  shortestPathQuery,
  mergeNodesSchema,
  splitNodeSchema,
  searchQuery,
} from '../KnowledgeSchemas.js';

describe('KnowledgeSchemas', () => {
  it('paginationQuery coerces and defaults page and limit', () => {
    expect(paginationQuery.parse({}).page).toBe(1);
    expect(paginationQuery.parse({}).limit).toBe(20);
    expect(paginationQuery.parse({ page: '2', limit: '5' })).toEqual({ page: 2, limit: 5 });
    expect(paginationQuery.safeParse({ page: '0' }).success).toBe(false);
    expect(paginationQuery.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('id params require a non-empty id', () => {
    expect(graphIdParam.parse({ id: 'g1' }).id).toBe('g1');
    expect(graphIdParam.safeParse({ id: '' }).success).toBe(false);
    expect(nodeIdParam.parse({ id: 'n1' }).id).toBe('n1');
    expect(edgeIdParam.parse({ id: 'e1' }).id).toBe('e1');
  });

  it('createGraphSchema requires a label', () => {
    expect(createGraphSchema.parse({ label: 'Graph' }).label).toBe('Graph');
    expect(createGraphSchema.safeParse({ label: '' }).success).toBe(false);
    expect(createGraphSchema.parse({ label: 'Graph', description: 'D' }).description).toBe('D');
  });

  it('createNodeSchema validates category, label, and optional fields', () => {
    const valid = createNodeSchema.parse({
      graphId: 'g1',
      category: 'goal',
      label: 'Node',
    });
    expect(valid.category).toBe('goal');
    expect(
      createNodeSchema.safeParse({ graphId: 'g1', category: 'not-a-category', label: 'N' }).success,
    ).toBe(false);
    expect(createNodeSchema.safeParse({ graphId: 'g1', category: 'goal', label: '' }).success).toBe(
      false,
    );
    expect(
      createNodeSchema.parse({
        graphId: 'g1',
        category: 'skill',
        label: 'N',
        tags: ['a'],
        metadata: { key: 'v' },
        sourceType: 'manual',
      }).tags,
    ).toEqual(['a']);
  });

  it('updateNodeSchema allows partial updates', () => {
    expect(updateNodeSchema.parse({ label: 'New' }).label).toBe('New');
    expect(updateNodeSchema.safeParse({}).success).toBe(true);
    expect(updateNodeSchema.safeParse({ category: 'bad' }).success).toBe(false);
  });

  it('createEdgeSchema validates endpoints and relationship', () => {
    const valid = createEdgeSchema.parse({
      graphId: 'g1',
      sourceId: 'n1',
      targetId: 'n2',
      relationshipType: 'supports',
      relationshipCategory: 'dependency',
    });
    expect(valid.relationshipCategory).toBe('dependency');
    expect(createEdgeSchema.safeParse({ graphId: 'g1', relationshipCategory: 'bad' }).success).toBe(
      false,
    );
    expect(
      createEdgeSchema.safeParse({
        graphId: 'g1',
        sourceId: 'n1',
        targetId: 'n2',
        relationshipType: 'x',
        relationshipCategory: 'dependency',
      }).success,
    ).toBe(true);
  });

  it('traverseQuery and shortestPathQuery parse', () => {
    expect(traverseQuery.parse({}).maxDepth).toBe(5);
    expect(traverseQuery.parse({ maxDepth: '3' }).maxDepth).toBe(3);
    expect(traverseQuery.safeParse({ maxDepth: '21' }).success).toBe(false);
    expect(shortestPathQuery.parse({ endNodeId: 'n9' }).endNodeId).toBe('n9');
    expect(shortestPathQuery.safeParse({}).success).toBe(false);
  });

  it('mergeNodesSchema requires source, target, and mergedLabel', () => {
    expect(
      mergeNodesSchema.parse({ sourceId: 'n1', targetId: 'n2', mergedLabel: 'M' }).mergedLabel,
    ).toBe('M');
    expect(mergeNodesSchema.safeParse({ sourceId: 'n1', targetId: 'n2' }).success).toBe(false);
  });

  it('splitNodeSchema requires labels and edge lists', () => {
    expect(
      splitNodeSchema.parse({
        nodeId: 'n1',
        firstLabel: 'A',
        secondLabel: 'B',
        edgesForFirst: ['e1'],
        edgesForSecond: [],
      }).firstLabel,
    ).toBe('A');
    expect(
      splitNodeSchema.safeParse({ nodeId: 'n1', firstLabel: 'A', secondLabel: 'B' }).success,
    ).toBe(false);
  });

  it('searchQuery requires q and coerces pagination', () => {
    expect(searchQuery.parse({ q: 'launch' }).page).toBe(1);
    expect(searchQuery.parse({ q: 'x', category: 'goal', tags: 'a,b' }).category).toBe('goal');
    expect(searchQuery.safeParse({}).success).toBe(false);
    expect(searchQuery.safeParse({ q: 'x', category: 'invalid' }).success).toBe(false);
  });
});
