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
