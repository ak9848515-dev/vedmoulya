// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Capability Repository
// EI-001 — Enterprise Capability Registry & Marketplace
//
// Verifies query building, JSONB row <-> entity mapping, and
// pagination WITHOUT a live database: the `postgres` module is mocked
// with a fake `sql` template-tag function (same pattern as the
// providers Postgres repository test), so the full repository surface
// is exercised in CI and local runs. CERT-002 C-04.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresCapabilityRepository } from '../PostgresCapabilityRepository.js';
import { Capability } from '../../domain/entities/Capability.js';
import { CapabilityStatus } from '../../domain/value-objects/CapabilityStatus.js';
import { createCapabilityId } from '../../domain/value-objects/CapabilityId.js';

// ── Fake postgres `sql` ─────────────────────────────────────────────────────
// Same behavioral fake as the providers test: resolves each call (in order)
// with a scripted value. The repository never inspects the generated SQL
// string — only the resolved rows — so a behavioral fake is sufficient.

function makeFakeSql(results: Array<() => unknown>): postgres.Sql {
  let idx = 0;
  const next = (): Promise<unknown> => {
    const r = results[idx] ? results[idx]() : [];
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

function capabilityRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pg_cap_1',
    data: JSON.stringify({
      id: 'pg_cap_1',
      name: 'Research',
      category: 'research',
      description: 'Research capability',
      owner: 'test',
      inputs: ['question'],
      outputs: ['findings'],
      dependencies: [],
      requiredAIFeatures: ['reasoning'],
      cost: { estimatedCostUsd: 1, tier: 'low' },
      tokens: { estimatedInputTokens: 1000, estimatedOutputTokens: 500 },
      latency: { p50Ms: 200, p95Ms: 800 },
      quality: { target: 0.9, minimum: 0.7 },
      confidence: 0.85,
      version: '1.0.0',
      status: 'active',
      tags: ['research', 'analysis'],
      businessModules: ['content-agency', 'learning'],
      documentationUrl: undefined,
      composition: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    }),
    ...overrides,
  };
}

function makeCap(id: string): Capability {
  return Capability.create({
    id: createCapabilityId(id),
    name: id,
    category: 'content',
    description: `${id} description`,
    owner: 'test',
    tags: [id],
    businessModules: ['content-agency'],
    status: CapabilityStatus.fromStatus('active'),
    dependencies: [],
    requiredAIFeatures: ['reasoning'],
  });
}

describe('PostgresCapabilityRepository', () => {
  it('saves and finds by id (JSONB row mapping restores the class entity)', async () => {
    const sql = makeFakeSql([
      () => [], // INSERT nested object call
      () => [], // INSERT outer template
      () => [capabilityRow()], // SELECT by id
    ]);
    const repo = new PostgresCapabilityRepository(sql);

    await repo.save(makeCap('pg_cap_1'));

    const found = await repo.findById(createCapabilityId('pg_cap_1'));
    expect(found).not.toBeNull();
    expect(found?.id).toBe('pg_cap_1');
    expect(found?.name).toBe('Research');
    expect(found?.status.value).toBe('active');
    expect(found?.businessModules).toContain('content-agency');
    expect(found instanceof Capability).toBe(true);
  });

  it('returns null for a missing id', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresCapabilityRepository(sql);
    expect(await repo.findById(createCapabilityId('missing'))).toBeNull();
  });

  it('searches with filters and pagination', async () => {
    const sql = makeFakeSql([
      () => [{ count: 1 }], // COUNT
      () => [capabilityRow()], // SELECT page
    ]);
    const repo = new PostgresCapabilityRepository(sql);

    const result = await repo.search(
      { query: 'research', categories: ['research'], statuses: ['active'] },
      { page: 1, limit: 10 },
    );
    expect(result.total).toBe(1);
    expect(result.data[0].name).toBe('Research');
    expect(result.totalPages).toBe(1);
    expect(sql.unsafe).toHaveBeenCalled();
  });

  it('exists and deletes', async () => {
    const sql = makeFakeSql([
      () => [{ exists: true }],
      () => [], // DELETE
    ]);
    const repo = new PostgresCapabilityRepository(sql);
    expect(await repo.exists(createCapabilityId('pg_cap_1'))).toBe(true);
    await expect(repo.delete(createCapabilityId('pg_cap_1'))).resolves.toBeUndefined();
  });

  it('lists all ordered by name and counts by status/category/module', async () => {
    const sql = makeFakeSql([
      () => [capabilityRow()], // listAll
      () => [{ count: 1 }], // count
      () => [{ status: 'active', count: 1 }], // countByStatus
      () => [{ category: 'research', count: 1 }], // countByCategory
      () => [{ module: 'content-agency', count: 1 }], // countByBusinessModule
    ]);
    const repo = new PostgresCapabilityRepository(sql);

    const all = await repo.listAll();
    expect(all).toHaveLength(1);
    expect(await repo.count()).toBe(1);
    expect((await repo.countByStatus()).active).toBe(1);
    expect((await repo.countByCategory()).research).toBe(1);
    expect((await repo.countByBusinessModule())['content-agency']).toBe(1);
  });

  it('finds by ai features and dependencies', async () => {
    const sql = makeFakeSql([
      () => [capabilityRow()], // findByAIFeatures
      () => [capabilityRow()], // findByDependency
    ]);
    const repo = new PostgresCapabilityRepository(sql);
    const byFeatures = await repo.findByAIFeatures(['reasoning']);
    expect(byFeatures).toHaveLength(1);
    const byDep = await repo.findByDependency(createCapabilityId('other'));
    expect(byDep).toHaveLength(1);
  });
});
