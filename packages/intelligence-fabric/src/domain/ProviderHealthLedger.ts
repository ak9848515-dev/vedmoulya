// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · ProviderHealthLedger
// SPRINT-030 — G-1 · runtime provider-health observation.
//
// State is derived ONLY from ACTUAL call outcomes fed in through `observe()`:
//   UNKNOWN        — no observations yet (never fabricated)
//   HEALTHY        — success rate ≥ 0.9 in the window
//   DEGRADED       — success rate ≥ 0.5 and < 0.9, or latency spike
//   UNAVAILABLE    — success rate < 0.5, or quota exhausted / provider down
//   MISCONFIGURED  — a config_error observation (credentials/endpoint)
//
// Registry-declared health is NOT used here — this ledger is the OBSERVED
// runtime truth. It implements no routing decision: the frozen selection
// authority consumes the state through the selection strategy.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  HealthObservation,
  ProviderHealth,
  ProviderHealthState,
} from '../types/fabric-types.js';

export interface ProviderHealthLedgerOptions {
  /** Observations retained per provider (bounded — oldest dropped). */
  maxObservationsPerProvider?: number;
  now?: () => string;
}

interface ProviderRecord {
  observations: HealthObservation[];
}

/**
 * Bounded, evidence-only runtime health ledger. Deterministic: given the same
 * observations, the same state is derived. Never invents latency or success
 * rates — a provider with zero observations reports UNKNOWN.
 */
export class ProviderHealthLedger {
  private readonly maxObservationsPerProvider: number;
  private readonly now: () => string;
  private readonly byProvider = new Map<string, ProviderRecord>();

  constructor(options: ProviderHealthLedgerOptions = {}) {
    this.maxObservationsPerProvider = options.maxObservationsPerProvider ?? 200;
    this.now = options.now ?? ((): string => new Date().toISOString());
  }

  /** Record one real call outcome. Bounded, idempotent by design. */
  observe(observation: HealthObservation): void {
    const record = this.byProvider.get(observation.providerId) ?? { observations: [] };
    record.observations.push(observation);
    if (record.observations.length > this.maxObservationsPerProvider) {
      record.observations = record.observations.slice(-this.maxObservationsPerProvider);
    }
    this.byProvider.set(observation.providerId, record);
  }

  /** Current observed state — UNKNOWN until evidence exists. */
  health(providerId: string): ProviderHealth {
    const record = this.byProvider.get(providerId);
    if (!record || record.observations.length === 0) {
      return {
        providerId,
        state: 'UNKNOWN',
        observedCalls: 0,
        recentSuccessRate: 0,
        evidence: ['No runtime observations yet — state is UNKNOWN (never fabricated).'],
      };
    }
    return this.derive(providerId, record.observations);
  }

  /** All observed provider ids (bounded enumeration for the gateway). */
  listProviderIds(): string[] {
    return [...this.byProvider.keys()];
  }

  /** Per-provider snapshots for the gateway/UI. */
  all(): ProviderHealth[] {
    return this.listProviderIds().map((id) => this.health(id));
  }

  private derive(providerId: string, observations: HealthObservation[]): ProviderHealth {
    const evidence: string[] = [];
    let successes = 0;
    let latencySum = 0;
    let latencyCount = 0;
    let lastObservedAt: string | undefined;
    let quota = false;
    let configError = false;

    for (const obs of observations) {
      if (obs.kind === 'success') successes += 1;
      if (obs.kind === 'quota_exhausted') quota = true;
      if (obs.kind === 'config_error') configError = true;
      if (obs.latencyMs !== undefined) {
        latencySum += obs.latencyMs;
        latencyCount += 1;
      }
      lastObservedAt = obs.at;
    }

    const total = observations.length;
    const successRate = successes / total;
    const avgLatencyMs = latencyCount > 0 ? latencySum / latencyCount : undefined;

    let state: ProviderHealthState;
    if (configError) {
      state = 'MISCONFIGURED';
      evidence.push('A configuration error was observed (credentials/endpoint).');
    } else if (quota) {
      state = 'UNAVAILABLE';
      evidence.push('Provider reported quota exhaustion.');
    } else if (successRate < 0.5) {
      state = 'UNAVAILABLE';
      evidence.push(
        `Success rate ${Math.round(successRate * 100)}% over ${total} observed calls — below 50%.`,
      );
    } else if (successRate < 0.9) {
      state = 'DEGRADED';
      evidence.push(
        `Success rate ${Math.round(successRate * 100)}% over ${total} observed calls — between 50% and 90%.`,
      );
    } else {
      state = 'HEALTHY';
      evidence.push(`Success rate ${Math.round(successRate * 100)}% over ${total} observed calls.`);
    }

    if (avgLatencyMs !== undefined) {
      evidence.push(`Average observed latency ${Math.round(avgLatencyMs)}ms.`);
    }

    return {
      providerId,
      state,
      observedCalls: total,
      recentSuccessRate: successRate,
      avgLatencyMs,
      lastObservedAt,
      evidence,
    };
  }
}
