// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Learning Insight Service
// EI-007 — Enterprise Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { LearningInsightService } from '../LearningInsightService.js';
import type { LearningModel } from '../../../types/learning-types.js';

const service = new LearningInsightService();

function model(overrides: Partial<LearningModel>): LearningModel {
  return {
    category: 'provider',
    entityType: 'provider',
    entityId: 'openai',
    entityLabel: 'OpenAI',
    sampleCount: 10,
    successCount: 9,
    failureCount: 1,
    successRate: 0.9,
    avgCostUsd: 0.01,
    avgLatencyMs: 400,
    avgAccuracy: 0.95,
    avgRetries: 0.1,
    avgQuality: 0.92,
    avgFeedback: 0.9,
    avgBusinessOutcome: 0.8,
    confidence: 0.9,
    trend: 0.05,
    lastSeen: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('LearningInsightService — generateInsights', () => {
  it('emits no insights for healthy entities below thresholds', () => {
    expect(service.generateInsights([model({})])).toEqual([]);
  });

  it('skips entities below the minimum sample count', () => {
    const insights = service.generateInsights([model({ sampleCount: 2, successRate: 0 })]);
    expect(insights).toHaveLength(0);
  });

  it('flags underperforming entities as warnings', () => {
    const insights = service.generateInsights([model({ entityId: 'bad', successRate: 0.3 })]);
    const underperform = insights.find((i) => i.insightId === 'insight_underperform_bad');
    expect(underperform).toBeDefined();
    expect(underperform?.severity).toBe('warning');
    expect(underperform?.title).toContain('Underperforming');
  });

  it('flags degrading trends as critical', () => {
    const insights = service.generateInsights([model({ entityId: 'decay', trend: -0.5 })]);
    const degrade = insights.find((i) => i.insightId === 'insight_degrade_decay');
    expect(degrade).toBeDefined();
    expect(degrade?.severity).toBe('critical');
  });

  it('flags quality below target as a warning', () => {
    const insights = service.generateInsights([model({ entityId: 'lowq', avgQuality: 0.5 })]);
    expect(insights.some((i) => i.insightId === 'insight_quality_lowq')).toBe(true);
  });

  it('flags cost drift for provider/budget categories', () => {
    const insights = service.generateInsights([
      model({ entityId: 'pricey', category: 'provider', avgCostUsd: 2.5 }),
    ]);
    expect(insights.some((i) => i.insightId === 'insight_cost_pricey')).toBe(true);

    const noCost = service.generateInsights([
      model({ entityId: 'capx', category: 'capability', avgCostUsd: 2.5 }),
    ]);
    expect(noCost.some((i) => i.insightId === 'insight_cost_capx')).toBe(false);
  });

  it('flags repeated failures with escalating severity', () => {
    const warn = service.generateInsights([
      model({ entityId: 'f1', failureCount: 4, successRate: 0.4 }),
    ]);
    expect(warn.find((i) => i.insightId === 'insight_failure_f1')?.severity).toBe('warning');

    const critical = service.generateInsights([
      model({ entityId: 'f2', failureCount: 8, successRate: 0.2 }),
    ]);
    expect(critical.find((i) => i.insightId === 'insight_failure_f2')?.severity).toBe('critical');
  });

  it('caps the number of insights returned', () => {
    const capped = new LearningInsightService({ maxInsights: 2 });
    const models = Array.from({ length: 10 }, (_, i) =>
      model({ entityId: `bad_${i}`, successRate: 0.2, failureCount: 5, trend: -0.5 }),
    );
    expect(capped.generateInsights(models).length).toBeLessThanOrEqual(2);
  });
});

describe('LearningInsightService — dominantInsight', () => {
  it('returns the highest-severity insight for a category', () => {
    const insights = [
      model({ entityId: 'w', successRate: 0.3 }),
      model({ entityId: 'c', trend: -0.6 }),
    ];
    const generated = service.generateInsights(insights);
    const dominant = service.dominantInsight(generated, 'provider');
    expect(dominant?.severity).toBe('critical');
  });

  it('returns undefined when no insight matches the category', () => {
    expect(service.dominantInsight(service.generateInsights([]), 'prompt')).toBeUndefined();
  });
});
