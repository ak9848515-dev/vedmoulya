// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — KnowledgeMapper unit tests
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { KnowledgeMapper } from '../KnowledgeMapper.js';

function makeNode(): unknown {
  return {
    id: 'n-1',
    graphId: 'g-1',
    category: { value: 'concept' },
    label: 'Node',
    description: 'Desc',
    metadata: { m: 1 },
    status: { state: 'active' },
    confidence: { level: 'high', score: 0.9 },
    source: { type: 'manual', detail: 'd' },
    quality: { overall: 8 },
    version: { toString: () => 'v1' },
    entityStatus: 'active',
    tags: ['a', 'b'],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  };
}

function makeEdge(): unknown {
  return {
    id: 'e-1',
    graphId: 'g-1',
    sourceId: 'n-1',
    targetId: 'n-2',
    type: { type: 'related', category: 'semantic' },
    label: 'Edge',
    weight: 0.8,
    confidence: { level: 'medium' },
    status: { state: 'active' },
    entityStatus: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  };
}

function makeGraph(): unknown {
  return {
    graphId: 'g-1',
    label: 'Graph',
    description: 'Desc',
    nodeCount: 5,
    edgeCount: 3,
    status: { state: 'active' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  };
}

describe('KnowledgeMapper', () => {
  it('toNodeDTO maps all node fields', () => {
    const dto = KnowledgeMapper.toNodeDTO(makeNode() as never);
    expect(dto.id).toBe('n-1');
    expect(dto.graphId).toBe('g-1');
    expect(dto.category).toBe('concept');
    expect(dto.confidence).toBe('high');
    expect(dto.confidenceScore).toBe(0.9);
    expect(dto.qualityScore).toBe(8);
    expect(dto.version).toBe('v1');
    expect(dto.tags).toEqual(['a', 'b']);
    expect(dto.entityStatus).toBe('active');
    expect(dto.metadata).toEqual({ m: 1 });
  });

  it('toEdgeDTO maps all edge fields', () => {
    const dto = KnowledgeMapper.toEdgeDTO(makeEdge() as never);
    expect(dto.id).toBe('e-1');
    expect(dto.sourceId).toBe('n-1');
    expect(dto.targetId).toBe('n-2');
    expect(dto.type).toBe('related');
    expect(dto.category).toBe('semantic');
    expect(dto.weight).toBe(0.8);
    expect(dto.confidence).toBe('medium');
    expect(dto.status).toBe('active');
  });

  it('toGraphDTO uses provided counts', () => {
    const dto = KnowledgeMapper.toGraphDTO(makeGraph() as never, 10, 7);
    expect(dto.nodeCount).toBe(10);
    expect(dto.edgeCount).toBe(7);
  });

  it('toGraphDTO falls back to entity counts when not provided', () => {
    const dto = KnowledgeMapper.toGraphDTO(makeGraph() as never);
    expect(dto.nodeCount).toBe(5);
    expect(dto.edgeCount).toBe(3);
    expect(dto.status).toBe('active');
  });

  it('toTraversalStepDTO maps a step with an edge', () => {
    const dto = KnowledgeMapper.toTraversalStepDTO({
      node: makeNode() as never,
      edge: makeEdge() as never,
    });
    expect(dto.node.id).toBe('n-1');
    expect(dto.edge?.id).toBe('e-1');
  });

  it('toTraversalStepDTO maps a step without an edge', () => {
    const dto = KnowledgeMapper.toTraversalStepDTO({ node: makeNode() as never });
    expect(dto.node.id).toBe('n-1');
    expect(dto.edge).toBeUndefined();
  });

  it('toNodeDTOs maps multiple nodes', () => {
    const dtos = KnowledgeMapper.toNodeDTOs([makeNode() as never, makeNode() as never]);
    expect(dtos).toHaveLength(2);
  });

  it('toEdgeDTOs maps multiple edges', () => {
    const dtos = KnowledgeMapper.toEdgeDTOs([makeEdge() as never, makeEdge() as never]);
    expect(dtos).toHaveLength(2);
  });
});
