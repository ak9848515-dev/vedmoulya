// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AIMetrics singleton unit tests
// ARC-005 — AI Orchestration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { metrics } from '@vedmoulya/core';
import { AIMetrics } from '../AIMetrics.js';

describe('AIMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the same singleton instance', () => {
    expect(AIMetrics.getInstance()).toBe(AIMetrics.getInstance());
  });

  it('records a request counter', () => {
    const spy = vi.spyOn(metrics, 'increment');
    AIMetrics.getInstance().recordRequest();
    expect(spy).toHaveBeenCalledWith('ai.requests.total');
  });

  it('records success with latency', () => {
    const increment = vi.spyOn(metrics, 'increment');
    const observe = vi.spyOn(metrics, 'observe');
    AIMetrics.getInstance().recordSuccess(42);
    expect(increment).toHaveBeenCalledWith('ai.requests.success');
    expect(observe).toHaveBeenCalledWith('ai.requests.latency', 42);
  });

  it('records a failure counter', () => {
    const spy = vi.spyOn(metrics, 'increment');
    AIMetrics.getInstance().recordFailure();
    expect(spy).toHaveBeenCalledWith('ai.requests.failure');
  });

  it('records token usage', () => {
    const spy = vi.spyOn(metrics, 'observe');
    AIMetrics.getInstance().recordTokenUsage(100, 50);
    expect(spy).toHaveBeenCalledWith('ai.tokens.input', 100);
    expect(spy).toHaveBeenCalledWith('ai.tokens.output', 50);
  });

  it('records cost', () => {
    const spy = vi.spyOn(metrics, 'observe');
    AIMetrics.getInstance().recordCost(0.001);
    expect(spy).toHaveBeenCalledWith('ai.cost.total', 0.001);
  });

  it('records fallback and rate limit counters', () => {
    const spy = vi.spyOn(metrics, 'increment');
    AIMetrics.getInstance().recordFallback();
    AIMetrics.getInstance().recordRateLimit();
    expect(spy).toHaveBeenCalledWith('ai.fallback.count');
    expect(spy).toHaveBeenCalledWith('ai.ratelimit.hit');
  });

  it('records provider health gauge', () => {
    const spy = vi.spyOn(metrics, 'setGauge');
    AIMetrics.getInstance().recordProviderHealth(true);
    AIMetrics.getInstance().recordProviderHealth(false);
    expect(spy).toHaveBeenCalledWith('ai.provider.health', 1);
    expect(spy).toHaveBeenCalledWith('ai.provider.health', 0);
  });

  it('records validation result, cache hit, and cache miss counters', () => {
    const spy = vi.spyOn(metrics, 'increment');
    AIMetrics.getInstance().recordValidationResult();
    AIMetrics.getInstance().recordCacheHit();
    AIMetrics.getInstance().recordCacheMiss();
    expect(spy).toHaveBeenCalledWith('ai.validation.result');
    expect(spy).toHaveBeenCalledWith('ai.cache.hit');
    expect(spy).toHaveBeenCalledWith('ai.cache.miss');
  });

  it('records provider latency as an observation and a gauge', () => {
    const observe = vi.spyOn(metrics, 'observe');
    const setGauge = vi.spyOn(metrics, 'setGauge');
    AIMetrics.getInstance().recordProviderLatency('openai', 123);
    expect(observe).toHaveBeenCalledWith('ai.provider.latency', 123);
    expect(setGauge).toHaveBeenCalledWith('ai.provider.latency.openai', 123);
  });

  it('getCacheHitRatio returns 0 when there are no hits or misses', () => {
    vi.spyOn(metrics, 'getCounter').mockReturnValue(0);
    expect(AIMetrics.getInstance().getCacheHitRatio()).toBe(0);
  });

  it('getCacheHitRatio computes hits divided by total', () => {
    const spy = vi.spyOn(metrics, 'getCounter').mockReturnValueOnce(3).mockReturnValueOnce(1);
    expect(AIMetrics.getInstance().getCacheHitRatio()).toBe(0.75);
  });

  it('getTotalRequests reads the requests counter', () => {
    vi.spyOn(metrics, 'getCounter').mockReturnValue(7);
    expect(AIMetrics.getInstance().getTotalRequests()).toBe(7);
  });
});
