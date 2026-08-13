// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Enterprise Brain Rules
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  canTransitionDecision,
  canTransitionPlan,
  confidenceRule,
  decisionStatusRule,
  decisionTypeRule,
  entityRule,
  nonNegativeRule,
  validate,
  validateDecision,
  validatePlan,
} from '../BrainDecisionRules.js';
import type { BrainDecision, BrainDecisionPlan } from '../../../types/brain-types.js';

function baseDecision(overrides: Partial<BrainDecision> = {}): BrainDecision {
  return {
    decisionId: 'bd_plan_goal_1_provider_selection',
    planId: 'plan_goal_1',
    goalId: 'goal_1',
    type: 'provider_selection',
    title: 'Provider Selection',
    description: 'Pick a provider.',
    recommendation: {
      entityType: 'provider',
      entityId: 'openai',
      entityLabel: 'OpenAI',
      action: 'use',
      params: {},
    },
    confidence: { score: 0.8, level: 'high', factors: ['learned'] },
    reason: { why: 'why', evidence: ['e'], tradeoffs: ['t'], alternatives: ['a'], risks: ['r'] },
    context: {
      goalId: 'goal_1',
      goalTitle: 'G',
      goalCategory: 'business',
      goalPriority: 'high',
      business: [],
      engineSources: [],
      observedAt: '2026-08-01T00:00:00.000Z',
    },
    status: 'proposed',
    version: 1,
    actor: 'enterprise-brain',
    history: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('decisionTypeRule', () => {
  it('accepts every documented decision type', () => {
    expect(decisionTypeRule('provider_selection').passed).toBe(true);
    expect(decisionTypeRule('business_objectives').passed).toBe(true);
  });

  it('rejects unknown types', () => {
    const result = decisionTypeRule('unknown_thing' as never);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Unknown decision type');
  });
});

describe('decisionStatusRule', () => {
  it('accepts documented statuses', () => {
    expect(decisionStatusRule('proposed').passed).toBe(true);
    expect(decisionStatusRule('handed_off').passed).toBe(true);
  });

  it('rejects unknown statuses', () => {
    expect(decisionStatusRule('executed' as never).passed).toBe(false);
  });
});

describe('confidenceRule / nonNegativeRule / entityRule', () => {
  it('bounds confidence to [0, 1]', () => {
    expect(confidenceRule(0.5).passed).toBe(true);
    expect(confidenceRule(1).passed).toBe(true);
    expect(confidenceRule(1.1).passed).toBe(false);
    expect(confidenceRule(-0.1).passed).toBe(false);
    expect(confidenceRule(Number.NaN).passed).toBe(false);
  });

  it('rejects negative numerics', () => {
    expect(nonNegativeRule(3, 'version').passed).toBe(true);
    expect(nonNegativeRule(-1, 'version').passed).toBe(false);
  });

  it('requires entity ids', () => {
    expect(entityRule('x', 'goalId').passed).toBe(true);
    expect(entityRule('', 'goalId').passed).toBe(false);
    expect(entityRule('   ', 'goalId').passed).toBe(false);
  });
});

describe('validateDecision', () => {
  it('passes a well-formed decision', () => {
    expect(validateDecision(baseDecision()).passed).toBe(true);
  });

  it('rejects a decision with an invalid confidence', () => {
    const decision = baseDecision({ confidence: { score: 1.5, level: 'high', factors: [] } });
    const result = validateDecision(decision);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('confidence');
  });

  it('rejects a decision missing a recommendation entity', () => {
    const decision = baseDecision({
      recommendation: {
        entityType: 'provider',
        entityId: '',
        entityLabel: '',
        action: 'use',
        params: {},
      },
    });
    expect(validateDecision(decision).passed).toBe(false);
  });

  it('rejects an invalid created date', () => {
    const decision = baseDecision({ createdAt: 'not-a-date' });
    expect(validateDecision(decision).passed).toBe(false);
  });
});

describe('validatePlan', () => {
  it('passes a plan with decisions', () => {
    const plan: BrainDecisionPlan = {
      planId: 'plan_goal_1',
      goalId: 'goal_1',
      goalTitle: 'G',
      status: 'proposed',
      decisions: [baseDecision()],
      overallConfidence: 0.8,
      pipeline: [],
      version: 1,
      actor: 'enterprise-brain',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };
    expect(validatePlan(plan).passed).toBe(true);
  });

  it('rejects a plan with no decisions', () => {
    const plan: BrainDecisionPlan = {
      planId: 'plan_goal_1',
      goalId: 'goal_1',
      goalTitle: 'G',
      status: 'proposed',
      decisions: [],
      overallConfidence: 0.8,
      pipeline: [],
      version: 1,
      actor: 'enterprise-brain',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };
    const result = validatePlan(plan);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('at least one decision');
  });

  it('rejects a plan with out-of-range confidence', () => {
    const plan: BrainDecisionPlan = {
      planId: 'plan_goal_1',
      goalId: 'goal_1',
      goalTitle: 'G',
      status: 'proposed',
      decisions: [baseDecision()],
      overallConfidence: 1.5,
      pipeline: [],
      version: 1,
      actor: 'enterprise-brain',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };
    expect(validatePlan(plan).passed).toBe(false);
  });
});

describe('canTransitionDecision', () => {
  it('allows the documented lifecycle transitions', () => {
    expect(canTransitionDecision('proposed', 'approved').allowed).toBe(true);
    expect(canTransitionDecision('proposed', 'rejected').allowed).toBe(true);
    expect(canTransitionDecision('approved', 'handed_off').allowed).toBe(true);
    expect(canTransitionDecision('proposed', 'superseded').allowed).toBe(true);
    expect(canTransitionDecision('approved', 'superseded').allowed).toBe(true);
  });

  it('blocks invalid transitions', () => {
    expect(canTransitionDecision('proposed', 'handed_off').allowed).toBe(false);
    expect(canTransitionDecision('rejected', 'approved').allowed).toBe(false);
    expect(canTransitionDecision('handed_off', 'handed_off').allowed).toBe(false);
    expect(canTransitionDecision('proposed', 'executed' as never).allowed).toBe(false);
  });

  it('shares the same rules for plans', () => {
    expect(canTransitionPlan('proposed', 'approved').allowed).toBe(true);
    expect(canTransitionPlan('proposed', 'handed_off').allowed).toBe(false);
  });
});

describe('validate (composed)', () => {
  it('returns the first failing rule', () => {
    const result = validate([confidenceRule(1.2), decisionTypeRule('provider_selection')]);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('confidence');
  });

  it('passes when every rule passes', () => {
    expect(validate([confidenceRule(0.5), decisionTypeRule('retry_policy')]).passed).toBe(true);
  });
});
