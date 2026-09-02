// ──────────────────────────────────────────────────────────────────
// VedMoulya — ProviderPreferencesService tests
// EPIC-012A — AI Provider Intelligence (Phases 5/13/14/26)
// Owner-scoped per-user AI provider preferences: defaults when never
// customized, patch validation, enable/disable switch, and the
// enabled-subset resolution used by routing.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ProviderPreferencesService } from '../application/ProviderPreferencesService.js';
import { InMemoryProviderPreferencesStore } from '../infrastructure/InMemoryProviderPreferencesStore.js';
import { defaultProviderPreferences } from '../types/preferences-types.js';

function svc(store = new InMemoryProviderPreferencesStore()): ProviderPreferencesService {
  return new ProviderPreferencesService(store);
}

describe('ProviderPreferencesService — defaults and reads', () => {
  it('returns defaults when the user never customized anything', async () => {
    const result = await svc().getPreferences('u1');
    expect(result.success).toBe(true);
    expect(result.data?.disabledProviderIds).toEqual([]);
    expect(result.data?.budgetPolicy).toBe('ask_before_paid');
  });

  it('rejects an empty userId', async () => {
    expect((await svc().getPreferences('')).success).toBe(false);
    expect((await svc().updatePreferences('', {})).success).toBe(false);
    expect((await svc().setProviderEnabled('', 'p', true)).success).toBe(false);
  });

  it('isProviderEnabled defaults to true', async () => {
    expect(await svc().isProviderEnabled('u1', 'openai')).toBe(true);
  });

  it('reports the disabled ids for the config view', async () => {
    expect(await svc().getDisabledProviderIds('u1')).toEqual([]);
  });
});

describe('ProviderPreferencesService — patches and validation', () => {
  it('applies an owner-scoped patch and persists', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const service = svc(store);
    const result = await service.updatePreferences('u1', {
      disabledProviderIds: ['openai', ' openai ', 'anthropic', ''],
      preferredProviderId: 'anthropic',
      preferredModelId: 'claude',
      budgetPolicy: 'allow_within_budget',
      budgets: { monthlyUsd: 10 },
    });
    expect(result.success).toBe(true);
    expect(result.data?.disabledProviderIds).toEqual(['openai', 'anthropic']);
    expect(result.data?.budgetPolicy).toBe('allow_within_budget');
    expect(result.data?.budgets.monthlyUsd).toBe(10);
    const read = await service.getPreferences('u1');
    expect(read.data?.preferredProviderId).toBe('anthropic');
  });

  it('rejects an unknown budget policy', async () => {
    const result = await svc().updatePreferences('u1', {
      budgetPolicy: 'never' as 'never_paid',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown budget policy/);
  });

  it('rejects negative or non-numeric budgets', async () => {
    const negative = await svc().updatePreferences('u1', { budgets: { monthlyUsd: -5 } });
    expect(negative.success).toBe(false);
    expect(negative.error).toMatch(/non-negative/);
    const nan = await svc().updatePreferences('u1', { budgets: { monthlyUsd: Number.NaN } });
    expect(nan.success).toBe(false);
  });

  it('rejects a preferred model without a preferred provider', async () => {
    const result = await svc().updatePreferences('u1', {
      preferredProviderId: null,
      preferredModelId: 'gpt-4o',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/requires a preferred provider/);
  });

  it('clears the preferred provider when patched to null', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const service = svc(store);
    await service.updatePreferences('u1', {
      preferredProviderId: 'openai',
      preferredModelId: 'gpt-4o',
    });
    const cleared = await service.updatePreferences('u1', {
      preferredProviderId: null,
      preferredModelId: null,
    });
    expect(cleared.data?.preferredProviderId).toBeUndefined();
  });
});

describe('ProviderPreferencesService — enable/disable switch', () => {
  it('disables and re-enables a provider for the user', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const service = svc(store);
    const disabled = await service.setProviderEnabled('u1', 'openai', false);
    expect(disabled.data?.disabledProviderIds).toContain('openai');
    expect(await service.isProviderEnabled('u1', 'openai')).toBe(false);

    const enabled = await service.setProviderEnabled('u1', 'openai', true);
    expect(enabled.data?.disabledProviderIds).not.toContain('openai');
    expect(await service.isProviderEnabled('u1', 'openai')).toBe(true);
  });

  it('requires a non-empty providerId', async () => {
    const result = await svc().setProviderEnabled('u1', '   ', false);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/);
  });

  it('resolves the enabled subset of provider ids', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const service = svc(store);
    expect(await service.getEnabledProviderIds('u1', ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    await service.setProviderEnabled('u1', 'b', false);
    expect(await service.getEnabledProviderIds('u1', ['a', 'b', 'c'])).toEqual(['a', 'c']);
  });

  it('isolates preferences between users', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const service = svc(store);
    await service.setProviderEnabled('user-a', 'openai', false);
    const other = await service.getPreferences('user-b');
    expect(other.data?.disabledProviderIds).toEqual([]);
    expect(defaultProviderPreferences('user-b').userId).toBe('user-b');
  });
});

// MANDATORY-PROVIDER INVARIANT (Part 8) + Gemini auto-Primary Brain (Part 6)
// These tests supply a catalog so the server-enforced invariants are evaluated.
const CATALOG = ['google', 'openai', 'deepseek'];
const svcCatalog = (store = new InMemoryProviderPreferencesStore()): ProviderPreferencesService =>
  new ProviderPreferencesService(store, async () => [...CATALOG]);

describe('ProviderPreferencesService — Gemini auto Primary Brain (Part 6)', () => {
  it('every new account defaults to Google Gemini as Primary Brain', async () => {
    const prefs = await svcCatalog().getPreferences('u1');
    expect(prefs.data?.preferredProviderId).toBe('google');
    expect(prefs.data?.disabledProviderIds).toEqual([]);
    expect(defaultProviderPreferences('u1').preferredProviderId).toBe('google');
  });

  it('the catalog default IS a real registered provider (enables the invariant)', () => {
    expect(CATALOG).toContain('google');
  });
});

describe('ProviderPreferencesService — mandatory one-provider invariant (Part 8)', () => {
  it('cannot disable the only enabled provider', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const service = svcCatalog(store);
    // Defaults: all enabled, Primary = google. Disabling google leaves only
    // openai/deepseek enabled — that's allowed (invariant: >=1 enabled). The
    // LAST enabled provider is what must be protected. Disable openai+deepseek
    // first so google is the sole enabler, then try to disable google.
    await service.setProviderEnabled('u1', 'openai', false);
    await service.setProviderEnabled('u1', 'deepseek', false);
    const attempt = await service.setProviderEnabled('u1', 'google', false);
    expect(attempt.success).toBe(false);
    expect(attempt.error).toMatch(/at least one active AI provider/i);
    expect(await service.isProviderEnabled('u1', 'google')).toBe(true);
  });

  it('cannot disable the current Primary Brain while it remains enabled-only', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const service = svcCatalog(store);
    // google is Primary Brain (default) and currently the only "enabled" provider
    // in the sense that disabling it would make the brain disabled.
    const attempt = await service.setProviderEnabled('u1', 'google', false);
    expect(attempt.success).toBe(false);
    expect(attempt.error).toMatch(/Primary Brain/i);
  });

  it('can disable the Primary Brain only after moving Primary Brain elsewhere (enabled)', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const service = svcCatalog(store);
    // Move Primary Brain to another enabled provider first.
    const moved = await service.updatePreferences('u1', { preferredProviderId: 'openai' });
    expect(moved.success).toBe(true);
    // Now disabling google is allowed (it is no longer the effective brain).
    const attempt = await service.setProviderEnabled('u1', 'google', false);
    expect(attempt.success).toBe(true);
    expect(await service.isProviderEnabled('u1', 'google')).toBe(false);
  });

  it('cannot set Primary Brain to a disabled provider', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const service = svcCatalog(store);
    // Disable openai first.
    await service.setProviderEnabled('u1', 'openai', false);
    const attempt = await service.updatePreferences('u1', { preferredProviderId: 'openai' });
    expect(attempt.success).toBe(false);
    expect(attempt.error).toMatch(/primary brain must be an enabled provider/i);
  });

  it('changing the Primary Brain persists and survives reload', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const service = svcCatalog(store);
    await service.updatePreferences('u1', { preferredProviderId: 'deepseek' });
    const reloaded = await service.getPreferences('u1');
    expect(reloaded.data?.preferredProviderId).toBe('deepseek');
  });
});
