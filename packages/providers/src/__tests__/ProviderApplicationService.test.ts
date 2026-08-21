// ──────────────────────────────────────────────────────────────────
// VedMoulya — ProviderApplicationService tests
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// Registry CRUD, lifecycle/versioning, health, capability matrix,
// discovery/search, benchmarks, model registry, EPIC-012A/012B
// intelligence, local-model discovery and the marketplace view.
// Hermetic: in-memory repository/preferences/intelligence stores.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { Provider } from '../domain/entities/Provider.js';
import { createProviderId } from '../domain/value-objects/ProviderId.js';
import { ProviderLifecycleStatus } from '../domain/value-objects/ProviderLifecycleStatus.js';
import { ProviderApplicationService } from '../application/ProviderApplicationService.js';
import type { CreateProviderDTO } from '../application/ProviderDTO.js';
import { InMemoryProviderRepository } from '../infrastructure/InMemoryProviderRepository.js';
import { InMemoryProviderPreferencesStore } from '../infrastructure/InMemoryProviderPreferencesStore.js';
import { InMemoryProviderIntelligenceStore } from '../infrastructure/InMemoryProviderIntelligenceStore.js';
import type { ProviderIntelligenceRecord } from '../domain/intelligence/ProviderIntelligenceStore.js';
import { runWithProviderUser } from '../application/request-context.js';

function makeProvider(id: string, family = 'openai', name = 'OpenAI'): Provider {
  const baseModel = {
    id: 'm1',
    name: 'Model One',
    contextLength: 128000,
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
  return Provider.create({
    id: createProviderId(id),
    family: family as Provider['family'],
    name,
    description: `Description for ${name}`,
    owner: 'u1',
    models: [{ ...baseModel }],
    capabilities: ['reasoning', 'coding'],
    supportedModalities: ['text'],
    cost: {
      inputPerMillionTokens: 3,
      outputPerMillionTokens: 15,
      currency: 'USD',
      tier: 'low',
    },
    latency: { p50Ms: 100, p95Ms: 300 },
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 10000,
      requestsPerDay: 1000,
      maxConcurrentRequests: 4,
    },
    availability: 0.99,
    tags: ['flagship'],
    lifecycleStatus: ProviderLifecycleStatus.fromStatus('active'),
  });
}

function createDTO(overrides: Partial<CreateProviderDTO> = {}): CreateProviderDTO {
  return {
    id: 'new-provider',
    family: 'openai',
    name: 'New Provider',
    description: 'A brand new provider',
    owner: 'u1',
    models: [
      {
        id: 'm1',
        name: 'Model One',
        contextLength: 128000,
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
        modalities: ['text'],
        capabilities: ['reasoning', 'coding'],
      },
    ],
    capabilities: ['reasoning', 'coding'],
    supportedModalities: ['text'],
    inputPerMillionTokens: 3,
    outputPerMillionTokens: 15,
    costTier: 'low',
    p50Ms: 100,
    p95Ms: 300,
    requestsPerMinute: 60,
    tokensPerMinute: 10000,
    requestsPerDay: 1000,
    maxConcurrentRequests: 4,
    availability: 0.99,
    tags: ['new'],
    documentationUrl: 'https://example.com',
    ...overrides,
  };
}

const NOW = new Date('2026-08-13T09:00:00Z');

function intelligenceRecord(
  provider: Provider,
  generatedAt = NOW.toISOString(),
): ProviderIntelligenceRecord {
  return {
    providerId: provider.id,
    providerName: provider.name,
    profile: {
      providerId: provider.id,
      providerName: provider.name,
      generatedAt,
      derivedFrom: 'registry',
      models: [],
      coverage: { modelCount: 0, knownPropertyCount: 0, unknownPropertyCount: 0 },
    },
    knownModels: {},
    verifiedAt: generatedAt,
    verificationState: 'PARTIALLY_VERIFIED',
    discovery: { attempted: true, discovered: false, source: 'none', message: 'none' },
    delta: {
      addedModels: [],
      removedModels: [],
      preservedModels: [],
      userPreferencesPreserved: true,
    },
    refreshPolicy: { maxAgeMs: 24 * 60 * 60 * 1000 },
    cachedAt: generatedAt,
  };
}

describe('ProviderApplicationService — registry CRUD', () => {
  it('registers a provider and reads it back', async () => {
    const svc = new ProviderApplicationService(new InMemoryProviderRepository());
    const created = await svc.registerProvider(createDTO());
    expect(created.success).toBe(true);
    expect(created.data?.name).toBe('New Provider');
    expect(created.data?.version).toBe('1.0.0');

    const read = await svc.getProvider('new-provider');
    expect(read.success).toBe(true);
    expect(read.data?.id).toBe('new-provider');
  });

  it('rejects a duplicate registration', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('dup'));
    const svc = new ProviderApplicationService(repo);
    const result = await svc.registerProvider(createDTO({ id: 'dup' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/);
  });

  it('rejects invalid registration payloads', async () => {
    const svc = new ProviderApplicationService(new InMemoryProviderRepository());
    const result = await svc.registerProvider(createDTO({ name: '' }));
    expect(result.success).toBe(false);
  });

  it('returns not-found for unknown providers', async () => {
    const svc = new ProviderApplicationService(new InMemoryProviderRepository());
    expect((await svc.getProvider('ghost')).success).toBe(false);
    expect((await svc.updateProvider('ghost', {})).success).toBe(false);
    expect((await svc.deleteProvider('ghost')).success).toBe(false);
    expect((await svc.recordHealthSample('ghost', { ok: true })).success).toBe(false);
    expect((await svc.setCapabilityMatrix('ghost', [])).success).toBe(false);
    expect((await svc.getIntelligenceProfile('ghost')).success).toBe(false);
  });

  it('updates detail and profile fields', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('upd'));
    const svc = new ProviderApplicationService(repo);
    const result = await svc.updateProvider('upd', {
      name: 'Renamed',
      description: 'New description',
      tags: ['x', 'y'],
      documentationUrl: 'https://docs.example',
      inputPerMillionTokens: 1,
      outputPerMillionTokens: 2,
      p50Ms: 50,
      p95Ms: 150,
      requestsPerMinute: 30,
      tokensPerMinute: 5000,
      requestsPerDay: 500,
      maxConcurrentRequests: 2,
      availability: 0.9,
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Renamed');
    expect(result.data?.inputPerMillionTokens).toBe(1);
    expect(result.data?.p50Ms).toBe(50);
    expect(result.data?.availability).toBe(0.9);
  });

  it('validates name and availability on update', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('v'));
    const svc = new ProviderApplicationService(repo);
    expect((await svc.updateProvider('v', { name: '' })).success).toBe(false);
    expect((await svc.updateProvider('v', { availability: 2 })).success).toBe(false);
  });

  it('deletes a provider and its cached intelligence', async () => {
    const repo = new InMemoryProviderRepository();
    const provider = makeProvider('del');
    await repo.save(provider);
    const store = new InMemoryProviderIntelligenceStore();
    await store.save(intelligenceRecord(provider));
    const svc = new ProviderApplicationService(repo, undefined, { store });
    const result = await svc.deleteProvider('del');
    expect(result.success).toBe(true);
    expect(await repo.findById(createProviderId('del'))).toBeNull();
    expect(await store.get('del')).toBeNull();
  });
});

describe('ProviderApplicationService — lifecycle, versioning, health, matrix', () => {
  it('transitions lifecycle and reports invalid transitions honestly', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('lc'));
    const svc = new ProviderApplicationService(repo);
    const ok = await svc.transitionLifecycle('lc', 'testing');
    expect(ok.success).toBe(true);
    expect(ok.data?.lifecycleStatus).toBe('testing');

    // active → archived is not a valid transition (fail-closed).
    await svc.transitionLifecycle('lc', 'active');
    const invalid = await svc.transitionLifecycle('lc', 'archived');
    expect(invalid.success).toBe(false);
  });

  it('creates major, minor and patch versions', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('ver'));
    const svc = new ProviderApplicationService(repo);
    expect((await svc.createVersion('ver', 'major')).data?.version).toBe('2.0.0');
    expect((await svc.createVersion('ver', 'minor')).data?.version).toBe('2.1.0');
    expect((await svc.createVersion('ver', 'patch')).data?.version).toBe('2.1.1');
  });

  it('records a health sample', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('health'));
    const svc = new ProviderApplicationService(repo);
    const result = await svc.recordHealthSample('health', {
      ok: true,
      latencyMs: 42,
      quotaUsedPercent: 10,
      rateLimitRemaining: 50,
    });
    expect(result.success).toBe(true);
    expect(result.data?.health.latencyMs).toBe(42);
    expect(result.data?.health.successCount).toBe(1);
  });

  it('rejects an empty capability matrix and accepts a valid one', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('mat'));
    const svc = new ProviderApplicationService(repo);
    const empty = await svc.setCapabilityMatrix('mat', []);
    expect(empty.success).toBe(false);
    expect(empty.error).toMatch(/must not be empty/);

    const ok = await svc.setCapabilityMatrix('mat', [
      {
        capability: 'reasoning',
        quality: 0.9,
        expectedCostUsd: 0.001,
        expectedLatencyMs: 100,
        expectedInputTokens: 1000,
        expectedOutputTokens: 500,
        confidence: 0.95,
        historicalSuccess: 0.98,
        qualityTier: 'high',
      },
    ]);
    expect(ok.success).toBe(true);
    expect(ok.data?.matrix).toHaveLength(1);
  });

  it('reports fleet health and availability tier', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('a'));
    const svc = new ProviderApplicationService(repo);
    const fleet = await svc.getFleetHealth();
    expect(fleet.success).toBe(true);
    expect(fleet.data?.totalCount).toBe(1);
    const tier = await svc.getAvailabilityTier('a');
    expect(tier.success).toBe(true);
    expect(tier.data?.tier).toBeDefined();
  });
});

describe('ProviderApplicationService — search, lists, benchmarks, model registry', () => {
  it('searches providers with filters', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('search-a'));
    await repo.save(makeProvider('search-b', 'anthropic', 'Claude'));
    const svc = new ProviderApplicationService(repo);
    const result = await svc.searchProviders({ query: 'claude' });
    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(1);
    const all = await svc.searchProviders({ families: ['openai'] });
    expect(all.data?.total).toBe(1);
  });

  it('lists by family and capability', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('fam-a', 'openai'));
    await repo.save(makeProvider('fam-b', 'anthropic'));
    const svc = new ProviderApplicationService(repo);
    expect((await svc.listByFamily('openai')).data).toHaveLength(1);
    expect((await svc.listByCapability('reasoning')).data).toHaveLength(2);
  });

  it('excludes disabled providers from routing when preferences + context are present', async () => {
    const repo = new InMemoryProviderRepository();
    const disabled = makeProvider('disabled-prov', 'anthropic');
    await repo.save(disabled);
    await repo.save(makeProvider('enabled-prov', 'openai'));
    const prefs = new InMemoryProviderPreferencesStore();
    await prefs.save({
      userId: 'u-routing',
      disabledProviderIds: ['disabled-prov'],
      preferredProviderId: undefined,
      preferredModelId: undefined,
      budgetPolicy: 'ask_before_paid',
      budgets: {},
      updatedAt: NOW.toISOString(),
    });
    const svc = new ProviderApplicationService(repo, prefs);

    // Without request context the full list is returned (hermetic fallback).
    expect((await svc.listByFamily('anthropic')).data).toHaveLength(1);

    // With a request user the disabled provider is excluded.
    const ids = await runWithProviderUser('u-routing', async () => {
      const byFamily = await svc.listByFamily('anthropic');
      expect(byFamily.data).toHaveLength(0);
      const byCapability = await svc.listByCapability('reasoning');
      return byCapability.data?.map((p) => p.id);
    });
    expect(ids).toEqual(['enabled-prov']);
  });

  it('lists benchmark datasets with and without filters', async () => {
    const svc = new ProviderApplicationService(new InMemoryProviderRepository());
    const all = await svc.getBenchmarkDatasets();
    expect(all.success).toBe(true);
    expect(all.data?.total).toBeGreaterThan(0);
    const filtered = await svc.getBenchmarkDatasets({ difficulty: 'hard' });
    expect(filtered.data?.total).toBeGreaterThanOrEqual(0);
  });

  it('builds the model registry across the fleet', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('reg-a'));
    await repo.save(makeProvider('reg-b', 'anthropic', 'Claude'));
    const svc = new ProviderApplicationService(repo);
    const registry = await svc.getModelRegistry();
    expect(registry.success).toBe(true);
    expect(registry.data?.total).toBe(2);
  });
});

describe('ProviderApplicationService — capability matrix + marketplace', () => {
  it('builds the capability matrix view and rankings', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('cm-a'));
    const svc = new ProviderApplicationService(repo);
    await svc.setCapabilityMatrix('cm-a', [
      {
        capability: 'reasoning',
        quality: 0.9,
        expectedCostUsd: 0.001,
        expectedLatencyMs: 100,
        expectedInputTokens: 1000,
        expectedOutputTokens: 500,
        confidence: 0.95,
        historicalSuccess: 0.98,
        qualityTier: 'high',
      },
    ]);
    const matrix = await svc.getCapabilityMatrix();
    expect(matrix.success).toBe(true);
    expect(matrix.data?.rows.length).toBeGreaterThan(0);
    const rankings = await svc.getProvidersForCapability('reasoning');
    expect(rankings.success).toBe(true);
    expect(rankings.data).toBeDefined();
  });

  it('builds the marketplace view with counts', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('mp-a'));
    const svc = new ProviderApplicationService(repo);
    const market = await svc.getMarketplace();
    expect(market.success).toBe(true);
    expect(market.data?.total).toBe(1);
    expect(market.data?.activeCount).toBe(1);
    expect(market.data?.countByLifecycleStatus.active).toBe(1);
  });
});

describe('ProviderApplicationService — EPIC-012A/012B intelligence', () => {
  it('classifies a model resource and assesses hardware fit', () => {
    const svc = new ProviderApplicationService(new InMemoryProviderRepository());
    const cls = svc.classifyModelResource({
      family: 'ollama',
      inputPerMillionTokens: 0,
      outputPerMillionTokens: 0,
      tags: [],
      costTier: 'free',
    });
    expect(cls.success).toBe(true);
    expect(cls.data?.resourceType).toBe('LOCAL');

    const fit = svc.assessHardwareFit({ ramGb: 32, vramGb: 24, hasGpu: true, storageGb: 200 }, [
      { modelId: 'llama', name: 'Llama', estimatedSizeGb: 6 },
    ]);
    expect(fit.success).toBe(true);
    expect(fit.data?.assessments[0]?.verdict).toBe('SAFE');
  });

  it('derives an intelligence profile for a provider', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('intel'));
    const svc = new ProviderApplicationService(repo);
    const profile = await svc.getIntelligenceProfile('intel');
    expect(profile.success).toBe(true);
    expect(profile.data?.providerId).toBe('intel');
    expect(profile.data?.models.length).toBeGreaterThan(0);
  });

  it('serves a fresh cached intelligence status (cache-first)', async () => {
    const repo = new InMemoryProviderRepository();
    const provider = makeProvider('cache');
    await repo.save(provider);
    const store = new InMemoryProviderIntelligenceStore();
    await store.save(intelligenceRecord(provider));
    const svc = new ProviderApplicationService(repo, undefined, { store, now: () => NOW });
    const result = await svc.getIntelligenceStatus('cache');
    expect(result.success).toBe(true);
    expect(result.data?.cached).toBe(true);
    expect(result.data?.staleness.isStale).toBe(false);
  });

  it('refreshes a stale or missing cache and re-caches', async () => {
    const repo = new InMemoryProviderRepository();
    const provider = makeProvider('stale');
    await repo.save(provider);
    const store = new InMemoryProviderIntelligenceStore();
    // Two days old → stale under the default 24h policy.
    await store.save(
      intelligenceRecord(provider, new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()),
    );
    const svc = new ProviderApplicationService(repo, undefined, { store, now: () => NOW });
    const result = await svc.getIntelligenceStatus('stale');
    expect(result.success).toBe(true);
    expect(result.data?.cached).toBe(false);
    expect(await store.get('stale')).not.toBeNull();

    // No store configured → never crashes, always refreshes.
    const plain = new ProviderApplicationService(repo, undefined, { now: () => NOW });
    const noStore = await plain.getIntelligenceStatus('stale');
    expect(noStore.success).toBe(true);
    expect(noStore.data?.cached).toBe(false);
  });

  it('refreshes provider intelligence explicitly', async () => {
    const repo = new InMemoryProviderRepository();
    await repo.save(makeProvider('refresh'));
    const store = new InMemoryProviderIntelligenceStore();
    const svc = new ProviderApplicationService(repo, undefined, { store, now: () => NOW });
    const result = await svc.refreshProviderIntelligence('refresh');
    expect(result.success).toBe(true);
    expect(result.data?.verificationState).toBe('PARTIALLY_VERIFIED');
    expect(await store.get('refresh')).not.toBeNull();
  });

  it('discovers local models through runtime adapters (fail-safe)', async () => {
    const svc = new ProviderApplicationService(new InMemoryProviderRepository());
    // Ollama reachable.
    const ollama = await svc.discoverLocalModels('ollama', 'http://localhost:11434');
    expect(ollama.success).toBe(true);
    // lm-studio / openai-compatible with an unreachable endpoint → fail-safe.
    const lm = await svc.discoverLocalModels('lm-studio', 'http://localhost:9');
    expect(lm.success).toBe(true);
    expect(lm.data?.discovered).toBe(false);
    const compat = await svc.discoverLocalModels('openai-compatible', 'http://localhost:9');
    expect(compat.success).toBe(true);
    expect(compat.data?.discovered).toBe(false);
  });

  it('discovers declared local models hermetically', async () => {
    const svc = new ProviderApplicationService(new InMemoryProviderRepository());
    const result = await svc.discoverLocalModelsDeclared('ollama', [
      {
        id: 'llama3',
        name: 'llama3',
        status: 'available',
        capabilities: ['reasoning'],
        capabilitiesProvenance: 'INFERRED',
        runtime: 'ollama',
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.discovered).toBe(true);
    expect(result.data?.models).toHaveLength(1);
  });
});
