// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Learning Report Service
// EI-007 — Enterprise Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { LearningReportService } from '../LearningReportService.js';
import type { LearningEvent, LearningModel } from '../../../types/learning-types.js';

const service = new LearningReportService();

function ev(overrides: Partial<LearningEvent>): LearningEvent {
  return {
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
    ...overrides,
  };
}

function model(overrides: Partial<LearningModel>): LearningModel {
  return {
    category: 'provider',
    entityType: 'provider',
    entityId: 'openai',
    entityLabel: 'OpenAI',
    sampleCount: 3,
    successCount: 2,
    failureCount: 1,
    successRate: 0.667,
    avgCostUsd: 0.01,
    avgLatencyMs: 400,
    avgAccuracy: 0.9,
    avgRetries: 0.3,
    avgQuality: 0.9,
    avgFeedback: 0.8,
    avgBusinessOutcome: 0.7,
    confidence: 0.8,
    trend: 0,
    lastSeen: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('LearningReportService — generateReport', () => {
  it('builds a report with category aggregates', () => {
    const events = [
      ev({ entityId: 'a', outcome: 'success', costUsd: 0.01, latencyMs: 100, quality: 0.9 }),
      ev({ entityId: 'a', outcome: 'failure', costUsd: 0.03, latencyMs: 300, quality: 0.4 }),
    ];
    const models = [model({ entityId: 'a', successRate: 0.5, sampleCount: 2 })];
    const report = service.generateReport('provider', events, models);
    expect(report.category).toBe('provider');
    expect(report.totalEvents).toBe(2);
    expect(report.successRate).toBeCloseTo(0.5, 4);
    expect(report.avgCostUsd).toBeCloseTo(0.02, 4);
    expect(report.avgLatencyMs).toBe(200);
    expect(report.avgQuality).toBeCloseTo(0.65, 4);
    expect(report.title).toContain('Provider Learning');
    expect(report.topEntities).toHaveLength(1);
    expect(report.atRiskEntities).toHaveLength(1);
    expect(report.summary).toContain('at risk');
  });

  it('produces an empty report for a category with no events', () => {
    const report = service.generateReport('prompt', [], []);
    expect(report.totalEvents).toBe(0);
    expect(report.summary).toContain('No learning events observed');
    expect(report.successRate).toBe(0);
  });

  it('labels healthy categories as healthy', () => {
    const events = [ev({ outcome: 'success' }), ev({ outcome: 'success' })];
    const report = service.generateReport('provider', events, []);
    expect(report.summary).toContain('healthy');
  });

  it('lists top entities by success rate and at-risk entities', () => {
    const events = [
      ev({ entityId: 'good', outcome: 'success' }),
      ev({ entityId: 'bad', outcome: 'failure' }),
      ev({ entityId: 'bad', outcome: 'failure' }),
    ];
    const models = [
      model({ entityId: 'good', successRate: 1, sampleCount: 1 }),
      model({ entityId: 'bad', successRate: 0, sampleCount: 2 }),
    ];
    const report = service.generateReport('provider', events, models);
    expect(report.topEntities[0]?.entityId).toBe('good');
    expect(report.atRiskEntities.map((r) => r.entityId)).toContain('bad');
  });
});

describe('LearningReportService — generateAll', () => {
  it('generates reports only for categories with events', () => {
    const events = [
      ev({ category: 'provider', entityId: 'a' }),
      ev({ category: 'prompt', entityId: 'p' }),
    ];
    const reports = service.generateAll(events, service2Models());
    expect(reports.map((r) => r.category).sort()).toEqual(['prompt', 'provider']);
    expect(reports[0]?.totalEvents).toBe(1);
  });

  it('sorts reports by total events descending', () => {
    const events = [
      ev({ category: 'provider', entityId: 'a' }),
      ev({ category: 'provider', entityId: 'b' }),
      ev({ category: 'prompt', entityId: 'p' }),
    ];
    const reports = service.generateAll(events, []);
    expect(reports[0]?.category).toBe('provider');
  });
});

function service2Models(): LearningModel[] {
  return [
    model({ category: 'provider', entityId: 'a' }),
    model({ category: 'prompt', entityId: 'p' }),
  ];
}
