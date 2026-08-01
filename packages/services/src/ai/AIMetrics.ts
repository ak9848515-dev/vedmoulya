// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestrator Metrics
// Metrics collection for AI provider requests
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import { metrics } from '@vedmoulya/core';

export class AIMetrics {
  private static instance: AIMetrics | undefined;

  static getInstance(): AIMetrics {
    if (AIMetrics.instance === undefined) {
      AIMetrics.instance = new AIMetrics();
    }
    return AIMetrics.instance;
  }

  recordRequest(): void {
    metrics.increment('ai.requests.total');
  }

  recordSuccess(latencyMs: number): void {
    metrics.increment('ai.requests.success');
    metrics.observe('ai.requests.latency', latencyMs);
  }

  recordFailure(): void {
    metrics.increment('ai.requests.failure');
  }

  recordTokenUsage(inputTokens: number, outputTokens: number): void {
    metrics.observe('ai.tokens.input', inputTokens);
    metrics.observe('ai.tokens.output', outputTokens);
  }

  recordCost(cost: number): void {
    metrics.observe('ai.cost.total', cost);
  }

  recordFallback(): void {
    metrics.increment('ai.fallback.count');
  }

  recordRateLimit(): void {
    metrics.increment('ai.ratelimit.hit');
  }

  recordProviderHealth(healthy: boolean): void {
    metrics.setGauge('ai.provider.health', healthy ? 1 : 0);
  }

  recordValidationResult(): void {
    metrics.increment('ai.validation.result');
  }

  recordCacheHit(): void {
    metrics.increment('ai.cache.hit');
  }

  recordCacheMiss(): void {
    metrics.increment('ai.cache.miss');
  }

  recordProviderLatency(provider: string, latencyMs: number): void {
    metrics.observe('ai.provider.latency', latencyMs);
    metrics.setGauge(`ai.provider.latency.${provider}`, latencyMs);
  }

  /**
   * Current cache hit ratio (0..1) from the global metrics registry.
   * PH-002 — T4 performance observability: feeds the health cache metric
   * and the Grafana AI dashboard.
   */
  getCacheHitRatio(): number {
    const hits = metrics.getCounter('ai.cache.hit');
    const misses = metrics.getCounter('ai.cache.miss');
    const total = hits + misses;
    return total === 0 ? 0 : hits / total;
  }

  /**
   * Total AI requests (all outcomes).
   */
  getTotalRequests(): number {
    return metrics.getCounter('ai.requests.total');
  }
}
