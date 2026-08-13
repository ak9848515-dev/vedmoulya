// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Intelligence Refresh tests
// EPIC-012B — AI Provider Intelligence & Model Discovery
// Verifies: safe refresh (never fails the provider), staleness
// detection, model delta (added/removed/preserved — never silently
// deleted), cache-first status reads, honest verification states
// (FULLY/PARTIALLY/UNVERIFIED), user-preference preservation, bounded
// caching, and credential isolation (no secrets in intelligence).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { Provider } from '../domain/entities/Provider.js';
import { createProviderId } from '../domain/value-objects/ProviderId.js';
import { ProviderLifecycleStatus } from '../domain/value-objects/ProviderLifecycleStatus.js';
import { ProviderIntelligenceRefreshService } from '../domain/services/ProviderIntelligenceRefreshService.js';
import { InMemoryProviderIntelligenceStore } from '../infrastructure/InMemoryProviderIntelligenceStore.js';
import { ProviderApplicationService } from '../application/ProviderApplicationService.js';
import { InMemoryProviderRepository } from '../infrastructure/InMemoryProviderRepository.js';
import { InMemoryProviderPreferencesStore } from '../infrastructure/InMemoryProviderPreferencesStore.js';
import type {
  ProviderCatalogDiscoveryPort,
  ProviderCatalogDiscoveryResult,
} from '../types/intelligence-types.js';

function makeProvider(params: { id: string; name: string; modelIds?: string[] }): Provider {
  const baseModel = {
    maxOutputTokens: 4096,
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
    modalities: ['text'] as string[],
    capabilities: ['reasoning', 'coding'] as string[],
  };
  const modelIds = params.modelIds ?? ['m1'];
  return Provider.create({
    id: createProviderId(params.id),
    family: 'openai',
    name: params.name,
    description: 'test',
    owner: 'u1',
    models: modelIds.map((id, i) => ({
      ...baseModel,
      id,
      name: `Model ${i + 1}`,
      contextLength: 128000,
    })),
    capabilities: ['reasoning', 'coding'],
    supportedModalities: ['text'],
    cost: { inputPerMillionTokens: 3, outputPerMillionTokens: 15, currency: 'USD', tier: 'low' },
    latency: { p50Ms: 100, p95Ms: 300 },
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 10000,
      requestsPerDay: 1000,
      maxConcurrentRequests: 4,
    },
    availability: 0.99,
    tags: [],
    lifecycleStatus: ProviderLifecycleStatus.fromStatus('active'),
  });
}

/** A discovery port that claims live verification of the given models. */
function liveDiscovery(modelIds: string[]): ProviderCatalogDiscoveryPort {
  return {
    discover: async (providerId: string): Promise<ProviderCatalogDiscoveryResult> => ({
      discovered: true,
      source: 'provider-api',
      retrievedAt: new Date().toISOString(),
      verificationState: 'VERIFIED',
      models: modelIds.map((id) => ({ id, name: id })),
      statusMessage: `Verified ${modelIds.length} models from the provider API for "${providerId}".`,
    }),
  };
}

/** A discovery port that always throws — refresh must survive it. */
const throwingDiscovery: ProviderCatalogDiscoveryPort = {
  discover: async () => {
    throw new Error('provider API unreachable');
  },
};

describe('ProviderIntelligenceRefreshService — safe refresh', () => {
  it('derives a profile and reports PARTIALLY_VERIFIED when no live metadata source is configured', async () => {
    const svc = new ProviderIntelligenceRefreshService({
      now: () => new Date('2026-08-10T12:00:00Z'),
    });
    const result = await svc.refresh(makeProvider({ id: 'openai', name: 'OpenAI' }));

    expect(result.profile.providerId).toBe('openai');
    expect(result.profile.models).toHaveLength(1);
    expect(result.verificationState).toBe('PARTIALLY_VERIFIED');
    expect(result.discovery.attempted).toBe(true);
    expect(result.discovery.discovered).toBe(false);
    expect(result.delta.addedModels).toEqual(['m1']);
    expect(result.delta.preservedModels).toEqual([]);
    expect(result.delta.userPreferencesPreserved).toBe(true);
    // Model lifecycle is derived honestly (never claimed as verified).
    expect(result.profile.models[0]?.lifecycleStatus.value).toBe('active');
    expect(result.profile.models[0]?.lifecycleStatus.provenance).toBe('INFERRED');
  });

  it('reports FULLY_VERIFIED only when the provider metadata source confirms the models', async () => {
    const svc = new ProviderIntelligenceRefreshService({ discovery: liveDiscovery(['m1', 'm2']) });
    const result = await svc.refresh(makeProvider({ id: 'p', name: 'P', modelIds: ['m1', 'm2'] }));
    expect(result.verificationState).toBe('FULLY_VERIFIED');
    expect(result.discovery.discovered).toBe(true);
    expect(result.discovery.source).toBe('provider-api');
  });

  it('never fails the provider when metadata discovery throws — intelligence stays partially verified', async () => {
    const svc = new ProviderIntelligenceRefreshService({ discovery: throwingDiscovery });
    const result = await svc.refresh(makeProvider({ id: 'p', name: 'P' }));
    expect(result.verificationState).toBe('PARTIALLY_VERIFIED');
    expect(result.profile.models).toHaveLength(1);
    expect(result.discovery.discovered).toBe(false);
  });

  it('computes the safe delta across refreshes: added / removed / preserved — never silently deletes', async () => {
    const svc = new ProviderIntelligenceRefreshService();
    const first = await svc.refresh(makeProvider({ id: 'p', name: 'P', modelIds: ['a', 'b'] }));

    // Second refresh: model 'b' disappeared upstream, 'c' is new.
    const second = await svc.refresh(makeProvider({ id: 'p', name: 'P', modelIds: ['a', 'c'] }), {
      profile: first.profile,
      knownModels: first.knownModels,
    });
    expect(second.delta.addedModels).toEqual(['c']);
    expect(second.delta.removedModels).toEqual(['b']);
    expect(second.delta.preservedModels).toEqual(['a']);
    // The ledger persists the removal: 'b' is marked unavailable, not deleted.
    expect(second.knownModels['b']).toBe('unavailable');
    expect(second.knownModels['a']).toBe('active');
    expect(second.knownModels['c']).toBe('active');
  });

  it('the known-models ledger survives across refreshes (removal knowledge is not lost)', async () => {
    const svc = new ProviderIntelligenceRefreshService();
    const first = await svc.refresh(makeProvider({ id: 'p', name: 'P', modelIds: ['a', 'b'] }));
    const second = await svc.refresh(makeProvider({ id: 'p', name: 'P', modelIds: ['a'] }), {
      profile: first.profile,
      knownModels: first.knownModels,
    });
    const third = await svc.refresh(makeProvider({ id: 'p', name: 'P', modelIds: ['a'] }), {
      profile: second.profile,
      knownModels: second.knownModels,
    });
    // 'b' stays unavailable across refreshes — routing can keep excluding it.
    expect(third.knownModels['b']).toBe('unavailable');
    // A model returning to the registry becomes active again.
    const fourth = await svc.refresh(makeProvider({ id: 'p', name: 'P', modelIds: ['a', 'b'] }), {
      profile: third.profile,
      knownModels: third.knownModels,
    });
    expect(fourth.knownModels['b']).toBe('active');
  });

  it('staleness: a fresh profile is not stale; an old one is (with injectable clock)', async () => {
    const svc = new ProviderIntelligenceRefreshService({
      now: () => new Date('2026-08-10T12:00:00Z'),
      maxAgeMs: 24 * 60 * 60 * 1000,
    });
    const profile = (await svc.refresh(makeProvider({ id: 'p', name: 'P' }))).profile;

    const fresh = svc.staleness(profile, { now: () => new Date('2026-08-10T18:00:00Z') });
    expect(fresh.isStale).toBe(false);

    const stale = svc.staleness(profile, { now: () => new Date('2026-08-12T18:00:00Z') });
    expect(stale.isStale).toBe(true);
    expect(stale.ageMs).toBeGreaterThan(24 * 60 * 60 * 1000);
    expect(stale.lastVerifiedAt).toBe(profile.generatedAt);
  });

  it('staleness: a never-verified profile is always stale', () => {
    const svc = new ProviderIntelligenceRefreshService();
    const verdict = svc.staleness(null);
    expect(verdict.isStale).toBe(true);
    expect(verdict.lastVerifiedAt).toBeNull();
  });

  it('unknown metadata stays UNKNOWN — nothing is invented from model names', async () => {
    const svc = new ProviderIntelligenceRefreshService();
    const result = await svc.refresh(makeProvider({ id: 'p', name: 'P' }));
    const model = result.profile.models[0];
    expect(model?.contextWindow.value).toBe(128000);
    expect(model?.contextWindow.provenance).toBe('PROVIDER_DECLARED');
    // Absent provider latency → UNKNOWN, never a fabricated value.
    expect(model?.latencyMs.provenance).toBe('UNKNOWN');
    expect(model?.latencyMs.value).toBeNull();
  });
});

describe('ProviderIntelligenceStore — bounded cache, owner-safe', () => {
  it('caches and reads back refresh results keyed by providerId', async () => {
    const store = new InMemoryProviderIntelligenceStore();
    const svc = new ProviderIntelligenceRefreshService();
    const result = await svc.refresh(makeProvider({ id: 'openai', name: 'OpenAI' }));
    await store.save({ ...result, cachedAt: result.verifiedAt });

    const cached = await store.get('openai');
    expect(cached?.providerId).toBe('openai');
    expect(cached?.profile.models).toHaveLength(1);
    expect(await store.get('other')).toBeNull();
  });

  it('evicts the oldest entry beyond the bound (FIFO)', async () => {
    const store = new InMemoryProviderIntelligenceStore(2);
    const svc = new ProviderIntelligenceRefreshService();
    for (const id of ['a', 'b', 'c']) {
      const result = await svc.refresh(makeProvider({ id, name: id }));
      await store.save({ ...result, cachedAt: result.verifiedAt });
    }
    expect(await store.get('a')).toBeNull();
    expect((await store.get('b'))?.providerId).toBe('b');
    expect((await store.get('c'))?.providerId).toBe('c');
  });

  it('owner isolation is structural: the store is keyed by providerId, not user', async () => {
    // The registry is a platform catalog (not user-scoped); intelligence is
    // keyed by providerId — there is no per-user surface to cross.
    const store = new InMemoryProviderIntelligenceStore();
    const svc = new ProviderIntelligenceRefreshService();
    const result = await svc.refresh(makeProvider({ id: 'shared', name: 'Shared' }));
    await store.save({ ...result, cachedAt: result.verifiedAt });
    expect((await store.get('shared'))?.profile.providerId).toBe('shared');
  });
});

describe('ProviderApplicationService — cache-first status + refresh', () => {
  function appService(): {
    service: ProviderApplicationService;
    store: InMemoryProviderIntelligenceStore;
    prefs: InMemoryProviderPreferencesStore;
  } {
    const repo = new InMemoryProviderRepository();
    void repo.save(makeProvider({ id: 'openai', name: 'OpenAI', modelIds: ['m1'] }));
    const store = new InMemoryProviderIntelligenceStore();
    const prefs = new InMemoryProviderPreferencesStore();
    const service = new ProviderApplicationService(repo, prefs, {
      store,
      maxAgeMs: 24 * 60 * 60 * 1000,
    });
    return { service, store, prefs };
  }

  it('serves cached intelligence on the second read (no re-derivation)', async () => {
    const { service } = appService();
    const first = await service.getIntelligenceStatus('openai');
    expect(first.success).toBe(true);
    expect(first.data?.cached).toBe(false);
    expect(first.data?.staleness.isStale).toBe(false);
    expect(first.data?.record.profile.models).toHaveLength(1);

    const second = await service.getIntelligenceStatus('openai');
    expect(second.success).toBe(true);
    expect(second.data?.cached).toBe(true);
  });

  it('re-derives when the cached profile is stale', async () => {
    // Fixed clock: first read caches at T+0; a later read at T+48h (past the
    // 24h policy) must re-derive instead of serving the stale cache.
    let now = new Date('2026-08-10T12:00:00Z');
    const repo = new InMemoryProviderRepository();
    void repo.save(makeProvider({ id: 'openai', name: 'OpenAI', modelIds: ['m1'] }));
    const store = new InMemoryProviderIntelligenceStore();
    const service = new ProviderApplicationService(repo, undefined, {
      store,
      maxAgeMs: 24 * 60 * 60 * 1000,
      now: () => now,
    });

    const first = await service.getIntelligenceStatus('openai');
    expect(first.data?.cached).toBe(false);
    expect(first.data?.staleness.isStale).toBe(false);

    // Jump the clock 48h — the cached profile is now stale → fresh derivation.
    now = new Date('2026-08-12T12:00:00Z');
    const staleRead = await service.getIntelligenceStatus('openai');
    expect(staleRead.success).toBe(true);
    expect(staleRead.data?.cached).toBe(false);
    expect(staleRead.data?.staleness.isStale).toBe(false);
  });

  it('refreshProviderIntelligence re-derives, caches, and reports the delta', async () => {
    const { service } = appService();
    // First refresh: no previous profile → every model is newly added.
    const refreshed = await service.refreshProviderIntelligence('openai');
    expect(refreshed.success).toBe(true);
    expect(refreshed.data?.delta.addedModels).toEqual(['m1']);
    expect(refreshed.data?.delta.preservedModels).toEqual([]);
    expect((await service.getIntelligenceStatus('openai')).data?.cached).toBe(true);

    // Second refresh against the cached profile → m1 is preserved, no churn.
    const again = await service.refreshProviderIntelligence('openai');
    expect(again.success).toBe(true);
    expect(again.data?.delta.preservedModels).toEqual(['m1']);
    expect(again.data?.delta.addedModels).toEqual([]);
    expect(again.data?.delta.removedModels).toEqual([]);
  });

  it('refresh preserves user preferences even when a model disappears', async () => {
    const { service, prefs } = appService();
    // User explicitly selected model m1 (which later disappears upstream).
    await prefs.save({
      userId: 'u1',
      disabledProviderIds: [],
      preferredProviderId: 'openai',
      preferredModelId: 'm1',
      budgetPolicy: 'ask_before_paid',
      budgets: {},
      updatedAt: new Date().toISOString(),
    });
    const refreshed = await service.refreshProviderIntelligence('openai');
    expect(refreshed.success).toBe(true);
    expect(refreshed.data?.delta.userPreferencesPreserved).toBe(true);
    // The stored preference is structurally untouched by refresh.
    const still = await prefs.get('u1');
    expect(still?.preferredModelId).toBe('m1');
  });

  it('deleting a provider clears its cached intelligence', async () => {
    const { service } = appService();
    await service.refreshProviderIntelligence('openai');
    expect((await service.getIntelligenceStatus('openai')).data).toBeDefined();
    await service.deleteProvider('openai');
    // Provider gone → status fails (not found) and the cache is empty.
    const status = await service.getIntelligenceStatus('openai');
    expect(status.success).toBe(false);
    expect(status.error).toContain('not found');
  });

  it('credential isolation: intelligence records never contain secret material', async () => {
    const { service } = appService();
    const refreshed = await service.refreshProviderIntelligence('openai');
    const serialized = JSON.stringify(refreshed.data);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(serialized).not.toMatch(/api[_-]?key/i);
    expect(serialized).not.toMatch(/bearer\s+/i);
  });

  it('fleet refresh failure behavior: an unavailable provider still yields registry-derived intelligence', async () => {
    const repo = new InMemoryProviderRepository();
    void repo.save(makeProvider({ id: 'p', name: 'P' }));
    const service = new ProviderApplicationService(repo, undefined, {
      store: new InMemoryProviderIntelligenceStore(),
      discovery: throwingDiscovery,
    });
    const status = await service.getIntelligenceStatus('p');
    expect(status.success).toBe(true);
    expect(status.data?.record.verificationState).toBe('PARTIALLY_VERIFIED');
    expect(status.data?.record.profile.models).toHaveLength(1);
  });
});
