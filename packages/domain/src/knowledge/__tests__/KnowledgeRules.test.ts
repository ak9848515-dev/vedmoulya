// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Rules Tests
// Covers every business rule and the composite validate() function.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  nodeValidationRule,
  edgeValidationRule,
  relationshipConstraintsRule,
  cyclePreventionRule,
  graphConsistencyRule,
  categoryConstraintRule,
  validate,
  type Rule,
} from '../rules/KnowledgeRules.js';
import { KnowledgeNode } from '../entities/KnowledgeNode.js';
import { KnowledgeEdge } from '../entities/KnowledgeEdge.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import { RelationshipType } from '../value-objects/RelationshipType.js';
import { createKnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import { createKnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import { createGraphId } from '../value-objects/GraphId.js';

const graphId = createGraphId('g-rules');

function node(label: string, description?: string): KnowledgeNode {
  return KnowledgeNode.create({
    // The node id is the raw label so it matches the endpoints used by the
    // edge() helper in graphConsistencyRule assertions.
    id: createKnowledgeNodeId(label),
    graphId,
    category: KnowledgeCategory.skill(),
    label,
    description,
  });
}

function edge(source: string, target: string): KnowledgeEdge {
  return KnowledgeEdge.create({
    id: createKnowledgeEdgeId(`e-${source}-${target}`),
    graphId,
    sourceId: createKnowledgeNodeId(source),
    targetId: createKnowledgeNodeId(target),
    type: RelationshipType.DEPENDS_ON(),
  });
}

// KnowledgeEdge.create() rejects self-referencing edges at the factory, so a
// self-edge must be built through the constructor to exercise the rules that
// validate against self-references (edgeValidationRule, cyclePreventionRule).
function selfEdge(): KnowledgeEdge {
  return new KnowledgeEdge({
    id: createKnowledgeEdgeId('e-self'),
    graphId,
    sourceId: createKnowledgeNodeId('n1'),
    targetId: createKnowledgeNodeId('n1'),
    type: RelationshipType.DEPENDS_ON(),
  });
}

describe('nodeValidationRule', () => {
  it('rejects empty and oversized labels', () => {
    expect(nodeValidationRule(node('')).valid).toBe(false);
    expect(nodeValidationRule(node('x'.repeat(201))).valid).toBe(false);
  });

  it('rejects oversized descriptions', () => {
    expect(nodeValidationRule(node('ok', 'd'.repeat(2001))).valid).toBe(false);
  });

  it('accepts a valid node', () => {
    expect(nodeValidationRule(node('valid')).valid).toBe(true);
  });
});

describe('edgeValidationRule', () => {
  it('rejects self-referencing edges', () => {
    expect(edgeValidationRule(selfEdge()).valid).toBe(false);
  });

  it('accepts a valid edge', () => {
    expect(edgeValidationRule(edge('n1', 'n2')).valid).toBe(true);
  });
});

describe('relationshipConstraintsRule', () => {
  it('rejects duplicate relationship types', () => {
    const e = edge('n1', 'n2');
    const res = relationshipConstraintsRule({ edge: e, existingEdges: [e] });
    expect(res.valid).toBe(false);
    expect(res.message).toContain('already exists');
  });

  it('accepts distinct relationship types', () => {
    const e1 = edge('n1', 'n2');
    const different = KnowledgeEdge.create({
      id: createKnowledgeEdgeId('e-x'),
      graphId,
      sourceId: createKnowledgeNodeId('n1'),
      targetId: createKnowledgeNodeId('n2'),
      type: RelationshipType.SUPPORTS(),
    });
    expect(relationshipConstraintsRule({ edge: e1, existingEdges: [different] }).valid).toBe(true);
  });
});

describe('cyclePreventionRule', () => {
  it('rejects self-referencing edges', () => {
    expect(cyclePreventionRule({ edge: selfEdge() }).valid).toBe(false);
  });

  it('accepts normal edges', () => {
    expect(cyclePreventionRule({ edge: edge('n1', 'n2') }).valid).toBe(true);
  });
});

describe('graphConsistencyRule', () => {
  it('rejects edges referencing missing nodes', () => {
    const nodes = [node('n1')];
    const badSource = graphConsistencyRule({ nodes, edges: [edge('missing', 'n1')] });
    expect(badSource.valid).toBe(false);
    expect(badSource.message).toContain('source');

    const badTarget = graphConsistencyRule({ nodes, edges: [edge('n1', 'missing')] });
    expect(badTarget.valid).toBe(false);
    expect(badTarget.message).toContain('target');
  });

  it('accepts a consistent graph', () => {
    const nodes = [node('n1'), node('n2')];
    expect(graphConsistencyRule({ nodes, edges: [edge('n1', 'n2')] }).valid).toBe(true);
  });
});

describe('categoryConstraintRule', () => {
  it('rejects an invalid relationship combination', () => {
    const res = categoryConstraintRule({
      sourceCategory: 'user',
      targetCategory: 'goal',
      relationshipType: 'WORKS_ON',
    });
    expect(res.valid).toBe(false);
    expect(res.message).toContain('Invalid relationship');
  });

  it('accepts a valid combination', () => {
    expect(
      categoryConstraintRule({
        sourceCategory: 'user',
        targetCategory: 'goal',
        relationshipType: 'HAS_GOAL',
      }).valid,
    ).toBe(true);
  });

  it('accepts unknown source categories (no constraint table)', () => {
    expect(
      categoryConstraintRule({
        sourceCategory: 'memory',
        targetCategory: 'goal',
        relationshipType: 'ANY',
      }).valid,
    ).toBe(true);
  });
});

describe('validate', () => {
  it('returns the first failing rule', () => {
    const rules: Rule[] = [nodeValidationRule, edgeValidationRule];
    const res = validate(rules, selfEdge());
    expect(res.valid).toBe(false);
  });

  it('returns valid when all rules pass', () => {
    const rules: Rule[] = [nodeValidationRule];
    expect(validate(rules, node('fine')).valid).toBe(true);
  });
});
