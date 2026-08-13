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

  /** Pre-provider deterministic input-token estimate (AI-RUNTIME-001). */
  recordTokenEstimate(tokens: number): void {
    metrics.observe('ai.tokens.estimated', tokens);
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

  /** Provider-aware prompt cache telemetry (AI-RUNTIME-002). */
  recordPromptCacheHit(): void {
    metrics.increment('ai.promptcache.hit');
  }

  recordPromptCacheMiss(): void {
    metrics.increment('ai.promptcache.miss');
  }

  getPromptCacheHitRatio(): number {
    const hits = metrics.getCounter('ai.promptcache.hit');
    const misses = metrics.getCounter('ai.promptcache.miss');
    const total = hits + misses;
    return total === 0 ? 0 : hits / total;
  }

  /** Context optimization economics (AI-RUNTIME-002). */
  recordContextOptimization(originalTokens: number, finalTokens: number, ratio: number): void {
    metrics.observe('ai.context.original_tokens', originalTokens);
    metrics.observe('ai.context.final_tokens', finalTokens);
    metrics.observe('ai.context.compression_ratio', ratio);
  }

  /** Provider selection telemetry (AI-RUNTIME-002). */
  recordProviderSelection(providerId: string): void {
    metrics.increment(`ai.selection.${providerId}`);
  }

  /** Evidence-First abstention telemetry (AI-RUNTIME-002 Phase 8). */
  recordAbstention(): void {
    metrics.increment('ai.abstention.count');
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
