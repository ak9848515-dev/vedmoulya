// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Preferences Service Tests
// EPIC-012A — AI Provider Intelligence (Phases 5 / 13 / 14 / 26)
// Owner isolation, defaults, enable/disable, budgets, routing filter.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ProviderPreferencesService } from '../ProviderPreferencesService.js';
import { InMemoryProviderPreferencesStore } from '../../infrastructure/InMemoryProviderPreferencesStore.js';
import { runWithProviderUser, currentProviderUser } from '../request-context.js';
import { ProviderApplicationService } from '../ProviderApplicationService.js';
import { InMemoryProviderRepository } from '../../infrastructure/InMemoryProviderRepository.js';
import { Provider } from '../../domain/entities/Provider.js';
import { createProviderId } from '../../domain/value-objects/ProviderId.js';
import { ProviderLifecycleStatus } from '../../domain/value-objects/ProviderLifecycleStatus.js';

function makeProvider(
  id: string,
  family: 'openai' | 'google' | 'ollama',
  capability = 'reasoning',
): Provider {
  return Provider.create({
    id: createProviderId(id),
    family,
    name: id,
    description: `${id} description`,
    owner: 'registry',
    lifecycleStatus: ProviderLifecycleStatus.fromStatus('active'),
    models: [
      {
        id: `${id}-m`,
        name: `${id} model`,
        contextLength: 8000,
        maxOutputTokens: 2048,
        streaming: true,
        vision: false,
        functionCalling: true,
        embeddings: false,
        reasoning: true,
        coding: true,
        creativeWriting: false,
        translation: false,
        image: false,
        audio: false,
        video: false,
        modalities: ['text-in', 'text-out'],
        capabilities: [capability],
      },
    ],
    capabilities: [capability],
    supportedModalities: ['text-in', 'text-out'],
    tags: [],
    availability: 0.99,
  });
}

describe('ProviderPreferencesService', () => {
  it('returns defaults when the user never customized (all enabled, ask before paid)', async () => {
    const svc = new ProviderPreferencesService(new InMemoryProviderPreferencesStore());
    const result = await svc.getPreferences('alice');
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      userId: 'alice',
      disabledProviderIds: [],
      budgetPolicy: 'ask_before_paid',
      budgets: { monthlyTokenBudget: 1_000_000 },
    });
  });

  it('disables/enables a provider for one user only (owner isolation)', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const svc = new ProviderPreferencesService(store);

    await svc.setProviderEnabled('alice', 'openai', false);
    await svc.setProviderEnabled('bob', 'openai', true);

    expect(await svc.isProviderEnabled('alice', 'openai')).toBe(false);
    expect(await svc.isProviderEnabled('bob', 'openai')).toBe(true);
    // A third user untouched.
    expect(await svc.isProviderEnabled('carol', 'openai')).toBe(true);

    // Re-enable for alice.
    await svc.setProviderEnabled('alice', 'openai', true);
    expect(await svc.isProviderEnabled('alice', 'openai')).toBe(true);
  });

  it('persists budget policy + budgets with validation', async () => {
    const svc = new ProviderPreferencesService(new InMemoryProviderPreferencesStore());
    const ok = await svc.updatePreferences('alice', {
      budgetPolicy: 'never_paid',
      budgets: { monthlyUsd: 5, perRequestUsd: 0.1, monthlyTokenBudget: 500_000 },
    });
    expect(ok.success).toBe(true);
    expect(ok.data).toMatchObject({
      budgetPolicy: 'never_paid',
      budgets: { monthlyUsd: 5, perRequestUsd: 0.1, monthlyTokenBudget: 500_000 },
    });

    const bad = await svc.updatePreferences('alice', { budgetPolicy: 'unlimited' as never });
    expect(bad.success).toBe(false);

    const negative = await svc.updatePreferences('alice', { budgets: { monthlyUsd: -1 } });
    expect(negative.success).toBe(false);
  });

  it('validates preferred-model-without-provider conflict', async () => {
    const svc = new ProviderPreferencesService(new InMemoryProviderPreferencesStore());
    const result = await svc.updatePreferences('alice', {
      preferredProviderId: null,
      preferredModelId: 'gpt-5',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('preferred model');
  });

  it('routing discovery excludes disabled providers for the current user only', async () => {
    const repo = new InMemoryProviderRepository([
      makeProvider('openai', 'openai'),
      makeProvider('google', 'google'),
      makeProvider('ollama', 'ollama'),
    ]);
    const prefs = new InMemoryProviderPreferencesStore();
    const prefsSvc = new ProviderPreferencesService(prefs);
    const providers = new ProviderApplicationService(repo, prefs);

    // No context → no filtering (hermetic behavior preserved).
    const all = await providers.listByCapability('reasoning');
    expect(all.data?.length).toBe(3);

    // Disable google for alice.
    await prefsSvc.setProviderEnabled('alice', 'google', false);

    // Alice's request → google excluded from routing candidates.
    const aliceView = await runWithProviderUser('alice', () =>
      providers.listByCapability('reasoning'),
    );
    expect(aliceView.data?.map((p) => p.id)).toEqual(['openai', 'ollama']);

    // Bob's request → everything still eligible.
    const bobView = await runWithProviderUser('bob', () => providers.listByCapability('reasoning'));
    expect(bobView.data?.map((p) => p.id)).toEqual(['openai', 'google', 'ollama']);

    // The marketplace (getMarketplace) still shows ALL providers (disabled
    // providers remain configured and visible).
    const marketplace = await providers.getMarketplace();
    expect(marketplace.data?.providers.length).toBe(3);
  });

  it('request context is scoped to the async flow', async () => {
    let inner: string | undefined;
    await runWithProviderUser('alice', () => {
      inner = currentProviderUser();
    });
    expect(inner).toBe('alice');
    expect(currentProviderUser()).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MANDATORY-PROVIDER INVARIANT (server-enforced — never frontend-only)
//   1. enabledProviders.length >= 1 for every completed account.
//   2. The Primary Brain must always reference an ENABLED provider.
//   3. The default Primary Brain is Google Gemini (DEFAULT_PRIMARY_BRAIN_PROVIDER_ID).
// The universe of providers is the SINGLE platform catalog, supplied here as
// the lazy catalog getter exactly like the gateway does.
// ─────────────────────────────────────────────────────────────────────────────
import {
  MANDATORY_PROVIDER_ERROR,
  PRIMARY_BRAIN_DISABLED_ERROR,
  PRIMARY_BRAIN_DISABLE_BLOCKED_ERROR,
} from '../ProviderPreferencesService.js';
import {
  DEFAULT_PRIMARY_BRAIN_PROVIDER_ID,
  defaultProviderPreferences,
} from '../../types/preferences-types.js';

describe('ProviderPreferencesService — mandatory-provider invariant', () => {
  const CATALOG = ['google', 'openai', 'deepseek'];

  function svcWithCatalog(store = new InMemoryProviderPreferencesStore()) {
    return new ProviderPreferencesService(store, async () => [...CATALOG]);
  }

  it('every completed account starts with Google Gemini enabled and as Primary Brain', async () => {
    const svc = svcWithCatalog();
    const defaults = defaultProviderPreferences('u1');
    expect(defaults.preferredProviderId).toBe(DEFAULT_PRIMARY_BRAIN_PROVIDER_ID);
    expect(defaults.preferredProviderId).toBe('google');
    expect(defaults.disabledProviderIds).toEqual([]);
    expect(await svc.getPrimaryBrainProviderId('u1')).toBe('google');
    expect(await svc.isProviderEnabled('u1', 'google')).toBe(true);
  });

  it('the last enabled provider can never be disabled (zero enabled is unreachable)', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const svc = svcWithCatalog(store);
    // Disable two of three (allowed; brain stays google → must be moved first).
    await svc.updatePreferences('u1', { preferredProviderId: 'deepseek' });
    expect((await svc.setProviderEnabled('u1', 'google', false)).success).toBe(true);
    expect((await svc.setProviderEnabled('u1', 'openai', false)).success).toBe(true);
    // Only deepseek (the brain) remains — disabling it MUST be refused.
    const blocked = await svc.setProviderEnabled('u1', 'deepseek', false);
    expect(blocked.success).toBe(false);
    expect(blocked.error).toBe(MANDATORY_PROVIDER_ERROR);
    // The account still has exactly one enabled provider.
    expect(await svc.getEnabledProviderIds('u1', CATALOG)).toEqual(['deepseek']);
  });
  it('a catalog with a single provider can never be disabled at all', async () => {
    const svc = new ProviderPreferencesService(new InMemoryProviderPreferencesStore(), async () => [
      'google',
    ]);
    const blocked = await svc.setProviderEnabled('u1', 'google', false);
    expect(blocked.success).toBe(false);
    expect(blocked.error).toBe(MANDATORY_PROVIDER_ERROR);
    expect(await svc.isProviderEnabled('u1', 'google')).toBe(true);
  });

  it('the Primary Brain cannot be disabled until another enabled provider is selected first', async () => {
    const svc = svcWithCatalog();
    // Default brain is google: disabling it is blocked with actionable guidance.
    const blocked = await svc.setProviderEnabled('u1', 'google', false);
    expect(blocked.success).toBe(false);
    expect(blocked.error).toBe(PRIMARY_BRAIN_DISABLE_BLOCKED_ERROR);
    expect(await svc.isProviderEnabled('u1', 'google')).toBe(true);
    // SAFE TRANSITION: select openai as Primary Brain, THEN disable google.
    const brainChange = await svc.updatePreferences('u1', { preferredProviderId: 'openai' });
    expect(brainChange.success).toBe(true);
    const nowAllowed = await svc.setProviderEnabled('u1', 'google', false);
    expect(nowAllowed.success).toBe(true);
    expect(await svc.getPrimaryBrainProviderId('u1')).toBe('openai');
    expect(await svc.isProviderEnabled('u1', 'google')).toBe(false);
  });

  it('a patch can never leave the Primary Brain disabled', async () => {
    const svc = svcWithCatalog();
    // Bulk patch disabling the effective brain → refused.
    const patch = await svc.updatePreferences('u1', { disabledProviderIds: ['google'] });
    expect(patch.success).toBe(false);
    expect(patch.error).toBe(PRIMARY_BRAIN_DISABLED_ERROR);
    // The SAME patch with an explicit enabled Primary Brain succeeds.
    const safe = await svc.updatePreferences('u1', {
      preferredProviderId: 'deepseek',
      disabledProviderIds: ['google'],
    });
    expect(safe.success).toBe(true);
    // A brain that is itself in the disabled set is refused.
    const brainDisabled = await svc.updatePreferences('u1', {
      disabledProviderIds: ['deepseek'],
    });
    expect(brainDisabled.success).toBe(false);
    expect(brainDisabled.error).toBe(PRIMARY_BRAIN_DISABLED_ERROR);
  });

  it('changing the Primary Brain and toggling providers persists (survives restart/refresh)', async () => {
    const store = new InMemoryProviderPreferencesStore();
    const svc = svcWithCatalog(store);
    await svc.updatePreferences('u1', { preferredProviderId: 'openai' });
    await svc.setProviderEnabled('u1', 'google', false);
    await svc.setProviderEnabled('u1', 'deepseek', false);

    // A NEW service instance over the SAME store (deployment restart/session
    // renewal) reads the identical durable state.
    const rehydrated = svcWithCatalog(store);
    expect(await rehydrated.getPrimaryBrainProviderId('u1')).toBe('openai');
    expect(await rehydrated.getEnabledProviderIds('u1', CATALOG)).toEqual(['openai']);
    const prefs = await rehydrated.getPreferences('u1');
    expect(prefs.data?.preferredProviderId).toBe('openai');
    expect(prefs.data?.disabledProviderIds).toEqual(['google', 'deepseek']);
  });

  it('a catalog read failure never corrupts invariant-free preference writes', async () => {
    const svc = new ProviderPreferencesService(new InMemoryProviderPreferencesStore(), () => {
      throw new Error('registry down');
    });
    const result = await svc.updatePreferences('u1', { budgetPolicy: 'never_paid' });
    expect(result.success).toBe(true);
    expect(result.data?.budgetPolicy).toBe('never_paid');
  });
});
