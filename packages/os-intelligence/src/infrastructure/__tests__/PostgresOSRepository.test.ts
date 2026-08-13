// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Postgres Repository tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The Postgres repository is exercised against a fake SQL client that
// records the tagged-template calls and returns canned rows — the
// same hermetic approach the other EI Postgres repository suites use,
// so the migration statements and JSONB round-trips are covered
// without a live database.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresOSRepository } from '../PostgresOSRepository.js';
import { createCatalogOSSnapshot } from '../../catalog/os-catalog.js';
import type { OSHealthSnapshot } from '../../types/os-types.js';

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

describe('PostgresOSRepository', () => {
  it('creates the migration-ready os_health_registry table', async () => {
    const { sql, calls } = fakeSql([]);
    const repo = new PostgresOSRepository(sql);
    await repo.ensureTable();
    const statement = calls.map((c) => c.strings.join('?')).join(' ');
    expect(statement).toContain('CREATE TABLE IF NOT EXISTS os_health_registry');
    expect(statement).toContain('PRIMARY KEY (collection, id)');
    expect(statement).toContain('CREATE INDEX IF NOT EXISTS os_health_registry_checked_idx');
  });

  it('upserts a snapshot into the registry', async () => {
    const { sql, calls } = fakeSql([]);
    const repo = new PostgresOSRepository(sql);
    await repo.saveSnapshot(createCatalogOSSnapshot());
    const statement = calls[0]!.strings.join('?');
    expect(statement).toContain('INSERT INTO os_health_registry');
    expect(statement).toContain('ON CONFLICT (collection, id) DO UPDATE');
    const values = calls[0]!.values;
    expect(values[0]).toBe('snapshot');
    expect(values[1]).toBe('snapshot_os_seed_20260806');
    // The document binds via sql.json() — the RAW object is the bound value.
    expect(values[2]).toMatchObject({ overallScore: 96, engineCount: 11 });
  });

  it('lists snapshots newest-first with an optional limit', async () => {
    const row = {
      id: 'snapshot_os_seed_20260806',
      data: JSON.stringify(createCatalogOSSnapshot()),
    };
    const { sql, calls } = fakeSql([row]);
    const repo = new PostgresOSRepository(sql);
    const snapshots = await repo.listSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.overallScore).toBe(96);
    // JS evaluates template interpolations before invoking the outer tag, so
    // the outer query lands at calls[1] (calls[0] is the nested empty LIMIT).
    const outer = calls[1]!.strings.join('?');
    expect(outer).toContain("ORDER BY (data->>'checkedAt') DESC");

    await repo.listSnapshots(5);
    const limitCall = calls[2]!;
    expect(limitCall.strings.join('?')).toContain('LIMIT');
    expect(limitCall.values).toContain(5);
  });

  it('handles rows that are already parsed objects (postgres JSONB)', async () => {
    const snapshot = createCatalogOSSnapshot();
    const { sql } = fakeSql([{ id: snapshot.snapshotId, data: snapshot }]);
    const repo = new PostgresOSRepository(sql);
    const snapshots = await repo.listSnapshots();
    expect(snapshots[0]?.snapshotId).toBe(snapshot.snapshotId);
  });

  it('counts snapshots from the COUNT query', async () => {
    const { sql } = fakeSql([{ count: '3' }]);
    const repo = new PostgresOSRepository(sql);
    expect(await repo.countSnapshots()).toBe(3);
  });

  it('returns zero when the count row is missing', async () => {
    const { sql } = fakeSql([]);
    const repo = new PostgresOSRepository(sql);
    expect(await repo.countSnapshots()).toBe(0);
  });
});

describe('PostgresOSRepository — optional live database round-trip', () => {
  it('round-trips through a real Postgres when POSTGRES_TEST_URL is set', async () => {
    const url = process.env.POSTGRES_TEST_URL;
    if (!url) return;
    const postgres = (await import('postgres')).default;
    const sql = postgres(url, { max: 2 });
    try {
      const repo = new PostgresOSRepository(sql);
      await repo.ensureTable();
      const snapshot: OSHealthSnapshot = {
        ...createCatalogOSSnapshot(),
        snapshotId: 'snapshot_os_live_test',
      };
      await repo.saveSnapshot(snapshot);
      const snapshots = await repo.listSnapshots();
      expect(snapshots.some((s) => s.snapshotId === snapshot.snapshotId)).toBe(true);
      expect(await repo.countSnapshots()).toBeGreaterThan(0);
    } finally {
      await sql.end();
    }
  });
});

describe('PostgresOSRepository — declarations', () => {
  it('declares the migration-ready os_health_registry table', () => {
    const source = PostgresOSRepository.toString();
    expect(source).toContain('os_health_registry');
    expect(source).toContain('IF NOT EXISTS');
    expect(source).toContain('PRIMARY KEY (collection, id)');
  });
});
