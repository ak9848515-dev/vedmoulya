// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Enterprise Brain Metrics
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { BrainMetricsService } from '../BrainMetricsService.js';
import type { BrainDecision, BrainDecisionPlan } from '../../../types/brain-types.js';
import { BRAIN_DECISION_TYPES } from '../../../types/brain-types.js';

function decision(overrides: Partial<BrainDecision> = {}): BrainDecision {
  return {
    decisionId: `bd_${Math.random().toString(36).slice(2, 8)}`,
    planId: 'plan_x',
    goalId: 'goal_x',
    type: 'provider_selection',
    title: 'Provider Selection',
    description: '',
    recommendation: {
      entityType: 'provider',
      entityId: 'openai',
      entityLabel: 'OpenAI',
      action: 'use',
      params: {},
    },
    confidence: { score: 0.8, level: 'high', factors: [] },
    reason: { why: '', evidence: [], tradeoffs: [], alternatives: [], risks: [] },
    context: {
      goalId: 'goal_x',
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('BrainMetricsService', () => {
  it('aggregates totals, per-type counts, and status counts', () => {
    const service = new BrainMetricsService();
    const decisions = [
      decision({ type: 'provider_selection', status: 'proposed' }),
      decision({ type: 'provider_selection', status: 'approved' }),
      decision({ type: 'budget_strategy', status: 'handed_off' }),
    ];
    const plans: BrainDecisionPlan[] = [
      {
        planId: 'p1',
        goalId: 'g',
        goalTitle: 'G',
        status: 'proposed',
        decisions,
        overallConfidence: 0.8,
        pipeline: [],
        version: 1,
        actor: 'x',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ];

    const metrics = service.aggregate(decisions, plans);
    expect(metrics.totals.decisions).toBe(3);
    expect(metrics.totals.plans).toBe(1);
    expect(metrics.totals.proposed).toBe(1);
    expect(metrics.totals.approved).toBe(1);
    expect(metrics.totals.handedOff).toBe(1);
    expect(metrics.byType.provider_selection.count).toBe(2);
    expect(metrics.byType.provider_selection.avgConfidence).toBe(0.8);
    expect(metrics.byType.budget_strategy.count).toBe(1);
    expect(metrics.highConfidenceCount).toBe(3);
    expect(metrics.avgConfidence).toBe(0.8);
    // Every type key is present (zero-filled).
    expect(Object.keys(metrics.byType)).toHaveLength(BRAIN_DECISION_TYPES.length);
  });

  it('returns zeroed metrics when there are no decisions', () => {
    const service = new BrainMetricsService();
    const metrics = service.aggregate([], []);
    expect(metrics.totals.decisions).toBe(0);
    expect(metrics.avgConfidence).toBe(0);
    expect(metrics.highConfidenceCount).toBe(0);
    expect(metrics.totals.plans).toBe(0);
  });

  it('builds a zero-filled daily trend of the requested length', () => {
    const service = new BrainMetricsService();
    const today = new Date().toISOString().slice(0, 10);
    const decisions = [decision({ createdAt: new Date().toISOString() })];
    const trend = service.trend(decisions, 7);
    expect(trend).toHaveLength(7);
    expect(trend[6]?.date).toBe(today);
    expect(trend[6]?.decisions).toBe(1);
    expect(trend[0]?.decisions).toBe(0);
  });

  it('computes the average plan confidence', () => {
    const service = new BrainMetricsService();
    const decisions = [
      decision({ confidence: { score: 0.6, level: 'medium', factors: [] } }),
      decision({ confidence: { score: 0.9, level: 'high', factors: [] } }),
    ];
    expect(service.planConfidence(decisions)).toBe(0.75);
    expect(service.planConfidence([])).toBe(0);
  });
});
