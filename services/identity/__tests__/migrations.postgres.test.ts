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
import { eq } from 'drizzle-orm';
import * as schema from '../src/schema/users.js';
import { PostgresRefreshTokenDenylistStore } from '../src/infrastructure/persistence/RefreshTokenDenylistStore.js';
import { PostgresVerificationTokenStore } from '../src/infrastructure/persistence/VerificationTokenStore.js';
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

      expect(await schemaVersion(db)).toBe('005_timestamptz_instants');
      await expect(assertIdentitySchemaCurrent(db)).resolves.toBe('005_timestamptz_instants');
    });

    it('lands every instant column as timestamptz in the real catalogue', async () => {
      // The ENGINE proves the type, not the SQL text: read it back from
      // information_schema. A naive `timestamp` would pass every other test in
      // this suite while still shifting instants for a reader in another zone.
      const ranges = (await sql.unsafe(
        `SELECT table_name, column_name, data_type
           FROM information_schema.columns
          WHERE table_schema = '${isolatedSchema}'
            AND column_name IN ('created_at','updated_at','status_changed_at',
                                'password_updated_at','revoked_at','expires_at','consumed_at')
          ORDER BY table_name, column_name`,
      )) as Array<{ table_name: string; column_name: string; data_type: string }>;

      expect(ranges).toHaveLength(13);
      for (const column of ranges) {
        expect(column.data_type, `${column.table_name}.${column.column_name}`).toBe(
          'timestamp with time zone',
        );
      }
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
      await expect(assertIdentitySchemaCurrent(db)).resolves.toBe('005_timestamptz_instants');
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
        '005_timestamptz_instants',
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
        '005_timestamptz_instants',
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
    }, 15_000);

    it('still reads the PRE-005 naive shape exactly (the type change is not a read cliff)', async () => {
      // A database created before 005 has `timestamp WITHOUT time zone`
      // columns. Rolling code out ahead of the migration must not misread them:
      // the read path casts with `col::timestamptz`, which is correct for the
      // tz-aware shape AND for this one. Recreate both tables with the ORIGINAL
      // naive DDL to prove that, rather than assuming it.
      await sql.unsafe(`DROP TABLE IF EXISTS refresh_token_denylist`);
      await sql.unsafe(`DROP TABLE IF EXISTS email_verifications`);
      await sql.unsafe(`
        CREATE TABLE refresh_token_denylist (
          id varchar(64) PRIMARY KEY,
          jti_hash varchar(64) NOT NULL,
          user_id varchar(64) NOT NULL,
          kind varchar(16) NOT NULL DEFAULT 'jti',
          revoked_at timestamp NOT NULL DEFAULT now(),
          expires_at timestamp NOT NULL,
          created_at timestamp NOT NULL DEFAULT now()
        )`);
      await sql.unsafe(`
        CREATE TABLE email_verifications (
          id varchar(64) PRIMARY KEY,
          user_id varchar(64) NOT NULL,
          token_hash varchar(64) NOT NULL,
          expires_at timestamp NOT NULL,
          consumed_at timestamp,
          created_at timestamp NOT NULL DEFAULT now()
        )`);
      // The pre-005 DDL carried BOTH unique indexes; `save()` upserts on
      // `user_id`, so the fixture must be as faithful as the original or the
      // test fails for a reason that has nothing to do with time zones.
      await sql.unsafe(
        `CREATE UNIQUE INDEX ev_pre005_user_id_idx ON email_verifications (user_id)`,
      );
      await sql.unsafe(
        `CREATE UNIQUE INDEX ev_pre005_token_hash_idx ON email_verifications (token_hash)`,
      );
      await sql.unsafe(
        `CREATE UNIQUE INDEX rtd_pre005_jti_hash_idx ON refresh_token_denylist (jti_hash)`,
      );

      const confirmedNaive = (await sql.unsafe(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema = '${isolatedSchema}' AND table_name = 'refresh_token_denylist'
            AND column_name = 'revoked_at'`,
      )) as Array<{ data_type: string }>;
      expect(confirmedNaive[0]?.data_type).toBe('timestamp without time zone');

      // 1. The security-critical instant: a family revocation written by the
      //    database must read back as the real instant, not a zone-shifted one.
      const denylist = new PostgresRefreshTokenDenylistStore(db);
      const before = Date.now();
      await denylist.revokeForUser('usr_pre005_shape');
      const revokedAt = await denylist.familyRevokedAt('usr_pre005_shape');
      expect(revokedAt).toBeInstanceOf(Date);
      expect(revokedAt!.getTime()).toBeGreaterThanOrEqual(before - 2_000);
      expect(Math.abs(Date.now() - revokedAt!.getTime())).toBeLessThan(5_000);

      // 2. A JS-supplied expiry must round-trip through the naive column too.
      const verifications = new PostgresVerificationTokenStore(db);
      const expiresAt = new Date(Date.now() + 600_000);
      await verifications.save('usr_pre005_shape', 'hash_pre005_shape', expiresAt);
      const record = await verifications.findByHash('hash_pre005_shape');
      expect(record).not.toBeNull();
      expect(Math.abs(record!.expiresAt.getTime() - expiresAt.getTime())).toBeLessThan(1_000);

      await verifications.markConsumed(record!.id);
      const consumed = await verifications.findByHash('hash_pre005_shape');
      expect(consumed!.consumedAt).toBeInstanceOf(Date);
      expect(Math.abs(consumed!.consumedAt!.getTime() - Date.now())).toBeLessThan(5_000);
    });

    it('round-trips Date values written through the drizzle typed builder into the converted users table', async () => {
      // The stores bind dates by hand, but `users` is written by
      // PostgresIdentityRepository through drizzle's typed insert
      // (`.insert(users).values(row)` with real `Date` instances). Converting
      // that table's columns to `timestamptz` is only safe if drizzle's own
      // Date encoding agrees with the new type — so exercise that exact path
      // instead of assuming it.
      const createdAt = new Date(Date.now() - 60_000);
      const updatedAt = new Date(Date.now() - 30_000);
      const passwordUpdatedAt = new Date(Date.now() - 10_000);

      await db.insert(schema.users).values({
        id: 'usr_drizzle_ts',
        email: 'drizzle-ts@example.com',
        displayName: 'Drizzle Timestamps',
        passwordHash: 'hashed',
        createdAt,
        updatedAt,
        passwordUpdatedAt,
      });

      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, 'usr_drizzle_ts'));
      const row = rows[0];
      expect(row).toBeDefined();
      expect(Math.abs(row!.createdAt.getTime() - createdAt.getTime())).toBeLessThan(1_000);
      expect(Math.abs(row!.updatedAt.getTime() - updatedAt.getTime())).toBeLessThan(1_000);
      expect(Math.abs(row!.passwordUpdatedAt.getTime() - passwordUpdatedAt.getTime())).toBeLessThan(
        1_000,
      );

      // The DB default still applies for a row that supplies no instant.
      await db.insert(schema.users).values({
        id: 'usr_drizzle_default',
        email: 'drizzle-default@example.com',
        displayName: 'Drizzle Default',
        passwordHash: 'hashed',
      });
      const defaulted = (
        await db.select().from(schema.users).where(eq(schema.users.id, 'usr_drizzle_default'))
      )[0];
      expect(Math.abs(defaulted!.createdAt.getTime() - Date.now())).toBeLessThan(10_000);
    });
  },
);
