// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Factory Tests
// Covers KnowledgeFactory createNode/createEdge and static
// reconstructNode/reconstructEdge paths.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeFactory } from '../factory/KnowledgeFactory.js';
import type { KnowledgeRepository } from '../repository/KnowledgeRepository.js';
import { createGraphId } from '../value-objects/GraphId.js';
import { createKnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import { createKnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';

const graphId = createGraphId('g-factory');

// Minimal repository stub — the factory only needs the type, not calls.
const stubRepo = {} as KnowledgeRepository;

describe('KnowledgeFactory createNode', () => {
  it('creates a node with default system source', async () => {
    const factory = new KnowledgeFactory(stubRepo);
    const res = await factory.createNode({
      graphId,
      category: 'skill',
      label: 'TypeScript',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.category.value).toBe('skill');
      expect(res.data.source.type).toBe('system_generated');
    }
  });

  it('maps every supported source type', async () => {
    const factory = new KnowledgeFactory(stubRepo);
    const sources = [
      'user_input',
      'ai_inference',
      'system_generated',
      'import',
      'integration',
      'conversation',
      'document',
      'learning',
    ] as const;
    for (const sourceType of sources) {
      const res = await factory.createNode({
        graphId,
        category: 'knowledge',
        label: `node-${sourceType}`,
        sourceType,
        sourceDetail: 'detail',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.source.type).toBe(sourceType);
      }
    }
  });

  it('falls back to system_generated for unknown source types', async () => {
    const factory = new KnowledgeFactory(stubRepo);
    const res = await factory.createNode({
      graphId,
      category: 'goal',
      label: 'x',
      sourceType: 'nonsense' as never,
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.source.type).toBe('system_generated');
  });

  it('captures factory errors gracefully', async () => {
    const factory = new KnowledgeFactory(stubRepo);
    const res = await factory.createNode({
      graphId,
      category: 'invalid_category' as never,
      label: 'x',
    });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });
});

describe('KnowledgeFactory createEdge', () => {
  it('creates an edge with a custom relationship type', async () => {
    const factory = new KnowledgeFactory(stubRepo);
    const res = await factory.createEdge({
      graphId,
      sourceId: createKnowledgeNodeId('n1'),
      targetId: createKnowledgeNodeId('n2'),
      relationshipType: 'HAS_GOAL',
      relationshipCategory: 'ownership',
      label: 'has goal',
      weight: 0.8,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.type.type).toBe('HAS_GOAL');
      expect(res.data.weight).toBe(0.8);
      expect(res.data.source.type).toBe('system_generated');
    }
  });

  it('creates an edge with an explicit source type', async () => {
    const factory = new KnowledgeFactory(stubRepo);
    const res = await factory.createEdge({
      graphId,
      sourceId: createKnowledgeNodeId('n1'),
      targetId: createKnowledgeNodeId('n2'),
      relationshipType: 'DEPENDS_ON',
      relationshipCategory: 'dependency',
      sourceType: 'user_input',
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.source.type).toBe('user_input');
  });

  it('captures edge factory errors', async () => {
    const factory = new KnowledgeFactory(stubRepo);
    const res = await factory.createEdge({
      graphId,
      sourceId: createKnowledgeNodeId('n1'),
      targetId: createKnowledgeNodeId('n1'), // self-reference
      relationshipType: 'X',
      relationshipCategory: 'association',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('self-referencing');
  });
});

describe('KnowledgeFactory reconstructNode', () => {
  it('reconstructs with full persisted data', () => {
    const node = KnowledgeFactory.reconstructNode({
      id: 'n-recon',
      graphId: 'g-recon',
      category: 'skill',
      label: 'Reconstructed',
      description: 'desc',
      status: 'active',
      confidence: 'high',
      confidenceScore: 0.9,
      sourceType: 'import',
      sourceDetail: 'csv',
      accuracy: 0.9,
      completeness: 0.8,
      consistency: 0.7,
      timeliness: 0.6,
      relevance: 0.5,
      major: 2,
      minor: 1,
      patch: 3,
      tags: ['a'],
      metadata: { m: 1 },
    });
    expect(node.label).toBe('Reconstructed');
    expect(node.status.isActive).toBe(true);
    expect(node.confidence.level).toBe('high');
    expect(node.source.type).toBe('import');
    expect(node.quality.accuracy).toBe(0.9);
    expect(node.version.major).toBe(2);
    expect(node.lineage.length).toBe(1);
    expect(node.tags).toEqual(['a']);
  });

  it('reconstructs with defaults when fields are absent', () => {
    const node = KnowledgeFactory.reconstructNode({
      id: 'n-def',
      graphId: 'g-def',
      category: 'skill',
      label: 'Defaults',
    });
    expect(node.status.isActive).toBe(true);
    expect(node.confidence.level).toBe('unknown');
    expect(node.source.type).toBe('system_generated');
    expect(node.quality.accuracy).toBe(0.5);
    expect(node.version.major).toBe(1);
    expect(node.entityStatus).toBe('active');
  });
});

describe('KnowledgeFactory reconstructEdge', () => {
  it('reconstructs an edge from persisted data', () => {
    const edge = KnowledgeFactory.reconstructEdge({
      id: 'e-recon',
      graphId: 'g-recon',
      sourceId: 'n1',
      targetId: 'n2',
      type: 'DEPENDS_ON',
      category: 'dependency',
      label: 'depends on',
      weight: 0.6,
      accuracy: 0.9,
      completeness: 0.7,
      sourceType: 'user_input',
    });
    expect(edge.type.type).toBe('DEPENDS_ON');
    expect(edge.sourceId).toBe(createKnowledgeNodeId('n1'));
    expect(edge.weight).toBe(0.6);
    expect(edge.confidence.level).toBe('high');
    expect(edge.source.type).toBe('user_input');
    expect(edge.id).toBe(createKnowledgeEdgeId('e-recon'));
  });

  it('reconstructs an edge with defaults', () => {
    const edge = KnowledgeFactory.reconstructEdge({
      id: 'e-def',
      graphId: 'g-def',
      sourceId: 'n1',
      targetId: 'n2',
      type: 'RELATED_TO',
      category: 'association',
    });
    expect(edge.type.label).toBe('related to');
    expect(edge.weight).toBe(0.5);
    expect(edge.confidence.level).toBe('medium');
    expect(edge.entityStatus).toBe('active');
  });
});
