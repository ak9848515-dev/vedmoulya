// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Learning Rules
// EI-007 — Enterprise Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  categoryRule,
  outcomeRule,
  entityRule,
  boundedScoreRule,
  nonNegativeRule,
  validateLearningEvent,
  recommendationEligibilityRule,
  validate,
  DEFAULT_SAFETY_THRESHOLDS,
} from '../LearningRules.js';
import type { LearningEvent } from '../../../types/learning-types.js';

function validEvent(overrides: Partial<LearningEvent> = {}): LearningEvent {
  return {
    eventId: 'levent_1',
    category: 'provider',
    entityType: 'provider',
    entityId: 'openai',
    entityLabel: 'OpenAI',
    outcome: 'success',
    confidence: 0.9,
    costUsd: 0.01,
    latencyMs: 400,
    accuracy: 0.95,
    retries: 0,
    quality: 0.92,
    metadata: {},
    occurredAt: '2026-08-01T10:00:00.000Z',
    createdAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('LearningRules — categoryRule', () => {
  it('accepts every declared category', () => {
    expect(categoryRule('provider').passed).toBe(true);
    expect(categoryRule('failure').passed).toBe(true);
    expect(categoryRule('user_preference').passed).toBe(true);
  });

  it('rejects unknown categories', () => {
    const rule = categoryRule('unknown' as never);
    expect(rule.passed).toBe(false);
    expect(rule.message).toContain('Unknown learning category');
  });
});

describe('LearningRules — outcomeRule', () => {
  it('accepts success and failure', () => {
    expect(outcomeRule('success').passed).toBe(true);
    expect(outcomeRule('failure').passed).toBe(true);
  });

  it('rejects unknown outcomes', () => {
    expect(outcomeRule('maybe' as never).passed).toBe(false);
  });
});

describe('LearningRules — entityRule', () => {
  it('rejects empty entityId / entityType', () => {
    expect(entityRule('', 'provider').passed).toBe(false);
    expect(entityRule('  ', 'provider').passed).toBe(false);
    expect(entityRule('openai', '').passed).toBe(false);
  });

  it('accepts non-empty ids', () => {
    expect(entityRule('openai', 'provider').passed).toBe(true);
  });
});

describe('LearningRules — score & cost rules', () => {
  it('bounds scores to [0, 1]', () => {
    expect(boundedScoreRule(0.5, 'quality').passed).toBe(true);
    expect(boundedScoreRule(0, 'quality').passed).toBe(true);
    expect(boundedScoreRule(1, 'quality').passed).toBe(true);
    expect(boundedScoreRule(1.1, 'quality').passed).toBe(false);
    expect(boundedScoreRule(-0.1, 'quality').passed).toBe(false);
    expect(boundedScoreRule(Number.NaN, 'quality').passed).toBe(false);
  });

  it('requires non-negative quantities', () => {
    expect(nonNegativeRule(0, 'costUsd').passed).toBe(true);
    expect(nonNegativeRule(-1, 'costUsd').passed).toBe(false);
    expect(nonNegativeRule(Number.NaN, 'costUsd').passed).toBe(false);
  });
});

describe('LearningRules — validateLearningEvent', () => {
  it('accepts a valid event', () => {
    expect(validateLearningEvent(validEvent()).passed).toBe(true);
  });

  it('rejects invalid category', () => {
    const rule = validateLearningEvent(validEvent({ category: 'bogus' as never }));
    expect(rule.passed).toBe(false);
  });

  it('rejects out-of-range confidence', () => {
    const rule = validateLearningEvent(validEvent({ confidence: 1.5 }));
    expect(rule.passed).toBe(false);
    expect(rule.message).toContain('confidence');
  });

  it('rejects negative cost', () => {
    const rule = validateLearningEvent(validEvent({ costUsd: -0.5 }));
    expect(rule.passed).toBe(false);
    expect(rule.message).toContain('costUsd');
  });

  it('rejects out-of-range feedback', () => {
    const rule = validateLearningEvent(validEvent({ feedback: 2 }));
    expect(rule.passed).toBe(false);
  });

  it('rejects malformed occurredAt', () => {
    const rule = validateLearningEvent(validEvent({ occurredAt: 'not-a-date' }));
    expect(rule.passed).toBe(false);
    expect(rule.message).toContain('occurredAt');
  });
});

describe('LearningRules — safety eligibility', () => {
  it('gates on sample count and confidence', () => {
    const t = DEFAULT_SAFETY_THRESHOLDS;
    const lowSamples = recommendationEligibilityRule(1, 0.95, t);
    expect(lowSamples.passed).toBe(false);
    expect(lowSamples.message).toContain('Insufficient samples');

    const lowConfidence = recommendationEligibilityRule(10, 0.3, t);
    expect(lowConfidence.passed).toBe(false);
    expect(lowConfidence.message).toContain('Confidence below');

    const ok = recommendationEligibilityRule(10, 0.8, t);
    expect(ok.passed).toBe(true);
  });
});

describe('LearningRules — validate composed', () => {
  it('returns the first failing rule', () => {
    const result = validate([categoryRule('provider'), outcomeRule('nope' as never)]);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('outcome');
  });

  it('passes when all rules pass', () => {
    expect(validate([categoryRule('provider'), outcomeRule('success')]).passed).toBe(true);
  });
});
