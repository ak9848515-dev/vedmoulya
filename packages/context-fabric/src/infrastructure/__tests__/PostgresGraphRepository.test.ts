// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Postgres tests
// APP-001 — Post-V1 Application Platform Layer
// The Postgres repository is exercised against a fake SQL client that
// records the tagged-template calls and returns canned rows — the
// same hermetic approach the other EI Postgres repository suites use,
// so the migration statements and JSONB round-trips are covered
// without a live database.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import type postgres from 'postgres';
import { PostgresGraphRepository } from '../PostgresGraphRepository.js';
import {
  createCatalogFabricEntities,
  createCatalogFabricRelationships,
} from '../../catalog/fabric-catalog.js';

interface RecordedCall {
  strings: readonly string[];
  values: unknown[];
}

/** A callable fake that acts as a tagged-template sql client. */
function fakeSql(rows: unknown[]): { sql: ReturnType<typeof postgres>; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings: [...strings], values });
    return Promise.resolve(rows);
  }) as unknown as ReturnType<typeof postgres>;
  // The repo binds JSON documents via sql.json() — the fake returns the raw
  // value (the real driver wraps it in a Parameter for OID 3802).
  tag.json = (value: unknown): unknown => value;
  return { sql: tag, calls };
}

/** A fake that also supports unsafe() (used by listEntities). */
function fakeSqlUnsafe(rows: unknown[]): {
  sql: ReturnType<typeof postgres>;
  calls: RecordedCall[];
  unsafeCalls: Array<{ query: string; params: unknown[] }>;
} {
  const calls: RecordedCall[] = [];
  const unsafeCalls: Array<{ query: string; params: unknown[] }> = [];
  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings: [...strings], values });
    return Promise.resolve(rows);
  }) as unknown as ReturnType<typeof postgres>;
  (tag as { unsafe?: unknown }).unsafe = (
    query: string,
    params: unknown[] = [],
  ): Promise<unknown[]> => {
    unsafeCalls.push({ query, params });
    return Promise.resolve(rows);
  };
  return { sql: tag, calls, unsafeCalls };
}

const entity = createCatalogFabricEntities()[0]!;
const relationship = createCatalogFabricRelationships()[0]!;

describe('PostgresGraphRepository', () => {
  it('creates the migration-ready context_fabric_registry table + indexes', async () => {
    const { sql, calls } = fakeSql([]);
    const repo = new PostgresGraphRepository(sql);
    await repo.ensureTable();
    const statement = calls.map((c) => c.strings.join('?')).join(' ');
    expect(statement).toContain('CREATE TABLE IF NOT EXISTS context_fabric_registry');
    expect(statement).toContain('PRIMARY KEY (collection, id)');
    expect(statement).toContain('CREATE INDEX IF NOT EXISTS context_fabric_registry_graph_idx');
    expect(statement).toContain('CREATE INDEX IF NOT EXISTS context_fabric_registry_org_idx');
  });

  it('upserts an entity into the entity collection', async () => {
    const { sql, calls } = fakeSql([]);
    const repo = new PostgresGraphRepository(sql);
    await repo.saveEntity(entity);
    const statement = calls[0]!.strings.join('?');
    expect(statement).toContain('INSERT INTO context_fabric_registry');
    expect(statement).toContain('ON CONFLICT (collection, id) DO UPDATE');
    const values = calls[0]!.values;
    expect(values[0]).toBe('entity');
    expect(values[1]).toBe(entity.entityId);
    // The document binds via sql.json() — the RAW object is the bound value.
    expect(values[2]).toMatchObject({ graph: entity.graph });
  });

  it('upserts a relationship into the relationship collection', async () => {
    const { sql, calls } = fakeSql([]);
    const repo = new PostgresGraphRepository(sql);
    await repo.saveRelationship(relationship);
    expect(calls[0]!.values[0]).toBe('relationship');
    // The document binds via sql.json() — the RAW object is the bound value.
    expect(calls[0]!.values[2]).toMatchObject({ type: relationship.type });
  });

  it('deletes an entity and its edges', async () => {
    const { sql, calls } = fakeSql([]);
    const repo = new PostgresGraphRepository(sql);
    await repo.deleteEntity(entity.entityId);
    const statements = calls.map((c) => c.strings.join('?')).join(' ');
    expect(statements).toContain('DELETE FROM context_fabric_registry');
    expect(statements).toContain("(data->>'fromId')");
    expect(statements).toContain('OR');
  });

  it('retrieves an entity by id (parsed object)', async () => {
    const { sql } = fakeSql([{ id: entity.entityId, data: entity }]);
    const repo = new PostgresGraphRepository(sql);
    const found = await repo.getEntity(entity.entityId);
    expect(found?.entityId).toBe(entity.entityId);
  });

  it('retrieves an entity by id (string JSONB)', async () => {
    const { sql } = fakeSql([{ id: entity.entityId, data: JSON.stringify(entity) }]);
    const repo = new PostgresGraphRepository(sql);
    const found = await repo.getEntity(entity.entityId);
    expect(found?.graph).toBe(entity.graph);
  });

  it('returns undefined when the entity row is missing', async () => {
    const { sql } = fakeSql([]);
    const repo = new PostgresGraphRepository(sql);
    expect(await repo.getEntity('missing')).toBeUndefined();
  });

  it('lists entities with filters via unsafe SQL', async () => {
    const { sql, unsafeCalls } = fakeSqlUnsafe([{ id: entity.entityId, data: entity }]);
    const repo = new PostgresGraphRepository(sql);
    const rows = await repo.listEntities({ graph: 'personal', organizationId: 'org_x' });
    expect(rows).toHaveLength(1);
    expect(unsafeCalls[0]!.query).toContain("data->>'graph'");
    expect(unsafeCalls[0]!.query).toContain("data->>'organizationId'");
    expect(unsafeCalls[0]!.params).toContain('personal');
  });

  it('lists entities with no filters', async () => {
    const { sql } = fakeSqlUnsafe([{ id: entity.entityId, data: entity }]);
    const repo = new PostgresGraphRepository(sql);
    const rows = await repo.listEntities();
    expect(rows).toHaveLength(1);
  });

  it('lists all relationships', async () => {
    const { sql } = fakeSql([{ id: relationship.relationshipId, data: relationship }]);
    const repo = new PostgresGraphRepository(sql);
    const rows = await repo.listRelationships();
    expect(rows[0]?.relationshipId).toBe(relationship.relationshipId);
  });

  it('finds neighbors via the relationship edges', async () => {
    const { sql } = fakeSql([{ id: relationship.relationshipId, data: relationship }]);
    const repo = new PostgresGraphRepository(sql);
    const rows = await repo.neighbors(entity.entityId);
    expect(rows).toHaveLength(1);
  });

  it('computes a shortest path between connected entities', async () => {
    // a = user, b = goal2, mid = u_owns_g2 (user → goal2).
    const a = createCatalogFabricEntities()[0]!;
    const b = createCatalogFabricEntities()[2]!;
    const mid = createCatalogFabricRelationships()[1]!;
    const queue: unknown[][] = [[{ id: mid.relationshipId, data: mid }]];
    const calls: RecordedCall[] = [];
    const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ strings: [...strings], values });
      return Promise.resolve(queue.shift() ?? []);
    }) as unknown as ReturnType<typeof postgres>;
    const repo = new PostgresGraphRepository(tag);
    const path = await repo.shortestPath(a.entityId, b.entityId);
    expect(path).toHaveLength(1);
  });

  it('returns an empty path when no route exists', async () => {
    const calls: RecordedCall[] = [];
    const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ strings: [...strings], values });
      return Promise.resolve([]);
    }) as unknown as ReturnType<typeof postgres>;
    const repo = new PostgresGraphRepository(tag);
    expect(await repo.shortestPath('a', 'b')).toHaveLength(0);
  });

  it('counts entities and relationships', async () => {
    const { sql } = fakeSql([{ count: '25' }]);
    const repo = new PostgresGraphRepository(sql);
    expect(await repo.countEntities()).toBe(25);
    expect(await repo.countRelationships()).toBe(25);
  });

  it('returns zero when the count row is missing', async () => {
    const { sql } = fakeSql([]);
    const repo = new PostgresGraphRepository(sql);
    expect(await repo.countEntities()).toBe(0);
  });
});
