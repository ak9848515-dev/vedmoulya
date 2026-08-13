// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Learning Intelligence Application Service
// EI-007 — Enterprise Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { LearningIntelligenceApplicationService } from '../LearningIntelligenceApplicationService.js';
import { InMemoryLearningRepository } from '../../infrastructure/InMemoryLearningRepository.js';
import type { LearningEngines } from '../../contracts/learning-engines.js';
import { createCatalogLearningEvents } from '../../catalog/learning-catalog.js';

const engines: LearningEngines = {
  goals: { getSummary: async () => ({ success: true, data: { totalGoals: 1 } as never }) },
  capabilities: {
    getMarketplace: async () => ({
      success: true,
      data: { capabilities: [], total: 0 } as never,
    }),
  },
  providers: {
    getMarketplace: async () => ({
      success: true,
      data: { providers: [], total: 0 } as never,
    }),
  },
  context: { getContextSummary: async () => ({ success: true, data: { total: 0 } as never }) },
  strategies: { getSummary: async () => ({ success: true, data: { total: 0 } as never }) },
  orchestrator: {
    getSummary: async () => ({ success: true, data: { totalSessions: 0 } as never }),
  },
};

function createService() {
  return new LearningIntelligenceApplicationService(new InMemoryLearningRepository(), engines);
}

function eventInput(entityId = 'openai', outcome: 'success' | 'failure' = 'success') {
  return {
    category: 'provider' as const,
    entityType: 'provider',
    entityId,
    entityLabel: entityId.toUpperCase(),
    outcome,
    confidence: 0.9,
    costUsd: 0.01,
    latencyMs: 400,
    accuracy: 0.95,
    retries: 0,
    quality: 0.92,
    feedback: 0.85,
    businessOutcome: 0.8,
    sourceRef: { sourceType: 'session' as const, sourceId: 'sess_1' },
  };
}

describe('LearningIntelligenceApplicationService — recordEvent', () => {
  it('records a valid event', async () => {
    const svc = createService();
    const result = await svc.recordEvent(eventInput());
    expect(result.success).toBe(true);
    expect(result.data?.eventId).toBeDefined();
    expect(result.data?.entityLabel).toBe('OPENAI');
  });

  it('rejects invalid events with the first failing rule', async () => {
    const svc = createService();
    const result = await svc.recordEvent({ ...eventInput(), confidence: 1.4 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('confidence');
  });

  it('rejects invalid categories', async () => {
    const svc = createService();
    const result = await svc.recordEvent({ ...eventInput(), category: 'nope' as never });
    expect(result.success).toBe(false);
  });

  it('defaults occurredAt to now when omitted', async () => {
    const svc = createService();
    const { occurredAt, ...rest } = eventInput();
    const result = await svc.recordEvent(rest);
    expect(result.success).toBe(true);
    expect(result.data?.occurredAt).toBeDefined();
  });
});

describe('LearningIntelligenceApplicationService — events, timeline, models', () => {
  it('lists events with filters and pagination', async () => {
    const svc = createService();
    await svc.recordEvent(eventInput('a', 'success'));
    await svc.recordEvent(eventInput('b', 'failure'));
    await svc.recordEvent(eventInput('c', 'success'));

    const all = await svc.listEvents({ page: 1, limit: 10 });
    expect(all.data?.items).toHaveLength(3);

    const failures = await svc.listEvents({ outcome: 'failure' });
    expect(failures.data?.total).toBe(1);
    expect(failures.data?.items[0]?.entityId).toBe('b');

    const byEntity = await svc.listEvents({ entityId: 'a' });
    expect(byEntity.data?.total).toBe(1);
  });

  it('returns the timeline sorted newest first', async () => {
    const svc = createService();
    await svc.recordEvent({ ...eventInput('a'), occurredAt: '2026-08-01T10:00:00.000Z' });
    await svc.recordEvent({ ...eventInput('b'), occurredAt: '2026-08-03T10:00:00.000Z' });
    const timeline = await svc.getTimeline();
    expect(timeline.data?.map((e) => e.entityId)).toEqual(['b', 'a']);
  });

  it('gets a single event and returns not-found for missing ones', async () => {
    const svc = createService();
    const recorded = await svc.recordEvent(eventInput());
    const found = await svc.getEvent(recorded.data?.eventId ?? '');
    expect(found.success).toBe(true);
    const missing = await svc.getEvent('nope');
    expect(missing.success).toBe(false);
  });

  it('returns models filtered by category', async () => {
    const svc = createService();
    await svc.recordEvent(eventInput('openai'));
    await svc.recordEvent({ ...eventInput('openai'), outcome: 'failure' });
    await svc.recordEvent({ ...eventInput('prompt_v1'), category: 'prompt', entityType: 'prompt' });

    const models = await svc.getModels();
    expect(models.data).toHaveLength(2);

    const providers = await svc.getModels({ category: 'provider' });
    expect(providers.data).toHaveLength(1);
    expect(providers.data?.[0]?.sampleCount).toBe(2);
    expect(providers.data?.[0]?.successRate).toBeCloseTo(0.5, 4);
  });
});

describe('LearningIntelligenceApplicationService — recommendations & safety', () => {
  it('generates recommendations only above the sample threshold', async () => {
    const svc = createService();
    await svc.recordEvent(eventInput('openai'));
    await svc.recordEvent(eventInput('anthropic'));
    const recommendations = await svc.getRecommendations();
    expect(recommendations.data).toHaveLength(0);
  });

  it('approves a recommendation only through the safety gate', async () => {
    const svc = createService();
    // 13 successful openai provider events → best_provider recommendation
    // above both approval thresholds (samples >= 5, confidence >= 0.6).
    for (let i = 0; i < 13; i += 1) {
      await svc.recordEvent(eventInput('openai'));
    }
    const recommendations = await svc.getRecommendations();
    const providerRec = recommendations.data?.find((r) => r.type === 'best_provider');
    expect(providerRec).toBeDefined();
    expect(providerRec?.status).toBe('pending');

    const approved = await svc.approveRecommendation({
      recommendationId: providerRec?.recommendationId ?? '',
      actor: 'human-owner',
      note: 'openai is solid',
    });
    expect(approved.success).toBe(true);
    expect(approved.data?.status).toBe('approved');
    expect(approved.data?.version).toBe(2);
    expect(approved.data?.audit.map((a) => a.action)).toEqual(['created', 'approved']);

    // The overlay now reflects the approved status.
    const after = await svc.getRecommendation(providerRec?.recommendationId ?? '');
    expect(after.data?.status).toBe('approved');

    // Rollback an approved decision.
    const rolled = await svc.rollbackRecommendation({
      recommendationId: providerRec?.recommendationId ?? '',
      actor: 'reviewer',
      note: 're-evaluate',
    });
    expect(rolled.data?.status).toBe('rolled_back');
    expect(rolled.data?.version).toBe(3);
  });

  it('rejects a recommendation and blocks double transitions', async () => {
    const svc = createService();
    for (let i = 0; i < 6; i += 1) {
      await svc.recordEvent(eventInput('openai'));
    }
    const rec = (await svc.getRecommendations()).data?.[0];
    const rejected = await svc.rejectRecommendation({
      recommendationId: rec?.recommendationId ?? '',
      actor: 'owner',
    });
    expect(rejected.data?.status).toBe('rejected');

    const again = await svc.approveRecommendation({
      recommendationId: rec?.recommendationId ?? '',
      actor: 'owner',
    });
    expect(again.success).toBe(false);
  });

  it('blocks approval when samples are insufficient', async () => {
    const svc = createService();
    for (let i = 0; i < 4; i += 1) {
      await svc.recordEvent(eventInput('openai'));
    }
    const rec = (await svc.getRecommendations()).data?.[0];
    const gate = await svc.approveRecommendation({
      recommendationId: rec?.recommendationId ?? '',
      actor: 'owner',
    });
    expect(gate.success).toBe(false);
    expect(gate.error).toContain('safety gate');
  });

  it('returns not-found for unknown recommendations', async () => {
    const svc = createService();
    const missing = await svc.getRecommendation('rec_best_provider_none');
    expect(missing.success).toBe(false);
  });

  it('requires an actor for decisions', async () => {
    const svc = createService();
    const result = await svc.approveRecommendation({ recommendationId: 'rec_x', actor: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('actor');
  });
});

describe('LearningIntelligenceApplicationService — analytics, reports, dashboard', () => {
  it('builds analytics with trend, per-category stats, and totals', async () => {
    const svc = createService();
    await svc.recordEvent(eventInput('openai', 'success'));
    await svc.recordEvent(eventInput('openai', 'failure'));
    const analytics = await svc.getAnalytics();
    expect(analytics.data?.totals.events).toBe(2);
    expect(analytics.data?.totals.successes).toBe(1);
    expect(analytics.data?.byCategory.provider.events).toBe(2);
    expect(analytics.data?.trend.length).toBe(14);
  });

  it('filters analytics by category', async () => {
    const svc = createService();
    await svc.recordEvent(eventInput('openai'));
    await svc.recordEvent({ ...eventInput('p'), category: 'prompt', entityType: 'prompt' });
    const analytics = await svc.getAnalytics({ category: 'prompt' });
    expect(analytics.data?.totals.events).toBe(1);
    expect(analytics.data?.byCategory.provider.events).toBe(0);
  });

  it('generates reports per category with data', async () => {
    const svc = createService();
    await svc.recordEvent(eventInput('openai', 'success'));
    await svc.recordEvent(eventInput('openai', 'failure'));
    const reports = await svc.getReports();
    expect(reports.data?.some((r) => r.category === 'provider')).toBe(true);
    const providerReport = reports.data?.find((r) => r.category === 'provider');
    expect(providerReport?.totalEvents).toBe(2);
    expect(providerReport?.atRiskEntities.length).toBeGreaterThan(0);
  });

  it('exposes a dashboard aggregate', async () => {
    const svc = createService();
    await svc.recordEvent(eventInput('openai', 'success'));
    const dashboard = await svc.getDashboard();
    expect(dashboard.success).toBe(true);
    expect(dashboard.data?.totals.events).toBe(1);
    expect(dashboard.data?.totals.models).toBe(1);
    expect(dashboard.data?.recentEvents).toHaveLength(1);
    expect(dashboard.data?.byCategory.provider.events).toBe(1);
    expect(dashboard.data?.reports.length).toBe(1);
    expect(dashboard.data?.totals.pendingApprovals).toBe(0);
  });

  it('produces insights from aggregated models', async () => {
    const svc = createService();
    for (let i = 0; i < 5; i += 1) {
      await svc.recordEvent({ ...eventInput('bad', 'failure'), quality: 0.3, accuracy: 0.4 });
    }
    const insights = await svc.getInsights();
    expect(insights.data?.some((i) => i.severity === 'warning')).toBe(true);
  });

  it('handles an empty registry gracefully', async () => {
    const svc = createService();
    const [dashboard, models, recs, reports] = await Promise.all([
      svc.getDashboard(),
      svc.getModels(),
      svc.getRecommendations(),
      svc.getReports(),
    ]);
    expect(dashboard.success).toBe(true);
    expect(dashboard.data?.totals.events).toBe(0);
    expect(models.data).toEqual([]);
    expect(recs.data).toEqual([]);
    expect(reports.data).toEqual([]);
  });
});

describe('LearningIntelligenceApplicationService — seed catalog', () => {
  it('records the full seed catalog and produces rich recommendations', async () => {
    const svc = new LearningIntelligenceApplicationService(
      new InMemoryLearningRepository(createCatalogLearningEvents()),
      engines,
    );
    const dashboard = await svc.getDashboard();
    expect(dashboard.data?.totals.events).toBeGreaterThanOrEqual(38);
    const recommendations = await svc.getRecommendations();
    expect(recommendations.data && recommendations.data.length).toBeGreaterThanOrEqual(4);
    const insights = await svc.getInsights();
    expect(insights.data && insights.data.length).toBeGreaterThan(0);
  });
});
