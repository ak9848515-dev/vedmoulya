// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — providers.getExperience end-to-end (gateway)
//
// The AI Providers screen's "+ Add AI" list is exactly what this procedure
// returns. This test drives the REAL gateway handler over the REAL platform
// catalog (createCatalogProviders → InMemoryProviderRepository →
// ProviderApplicationService → ProviderExperienceService), so a regression that
// leaves the registry empty (the "still loading its provider registry" state)
// fails here instead of only in a deployed environment.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import type { TraceStore } from '@vedmoulya/core';
import type { ModelSelectionIntelligence } from '@vedmoulya/services';
import {
  CATALOG_SIZE,
  InMemoryProviderPreferencesStore,
  InMemoryProviderRepository,
  ProviderApplicationService,
  ProviderPreferencesService,
  createCatalogProviders,
} from '@vedmoulya/providers';
import { ProviderExperienceService } from '../services/ProviderExperienceService.js';
import { CostLedger } from '../observability/CostLedger.js';
import { createProvidersRouter } from '../routers/ProvidersRouter.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import type { TRPCContext } from '../router.js';

interface ExperienceRow {
  providerId: string;
  family: string;
  name: string;
  enabled: boolean;
}

function buildGateway() {
  const repository = new InMemoryProviderRepository(createCatalogProviders());
  const providers = new ProviderApplicationService(repository);
  // The preferences service validates against the SAME catalog (as the gateway
  // wires it), so the test exercises the real invariant path too.
  const preferences = new ProviderPreferencesService(
    new InMemoryProviderPreferencesStore(),
    async () => (await providers.getMarketplace()).data?.providers.map((p) => p.id) ?? [],
  );
  const experience = new ProviderExperienceService(
    providers,
    preferences,
    {} as unknown as ModelSelectionIntelligence,
    new CostLedger(),
    { list: () => [] } as unknown as TraceStore,
  );
  return createProvidersRouter(providers, experience);
}

const ctx: TRPCContext = { userId: 'gateway-test-user', email: 'u@example.com', role: 'user' };

describe('providers.getExperience (real seeded catalog)', () => {
  it('returns every built-in provider the Add AI screen lists', async () => {
    const router = buildGateway();

    const result = (await router.getExperience({ userId: ctx.userId }, ctx)) as ApiResponse<{
      providers: ExperienceRow[];
      usage: unknown;
      preferences: unknown;
    }>;

    expect(result.success).toBe(true);
    const providers = result.data?.providers ?? [];
    expect(providers).toHaveLength(CATALOG_SIZE);

    const families = providers.map((provider) => provider.family);
    expect(families).toContain('google');
    expect(families).toContain('openai');
    expect(families).toContain('anthropic');
    expect(families).toContain('deepseek');

    // AddAIOption is built 1:1 from these rows (family + name), so every row
    // must carry the fields the dialog keys and renders on.
    for (const provider of providers) {
      expect(provider.providerId).toBeTruthy();
      expect(provider.family).toBeTruthy();
      expect(provider.name).toBeTruthy();
      expect(typeof provider.enabled).toBe('boolean');
    }
  });

  it('reports usage + preferences alongside the registry rows', async () => {
    const router = buildGateway();

    const result = (await router.getExperience({ userId: ctx.userId }, ctx)) as ApiResponse<{
      providers: ExperienceRow[];
      usage: { tokenBudget: number; tokensUsed: number };
      preferences: { userId: string };
    }>;

    expect(result.data?.usage.tokenBudget).toBeGreaterThan(0);
    expect(result.data?.usage.tokensUsed).toBe(0);
    expect(result.data?.preferences.userId).toBe(ctx.userId);
  });
});
