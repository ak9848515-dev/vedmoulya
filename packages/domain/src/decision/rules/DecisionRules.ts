// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Business Rules
// Domain validation rules for decision operations
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { Decision } from '../entities/Decision.js';

export interface RuleResult {
  valid: boolean;
  message?: string;
}

export type Rule = (data: unknown) => RuleResult;

// ── Decision Validation Rules ─────────────────────────────────────────────

/** Validate decision title and description */
export const decisionContentRule: Rule = (data: unknown) => {
  const decision = data as Decision;
  if (!decision.title || decision.title.trim().length === 0) {
    return { valid: false, message: 'Decision title must not be empty' };
  }
  if (decision.title.length > 200) {
    return { valid: false, message: 'Decision title must be at most 200 characters' };
  }
  if (!decision.description || decision.description.trim().length === 0) {
    return { valid: false, message: 'Decision description must not be empty' };
  }
  return { valid: true };
};

/** Validate that decided decisions have reasoning */
export const reasoningRequiredRule: Rule = (data: unknown) => {
  const decision = data as Decision;
  if (decision.status.isDecided && !decision.reasoning) {
    return { valid: false, message: 'Decided decisions must include reasoning' };
  }
  return { valid: true };
};

/** Validate that completed decisions have an outcome */
export const outcomeRequiredRule: Rule = (data: unknown) => {
  const decision = data as Decision;
  if (decision.status.isCompleted && !decision.outcome) {
    return { valid: false, message: 'Completed decisions must have an outcome recorded' };
  }
  return { valid: true };
};

/** Validate that evaluated decisions have at least one option */
export const optionsRequiredRule: Rule = (data: unknown) => {
  const decision = data as Decision;
  if (decision.status.isEvaluating && decision.options.length === 0) {
    return { valid: false, message: 'Evaluation requires at least one option' };
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
