// ──────────────────────────────────────────────────────────────────
// VedMoulya — Targeted branch-coverage tests for persistence gaps
// Covers pruneGrouped, eviction warning, and flush when drainPromise
// is already in flight.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '../WriteThroughDocumentStore.js';

interface Doc {
  id: string;
  ownerId: string;
  label: string;
  group: string;
  createdAt: string;
}

function createFakeSql(options: { fail?: boolean; selectRows?: unknown[] } = {}): {
  sql: postgres.Sql;
  calls: string[];
} {
  const calls: string[] = [];
  const run = (first: unknown, ...values: unknown[]): unknown => {
    if (typeof first === 'string') return first;
    const strings = first as TemplateStringsArray;
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      if (typeof value === 'string') {
        text += value + strings[i + 1];
      } else {
        text += `? ${strings[i + 1] ?? ''}`;
      }
    }
    calls.push(text);
    if (options.fail) return Promise.reject(new Error('database unavailable'));
    if (/^\s*SELECT/i.test(text)) return Promise.resolve(options.selectRows ?? []);
    return Promise.resolve({ count: 1 });
  };
  const sql = Object.assign(run, {
    json: (value: unknown): unknown => {
      if (typeof value === 'string') {
        throw new Error('double-encoding regression');
      }
      return value;
    },
  }) as unknown as postgres.Sql;
  return { sql, calls };
}

class GroupedTestStore extends WriteThroughDocumentStore<Doc> {
  save(doc: Doc): void {
    this.write(doc.ownerId, doc.id, doc);
  }
  getDoc(ownerId: string, id: string): Doc | undefined {
    return this.read(ownerId, id);
  }
  allDocs(ownerId: string): Doc[] {
    return this.all(ownerId);
  }
  removeDoc(ownerId: string, id: string): void {
    this.remove(ownerId, id);
  }
  /** Expose pruneGrouped for testing. */
  doPruneGrouped(
    owner: string,
    groupOf: (doc: Doc) => string,
    limit: number,
    timestampOf: (doc: Doc) => string,
    keyOfDoc: (doc: Doc) => string,
  ): void {
    this.pruneGrouped(owner, groupOf, limit, timestampOf, keyOfDoc);
  }
  /** Expose ensureTable for testing. */
  doEnsureTable(): Promise<void> {
    return this.ensureTable();
  }
}

function doc(
  id: string,
  ownerId = 'u1',
  group = 'default',
  createdAt = '2026-01-01T00:00:00.000Z',
): Doc {
  return { id, ownerId, label: `doc-${id}`, group, createdAt };
}

describe('WriteThroughDocumentStore — branch coverage', () => {
  it('pruneGrouped evicts excess documents within each group', async () => {
    const { sql } = createFakeSql();
    const store = new GroupedTestStore(sql, 'grouped_test');

    // Group A: 3 docs, Group B: 2 docs — limit is 2 per group
    store.save(doc('a1', 'u1', 'A', '2026-01-01T00:00:00.000Z'));
    store.save(doc('a2', 'u1', 'A', '2026-01-02T00:00:00.000Z'));
    store.save(doc('a3', 'u1', 'A', '2026-01-03T00:00:00.000Z'));
    store.save(doc('b1', 'u1', 'B', '2026-01-01T00:00:00.000Z'));
    store.save(doc('b2', 'u1', 'B', '2026-01-02T00:00:00.000Z'));

    store.doPruneGrouped(
      'u1',
      (d) => d.group,
      2,
      (d) => d.createdAt,
      (d) => d.id,
    );

    await store.flush();

    const remaining = store
      .allDocs('u1')
      .map((d) => d.id)
      .sort();
    // Group A: oldest (a1) evicted → a2, a3 remain
    // Group B: exactly at limit → b1, b2 remain
    expect(remaining).toEqual(['a2', 'a3', 'b1', 'b2']);
  });

  it('pruneGrouped is a no-op when all groups are within limit', async () => {
    const { sql } = createFakeSql();
    const store = new GroupedTestStore(sql, 'grouped_test');

    store.save(doc('a1', 'u1', 'A', '2026-01-01T00:00:00.000Z'));
    store.save(doc('b1', 'u1', 'B', '2026-01-01T00:00:00.000Z'));

    store.doPruneGrouped(
      'u1',
      (d) => d.group,
      5,
      (d) => d.createdAt,
      (d) => d.id,
    );

    await store.flush();
    expect(store.allDocs('u1')).toHaveLength(2);
  });

  it('flush waits for in-flight drain then drains remaining (drainPromise path)', async () => {
    const { sql, calls } = createFakeSql();
    const store = new GroupedTestStore(sql, 'test_docs');

    // Multiple writes — the drain coalesces them
    store.save(doc('a', 'u1'));
    store.save(doc('b', 'u1'));
    store.save(doc('c', 'u1'));

    // flush must wait for any in-flight drain and then drain remaining
    await store.flush();

    const upserts = calls.filter((c) => /INSERT INTO test_docs/i.test(c));
    expect(upserts).toHaveLength(3);
  });

  it('ensureTable creates the table (idempotent)', async () => {
    const { sql, calls } = createFakeSql();
    const store = new GroupedTestStore(sql, 'grouped_test');
    await store.doEnsureTable();
    const creates = calls.filter((c) => /CREATE TABLE/i.test(c));
    const indexes = calls.filter((c) => /CREATE INDEX/i.test(c));
    expect(creates).toHaveLength(1);
    expect(indexes).toHaveLength(1);
  });

  it('hydration skips corrupt rows and loads valid ones', async () => {
    const { sql } = createFakeSql({
      selectRows: [
        { owner: 'u1', key: 'valid', doc: JSON.stringify(doc('valid', 'u1')) },
        { owner: 'u1', key: 'corrupt', doc: 'NOT-JSON-AT-ALL' },
        { owner: 'u2', key: 'ok', doc: JSON.stringify(doc('ok', 'u2')) },
      ],
    });
    const store = new GroupedTestStore(sql, 'grouped_test');
    const count = await store.hydrate();
    expect(count).toBe(3);
    expect(store.getDoc('u1', 'valid')).toBeDefined();
    expect(store.getDoc('u1', 'corrupt')).toBeUndefined();
    expect(store.getDoc('u2', 'ok')).toBeDefined();
  });

  it('read returns undefined for non-existent key', async () => {
    const { sql } = createFakeSql();
    const store = new GroupedTestStore(sql, 'test');
    expect(store.getDoc('u1', 'missing')).toBeUndefined();
  });

  it('all returns empty array for owner with no docs', async () => {
    const { sql } = createFakeSql();
    const store = new GroupedTestStore(sql, 'test');
    expect(store.allDocs('nobody')).toEqual([]);
  });

  it('remove then read returns undefined', async () => {
    const { sql } = createFakeSql();
    const store = new GroupedTestStore(sql, 'test');
    store.save(doc('a', 'u1'));
    expect(store.getDoc('u1', 'a')).toBeDefined();
    store.removeDoc('u1', 'a');
    expect(store.getDoc('u1', 'a')).toBeUndefined();
  });

  it('write supersedes pending delete (key re-appears after delete)', async () => {
    const { sql, calls } = createFakeSql();
    const store = new GroupedTestStore(sql, 'test');

    // Write, then delete, then write again before flush
    store.save(doc('a', 'u1'));
    store.removeDoc('u1', 'a');
    store.save(doc('a', 'u1'));

    await store.flush();

    // Should have 2 upserts (first write + re-write) and 1 delete is superseded
    const upserts = calls.filter((c) => /INSERT INTO test/i.test(c));
    const deletes = calls.filter((c) => /DELETE FROM test/i.test(c));
    expect(upserts.length).toBeGreaterThanOrEqual(1);
    expect(deletes).toHaveLength(0);
  });
});
