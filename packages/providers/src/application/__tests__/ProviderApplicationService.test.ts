import { describe, expect, it } from 'vitest';
import { ProviderApplicationService } from '../ProviderApplicationService.js';
import { InMemoryProviderRepository } from '../../infrastructure/InMemoryProviderRepository.js';
import { createCatalogProviders, CATALOG_SIZE } from '../../catalog/provider-catalog.js';
import type { CreateProviderDTO } from '../ProviderDTO.js';

function createService(): ProviderApplicationService {
  return new ProviderApplicationService(new InMemoryProviderRepository(createCatalogProviders()));
}

function createDto(overrides: Partial<CreateProviderDTO> = {}): CreateProviderDTO {
  return {
    id: 'test_provider',
    family: 'mock',
    name: 'Test Provider',
    description: 'A test provider',
    owner: 'test-owner',
    models: [
      {
        id: 'test-model-1',
        name: 'Test Model 1',
        contextLength: 131072,
        maxOutputTokens: 8192,
        streaming: true,
        vision: true,
        functionCalling: true,
        embeddings: false,
        reasoning: true,
        coding: true,
        creativeWriting: true,
        translation: true,
        image: false,
        audio: false,
        video: false,
        modalities: ['text-in', 'text-out'],
        capabilities: ['content_generation', 'reasoning'],
      },
    ],
    capabilities: ['content_generation', 'reasoning'],
    supportedModalities: ['text-in', 'text-out'],
    availability: 0.99,
    tags: ['test'],
    matrix: [
      {
        capability: 'content_generation',
        quality: 0.85,
        expectedCostUsd: 0.01,
        expectedLatencyMs: 500,
        expectedInputTokens: 6000,
        expectedOutputTokens: 4000,
        confidence: 0.9,
        historicalSuccess: 0.95,
        qualityTier: 'economy',
      },
    ],
    ...overrides,
  };
}

describe('ProviderApplicationService', () => {
  it('serves the seeded provider marketplace', async () => {
    const svc = createService();
    const result = await svc.getMarketplace();
    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(CATALOG_SIZE);
    expect(result.data?.providers.length).toBe(CATALOG_SIZE);
    expect(result.data?.activeCount).toBeGreaterThan(0);
    expect(result.data?.healthyCount).toBeGreaterThan(0);
  });

  it('marketplace exposes lifecycle/family/capability counts', async () => {
    const svc = createService();
    const result = await svc.getMarketplace();
    expect(result.data?.countByLifecycleStatus.active).toBeGreaterThan(0);
    expect(result.data?.countByFamily.openai).toBe(1);
    expect(result.data?.countByFamily.anthropic).toBe(1);
    expect(result.data?.countByFamily.google).toBe(1);
    expect(result.data?.countByFamily.deepseek).toBe(1);
    expect(result.data?.countByFamily.openrouter).toBe(1);
    expect(result.data?.countByFamily.ollama).toBe(1);
    expect(result.data?.countByFamily.mock).toBe(1);
    expect(result.data?.countByCapability.content_generation).toBeGreaterThan(0);
  });

  it('every provider exposes models, a capability matrix, and profiles', async () => {
    const svc = createService();
    const result = await svc.getMarketplace();
    for (const provider of result.data?.providers ?? []) {
      expect(provider.models.length).toBeGreaterThan(0);
      expect(provider.matrix.length).toBeGreaterThan(0);
      expect(provider.availability).toBeGreaterThan(0);
      expect(provider.health.healthScore).toBeGreaterThan(0);
    }
  });

  it('flagship providers support the core capabilities (vision, embeddings, long context)', async () => {
    const svc = createService();
    const openai = await svc.getProvider('openai');
    expect(openai.data?.capabilities).toContain('embeddings');
    expect(openai.data?.hasEmbeddings).toBe(true);
    expect(openai.data?.hasVision).toBe(true);

    const google = await svc.getProvider('google');
    expect(google.data?.maxContextLength).toBeGreaterThanOrEqual(1000000);

    const anthropic = await svc.getProvider('anthropic');
    expect(
      anthropic.data?.matrix.some((m) => m.capability === 'content_generation' && m.quality > 0.95),
    ).toBe(true);
  });

  it('builds the capability matrix view across the fleet', async () => {
    const svc = createService();
    const result = await svc.getCapabilityMatrix();
    expect(result.success).toBe(true);
    const rows = result.data?.rows ?? [];
    expect(rows.length).toBeGreaterThan(0);
    const contentRow = rows.find((r) => r.capability === 'content_generation');
    expect(contentRow?.providerCount).toBeGreaterThan(3);
    expect(contentRow?.bestProviderId).toBeDefined();
    // rankings sorted by quality desc
    const qualities = contentRow?.rankings.map((r) => r.quality) ?? [];
    expect([...qualities].sort((a, b) => b - a)).toEqual(qualities);
  });

  it('discovers providers for a capability (no selection made)', async () => {
    const svc = createService();
    const rankings = await svc.getProvidersForCapability('embeddings');
    expect(rankings.success).toBe(true);
    const ids = rankings.data?.map((r) => r.providerId) ?? [];
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
    expect(ids).not.toContain('anthropic'); // no embeddings API
  });

  it('searches providers by query, family, status, and health', async () => {
    const svc = createService();
    const byQuery = await svc.searchProviders({ query: 'DeepSeek' });
    expect(byQuery.success).toBe(true);
    expect(byQuery.data?.items.some((p) => p.family === 'deepseek')).toBe(true);

    const byFamily = await svc.searchProviders({ families: ['ollama'] });
    expect(byFamily.data?.items).toHaveLength(1);
    expect(byFamily.data?.items[0]?.costTier).toBe('free');

    const byStatus = await svc.searchProviders({ lifecycleStatuses: ['testing'] });
    expect(byStatus.data?.items.map((p) => p.id)).toEqual(['mock']);

    const byHealth = await svc.searchProviders({ minHealthScore: 0.95 });
    expect(byHealth.data?.items.length).toBeGreaterThan(0);
  });

  it('registers a new provider with validated rules', async () => {
    const svc = createService();
    const result = await svc.registerProvider(createDto());
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('test_provider');
    expect(result.data?.version).toBe('1.0.0');
    expect(result.data?.lifecycleStatus).toBe('draft');
  });

  it('rejects duplicate provider ids and invalid definitions', async () => {
    const svc = createService();
    expect((await svc.registerProvider(createDto({ id: 'openai' }))).success).toBe(false);
    expect((await svc.registerProvider(createDto({ name: '  ' }))).success).toBe(false);
    expect((await svc.registerProvider(createDto({ models: [] }))).success).toBe(false);
    expect((await svc.registerProvider(createDto({ availability: 1.5 }))).success).toBe(false);
  });

  it('updates details and profiles', async () => {
    const svc = createService();
    await svc.registerProvider(createDto());
    const result = await svc.updateProvider('test_provider', {
      description: 'updated description',
      inputPerMillionTokens: 1.5,
      p95Ms: 900,
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('updated description');
    expect(result.data?.inputPerMillionTokens).toBe(1.5);
    expect(result.data?.p95Ms).toBe(900);
  });

  it('walks the lifecycle and rejects invalid transitions', async () => {
    const svc = createService();
    await svc.registerProvider(createDto());

    const toTesting = await svc.transitionLifecycle('test_provider', 'testing');
    expect(toTesting.success).toBe(true);
    expect(toTesting.data?.lifecycleStatus).toBe('testing');
    const toActive = await svc.transitionLifecycle('test_provider', 'active');
    expect(toActive.success).toBe(true);
    const toMaintenance = await svc.transitionLifecycle('test_provider', 'maintenance');
    expect(toMaintenance.success).toBe(true);
    const toDeprecated = await svc.transitionLifecycle('test_provider', 'deprecated');
    expect(toDeprecated.success).toBe(true);
    const toArchived = await svc.transitionLifecycle('test_provider', 'archived');
    expect(toArchived.success).toBe(true);

    // archived is terminal
    const invalid = await svc.transitionLifecycle('test_provider', 'active');
    expect(invalid.success).toBe(false);
  });

  it('bumps major, minor, and patch versions', async () => {
    const svc = createService();
    await svc.registerProvider(createDto());
    expect((await svc.createVersion('test_provider', 'minor')).data?.version).toBe('1.1.0');
    expect((await svc.createVersion('test_provider', 'patch')).data?.version).toBe('1.1.1');
    expect((await svc.createVersion('test_provider', 'major')).data?.version).toBe('2.0.0');
  });

  it('records health samples and recomputes the health score', async () => {
    const svc = createService();
    await svc.registerProvider(createDto());
    const first = await svc.recordHealthSample('test_provider', {
      ok: true,
      latencyMs: 120,
      quotaUsedPercent: 20,
      rateLimitRemaining: 900,
    });
    expect(first.success).toBe(true);
    expect(first.data?.health.healthScore).toBeGreaterThan(0);
    const afterFailures = await svc.recordHealthSample('test_provider', {
      ok: false,
      latencyMs: 4000,
    });
    expect(afterFailures.data?.health.failureCount).toBe(1);
  });

  it('replaces the capability matrix and bumps the minor version', async () => {
    const svc = createService();
    await svc.registerProvider(createDto());
    const result = await svc.setCapabilityMatrix('test_provider', [
      {
        capability: 'reasoning',
        quality: 0.98,
        expectedCostUsd: 0.005,
        expectedLatencyMs: 400,
        expectedInputTokens: 3000,
        expectedOutputTokens: 1500,
        confidence: 0.97,
        historicalSuccess: 0.99,
        qualityTier: 'premium',
      },
      {
        capability: 'coding',
        quality: 0.95,
        expectedCostUsd: 0.004,
        expectedLatencyMs: 350,
        expectedInputTokens: 2500,
        expectedOutputTokens: 1200,
        confidence: 0.96,
        historicalSuccess: 0.98,
        qualityTier: 'premium',
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.matrix).toHaveLength(2);
    expect(result.data?.version).toBe('1.1.0'); // setMatrix bumps minor
    expect(result.data?.bestQuality).toBe(0.98);
  });

  it('rejects an empty capability matrix replacement', async () => {
    const svc = createService();
    await svc.registerProvider(createDto());
    const result = await svc.setCapabilityMatrix('test_provider', []);
    expect(result.success).toBe(false);
    expect(result.error).toContain('must not be empty');
  });

  it('returns benchmark dataset definitions (no benchmark executed)', async () => {
    const svc = createService();
    const result = await svc.getBenchmarkDatasets();
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
    expect(result.data?.items[0]?.benchmarkId).toMatch(/^B-\d{3}$/);
    expect(result.data?.summary.byCategory.reasoning).toBeGreaterThanOrEqual(1);
    expect(result.data?.summary.byDifficulty.basic).toBeGreaterThanOrEqual(1);
  });

  it('filters benchmark datasets by category and difficulty', async () => {
    const svc = createService();
    const byCategory = await svc.getBenchmarkDatasets({ category: 'coding' });
    expect(byCategory.data?.items.every((d) => d.category === 'coding')).toBe(true);
    const byDifficulty = await svc.getBenchmarkDatasets({ difficulty: 'advanced' });
    expect(byDifficulty.data?.items.every((d) => d.difficulty === 'advanced')).toBe(true);
    const both = await svc.getBenchmarkDatasets({ category: 'reasoning', difficulty: 'expert' });
    expect(both.data?.items).toHaveLength(1);
  });

  it('exposes the model registry across the fleet', async () => {
    const svc = createService();
    const result = await svc.getModelRegistry();
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
    expect(result.data?.models.length).toBeGreaterThan(0);
    // Every model entry has a provider attribution
    for (const entry of result.data?.models ?? []) {
      expect(entry.providerId).toBeTruthy();
      expect(entry.model.id).toBeTruthy();
      expect(entry.model.contextLength).toBeGreaterThan(0);
    }
    // OpenAI should have 3 models (gpt-4o, gpt-4o-mini, text-embedding-3-small)
    const openaiModels = result.data?.models.filter((m) => m.providerId === 'openai') ?? [];
    expect(openaiModels.length).toBe(3);
  });

  it('aggregates fleet health and availability tiers', async () => {
    const svc = createService();
    const fleet = await svc.getFleetHealth();
    expect(fleet.success).toBe(true);
    expect(fleet.data?.totalCount).toBe(CATALOG_SIZE);
    expect(fleet.data?.healthyCount).toBeGreaterThan(0);

    const tier = await svc.getAvailabilityTier('openai');
    expect(tier.success).toBe(true);
    expect(tier.data?.tier).toBe('ready');
    expect((await svc.getAvailabilityTier('nope')).success).toBe(false);
  });

  it('lists by family and capability', async () => {
    const svc = createService();
    const byFamily = await svc.listByFamily('google');
    expect(byFamily.data).toHaveLength(1);
    expect(byFamily.data?.[0]?.id).toBe('google');
    const byCap = await svc.listByCapability('embeddings');
    expect(byCap.data?.some((p) => p.id === 'openai')).toBe(true);
  });

  it('deletes a provider and returns not-found errors', async () => {
    const svc = createService();
    await svc.registerProvider(createDto());
    const deleted = await svc.deleteProvider('test_provider');
    expect(deleted.success).toBe(true);
    expect(deleted.data?.deleted).toBe(true);
    expect((await svc.getProvider('test_provider')).success).toBe(false);
    expect((await svc.deleteProvider('test_provider')).success).toBe(false);
    expect((await svc.getProvider('nope')).success).toBe(false);
    expect((await svc.transitionLifecycle('nope', 'active')).success).toBe(false);
  });
});
