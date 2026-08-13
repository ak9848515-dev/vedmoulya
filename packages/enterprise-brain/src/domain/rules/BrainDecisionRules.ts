// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain Rules
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Validation + lifecycle rules for decisions and plans. Pure functions
// returning `RuleResult` (same shape as the capabilities registry and
// learning rules) so the application service re-validates at the
// boundary and tests can exercise each rule.
// ──────────────────────────────────────────────────────────────────

import type {
  BrainDecision,
  BrainDecisionPlan,
  BrainDecisionStatus,
  BrainDecisionType,
} from '../../types/brain-types.js';
import { BRAIN_DECISION_STATUSES, BRAIN_DECISION_TYPES } from '../../types/brain-types.js';

export interface RuleResult {
  passed: boolean;
  message?: string;
}

// ── Enum membership rules ───────────────────────────────────────────────────

export function decisionTypeRule(type: BrainDecisionType): RuleResult {
  if (!BRAIN_DECISION_TYPES.includes(type)) {
    return { passed: false, message: `Unknown decision type: ${type}` };
  }
  return { passed: true };
}

export function decisionStatusRule(status: BrainDecisionStatus): RuleResult {
  if (!BRAIN_DECISION_STATUSES.includes(status)) {
    return { passed: false, message: `Unknown decision status: ${status}` };
  }
  return { passed: true };
}

// ── Numeric bound rules ─────────────────────────────────────────────────────

export function confidenceRule(score: number): RuleResult {
  if (Number.isNaN(score) || score < 0 || score > 1) {
    return { passed: false, message: 'confidence must be within [0, 1]' };
  }
  return { passed: true };
}

export function nonNegativeRule(value: number, field: string): RuleResult {
  if (Number.isNaN(value) || value < 0) {
    return { passed: false, message: `${field} must be >= 0` };
  }
  return { passed: true };
}

// ── Entity shape rules ──────────────────────────────────────────────────────

export function entityRule(entityId: string, field: string): RuleResult {
  if (!entityId || entityId.trim().length === 0) {
    return { passed: false, message: `${field} is required` };
  }
  return { passed: true };
}

// ── Full decision validation ────────────────────────────────────────────────

export function validateDecision(decision: BrainDecision): RuleResult {
  const checks: RuleResult[] = [
    decisionTypeRule(decision.type),
    decisionStatusRule(decision.status),
    entityRule(decision.decisionId, 'decisionId'),
    entityRule(decision.planId, 'planId'),
    entityRule(decision.goalId, 'goalId'),
    entityRule(decision.recommendation.entityId, 'recommendation.entityId'),
    confidenceRule(decision.confidence.score),
    nonNegativeRule(decision.version, 'version'),
  ];
  if (Number.isNaN(Date.parse(decision.createdAt))) {
    return { passed: false, message: 'createdAt must be a valid ISO date' };
  }
  for (const check of checks) {
    if (!check.passed) return check;
  }
  return { passed: true };
}

// ── Plan validation ─────────────────────────────────────────────────────────

export function validatePlan(plan: BrainDecisionPlan): RuleResult {
  const checks: RuleResult[] = [
    entityRule(plan.planId, 'planId'),
    entityRule(plan.goalId, 'goalId'),
    decisionStatusRule(plan.status),
    confidenceRule(plan.overallConfidence),
    nonNegativeRule(plan.version, 'version'),
  ];
  if (Number.isNaN(Date.parse(plan.createdAt))) {
    return { passed: false, message: 'createdAt must be a valid ISO date' };
  }
  if (plan.decisions.length === 0) {
    return { passed: false, message: 'a plan must contain at least one decision' };
  }
  for (const check of checks) {
    if (!check.passed) return check;
  }
  return { passed: true };
}

// ── Lifecycle transition rules (human-approval + handoff state machine) ─────

export function canTransitionDecision(
  from: BrainDecisionStatus,
  to: BrainDecisionStatus,
): { allowed: boolean; message?: string } {
  if (to === 'approved') {
    return from === 'proposed'
      ? { allowed: true }
      : { allowed: false, message: `Cannot approve a decision in state ${from}` };
  }
  if (to === 'rejected') {
    return from === 'proposed'
      ? { allowed: true }
      : { allowed: false, message: `Cannot reject a decision in state ${from}` };
  }
  if (to === 'handed_off') {
    return from === 'approved'
      ? { allowed: true }
      : { allowed: false, message: 'Only approved decisions can be handed to the orchestrator' };
  }
  if (to === 'superseded') {
    return from === 'proposed' || from === 'approved' || from === 'handed_off'
      ? { allowed: true }
      : { allowed: false, message: `Cannot supersede a decision in state ${from}` };
  }
  return { allowed: false, message: `Unknown transition target: ${to}` };
}

export function canTransitionPlan(
  from: BrainDecisionStatus,
  to: BrainDecisionStatus,
): { allowed: boolean; message?: string } {
  return canTransitionDecision(from, to);
}

// ── Composed validate() helper (same convention as CapabilityRules) ─────────

export function validate(rules: RuleResult[]): RuleResult {
  for (const rule of rules) {
    if (!rule.passed) return rule;
  }
  return { passed: true };
}
