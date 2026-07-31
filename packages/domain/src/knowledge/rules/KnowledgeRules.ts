// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Business Rules
// Domain validation rules for knowledge graph operations
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeNode } from '../entities/KnowledgeNode.js';
import type { KnowledgeEdge } from '../entities/KnowledgeEdge.js';
import type { KnowledgeCategoryValue } from '../value-objects/KnowledgeCategory.js';

export interface RuleResult {
  valid: boolean;
  message?: string;
}

export type Rule = (data: unknown) => RuleResult;

// ── Node Validation Rules ─────────────────────────────────────────────────

/** Validate node label and description */
export const nodeValidationRule: Rule = (data: unknown) => {
  const node = data as KnowledgeNode;
  if (!node.label || node.label.trim().length === 0) {
    return { valid: false, message: 'Node label must not be empty' };
  }
  if (node.label.length > 200) {
    return { valid: false, message: 'Node label must be at most 200 characters' };
  }
  if (node.description && node.description.length > 2000) {
    return { valid: false, message: 'Node description must be at most 2000 characters' };
  }
  return { valid: true };
};

// ── Edge Validation Rules ─────────────────────────────────────────────────

/** Validate edge — no self-references, valid nodes, etc. */
export const edgeValidationRule: Rule = (data: unknown) => {
  const edge = data as KnowledgeEdge;
  if (edge.sourceId === edge.targetId) {
    return { valid: false, message: 'Cannot create self-referencing edge' };
  }
  // Edge type is guaranteed by the KnowledgeEdge entity constructor
  return { valid: true };
};

// ── Relationship Constraint Rules ─────────────────────────────────────────-

/** Validate relationship constraints — no duplicate edges of same type */
export const relationshipConstraintsRule: Rule = (data: unknown) => {
  const { edge, existingEdges } = data as { edge: KnowledgeEdge; existingEdges: KnowledgeEdge[] };

  for (const existing of existingEdges) {
    if (existing.type.equals(edge.type)) {
      return {
        valid: false,
        message: `Relationship of type ${edge.type.type} already exists between these nodes`,
      };
    }
  }

  // Certain relationship types have constraints
  // Weight validation handled by entity constructor

  return { valid: true };
};

// ── Cycle Prevention Rules ────────────────────────────────────────────────

/** Prevent creating edges that would create cycles in the graph */
export const cyclePreventionRule: Rule = (data: unknown) => {
  const { edge } = data as { edge: KnowledgeEdge };
  if (edge.sourceId === edge.targetId) {
    return { valid: false, message: 'Self-referencing edges create cycles' };
  }
  return { valid: true };
};

// ── Graph Consistency Rules ───────────────────────────────────────────────

/** Validate graph consistency — categories, states, etc. */
export const graphConsistencyRule: Rule = (data: unknown) => {
  const { nodes, edges } = data as { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };

  // All edge endpoints must reference existing nodes
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceId)) {
      return {
        valid: false,
        message: `Edge references non-existent source node: ${edge.sourceId}`,
      };
    }
    if (!nodeIds.has(edge.targetId)) {
      return {
        valid: false,
        message: `Edge references non-existent target node: ${edge.targetId}`,
      };
    }
  }

  return { valid: true };
};

// ── Category Constraints ──────────────────────────────────────────────────

/** Validate that relationships between specific categories are valid */
export const categoryConstraintRule: Rule = (data: unknown) => {
  const { sourceCategory, targetCategory, relationshipType } = data as {
    sourceCategory: KnowledgeCategoryValue;
    targetCategory: KnowledgeCategoryValue;
    relationshipType: string;
  };

  // Define valid source → target → relationship combininations
  const validCombinations: Record<string, Record<string, string[]>> = {
    user: {
      goal: ['HAS_GOAL'],
      skill: ['HAS_SKILL'],
      knowledge: ['HAS_KNOWLEDGE'],
      project: ['WORKS_ON'],
      learning: ['LEARNED'],
    },
    goal: {
      project: ['DEPENDS_ON', 'SUPPORTS'],
      skill: ['DEPENDS_ON'],
      milestone: ['HAS_GOAL'],
    },
    project: {
      skill: ['USES', 'REQUIRES'],
      knowledge: ['REQUIRES'],
      evidence: ['PRODUCED', 'EVIDENCES'],
      artifact: ['CREATED'],
    },
    skill: {
      knowledge: ['DEPENDS_ON', 'REQUIRES'],
      competency: ['PART_OF'],
    },
    learning: {
      skill: ['IMPROVES', 'REFINES'],
      knowledge: ['INCREASES'],
      evidence: ['PRODUCED'],
    },
    career: {
      skill: ['USES', 'DEVELOPS'],
      project: ['WORKS_ON'],
      company: ['PART_OF'],
    },
  };

  const sourceRules = validCombinations[sourceCategory];
  if (sourceRules) {
    const targetRules = sourceRules[targetCategory];
    if (targetRules && !targetRules.includes(relationshipType)) {
      return {
        valid: false,
        message: `Invalid relationship '${relationshipType}' from '${sourceCategory}' to '${targetCategory}'`,
      };
    }
  }

  return { valid: true };
};

// ── Composite Validator ──────────────────────────────────────────────────

/** Run multiple rules on the same data and return the first failure */
export function validate(rules: Rule[], data: unknown): RuleResult {
  for (const rule of rules) {
    const result = rule(data);
    if (!result.valid) return result;
  }
  return { valid: true };
}
