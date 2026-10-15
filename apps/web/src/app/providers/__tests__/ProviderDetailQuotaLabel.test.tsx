// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — provider detail: quota provenance
//
// The detail view read `provider.health.quotaUsedPercent` straight out of the
// registry and labelled it "Quota used". That figure is a CATALOG SEED constant
// (45 / 38 / 30 / 55 / 40) which nothing at runtime refreshes, so the screen was
// presenting a catalog estimate as the provider's account usage. It must read
// "Unavailable from provider" and label the estimate for what it is.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { providerQuotaDisplay } from '../ProviderDetailView.js';

describe('providerQuotaDisplay — never presents a seed quota as account usage', () => {
  it('refuses a SEED percentage and labels it as an estimate', () => {
    const display = providerQuotaDisplay({ quotaUsedPercent: 45, quotaSource: 'SEED' });
    expect(display.reported).toBe(false);
    expect(display.value).toBe('Unavailable from provider');
    expect(display.value).not.toContain('%');
    expect(display.estimateLabel).toBe('Registry estimate 45%');
  });

  it('treats an ABSENT provenance as a seed too (legacy/persisted records)', () => {
    const display = providerQuotaDisplay({ quotaUsedPercent: 30 });
    expect(display.reported).toBe(false);
    expect(display.value).toBe('Unavailable from provider');
    expect(display.estimateLabel).toBe('Registry estimate 30%');
  });

  it('shows the percentage only for a PROVIDER_REPORTED quota, with no estimate line', () => {
    const display = providerQuotaDisplay({
      quotaUsedPercent: 42,
      quotaSource: 'PROVIDER_REPORTED',
    });
    expect(display.reported).toBe(true);
    expect(display.value).toBe('42%');
    expect(display.estimateLabel).toBeNull();
  });
});
