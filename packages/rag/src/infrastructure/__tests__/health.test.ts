// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: RAG Health & Readiness Checks
// Verifies the health/readiness probes without a live database.
// AI-RUNTIME-002 C-01.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { checkRagHealth, isRagReady, probeRagSchema } from '../health.js';
import { InMemoryRagRepository } from '../InMemoryRagRepository.js';

function makeFakeSql(results: Array<() => unknown>): postgres.Sql {
  let idx = 0;
  const next = (): Promise<unknown> => {
    const r = results[idx]();
    idx += 1;
    return Promise.resolve(r);
  };
  const sql = vi.fn(() => next()) as unknown as postgres.Sql;
  sql.unsafe = vi.fn(() => next());
  return sql;
}

describe('probeRagSchema', () => {
  it('returns true when the table and vector column exist', async () => {
    const sql = makeFakeSql([() => [{ ok: 1 }], () => [{ data_type: 'vector' }]]);
    await expect(probeRagSchema(sql, 1536)).resolves.toBe(true);
  });

  it('returns false when the table is missing', async () => {
    const sql = makeFakeSql([() => []]);
    await expect(probeRagSchema(sql, 1536)).resolves.toBe(false);
  });

  it('returns false when the embedding column is not a vector', async () => {
    const sql = makeFakeSql([() => [{ ok: 1 }], () => [{ data_type: 'text' }]]);
    await expect(probeRagSchema(sql, 1536)).resolves.toBe(false);
  });

  it('returns false when the probe throws (database unreachable)', async () => {
    const sql = makeFakeSql([
      () => {
        throw new Error('connection refused');
      },
    ]);
    await expect(probeRagSchema(sql, 1536)).resolves.toBe(false);
  });
});

describe('checkRagHealth', () => {
  it('reports healthy when the repository is reachable and embedding is configured', async () => {
    const repo = new InMemoryRagRepository();
    const health = await checkRagHealth({
      repository: repo,
      embeddingConfigured: true,
      productionRepository: true,
    });
    expect(health.status).toBe('healthy');
    expect(health.vectorStoreReady).toBe(true);
    expect(health.embeddingConfigured).toBe(true);
  });

  it('reports unhealthy in production when the repository is unreachable', async () => {
    const repo = {
      getStats: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as InMemoryRagRepository;
    const health = await checkRagHealth({
      repository: repo,
      embeddingConfigured: true,
      productionRepository: true,
    });
    expect(health.status).toBe('unhealthy');
    expect(health.error).toBe('vector_store_unavailable');
  });

  it('reports degraded (not unhealthy) for an unreachable in-memory fallback', async () => {
    const repo = {
      getStats: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as InMemoryRagRepository;
    const health = await checkRagHealth({
      repository: repo,
      embeddingConfigured: true,
      productionRepository: false,
    });
    expect(health.status).toBe('degraded');
  });

  it('reports unhealthy in production when the embedding provider is the mock', async () => {
    const repo = new InMemoryRagRepository();
    const health = await checkRagHealth({
      repository: repo,
      embeddingConfigured: false,
      productionRepository: true,
    });
    expect(health.status).toBe('unhealthy');
    expect(health.error).toBe('embedding_provider_missing');
  });

  it('reports healthy for a non-production in-memory fallback with mock embeddings', async () => {
    const repo = new InMemoryRagRepository();
    const health = await checkRagHealth({
      repository: repo,
      embeddingConfigured: false,
      productionRepository: false,
    });
    expect(health.status).toBe('healthy');
  });

  it('reports unhealthy when the schema probe fails in production', async () => {
    const repo = new InMemoryRagRepository();
    const sql = makeFakeSql([() => []]);
    const health = await checkRagHealth({
      repository: repo,
      embeddingConfigured: true,
      productionRepository: true,
      sql,
    });
    expect(health.status).toBe('unhealthy');
    expect(health.error).toBe('vector_store_unavailable');
  });
});

describe('isRagReady', () => {
  it('returns true only when the health status is healthy', async () => {
    const repo = new InMemoryRagRepository();
    await expect(
      isRagReady({
        repository: repo,
        embeddingConfigured: true,
        productionRepository: true,
      }),
    ).resolves.toBe(true);

    await expect(
      isRagReady({
        repository: repo,
        embeddingConfigured: false,
        productionRepository: true,
      }),
    ).resolves.toBe(false);
  });
});
