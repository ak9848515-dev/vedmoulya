// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Domain Service: Health
// Fleet-level provider health aggregation: per-status counts, average
// latency/failure rates, and availability tiers. Informational only —
// automatic routing is a later sprint.
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { ProviderStatus as ProviderHealthStatus } from '@vedmoulya/ai';
import type { Provider } from '../entities/Provider.js';

export interface ProviderHealthSnapshotView {
  providerId: string;
  providerName: string;
  status: ProviderHealthStatus;
  healthScore: number;
  latencyMs: number;
  successCount: number;
  failureCount: number;
  quotaUsedPercent: number;
  lastCheckedAt: string;
}

export interface ProviderFleetHealth {
  /** Providers whose healthScore >= 0.7. */
  healthyCount: number;
  /** Providers whose healthScore is 0.4–0.7 or with recent failures. */
  degradedCount: number;
  /** Providers whose healthScore < 0.4. */
  unstableCount: number;
  downCount: number;
  totalCount: number;
  averageHealthScore: number;
  averageLatencyMs: number;
  totalFailures: number;
  snapshots: ProviderHealthSnapshotView[];
}

export class ProviderHealthService {
  /** Fleet-wide health aggregation. */
  fleetHealth(providers: readonly Provider[]): ProviderFleetHealth {
    const snapshots: ProviderHealthSnapshotView[] = providers.map((p) => {
      const health = p.health;
      return {
        providerId: p.id,
        providerName: p.name,
        status: health.status,
        healthScore: health.healthScore,
        latencyMs: health.latencyMs,
        successCount: health.successCount,
        failureCount: health.failureCount,
        quotaUsedPercent: health.quotaUsedPercent,
        lastCheckedAt: health.lastCheckedAt,
      };
    });

    let healthyCount = 0;
    let degradedCount = 0;
    let unstableCount = 0;
    let downCount = 0;
    let scoreSum = 0;
    let latencySum = 0;
    let totalFailures = 0;

    for (const s of snapshots) {
      // The declared type is the canonical `ProviderStatus` union, but this
      // value is persisted/hydrated from storage that is NOT validated on read
      // (the Postgres repository casts the JSONB column), so at runtime it may
      // be any string. Treat it as such — never as a type-guaranteed literal.
      const status: string = s.status;
      if (status === 'down') downCount += 1;
      else if (status === 'unstable') unstableCount += 1;
      else if (status === 'degraded') degradedCount += 1;
      else if (status === 'healthy') healthyCount += 1;
      // F-R2 — FAIL CLOSED: a status outside the canonical vocabulary must
      // never be silently counted as healthy. This contract has no 'unknown'
      // member, so it is reported as `unstable` — "present but not confirmed
      // usable" — rather than inventing a new status value.
      else unstableCount += 1;
      scoreSum += s.healthScore;
      latencySum += s.latencyMs;
      totalFailures += s.failureCount;
    }

    const total = snapshots.length;
    return {
      healthyCount,
      degradedCount,
      unstableCount,
      downCount,
      totalCount: total,
      averageHealthScore: total === 0 ? 0 : scoreSum / total,
      averageLatencyMs: total === 0 ? 0 : latencySum / total,
      totalFailures,
      snapshots: snapshots.sort((a, b) => b.healthScore - a.healthScore),
    };
  }

  /**
   * Classify a provider into an availability tier for display purposes:
   *   ready   = healthy + lifecycle active
   *   caution = degraded or in maintenance
   *   risk    = unstable/down or deprecated
   */
  availabilityTier(provider: Provider): 'ready' | 'caution' | 'risk' {
    const lifecycle = provider.lifecycleStatus.value;
    const health = provider.health;
    // Runtime truth, not the declared union — see `fleetHealth`. Persisted
    // health is hydrated without validation, so an unrecognized value must be
    // treated as "not confirmed usable" rather than defaulting to ready.
    const status: string = health.status;
    if (
      status === 'down' ||
      status === 'unstable' ||
      lifecycle === 'deprecated' ||
      lifecycle === 'archived'
    ) {
      return 'risk';
    }
    if (status === 'degraded' || lifecycle === 'maintenance') {
      return 'caution';
    }
    // F-R2 — FAIL CLOSED: only an explicitly healthy provider is 'ready'. An
    // unrecognized status previously fell through to 'ready' and is now 'risk'.
    if (status === 'healthy') {
      return 'ready';
    }
    return 'risk';
  }
}
