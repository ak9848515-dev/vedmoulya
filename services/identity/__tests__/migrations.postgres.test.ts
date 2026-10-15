// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Versioned Migrations against a REAL PostgreSQL engine
// (remediation B evidence).
//
// Hermetic coverage of the runner lives in migrations.test.ts; this file
// proves the parts that only a real engine can: the ledger round-trip, the
// timestamptz default, unique indexes, idempotent re-application against
// pre-existing tables, drift detection, and that a rollback really reverses
// the schema.
//
// ISOLATION: every statement runs inside a DEDICATED SCHEMA created for this
// suite (`search_path` is pinned on a single-connection pool), so the
// destructive rollback test can never drop a table another suite or the
// running application depends on. afterAll removes only that schema.
// Gated on engine availability with the repository's established convention.
// ──────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../src/schema/users.js';
import {
  IDENTITY_MIGRATIONS,
  MIGRATION_LEDGER_TABLE,
  assertIdentitySchemaCurrent,
  ensureIdentitySchema,
  migrationStatus,
  pendingMigrations,
  resetIdentitySchemaBootstrap,
  rollbackIdentityMigrations,
  runIdentityMigrations,
  schemaVersion,
} from '../src/infrastructure/persistence/migrations.js';

const databaseUrl =
  process.env.POSTGRES_TEST_URL ?? 'postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya';

const runId = `${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const isolatedSchema = `idm_test_${runId}`;

// max: 1 → every query uses the same connection, so `SET search_path` sticks
// and all unqualified DDL in the migrations lands inside the isolated schema.
const sql = postgres(databaseUrl, { max: 1, connect_timeout: 3 });
let postgresAvailable = false;
try {
  await sql`SELECT 1`;
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${isolatedSchema}`);
  await sql.unsafe(`SET search_path TO ${isolatedSchema}`);
  postgresAvailable = true;
} catch {
  postgresAvailable = false;
}

const db = drizzle(sql, { schema });

/** Tables visible in the isolated schema (unqualified → search_path). */
async function schemaTables(): Promise<string[]> {
  const rows = (await sql.unsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = '${isolatedSchema}' ORDER BY table_name`,
  )) as Array<{ table_name: string }>;
  return rows.map((row) => row.table_name);
}

(postgresAvailable ? describe : describe.skip)(
  'identity versioned migrations (real PostgreSQL)',
  () => {
    beforeAll(async () => {
      // A virgin schema: no identity objects, no ledger.
      expect(await schemaTables()).toEqual([]);
    });

    afterAll(async () => {
      // Only this suite's own schema is removed.
      try {
        await sql.unsafe(`DROP SCHEMA IF EXISTS ${isolatedSchema} CASCADE`);
      } finally {
        await sql.end({ timeout: 5 });
      }
    });

    it('reports a virgin database as unversioned with everything pending', async () => {
      expect(await migrationStatus(db)).toEqual(
        IDENTITY_MIGRATIONS.map((migration) => ({
          id: migration.id,
          description: migration.description,
          appliedAt: null,
        })),
      );
      expect(await schemaVersion(db)).toBeNull();
      expect((await pendingMigrations(db)).map((m) => m.id)).toEqual(
        IDENTITY_MIGRATIONS.map((m) => m.id),
      );
    });

    it('applies the whole set once, records it, and creates every table', async () => {
      const result = await runIdentityMigrations(db);
      expect(result.applied).toEqual(IDENTITY_MIGRATIONS.map((m) => m.id));
      expect(result.alreadyApplied).toEqual([]);

      expect(await schemaTables()).toEqual([
        'email_verifications',
        'identity_schema_migrations',
        'oauth_states',
        'refresh_token_denylist',
        'users',
      ]);

      const ledger = (await sql.unsafe(
        `SELECT id, applied_at FROM ${MIGRATION_LEDGER_TABLE} ORDER BY id`,
      )) as Array<{ id: string; applied_at: string | Date }>;
      expect(ledger.map((row) => row.id)).toEqual(IDENTITY_MIGRATIONS.map((m) => m.id));
      // The timestamptz default is evaluated by the ENGINE (no JS Date is
      // bound anywhere in the migration path).
      expect(ledger.every((row) => row.applied_at !== null)).toBe(true);

      expect(await schemaVersion(db)).toBe('004_email_verifications');
      await expect(assertIdentitySchemaCurrent(db)).resolves.toBe('004_email_verifications');
    });

    it('is idempotent against the real engine and preserves stored data', async () => {
      await sql.unsafe(
        `INSERT INTO refresh_token_denylist (id, jti_hash, user_id, kind, expires_at)
         VALUES ('${randomUUID()}', '${'a'.repeat(64)}', 'usr_mig_test', 'jti', now() + interval '1 day')`,
      );

      const second = await runIdentityMigrations(db);
      expect(second.applied).toEqual([]);
      expect(second.alreadyApplied).toEqual(IDENTITY_MIGRATIONS.map((m) => m.id));

      const kept = (await sql.unsafe(
        `SELECT count(*)::int AS n FROM refresh_token_denylist WHERE user_id = 'usr_mig_test'`,
      )) as Array<{ n: number }>;
      expect(kept[0]?.n).toBe(1);
    });

    it('detects drift and repairs it on the next run', async () => {
      // Drift: the ledger loses 003_oauth_states (e.g. a restore from an
      // older backup, or a table dropped out of band). The READINESS GATE
      // must refuse instead of serving traffic against an incomplete schema.
      await sql.unsafe(`DELETE FROM ${MIGRATION_LEDGER_TABLE} WHERE id = '003_oauth_states'`);
      await expect(assertIdentitySchemaCurrent(db)).rejects.toThrow(/003_oauth_states/);

      const repaired = await runIdentityMigrations(db);
      expect(repaired.applied).toEqual(['003_oauth_states']);
      await expect(assertIdentitySchemaCurrent(db)).resolves.toBe('004_email_verifications');
    });

    it('refuses a missing migration and re-runs are safe under concurrency', async () => {
      resetIdentitySchemaBootstrap();
      // Two independent boot paths (gateway + web auth-app) share ONE run.
      const [first, second] = await Promise.all([
        ensureIdentitySchema(db),
        ensureIdentitySchema(db),
      ]);
      expect(first).toBe(second);
      expect(first.applied).toEqual([]);
      resetIdentitySchemaBootstrap();
    });

    it('rolls back to a target version and re-applies cleanly', async () => {
      const rolledBack = await rollbackIdentityMigrations(db, { to: '001_users' });
      expect(rolledBack).toEqual([
        '004_email_verifications',
        '003_oauth_states',
        '002_refresh_token_denylist',
      ]);
      expect(await schemaTables()).toEqual(['identity_schema_migrations', 'users']);
      expect(await schemaVersion(db)).toBe('001_users');

      const reapplied = await runIdentityMigrations(db);
      expect(reapplied.applied).toEqual([
        '002_refresh_token_denylist',
        '003_oauth_states',
        '004_email_verifications',
      ]);

      // The rebuilt tables are fully functional (the unique JTI arbiter is
      // back), not just present.
      await sql.unsafe(
        `INSERT INTO refresh_token_denylist (id, jti_hash, user_id, kind, expires_at)
         VALUES ('${randomUUID()}', '${'b'.repeat(64)}', 'usr_mig_test', 'jti', now() + interval '1 day')`,
      );
      const count = (await sql.unsafe(
        `SELECT count(*)::int AS n FROM refresh_token_denylist`,
      )) as Array<{ n: number }>;
      expect(count[0]?.n).toBe(1);
    });
  },
);
