// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: SourcePolicyEngine
// EPIC-018 — Phase 4 source policy.
//
//   Source
//    ↓
//   Enabled?
//    ↓
//   Cooldown expired?
//    ↓
//   Rate limit available?
//    ↓
//   Budget available?
//    ↓
//   (Security policy satisfied — enforced by the EPIC-012C
//    SecurityScanner inside the existing discovery pipeline)
//    ↓
//   Run discovery
//
// Tracks per source: last attempted / last successful / last
// meaningful result / consecutive failures / next eligible time /
// calls consumed / budget consumed. Failure is ISOLATED — a gated or
// failed source NEVER prevents other sources from running (the
// scheduler asks the engine per source and continues regardless).
// ──────────────────────────────────────────────────────────────────

import type { DiscoverySourcePolicy, SourcePolicyGateResult } from '../types/scheduler-types.js';
import type { SourcePolicyStore } from '../contracts/scheduler-ports.js';

/** Default per-source posture when the store has no record yet. */
const DEFAULT_POLICY: Omit<DiscoverySourcePolicy, 'sourceId'> = {
  enabled: true,
  callsConsumed: 0,
  rateLimitWindowStartedAtMs: 0,
  maxCallsPerWindow: 20,
  rateLimitWindowMs: 60 * 60 * 1000, // 1h windowed source rate limit
  budgetConsumedUsd: 0,
  consecutiveFailures: 0,
};

export interface SourcePolicyEngineOptions {
  /** Hard cumulative cost cap per source (budget dimension). */
  maxBudgetUsdPerSource?: number;
}

export class SourcePolicyEngine {
  private readonly store: SourcePolicyStore;
  private readonly maxBudgetUsdPerSource: number;

  constructor(store: SourcePolicyStore, options: SourcePolicyEngineOptions = {}) {
    this.store = store;
    this.maxBudgetUsdPerSource = options.maxBudgetUsdPerSource ?? 0.1;
  }

  /** The full gate: enabled → cooldown → backoff → rate limit → budget. */
  gate(
    sourceId: string,
    opts: { nowMs: number; runBudgetExceeded: boolean },
  ): SourcePolicyGateResult {
    const policy = this.read(sourceId);

    if (!policy.enabled) return { allowed: false, reason: 'disabled' };
    if (policy.cooldownUntilMs !== undefined && opts.nowMs < policy.cooldownUntilMs) {
      return { allowed: false, reason: 'cooldown' };
    }
    if (policy.nextEligibleAtMs !== undefined && opts.nowMs < policy.nextEligibleAtMs) {
      return { allowed: false, reason: 'backoff' };
    }

    // Windowed source rate limit.
    if (opts.nowMs - policy.rateLimitWindowStartedAtMs > policy.rateLimitWindowMs) {
      policy.rateLimitWindowStartedAtMs = opts.nowMs;
      policy.callsConsumed = 0;
    }
    if (policy.callsConsumed >= policy.maxCallsPerWindow) {
      return { allowed: false, reason: 'rate_limited' };
    }
    if (policy.budgetConsumedUsd >= this.maxBudgetUsdPerSource) {
      return { allowed: false, reason: 'budget_exhausted' };
    }
    if (opts.runBudgetExceeded) {
      return { allowed: false, reason: 'budget_exhausted' };
    }
    return { allowed: true };
  }

  /**
   * Record one attempt outcome. Success resets failure tracking;
   * failure increments consecutiveFailures and applies exponential
   * backoff (capped) — never infinite retries.
   */
  recordAttempt(
    sourceId: string,
    opts: {
      success: boolean;
      meaningful: boolean;
      calls: number;
      nowMs: number;
      nowIso: string;
      baseBackoffMs: number;
      maxBackoffMs: number;
    },
  ): void {
    const policy = this.read(sourceId);
    policy.lastAttemptedAt = opts.nowIso;
    policy.callsConsumed += Math.max(1, opts.calls);

    if (opts.success) {
      policy.consecutiveFailures = 0;
      policy.lastSuccessfulAt = opts.nowIso;
      policy.nextEligibleAtMs = undefined;
      if (opts.meaningful) {
        policy.lastMeaningfulResultAt = opts.nowIso;
      }
    } else {
      policy.consecutiveFailures += 1;
      const backoff = Math.min(
        opts.baseBackoffMs * 2 ** (policy.consecutiveFailures - 1),
        opts.maxBackoffMs,
      );
      policy.nextEligibleAtMs = opts.nowMs + backoff;
    }
    this.store.save(policy);
  }

  /** Enable/disable a source (operator control). */
  setEnabled(sourceId: string, enabled: boolean): void {
    const policy = this.read(sourceId);
    policy.enabled = enabled;
    this.store.save(policy);
  }

  /** Explicit cooldown (e.g. notification storm guard). */
  setCooldown(sourceId: string, untilMs: number): void {
    const policy = this.read(sourceId);
    policy.cooldownUntilMs = untilMs;
    this.store.save(policy);
  }

  list(): DiscoverySourcePolicy[] {
    return this.store.list();
  }

  private read(sourceId: string): DiscoverySourcePolicy {
    const existing = this.store.get(sourceId);
    if (existing) return existing;
    const created: DiscoverySourcePolicy = { sourceId, ...DEFAULT_POLICY };
    this.store.save(created);
    return created;
  }
}
