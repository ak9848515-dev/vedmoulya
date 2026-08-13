// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Rules
// EI-007 — Enterprise Learning Intelligence Platform
// Validation + safety rules for learning events, models, and
// recommendations. Pure functions returning `RuleResult` (same shape as
// the capabilities registry rules) so the application service can
// re-validate at the boundary and tests can exercise each rule.
// ──────────────────────────────────────────────────────────────────

import type {
  LearningCategory,
  LearningEvent,
  LearningOutcome,
} from '../../types/learning-types.js';
import { LEARNING_CATEGORIES, LEARNING_OUTCOMES } from '../../types/learning-types.js';

export interface RuleResult {
  passed: boolean;
  message?: string;
}

// ── Event shape rules ───────────────────────────────────────────────────────

export function categoryRule(category: LearningCategory): RuleResult {
  if (!LEARNING_CATEGORIES.includes(category)) {
    return { passed: false, message: `Unknown learning category: ${category}` };
  }
  return { passed: true };
}

export function outcomeRule(outcome: LearningOutcome): RuleResult {
  if (!LEARNING_OUTCOMES.includes(outcome)) {
    return { passed: false, message: `Unknown learning outcome: ${outcome}` };
  }
  return { passed: true };
}

export function entityRule(entityId: string, entityType: string): RuleResult {
  if (!entityId || entityId.trim().length === 0) {
    return { passed: false, message: 'entityId is required' };
  }
  if (!entityType || entityType.trim().length === 0) {
    return { passed: false, message: 'entityType is required' };
  }
  return { passed: true };
}

export function boundedScoreRule(value: number, field: string): RuleResult {
  if (Number.isNaN(value) || value < 0 || value > 1) {
    return { passed: false, message: `${field} must be within [0, 1]` };
  }
  return { passed: true };
}

export function nonNegativeRule(value: number, field: string): RuleResult {
  if (Number.isNaN(value) || value < 0) {
    return { passed: false, message: `${field} must be >= 0` };
  }
  return { passed: true };
}

/** Full event validation — returns the first failure or passed. */
export function validateLearningEvent(event: LearningEvent): RuleResult {
  const checks: RuleResult[] = [
    categoryRule(event.category),
    outcomeRule(event.outcome),
    entityRule(event.entityId, event.entityType),
    boundedScoreRule(event.confidence, 'confidence'),
    nonNegativeRule(event.costUsd, 'costUsd'),
    nonNegativeRule(event.latencyMs, 'latencyMs'),
    boundedScoreRule(event.accuracy, 'accuracy'),
    nonNegativeRule(event.retries, 'retries'),
    boundedScoreRule(event.quality, 'quality'),
  ];
  if (event.feedback !== undefined) {
    checks.push(boundedScoreRule(event.feedback, 'feedback'));
  }
  if (event.businessOutcome !== undefined) {
    checks.push(boundedScoreRule(event.businessOutcome, 'businessOutcome'));
  }
  if (Number.isNaN(Date.parse(event.occurredAt))) {
    return { passed: false, message: 'occurredAt must be a valid ISO date' };
  }
  for (const check of checks) {
    if (!check.passed) return check;
  }
  return { passed: true };
}

// ── Aggregate safety thresholds ─────────────────────────────────────────────

export interface LearningSafetyThresholds {
  /** Minimum samples before a recommendation is even generated. */
  minSamplesForRecommendation: number;
  /** Minimum samples before a recommendation may be approved. */
  minSamplesForApproval: number;
  /** Minimum model confidence before a recommendation may be approved. */
  minConfidenceForApproval: number;
  /** Whether human approval is required to make a recommendation actionable. */
  approvalRequired: boolean;
}

export const DEFAULT_SAFETY_THRESHOLDS: LearningSafetyThresholds = {
  minSamplesForRecommendation: 3,
  minSamplesForApproval: 5,
  minConfidenceForApproval: 0.6,
  approvalRequired: true,
};

export function recommendationEligibilityRule(
  sampleCount: number,
  confidence: number,
  thresholds: LearningSafetyThresholds,
): RuleResult {
  if (sampleCount < thresholds.minSamplesForRecommendation) {
    return {
      passed: false,
      message: `Insufficient samples (${sampleCount} < ${thresholds.minSamplesForRecommendation})`,
    };
  }
  if (confidence < thresholds.minConfidenceForApproval) {
    return {
      passed: false,
      message: `Confidence below approval threshold (${confidence.toFixed(2)} < ${thresholds.minConfidenceForApproval})`,
    };
  }
  return { passed: true };
}

// ── Composed validate() helper (same convention as CapabilityRules) ─────────

export function validate(rules: RuleResult[]): RuleResult {
  for (const rule of rules) {
    if (!rule.passed) return rule;
  }
  return { passed: true };
}
