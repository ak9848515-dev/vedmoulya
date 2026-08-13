// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Enterprise Knowledge Repository
// EI-009 — Enterprise Knowledge Intelligence Platform
//
// Verifies query building, JSONB row <-> entity mapping, and
// pagination WITHOUT a live database: the `postgres` module is mocked
// with a fake `sql` template-tag function (same pattern as the other
// EI Postgres repository tests).
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresKnowledgeRepository } from '../PostgresKnowledgeRepository.js';
import {
  createCatalogKnowledgeItems,
  createCatalogKnowledgeRelationships,
} from '../../catalog/knowledge-catalog.js';

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
    createCatalogKnowledgeItems().find((i) => i.knowledgeId === 'kn_openai_provider_profile') ??
    createCatalogKnowledgeItems()[0];
  return { id: item.knowledgeId, data: JSON.stringify(item) };
}

function relationshipRow(): Record<string, unknown> {
  const edge = createCatalogKnowledgeRelationships()[0];
  return { id: edge.relationshipId, data: JSON.stringify(edge) };
}

describe('PostgresKnowledgeRepository', () => {
  it('creates the knowledge_registry table + indexes idempotently', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresKnowledgeRepository(sql);
    await repo.ensureTable();
    await repo.ensureTable();
    expect(sql).toHaveBeenCalled();
  });

  it('saves items and relationships as JSONB documents', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresKnowledgeRepository(sql);
    const items = createCatalogKnowledgeItems();
    await repo.saveItem(items[0]!);
    for (const edge of createCatalogKnowledgeRelationships().slice(0, 2)) {
      await repo.saveRelationship(edge);
    }
    expect(sql).toHaveBeenCalled();
  });

  it('finds an item by id and maps the JSONB row', async () => {
    const sql = makeFakeSql([() => [itemRow()]]);
    const repo = new PostgresKnowledgeRepository(sql);
    const item = await repo.findItemById('kn_openai_provider_profile');
    expect(item?.category).toBe('ai');
    expect(item?.trust.score).toBeGreaterThan(0);
    expect(item?.version).toBeGreaterThanOrEqual(1);
  });

  it('returns null when an item is missing', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresKnowledgeRepository(sql);
    expect(await repo.findItemById('missing')).toBeNull();
  });

  it('lists items with filters and pagination', async () => {
    const sql = makeFakeSql([() => [{ count: 2 }], () => [itemRow()]]);
    const repo = new PostgresKnowledgeRepository(sql);
    const result = await repo.listItems({ category: 'ai', minTrust: 0.8 }, { page: 1, limit: 10 });
    expect(result.total).toBe(2);
    expect(result.data[0]?.knowledgeId).toBe('kn_openai_provider_profile');
    expect(result.totalPages).toBe(1);
  });

  it('lists all items in updatedAt desc order', async () => {
    const sql = makeFakeSql([() => [itemRow()]]);
    const repo = new PostgresKnowledgeRepository(sql);
    expect(await repo.listAllItems()).toHaveLength(1);
  });

  it('lists items by category', async () => {
    const sql = makeFakeSql([() => [itemRow()]]);
    const repo = new PostgresKnowledgeRepository(sql);
    const items = await repo.listItemsByCategory('ai');
    expect(items).toHaveLength(1);
  });

  it('counts items', async () => {
    const sql = makeFakeSql([() => [{ count: 24 }]]);
    const repo = new PostgresKnowledgeRepository(sql);
    expect(await repo.countItems()).toBe(24);
  });

  it('deletes items and their referencing edges', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresKnowledgeRepository(sql);
    await repo.deleteItem('kn_blog_pipeline_playbook');
    expect(sql).toHaveBeenCalled();
  });

  it('finds a relationship by id and maps the JSONB row', async () => {
    const sql = makeFakeSql([() => [relationshipRow()]]);
    const repo = new PostgresKnowledgeRepository(sql);
    const edge = await repo.findRelationshipById('rel_seed_x');
    expect(edge?.type).toBe(createCatalogKnowledgeRelationships()[0]?.type);
  });

  it('lists relationships with and without a type scope', async () => {
    const sql = makeFakeSql([() => [relationshipRow()]]);
    const repo = new PostgresKnowledgeRepository(sql);
    expect(await repo.listRelationships()).toHaveLength(1);
    const sql2 = makeFakeSql([() => [relationshipRow()]]);
    const repo2 = new PostgresKnowledgeRepository(sql2);
    expect(await repo2.listRelationships('depends_on')).toHaveLength(1);
  });

  it('lists relationships for an item and deletes them', async () => {
    const sql = makeFakeSql([() => [relationshipRow()]]);
    const repo = new PostgresKnowledgeRepository(sql);
    expect(await repo.listRelationshipsForItem('kn_blog_pipeline_playbook')).toHaveLength(1);
    await repo.deleteRelationship('rel_seed_x');
    expect(sql).toHaveBeenCalled();
  });

  it('counts relationships', async () => {
    const sql = makeFakeSql([() => [{ count: 26 }]]);
    const repo = new PostgresKnowledgeRepository(sql);
    expect(await repo.countRelationships()).toBe(26);
  });
});
