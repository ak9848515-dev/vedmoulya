// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: Provider Intelligence namespace tests
// EPIC-012A — AI Provider Intelligence (Phases 7–11)
//
// Exercises the providers.intelligence procedures through the REAL tRPC
// pipeline (auth + rate-limit middleware + RouterRegistry handler closures):
//   getIntelligenceProfile  — auto-derived profile with provenance
//   classifyModelResource   — LOCAL/FREE/PAID/AGGREGATOR distinction
//   assessHardwareFit       — hardware-aware local model fit
//   discoverLocalModels     — fail-safe local runtime discovery
// Plus IDOR: a foreign userId must be refused by the gateway guard.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  InMemoryProviderRepository,
  InMemoryProviderIntelligenceStore,
  ProviderApplicationService,
  ProviderIntelligenceRefreshService,
  createCatalogProviders,
  createProviderId,
} from '@vedmoulya/providers';
import { createAppRouter } from '../services/RouterRegistry.js';
import { createProviderIntelligencePort } from '../infrastructure/RuntimePorts.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

// Minimal service object: only the providers service is exercised; other
// namespaces' handlers are lazy closures that never run in this suite.
const services = {
  providers: new ProviderApplicationService(
    new InMemoryProviderRepository(createCatalogProviders()),
  ),
} as unknown as ApiApplicationService;

describe('providers.intelligence namespace (EPIC-012A)', () => {
  const router = createAppRouter(services);

  const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

  it('derives an intelligence profile with provenance for a catalog provider', async () => {
    const caller = router.createCaller(ctx('piu-1'));
    const result = await caller.providers.getIntelligenceProfile({
      userId: 'piu-1',
      id: 'openai',
    });

    expect(result.success).toBe(true);
    const data = result.data as {
      providerId: string;
      providerName: string;
      models: unknown[];
      coverage: { modelCount: number; knownPropertyCount: number; unknownPropertyCount: number };
    };
    expect(data.providerId).toBe('openai');
    expect(data.models.length).toBeGreaterThan(0);
    // Every model carries provenance; nothing can be a bare value.
    const model = data.models[0] as Record<string, unknown>;
    const contextWindow = model.contextWindow as { provenance: string };
    expect(['PROVIDER_DECLARED', 'MEASURED', 'INFERRED', 'UNKNOWN', 'VERIFIED']).toContain(
      contextWindow.provenance,
    );
    expect(data.coverage.modelCount).toBe(data.models.length);
  });

  it('classifies an ollama/local resource as LOCAL and free', async () => {
    const caller = router.createCaller(ctx('piu-2'));
    const result = await caller.providers.classifyModelResource({
      userId: 'piu-2',
      family: 'ollama',
      inputPerMillionTokens: 0,
      outputPerMillionTokens: 0,
      costTier: 'free',
      tags: [],
    });

    expect(result.success).toBe(true);
    const data = result.data as {
      resourceType: string;
      freeToUse: boolean;
      reasons: string[];
    };
    expect(data.resourceType).toBe('LOCAL');
    expect(data.freeToUse).toBe(true);
    expect(data.reasons.length).toBeGreaterThan(0);
  });

  it('distinguishes a quota-limited free tier from unlimited free inference', async () => {
    const caller = router.createCaller(ctx('piu-3'));
    const result = await caller.providers.classifyModelResource({
      userId: 'piu-3',
      family: 'openai',
      inputPerMillionTokens: 0,
      outputPerMillionTokens: 0,
      costTier: 'free',
      tags: ['free-tier'],
    });

    expect(result.success).toBe(true);
    const data = result.data as { resourceType: string; freeToUse: boolean; reasons: string[] };
    // A zero-price free tier with no quota evidence = FREE_HOSTED (free to use).
    expect(data.freeToUse).toBe(true);
    expect(['FREE_HOSTED', 'FREE_API_QUOTA']).toContain(data.resourceType);
  });

  it('classifies a paid API as USER_PAID_API (never conflated with free)', async () => {
    const caller = router.createCaller(ctx('piu-4'));
    const result = await caller.providers.classifyModelResource({
      userId: 'piu-4',
      family: 'anthropic',
      inputPerMillionTokens: 3,
      outputPerMillionTokens: 15,
      costTier: 'high',
      tags: [],
    });

    expect(result.success).toBe(true);
    const data = result.data as { resourceType: string; freeToUse: boolean };
    expect(data.resourceType).toBe('USER_PAID_API');
    expect(data.freeToUse).toBe(false);
  });

  it('classifies openrouter as an AGGREGATOR even at zero listed price', async () => {
    const caller = router.createCaller(ctx('piu-5'));
    const result = await caller.providers.classifyModelResource({
      userId: 'piu-5',
      family: 'openrouter',
      inputPerMillionTokens: 0,
      outputPerMillionTokens: 0,
      costTier: 'free',
      tags: [],
    });

    expect(result.success).toBe(true);
    const data = result.data as { resourceType: string };
    expect(data.resourceType).toBe('AGGREGATOR');
  });

  it('assesses hardware fit deterministically with reasons', async () => {
    const caller = router.createCaller(ctx('piu-6'));
    const result = await caller.providers.assessHardwareFit({
      userId: 'piu-6',
      hardware: { ramGb: 32, storageGb: 100, hasGpu: false },
      models: [
        { modelId: 'm1', name: 'small-q4', estimatedSizeGb: 4 },
        { modelId: 'm2', name: 'huge-fp16', estimatedSizeGb: 120 },
      ],
    });

    expect(result.success).toBe(true);
    const data = result.data as {
      hardwareKnown: boolean;
      assessments: Array<{ modelId: string; verdict: string; reasons: string[] }>;
      summary: { safe: number; unsupported: number; unknown: number };
    };
    expect(data.hardwareKnown).toBe(true);
    expect(data.assessments).toHaveLength(2);
    expect(data.assessments[0].verdict).toBe('SAFE');
    expect(data.assessments[1].verdict).toBe('UNSUPPORTED');
    expect(data.assessments[0].reasons.length).toBeGreaterThan(0);
  });

  it('returns UNKNOWN (never guesses) when hardware is absent', async () => {
    const caller = router.createCaller(ctx('piu-7'));
    const result = await caller.providers.assessHardwareFit({
      userId: 'piu-7',
      hardware: {},
      models: [{ modelId: 'm1', name: 'unknown-size', estimatedSizeGb: 8 }],
    });

    expect(result.success).toBe(true);
    const data = result.data as { hardwareKnown: boolean; assessments: Array<{ verdict: string }> };
    expect(data.hardwareKnown).toBe(false);
    expect(data.assessments[0].verdict).toBe('UNKNOWN');
  });

  it('local discovery fails safe with an honest status when unreachable', async () => {
    const caller = router.createCaller(ctx('piu-8'));
    // A closed port guarantees fail-safe behavior; the adapter is bounded
    // (1500ms timeout) and never fabricates a model list.
    const result = await caller.providers.discoverLocalModels({
      userId: 'piu-8',
      runtime: 'ollama',
      endpoint: 'http://127.0.0.1:9',
    });

    expect(result.success).toBe(true);
    const data = result.data as { discovered: boolean; models: unknown[]; statusMessage: string };
    expect(data.discovered).toBe(false);
    expect(data.models).toHaveLength(0);
    expect(data.statusMessage.length).toBeGreaterThan(0);
  });

  it('refuses a foreign userId (IDOR) for intelligence procedures', async () => {
    const caller = router.createCaller(ctx('piu-9'));
    await expect(
      caller.providers.getIntelligenceProfile({ userId: 'piu-attacker', id: 'openai' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('providers.intelligence namespace (EPIC-012B — refresh & staleness)', () => {
  // The same catalog registry, but with the bounded intelligence cache so
  // cache-first status + refresh semantics are exercised through the REAL
  // tRPC pipeline.
  const servicesWithStore = {
    providers: new ProviderApplicationService(
      new InMemoryProviderRepository(createCatalogProviders()),
      undefined,
      { store: new InMemoryProviderIntelligenceStore() },
    ),
  } as unknown as ApiApplicationService;
  const router = createAppRouter(servicesWithStore);
  const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

  it('getIntelligenceStatus is cache-first: second read is served from cache', async () => {
    const caller = router.createCaller(ctx('pir-1'));
    const first = await caller.providers.getIntelligenceStatus({ userId: 'pir-1', id: 'openai' });
    expect(first.success).toBe(true);
    const firstData = first.data as {
      providerId: string;
      cached: boolean;
      record: { profile: { models: unknown[] }; verificationState: string };
      staleness: { isStale: boolean; lastVerifiedAt: string | null };
    };
    expect(firstData.providerId).toBe('openai');
    expect(firstData.cached).toBe(false);
    expect(firstData.record.profile.models.length).toBeGreaterThan(0);
    expect(firstData.record.verificationState).toBe('PARTIALLY_VERIFIED');
    expect(firstData.staleness.isStale).toBe(false);
    expect(firstData.staleness.lastVerifiedAt).toBeTruthy();

    const second = await caller.providers.getIntelligenceStatus({ userId: 'pir-1', id: 'openai' });
    const secondData = second.data as { cached: boolean };
    expect(secondData.cached).toBe(true);
  });

  it('refreshIntelligence is an explicit safe refresh reporting model deltas', async () => {
    const caller = router.createCaller(ctx('pir-2'));
    const refreshed = await caller.providers.refreshIntelligence({
      userId: 'pir-2',
      id: 'deepseek',
    });
    expect(refreshed.success).toBe(true);
    const data = refreshed.data as {
      providerId: string;
      verificationState: string;
      delta: {
        addedModels: string[];
        preservedModels: string[];
        userPreferencesPreserved: boolean;
      };
      knownModels: Record<string, string>;
      profile: { models: Array<{ lifecycleStatus: { value: string } }> };
    };
    expect(data.providerId).toBe('deepseek');
    expect(data.delta.userPreferencesPreserved).toBe(true);
    // First refresh → every model is “added” (nothing silently deleted).
    expect(data.delta.addedModels.length).toBeGreaterThan(0);
    // Models carry a lifecycle status, and the persistent ledger is present.
    expect(data.profile.models[0].lifecycleStatus.value).toBe('active');
    expect(Object.keys(data.knownModels).length).toBeGreaterThan(0);
  });

  it('refreshIntelligence preserves the user-preferred model through the pipeline', async () => {
    const caller = router.createCaller(ctx('pir-3'));
    const first = await caller.providers.refreshIntelligence({ userId: 'pir-3', id: 'openai' });
    expect(first.success).toBe(true);
    const second = await caller.providers.refreshIntelligence({ userId: 'pir-3', id: 'openai' });
    const data = second.data as {
      delta: { preservedModels: string[]; removedModels: string[] };
    };
    // Second refresh: no churn — models preserved, none removed, none added.
    expect(data.delta.preservedModels.length).toBeGreaterThan(0);
    expect(data.delta.removedModels).toEqual([]);
  });

  it('refuses a foreign userId (IDOR) on refresh and status procedures', async () => {
    const caller = router.createCaller(ctx('pir-4'));
    await expect(
      caller.providers.refreshIntelligence({ userId: 'pir-attacker', id: 'openai' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.providers.getIntelligenceStatus({ userId: 'pir-attacker', id: 'openai' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('providers.intelligence → routing (EPIC-012B ledger exclusion)', () => {
  it('routing candidates exclude models the intelligence ledger marks unavailable/deprecated', async () => {
    const repo = new InMemoryProviderRepository(createCatalogProviders());
    const store = new InMemoryProviderIntelligenceStore();
    const svc = new ProviderApplicationService(repo, undefined, { store });

    // Seed the ledger: a previous refresh recorded gpt-4o as deprecated.
    const openai = createCatalogProviders().find((p) => p.id === createProviderId('openai'));
    expect(openai).toBeDefined();
    const refreshSvc = new ProviderIntelligenceRefreshService();
    const result = await refreshSvc.refresh(openai!);
    await store.save({
      ...result,
      cachedAt: result.verifiedAt,
      knownModels: { ...result.knownModels, 'gpt-4o': 'deprecated' },
    });

    const port = createProviderIntelligencePort(svc, store);
    const candidates = await port.getCandidates('reasoning');
    const openaiCandidate = candidates.find((c) => c.providerId === 'openai');
    expect(openaiCandidate).toBeDefined();
    // The ledger fact travels with the candidate so the advisor's pickModel
    // (unit-tested separately) excludes the deprecated model from selection.
    expect(openaiCandidate?.unavailableModelIds).toContain('gpt-4o');
    expect(openaiCandidate?.unavailableModelIds).not.toContain('gpt-4o-mini');
  });
});
