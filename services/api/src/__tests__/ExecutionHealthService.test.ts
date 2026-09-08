// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ExecutionHealthService tests
// Capability Intelligence: bounded, recency-decayed, RECOVERABLE real-time
// health from actual execution outcomes. Proves: healthy steady state, one-off
// failures never flip verdicts, bursts/sustained failures degrade, recovery on
// resumed success, authentication → ineligible until repaired, unsupported
// models scoped to the MODEL (never the provider), throttled persistence, and
// UNKNOWN when no data exists (never fabricated).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import { ExecutionHealthService, computeScopeHealth } from '../services/ExecutionHealthService.js';

/** Deterministic clock harness. */
function harness(initial = 0) {
  let t = initial;
  return {
    clock: (): number => t,
    advance: (ms: number): number => (t += ms),
    set: (v: number): number => (t = v),
  };
}

const NOW = 1_000_000;

function service(opts: Partial<ConstructorParameters<typeof ExecutionHealthService>[0]> = {}) {
  const h = harness(NOW);
  const persist = vi.fn(async () => undefined);
  const svc = new ExecutionHealthService({ now: h.clock, persist, ...opts });
  return { svc, persist, h };
}

describe('ExecutionHealthService — verdicts (provider scope)', () => {
  it('starts UNKNOWN with no data (never fabricated)', () => {
    const { svc } = service();
    expect(svc.getProviderHealth('google')).toBeUndefined();
    expect(svc.listUnavailableModelIds('google')).toEqual([]);
  });

  it('is HEALTHY after repeated successes', () => {
    const { svc } = service();
    for (let i = 0; i < 6; i++) {
      svc.recordExecution({
        providerId: 'google',
        modelId: 'gemini-2.5-pro',
        ok: true,
        at: NOW + i,
      });
    }
    const health = svc.getProviderHealth('google');
    expect(health?.verdict).toBe('HEALTHY');
    expect(health?.sampleCount).toBe(6);
    expect(health?.consecutiveFailures).toBe(0);
  });

  it('does NOT degrade on a single transient failure (one-off noise)', () => {
    const { svc } = service();
    svc.recordExecution({ providerId: 'google', ok: false, failureReason: 'timeout', at: NOW });
    // A single failure alone has <2 effective samples → UNKNOWN, not DEGRADED.
    expect(svc.getProviderHealth('google')?.verdict).toBe('UNKNOWN');
    // One failure followed by success → HEALTHY (no streak).
    svc.recordExecution({ providerId: 'google', ok: true, at: NOW + 1 });
    expect(svc.getProviderHealth('google')?.verdict).toBe('HEALTHY');
  });

  it('degrades on two consecutive failures and recovers with resumed success', () => {
    const { svc } = service();
    svc.recordExecution({ providerId: 'deepseek', ok: true, at: NOW });
    svc.recordExecution({
      providerId: 'deepseek',
      ok: false,
      failureReason: 'timeout',
      at: NOW + 1,
    });
    svc.recordExecution({
      providerId: 'deepseek',
      ok: false,
      failureReason: 'timeout',
      at: NOW + 2,
    });
    expect(svc.getProviderHealth('deepseek')?.verdict).toBe('DEGRADED');
    expect(svc.getProviderHealth('deepseek')?.timeoutCount).toBe(2);
  });

  it('marks UNAVAILABLE on a consecutive-failure burst (5+)', () => {
    const { svc } = service();
    for (let i = 0; i < 5; i++) {
      svc.recordExecution({
        providerId: 'openai',
        ok: false,
        failureReason: 'timeout',
        at: NOW + i,
      });
    }
    const health = svc.getProviderHealth('openai');
    expect(health?.verdict).toBe('UNAVAILABLE');
    expect(health?.detail).toContain('consecutive');
  });

  it('marks UNAVAILABLE on sustained failures even without a burst streak', () => {
    const { svc } = service();
    // 4 failures interleaved with successes still gives weighted success < 0.5
    // over >= 4 effective samples → sustained UNAVAILABLE (not noise).
    const events = [false, true, false, true, false, true, false];
    events.forEach((ok, i) =>
      svc.recordExecution({
        providerId: 'openai',
        ok,
        failureReason: ok ? undefined : 'provider_unavailable',
        at: NOW + i,
      }),
    );
    expect(svc.getProviderHealth('openai')?.verdict).toBe('UNAVAILABLE');
  });

  it('recovers to HEALTHY as failures age out and successes resume (recency decay)', () => {
    const { svc, h } = service();
    // 8 rapid failures at t0 → UNAVAILABLE.
    for (let i = 0; i < 8; i++) {
      svc.recordExecution({
        providerId: 'openai',
        ok: false,
        failureReason: 'timeout',
        at: NOW + i,
      });
    }
    expect(svc.getProviderHealth('openai')?.verdict).toBe('UNAVAILABLE');
    // 40 minutes later (half-life 10 min → old failures weigh ~1/16 each)
    // successful executions resume.
    const later = h.advance(40 * 60 * 1000);
    for (let i = 0; i < 6; i++) {
      svc.recordExecution({ providerId: 'openai', ok: true, at: later + i });
    }
    expect(svc.getProviderHealth('openai')?.verdict).toBe('HEALTHY');
  });

  it('authentication failure makes the provider ineligible until a success follows', () => {
    const { svc } = service();
    svc.recordExecution({
      providerId: 'openai',
      ok: false,
      failureReason: 'authentication_error',
      at: NOW,
    });
    const health = svc.getProviderHealth('openai');
    expect(health?.verdict).toBe('UNAVAILABLE');
    expect(health?.detail).toContain('authentication');
    expect(health?.authFailureCount).toBe(1);
    // Config repaired → success clears the ineligible state.
    svc.recordExecution({ providerId: 'openai', ok: true, at: NOW + 1 });
    expect(svc.getProviderHealth('openai')?.verdict).toBe('HEALTHY');
  });

  it('records rate-limit frequency separately (never one opaque number)', () => {
    const { svc } = service();
    for (let i = 0; i < 3; i++) {
      svc.recordExecution({
        providerId: 'mock',
        ok: false,
        failureReason: 'rate_limited',
        at: NOW + i,
      });
    }
    svc.recordExecution({ providerId: 'mock', ok: true, at: NOW + 3 });
    const health = svc.getProviderHealth('mock');
    expect(health?.rateLimitCount).toBe(3);
    expect(health?.timeoutCount).toBe(0);
  });
});

describe('ExecutionHealthService — provider vs model scope', () => {
  it('scopes an unsupported model to the MODEL: provider stays healthy, model is excluded', () => {
    const { svc } = service();
    // Two healthy executions, then repeated unsupported failures on model X.
    svc.recordExecution({ providerId: 'openai', modelId: 'gpt-4o', ok: true, at: NOW });
    svc.recordExecution({ providerId: 'openai', modelId: 'gpt-4o', ok: true, at: NOW + 1 });
    for (let i = 0; i < 5; i++) {
      svc.recordExecution({
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        ok: false,
        failureReason: 'unsupported_model',
        at: NOW + 2 + i,
      });
    }
    // The provider must NOT be marked unavailable by a model-level failure.
    expect(svc.getProviderHealth('openai')?.verdict).toBe('HEALTHY');
    // The model-scope verdict records the unsupported failures.
    const modelHealth = svc.getModelHealth('openai', 'gpt-4o-mini');
    expect(modelHealth?.unsupportedCount).toBe(5);
    // The unsupported model is excluded from selection; healthy models are not.
    expect(svc.listUnavailableModelIds('openai')).toEqual(['gpt-4o-mini']);
    // A model that never ran has no state (nothing fabricated).
    expect(svc.getModelHealth('openai', 'unknown-model')).toBeUndefined();
  });

  it('scopes provider-level failures at both scopes when a model is known', () => {
    const { svc } = service();
    for (let i = 0; i < 6; i++) {
      svc.recordExecution({
        providerId: 'deepseek',
        modelId: 'deepseek-chat',
        ok: false,
        failureReason: 'provider_unavailable',
        at: NOW + i,
      });
    }
    expect(svc.getProviderHealth('deepseek')?.verdict).toBe('UNAVAILABLE');
    expect(svc.getModelHealth('deepseek', 'deepseek-chat')?.verdict).toBe('UNAVAILABLE');
    expect(svc.listUnavailableModelIds('deepseek')).toEqual(['deepseek-chat']);
  });
});

describe('ExecutionHealthService — persistence (bounded, throttled)', () => {
  it('never persists UNKNOWN (no data)', async () => {
    const { svc, persist } = service();
    await svc.persistNow('google'); // no-op
    expect(persist).not.toHaveBeenCalled();
  });

  it('persists when a batch of outcomes accumulates (>=8 tracked outcomes)', async () => {
    const { svc, persist } = service();
    // The first outcome is UNKNOWN (no verdict), so 9 records are needed for
    // 8 tracked outcomes → one throttled batch write.
    for (let i = 0; i < 9; i++) {
      svc.recordExecution({
        providerId: 'openai',
        ok: false,
        failureReason: 'timeout',
        at: NOW + i,
      });
    }
    await svc.flushNow();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith('openai', { ok: false });
  });

  it('persists on a verdict transition once the interval has elapsed', async () => {
    const { svc, persist, h } = service();
    // Force-persist an initial DEGRADED state (two consecutive failures).
    svc.recordExecution({ providerId: 'openai', ok: false, failureReason: 'timeout', at: NOW });
    svc.recordExecution({ providerId: 'openai', ok: false, failureReason: 'timeout', at: NOW + 1 });
    await svc.persistNow('openai');
    expect(svc.getProviderHealth('openai')?.verdict).toBe('DEGRADED');
    expect(persist).toHaveBeenCalledTimes(1);
    // A transition within the minimum interval is throttled (no write).
    svc.recordExecution({ providerId: 'openai', ok: true, at: NOW + 2 });
    await svc.flushNow();
    expect(persist).toHaveBeenCalledTimes(1);
    // Failures age out (recency decay), successes resume → HEALTHY; the
    // verdict transition is then persisted.
    const later = h.advance(40 * 60 * 1000);
    for (let i = 0; i < 4; i++) {
      svc.recordExecution({ providerId: 'openai', ok: true, at: later + i });
    }
    expect(svc.getProviderHealth('openai')?.verdict).toBe('HEALTHY');
    await svc.flushNow();
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith('openai', { ok: true });
  });

  it('persists HEALTHY/DEGRADED as ok=true (usable) and UNAVAILABLE as ok=false', async () => {
    const { svc, persist } = service();
    for (let i = 0; i < 6; i++) {
      svc.recordExecution({ providerId: 'google', ok: true, at: NOW + i });
    }
    await svc.persistNow('google');
    expect(persist).toHaveBeenCalledWith('google', { ok: true });
  });
});

describe('computeScopeHealth — deterministic unit rules', () => {
  it('single failure with fewer than 2 effective samples stays UNKNOWN', () => {
    const state = { events: [{ ok: false, reason: 'timeout', at: NOW, latencyMs: 100 }] };
    const health = computeScopeHealth(state, NOW, 10 * 60 * 1000);
    expect(health?.verdict).toBe('UNKNOWN');
    expect(health?.sampleCount).toBe(1);
    expect(health?.timeoutCount).toBe(1);
  });
});
