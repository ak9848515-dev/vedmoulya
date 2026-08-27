// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Provider Router
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// The ProviderRouter selects the best provider for a work item based on:
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

// ── Provider Selection ────────────────────────────────────────────────────

export interface ProviderSelection {
  /** Selected provider name. */
  selectedProvider: string;

  /** Selected model (if applicable). */
  selectedModel?: string;

  /** Why this provider was selected. */
  reason: string;

  /** Alternative providers considered. */
  alternatives: ProviderCandidate[];

  /** Estimated cost for this selection. */
  estimatedCostUsd: number;

  /** Estimated latency in ms. */
  estimatedLatencyMs: number;

  /** Timestamp of the selection. */
  selectedAt: string;
}

// ── Provider Candidate ────────────────────────────────────────────────────

export interface ProviderCandidate {
  /** Provider name. */
  providerName: string;

  /** Model to use. */
  model?: string;

  /** Health score (0-1). */
  healthScore: number;

  /** Estimated latency in ms. */
  estimatedLatencyMs: number;

  /** Estimated cost in USD. */
  estimatedCostUsd: number;

  /** Current concurrency load (0-1). */
  concurrencyLoad: number;

  /** Whether the provider supports the required capability. */
  capabilityMatch: boolean;

  /** Whether the provider is available (not saturated, not unhealthy). */
  available: boolean;

  /** Reason for unavailability. */
  unavailabilityReason?: string;
}

// ── Provider Health ───────────────────────────────────────────────────────

export interface ProviderHealthStatus {
  /** Provider name. */
  providerName: string;

  /** Overall health status. */
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

  /** Health score (0-1). */
  score: number;

  /** Latency in ms (last check). */
  lastLatencyMs: number;

  /** Error rate (0-1). */
  errorRate: number;

  /** Success rate (0-1). */
  successRate: number;

  /** Total requests in the monitoring window. */
  totalRequests: number;

  /** Failed requests in the monitoring window. */
  failedRequests: number;

  /** Timestamp of the last health check. */
  lastCheckedAt: string;
}

// ── Routing Decision ──────────────────────────────────────────────────────

export interface RoutingDecision {
  /** The work item that was routed. */
  workItemId: string;

  /** The capability that was required. */
  requiredCapability: string;

  /** The selection made. */
  selection: ProviderSelection;

  /** Whether fallback was used. */
  usedFallback: boolean;

  /** If fallback was used, which provider failed. */
  failedProvider?: string;

  /** Failure reason (if fallback was used). */
  failureReason?: string;

  /** Timestamp of the routing decision. */
  decidedAt: string;
}

// ── Provider Router Configuration ─────────────────────────────────────────

export interface ProviderRouterConfig {
  /** Whether to enable cost-based selection. */
  enableCostOptimization: boolean;

  /** Whether to enable latency-based selection. */
  enableLatencyOptimization: boolean;

  /** Maximum number of fallback attempts. */
  maxFallbackAttempts: number;

  /** Health check interval in ms. */
  healthCheckIntervalMs: number;

  /** How long a provider stays "unhealthy" before re-checking. */
  unhealthyCooldownMs: number;

  /** Saturation threshold (0-1). */
  saturationThreshold: number;
}
