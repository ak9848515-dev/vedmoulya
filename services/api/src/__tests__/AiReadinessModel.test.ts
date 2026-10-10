// ─────────────────────────────────────────────────────────────────────────────
// SPRINT — Provider readiness model tests (§15/§16)
// The pure state machine over explicit evidence. Proves readiness never lies:
//   configured ≠ ready ≠ executable
//   • a quota-exhausted provider is connected but NOT executable
//   • an invalid credential ⇒ AUTH_REQUIRED (not "ready to use")
//   • stale evidence degrades instead of claiming ready
//   • unknown quota does NOT block execution and is reported as unknown
//
// Integration of the SAME model with real runtime evidence lives in
// `AiReadinessEvidence.test.ts`.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { deriveProviderReadiness } from '../observability/ProviderReadinessModel.js';

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);

function base(overrides = {}) {
  return {
    providerId: 'openai',
    enabled: true,
    credentialSource: 'USER' as const,
    now: NOW,
    ...overrides,
  };
}

describe('deriveProviderReadiness', () => {
  it('reports READY for a configured, enabled, healthy provider', () => {
    const view = deriveProviderReadiness(base());
    expect(view.state).toBe('READY');
    expect(view.configured).toBe(true);
    expect(view.executable).toBe(true);
  });

  it('never reports READY when no credential exists', () => {
    const view = deriveProviderReadiness(base({ credentialSource: 'NONE' as const }));
    expect(view.state).toBe('NOT_CONFIGURED');
    expect(view.configured).toBe(false);
    expect(view.executable).toBe(false);
  });

  it('reports DISABLED when the user turned it off', () => {
    const view = deriveProviderReadiness(base({ enabled: false }));
    expect(view.state).toBe('DISABLED');
    expect(view.executable).toBe(false);
  });

  it('QUOTA_EXHAUSTED: connected but NOT executable (the "Connected — Ready" fix)', () => {
    const view = deriveProviderReadiness(base({ quotaUsedPercent: 100 }));
    expect(view.state).toBe('QUOTA_EXHAUSTED');
    expect(view.configured).toBe(true);
    expect(view.quotaAvailable).toBe(false);
    expect(view.executable).toBe(false);
    expect(view.reason).toMatch(/not available for execution/i);
  });

  it('DEGRADED when quota is nearly exhausted but still usable', () => {
    const view = deriveProviderReadiness(base({ quotaUsedPercent: 95 }));
    expect(view.state).toBe('DEGRADED');
    expect(view.executable).toBe(true);
  });

  it('AUTH_REQUIRED when the last real execution rejected the credential', () => {
    const view = deriveProviderReadiness(
      base({ lastExecution: { ok: false, failureKind: 'authentication_error', at: NOW } }),
    );
    expect(view.state).toBe('AUTH_REQUIRED');
    expect(view.executable).toBe(false);
  });

  it('RATE_LIMITED reflects a real recent rate-limit outcome', () => {
    const view = deriveProviderReadiness(
      base({ lastExecution: { ok: false, failureKind: 'rate_limited', at: NOW } }),
    );
    expect(view.state).toBe('RATE_LIMITED');
    expect(view.executable).toBe(false);
  });

  it('UNAVAILABLE when the provider is unreachable right now', () => {
    const view = deriveProviderReadiness(
      base({ lastExecution: { ok: false, failureKind: 'provider_unavailable', at: NOW } }),
    );
    expect(view.state).toBe('UNAVAILABLE');
    expect(view.executable).toBe(false);
  });

  it('degrades rather than claiming ready when evidence is stale', () => {
    const view = deriveProviderReadiness(
      base({
        lastExecution: { ok: false, failureKind: 'timeout', at: NOW - 3 * 24 * 3_600_000 },
        staleAfterMs: 24 * 3_600_000,
      }),
    );
    expect(view.state).toBe('DEGRADED');
    expect(view.executable).toBe(false);
    expect(view.reason).toMatch(/out of date/i);
  });

  it('reports UNKNOWN quota as unknown, never as "no quota left"', () => {
    const view = deriveProviderReadiness(base({ quotaUsedPercent: 0 }));
    expect(view.state).toBe('READY');
    expect(view.quotaAvailable).toBeNull();
    expect(view.executable).toBe(true);
  });

  it('treats the deterministic mock runtime honestly', () => {
    const view = deriveProviderReadiness(base({ mock: true }));
    expect(view.state).toBe('READY');
    expect(view.reason).toMatch(/mock/i);
  });

  // ── F-U1 regression: the health seam must be fail-closed ─────────────────
  // `healthStatus` is a plain string seam. Before the fix, any value other than
  // 'down'/'unstable'/'degraded' — including a cross-vocabulary literal like
  // 'unhealthy' or a future value like 'unknown' — fell through to READY.

  it('does NOT report READY for a cross-vocabulary health value (F-U1)', () => {
    const view = deriveProviderReadiness(base({ healthStatus: 'unhealthy' }));
    expect(view.state).not.toBe('READY');
    expect(view.ready).toBe(false);
    expect(view.executable).toBe(false);
  });

  it('does NOT report READY for an unknown/future health value (F-U1)', () => {
    const view = deriveProviderReadiness(base({ healthStatus: 'unknown' }));
    expect(view.state).not.toBe('READY');
    expect(view.ready).toBe(false);
    expect(view.executable).toBe(false);
  });

  it('does NOT report READY for an invalid empty health value (F-U1)', () => {
    const view = deriveProviderReadiness(base({ healthStatus: '' }));
    expect(view.state).not.toBe('READY');
    expect(view.ready).toBe(false);
  });

  it('recognizes every canonical health value explicitly', () => {
    expect(deriveProviderReadiness(base({ healthStatus: 'healthy' })).state).toBe('READY');
    expect(deriveProviderReadiness(base({ healthStatus: 'degraded' })).state).toBe('DEGRADED');
    expect(deriveProviderReadiness(base({ healthStatus: 'unstable' })).state).toBe('UNAVAILABLE');
    expect(deriveProviderReadiness(base({ healthStatus: 'down' })).state).toBe('UNAVAILABLE');
  });

  it('keeps READY when health is simply not reported (absence of evidence)', () => {
    const view = deriveProviderReadiness(base());
    expect(view.state).toBe('READY');
    expect(view.ready).toBe(true);
    expect(view.executable).toBe(true);
  });

  it('never lets an unrecognized health value reach READY via the quota path (F-U1)', () => {
    // Quota evidence is evaluated before health (existing precedence). An
    // unrecognized health value must still not upgrade the view to READY.
    const view = deriveProviderReadiness(base({ quotaUsedPercent: 95, healthStatus: 'unhealthy' }));
    expect(view.state).not.toBe('READY');
    expect(view.state).toBe('DEGRADED');
    expect(view.reason).toMatch(/quota/i);
  });
});
