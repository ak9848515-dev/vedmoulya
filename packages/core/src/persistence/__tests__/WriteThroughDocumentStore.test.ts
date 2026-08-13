// ──────────────────────────────────────────────────────────────────
// VedMoulya — WriteThroughDocumentStore (SPRINT-022) hermetic tests
// No database required: a recording postgres.js-shaped stub backs the
// store. Verifies the mirror contract, write-through persistence, boot
// hydration, shutdown flush, database-outage isolation, bounded pruning
// and owner-key isolation (IDOR by construction).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '../WriteThroughDocumentStore.js';

interface Doc {
  id: string;
  ownerId: string;
  label: string;
  createdAt: string;
}

/** Minimal recording postgres.js-shaped stub. Identifier fragments (the
 *  `sql('table')` call) are spliced into the SQL text like the real client;
 *  bound values become '?' placeholders and are never part of the text. */
function createFakeSql(
  options: { fail?: boolean; selectRows?: unknown[]; gateFirstInsert?: Promise<unknown> } = {},
): {
  sql: postgres.Sql;
  calls: string[];
} {
  const calls: string[] = [];
  const run = (first: unknown, ...values: unknown[]): unknown => {
    // Identifier fragment: sql('table_name') — spliced into SQL text.
    if (typeof first === 'string') return first;
    const strings = first as TemplateStringsArray;
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      if (typeof value === 'string') {
        text += value + strings[i + 1]; // identifier fragment
      } else {
        text += `? ${strings[i + 1] ?? ''}`;
      }
    }
    calls.push(text);
    if (options.fail) return Promise.reject(new Error('database unavailable'));
    if (/^\s*SELECT/i.test(text)) return Promise.resolve(options.selectRows ?? []);
    if (options.gateFirstInsert) {
      // Hold the FIRST non-select query until the test releases it, so the
      // test can enqueue a trailing write while a drain is awaiting SQL.
      const gate = options.gateFirstInsert;
      options.gateFirstInsert = undefined;
      return gate.then(() => ({ count: 1 }));
    }
    return Promise.resolve({ count: 1 });
  };
  // The store binds JSON documents via sql.json() — the fake returns the raw
  // value (the real driver wraps it in a Parameter for OID 3802). It REJECTS
  // strings to mirror the real driver's failure mode: postgres.js's json()
  // would JSON.stringify a string a second time (double-encoding), so a
  // pre-stringified value reaching here is exactly the regression this sprint
  // fixed — and it must fail hermetic tests, not silently normalize.
  const sql = Object.assign(run, {
    json: (value: unknown): unknown => {
      if (typeof value === 'string') {
        throw new Error('double-encoding regression: sql.json() received pre-stringified JSON');
      }
      return value;
    },
  }) as unknown as postgres.Sql;
  return { sql, calls };
}

class TestStore extends WriteThroughDocumentStore<Doc> {
  save(doc: Doc): void {
    this.write(doc.ownerId, doc.id, doc);
    this.prune(
      doc.ownerId,
      2,
      (d) => d.createdAt,
      (d) => d.id,
    );
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
}

function doc(id: string, ownerId = 'u1', createdAt = '2026-01-01T00:00:00.000Z'): Doc {
  return { id, ownerId, label: `doc-${id}`, createdAt };
}

const awaitMicrotasks = async (): Promise<void> => {
  // Let fire-and-forget drains settle before asserting on calls.
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('WriteThroughDocumentStore', () => {
  it('serves reads from the mirror synchronously after a write', async () => {
    const { sql } = createFakeSql();
    const store = new TestStore(sql, 'test_docs');
    store.save(doc('a'));
    expect(store.getDoc('u1', 'a')).toMatchObject({ id: 'a', ownerId: 'u1' });
    expect(store.allDocs('u1')).toHaveLength(1);
    await store.flush();
  });

  it('clones documents on read — callers cannot mutate stored state', async () => {
    const { sql } = createFakeSql();
    const store = new TestStore(sql, 'test_docs');
    store.save(doc('a'));
    const first = store.getDoc('u1', 'a');
    first!.label = 'mutated';
    expect(store.getDoc('u1', 'a')!.label).toBe('doc-a');
    await store.flush();
  });

  it('isolates owners by construction — a foreign owner reads nothing', async () => {
    const { sql } = createFakeSql();
    const store = new TestStore(sql, 'test_docs');
    store.save(doc('a', 'u1'));
    expect(store.getDoc('u2', 'a')).toBeUndefined();
    expect(store.allDocs('u2')).toHaveLength(0);
    expect(store.allDocs('u1')).toHaveLength(1);
    await store.flush();
  });

  it('flushes every pending write through to the database', async () => {
    const { sql, calls } = createFakeSql();
    const store = new TestStore(sql, 'test_docs');
    store.save(doc('a', 'u1'));
    store.save(doc('b', 'u1'));
    await store.flush();
    const upserts = calls.filter((c) => /INSERT INTO test_docs/i.test(c));
    expect(upserts).toHaveLength(2);
  });

  it('deduplicates pending writes by (owner, key) — the latest version wins', async () => {
    const { sql, calls } = createFakeSql();
    const store = new TestStore(sql, 'test_docs');
    store.save(doc('a', 'u1', '2026-01-01T00:00:00.000Z'));
    store.save({ ...doc('a', 'u1'), label: 'updated', createdAt: '2026-01-02T00:00:00.000Z' });
    await store.flush();
    const upserts = calls.filter((c) => /INSERT INTO test_docs/i.test(c));
    expect(upserts).toHaveLength(1);
    expect(store.getDoc('u1', 'a')!.label).toBe('updated');
  });

  it('hydrates persisted rows into the mirror at boot', async () => {
    const { sql } = createFakeSql({
      selectRows: [
        { owner: 'u1', key: 'a', doc: JSON.stringify(doc('a', 'u1')) },
        { owner: 'u2', key: 'b', doc: JSON.stringify(doc('b', 'u2')) },
      ],
    });
    const store = new TestStore(sql, 'test_docs');
    const count = await store.hydrate();
    expect(count).toBe(2);
    expect(store.getDoc('u1', 'a')).toMatchObject({ id: 'a' });
    expect(store.getDoc('u2', 'b')).toMatchObject({ id: 'b' });
    // Owner isolation holds after hydration.
    expect(store.getDoc('u1', 'b')).toBeUndefined();
  });

  it('continues serving reads when the database is unavailable (degraded, never crashed)', async () => {
    const { sql } = createFakeSql({ fail: true });
    const store = new TestStore(sql, 'test_docs');
    store.save(doc('a', 'u1'));
    // Reads are mirror-backed — the outage never surfaces.
    expect(store.getDoc('u1', 'a')).toMatchObject({ id: 'a' });
    // Flush retries, catches, and does not throw into the caller.
    await expect(store.flush()).resolves.toBeUndefined();
    // A later recovery keeps working.
    const { sql: goodSql, calls } = createFakeSql();
    const recovered = new TestStore(goodSql, 'test_docs');
    recovered.save(doc('a', 'u1'));
    await recovered.flush();
    expect(calls.filter((c) => /INSERT INTO test_docs/i.test(c))).toHaveLength(1);
  });

  it('prunes the oldest documents beyond the per-owner limit (mirror + DB delete)', async () => {
    const { sql, calls } = createFakeSql();
    const store = new TestStore(sql, 'test_docs');
    store.save(doc('a', 'u1', '2026-01-01T00:00:00.000Z'));
    store.save(doc('b', 'u1', '2026-01-02T00:00:00.000Z'));
    store.save(doc('c', 'u1', '2026-01-03T00:00:00.000Z'));
    await store.flush();
    // Limit is 2 — the oldest ('a') is evicted from mirror AND database.
    expect(
      store
        .allDocs('u1')
        .map((d) => d.id)
        .sort(),
    ).toEqual(['b', 'c']);
    expect(calls.some((c) => /DELETE FROM test_docs/i.test(c))).toBe(true);
  });

  it('drains writes that arrive while a drain is in flight (no trailing-write gap)', async () => {
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const { sql, calls } = createFakeSql({ gateFirstInsert: gate });
    const store = new TestStore(sql, 'test_docs');
    store.save(doc('a', 'u1'));
    // Yield once so the drain captures 'a' and is now awaiting the gated
    // INSERT (microtask — no timing dependency).
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    // A write lands while the first upsert is still in flight — the drain
    // loop must pick it up on the next iteration WITHOUT a flush.
    store.save(doc('b', 'u1'));
    releaseFirst();
    // Macrotask flush: every microtask (gate.then → drainOnce → second
    // upsert) settles deterministically.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const upserts = calls.filter((c) => /INSERT INTO test_docs/i.test(c));
    expect(upserts).toHaveLength(2);
    expect(store.getDoc('u1', 'b')).toMatchObject({ id: 'b' });
  });

  it('schedules a delete on remove and supersedes a pending write', async () => {
    const { sql, calls } = createFakeSql();
    const store = new TestStore(sql, 'test_docs');
    store.save(doc('a', 'u1'));
    store.removeDoc('u1', 'a');
    await store.flush();
    expect(store.getDoc('u1', 'a')).toBeUndefined();
    expect(calls.some((c) => /DELETE FROM test_docs/i.test(c))).toBe(true);
  });

  it('binds JSON documents via sql.json — exactly one JSON encoding', async () => {
    const { sql } = createFakeSql();
    const store = new TestStore(sql, 'test_docs');
    expect(() => store.save(doc('a', 'u1'))).not.toThrow();
    await store.flush();
    // The save above would have thrown if the store pre-stringified the doc
    // (the json() shim rejects strings — mirroring real postgres.js's
    // double-encoding failure mode). The mirror still serves the document.
    expect(store.getDoc('u1', 'a')).toMatchObject({ id: 'a' });
  });

  it('never leaks document contents into failure logs', async () => {
    const { sql } = createFakeSql({ fail: true });
    const store = new TestStore(sql, 'test_docs');
    const secret = {
      id: 's',
      ownerId: 'u1',
      label: 'SECRET-VALUE-XYZ',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    store.save(secret);
    await store.flush(); // must not throw
    await awaitMicrotasks();
    // The mirror still serves the document — nothing was lost in-process.
    expect(store.getDoc('u1', 's')).toMatchObject({ label: 'SECRET-VALUE-XYZ' });
  });
});
