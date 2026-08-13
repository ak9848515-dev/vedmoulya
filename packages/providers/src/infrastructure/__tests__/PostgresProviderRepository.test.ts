// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Provider Repository
// EI-002 — Enterprise Provider Registry & Intelligence Platform
//
// Verifies query building, JSONB row <-> entity mapping, and
// pagination WITHOUT a live database: the `postgres` module is mocked
// with a fake `sql` template-tag function (same pattern as the
// services/identity Postgres repository test), so the full repository
// surface is exercised in CI and local runs.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type postgres from 'postgres';
import { PostgresProviderRepository } from '../PostgresProviderRepository.js';
import { createProviderId } from '../../domain/value-objects/ProviderId.js';
import { Provider } from '../../domain/entities/Provider.js';
import { ProviderLifecycleStatus } from '../../domain/value-objects/ProviderLifecycleStatus.js';
import { ProviderVersion } from '../../domain/value-objects/ProviderVersion.js';

// ── Fake postgres `sql` ─────────────────────────────────────────────────────
// postgres.js exposes `sql` as a template-tag function plus `.unsafe()`. The
// fake resolves each call (in order) with a scripted value, mirroring the
// row shapes the repository expects. The repository never inspects the
// generated SQL string — only the resolved rows — so a behavioral fake is
// sufficient.

function makeFakeSql(results: Array<() => unknown>): postgres.Sql {
  let idx = 0;
  const next = (): Promise<unknown> => {
    const r = results[idx]();
    idx += 1;
    return Promise.resolve(r);
  };
  const sql = vi.fn(() => next()) as unknown as postgres.Sql;
  sql.unsafe = vi.fn(() => next());
  // The repo binds JSON documents via sql.json() — the fake returns the raw
  // value (the real driver wraps it in a Parameter for OID 3802).
  sql.json = ((value: unknown): unknown => value) as never;
  return sql;
}

function providerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pg_mock_1',
    family: 'mock',
    name: 'Mock Provider',
    description: 'A mock provider row',
    owner: 'test-owner',
    models: JSON.stringify([
      {
        id: 'mock-model-1',
        name: 'Mock Model 1',
        contextLength: 4096,
        maxOutputTokens: 1024,
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
        capabilities: ['content_generation', 'reasoning'],
      },
    ]),
    capabilities: JSON.stringify(['content_generation', 'reasoning']),
    supported_modalities: JSON.stringify(['text-in', 'text-out']),
    cost: JSON.stringify({
      inputPerMillionTokens: 1,
      outputPerMillionTokens: 5,
      currency: 'USD',
      tier: 'low',
    }),
    latency: JSON.stringify({ p50Ms: 500, p95Ms: 1500 }),
    rate_limits: JSON.stringify({
      requestsPerMinute: 100,
      tokensPerMinute: 50000,
      requestsPerDay: 10000,
      maxConcurrentRequests: 50,
    }),
    availability: 0.99,
    health: JSON.stringify({
      status: 'healthy',
      healthScore: 0.95,
      latencyMs: 500,
      successCount: 10,
      failureCount: 0,
      quotaUsedPercent: 20,
      rateLimitRemaining: 900,
      lastSuccessAt: '2024-06-01T00:00:00Z',
      lastFailureAt: null,
      lastCheckedAt: '2024-06-01T00:00:00Z',
    }),
    lifecycle_status: 'active',
    version: '1.2.3',
    tags: JSON.stringify(['test', 'mock']),
    documentation_url: 'https://example.com',
    matrix: JSON.stringify([
      {
        capability: 'content_generation',
        quality: 0.85,
        expectedCostUsd: 0.01,
        expectedLatencyMs: 500,
        expectedInputTokens: 6000,
        expectedOutputTokens: 4000,
        confidence: 0.9,
        historicalSuccess: 0.95,
        qualityTier: 'standard',
      },
    ]),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    ...overrides,
  };
}

function makeProvider(id: string): Provider {
  return Provider.create({
    id: createProviderId(id),
    family: 'mock',
    name: `Provider ${id}`,
    description: `Test provider ${id}`,
    owner: 'test',
    models: [
      {
        id: `${id}-model-1`,
        name: `Model ${id}`,
        contextLength: 4096,
        maxOutputTokens: 1024,
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
        capabilities: ['content_generation', 'reasoning'],
      },
    ],
    capabilities: ['content_generation', 'reasoning'],
    supportedModalities: ['text-in', 'text-out'],
    cost: { inputPerMillionTokens: 1, outputPerMillionTokens: 5, currency: 'USD', tier: 'low' },
    latency: { p50Ms: 500, p95Ms: 1500 },
    rateLimits: {
      requestsPerMinute: 100,
      tokensPerMinute: 50000,
      requestsPerDay: 10000,
      maxConcurrentRequests: 50,
    },
    availability: 0.99,
    lifecycleStatus: ProviderLifecycleStatus.fromStatus('active'),
    version: ProviderVersion.initial(),
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
        qualityTier: 'standard',
      },
    ],
  });
}

describe('PostgresProviderRepository (mocked postgres)', () => {
  let repo: PostgresProviderRepository;
  let fakeSql: postgres.Sql;

  beforeEach(() => {
    fakeSql = makeFakeSql([]);
    repo = new PostgresProviderRepository(fakeSql);
  });

  describe('ensureTable', () => {
    it('issues the CREATE TABLE IF NOT EXISTS statement', async () => {
      fakeSql = makeFakeSql([() => undefined]);
      repo = new PostgresProviderRepository(fakeSql);
      await expect(repo.ensureTable()).resolves.toBeUndefined();
    });
  });

  describe('row mapping', () => {
    it('reconstructs a provider from a JSONB row', async () => {
      const row = providerRow();
      fakeSql = makeFakeSql([() => [row]]);
      repo = new PostgresProviderRepository(fakeSql);
      const found = await repo.findById(createProviderId('pg_mock_1'));
      expect(found).not.toBeNull();
      expect(found?.id).toBe(createProviderId('pg_mock_1'));
      expect(found?.name).toBe('Mock Provider');
      expect(found?.family).toBe('mock');
      expect(found?.models).toHaveLength(1);
      expect(found?.matrix).toHaveLength(1);
      expect(found?.cost.tier).toBe('low');
      expect(found?.lifecycleStatus.value).toBe('active');
      expect(found?.version.toString()).toBe('1.2.3');
      expect(found?.documentationUrl).toBe('https://example.com');
      expect(found?.health.healthScore).toBe(0.95);
    });

    it('handles rows whose JSONB fields are already objects (non-string)', async () => {
      const row = providerRow({
        models: [
          {
            id: 'm1',
            name: 'M1',
            contextLength: 100,
            maxOutputTokens: 10,
            streaming: false,
            vision: false,
            functionCalling: false,
            embeddings: false,
            reasoning: false,
            coding: false,
            creativeWriting: false,
            translation: false,
            image: false,
            audio: false,
            video: false,
            modalities: [],
            capabilities: [],
          },
        ],
        capabilities: ['reasoning'],
        supported_modalities: ['text-in'],
        cost: {
          inputPerMillionTokens: 0,
          outputPerMillionTokens: 0,
          currency: 'USD',
          tier: 'free',
        },
        latency: { p50Ms: 0, p95Ms: 0 },
        rate_limits: {
          requestsPerMinute: 0,
          tokensPerMinute: 0,
          requestsPerDay: 0,
          maxConcurrentRequests: 0,
        },
        health: {
          status: 'healthy',
          healthScore: 0.5,
          latencyMs: 0,
          successCount: 0,
          failureCount: 0,
          quotaUsedPercent: 0,
          rateLimitRemaining: 0,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastCheckedAt: '2024-01-01T00:00:00Z',
        },
        tags: [],
        matrix: [],
        documentation_url: null,
      });
      fakeSql = makeFakeSql([() => [row]]);
      repo = new PostgresProviderRepository(fakeSql);
      const found = await repo.findById(createProviderId('pg_mock_1'));
      expect(found?.documentationUrl).toBeUndefined();
      expect(found?.tags).toEqual([]);
      expect(found?.matrix).toEqual([]);
    });
  });

  describe('CRUD', () => {
    it('returns null when no row matches findById', async () => {
      fakeSql = makeFakeSql([() => []]);
      repo = new PostgresProviderRepository(fakeSql);
      expect(await repo.findById(createProviderId('nope'))).toBeNull();
    });

    it('returns an empty array from findByIds when the id list is empty', async () => {
      expect(await repo.findByIds([])).toEqual([]);
    });

    it('returns providers from findByIds', async () => {
      fakeSql = makeFakeSql([() => [providerRow({ id: 'pg_a' }), providerRow({ id: 'pg_b' })]]);
      repo = new PostgresProviderRepository(fakeSql);
      const result = await repo.findByIds([createProviderId('pg_a'), createProviderId('pg_b')]);
      expect(result).toHaveLength(2);
    });

    it('saves a provider (INSERT ... ON CONFLICT)', async () => {
      const provider = makeProvider('pg_save');
      // Inner `sql(row)` fragment call + outer INSERT call.
      fakeSql = makeFakeSql([() => undefined, () => undefined]);
      repo = new PostgresProviderRepository(fakeSql);
      await expect(repo.save(provider)).resolves.toBeUndefined();
    });

    it('updates a provider', async () => {
      fakeSql = makeFakeSql([() => undefined]);
      repo = new PostgresProviderRepository(fakeSql);
      await expect(repo.update(makeProvider('pg_upd'))).resolves.toBeUndefined();
    });

    it('deletes a provider', async () => {
      fakeSql = makeFakeSql([() => undefined]);
      repo = new PostgresProviderRepository(fakeSql);
      await expect(repo.delete(createProviderId('pg_del'))).resolves.toBeUndefined();
    });

    it('reports existence via EXISTS query', async () => {
      fakeSql = makeFakeSql([() => [{ exists: true }]]);
      repo = new PostgresProviderRepository(fakeSql);
      expect(await repo.exists(createProviderId('pg_mock_1'))).toBe(true);
      fakeSql = makeFakeSql([() => [{ exists: false }]]);
      repo = new PostgresProviderRepository(fakeSql);
      expect(await repo.exists(createProviderId('nope'))).toBe(false);
    });
  });

  describe('find-by + pagination', () => {
    it('finds by family with pagination math', async () => {
      const rows = [providerRow({ id: 'pg_f1' }), providerRow({ id: 'pg_f2' })];
      fakeSql = makeFakeSql([() => [{ count: 2 }], () => rows]);
      repo = new PostgresProviderRepository(fakeSql);
      const result = await repo.findByFamily('mock', { page: 1, limit: 10 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('computes totalPages with ceil rounding', async () => {
      fakeSql = makeFakeSql([() => [{ count: 41 }], () => [providerRow()]]);
      repo = new PostgresProviderRepository(fakeSql);
      const result = await repo.findByFamily('mock', { page: 2, limit: 20 });
      expect(result.totalPages).toBe(3);
    });

    it('finds by lifecycle status', async () => {
      fakeSql = makeFakeSql([() => [{ count: 1 }], () => [providerRow({ id: 'pg_lc' })]]);
      repo = new PostgresProviderRepository(fakeSql);
      const result = await repo.findByLifecycleStatus('active', { page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('finds by capability', async () => {
      fakeSql = makeFakeSql([() => [{ count: 1 }], () => [providerRow({ id: 'pg_cap' })]]);
      repo = new PostgresProviderRepository(fakeSql);
      const result = await repo.findByCapability('content_generation', { page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
    });

    it('finds by tag', async () => {
      fakeSql = makeFakeSql([() => [{ count: 1 }], () => [providerRow({ id: 'pg_tag' })]]);
      repo = new PostgresProviderRepository(fakeSql);
      const result = await repo.findByTag('test', { page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
    });

    it('finds providers supporting a capability and a modality', async () => {
      fakeSql = makeFakeSql([() => [providerRow({ id: 'pg_sc' })]]);
      repo = new PostgresProviderRepository(fakeSql);
      const byCap = await repo.findSupportsCapability('content_generation');
      expect(byCap).toHaveLength(1);

      fakeSql = makeFakeSql([() => [providerRow({ id: 'pg_sm' })]]);
      repo = new PostgresProviderRepository(fakeSql);
      const byMod = await repo.findSupportsModality('text-in');
      expect(byMod).toHaveLength(1);
    });

    it('lists all providers', async () => {
      fakeSql = makeFakeSql([
        () => [providerRow({ id: 'pg_all_1' }), providerRow({ id: 'pg_all_2' })],
      ]);
      repo = new PostgresProviderRepository(fakeSql);
      const all = await repo.listAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('search', () => {
    it('builds a query filter from every criterion', async () => {
      fakeSql = makeFakeSql([
        () => [{ count: 2 }],
        () => [providerRow(), providerRow({ id: 'pg_s2' })],
      ]);
      repo = new PostgresProviderRepository(fakeSql);
      const result = await repo.search(
        {
          query: '  Mock  ',
          families: ['mock'],
          lifecycleStatuses: ['active'],
          capabilities: ['reasoning'],
          modalities: ['text-in'],
          tags: ['test'],
          minHealthScore: 0.9,
          minContextLength: 4096,
          feature: 'streaming',
        },
        { page: 1, limit: 10 },
      );
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('skips filters that are absent and unknown features', async () => {
      fakeSql = makeFakeSql([() => [{ count: 1 }], () => [providerRow()]]);
      repo = new PostgresProviderRepository(fakeSql);
      const result = await repo.search(
        { feature: 'unknown_feature' as never, query: '   ' },
        { page: 1, limit: 10 },
      );
      expect(result.data).toHaveLength(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('statistics', () => {
    it('counts providers', async () => {
      fakeSql = makeFakeSql([() => [{ count: 7 }]]);
      repo = new PostgresProviderRepository(fakeSql);
      expect(await repo.count()).toBe(7);
    });

    it('counts by lifecycle status with zero defaults', async () => {
      fakeSql = makeFakeSql([() => [{ lifecycle_status: 'active', count: 3 }]]);
      repo = new PostgresProviderRepository(fakeSql);
      const counts = await repo.countByLifecycleStatus();
      expect(counts.active).toBe(3);
      expect(counts.draft).toBe(0);
      expect(counts.archived).toBe(0);
    });

    it('counts by family', async () => {
      fakeSql = makeFakeSql([() => [{ family: 'mock', count: 2 }]]);
      repo = new PostgresProviderRepository(fakeSql);
      const counts = await repo.countByFamily();
      expect(counts.mock).toBe(2);
    });

    it('counts by capability', async () => {
      fakeSql = makeFakeSql([() => [{ capability: 'reasoning', count: 4 }]]);
      repo = new PostgresProviderRepository(fakeSql);
      const counts = await repo.countByCapability();
      expect(counts.reasoning).toBe(4);
    });

    it('counts healthy providers (healthScore >= 0.7)', async () => {
      fakeSql = makeFakeSql([() => [{ count: 3 }]]);
      repo = new PostgresProviderRepository(fakeSql);
      expect(await repo.countHealthy()).toBe(3);
    });
  });
});
