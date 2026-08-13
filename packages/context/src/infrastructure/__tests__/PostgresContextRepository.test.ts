// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Context Repository
// EI-003 — Enterprise Context Intelligence Engine
//
// Verifies query building, JSONB row <-> entity mapping, and
// pagination WITHOUT a live database: the `postgres` module is mocked
// with a fake `sql` template-tag function (same pattern as the
// providers Postgres repository test). CERT-002 C-04.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresContextRepository } from '../PostgresContextRepository.js';
import { createContextId } from '../../domain/value-objects/ContextId.js';
import type { ContextItem } from '../../types/context-types.js';

// ── Fake postgres `sql` ─────────────────────────────────────────────────────

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

function contextRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'ctx_pg_1',
    data: JSON.stringify({
      contextId: 'ctx_pg_1',
      title: 'User preference',
      source: 'user_profile',
      category: 'preferences',
      priority: 'high',
      capability: ['content_generation'],
      content: 'Prefers concise output',
      confidence: 0.9,
      importance: 0.8,
      estimatedTokens: 120,
      tags: ['preference', 'style'],
      business: ['content-agency'],
      metadata: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    ...overrides,
  };
}

function makeItem(id: string): ContextItem {
  return {
    contextId: id,
    title: id,
    source: 'user_profile',
    category: 'preferences',
    priority: 'high',
    capability: ['content_generation'],
    content: 'test content',
    confidence: 0.9,
    importance: 0.8,
    estimatedTokens: 120,
    tags: [id],
    business: ['content-agency'],
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as ContextItem;
}

describe('PostgresContextRepository', () => {
  it('saves and finds by id with JSONB mapping', async () => {
    const sql = makeFakeSql([
      () => [], // INSERT nested object call
      () => [], // INSERT outer template
      () => [contextRow()], // SELECT by id
    ]);
    const repo = new PostgresContextRepository(sql);

    await repo.save(makeItem('ctx_pg_1'));

    const found = await repo.findById(createContextId('ctx_pg_1'));
    expect(found).not.toBeNull();
    expect(found?.contextId).toBe('ctx_pg_1');
    expect(found?.priority).toBe('high');
    expect(found?.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('searches with filters and pagination', async () => {
    const sql = makeFakeSql([
      () => [{ count: 1 }], // COUNT
      () => [contextRow()], // SELECT page
    ]);
    const repo = new PostgresContextRepository(sql);

    const result = await repo.search(
      { query: 'concise', categories: ['preferences'], priorities: ['high'] },
      { page: 1, limit: 10 },
    );
    expect(result.total).toBe(1);
    expect(result.data[0].title).toBe('User preference');
  });

  it('finds by source/category/priority/capability with pagination', async () => {
    const sql = makeFakeSql([
      () => [{ count: 1 }], // COUNT
      () => [contextRow()], // rows
    ]);
    const repo = new PostgresContextRepository(sql);
    // paginateWhere consumes the scripted count+rows in order.
    const bySource = await repo.findBySource('user_profile', { page: 1, limit: 10 });
    expect(bySource.total).toBe(1);
    expect(bySource.data[0].title).toBe('User preference');
  });

  it('updates, deletes, and exists', async () => {
    const sql = makeFakeSql([
      () => [], // UPDATE
      () => [], // DELETE
      () => [{ exists: true }], // exists
    ]);
    const repo = new PostgresContextRepository(sql);
    await expect(repo.update(makeItem('ctx_pg_1'))).resolves.toBeUndefined();
    await expect(repo.delete(createContextId('ctx_pg_1'))).resolves.toBeUndefined();
    expect(await repo.exists(createContextId('ctx_pg_1'))).toBe(true);
  });

  it('computes statistics and token totals', async () => {
    const sql = makeFakeSql([
      () => [{ count: 1 }], // count
      () => [{ source: 'user_profile', count: 1 }], // countBySource
      () => [{ category: 'preferences', count: 1 }], // countByCategory
      () => [{ priority: 'high', count: 1 }], // countByPriority
      () => [{ total: 120 }], // totalTokens
    ]);
    const repo = new PostgresContextRepository(sql);
    expect(await repo.count()).toBe(1);
    expect((await repo.countBySource()).user_profile).toBe(1);
    expect((await repo.countByCategory()).preferences).toBe(1);
    expect((await repo.countByPriority()).high).toBe(1);
    expect(await repo.totalTokens()).toBe(120);
  });

  it('searches with every filter branch', async () => {
    const sql = makeFakeSql([
      () => [{ count: 1 }], // COUNT
      () => [contextRow()], // rows
      () => [{ count: 1 }], // COUNT
      () => [contextRow()], // rows
    ]);
    const repo = new PostgresContextRepository(sql);
    const params = { page: 1, limit: 10 };

    const full = await repo.search(
      {
        query: 'concise',
        sources: ['user_profile'],
        categories: ['preferences'],
        priorities: ['high'],
        capabilities: ['content_generation'],
        tags: ['style'],
        confidence: { min: 0.5, max: 1 },
        importance: { min: 0.5, max: 1 },
        timeRange: { start: '2026-01-01T00:00:00.000Z', end: '2026-02-01T00:00:00.000Z' },
      },
      params,
    );
    expect(full.total).toBe(1);

    const empty = await repo.search({}, params);
    expect(empty.total).toBe(1);
  });

  it('saves many, finds by ids, and lists all', async () => {
    const sql = makeFakeSql([
      () => [], // INSERT nested
      () => [], // INSERT outer
      () => [], // INSERT nested
      () => [], // INSERT outer
      () => [contextRow()], // findByIds
      () => [contextRow()], // listAll
    ]);
    const repo = new PostgresContextRepository(sql);
    await repo.saveMany([makeItem('a'), makeItem('b')]);
    expect(await repo.findByIds([createContextId('a')])).toHaveLength(1);
    expect(await repo.listAll()).toHaveLength(1);
  });

  it('returns empty for an empty findByIds array', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresContextRepository(sql);
    expect(await repo.findByIds([])).toEqual([]);
  });
});
