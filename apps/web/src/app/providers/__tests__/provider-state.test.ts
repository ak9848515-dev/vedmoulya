// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Connection Lifecycle tests (PROVIDER-01 Phase 5/8)
//
// Proves the single authoritative state machine and, above all, the
// NO-FAKE-READY invariant:
//   • READY is the only state that means "usable now",
//   • READY requires runtimeConfigured AND enabled AND no failed verification,
//   • configured ≠ enabled ≠ ready (each is its own field),
//   • a runtime that cannot execute is NEVER presented as ready,
//   • the readiness indicator and the connection display are PROJECTIONS of
//     this one model (they cannot contradict it).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  deriveProviderState,
  isCredentialFailureKind,
  isProviderReady,
  NEXT_ACTION_LABELS,
  type ProviderLifecycle,
} from '../provider-state.js';
import { providerReadiness } from '../provider-readiness.js';
import { providerStatusDisplay } from '../provider-ux.js';

const ALL_RUNTIME_STATUSES = [
  'CONFIGURED',
  'NOT_CONFIGURED',
  'UNSUPPORTED_RUNTIME',
  'MOCK',
  'DISABLED',
  'ERROR',
  undefined,
  'SOMETHING_UNKNOWN',
] as const;

describe('deriveProviderState — the one lifecycle', () => {
  it('maps runtime truth + enable preference onto the canonical states', () => {
    expect(deriveProviderState({ runtimeStatus: 'CONFIGURED', enabled: true }).lifecycle).toBe(
      'READY',
    );
    expect(deriveProviderState({ runtimeStatus: 'MOCK', enabled: true }).lifecycle).toBe('READY');
    expect(deriveProviderState({ runtimeStatus: 'CONFIGURED', enabled: false }).lifecycle).toBe(
      'DISABLED',
    );
    expect(deriveProviderState({ runtimeStatus: 'NOT_CONFIGURED', enabled: true }).lifecycle).toBe(
      'NOT_CONFIGURED',
    );
    expect(
      deriveProviderState({ runtimeStatus: 'UNSUPPORTED_RUNTIME', enabled: true }).lifecycle,
    ).toBe('NOT_CONFIGURED');
    expect(deriveProviderState({ runtimeStatus: 'ERROR', enabled: true }).lifecycle).toBe('FAILED');
  });

  it('exposes the in-flight stages the onboarding flow needs', () => {
    expect(
      deriveProviderState({
        runtimeStatus: 'NOT_CONFIGURED',
        enabled: false,
        activity: 'configuring',
      }).lifecycle,
    ).toBe('CONFIGURING');
    expect(
      deriveProviderState({
        runtimeStatus: 'NOT_CONFIGURED',
        enabled: false,
        activity: 'verifying',
      }).lifecycle,
    ).toBe('VERIFYING');
  });

  it('distinguishes reachability from a rejected credential', () => {
    const transient = deriveProviderState({
      runtimeStatus: 'CONFIGURED',
      enabled: true,
      lastVerification: { ok: false, failureKind: 'unreachable' },
    });
    expect(transient.lifecycle).toBe('DEGRADED');
    expect(transient.nextAction).toBe('retry');

    const rejected = deriveProviderState({
      runtimeStatus: 'CONFIGURED',
      enabled: true,
      lastVerification: { ok: false, failureKind: 'invalid_api_key' },
    });
    expect(rejected.lifecycle).toBe('FAILED');
    expect(rejected.nextAction).toBe('reconnect');
  });

  it('a last verification that SUCCEEDED does not block READY', () => {
    const state = deriveProviderState({
      runtimeStatus: 'CONFIGURED',
      enabled: true,
      lastVerification: { ok: true },
    });
    expect(state.lifecycle).toBe('READY');
    expect(state.nextAction).toBe('none');
  });

  it('NO FAKE READY — no input can produce READY without a configured runtime', () => {
    const activities = [undefined, 'idle', 'configuring', 'verifying'] as const;
    const verifications = [
      undefined,
      { ok: true },
      { ok: false },
      { ok: false, failureKind: 'unreachable' },
      { ok: false, failureKind: 'invalid_api_key' },
    ];
    const seen = new Set<ProviderLifecycle>();
    for (const runtimeStatus of ALL_RUNTIME_STATUSES) {
      for (const enabled of [true, false]) {
        for (const activity of activities) {
          for (const lastVerification of verifications) {
            const state = deriveProviderState({
              runtimeStatus,
              enabled,
              activity,
              lastVerification,
            });
            seen.add(state.lifecycle);
            if (state.ready) {
              // The invariant: READY implies a real, enabled, unfailed runtime.
              expect(state.runtimeConfigured).toBe(true);
              expect(state.enabled).toBe(true);
              expect(runtimeStatus === 'CONFIGURED' || runtimeStatus === 'MOCK').toBe(true);
              expect(activity === undefined || activity === 'idle').toBe(true);
              expect(lastVerification?.ok).not.toBe(false);
              expect(state.lifecycle).toBe('READY');
            }
            if (state.lifecycle !== 'READY') expect(state.ready).toBe(false);
          }
        }
      }
    }
    // The table really exercised every state (no silently unreachable state).
    for (const lifecycle of [
      'NOT_CONFIGURED',
      'CONFIGURING',
      'VERIFYING',
      'READY',
      'DEGRADED',
      'FAILED',
      'DISABLED',
    ] as ProviderLifecycle[]) {
      expect([...seen], `state ${lifecycle} was never produced`).toContain(lifecycle);
    }
  });

  it('never fabricates readiness from a missing/unknown runtime report', () => {
    for (const runtimeStatus of [undefined, 'SOMETHING_UNKNOWN', 'DISABLED', 'NOT_CONFIGURED']) {
      const state = deriveProviderState({ runtimeStatus, enabled: true });
      expect(state.ready).toBe(false);
      expect(state.runtimeConfigured).toBe(false);
      expect(state.lifecycle).toBe('NOT_CONFIGURED');
    }
  });

  it('keeps configured / enabled / ready as three separate facts', () => {
    const configuredDisabled = deriveProviderState({
      runtimeStatus: 'CONFIGURED',
      enabled: false,
    });
    // Configured is true, enabled is false, ready is false — never conflated.
    expect(configuredDisabled.runtimeConfigured).toBe(true);
    expect(configuredDisabled.enabled).toBe(false);
    expect(configuredDisabled.ready).toBe(false);
    expect(configuredDisabled.nextAction).toBe('enable');
  });

  it('isProviderReady is exactly the lifecycle READY predicate', () => {
    expect(isProviderReady({ runtimeStatus: 'CONFIGURED', enabled: true })).toBe(true);
    expect(isProviderReady({ runtimeStatus: 'CONFIGURED', enabled: false })).toBe(false);
    expect(isProviderReady({ runtimeStatus: 'ERROR', enabled: true })).toBe(false);
  });

  it('keeps the failure-kind vocabulary closed and explicit', () => {
    expect(isCredentialFailureKind('invalid_api_key')).toBe(true);
    expect(isCredentialFailureKind('unauthorized')).toBe(true);
    expect(isCredentialFailureKind('unreachable')).toBe(false);
    expect(isCredentialFailureKind(undefined)).toBe(false);
  });

  it('every lifecycle state carries an axe-free, colour-independent label', () => {
    for (const runtimeStatus of ALL_RUNTIME_STATUSES) {
      for (const enabled of [true, false]) {
        const state = deriveProviderState({ runtimeStatus, enabled });
        expect(state.label.trim().length, String(runtimeStatus)).toBeGreaterThan(0);
        expect(state.symbol.trim().length).toBeGreaterThan(0);
        expect(state.hint.trim().length).toBeGreaterThan(0);
        // End-user copy never leaks runtime internals (env vars / adapters).
        expect(state.hint).not.toMatch(/AI_[A-Z_]*API_KEY|adapter|runtime key/i);
      }
    }
  });

  it('publishes a plain-language label for every next action', () => {
    expect(NEXT_ACTION_LABELS.connect).toBe('Connect');
    expect(NEXT_ACTION_LABELS.reconnect).toBe('Reconnect');
    expect(NEXT_ACTION_LABELS.retry).toBe('Retry');
    expect(NEXT_ACTION_LABELS.enable).toBe('Enable');
    expect(NEXT_ACTION_LABELS.none).toBe('');
  });
});

describe('readiness indicator — a projection of the one lifecycle', () => {
  it('is GREEN only when the canonical state is READY', () => {
    for (const runtimeStatus of ALL_RUNTIME_STATUSES) {
      for (const enabled of [true, false]) {
        const state = deriveProviderState({ runtimeStatus, enabled });
        const readiness = providerReadiness(runtimeStatus, enabled);
        expect(readiness.key === 'green', String(runtimeStatus) + ':' + String(enabled)).toBe(
          state.ready,
        );
      }
    }
  });

  it('can surface a real failed verification as red (never green)', () => {
    const red = providerReadiness('CONFIGURED', true, {
      ok: false,
      failureKind: 'invalid_api_key',
    });
    expect(red.key).toBe('red');
    expect(red.label).toBe('Connection problem');
    const degraded = providerReadiness('CONFIGURED', true, {
      ok: false,
      failureKind: 'unreachable',
    });
    expect(degraded.key).toBe('red');
    expect(degraded.label).toBe('Needs attention');
  });

  it('keeps a configured-but-disabled provider ORANGE (not ready)', () => {
    expect(providerReadiness('CONFIGURED', false).key).toBe('orange');
  });
});

describe('connection display — a projection of the one lifecycle', () => {
  it('a configured-but-DISABLED provider never reads as connected', () => {
    const enabled = providerStatusDisplay('CONFIGURED', 'Gemini', true);
    expect(enabled.connection.key).toBe('connected');

    const disabled = providerStatusDisplay('CONFIGURED', 'Gemini', false);
    expect(disabled.connection.key).toBe('not_connected');
    expect(disabled.connection.label).toBe('Not connected');
    // The surrounding surfaces still know the runtime IS configured.
    expect(disabled.configured).toBe(true);
  });

  it('never claims a connection for an unconfigured or errored runtime', () => {
    for (const runtimeStatus of [undefined, 'NOT_CONFIGURED', 'UNSUPPORTED_RUNTIME', 'DISABLED']) {
      const display = providerStatusDisplay(runtimeStatus, 'Gemini', true);
      expect(display.connection.key).toBe('not_connected');
      expect(display.configured).toBe(false);
    }
    const errored = providerStatusDisplay('ERROR', 'Gemini', true);
    expect(errored.connection.key).toBe('issue');
    expect(errored.configured).toBe(false);
  });

  it('surfaces a failed verification instead of a green connection', () => {
    const failed = providerStatusDisplay('CONFIGURED', 'Gemini', true, {
      ok: false,
      failureKind: 'invalid_api_key',
    });
    expect(failed.connection.key).toBe('issue');
    expect(failed.connection.hint).not.toMatch(/AI_[A-Z_]*API_KEY/);
  });
});
