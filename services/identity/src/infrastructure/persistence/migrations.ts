// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Versioned Migrations (remediation B)
//
// WHY THIS EXISTS
// The estate convention is "run `CREATE TABLE IF NOT EXISTS` at startup".
// That keeps fresh databases working but gives an operator NO WAY to answer
// the questions that decide whether a deploy is safe:
//   • which schema changes has THIS database actually received?
//   • is this database behind the code that is about to serve traffic?
//   • what does the change consist of, and how is it undone?
// Convergence-by-DDL also silently tolerates a missing statement: nothing
// records that a migration never ran, so a schema drift shows up later as a
// confusing "column does not exist" at request time.
//
// This module adds the MINIMUM versioned layer that closes those gaps
// without introducing a second orchestration system:
//   • `identity_schema_migrations` — the ledger (version = its rows).
//   • IDENTITY_MIGRATIONS        — ordered, idempotent, reversible steps.
//   • runIdentityMigrations()    — apply pending steps once, in order, and
//                                  RECORD each one; already-applied steps are
//                                  skipped, never re-run.
//   • migrationStatus()/schemaVersion() — operator introspection (what version
//                                  is this database at?).
//   • assertIdentitySchemaCurrent() — fail-fast gate: pending work is an
//                                  explicit error instead of silent drift.
//
// SCOPE NOTE (no silent behaviour switch): the drift gate above is EXPORTED,
// NOT yet wired into the running /health/ready probe. Boot applies every
// pending migration before traffic can arrive, so a healthy process is never
// served a stale schema; wiring the gate into readiness would additionally
// turn "database is behind" into a 503 and is therefore left to an explicit
// operator/platform-owner decision rather than switched on here.
//   • rollbackIdentityMigrations()  — explicit, operator-invoked reversal
//                                  (never called at boot).
//
// SAFETY
// Every `up()` is idempotent, so the FIRST run against a brownfield database
// (tables already created by the per-store `ensureTable()` fallbacks) is
// adopted: the DDL is a no-op and the ledger simply records the version.
// No migration destroys data on the way forward; `down()` does drop objects
// and therefore only runs when an operator calls rollback explicitly.
//
// NO DATE BINDING: the ledger uses the database's own `now()` default and
// string keys only. Binding a JS `Date` through postgres-js is the defect
// that made every identity store write throw in production (see
// RefreshTokenDenylistStore.claim).
// ──────────────────────────────────────────────────────────────────

import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { getDatabase } from './DatabaseConnection.js';
import {
  EMAIL_VERIFICATIONS_SCHEMA_STATEMENTS,
  OAUTH_STATES_SCHEMA_STATEMENTS,
  REFRESH_TOKEN_DENYLIST_SCHEMA_STATEMENTS,
  USERS_SCHEMA_STATEMENTS,
  executeStatements,
} from './identitySchema.js';

/** The drizzle identity database (or an injected dedicated pool in tests). */
export type IdentityDatabase = ReturnType<typeof getDatabase>;

/** Minimal executor surface shared by the real pool and the test doubles. */
export interface MigrationExecutor {
  execute(query: SQL): Promise<unknown>;
}

export const MIGRATION_LEDGER_TABLE = 'identity_schema_migrations';

export interface IdentityMigration {
  /** Stable, ordered identifier. Ordered lexicographically → zero-padded. */
  id: string;
  description: string;
  /** Apply the change (idempotent — safe to re-run). */
  up: (db: MigrationExecutor) => Promise<void>;
  /** Reverse the change (idempotent — safe to re-run). */
  down: (db: MigrationExecutor) => Promise<void>;
}

/** The ledger: one row per applied migration. Created before anything runs. */
const LEDGER_STATEMENTS: SQL[] = [
  sql`
      CREATE TABLE IF NOT EXISTS identity_schema_migrations (
        id varchar(128) PRIMARY KEY,
        description text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `,
];

/**
 * 001 — `users`. Extracted verbatim from the PostgresIdentityRepository
 * bootstrap so both paths emit byte-identical DDL.
 */
export const MIGRATION_001_USERS: IdentityMigration = {
  id: '001_users',
  description: 'Create users table, unique indexes, and the first-login profile columns',
  up: (db) => executeStatements(db, USERS_SCHEMA_STATEMENTS),
  down: (db) => executeStatements(db, [sql`DROP TABLE IF EXISTS users`]),
};

/** 002 — refresh-token denylist (+ the session-family markers). */
export const MIGRATION_002_REFRESH_TOKEN_DENYLIST: IdentityMigration = {
  id: '002_refresh_token_denylist',
  description: 'Create refresh_token_denylist with the single-use JTI arbiter index',
  up: (db) => executeStatements(db, REFRESH_TOKEN_DENYLIST_SCHEMA_STATEMENTS),
  down: (db) => executeStatements(db, [sql`DROP TABLE IF EXISTS refresh_token_denylist`]),
};

/** 003 — Google OAuth state hashes. */
export const MIGRATION_003_OAUTH_STATES: IdentityMigration = {
  id: '003_oauth_states',
  description: 'Create oauth_states for single-use OAuth state verification',
  up: (db) => executeStatements(db, OAUTH_STATES_SCHEMA_STATEMENTS),
  down: (db) => executeStatements(db, [sql`DROP TABLE IF EXISTS oauth_states`]),
};

/** 004 — email-verification tokens. */
export const MIGRATION_004_EMAIL_VERIFICATIONS: IdentityMigration = {
  id: '004_email_verifications',
  description: 'Create email_verifications with single-use token hashes',
  up: (db) => executeStatements(db, EMAIL_VERIFICATIONS_SCHEMA_STATEMENTS),
  down: (db) => executeStatements(db, [sql`DROP TABLE IF EXISTS email_verifications`]),
};

/** All identity migrations, in application order. */
export const IDENTITY_MIGRATIONS: IdentityMigration[] = [
  MIGRATION_001_USERS,
  MIGRATION_002_REFRESH_TOKEN_DENYLIST,
  MIGRATION_003_OAUTH_STATES,
  MIGRATION_004_EMAIL_VERIFICATIONS,
];

/**
 * Guard against a duplicated or misordered registry — a wrong `id` order
 * would apply steps out of sequence and leave a database at a version that
 * never existed. Throws (rather than silently sorting) so the mistake is
 * caught at boot, not at deploy time.
 */
function assertMigrationOrder(migrations: IdentityMigration[]): void {
  const ids = migrations.map((m) => m.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`Duplicate identity migration id: ${ids.join(', ')}`);
  }
  // Ascending check without index arithmetic: plain `<` on strings is the same
  // UTF-16 ordering `Array#sort()` uses, so this accepts exactly the ids whose
  // registry order is already the sorted order.
  let previous: string | undefined;
  for (const id of ids) {
    if (previous !== undefined && id < previous) {
      throw new Error(`Identity migrations are not in ascending id order: ${ids.join(', ')}`);
    }
    previous = id;
  }
}

/** Create the ledger if it does not exist (idempotent). */
export async function ensureMigrationLedger(db: MigrationExecutor): Promise<void> {
  await executeStatements(db, LEDGER_STATEMENTS);
}

interface LedgerRow {
  id?: string | null;
  description?: string | null;
  /** postgres-js decodes `timestamptz` to a `Date`; a string is tolerated. */
  applied_at?: Date | string | null;
}

/** Ids already recorded in the ledger, in ascending order. */
export async function appliedMigrationIds(db: MigrationExecutor): Promise<string[]> {
  await ensureMigrationLedger(db);
  const rows = (await db.execute(
    sql`SELECT id FROM identity_schema_migrations ORDER BY id`,
  )) as LedgerRow[];
  return rows.map((row) => String(row.id));
}

/** Migrations that have NOT been recorded yet, in application order. */
export async function pendingMigrations(db: MigrationExecutor): Promise<IdentityMigration[]> {
  assertMigrationOrder(IDENTITY_MIGRATIONS);
  const applied = new Set(await appliedMigrationIds(db));
  return IDENTITY_MIGRATIONS.filter((migration) => !applied.has(migration.id));
}

export interface MigrationRunResult {
  /** Migrations this call applied and recorded. */
  applied: string[];
  /** Migrations the ledger showed as already applied (skipped). */
  alreadyApplied: string[];
}

/**
 * Apply every pending migration ONCE, in order, recording each in the ledger
 * as it succeeds. Safe to call repeatedly and from concurrent boot paths.
 *
 * A migration is recorded only AFTER its `up()` resolves, so a failure
 * halfway through leaves the ledger honest: the applied prefix is recorded,
 * the failed step is still pending, and the next run retries from there.
 */
export async function runIdentityMigrations(db: MigrationExecutor): Promise<MigrationRunResult> {
  assertMigrationOrder(IDENTITY_MIGRATIONS);
  const pending = await pendingMigrations(db);
  const alreadyApplied = IDENTITY_MIGRATIONS.filter((m) => !pending.includes(m)).map((m) => m.id);

  const applied: string[] = [];
  for (const migration of pending) {
    await migration.up(db);
    await db.execute(sql`
      INSERT INTO identity_schema_migrations (id, description)
      VALUES (${migration.id}, ${migration.description})
      ON CONFLICT (id) DO NOTHING
    `);
    applied.push(migration.id);
  }
  return { applied, alreadyApplied };
}

export interface MigrationStatusEntry {
  id: string;
  description: string;
  /** When the ledger recorded it, or null when it is still pending. */
  appliedAt: Date | null;
}

/** Per-migration status — the operator answer to "what version is this DB?". */
export async function migrationStatus(db: MigrationExecutor): Promise<MigrationStatusEntry[]> {
  await ensureMigrationLedger(db);
  const rows = (await db.execute(
    sql`SELECT id, description, applied_at FROM identity_schema_migrations`,
  )) as LedgerRow[];
  const recorded = new Map<string, Date | null>();
  for (const row of rows) {
    const raw = row.applied_at;
    const appliedAt =
      raw === undefined || raw === null ? null : raw instanceof Date ? raw : new Date(raw);
    recorded.set(String(row.id), appliedAt);
  }
  return IDENTITY_MIGRATIONS.map((migration) => ({
    id: migration.id,
    description: migration.description,
    appliedAt: recorded.get(migration.id) ?? null,
  }));
}

/**
 * Highest applied migration id, or null on a database that has never run the
 * versioned path. This is the value a readiness/diagnostics endpoint would
 * report; it is NOT yet surfaced on /health/ready (see the scope note at the
 * top of this file).
 */
export async function schemaVersion(db: MigrationExecutor): Promise<string | null> {
  const applied = await appliedMigrationIds(db);
  const known = new Set(IDENTITY_MIGRATIONS.map((m) => m.id));
  const appliedKnown = applied.filter((id) => known.has(id));
  return appliedKnown[appliedKnown.length - 1] ?? null;
}

/**
 * Fail-fast gate: throw when the database is behind the code, so a strict
 * environment is TOLD its schema is incomplete instead of serving traffic
 * that fails intermittently on a missing column/table.
 *
 * Available for a readiness probe or a pre-deploy check; not wired into
 * /health/ready today (see the scope note at the top of this file).
 */
export async function assertIdentitySchemaCurrent(db: MigrationExecutor): Promise<string | null> {
  const pending = await pendingMigrations(db);
  if (pending.length > 0) {
    throw new Error(
      `Identity schema is behind the code: ${pending.length} pending migration(s) ` +
        `[${pending.map((m) => m.id).join(', ')}]`,
    );
  }
  return schemaVersion(db);
}

/**
 * Roll back every migration applied after `to` (or all of them when `to` is
 * omitted) in reverse order, removing each ledger row as it is reversed.
 *
 * OPERATOR-INVOKED ONLY — `down()` drops objects, so this is never called
 * from a boot path.
 */
export async function rollbackIdentityMigrations(
  db: MigrationExecutor,
  options: { to?: string } = {},
): Promise<string[]> {
  const targetIndex = options.to ? IDENTITY_MIGRATIONS.findIndex((m) => m.id === options.to) : -1;
  if (options.to && targetIndex === -1) {
    throw new Error(`Unknown migration id for rollback target: ${options.to}`);
  }
  const applied = new Set(await appliedMigrationIds(db));
  const candidates = IDENTITY_MIGRATIONS.filter((m) => applied.has(m.id)).filter(
    (_m, index) => index > targetIndex,
  );

  const rolledBack: string[] = [];
  for (const migration of [...candidates].reverse()) {
    await migration.down(db);
    await db.execute(sql`DELETE FROM identity_schema_migrations WHERE id = ${migration.id}`);
    rolledBack.push(migration.id);
  }
  return rolledBack;
}

// ── Process-wide single-flight bootstrap ─────────────────────────────────

let schemaBootstrap: Promise<MigrationRunResult> | null = null;

/**
 * Awaited, single-flight schema bootstrap. Every concurrent caller in this
 * process shares ONE migration run, so two boot paths (the gateway and the
 * web auth-app) cannot race on the same DDL — the failure mode the estate
 * previously hit on PostgreSQL system-catalog indexes.
 *
 * A rejection clears the memo so a retry after a transient connection
 * failure re-attempts, matching the retry convention of the identity
 * repository's `ddlPromise` guard.
 *
 * `db` is injectable for tests; production/DI callers pass nothing and use
 * the process-wide identity pool.
 */
export async function ensureIdentitySchema(db?: MigrationExecutor): Promise<MigrationRunResult> {
  if (schemaBootstrap) return schemaBootstrap;
  const target = db ?? getDatabase();
  schemaBootstrap = runIdentityMigrations(target);
  try {
    return await schemaBootstrap;
  } catch (error: unknown) {
    schemaBootstrap = null;
    throw error;
  }
}

/** Test-only: drop the memoized bootstrap so a suite can run it again. */
export function resetIdentitySchemaBootstrap(): void {
  schemaBootstrap = null;
}
