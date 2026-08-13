import { describe, expect, it } from 'vitest';
import { Provider } from '../../domain/entities/Provider.js';
import { createProviderId } from '../../domain/value-objects/ProviderId.js';
import { ProviderLifecycleStatus } from '../../domain/value-objects/ProviderLifecycleStatus.js';
import { InMemoryProviderRepository } from '../InMemoryProviderRepository.js';

interface MakeProviderOverrides {
  family?: Provider['family'];
  status?: Provider['lifecycleStatus']['value'];
  tags?: string[];
  capabilities?: Provider['capabilities'][number][];
  modalities?: Provider['supportedModalities'][number][];
  healthScore?: number;
  contextLength?: number;
}

function makeProvider(id: string, overrides: MakeProviderOverrides = {}): Provider {
  const contextLength = overrides.contextLength ?? 128000;
  const healthScore = overrides.healthScore ?? 0.95;
  return Provider.create({
    id: createProviderId(id),
    family: overrides.family ?? 'mock',
    name: id,
    description: `${id} provider description`,
    owner: 'test',
    tags: overrides.tags ?? [id],
    lifecycleStatus: ProviderLifecycleStatus.fromStatus(overrides.status ?? 'active'),
    capabilities: overrides.capabilities ?? ['content_generation'],
    supportedModalities: overrides.modalities ?? ['text-in', 'text-out'],
    models: [
      {
        id: `${id}-1`,
        name: `${id} model`,
        contextLength,
        maxOutputTokens: 8192,
        streaming: true,
        vision: false,
        functionCalling: true,
        embeddings: false,
        reasoning: true,
        coding: false,
        creativeWriting: true,
        translation: false,
        image: false,
        audio: false,
        video: false,
        modalities: ['text-in', 'text-out'],
        capabilities: ['content_generation'],
      },
    ],
    health: {
      status: 'healthy',
      healthScore,
      latencyMs: 100,
      successCount: 100,
      failureCount: 0,
      quotaUsedPercent: 10,
      rateLimitRemaining: 100,
      rateLimitResetAt: null,
      lastSuccessAt: '2026-08-03T00:00:00.000Z',
      lastFailureAt: null,
      lastCheckedAt: '2026-08-03T00:00:00.000Z',
    },
  });
}

describe('InMemoryProviderRepository', () => {
  it('saves, finds, updates, and deletes', async () => {
    const repo = new InMemoryProviderRepository();
    const p = makeProvider('openai');
    await repo.save(p);
    expect(await repo.findById(createProviderId('openai'))).toBe(p);
    expect(await repo.findById(createProviderId('missing'))).toBeNull();

    p.updateDetails({ description: 'updated' });
    await repo.update(p);
    expect((await repo.findById(createProviderId('openai')))?.description).toBe('updated');

    await repo.delete(createProviderId('openai'));
    expect(await repo.exists(createProviderId('openai'))).toBe(false);
  });

  it('seeds from a list and finds by ids', async () => {
    const repo = new InMemoryProviderRepository([makeProvider('a'), makeProvider('b')]);
    expect(await repo.count()).toBe(2);
    const byIds = await repo.findByIds([createProviderId('a'), createProviderId('nope')]);
    expect(byIds).toHaveLength(1);
  });

  it('finds by family, lifecycle status, capability, and tag', async () => {
    const repo = new InMemoryProviderRepository([
      makeProvider('openai', { family: 'openai', tags: ['frontier'] }),
      makeProvider('mock', { status: 'testing' }),
    ]);
    expect((await repo.findByFamily('openai', { page: 1, limit: 10 })).total).toBe(1);
    expect((await repo.findByLifecycleStatus('testing', { page: 1, limit: 10 })).total).toBe(1);
    expect((await repo.findByCapability('content_generation', { page: 1, limit: 10 })).total).toBe(
      2,
    );
    expect((await repo.findByTag('frontier', { page: 1, limit: 10 })).total).toBe(1);
  });

  it('searches by query across name, description, model, and tags', async () => {
    const repo = new InMemoryProviderRepository([
      makeProvider('openai', { tags: ['frontier'] }),
      makeProvider('mock', { tags: ['test'] }),
    ]);
    expect((await repo.search({ query: 'openai' }, { page: 1, limit: 10 })).total).toBe(1);
    expect(
      (await repo.search({ query: 'provider description' }, { page: 1, limit: 10 })).total,
    ).toBe(2);
    expect((await repo.search({ query: 'frontier' }, { page: 1, limit: 10 })).total).toBe(1);
    // matches the model id
    expect((await repo.search({ query: 'openai-1' }, { page: 1, limit: 10 })).total).toBe(1);
  });

  it('filters by families, statuses, capabilities, modalities, tags, health, context, feature', async () => {
    const repo = new InMemoryProviderRepository([
      makeProvider('big', { family: 'google', contextLength: 1000000, healthScore: 0.95 }),
      makeProvider('small', { family: 'mock', contextLength: 8192, healthScore: 0.5 }),
    ]);
    expect((await repo.search({ families: ['google'] }, { page: 1, limit: 10 })).total).toBe(1);
    expect((await repo.search({ minHealthScore: 0.7 }, { page: 1, limit: 10 })).total).toBe(1);
    expect((await repo.search({ minContextLength: 100000 }, { page: 1, limit: 10 })).total).toBe(1);
    expect((await repo.search({ feature: 'streaming' }, { page: 1, limit: 10 })).total).toBe(2);
    expect(
      (await repo.search({ capabilities: ['content_generation'] }, { page: 1, limit: 10 })).total,
    ).toBe(2);
  });

  it('paginates results', async () => {
    const repo = new InMemoryProviderRepository([
      makeProvider('a'),
      makeProvider('b'),
      makeProvider('c'),
    ]);
    const page1 = await repo.search({}, { page: 1, limit: 2 });
    const page2 = await repo.search({}, { page: 2, limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.totalPages).toBe(2);
    expect(page2.data).toHaveLength(1);
  });

  it('counts by lifecycle status, family, capability, and healthy', async () => {
    const repo = new InMemoryProviderRepository([
      makeProvider('a', { family: 'openai', healthScore: 0.95 }),
      makeProvider('b', { family: 'mock', status: 'testing', healthScore: 0.5 }),
    ]);
    const byStatus = await repo.countByLifecycleStatus();
    expect(byStatus.active).toBe(1);
    expect(byStatus.testing).toBe(1);
    const byFamily = await repo.countByFamily();
    expect(byFamily.openai).toBe(1);
    expect(byFamily.mock).toBe(1);
    const byCap = await repo.countByCapability();
    expect(byCap.content_generation).toBe(2);
    expect(await repo.countHealthy()).toBe(1);
  });

  it('supports capability and modality lookups', async () => {
    const repo = new InMemoryProviderRepository([
      makeProvider('a', {
        capabilities: ['content_generation'],
        modalities: ['text-in', 'text-out'],
      }),
    ]);
    expect(await repo.findSupportsCapability('content_generation')).toHaveLength(1);
    expect(await repo.findSupportsModality('image-in')).toHaveLength(0);
    expect(await repo.listAll()).toHaveLength(1);
  });
});
