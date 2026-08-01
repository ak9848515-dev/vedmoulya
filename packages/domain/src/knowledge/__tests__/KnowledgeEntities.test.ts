// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Entities Tests
// Covers KnowledgeNode, KnowledgeEdge, and Relationship entities.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeNode } from '../entities/KnowledgeNode.js';
import { KnowledgeEdge } from '../entities/KnowledgeEdge.js';
import { Relationship } from '../entities/Relationship.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import { KnowledgeStatus } from '../value-objects/KnowledgeStatus.js';
import { KnowledgeConfidence } from '../value-objects/KnowledgeConfidence.js';
import { KnowledgeSource } from '../value-objects/KnowledgeSource.js';
import { KnowledgeQuality } from '../value-objects/KnowledgeQuality.js';
import { KnowledgeVersion } from '../value-objects/KnowledgeVersion.js';
import { RelationshipType } from '../value-objects/RelationshipType.js';
import { createKnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import { createKnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import { createGraphId } from '../value-objects/GraphId.js';

const graphId = createGraphId('g-entities');
const nid = (n: number) => createKnowledgeNodeId(`n${String(n)}`);
const eid = (n: number) => createKnowledgeEdgeId(`e${String(n)}`);

function makeNode(n: number): KnowledgeNode {
  return KnowledgeNode.create({
    id: nid(n),
    graphId,
    category: KnowledgeCategory.skill(),
    label: `Node ${String(n)}`,
  });
}

function makeEdge(a: number, b: number): KnowledgeEdge {
  return KnowledgeEdge.create({
    id: eid(Number(`${a}${b}`)),
    graphId,
    sourceId: nid(a),
    targetId: nid(b),
    type: RelationshipType.DEPENDS_ON(),
  });
}

describe('KnowledgeNode', () => {
  it('creates with defaults and exposes getters', () => {
    const node = makeNode(1);
    expect(node.id).toBe(nid(1));
    expect(node.graphId).toBe(graphId);
    expect(node.category.value).toBe('skill');
    expect(node.description).toBe('');
    expect(node.metadata).toEqual({});
    expect(node.status.isDraft).toBe(true);
    expect(node.confidence.level).toBe('unknown');
    expect(node.source.type).toBe('system_generated');
    expect(node.quality.accuracy).toBe(0.5);
    expect(node.version.major).toBe(1);
    expect(node.lineage.length).toBe(1);
    expect(node.entityStatus).toBe('active');
    expect(node.tags).toEqual([]);
  });

  it('create emits a node.created event', () => {
    const node = makeNode(2);
    const events = node.pullEvents();
    expect(events.some((e) => e.type === 'knowledge.node.created')).toBe(true);
    expect(node.pullEvents()).toHaveLength(0);
  });

  it('update bumps the patch version and emits an event', () => {
    const node = makeNode(3);
    node.update('New label', 'New description');
    expect(node.label).toBe('New label');
    expect(node.description).toBe('New description');
    expect(node.version.patch).toBe(1);
    expect(node.pullEvents().some((e) => e.type === 'knowledge.node.updated')).toBe(true);
  });

  it('updateMetadata merges metadata', () => {
    const node = makeNode(4);
    node.updateMetadata({ owner: 'me' });
    expect(node.metadata).toEqual({ owner: 'me' });
  });

  it('changeCategory bumps minor version', () => {
    const node = makeNode(5);
    node.changeCategory(KnowledgeCategory.goal());
    expect(node.category.value).toBe('goal');
    expect(node.version.minor).toBe(1);
  });

  it('transitionStatus enforces lifecycle transitions', () => {
    const node = makeNode(6);
    node.transitionStatus(KnowledgeStatus.active());
    expect(node.status.isActive).toBe(true);
    node.transitionStatus(KnowledgeStatus.archived('done'));
    expect(node.status.isArchived).toBe(true);
    expect(() => node.transitionStatus(KnowledgeStatus.active())).toThrow(/Cannot transition/);
  });

  it('updateConfidence, updateQuality, tags, and archive behave correctly', () => {
    const node = makeNode(7);
    node.updateConfidence(KnowledgeConfidence.high());
    expect(node.confidence.level).toBe('high');

    node.updateQuality(KnowledgeQuality.high());
    expect(node.quality.isHighQuality()).toBe(true);

    node.addTag('ts');
    node.addTag('ts'); // duplicate ignored
    node.removeTag('ts');
    expect(node.tags).toEqual([]);

    node.archive();
    expect(node.entityStatus).toBe('archived');
    expect(node.status.isArchived).toBe(true);
  });
});

describe('KnowledgeEdge', () => {
  it('creates with defaults (label from type, weight clamp)', () => {
    const edge = makeEdge(1, 2);
    expect(edge.id).toBe(eid(12));
    expect(edge.sourceId).toBe(nid(1));
    expect(edge.targetId).toBe(nid(2));
    expect(edge.type.type).toBe('DEPENDS_ON');
    expect(edge.label).toBe('depends on');
    expect(edge.metadata).toEqual({});
    expect(edge.weight).toBe(0.5);
    expect(edge.confidence.level).toBe('medium');
    expect(edge.status.isActive).toBe(true);
    expect(edge.entityStatus).toBe('active');
  });

  it('rejects self-referencing edges at creation', () => {
    expect(() =>
      KnowledgeEdge.create({
        id: eid(99),
        graphId,
        sourceId: nid(1),
        targetId: nid(1),
        type: RelationshipType.DEPENDS_ON(),
      }),
    ).toThrow(/self-referencing/);
  });

  it('clamps weight to 0..1', () => {
    const over = KnowledgeEdge.create({
      id: eid(88),
      graphId,
      sourceId: nid(1),
      targetId: nid(2),
      type: RelationshipType.SUPPORTS(),
      weight: 5,
    });
    expect(over.weight).toBe(1);
    over.updateWeight(-2);
    expect(over.weight).toBe(0);
  });

  it('changeType updates the type and label', () => {
    const edge = makeEdge(1, 2);
    edge.changeType(RelationshipType.SUPPORTS());
    expect(edge.type.type).toBe('SUPPORTS');
    expect(edge.label).toBe('supports');
  });

  it('updateConfidence, updateMetadata, validate, invalidate, archive, events', () => {
    const edge = makeEdge(1, 2);
    edge.updateConfidence(KnowledgeConfidence.low());
    expect(edge.confidence.level).toBe('low');
    edge.updateMetadata({ k: 'v' });
    expect(edge.metadata).toEqual({ k: 'v' });
    edge.validate();
    edge.invalidate('stale');
    expect(edge.status.isInvalidated).toBe(true);
    edge.archive();
    expect(edge.entityStatus).toBe('archived');
    expect(edge.pullEvents().length).toBeGreaterThan(0);
  });
});

describe('Relationship', () => {
  it('wraps an edge with direction/strength defaults', () => {
    const rel = new Relationship(makeEdge(1, 2));
    expect(rel.direction).toBe('directed');
    expect(rel.strength).toBe('moderate');
    expect(rel.description).toBe('depends on');
    expect(rel.weight).toBe(0.5);
    expect(rel.id).toBe(eid(12));
  });

  it('makeBidirectional and updateStrength', () => {
    const rel = new Relationship(makeEdge(1, 2));
    rel.makeBidirectional();
    expect(rel.direction).toBe('bidirectional');
    rel.updateStrength('strong');
    expect(rel.edge.weight).toBe(0.9);
    rel.updateStrength('weak');
    expect(rel.edge.weight).toBe(0.2);
  });

  it('updateDescription and isSelfReference', () => {
    const rel = new Relationship(makeEdge(1, 2));
    rel.updateDescription('custom');
    expect(rel.description).toBe('custom');
    expect(rel.isSelfReference()).toBe(false);
  });

  it('getInverseType maps known types and returns null otherwise', () => {
    const depends = new Relationship(makeEdge(1, 2));
    expect(depends.getInverseType()?.type).toBe('SUPPORTS');

    const custom = new Relationship(
      KnowledgeEdge.create({
        id: eid(77),
        graphId,
        sourceId: nid(1),
        targetId: nid(2),
        type: RelationshipType.custom('UNIQUE_X', 'association', 'unique x'),
      }),
    );
    expect(custom.getInverseType()).toBeNull();
  });

  it('static create builds a Relationship with a fresh edge', () => {
    const rel = Relationship.create({
      edgeId: eid(66),
      graphId,
      sourceId: nid(1),
      targetId: nid(2),
      type: RelationshipType.REFERENCES(),
      direction: 'bidirectional',
      strength: 'weak',
      description: 'desc',
      weight: 0.3,
      source: KnowledgeSource.userInput('u'),
    });
    expect(rel.id).toBe(eid(66));
    expect(rel.direction).toBe('bidirectional');
    expect(rel.strength).toBe('weak');
    expect(rel.edge.source.type).toBe('user_input');
  });
});
