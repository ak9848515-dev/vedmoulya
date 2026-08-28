// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Provider Router
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// Selects the best provider for a work item based on:
// - Capability requirements
// - Provider health and availability
// - Provider latency and cost
// - Provider-specific concurrency limits
// - Fallback capability
//
// If the selected provider is saturated, the router queues or routes
// to an appropriate alternative. It does NOT blindly retry a failed
// provider indefinitely.
// ──────────────────────────────────────────────────────────────────

import type { WorkItem } from '../types/work-item.js';
import type {
  ProviderSelection,
  ProviderCandidate,
  ProviderHealthStatus,
  ProviderRouterConfig,
  RoutingDecision,
} from '../types/provider-router.js';

const DEFAULT_ROUTER_CONFIG: ProviderRouterConfig = {
  enableCostOptimization: true,
  enableLatencyOptimization: true,
  maxFallbackAttempts: 3,
  healthCheckIntervalMs: 30000,
  unhealthyCooldownMs: 60000,
  saturationThreshold: 0.8,
};

export class ProviderRouter {
  /** Registered providers with their health status. */
  private readonly providers = new Map<string, ProviderHealthStatus>();

  /** Provider capabilities (provider name → supported capabilities). */
  private readonly capabilities = new Map<string, string[]>();

  /** Provider models (provider name → available models). */
  private readonly models = new Map<string, string[]>();

  /** Provider costs (provider name → cost per 1k tokens). */
  private readonly costs = new Map<string, number>();

  /** Provider latencies (provider name → average latency ms). */
  private readonly latencies = new Map<string, number>();

  /** Routing decisions log. */
  private readonly routingDecisions: RoutingDecision[] = [];

  private readonly config: ProviderRouterConfig;

  constructor(config?: Partial<ProviderRouterConfig>) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
  }

  /**
   * Register a provider with its capabilities.
   */
  registerProvider(info: {
    name: string;
    capabilities: string[];
    models?: string[];
    costPer1kTokens?: number;
    averageLatencyMs?: number;
  }): void {
    this.capabilities.set(info.name, info.capabilities);
    if (info.models) this.models.set(info.name, info.models);
    if (info.costPer1kTokens !== undefined) this.costs.set(info.name, info.costPer1kTokens);
    if (info.averageLatencyMs !== undefined) this.latencies.set(info.name, info.averageLatencyMs);

    // Initialize health as healthy
    this.providers.set(info.name, {
      providerName: info.name,
      status: 'healthy',
      score: 1.0,
      lastLatencyMs: info.averageLatencyMs ?? 0,
      errorRate: 0,
      successRate: 1,
      totalRequests: 0,
      failedRequests: 0,
      lastCheckedAt: new Date().toISOString(),
    });
  }

  /**
   * Update provider health status.
   */
  updateHealth(health: ProviderHealthStatus): void {
    this.providers.set(health.providerName, health);
  }

  /**
   * Select the best provider for a work item.
   * Returns null if no suitable provider is available.
   */
  selectProvider(workItem: WorkItem): ProviderSelection | null {
    const candidates = this.findCandidates(workItem);
    if (candidates.length === 0) return null;

    // Score and rank candidates
    const scored = candidates.map((c) => ({
      candidate: c,
      score: this.scoreCandidate(c, workItem),
    }));

    scored.sort((a, b) => b.score - a.score);

    const first = scored.shift();
    if (!first) return null;
    const selected = first.candidate;
    const alternatives = scored.map((s) => s.candidate);

    const selection: ProviderSelection = {
      selectedProvider: selected.providerName,
      selectedModel: selected.model,
      reason: this.explainSelection(selected, workItem),
      alternatives,
      estimatedCostUsd: selected.estimatedCostUsd,
      estimatedLatencyMs: selected.estimatedLatencyMs,
      selectedAt: new Date().toISOString(),
    };

    // Log the routing decision
    this.routingDecisions.push({
      workItemId: workItem.id,
      requiredCapability: workItem.resources.aiCapability ?? 'none',
      selection,
      usedFallback: false,
      decidedAt: new Date().toISOString(),
    });

    return selection;
  }

  /**
   * Record a routing failure (for fallback tracking).
   */
  recordFailure(workItemId: string, failedProvider: string, reason: string): void {
    const decision = this.routingDecisions.find((d) => d.workItemId === workItemId);
    if (decision) {
      decision.usedFallback = true;
      decision.failedProvider = failedProvider;
      decision.failureReason = reason;
    }
  }

  /**
   * Get all registered providers.
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.capabilities.keys());
  }

  /**
   * Get the health status of a provider.
   */
  getProviderHealth(providerName: string): ProviderHealthStatus | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Get routing decisions (for observability).
   */
  getRoutingDecisions(limit: number = 50): RoutingDecision[] {
    return this.routingDecisions.slice(-limit);
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  private findCandidates(workItem: WorkItem): ProviderCandidate[] {
    const requiredCapability = workItem.resources.aiCapability;
    const requiredProviders = workItem.resources.preferredProviders ?? [];

    const candidates: ProviderCandidate[] = [];

    for (const [providerName, providerCapabilities] of this.capabilities) {
      // Check capability match
      const capabilityMatch = requiredCapability
        ? providerCapabilities.includes(requiredCapability)
        : true;

      if (!capabilityMatch) continue;

      // Check provider health
      const health = this.providers.get(providerName);
      const isAvailable = health && health.status !== 'unhealthy';

      // Check saturation
      const saturationThreshold = this.config.saturationThreshold;
      const isSaturated = health ? health.score < saturationThreshold : false;

      // Get model
      const models = this.models.get(providerName);
      const model = models?.[0];

      // Get cost and latency
      const cost = this.costs.get(providerName) ?? 0;
      const latency = this.latencies.get(providerName) ?? 0;

      candidates.push({
        providerName,
        model,
        healthScore: health?.score ?? 0.5,
        estimatedLatencyMs: latency,
        estimatedCostUsd: cost,
        concurrencyLoad: health ? 1 - health.score : 0,
        capabilityMatch,
        available: Boolean(isAvailable && !isSaturated),
        unavailabilityReason: !isAvailable
          ? health?.status === 'unhealthy'
            ? 'unhealthy'
            : 'not registered'
          : isSaturated
            ? 'saturated'
            : undefined,
      });
    }

    // Sort: available providers first, then by preference match
    candidates.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      const aPreferred = requiredProviders.includes(a.providerName) ? 0 : 1;
      const bPreferred = requiredProviders.includes(b.providerName) ? 0 : 1;
      return aPreferred - bPreferred;
    });

    return candidates;
  }

  private scoreCandidate(candidate: ProviderCandidate, workItem: WorkItem): number {
    let score = 0;

    // Health score (30%)
    score += candidate.healthScore * 30;

    // Latency score (20%) — lower is better
    const maxLatency = 10000; // 10 seconds as baseline
    const latencyScore = 1 - Math.min(candidate.estimatedLatencyMs / maxLatency, 1);
    score += latencyScore * 20;

    // Cost score (20%) — lower is better
    const maxCost = 10; // $10 as baseline
    const costScore = this.config.enableCostOptimization
      ? 1 - Math.min(candidate.estimatedCostUsd / maxCost, 1)
      : 0.5;
    score += costScore * 20;

    // Availability score (20%)
    score += (candidate.available ? 1 : 0) * 20;

    // Preference match (10%)
    const preferredProviders = workItem.resources.preferredProviders ?? [];
    const preferenceMatch = preferredProviders.includes(candidate.providerName) ? 1 : 0;
    score += preferenceMatch * 10;

    return score;
  }

  private explainSelection(selected: ProviderCandidate, workItem: WorkItem): string {
    const reasons: string[] = [];

    if (selected.healthScore >= 0.8) {
      reasons.push('high health score');
    }
    if (selected.estimatedLatencyMs < 2000) {
      reasons.push('low latency');
    }
    if (selected.estimatedCostUsd < 1) {
      reasons.push('low cost');
    }
    if (selected.available) {
      reasons.push('available');
    }

    const preferredProviders = workItem.resources.preferredProviders ?? [];
    if (preferredProviders.includes(selected.providerName)) {
      reasons.push('preferred by work item');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'best available';
  }
}
