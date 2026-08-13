// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Alert Engine tests
// EPIC-012 — Production Observability & Control Plane (Phase 13)
// Verifies each threshold rule fires only when crossed, never for normal
// expected behavior, that configure clamps values, and history is bounded.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AlertEngine, DEFAULT_ALERT_THRESHOLDS } from '../observability/AlertEngine.js';
import type { AlertMetricsSnapshot } from '../observability/AlertEngine.js';

function snapshot(partial: Partial<AlertMetricsSnapshot> = {}): AlertMetricsSnapshot {
  return {
    aiRequestsTotal: 100,
    aiRequestsFailure: 0,
    aiRateLimit429: 0,
    aiAbstentions: 0,
    ragFallbackCount: 0,
    promptCacheHitRatio: 0.8,
    ...partial,
  };
}

describe('AlertEngine', () => {
  it('stays silent for healthy, expected behavior', () => {
    const engine = new AlertEngine();
    const alerts = engine.evaluate(snapshot());
    expect(alerts).toHaveLength(0);
  });

  it('fires a provider-error-rate alert above the threshold', () => {
    const engine = new AlertEngine();
    const alerts = engine.evaluate(snapshot({ aiRequestsTotal: 100, aiRequestsFailure: 40 }));
    expect(alerts.map((a) => a.rule)).toContain('provider_error_rate');
    const alert = alerts.find((a) => a.rule === 'provider_error_rate');
    expect(alert?.severity).toBe('critical'); // 0.4 > 2×0.1
    expect(alert?.value).toBeCloseTo(0.4);
  });

  it('does not fire below the threshold (normal expected errors)', () => {
    const engine = new AlertEngine();
    const alerts = engine.evaluate(snapshot({ aiRequestsTotal: 100, aiRequestsFailure: 5 }));
    expect(alerts.map((a) => a.rule)).not.toContain('provider_error_rate');
  });

  it('fires rate-limit and abstention alerts', () => {
    const engine = new AlertEngine();
    const alerts = engine.evaluate(
      snapshot({ aiRequestsTotal: 50, aiRateLimit429: 15, aiAbstentions: 20 }),
    );
    expect(alerts.map((a) => a.rule)).toEqual(
      expect.arrayContaining(['rate_limit_429', 'abstention_rate']),
    );
  });

  it('fires a RAG fallback-rate alert when the embedding path degrades', () => {
    const engine = new AlertEngine();
    // 60 fallbacks vs 40 successful calls → 60% of RAG traffic is fallback.
    const alerts = engine.evaluate(
      snapshot({ aiRequestsTotal: 40, aiRequestsFailure: 0, ragFallbackCount: 60 }),
    );
    expect(alerts.map((a) => a.rule)).toContain('rag_fallback_rate');
    expect(alerts.find((a) => a.rule === 'rag_fallback_rate')?.value).toBeCloseTo(0.6);
  });

  it('fires quality-regression alerts with the application scope', () => {
    const engine = new AlertEngine();
    const alerts = engine.evaluate(
      snapshot({
        qualityRegressions: [{ applicationId: 'app-1', previous: 88, current: 60 }],
      }),
    );
    const alert = alerts.find((a) => a.rule === 'quality_regression');
    expect(alert).toBeDefined();
    expect(alert?.scope?.applicationId).toBe('app-1');
    expect(alert?.value).toBe(28);
  });

  it('does not fire for a small, normal quality fluctuation', () => {
    const engine = new AlertEngine();
    const alerts = engine.evaluate(
      snapshot({ qualityRegressions: [{ applicationId: 'app-1', previous: 88, current: 82 }] }),
    );
    expect(alerts.map((a) => a.rule)).not.toContain('quality_regression');
  });

  it('fires security-incident and deployment-failure alerts as critical', () => {
    const engine = new AlertEngine();
    const alerts = engine.evaluate(snapshot({ securityIncidents: 1, deploymentFailures: 1 }));
    expect(alerts.find((a) => a.rule === 'security_incident')?.severity).toBe('critical');
    expect(alerts.find((a) => a.rule === 'deployment_failure')?.severity).toBe('critical');
  });

  it('fires cost and token anomalies only against a real baseline', () => {
    const engine = new AlertEngine();
    const noBaseline = engine.evaluate(snapshot({ costUsd: 5 }));
    expect(noBaseline.map((a) => a.rule)).not.toContain('cost_anomaly');

    const alerts = engine.evaluate(
      snapshot({ costUsd: 5, baselineCostUsd: 0.5, tokenSpend: 1000, previousTokenSpend: 100 }),
    );
    expect(alerts.map((a) => a.rule)).toEqual(
      expect.arrayContaining(['cost_anomaly', 'token_anomaly']),
    );
  });

  it('configure clamps threshold values into sane ranges', () => {
    const engine = new AlertEngine();
    engine.configure({ providerErrorRate: 99, rateLimit429PerMin: -5 });
    expect(engine.configuredThresholds.providerErrorRate).toBeLessThanOrEqual(0.99);
    expect(engine.configuredThresholds.rateLimit429PerMin).toBeGreaterThanOrEqual(1);
    // Defaults are preserved for unset fields.
    expect(engine.configuredThresholds.latencyP95Ms).toBe(DEFAULT_ALERT_THRESHOLDS.latencyP95Ms);
  });

  it('keeps a bounded alert history and returns newest-first', () => {
    const engine = new AlertEngine({ maxHistory: 3 });
    for (let i = 0; i < 5; i++) {
      engine.evaluate(snapshot({ aiRequestsTotal: 100, aiRequestsFailure: 40 }));
    }
    const recent = engine.listRecent();
    expect(recent.length).toBeLessThanOrEqual(3);
    expect(recent[0]?.createdAt).toBeGreaterThanOrEqual(recent[recent.length - 1]?.createdAt ?? 0);
  });
});
