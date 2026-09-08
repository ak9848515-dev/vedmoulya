// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — RoutingEvidenceService tests
//
// Proves the measured-evidence contract:
//   - real per-provider / provider+model / provider+model+capability evidence
//     derived ONLY from ai.provider_execution trace spans,
//   - recency weighting is deterministic and bounded (Phase D),
//   - confidence + influence ramp protect cold start (Phase E),
//   - sparse evidence (2/2) can never beat large evidence (500/520),
//   - provenance is always MEASURED; nothing is invented,
//   - bounded trace scan + TTL cache.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { InMemoryTraceStore, type ExecutionTrace, type TraceSpan } from '@vedmoulya/core';
import {
  RoutingEvidenceService,
  recencyWeight,
  percentile,
  EVIDENCE_PROVENANCE,
  type RoutingEvidenceOptions,
} from '../services/RoutingEvidenceService.js';

const FIXED_NOW = Date.UTC(2026, 7, 15, 12, 0, 0);

function span(
  name: string,
  overrides: Partial<TraceSpan> & { attributes?: Record<string, string | number | boolean> } = {},
): TraceSpan {
  return {
    spanId: `span-${name}`,
    traceId: `trace-${name}`,
    name,
    kind: 'ai',
    status: 'OK',
    startedAt: FIXED_NOW - 1000,
    endedAt: FIXED_NOW - 500,
    durationMs: 500,
    attributes: {},
    events: [],
    ...overrides,
  };
}

function executionSpan(
  overrides: {
    provider?: string;
    model?: string;
    capability?: string;
    status?: string;
    errorReason?: string;
    latencyMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    startedAt?: number;
    spanStatus?: TraceSpan['status'];
  } = {},
): TraceSpan {
  const startedAt = overrides.startedAt ?? FIXED_NOW - 60_000;
  const attributes: Record<string, string | number | boolean> = {
    provider: overrides.provider ?? 'google',
    status: overrides.status ?? 'success',
  };
  if (overrides.model) attributes.model = overrides.model;
  if (overrides.capability) attributes.capability = overrides.capability;
  if (overrides.errorReason) attributes.error_reason = overrides.errorReason;
  if (overrides.latencyMs !== undefined) attributes.latency_ms = overrides.latencyMs;
  if (overrides.inputTokens !== undefined) attributes.input_tokens = overrides.inputTokens;
  if (overrides.outputTokens !== undefined) attributes.output_tokens = overrides.outputTokens;
  if (overrides.cost !== undefined) attributes.cost = overrides.cost;
  return span('ai.provider_execution', {
    attributes,
    status: overrides.spanStatus ?? (overrides.status === 'error' ? 'ERROR' : 'OK'),
    startedAt,
    endedAt: startedAt + 500,
    durationMs: 500,
  });
}

function traceWith(spans: TraceSpan[], startedAt = FIXED_NOW - 60_000): ExecutionTrace {
  return {
    traceId: `trace-${Math.random()}`,
    name: 'ai.run',
    status: spans.some((s) => s.status === 'ERROR') ? 'ERROR' : 'OK',
    startedAt,
    endedAt: startedAt + 1000,
    spans,
    attributes: {},
  };
}

function service(
  traces: ExecutionTrace[],
  options: Partial<RoutingEvidenceOptions> = {},
): RoutingEvidenceService {
  const store = new InMemoryTraceStore();
  for (const t of traces) store.save(t);
  return new RoutingEvidenceService({
    store,
    now: () => FIXED_NOW,
    cacheTtlMs: 0, // always fresh
    ...options,
  });
}

describe('recencyWeight (Phase D)', () => {
  it('is deterministic, bounded and decays exponentially by half-life', () => {
    const halfLifeMs = 30 * 24 * 60 * 60 * 1000;
    const day = 24 * 60 * 60 * 1000;
    expect(recencyWeight(0, halfLifeMs)).toBe(1);
    expect(recencyWeight(day, halfLifeMs)).toBeCloseTo(0.977, 3);
    expect(recencyWeight(30 * day, halfLifeMs)).toBeCloseTo(0.5, 3);
    expect(recencyWeight(60 * day, halfLifeMs)).toBeCloseTo(0.25, 3);
    // Bounded: extremely old samples never reach 0 and never exceed 1.
    expect(recencyWeight(10_000 * day, halfLifeMs)).toBe(0.05);
  });
});

describe('percentile', () => {
  it('computes p50/p95 over sorted numeric input', () => {
    expect(percentile([], 0.5)).toBeUndefined();
    expect(percentile([100, 200, 300, 400], 0.5)).toBe(200);
    expect(percentile([100, 200, 300, 400], 0.95)).toBe(400);
    expect(percentile([100, 200, 300], 0.5)).toBe(200);
  });
});

describe('RoutingEvidenceService', () => {
  it('computes provider-level metrics from real execution spans', () => {
    const traces = [
      traceWith([
        executionSpan({
          provider: 'google',
          model: 'gemini-2.5-flash',
          capability: 'reasoning',
          latencyMs: 100,
          inputTokens: 1000,
          outputTokens: 200,
          cost: 0.002,
          startedAt: FIXED_NOW - 500,
        }),
        executionSpan({
          provider: 'google',
          model: 'gemini-2.5-flash',
          capability: 'reasoning',
          latencyMs: 300,
          inputTokens: 2000,
          outputTokens: 400,
          cost: 0.004,
          startedAt: FIXED_NOW - 500,
        }),
      ]),
      traceWith([
        executionSpan({
          provider: 'google',
          model: 'gemini-2.5-pro',
          capability: 'coding',
          latencyMs: 200,
          inputTokens: 500,
          outputTokens: 100,
          cost: 0.001,
          startedAt: FIXED_NOW - 500,
        }),
      ]),
    ];
    const svc = service(traces, { minSamples: 2, targetSamples: 3 });
    const evidence = svc.evidenceForProvider('google');

    expect(evidence).toBeDefined();
    expect(evidence?.sampleCount).toBe(3);
    expect(evidence?.successRate).toBe(1);
    expect(evidence?.failureRate).toBe(0);
    expect(evidence?.p50LatencyMs).toBe(200);
    expect(evidence?.p95LatencyMs).toBe(300);
    expect(evidence?.averageInputTokens).toBeCloseTo(1166.7, 0);
    expect(evidence?.averageOutputTokens).toBeCloseTo(233.3, 0);
    expect(evidence?.averageCostUsd).toBeCloseTo(0.0023, 3);
    expect(evidence?.provenance).toBe(EVIDENCE_PROVENANCE);
    expect(evidence?.confidence).toBe('MEASURED');
  });

  it('supports provider+model and provider+model+capability dimensions', () => {
    const traces = [
      traceWith([
        executionSpan({ provider: 'google', model: 'gemini-2.5-flash', capability: 'reasoning' }),
      ]),
      traceWith([
        executionSpan({ provider: 'google', model: 'gemini-2.5-flash', capability: 'reasoning' }),
      ]),
      traceWith([
        executionSpan({ provider: 'google', model: 'gemini-2.5-flash', capability: 'coding' }),
      ]),
    ];
    const svc = service(traces);

    const byModel = svc.evidenceForModel('google', 'gemini-2.5-flash');
    expect(byModel?.sampleCount).toBe(3);
    expect(byModel?.dimension).toBe('provider_model');

    const byCap = svc.evidenceForCapability('google', 'gemini-2.5-flash', 'reasoning');
    expect(byCap?.sampleCount).toBe(2);
    expect(byCap?.dimension).toBe('provider_model_capability');

    // bestEvidence prefers the most specific dimension with real samples.
    const best = svc.bestEvidence('google', 'gemini-2.5-flash', 'reasoning');
    expect(best?.dimension).toBe('provider_model_capability');
    expect(svc.bestEvidence('google', 'gemini-2.5-flash')?.dimension).toBe('provider_model');
  });

  it('records failures, timeouts and rate limits honestly', () => {
    const traces = [
      traceWith([
        executionSpan({ provider: 'openai', status: 'error', errorReason: 'rate_limited' }),
      ]),
      traceWith([executionSpan({ provider: 'openai', status: 'error', errorReason: 'timeout' })]),
      traceWith([executionSpan({ provider: 'openai', status: 'success' })]),
      traceWith([executionSpan({ provider: 'openai', status: 'success' })]),
      traceWith([executionSpan({ provider: 'openai', status: 'success' })]),
      traceWith([executionSpan({ provider: 'openai', status: 'success' })]),
      traceWith([executionSpan({ provider: 'openai', status: 'success' })]),
    ];
    const evidence = service(traces).evidenceForProvider('openai');
    expect(evidence?.sampleCount).toBe(7);
    expect(evidence?.successRate).toBeCloseTo(5 / 7, 3);
    expect(evidence?.failureRate).toBeCloseTo(2 / 7, 3);
    expect(evidence?.rateLimitRate).toBeCloseTo(1 / 7, 3);
    expect(evidence?.timeoutRate).toBeCloseTo(1 / 7, 3);
    expect(evidence?.recentFailureCount).toBe(2);
  });

  it('returns undefined (never fabricated) when no samples exist for a dimension', () => {
    const svc = service([traceWith([executionSpan({ provider: 'google' })])]);
    expect(svc.evidenceForProvider('anthropic')).toBeUndefined();
    expect(svc.evidenceForModel('google', 'nonexistent-model')).toBeUndefined();
    expect(svc.evidenceForCapability('google', 'gemini-2.5-flash', 'vision')).toBeUndefined();
  });

  it('ignores non-execution spans and spans without a provider', () => {
    const traces = [
      traceWith([
        span('ai.run', { attributes: { provider: 'google' } }),
        span('ai.provider_execution', { attributes: { status: 'success' } }), // no provider attr
      ]),
    ];
    const svc = service(traces);
    expect(svc.evidenceForProvider('google')).toBeUndefined();
    // Only the provider_execution span is counted as a candidate sample span.
    expect(svc.compute().scannedSpans).toBe(1);
  });

  it('cold start: sparse 2/2 evidence has INSUFFICIENT confidence and zero influence', () => {
    const traces = [
      traceWith([
        executionSpan({ provider: 'deepseek', startedAt: FIXED_NOW - 30 * 24 * 3600_000 }),
      ]),
      traceWith([
        executionSpan({ provider: 'deepseek', startedAt: FIXED_NOW - 30 * 24 * 3600_000 }),
      ]),
    ];
    const evidence = service(traces).evidenceForProvider('deepseek');
    // 2 samples, each ~30 days old → effective ~1 → INSUFFICIENT.
    expect(evidence?.confidence).toBe('INSUFFICIENT');
    expect(evidence?.influence).toBe(0);
  });

  it('progressive confidence: LOW_CONFIDENCE influence ramps below target, MEASURED saturates', () => {
    const recent = (n: number, ok: number): ExecutionTrace[] =>
      Array.from({ length: n }, (_, i) =>
        traceWith([
          executionSpan({
            provider: 'openai',
            status: i < ok ? 'success' : 'error',
            startedAt: FIXED_NOW - 60_000,
          }),
        ]),
      );
    const low = service(recent(10, 9)).evidenceForProvider('openai');
    expect(low?.confidence).toBe('LOW_CONFIDENCE');
    expect(low?.influence).toBeGreaterThan(0);
    expect(low?.influence).toBeLessThan(1);

    const full = service(recent(40, 38)).evidenceForProvider('openai');
    expect(full?.confidence).toBe('MEASURED');
    expect(full?.influence).toBe(1);
  });

  it('sparse 2/2 never beats a large 500/520 sample pool via influence', () => {
    const many = (): ExecutionTrace[] =>
      Array.from({ length: 520 }, (_, i) =>
        traceWith([
          executionSpan({
            provider: 'openai',
            status: i < 500 ? 'success' : 'error',
            startedAt: FIXED_NOW - 60_000,
          }),
        ]),
      );
    const big = service(many()).evidenceForProvider('openai');
    expect(big?.sampleCount).toBe(520);
    expect(big?.influence).toBe(1);
    expect(big?.confidence).toBe('MEASURED');

    const small = service([
      traceWith([executionSpan({ provider: 'deepseek', startedAt: FIXED_NOW - 60_000 })]),
      traceWith([executionSpan({ provider: 'deepseek', startedAt: FIXED_NOW - 60_000 })]),
    ]).evidenceForProvider('deepseek');
    expect(small?.sampleCount).toBe(2);
    // The 2/2 provider cannot dominate: effective ~2 < minSamples(5) → 0 influence.
    expect(small?.influence).toBe(0);
    expect(big?.influence).toBeGreaterThan(small?.influence ?? 0);
  });

  it('recency: a recent failure weighs more than an old one', () => {
    const traces = [
      traceWith([
        executionSpan({
          provider: 'openai',
          status: 'error',
          errorReason: 'timeout',
          startedAt: FIXED_NOW - 1000,
        }),
      ]),
      traceWith([
        executionSpan({ provider: 'openai', status: 'success', startedAt: FIXED_NOW - 1000 }),
        executionSpan({ provider: 'openai', status: 'success', startedAt: FIXED_NOW - 1000 }),
      ]),
      traceWith([
        // Old failures — discounted heavily by recency.
        executionSpan({
          provider: 'openai',
          status: 'error',
          startedAt: FIXED_NOW - 90 * 24 * 3600_000,
        }),
      ]),
    ];
    const evidence = service(traces).evidenceForProvider('openai');
    // Weighted success is above the raw 2/4 because the 3 recent samples
    // outweigh the 90-day-old failure.
    expect(evidence?.successRate ?? 0).toBeGreaterThan(0.5);
  });

  it('bounds the trace scan and caches snapshots for the TTL', () => {
    const store = new InMemoryTraceStore();
    for (let i = 0; i < 3000; i++) {
      store.save(
        traceWith([executionSpan({ provider: 'google', startedAt: FIXED_NOW - i * 1000 })]),
      );
    }
    let now = FIXED_NOW;
    const svc = new RoutingEvidenceService({ store, now: () => now, cacheTtlMs: 60_000 });
    const first = svc.compute();
    expect(first.scannedTraces).toBeLessThanOrEqual(2000);
    expect(first.provider.get('google')?.sampleCount).toBe(2000);

    // Within TTL: same snapshot object (cache hit — no rescan).
    const second = svc.compute();
    expect(second).toBe(first);

    // After TTL: fresh snapshot.
    now = FIXED_NOW + 61_000;
    const third = svc.compute();
    expect(third).not.toBe(first);
  });
});
