// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Enterprise Memory Repository
// EI-010 — Enterprise Memory Intelligence Platform
//
// Verifies query building, JSONB row <-> entity mapping, and
// pagination WITHOUT a live database: the `postgres` module is mocked
// with a fake `sql` template-tag function (same pattern as the other
// EI Postgres repository tests).
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresMemoryRepository } from '../PostgresMemoryRepository.js';
import { PostgresMemoryGraph } from '../PostgresMemoryGraph.js';
import {
  createCatalogMemoryItems,
  createCatalogMemoryRelationships,
} from '../../catalog/memory-catalog.js';

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

function itemRow(): Record<string, unknown> {
  const item =
    createCatalogMemoryItems().find((i) => i.memoryId === 'mem_openai_reliability') ??
    createCatalogMemoryItems()[0];
  return { id: item.memoryId, data: JSON.stringify(item) };
}

function relationshipRow(): Record<string, unknown> {
  const edge = createCatalogMemoryRelationships()[0];
  return { id: edge.relationshipId, data: JSON.stringify(edge) };
}

describe('PostgresMemoryRepository', () => {
  it('creates the memory_registry table + indexes idempotently', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresMemoryRepository(sql);
    await repo.ensureTable();
    await repo.ensureTable();
    expect(sql).toHaveBeenCalled();
  });

  it('saves items and relationships as JSONB documents', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresMemoryRepository(sql);
    const items = createCatalogMemoryItems();
    await repo.saveItem(items[0]!);
    for (const edge of createCatalogMemoryRelationships().slice(0, 2)) {
      await repo.saveRelationship(edge);
    }
    expect(sql).toHaveBeenCalled();
  });

  it('finds an item by id and maps the JSONB row', async () => {
    const sql = makeFakeSql([() => [itemRow()]]);
    const repo = new PostgresMemoryRepository(sql);
    const item = await repo.findItemById('mem_openai_reliability');
    expect(item?.type).toBe('provider');
    expect(item?.importance.score).toBeGreaterThan(0);
    expect(item?.lifecycleStatus).toBe('active');
  });

  it('returns null when an item is missing', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresMemoryRepository(sql);
    expect(await repo.findItemById('missing')).toBeNull();
  });

  it('lists items with filters and pagination', async () => {
    const sql = makeFakeSql([() => [{ count: 2 }], () => [itemRow()]]);
    const repo = new PostgresMemoryRepository(sql);
    const result = await repo.listItems(
      { type: 'provider', minImportance: 0.7 },
      { page: 1, limit: 10 },
    );
    expect(result.total).toBe(2);
    expect(result.data[0]?.memoryId).toBe('mem_openai_reliability');
    expect(result.totalPages).toBe(1);
  });

  it('lists all items in updatedAt desc order', async () => {
    const sql = makeFakeSql([() => [itemRow()]]);
    const repo = new PostgresMemoryRepository(sql);
    expect(await repo.listAllItems()).toHaveLength(1);
  });

  it('lists items by type', async () => {
    const sql = makeFakeSql([() => [itemRow()]]);
    const repo = new PostgresMemoryRepository(sql);
    const items = await repo.listItemsByType('provider');
    expect(items).toHaveLength(1);
  });

  it('counts items', async () => {
    const sql = makeFakeSql([() => [{ count: 28 }]]);
    const repo = new PostgresMemoryRepository(sql);
    expect(await repo.countItems()).toBe(28);
  });

  it('deletes items and their referencing edges', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresMemoryRepository(sql);
    await repo.deleteItem('mem_blog_pipeline_playbook');
    expect(sql).toHaveBeenCalled();
  });

  it('finds a relationship by id and maps the JSONB row', async () => {
    const sql = makeFakeSql([() => [relationshipRow()]]);
    const repo = new PostgresMemoryRepository(sql);
    const edge = await repo.findRelationshipById('mrel_seed_x');
    expect(edge?.type).toBe(createCatalogMemoryRelationships()[0]?.type);
  });

  it('lists relationships with and without a type scope', async () => {
    const sql = makeFakeSql([() => [relationshipRow()]]);
    const repo = new PostgresMemoryRepository(sql);
    expect(await repo.listRelationships()).toHaveLength(1);
    const sql2 = makeFakeSql([() => [relationshipRow()]]);
    const repo2 = new PostgresMemoryRepository(sql2);
    expect(await repo2.listRelationships('recalls')).toHaveLength(1);
  });

  it('lists relationships for an item and deletes them', async () => {
    const sql = makeFakeSql([() => [relationshipRow()]]);
    const repo = new PostgresMemoryRepository(sql);
    expect(await repo.listRelationshipsForItem('mem_blog_pipeline_playbook')).toHaveLength(1);
    await repo.deleteRelationship('mrel_seed_x');
    expect(sql).toHaveBeenCalled();
  });

  it('counts relationships', async () => {
    const sql = makeFakeSql([() => [{ count: 22 }]]);
    const repo = new PostgresMemoryRepository(sql);
    expect(await repo.countRelationships()).toBe(22);
  });
});

describe('PostgresMemoryGraph', () => {
  it('extends the in-memory traversal logic', () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresMemoryRepository(sql);
    const graph = new PostgresMemoryGraph(repo);
    expect(graph).toBeInstanceOf(PostgresMemoryGraph);
  });
});
