// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Requirement Session Stores
// EPIC-009 — infrastructure. The in-memory store is exercised directly
// (deep-clone, owner-scoped list, delete); the Postgres store is
// exercised against a fake tagged-template sql client that records
// calls and returns canned rows — the same hermetic approach every EI
// Postgres repository suite uses, so the DDL statements and JSONB
// round-trips are covered without a live database.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { InMemoryRequirementSessionStore } from '../InMemoryRequirementSessionStore.js';
import { PostgresRequirementSessionStore } from '../PostgresRequirementSessionStore.js';
import type { RequirementSession } from '../../types/requirement-types.js';

interface RecordedCall {
  strings: readonly string[];
  values: unknown[];
}

function fakeSql(rows: unknown[]): { sql: ReturnType<typeof postgres>; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings: [...strings], values });
    return Promise.resolve(rows);
  }) as unknown as ReturnType<typeof postgres>;
  // The store binds JSON documents via sql.json() — the fake returns the raw
  // value (the real driver wraps it in a Parameter for OID 3802).
  tag.json = (value: unknown): unknown => value;
  return { sql: tag, calls };
}

function makeSession(overrides: Partial<RequirementSession> = {}): RequirementSession {
  return {
    sessionId: 'req-test-1',
    owner: 'u1',
    idea: 'Build a restaurant app.',
    phase: 'UNDERSTANDING',
    changeImpacts: [],
    versions: [],
    enrichment: { attempted: false, calls: 0, tokens: 0, costUsd: 0 },
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryRequirementSessionStore', () => {
  it('saves and retrieves a deep-cloned session (mutation cannot leak)', async () => {
    const store = new InMemoryRequirementSessionStore();
    const session = makeSession();
    await store.save(session);

    // Mutating the returned copy must not corrupt the stored document.
    const first = await store.get(session.sessionId);
    expect(first?.sessionId).toBe(session.sessionId);
    if (first) first.idea = 'mutated';
    const second = await store.get(session.sessionId);
    expect(second?.idea).toBe('Build a restaurant app.');
  });

  it('returns undefined for an unknown id and false on missing delete', async () => {
    const store = new InMemoryRequirementSessionStore();
    await expect(store.get('req-missing')).resolves.toBeUndefined();
    await expect(store.delete('req-missing')).resolves.toBe(false);
  });

  it('lists owner-scoped, newest first', async () => {
    const store = new InMemoryRequirementSessionStore();
    await store.save(
      makeSession({ sessionId: 'req-a', owner: 'u1', updatedAt: '2026-08-09T00:00:01.000Z' }),
    );
    await store.save(
      makeSession({ sessionId: 'req-b', owner: 'u2', updatedAt: '2026-08-09T00:00:03.000Z' }),
    );
    await store.save(
      makeSession({ sessionId: 'req-c', owner: 'u1', updatedAt: '2026-08-09T00:00:02.000Z' }),
    );

    const mine = await store.list('u1');
    expect(mine.map((s) => s.sessionId)).toEqual(['req-c', 'req-a']);
    expect((await store.list('u2')).map((s) => s.sessionId)).toEqual(['req-b']);
    // No owner → everything.
    expect(await store.list()).toHaveLength(3);
  });

  it('deletes an existing session', async () => {
    const store = new InMemoryRequirementSessionStore();
    await store.save(makeSession());
    await expect(store.delete('req-test-1')).resolves.toBe(true);
    await expect(store.get('req-test-1')).resolves.toBeUndefined();
  });
});

describe('PostgresRequirementSessionStore', () => {
  it('ensures the table with idempotent DDL (create + index)', async () => {
    const { sql, calls } = fakeSql([]);
    const store = new PostgresRequirementSessionStore(sql);
    await store.ensureTable();
    expect(calls.length).toBe(2);
    const ddl = calls.map((c) => c.strings.join(''));
    expect(ddl[0]).toContain('CREATE TABLE IF NOT EXISTS requirement_sessions');
    expect(ddl[0]).toContain('document JSONB NOT NULL');
    expect(ddl[1]).toContain('CREATE INDEX IF NOT EXISTS requirement_sessions_owner_updated_idx');
  });

  it('saves a session as a JSONB document with owner/phase/updated columns', async () => {
    const { sql, calls } = fakeSql([]);
    const store = new PostgresRequirementSessionStore(sql);
    const session = makeSession();
    await store.save(session);

    const insert = calls[0];
    expect(insert).toBeDefined();
    expect(insert.strings.join('')).toContain('INSERT INTO requirement_sessions');
    expect(insert.values).toContain(session.sessionId);
    expect(insert.values).toContain(session.owner);
    expect(insert.values).toContain(session.phase);
    // The document binds via sql.json() — the RAW object is the bound value
    // (single encoding; never a pre-stringified double-encoded string).
    expect(
      insert.values.some(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          (v as { idea?: string }).idea === 'Build a restaurant app.',
      ),
    ).toBe(true);
  });

  it('gets a session by id, parsing the JSONB document', async () => {
    const session = makeSession({ phase: 'QUESTIONS' });
    const { sql } = fakeSql([
      {
        session_id: session.sessionId,
        owner: session.owner,
        phase: session.phase,
        updated_at: session.updatedAt,
        document: JSON.stringify(session),
      },
    ]);
    const store = new PostgresRequirementSessionStore(sql);
    const found = await store.get(session.sessionId);
    expect(found?.sessionId).toBe(session.sessionId);
    expect(found?.phase).toBe('QUESTIONS');
    expect(found?.idea).toBe('Build a restaurant app.');
  });

  it('returns undefined when no row matches', async () => {
    const { sql } = fakeSql([]);
    const store = new PostgresRequirementSessionStore(sql);
    await expect(store.get('req-missing')).resolves.toBeUndefined();
  });

  it('lists owner-scoped sessions from rows', async () => {
    const a = makeSession({
      sessionId: 'req-a',
      owner: 'u1',
      updatedAt: '2026-08-09T00:00:02.000Z',
    });
    const b = makeSession({
      sessionId: 'req-b',
      owner: 'u1',
      updatedAt: '2026-08-09T00:00:01.000Z',
    });
    const rows = [a, b].map((s) => ({
      session_id: s.sessionId,
      owner: s.owner,
      phase: s.phase,
      updated_at: s.updatedAt,
      document: JSON.stringify(s),
    }));
    const { sql } = fakeSql(rows);
    const store = new PostgresRequirementSessionStore(sql);
    const listed = await store.list('u1');
    expect(listed.map((s) => s.sessionId)).toEqual(['req-a', 'req-b']);
  });

  it('lists every session when no owner filter is given', async () => {
    const a = makeSession({ sessionId: 'req-a', owner: 'u1' });
    const b = makeSession({ sessionId: 'req-b', owner: 'u2' });
    const rows = [a, b].map((s) => ({
      session_id: s.sessionId,
      owner: s.owner,
      phase: s.phase,
      updated_at: s.updatedAt,
      document: JSON.stringify(s),
    }));
    const { sql, calls } = fakeSql(rows);
    const store = new PostgresRequirementSessionStore(sql);
    const listed = await store.list();
    expect(listed.map((s) => s.sessionId)).toEqual(['req-a', 'req-b']);
    expect(calls[0]?.strings.join('')).not.toContain('WHERE owner');
  });

  it('deletes a session when rows were removed', async () => {
    const calls: RecordedCall[] = [];
    const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ strings: [...strings], values });
      return Promise.resolve({ count: 1 });
    }) as unknown as ReturnType<typeof postgres>;
    const store = new PostgresRequirementSessionStore(tag);
    await expect(store.delete('req-test-1')).resolves.toBe(true);
    expect(calls[0]?.strings.join('')).toContain('DELETE FROM requirement_sessions');
  });

  it('delete reports false when no row was removed', async () => {
    const tag = (() => Promise.resolve({ count: 0 })) as unknown as ReturnType<typeof postgres>;
    const store = new PostgresRequirementSessionStore(tag);
    await expect(store.delete('req-test-1')).resolves.toBe(false);
  });
});
