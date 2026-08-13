// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Learning Aggregation Service
// EI-007 — Enterprise Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { LearningAggregationService } from '../LearningAggregationService.js';
import type { LearningEvent } from '../../../types/learning-types.js';

function ev(overrides: Partial<LearningEvent>): LearningEvent {
  const base: LearningEvent = {
    eventId: `levent_${overrides.entityId ?? 'x'}_${Math.random()}`,
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
  };
  return { ...base, ...overrides };
}

const service = new LearningAggregationService();

describe('LearningAggregationService — aggregate', () => {
  it('builds per-entity models with correct statistics', () => {
    const events = [
      ev({
        entityId: 'a',
        outcome: 'success',
        costUsd: 0.01,
        latencyMs: 100,
        accuracy: 0.9,
        quality: 0.9,
      }),
      ev({
        entityId: 'a',
        outcome: 'failure',
        costUsd: 0.02,
        latencyMs: 200,
        accuracy: 0.5,
        quality: 0.4,
        retries: 2,
      }),
      ev({
        entityId: 'b',
        outcome: 'success',
        costUsd: 0.05,
        latencyMs: 300,
        accuracy: 0.8,
        quality: 0.7,
      }),
    ];
    const models = service.aggregate(events);
    expect(models).toHaveLength(2);

    const a = models.find((m) => m.entityId === 'a');
    expect(a).toBeDefined();
    expect(a?.sampleCount).toBe(2);
    expect(a?.successCount).toBe(1);
    expect(a?.failureCount).toBe(1);
    expect(a?.successRate).toBeCloseTo(0.5, 4);
    expect(a?.avgCostUsd).toBeCloseTo(0.015, 4);
    expect(a?.avgLatencyMs).toBeCloseTo(150, 4);
    expect(a?.avgAccuracy).toBeCloseTo(0.7, 4);
    expect(a?.avgRetries).toBeCloseTo(1, 4);
    expect(a?.avgQuality).toBeCloseTo(0.65, 4);
  });

  it('computes confidence from sample count with a cap', () => {
    const one = service.aggregate([ev({ entityId: 'c' })]); // 1 sample
    expect(one[0]?.confidence).toBeCloseTo(0.95 / 20, 4);
    const many = service.aggregate(
      Array.from({ length: 25 }, (_, i) => ev({ entityId: 'c', eventId: `levent_c_${i}` })),
    );
    expect(many[0]?.confidence).toBe(0.95);
  });

  it('computes a positive trend when recent runs improve', () => {
    const events = [
      ev({ entityId: 'd', outcome: 'failure', occurredAt: '2026-08-01T10:00:00.000Z' }),
      ev({ entityId: 'd', outcome: 'failure', occurredAt: '2026-08-02T10:00:00.000Z' }),
      ev({ entityId: 'd', outcome: 'success', occurredAt: '2026-08-03T10:00:00.000Z' }),
      ev({ entityId: 'd', outcome: 'success', occurredAt: '2026-08-04T10:00:00.000Z' }),
    ];
    const model = service.aggregate(events)[0];
    expect(model?.trend).toBeGreaterThan(0);
  });

  it('aggregates feedback and business outcome averages', () => {
    const events = [
      ev({ entityId: 'e', feedback: 0.8, businessOutcome: 0.9 }),
      ev({ entityId: 'e', outcome: 'failure', feedback: 0.4, businessOutcome: 0.2 }),
      ev({ entityId: 'e', feedback: undefined, businessOutcome: undefined }),
    ];
    const model = service.aggregate(events)[0];
    expect(model?.avgFeedback).toBeCloseTo(0.6, 4);
    expect(model?.avgBusinessOutcome).toBeCloseTo(0.55, 4);
  });

  it('sorts models by sample count descending', () => {
    const events = [
      ev({ entityId: 'small' }),
      ...Array.from({ length: 5 }, (_, i) => ev({ entityId: 'big', eventId: `levent_big_${i}` })),
    ];
    const models = service.aggregate(events);
    expect(models[0]?.entityId).toBe('big');
  });

  it('returns an empty list for no events', () => {
    expect(service.aggregate([])).toEqual([]);
  });
});

describe('LearningAggregationService — categoryStats', () => {
  it('zero-fills categories without events', () => {
    const stats = service.categoryStats([], []);
    expect(stats.provider).toEqual({
      events: 0,
      successRate: 0,
      models: 0,
      failures: 0,
      avgCostUsd: 0,
    });
    expect(stats.failure.events).toBe(0);
  });

  it('computes per-category event counts, success rate, and costs', () => {
    const events = [
      ev({ category: 'provider', outcome: 'success', costUsd: 0.01 }),
      ev({ category: 'provider', outcome: 'failure', costUsd: 0.03 }),
      ev({ category: 'prompt', outcome: 'success', costUsd: 0.5 }),
    ];
    const models = service.aggregate(events);
    const stats = service.categoryStats(events, models);
    expect(stats.provider.events).toBe(2);
    expect(stats.provider.successRate).toBeCloseTo(0.5, 4);
    expect(stats.provider.failures).toBe(1);
    expect(stats.provider.avgCostUsd).toBeCloseTo(0.02, 4);
    expect(stats.provider.models).toBe(1);
    expect(stats.prompt.events).toBe(1);
  });
});

describe('LearningAggregationService — trend', () => {
  it('produces zero-filled daily buckets for the last 14 days', () => {
    const points = service.trend([]);
    expect(points).toHaveLength(14);
    for (const point of points) {
      expect(point.events).toBe(0);
      expect(point.successRate).toBe(0);
    }
  });

  it('buckets events by their occurredAt day', () => {
    const events = [ev({ outcome: 'success', occurredAt: new Date().toISOString() })];
    const points = service.trend(events, 14);
    const today = points.find((p) => p.date === new Date().toISOString().slice(0, 10));
    expect(today?.events).toBe(1);
    expect(today?.successRate).toBe(1);
  });

  it('supports custom window sizes', () => {
    expect(service.trend([], 7)).toHaveLength(7);
  });
});
