// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — WORKSPACE-01 · durable workspace lease
//
// TWO LAYERS OF EVIDENCE
// ----------------------
// 1. HERMETIC (always runs): the exact statements the store issues carry the
//    guarantees that matter — a reserved owner, a token+expiry guarded
//    conditional upsert (the atomic acquisition), a token-checked renewal and
//    release, and fully parameterized values (no interpolation of user data).
// 2. REAL POSTGRES (gated): the atomic behaviour itself. It needs a database,
//    so it SKIPS honestly when none is configured; it must never be reported as
//    passed without one. Point `MISSION_TEST_POSTGRES` (or `POSTGRES_TEST_URL`)
//    at a THROWAWAY database — the suite creates its own table name and drops it.
// ─────────────────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import {
  PostgresWorkspaceLeaseStore,
  WORKSPACE_LEASE_OWNER,
} from '../persistence/PostgresWorkspaceLeaseStore.js';

type Sql = postgres.Sql;

/**
 * Only the call surface the store actually uses. postgres.js's `sql.json`
 * returns an opaque `Parameter`; the recorder returns a plain marker object,
 * so the test-side type declares exactly that instead of re-typing `Sql`.
 */
type TestSql = {
  json: (value: unknown) => unknown;
  (identifier: string): { __fragment: string };
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
};

interface Recorded {
  text: string;
  values: unknown[];
}

/**
 * Records every statement and the bind values it was given.
 *
 * The plain-call form `sql('identifier')` is how postgres.js interpolates an
 * identifier INTO a tagged template — it must return a fragment marker, not a
 * string. Returning the bare name made the store's `sql.json(...)` calls fail
 * with "this.sql is not a function" (the recorder is the generic function; the
 * helpers live on the tagged-template function itself).
 */
function createRecordingSql(resultRows: unknown[] = []): {
  sql: Sql;
  statements: Recorded[];
} {
  const statements: Recorded[] = [];
  const json = (value: unknown): unknown => ({ __json: value });
  const handler = ((...args: unknown[]) => {
    // Plain-call form: sql('identifier') is an identifier fragment, never a
    // statement — the surrounding tagged template merely interpolates it.
    if (typeof args[0] === 'string') return { __fragment: args[0] };
    const strings = args[0] as TemplateStringsArray;
    statements.push({
      text: strings.join(' ? ').replace(/\s+/g, ' ').trim(),
      values: args.slice(1),
    });
    return Promise.resolve(resultRows);
  }) as unknown as TestSql;
  handler.json = json;
  return { sql: handler as unknown as Sql, statements };
}

const REQUEST = {
  missionId: 'mission-1',
  objectiveId: 'objective-1',
  token: 'lease_token_1',
  nowMs: 1_700_000_000_000,
  expiresAt: new Date(1_700_000_000_000 + 600_000).toISOString(),
};

describe('WORKSPACE-01 · durable workspace lease statements', () => {
  it('acquires with ONE token/expiry-guarded conditional upsert under a reserved owner', async () => {
    const { sql, statements } = createRecordingSql([{ doc: '{}' }]);
    const store = new PostgresWorkspaceLeaseStore(sql, 'ws_lease_test');

    expect(await store.acquire('/authorized/workspace', REQUEST)).toBe(true);
    // The guarded upsert is the ONLY statement that can win the lease; the
    // confirm read below it only records what actually landed.
    const statement = statements.find((candidate) => candidate.text.startsWith('INSERT'))!;
    expect(statement).toBeDefined();
    expect(statements.filter((candidate) => candidate.text.startsWith('INSERT'))).toHaveLength(1);
    expect(statement.text).toContain('INSERT INTO');
    expect(statement.text).toContain('ON CONFLICT (owner, key) DO UPDATE');
    // The two conditions that make concurrent acquisition safe:
    expect(statement.text).toContain("doc->>'token'");
    expect(statement.text).toContain("doc->>'expiresAt'");
    expect(statement.text).toContain('RETURNING');
    // Ownership is a reserved namespace — never a real mission owner.
    expect(statement.values).toContain(WORKSPACE_LEASE_OWNER);
    // Values are BOUND, never interpolated into the SQL text.
    expect(statement.values).toContain('/authorized/workspace');
    expect(statement.values).toContain('lease_token_1');
    expect(statement.text).not.toContain('lease_token_1');
  });

  it('returns false when the conditional upsert applied no row (someone else holds it)', async () => {
    const { sql } = createRecordingSql([]);
    const store = new PostgresWorkspaceLeaseStore(sql);
    expect(await store.acquire('/ws', REQUEST)).toBe(false);
  });

  it('renews only this token, inside the current expiry', async () => {
    const { sql, statements } = createRecordingSql([{ doc: '{}' }]);
    const store = new PostgresWorkspaceLeaseStore(sql);
    expect(
      await store.renew('/ws', {
        token: 'lease_token_1',
        nowMs: 1_700_000_001_000,
        expiresAt: new Date(1_700_000_601_000).toISOString(),
      }),
    ).toBe(true);
    const statement = statements[0]!;
    expect(statement.text).toContain('UPDATE');
    expect(statement.text).toContain("doc->>'token'");
    expect(statement.text).toContain("doc->>'expiresAt'");
    expect(statement.values).toContain('lease_token_1');
  });

  it('releases and holds by TOKEN only (a stale attempt can never free a replacement)', async () => {
    const { sql, statements } = createRecordingSql([{ doc: '{}' }]);
    const store = new PostgresWorkspaceLeaseStore(sql);

    await store.release('/ws', 'lease_stale');
    expect(statements[0]!.text).toContain('DELETE FROM');
    expect(statements[0]!.text).toContain("doc->>'token'");
    expect(statements[0]!.values).toContain('lease_stale');

    expect(await store.held('/ws', 'lease_token_1')).toBe(true);
    expect(statements[1]!.text).toContain("doc->>'token'");

    const empty = createRecordingSql([]);
    expect(await new PostgresWorkspaceLeaseStore(empty.sql).held('/ws', 'lease_token_1')).toBe(
      false,
    );
  });
});

// ── Real-Postgres behavioural proof (skips without a database) ───────────────

type EnvSource = { process?: { env?: Record<string, string | undefined> } };
const testProcess = (globalThis as EnvSource).process;
const testUrl =
  testProcess?.env?.['MISSION_TEST_POSTGRES'] ?? testProcess?.env?.['POSTGRES_TEST_URL'];
const describeReal = testUrl ? describe : describe.skip;

describeReal('WORKSPACE-01 · durable workspace lease against real Postgres', () => {
  it('exactly one of two concurrent attempts wins, then expiry/release hand it over', async () => {
    const postgres = (await import('postgres')).default;
    const sql = postgres(testUrl as string, { max: 4 });
    const table = 'ws_lease_test';
    try {
      const store = new PostgresWorkspaceLeaseStore(sql, table);
      await store.ensureTable();
      await sql`DELETE FROM ${sql(table)}`;

      const nowMs = Date.now();
      const expiresAt = new Date(nowMs + 60_000).toISOString();
      const base = { missionId: 'm', objectiveId: 'o', nowMs, expiresAt };

      const [first, second] = await Promise.all([
        store.acquire('/ws', { ...base, token: 'token_a' }),
        store.acquire('/ws', { ...base, token: 'token_b' }),
      ]);
      // The row lock makes this decision atomic: never both.
      expect([first, second].filter(Boolean)).toHaveLength(1);
      const winner = first ? 'token_a' : 'token_b';
      const loser = first ? 'token_b' : 'token_a';

      // The loser cannot renew, release or claim the workspace.
      expect(await store.renew('/ws', { token: loser, nowMs, expiresAt })).toBe(false);
      await store.release('/ws', loser);
      expect(await store.held('/ws', winner)).toBe(true);

      // The holder can renew; a stale token still cannot.
      expect(
        await store.renew('/ws', {
          token: winner,
          nowMs,
          expiresAt: new Date(nowMs + 120_000).toISOString(),
        }),
      ).toBe(true);

      // Expedition: a dead holder's expired lease is reclaimable by anyone.
      await sql`
        UPDATE ${sql(table)}
        SET doc = jsonb_set(doc, '{expiresAt}', to_jsonb(${new Date(nowMs - 1_000).toISOString()}::text))
        WHERE key = ${'/ws'}
      `;
      expect(await store.acquire('/ws', { ...base, token: loser })).toBe(true);
      expect(await store.held('/ws', winner)).toBe(false);

      // Token-checked release frees it for the next attempt.
      await store.release('/ws', loser);
      expect(await store.held('/ws', loser)).toBe(false);
    } finally {
      await sql`DROP TABLE IF EXISTS ${sql(table)}`.catch(() => undefined);
      await sql.end({ timeout: 5 }).catch(() => undefined);
    }
  }, 60_000);
});
