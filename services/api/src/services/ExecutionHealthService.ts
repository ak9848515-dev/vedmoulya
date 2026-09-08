/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: every dynamic key is a scope key built from provider/model
   ids in the shared provider registry, never attacker-controlled input. */

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Health Service
// Capability Intelligence — REAL-TIME health feedback from actual execution.
//
// PURPOSE
//   Execution outcomes (success / classified failure) are reported through the
//   runtime's HealthFeedbackPort. This service turns them into bounded,
//   deterministic, RECOVERABLE provider/model health that the routing advisor
//   reads on the next decision. It NEVER changes provider configuration, never
//   disables a provider, and never mutates credentials.
//
// HEALTH vs EVIDENCE (kept separate by design)
//   HEALTH   = \"what is happening recently?\" — this service, short recency
//              window (default half-life 10 minutes), bounded in memory.
//   EVIDENCE = \"how has this provider/model historically performed?\" — the
//              RoutingEvidenceService (30-day half-life over the trace store).
//   Both reach the advisor, but never as one opaque number.
//
// SCOPE (provider vs model — the narrowest applicable scope wins)
//   Every outcome updates BOTH the provider scope AND the provider+model
//   scope. An unsupported_model failure is recorded ONLY at model scope: a
//   model that the adapter cannot execute must never disable its provider.
//   An authentication failure is recorded at provider scope only: the whole
//   provider is ineligible until its configuration is repaired.
//
// BOUNDED + RECOVERABLE
//   Windows are capped (default 60 outcomes per scope) and each outcome is
//   weighted by the SAME deterministic recency decay the RoutingEvidenceService
//   exports (recencyWeight) — one decay algorithm for the whole platform.
//   One-off failures never flip a verdict (min-sample floors); consecutive
//   failure bursts do; resumed successes slide the window back to HEALTHY.
//
// PERSISTENCE (throttled, bounded writes)
//   Verdicts are written into the EXISTING provider health store via an
//   injected persist function (registry recordHealthSample) only when they
//   carry information: on verdict transitions (min 10s apart) or when ≥8
//   outcomes accumulate, or after 60s with at least one outcome. UNKNOWN
//   (no data) never persists.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  RuntimeExecutionHealth,
  RuntimeHealthVerdict,
  HealthFeedbackPort,
} from '@vedmoulya/services';
import { recencyWeight } from './RoutingEvidenceService.js';

// ── Tunables (deterministic, documented) ────────────────────────────────────

/** Outcome events retained per scope (ring buffer). */
const WINDOW_MAX_EVENTS = 60;
/** Recency half-life for RUNTIME health: 10 minutes — health answers
 *  \"what is happening NOW?\", unlike evidence's 30-day history. */
const HALF_LIFE_MS_DEFAULT = 10 * 60 * 1000;
/** Consecutive failures at which a provider/model is treated as UNAVAILABLE
 *  even with few samples (a burst, not a streak of noise). */
const BURST_UNAVAILABLE_THRESHOLD = 5;
/** Minimum weighted samples before a verdict other than UNKNOWN. */
const MIN_EFFECTIVE_SAMPLES = 2;
/** Sustained-failure horizon for UNAVAILABLE/DEGRADED verdicts. */
const SUSTAINED_EFFECTIVE_SAMPLES = 4;
/** Weighted success below which sustained failures mean UNAVAILABLE. */
const UNAVAILABLE_SUCCESS_BELOW = 0.5;
/** Weighted success below which a provider/model is DEGRADED. */
const DEGRADED_SUCCESS_BELOW = 0.9;

// Persistence throttle constants.
const PERSIST_MIN_TRANSITION_INTERVAL_MS = 10_000;
const PERSIST_BATCH_SIZE = 8;

interface OutcomeEvent {
  ok: boolean;
  /** Classified FailureReason when !ok. */
  reason?: string;
  at: number;
}

interface ScopeState {
  events: OutcomeEvent[];
}

export interface ExecutionHealthOptions {
  /** Deterministic clock for tests. Default Date.now. */
  now?: () => number;
  /** Recency half-life in ms (default 10 minutes). */
  halfLifeMs?: number;
  /** Max outcome events retained per scope (default 60). */
  maxEvents?: number;
  /** Persist a compact health sample for a provider (registry recordHealthSample). */
  persist?: (providerId: string, sample: { ok: boolean; latencyMs?: number }) => Promise<void>;
}

export interface ExecutionHealthSnapshot {
  provider: RuntimeExecutionHealth | undefined;
  model?: RuntimeExecutionHealth;
}

const scopeKey = (providerId: string, modelId?: string): string =>
  modelId ? `${providerId}|${modelId}` : providerId;

function isUnsupported(reason: string | undefined): boolean {
  return reason === 'unsupported_model';
}

/**
 * Deterministic verdict from a bounded, recency-weighted outcome window.
 * Shared by provider and provider+model scopes. Rules (explainable + tested):
 *   1. ≥5 consecutive failures            → UNAVAILABLE (burst)
 *   2. eff ≥4: success < 0.5              → UNAVAILABLE (sustained)
 *   3. eff ≥4: success < 0.9              → DEGRADED
 *   4. eff ≥2: ≥2 consecutive failures    → DEGRADED (early streak)
 *   5. eff ≥2                             → HEALTHY
 *   6. otherwise                          → UNKNOWN
 * An authentication failure with no later success overrides to UNAVAILABLE
 * (ineligible until configuration is repaired — never an auto-disable).
 */
export function computeScopeHealth(
  state: ScopeState | undefined,
  now: number,
  halfLifeMs: number,
): RuntimeExecutionHealth | undefined {
  if (!state || state.events.length === 0) return undefined;

  let totalWeight = 0;
  let successWeight = 0;
  let timeoutCount = 0;
  let rateLimitCount = 0;
  let authFailureCount = 0;
  let unsupportedCount = 0;
  let consecutiveFailures = 0;
  let lastSuccessAt: number | undefined;
  let lastFailureAt: number | undefined;
  let newestAuthFailureAt: number | undefined;

  // Iterate oldest → newest; track the trailing consecutive-failure streak.
  const events = state.events;
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event === undefined) continue;
    if (event.ok) break;
    consecutiveFailures += 1;
  }

  for (const event of events) {
    if (event.ok) {
      successWeight += recencyWeight(now - event.at, halfLifeMs);
      if (lastSuccessAt === undefined || event.at > lastSuccessAt) lastSuccessAt = event.at;
    } else {
      if (event.reason === 'timeout') timeoutCount += 1;
      else if (event.reason === 'rate_limited') rateLimitCount += 1;
      else if (event.reason === 'authentication_error') {
        authFailureCount += 1;
        if (newestAuthFailureAt === undefined || event.at > newestAuthFailureAt) {
          newestAuthFailureAt = event.at;
        }
      } else if (event.reason === 'unsupported_model') unsupportedCount += 1;
      if (lastFailureAt === undefined || event.at > lastFailureAt) lastFailureAt = event.at;
    }
    totalWeight += recencyWeight(now - event.at, halfLifeMs);
  }

  const weightedSuccessRate = totalWeight > 0 ? successWeight / totalWeight : undefined;
  const effective = Math.round(totalWeight * 100) / 100;

  let verdict: RuntimeHealthVerdict;
  let detail: string | undefined;

  // Authentication override: credentials broken → ineligible until repaired.
  const hasSuccessAfterAuthFailure =
    newestAuthFailureAt !== undefined &&
    lastSuccessAt !== undefined &&
    lastSuccessAt > newestAuthFailureAt;
  if (newestAuthFailureAt !== undefined && !hasSuccessAfterAuthFailure) {
    verdict = 'UNAVAILABLE';
    detail = 'authentication failure — provider needs configuration repair';
  } else if (consecutiveFailures >= BURST_UNAVAILABLE_THRESHOLD) {
    verdict = 'UNAVAILABLE';
    detail = `${consecutiveFailures} consecutive execution failures (burst)`;
  } else if (effective >= SUSTAINED_EFFECTIVE_SAMPLES) {
    if (weightedSuccessRate !== undefined && weightedSuccessRate < UNAVAILABLE_SUCCESS_BELOW) {
      verdict = 'UNAVAILABLE';
      detail = 'repeated execution failures';
    } else if (weightedSuccessRate !== undefined && weightedSuccessRate < DEGRADED_SUCCESS_BELOW) {
      verdict = 'DEGRADED';
      detail = 'elevated recent failure rate';
    } else {
      verdict = 'HEALTHY';
    }
  } else if (effective >= MIN_EFFECTIVE_SAMPLES) {
    if (consecutiveFailures >= 2) {
      verdict = 'DEGRADED';
      detail = 'consecutive execution failures';
    } else {
      verdict = 'HEALTHY';
    }
  } else {
    verdict = 'UNKNOWN';
  }

  return {
    scope: 'provider',
    verdict,
    sampleCount: events.length,
    weightedSuccessRate:
      weightedSuccessRate !== undefined ? Math.round(weightedSuccessRate * 1000) / 1000 : undefined,
    consecutiveFailures,
    timeoutCount,
    rateLimitCount,
    authFailureCount,
    unsupportedCount,
    lastSuccessAt: lastSuccessAt !== undefined ? new Date(lastSuccessAt).toISOString() : undefined,
    lastFailureAt: lastFailureAt !== undefined ? new Date(lastFailureAt).toISOString() : undefined,
    detail,
  };
}

/**
 * Real-time execution health tracker (implements HealthFeedbackPort and the
 * RuntimeHealthSource shape consumed by RuntimePorts).
 */
export class ExecutionHealthService implements HealthFeedbackPort {
  private readonly now: () => number;
  private readonly halfLifeMs: number;
  private readonly maxEvents: number;
  private readonly persist: (
    providerId: string,
    sample: { ok: boolean; latencyMs?: number },
  ) => Promise<void>;
  private readonly providerStates = new Map<string, ScopeState>();
  private readonly modelStates = new Map<string, ScopeState>();
  private readonly lastPersistAt = new Map<string, number>();
  private readonly lastPersistedVerdict = new Map<string, RuntimeHealthVerdict>();
  private readonly pendingOutcomes = new Map<string, number>();
  private drainTail: Promise<void> = Promise.resolve();

  constructor(options: ExecutionHealthOptions = {}) {
    this.now = options.now ?? ((): number => Date.now());
    this.halfLifeMs = options.halfLifeMs ?? HALF_LIFE_MS_DEFAULT;
    this.maxEvents = options.maxEvents ?? WINDOW_MAX_EVENTS;
    this.persist = options.persist ?? (async (): Promise<void> => {});
  }

  /** HealthFeedbackPort — record one execution outcome (sync, never throws). */
  recordExecution(outcome: {
    providerId: string;
    modelId?: string;
    ok: boolean;
    failureReason?: string;
    latencyMs?: number;
    at?: number;
  }): void {
    const at = outcome.at ?? this.now();
    const event: OutcomeEvent = {
      ok: outcome.ok,
      reason: outcome.ok ? undefined : outcome.failureReason,
      at,
    };

    // Unsupported-model failures are MODEL-scoped only: one model the adapter
    // cannot execute must never disable the whole provider (narrowest scope).
    if (!outcome.ok && isUnsupported(outcome.failureReason)) {
      if (!outcome.modelId) return; // No model id → no scope to attribute to.
      push(this.modelStates, scopeKey(outcome.providerId, outcome.modelId), event, this.maxEvents);
      this.maybePersist(outcome.providerId);
      return;
    }

    push(this.providerStates, scopeKey(outcome.providerId), event, this.maxEvents);
    if (outcome.modelId) {
      push(this.modelStates, scopeKey(outcome.providerId, outcome.modelId), event, this.maxEvents);
    }
    this.maybePersist(outcome.providerId);
  }

  /** RuntimeHealthSource — provider-scope health (undefined when no outcomes). */
  getProviderHealth(providerId: string): RuntimeExecutionHealth | undefined {
    const state = this.providerStates.get(scopeKey(providerId));
    const health = computeScopeHealth(state, this.now(), this.halfLifeMs);
    return health ? { ...health, scope: 'provider' } : undefined;
  }

  /** RuntimeHealthSource — provider+model health (undefined when no outcomes). */
  getModelHealth(providerId: string, modelId: string): RuntimeExecutionHealth | undefined {
    const state = this.modelStates.get(scopeKey(providerId, modelId));
    const health = computeScopeHealth(state, this.now(), this.halfLifeMs);
    return health ? { ...health, scope: 'provider_model' } : undefined;
  }

  /**
   * Model ids that must not be selected for this provider right now: models
   * whose model-scope verdict is UNAVAILABLE, or models the adapter declared
   * unsupported with no later success. The provider itself stays eligible.
   */
  listUnavailableModelIds(providerId: string): string[] {
    const prefix = `${providerId}|`;
    const ids: string[] = [];
    for (const [key, state] of this.modelStates) {
      if (!key.startsWith(prefix)) continue;
      const modelId = key.slice(prefix.length);
      const health = computeScopeHealth(state, this.now(), this.halfLifeMs);
      if (!health) continue;
      const unsupportedBlocked =
        health.unsupportedCount > 0 &&
        (health.lastSuccessAt === undefined || (health.lastFailureAt ?? '') > health.lastSuccessAt);
      if (health.verdict === 'UNAVAILABLE' || unsupportedBlocked) ids.push(modelId);
    }
    return ids;
  }

  /** Reset all tracked state (tests / operator reset). */
  clear(): void {
    this.providerStates.clear();
    this.modelStates.clear();
    this.lastPersistAt.clear();
    this.lastPersistedVerdict.clear();
    this.pendingOutcomes.clear();
  }

  /**
   * Wait for any queued persistence writes to settle (tests / shutdown).
   * Records that were throttled are NOT force-flushed by this call.
   */
  async flushNow(): Promise<void> {
    await this.drainTail.catch(() => undefined);
  }

  /** Force-persist a provider's CURRENT verdict regardless of throttle (tests). */
  async persistNow(providerId: string): Promise<void> {
    const health = this.getProviderHealth(providerId);
    if (!health || health.verdict === 'UNKNOWN') return;
    this.lastPersistAt.set(providerId, this.now());
    this.lastPersistedVerdict.set(providerId, health.verdict);
    await this.runPersist(providerId, health);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private maybePersist(providerId: string): void {
    const health = this.getProviderHealth(providerId);
    if (!health || health.verdict === 'UNKNOWN') return;
    const now = this.now();
    const lastPersistAt = this.lastPersistAt.get(providerId);
    const lastVerdict = this.lastPersistedVerdict.get(providerId);
    const pending = (this.pendingOutcomes.get(providerId) ?? 0) + 1;
    this.pendingOutcomes.set(providerId, pending);

    // A never-persisted provider only writes on a batch — an arbitrary epoch
    // offset must never look like a long-since-expired interval.
    const verdictChanged = lastVerdict !== undefined && lastVerdict !== health.verdict;
    const transitionEligible =
      verdictChanged &&
      lastPersistAt !== undefined &&
      now - lastPersistAt >= PERSIST_MIN_TRANSITION_INTERVAL_MS;
    const batchEligible = pending >= PERSIST_BATCH_SIZE;
    if (!transitionEligible && !batchEligible) return;

    this.pendingOutcomes.set(providerId, 0);
    // Throttle state updates SYNCHRONOUSLY at decision time — a burst of
    // records in one tick must not each observe stale state and queue
    // duplicate writes (the async persist itself stays serialized below).
    this.lastPersistAt.set(providerId, now);
    this.lastPersistedVerdict.set(providerId, health.verdict);
    void this.runPersist(providerId, health);
  }

  /** Serialized, fire-and-forget persist of one provider verdict sample. */
  private runPersist(providerId: string, health: RuntimeExecutionHealth): Promise<void> {
    const sample = {
      ok: health.verdict === 'HEALTHY' || health.verdict === 'DEGRADED',
      latencyMs: undefined as number | undefined,
    };
    const task = async (): Promise<void> => {
      try {
        await this.persist(providerId, sample);
      } catch {
        // Persistence must never break execution or routing.
      }
    };
    this.drainTail = this.drainTail.then(task, task);
    return this.drainTail;
  }
}

function push(
  map: Map<string, ScopeState>,
  key: string,
  event: OutcomeEvent,
  maxEvents: number,
): void {
  const state = map.get(key) ?? { events: [] };
  state.events.push(event);
  if (state.events.length > maxEvents) {
    state.events.splice(0, state.events.length - maxEvents);
  }
  map.set(key, state);
}
