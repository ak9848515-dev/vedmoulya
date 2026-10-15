// ──────────────────────────────────────────────────────────────────
// VedMoulya — OAuth state + email-verification stores vs REAL PostgreSQL
// (remediation A evidence for the shared timestamp-binding root cause).
//
// These two stores previously bound a JS `Date` to a `timestamptz`
// parameter, which postgres-js rejects at runtime (`ERR_INVALID_ARG_TYPE`).
// Production/staging select the Postgres implementations, so every
// `save()` would have thrown: Google sign-in could not record its
// single-use `state`, and email-verification tokens could never be issued.
// The fix binds an ISO-8601 string with an explicit `::timestamptz` cast.
//
// Gated on engine availability with the repository's established
// convention: (postgresAvailable ? describe : describe.skip).
// NON-DESTRUCTIVE: rows are namespaced per run and deleted in afterAll
// with a scoped DELETE. No table is dropped.
// ──────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresOAuthStateStore } from '../src/infrastructure/persistence/OAuthStateStore.js';
import { PostgresVerificationTokenStore } from '../src/infrastructure/persistence/VerificationTokenStore.js';
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
const userId = `usr_pgstore_${runId}`;
const otherUserId = `usr_pgstore_other_${runId}`;
const stateHash = `state_pg_${runId}`;
const tokenHash = `vt_pg_${runId}`;

const db = drizzle(sql, { schema });
const oauthStore = new PostgresOAuthStateStore(db);
/** Second instance = same process after restart, or another node. */
const oauthStoreAfterRestart = new PostgresOAuthStateStore(db);
const verificationStore = new PostgresVerificationTokenStore(db);

const FUTURE = () => new Date(Date.now() + 10 * 60 * 1000);
const PAST = () => new Date(Date.now() - 60 * 1000);

(postgresAvailable ? describe : describe.skip)('Identity stores (real PostgreSQL)', () => {
  beforeAll(async () => {
    await oauthStore.ensureTable();
    await verificationStore.ensureTable();
  });

  afterAll(async () => {
    // Scoped cleanup of THIS run's rows only.
    await sql`DELETE FROM oauth_states WHERE state_hash = ${stateHash}`;
    await sql`DELETE FROM email_verifications WHERE user_id IN (${userId}, ${otherUserId})`;
    await sql.end({ timeout: 5 });
  });

  it('OAuth state save/consume works on the engine and is single-use across instances', async () => {
    // The exact call that used to throw ERR_INVALID_ARG_TYPE: a `Date`
    // written into a timestamp column.
    await oauthStore.save(stateHash, FUTURE());

    // A different instance (restart / other node) sees the durable state.
    expect(await oauthStoreAfterRestart.consume(stateHash)).toBe(true);
    // Replay of a consumed state loses, on either instance.
    expect(await oauthStoreAfterRestart.consume(stateHash)).toBe(false);
    expect(await oauthStore.consume(stateHash)).toBe(false);
  });

  it('concurrent OAuth callbacks let exactly one win', async () => {
    const raceHash = `${stateHash}_race`;
    await oauthStore.save(raceHash, FUTURE());
    const results = await Promise.all([
      oauthStore.consume(raceHash),
      oauthStoreAfterRestart.consume(raceHash),
      oauthStore.consume(raceHash),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    await sql`DELETE FROM oauth_states WHERE state_hash = ${raceHash}`;
  });

  it('an expired OAuth state fails closed', async () => {
    const expiredHash = `${stateHash}_expired`;
    await oauthStore.save(expiredHash, PAST());
    expect(await oauthStore.consume(expiredHash)).toBe(false);
    await sql`DELETE FROM oauth_states WHERE state_hash = ${expiredHash}`;
  });

  it('verification tokens persist, are single-use, and keep one active token per user', async () => {
    // The same Date-binding path on the verification store.
    const expiresAt = FUTURE();
    await verificationStore.save(userId, tokenHash, expiresAt);

    const record = await verificationStore.findByHash(tokenHash);
    expect(record).not.toBeNull();
    expect(record!.userId).toBe(userId);
    expect(record!.consumedAt).toBeNull();
    expect(record!.expiresAt).toBeInstanceOf(Date);
    // TIME-ZONE FIDELITY GUARD (regression pin): `expires_at` is compared in
    // JS against Date.now(), so the instant read back must be the instant
    // that was written — not one shifted by (Node zone − DB zone). A naive
    // read of the tz-less column shifts it (measured: 330 minutes), which
    // would have accepted expired tokens in a late-running zone.
    expect(Math.abs(record!.expiresAt.getTime() - expiresAt.getTime())).toBeLessThan(1_000);

    // Single-use: consumption is durable and observable.
    const consumedBefore = Date.now();
    await verificationStore.markConsumed(record!.id);
    const consumed = await verificationStore.findByHash(tokenHash);
    expect(consumed!.consumedAt).toBeInstanceOf(Date);
    expect(Math.abs(consumed!.consumedAt!.getTime() - consumedBefore)).toBeLessThan(5_000);

    // One active token per user: a re-issue replaces the previous hash.
    const replacementHash = `${tokenHash}_2`;
    await verificationStore.save(userId, replacementHash, FUTURE());
    expect(await verificationStore.findByHash(tokenHash)).toBeNull();
    const replacement = await verificationStore.findByHash(replacementHash);
    expect(replacement).not.toBeNull();
    expect(replacement!.consumedAt).toBeNull();

    // Logout-style revocation is scoped to the target user.
    await verificationStore.revokeForUser(userId);
    const revoked = await verificationStore.findByHash(replacementHash);
    expect(revoked!.consumedAt).toBeInstanceOf(Date);

    await verificationStore.save(otherUserId, `${tokenHash}_other`, FUTURE());
    await verificationStore.revokeForUser(userId);
    const untouched = await verificationStore.findByHash(`${tokenHash}_other`);
    expect(untouched!.consumedAt).toBeNull();
  });
});
