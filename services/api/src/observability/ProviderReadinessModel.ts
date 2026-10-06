// ─────────────────────────────────────────────────────────────────────────────
// SPRINT (Phase 1) — Bridge REAL runtime evidence → readiness evidence
//
// `ExecutionHealthService` already records every real execution outcome
// (success / classified failure) reported by the AI runtime's health-feedback
// port. This module maps that EXISTING evidence onto the Control Center's
// readiness inputs. It adds no new store, no new health system and no live
// provider probe — it only READS what the runtime already measured.
//
// HONESTY RULES
//   • Only a failure that is NEWER than the last success can block readiness.
//     A later successful execution therefore restores READY (supersession).
//   • Evidence older than the freshness window is treated as ABSENT, so an old
//     failure can never permanently poison a provider.
//   • The classification mirrors the runtime's existing failure vocabulary
//     (`classifyFailure`): authentication_error, rate_limited,
//     provider_unavailable, timeout, unsupported_model, internal_error.
//     Nothing is reinterpreted: a 429 becomes RATE_LIMITED (not a fabricated
//     "quota exhausted"); real quota exhaustion still comes from the provider's
//     reported quota percentage.
// ─────────────────────────────────────────────────────────────────────────────

import type { RuntimeExecutionHealth } from '@vedmoulya/services';

/** Evidence older than this is no longer trusted for readiness. Default 24h. */
export const DEFAULT_READINESS_EVIDENCE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ReadinessEvidenceOptions {
  now?: number;
  /** Override the freshness window (tests). */
  ttlMs?: number;
}

function ms(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Derive the "last real execution" signal for ONE provider, or `undefined`
 * when there is no trustworthy evidence (unknown ⇒ never blocks readiness).
 */
export function toReadinessEvidence(
  health: RuntimeExecutionHealth | undefined,
  options: ReadinessEvidenceOptions = {},
): { ok: boolean; failureKind?: string; at: number } | undefined {
  if (health === undefined) return undefined;
  const now = options.now ?? Date.now();
  const ttl = options.ttlMs ?? DEFAULT_READINESS_EVIDENCE_TTL_MS;

  const lastSuccess = ms(health.lastSuccessAt);
  const lastFailure = ms(health.lastFailureAt);

  // The most recent outcome wins: a success AFTER the last failure supersedes
  // the failure (this is what makes a recovered provider READY again).
  if (lastSuccess !== undefined && (lastFailure === undefined || lastSuccess >= lastFailure)) {
    if (now - lastSuccess > ttl) return undefined;
    return { ok: true, at: lastSuccess };
  }

  if (lastFailure !== undefined) {
    if (now - lastFailure > ttl) return undefined;
    return { ok: false, failureKind: classifyRuntimeHealth(health), at: lastFailure };
  }
  // No timestamps at all: fall back to the verdict so a provider that has only
  // ever failed is not reported as READY.
  if (health.verdict === 'UNAVAILABLE' || health.verdict === 'DEGRADED') {
    return { ok: false, failureKind: classifyRuntimeHealth(health), at: now };
  }
  return undefined;
}

/**
 * Map the health window's failure tallies onto the runtime's existing failure
 * vocabulary. Precedence mirrors `classifyFailure`: an authentication failure
 * invalidates the whole provider, so it outranks a transient network failure.
 */
export function classifyRuntimeHealth(health: RuntimeExecutionHealth): string {
  // The exact classified reason of the newest failure is authoritative when the
  // runtime recorded one (it distinguishes network vs internal failures that the
  // four tallies cannot).
  if (health.lastFailureReason !== undefined && health.lastFailureReason.length > 0) {
    return health.lastFailureReason;
  }
  if (health.authFailureCount > 0) return 'authentication_error';
  if (health.unsupportedCount > 0) return 'unsupported_model';
  if (health.rateLimitCount > 0) return 'rate_limited';
  if (health.timeoutCount > 0) return 'provider_unavailable';
  return 'internal_error';
}

/**
 * Build the per-provider `readinessOverrides` the Control Center consumes from
 * the runtime evidence store. Providers with no trustworthy evidence are simply
 * absent, so readiness falls back to credential + health + quota evidence only.
 */
export function buildReadinessOverrides(
  providerIds: readonly string[],
  read: (providerId: string) => RuntimeExecutionHealth | undefined,
  options: ReadinessEvidenceOptions = {},
): Record<string, { lastExecution: { ok: boolean; failureKind?: string; at: number } }> {
  const out = new Map<
    string,
    { lastExecution: { ok: boolean; failureKind?: string; at: number } }
  >();
  for (const id of providerIds) {
    const evidence = toReadinessEvidence(read(id), options);
    if (evidence !== undefined) out.set(id, { lastExecution: evidence });
  }
  return Object.fromEntries(out);
}

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider readiness model (never lies)

// CONFIGURED / CREDENTIAL / READY / EXECUTABLE / QUOTA are SEPARATE facts. A
// provider that is configured AND enabled but whose quota is exhausted is NOT
// executable and must never render as "Connected — Ready to use".
//
// Every transition is derived from REAL evidence (credential state, health,
// last runtime outcome, reported quota) — never from a live probe on page load,
// and never from the UI's own optimism.
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderRuntimeState =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED'
  | 'AUTH_REQUIRED'
  | 'READY'
  | 'EXECUTING'
  | 'DEGRADED'
  | 'QUOTA_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'FAILED'
  | 'DISABLED';

export interface ProviderReadinessView {
  providerId: string;
  /** A usable credential exists for this user or the platform. */
  configured: boolean;
  credentialPresent: boolean;
  /** Runtime can serve requests AND no blocking condition is known. */
  ready: boolean;
  /** True only when a generation would actually succeed right now. */
  executable: boolean;
  quotaAvailable: boolean | null;
  state: ProviderRuntimeState;
  /** Honest, human-readable reason — never contains secrets. */
  reason?: string;
}

/** Quota at/above this used-percent is treated as exhausted for execution. */
const QUOTA_EXHAUSTED_AT_PERCENT = 100;
/** At/above this used-percent the provider is degraded (warning, still usable). */
const QUOTA_DEGRADED_AT_PERCENT = 90;

export interface ReadinessInput {
  providerId: string;
  /** User enabled it in preferences. */
  enabled: boolean;
  /** Registry/runtime says a credential is configured for this user. */
  credentialSource: 'USER' | 'PLATFORM' | 'NONE';
  /** Provider-reported quota used-percent; 0/absent means "not reported". */
  quotaUsedPercent?: number;
  /** Last known runtime health status from the registry. */
  healthStatus?: string;
  /** Last REAL execution outcome recorded by the runtime. */
  lastExecution?: { ok: boolean; failureKind?: string; at: number };
  local?: boolean;
  mock?: boolean;
  /** When the last runtime evidence was observed (ms); stale evidence degrades. */
  now?: number;
  /** Evidence older than this is no longer trusted for readiness. */
  staleAfterMs?: number;
}

/**
 * Derive the honest readiness view from real runtime evidence.
 *
 * Ordering is deliberate and matches precedence in the state machine:
 *   DISABLED → NOT_CONFIGURED → FAILED/AUTH_REQUIRED → QUOTA_EXHAUSTED →
 *   RATE_LIMITED → UNAVAILABLE → DEGRADED → READY
 */
export function deriveProviderReadiness(input: ReadinessInput): ProviderReadinessView {
  const configured = input.credentialSource !== 'NONE';
  const credentialPresent = configured;
  const now = input.now ?? Date.now();
  const staleAfter = input.staleAfterMs ?? 24 * 60 * 60 * 1000;
  const base = { providerId: input.providerId, configured, credentialPresent };

  const build = (
    state: ProviderRuntimeState,
    ready: boolean,
    executable: boolean,
    quotaAvailable: boolean | null,
    reason: string,
  ): ProviderReadinessView => ({ ...base, state, ready, executable, quotaAvailable, reason });

  if (!input.enabled) {
    return build('DISABLED', false, false, null, 'Turned off — enable it to use.');
  }
  if (!configured) {
    return build('NOT_CONFIGURED', false, false, null, 'No credential configured.');
  }

  const last = input.lastExecution;
  if (last !== undefined) {
    if (now - last.at > staleAfter) {
      return build(
        'DEGRADED',
        false,
        false,
        null,
        'Last check is out of date — run a connection test to refresh.',
      );
    }
    if (!last.ok) {
      const kind = last.failureKind;
      if (kind === 'authentication_error' || kind === 'invalid_api_key') {
        return build(
          'AUTH_REQUIRED',
          false,
          false,
          null,
          'Credential rejected — reconnect this AI.',
        );
      }
      if (kind === 'rate_limited') {
        return build(
          'RATE_LIMITED',
          true,
          false,
          null,
          'Rate limited right now — try again shortly.',
        );
      }
      if (kind === 'provider_unavailable' || kind === 'timeout') {
        return build('UNAVAILABLE', false, false, null, 'Provider unreachable just now.');
      }
      return build('FAILED', false, false, null, 'The last execution failed.');
    }
  }

  // Provider-reported quota is authoritative ONLY when reported.
  const reported = input.quotaUsedPercent;
  const quotaReported = reported !== undefined && Number.isFinite(reported) && reported > 0;
  if (quotaReported && reported >= QUOTA_EXHAUSTED_AT_PERCENT) {
    return build(
      'QUOTA_EXHAUSTED',
      true,
      false,
      false,
      'Quota exhausted — connected, but not available for execution.',
    );
  }
  if (quotaReported && reported >= QUOTA_DEGRADED_AT_PERCENT) {
    return build(
      'DEGRADED',
      true,
      true,
      true,
      'Quota nearly exhausted — usable, but close to the provider limit.',
    );
  }

  if (input.healthStatus === 'down' || input.healthStatus === 'unstable') {
    return build('UNAVAILABLE', false, false, quotaReported ? true : null, 'Reported unhealthy.');
  }
  if (input.healthStatus === 'degraded') {
    return build(
      'DEGRADED',
      true,
      true,
      quotaReported ? true : null,
      'Running in a degraded state.',
    );
  }
  if (input.mock === true) {
    return build('READY', true, true, true, 'Development mock runtime — deterministic and free.');
  }
  return build(
    'READY',
    true,
    true,
    quotaReported ? true : null,
    input.local === true ? 'Local runtime ready.' : 'Ready.',
  );
}
