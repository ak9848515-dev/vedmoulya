// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Business Rules
// Domain validation rules for memory operations
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { Memory } from '../entities/Memory.js';

export interface RuleResult {
  valid: boolean;
  message?: string;
}

export type Rule = (data: unknown) => RuleResult;

// ── Memory Validation Rules ───────────────────────────────────────────────

/** Validate memory title and content */
export const memoryContentRule: Rule = (data: unknown) => {
  const memory = data as Memory;
  if (!memory.title || memory.title.trim().length === 0) {
    return { valid: false, message: 'Memory title must not be empty' };
  }
  if (memory.title.length > 200) {
    return { valid: false, message: 'Memory title must be at most 200 characters' };
  }
  if (!memory.content || memory.content.trim().length === 0) {
    return { valid: false, message: 'Memory content must not be empty' };
  }
  if (memory.content.length > 10000) {
    return { valid: false, message: 'Memory content must be at most 10000 characters' };
  }
  return { valid: true };
};

// ── Importance Rules ──────────────────────────────────────────────────────

/** Validate importance constraints */
export const importanceConstraintRule: Rule = (data: unknown) => {
  const memory = data as Memory;
  if (memory.importance.score < 1 || memory.importance.score > 10) {
    return { valid: false, message: 'Importance score must be between 1 and 10' };
  }
  return { valid: true };
};

// ── Retention Rules ───────────────────────────────────────────────────────

/** Validate retention policy constraints */
export const retentionPolicyRule: Rule = (data: unknown) => {
  const memory = data as Memory;
  if (memory.retentionPolicy.isPermanent && memory.importance.score < 7) {
    return { valid: false, message: 'Permanent retention requires importance >= 7' };
  }
  return { valid: true };
};

// ── Knowledge Graph Link Rules ────────────────────────────────────────────

/** Memory must reference Knowledge Graph nodes, never duplicate them */
export const knowledgeGraphReferenceRule: Rule = (data: unknown) => {
  const memory = data as Memory;
  if (memory.knowledgeNodeId && memory.knowledgeNodeId.trim().length === 0) {
    return { valid: false, message: 'Knowledge Graph reference must not be empty' };
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
