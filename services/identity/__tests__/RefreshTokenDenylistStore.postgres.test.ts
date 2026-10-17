// ──────────────────────────────────────────────────────────────────
// VedMoulya — RefreshTokenDenylistStore against a REAL PostgreSQL engine
// (remediation A + B evidence).
//
// The in-memory store is covered hermetically elsewhere; this file proves
// the DURABLE path that production/staging actually selects
// (createRefreshTokenDenylistStore() returns the Postgres store when
// NODE_ENV is production/staging). It is gated on engine availability with
// the repository's established convention — (postgresAvailable ? describe :
// describe.skip) — exactly like s10-postgres-durability.test.ts,
// PostgresKnowledgeRepository.postgres.test.ts and PersistenceStores.test.ts.
//
// NON-DESTRUCTIVE: every row this suite creates is namespaced with a unique
// per-run id and removed in afterAll with a user-scoped DELETE. No table is
// dropped, no other suite's rows are touched.
// ──────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresRefreshTokenDenylistStore } from '../src/infrastructure/persistence/RefreshTokenDenylistStore.js';
import * as schema from '../src/schema/users.js';

const databaseUrl =
  process.env.POSTGRES_TEST_URL ?? 'postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya';

const sql = postgres(databaseUrl, { max: 2, connect_timeout: 3 });

let postgresAvailable = false;
try {
  await sql`SELECT 1`;
  postgresAvailable = true;
} catch {
  postgresAvailable = false;
}

const runId = `${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const userId = `usr_pgtest_${runId}`;
const otherUserId = `usr_pgtest_other_${runId}`;

const store = new PostgresRefreshTokenDenylistStore(drizzle(sql, { schema }));
/** A second, independent instance = the same process after a restart, or
 *  another instance in a multi-instance deployment. */
const storeAfterRestart = new PostgresRefreshTokenDenylistStore(drizzle(sql, { schema }));

const FUTURE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST = () => new Date(Date.now() - 60 * 1000);

(postgresAvailable ? describe : describe.skip)(
  'RefreshTokenDenylistStore (real PostgreSQL)',
  () => {
    beforeAll(async () => {
      await store.ensureTable();
    });

    afterAll(async () => {
      // Scoped cleanup of THIS run's rows only.
      await sql`DELETE FROM refresh_token_denylist WHERE user_id IN (${userId}, ${otherUserId})`;
      await sql.end({ timeout: 5 });
    });

    it('claim wins exactly once and survives a new store instance (restart)', async () => {
      const jti = `rt_pg_claim_${runId}`;
      expect(await store.claim(jti, userId, FUTURE())).toBe(true);
      // Same instance: replay of the consumed JTI loses.
      expect(await store.claim(jti, userId, FUTURE())).toBe(false);
      // Different instance (restart / other node): the durable record wins.
      expect(await storeAfterRestart.isRevoked(jti)).toBe(true);
      expect(await storeAfterRestart.claim(jti, userId, FUTURE())).toBe(false);
    });

    it('concurrent claims on one JTI produce exactly one winner on the engine', async () => {
      const jti = `rt_pg_race_${runId}`;
      const results = await Promise.all([
        store.claim(jti, userId, FUTURE()),
        storeAfterRestart.claim(jti, userId, FUTURE()),
        store.claim(jti, userId, FUTURE()),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await store.isRevoked(jti)).toBe(true);
    });

    it('family revocation is timestamp-precise, durable, and per-user', async () => {
      expect(await store.familyRevokedAt(otherUserId)).toBeNull();

      const before = Date.now();
      await store.revokeForUser(otherUserId);
      const revokedAt = await storeAfterRestart.familyRevokedAt(otherUserId);
      expect(revokedAt).toBeInstanceOf(Date);

      // TIME-ZONE FIDELITY GUARD (regression pin): `revoked_at` is written by
      // the DATABASE (`now()`), so the instant read back must equal the real
      // wall-clock instant, not a value shifted by (Node zone − DB zone).
      // AuthService compares this value against a refresh token's `iat`; a
      // shifted value silently widens the logout gap. This assertion fails if
      // the read stops normalising through `AT TIME ZONE current_setting(...)`.
      expect(revokedAt!.getTime()).toBeGreaterThanOrEqual(before - 2_000);
      expect(Math.abs(Date.now() - revokedAt!.getTime())).toBeLessThan(5_000);

      // A token minted AFTER the revocation instant belongs to a new family
      // and is unaffected — the defect this remediation fixes.
      const afterMs = revokedAt!.getTime() + 5_000;
      expect(afterMs > revokedAt!.getTime()).toBe(true);

      // The coarse predicate agrees with the precise timestamp.
      expect(await store.isUserRevoked(otherUserId)).toBe(true);
      expect(await store.isUserRevoked(userId)).toBe(false);
    });

    it('an expired JTI row stops blocking while live evidence is retained', async () => {
      const expiredJti = `rt_pg_expired_${runId}`;
      const liveJti = `rt_pg_live_${runId}`;
      await store.claim(expiredJti, userId, PAST());
      await store.claim(liveJti, userId, FUTURE());

      // isRevoked already treats an expired row as live-token territory…
      expect(await store.isRevoked(expiredJti)).toBe(false);
      expect(await store.isRevoked(liveJti)).toBe(true);

      // …and cleanup reclaims the expired row only.
      const removed = await store.cleanup();
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(await store.isRevoked(liveJti)).toBe(true);
    });
  },
);
