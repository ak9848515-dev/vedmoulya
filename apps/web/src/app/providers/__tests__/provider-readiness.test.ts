// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — provider-readiness derivation tests
//
// Proves the AI Providers overview state logic:
//   - ONE readiness indicator per provider (red/orange/green) derived from
//     REAL runtime state + user enable preference — never fabricated,
//   - usage states are independent of readiness,
//   - NO fabricated usage numbers: missing quota always becomes
//     "Usage unavailable" / "Not configured" — never an invented percent.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  providerReadiness,
  deriveProviderUsage,
  READINESS_LEGEND,
  PROVIDER_QUOTA_DISCLAIMER,
  USAGE_WARNING_BELOW_PCT,
  USAGE_LIMITED_BELOW_PCT,
} from '../provider-readiness.js';

// ── Readiness: runtime status × user enable ────────────────────────────────

describe('providerReadiness', () => {
  it('maps a configured + enabled provider to GREEN', () => {
    const r = providerReadiness('CONFIGURED', true);
    expect(r.key).toBe('green');
    expect(r.label).toBe('Configured and enabled');
  });

  it('maps a configured but disabled provider to ORANGE', () => {
    const r = providerReadiness('CONFIGURED', false);
    expect(r.key).toBe('orange');
    expect(r.label).toBe('Configured, not enabled');
  });

  it('maps NOT_CONFIGURED to RED regardless of the preference flag', () => {
    expect(providerReadiness('NOT_CONFIGURED', true).key).toBe('red');
    expect(providerReadiness('NOT_CONFIGURED', false).key).toBe('red');
    expect(providerReadiness('NOT_CONFIGURED', true).label).toBe('Not configured');
  });

  it('maps catalog-only families (UNSUPPORTED_RUNTIME) to RED with a readable reason', () => {
    const r = providerReadiness('UNSUPPORTED_RUNTIME', true);
    expect(r.key).toBe('red');
    expect(r.label).toBe('Not available');
    expect(r.hint).toContain('Catalog only');
  });

  it('never claims an ERROR or DISABLED runtime is ready', () => {
    expect(providerReadiness('ERROR', true).key).toBe('red');
    expect(providerReadiness('DISABLED', true).key).toBe('red');
  });

  it('treats the active mock as usable (dev/test runtime), but never brands it configured', () => {
    const on = providerReadiness('MOCK', true);
    expect(on.key).toBe('green');
    expect(on.label).not.toBe('Configured and enabled');
    const off = providerReadiness('MOCK', false);
    expect(off.key).toBe('orange');
  });

  it('falls back to RED for unknown/missing runtime state', () => {
    const r = providerReadiness(undefined, true);
    expect(r.key).toBe('red');
    expect(r.label).toBe('Not configured');
  });

  it('exposes exactly the three legend colours', () => {
    expect(READINESS_LEGEND.map((l) => l.key)).toEqual(['red', 'orange', 'green']);
  });
});

// ── Usage states: independent of readiness, never fabricated ───────────────

describe('deriveProviderUsage', () => {
  const green = providerReadiness('CONFIGURED', true);

  it('shows "Not configured" first when the provider cannot operate', () => {
    const red = providerReadiness('NOT_CONFIGURED', true);
    const usage = deriveProviderUsage({ readiness: red, quotaUsedPercent: 45 });
    expect(usage.state).toBe('NOT_CONFIGURED');
    expect(usage.label).toBe('Not configured');
  });

  it('derives AVAILABLE from a real reported quota with plenty remaining', () => {
    const usage = deriveProviderUsage({ readiness: green, quotaUsedPercent: 28 });
    expect(usage.state).toBe('AVAILABLE');
    expect(usage.label).toBe('Provider usage · 72% remaining');
  });

  it('derives WARNING when remaining drops below the warning threshold', () => {
    const usage = deriveProviderUsage({
      readiness: green,
      quotaUsedPercent: 100 - (USAGE_WARNING_BELOW_PCT - 1),
    });
    expect(usage.state).toBe('WARNING');
  });

  it('derives LIMITED when remaining drops below the limited threshold', () => {
    const usage = deriveProviderUsage({
      readiness: green,
      quotaUsedPercent: 100 - (USAGE_LIMITED_BELOW_PCT - 1),
    });
    expect(usage.state).toBe('LIMITED');
    expect(usage.label).toBe(`Provider usage · ${USAGE_LIMITED_BELOW_PCT - 1}% remaining`);
  });

  it('never fabricates a remaining percent when quota is not reported', () => {
    const usage = deriveProviderUsage({ readiness: green, quotaUsedPercent: 0 });
    expect(usage.state).toBe('UNAVAILABLE');
    expect(usage.label).toBe('Usage unavailable');
    expect(usage.label).not.toContain('%');
  });

  it('labels every reported-quota percentage as provider-level — never a free-tier balance', () => {
    for (const quota of [10, 28, 45, 65, 88]) {
      const usage = deriveProviderUsage({ readiness: green, quotaUsedPercent: quota });
      // A percentage is only ever shown when a real provider-level quota
      // signal exists, and the label then NAMES that source explicitly.
      if (usage.label.includes('%')) {
        expect(usage.label).toContain('Provider usage');
        expect(usage.label).not.toContain('Free');
        expect(usage.label).not.toContain('free');
        expect(usage.label).not.toContain('your account');
      }
    }
  });

  it('publishes a disclaimer that separates provider-health signals from account balances', () => {
    expect(PROVIDER_QUOTA_DISCLAIMER).toContain('provider-health quota signal');
    expect(PROVIDER_QUOTA_DISCLAIMER).toContain('not your account');
  });

  it('treats local providers as unmetered instead of inventing quota', () => {
    const usage = deriveProviderUsage({ readiness: green, quotaUsedPercent: 0, local: true });
    expect(usage.state).toBe('UNMETERED');
    expect(usage.label).toBe('Local');
  });

  it('treats the deterministic mock as unmetered', () => {
    const usage = deriveProviderUsage({
      readiness: providerReadiness('MOCK', true),
      quotaUsedPercent: 0,
      mock: true,
    });
    expect(usage.state).toBe('UNMETERED');
  });

  it('clamps out-of-range quota values', () => {
    expect(deriveProviderUsage({ readiness: green, quotaUsedPercent: 200 }).state).toBe('LIMITED');
    expect(deriveProviderUsage({ readiness: green, quotaUsedPercent: -5 }).state).toBe(
      'UNAVAILABLE',
    );
  });
});
