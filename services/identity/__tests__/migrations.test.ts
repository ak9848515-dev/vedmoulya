// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Versioned Migrations (remediation B) — hermetic tests
//
// No database: the executor is an in-memory fake that interprets the drizzle
// SQL objects the migration module emits (the same chunk-inspection technique
// PostgresIdentityRepository.test.ts uses). The real-engine ledger behaviour
// is proven separately in migrations.postgres.test.ts.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import {
  IDENTITY_MIGRATIONS,
  MIGRATION_LEDGER_TABLE,
  appliedMigrationIds,
  assertIdentitySchemaCurrent,
  ensureIdentitySchema,
  migrationStatus,
  pendingMigrations,
  resetIdentitySchemaBootstrap,
  rollbackIdentityMigrations,
  runIdentityMigrations,
  schemaVersion,
  type MigrationExecutor,
} from '../src/infrastructure/persistence/migrations.js';

// ── SQL inspection ───────────────────────────────────────────────────────

/**
 * Flatten a drizzle SQL object into `{ text, params }`. Interpolated values
 * appear in `queryChunks` as the raw JS values (plain strings for these
 * migrations); DDL text appears as StringChunk `value: string[]` entries.
 */
function describeQuery(query: unknown): { text: string; params: unknown[] } {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];
  let text = '';
  const params: unknown[] = [];
  for (const chunk of chunks) {
    if (typeof chunk === 'string') {
      params.push(chunk);
      text += '?';
      continue;
    }
    const value = (chunk as { value?: unknown } | null)?.value;
    if (Array.isArray(value)) {
      text += value.join('');
      continue;
    }
    if (value !== undefined) {
      params.push(value);
      text += '?';
      continue;
    }
    params.push(chunk);
    text += '?';
  }
  return { text, params };
}

// ── Fake engine ──────────────────────────────────────────────────────────

interface FakeEngine {
  db: MigrationExecutor;
  /** Ledger rows, in insertion order: [id, description]. */
  ledger: Array<[string, string]>;
  /** Tables the fake has "created" (CREATE TABLE executed successfully). */
  tables: Set<string>;
  /** Every statement text the executor received, in order. */
  statements: string[];
  /** Make the next statement matching this predicate reject. */
  failWhen: (text: string) => boolean;
}

function makeEngine(
  options: { ledgerReady?: boolean; failWhen?: (text: string) => boolean } = {},
): FakeEngine {
  const engine: FakeEngine = {
    db: {
      execute(query: SQL): Promise<unknown> {
        const { text, params } = describeQuery(query);
        engine.statements.push(text);
        if (engine.failWhen(text)) {
          return Promise.reject(new Error(`simulated engine failure: ${text.slice(0, 40)}`));
        }
        if (/CREATE TABLE IF NOT EXISTS identity_schema_migrations/.test(text))
          return Promise.resolve([]);
        // INSERT/DELETE are checked BEFORE the SELECT branches: a DELETE also
        // contains `FROM <ledger>`, so order matters in this fake.
        if (text.includes(`INSERT INTO ${MIGRATION_LEDGER_TABLE}`)) {
          const [id, description] = params as [string, string];
          if (!engine.ledger.some(([existing]) => existing === id)) {
            engine.ledger.push([id, description]);
          }
          return Promise.resolve([]);
        }
        if (text.includes(`DELETE FROM ${MIGRATION_LEDGER_TABLE}`)) {
          const [id] = params as [string];
          engine.ledger = engine.ledger.filter(([existing]) => existing !== id);
          return Promise.resolve([]);
        }
        if (text.includes(`FROM ${MIGRATION_LEDGER_TABLE}`) && text.includes('applied_at')) {
          return Promise.resolve(
            engine.ledger.map(([id, description]) => ({
              id,
              description,
              applied_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            })),
          );
        }
        if (text.includes(`FROM ${MIGRATION_LEDGER_TABLE}`)) {
          return Promise.resolve(engine.ledger.map(([id]) => ({ id })));
        }
        const created = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(text);
        if (created?.[1]) engine.tables.add(created[1]);
        const dropped = /DROP TABLE IF EXISTS (\w+)/.exec(text);
        if (dropped?.[1]) engine.tables.delete(dropped[1]);
        return Promise.resolve([]);
      },
    },
    ledger: [],
    tables: new Set(),
    statements: [],
    failWhen: options.failWhen ?? (() => false),
  };
  return engine;
}

// ── Registry integrity ───────────────────────────────────────────────────

describe('IDENTITY_MIGRATIONS registry', () => {
  it('is ordered, unique, and covers every identity table', () => {
    const ids = IDENTITY_MIGRATIONS.map((m) => m.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      '001_users',
      '002_refresh_token_denylist',
      '003_oauth_states',
      '004_email_verifications',
    ]);
    for (const migration of IDENTITY_MIGRATIONS) {
      expect(migration.description.length).toBeGreaterThan(0);
    }
  });

  it('records versions in a dedicated ledger table', () => {
    expect(MIGRATION_LEDGER_TABLE).toBe('identity_schema_migrations');
  });

  it('never issues a destructive statement on the way FORWARD', async () => {
    const engine = makeEngine();
    await runIdentityMigrations(engine.db);
    const forward = engine.statements.filter((text) => !text.includes(MIGRATION_LEDGER_TABLE));
    expect(forward.some((text) => text.includes('DROP '))).toBe(false);
  });
});

// ── Applying, recording, skipping ────────────────────────────────────────

describe('runIdentityMigrations', () => {
  it('applies every pending migration in order and records each one', async () => {
    const engine = makeEngine();
    const result = await runIdentityMigrations(engine.db);

    expect(result.applied).toEqual(IDENTITY_MIGRATIONS.map((m) => m.id));
    expect(result.alreadyApplied).toEqual([]);
    // The ledger holds exactly one row per migration.
    expect(engine.ledger.map(([id]) => id)).toEqual(IDENTITY_MIGRATIONS.map((m) => m.id));
    // The tables the migrations describe now exist in the fake engine.
    expect([...engine.tables].sort()).toEqual([
      'email_verifications',
      'oauth_states',
      'refresh_token_denylist',
      'users',
    ]);
  });

  it('is idempotent — a second run applies nothing and records nothing new', async () => {
    const engine = makeEngine();
    await runIdentityMigrations(engine.db);
    const ledgerAfterFirst = [...engine.ledger];

    const second = await runIdentityMigrations(engine.db);
    expect(second.applied).toEqual([]);
    expect(second.alreadyApplied).toEqual(IDENTITY_MIGRATIONS.map((m) => m.id));
    expect(engine.ledger).toEqual(ledgerAfterFirst);
  });

  it('adopts a brownfield database — re-running DDL against existing tables is a no-op', async () => {
    const engine = makeEngine();
    // A database whose tables were created by the per-store ensureTable()
    // fallbacks BEFORE the versioned path existed: no ledger rows, tables present.
    for (const table of [
      'users',
      'refresh_token_denylist',
      'oauth_states',
      'email_verifications',
    ]) {
      engine.tables.add(table);
    }
    const result = await runIdentityMigrations(engine.db);
    expect(result.applied).toEqual(IDENTITY_MIGRATIONS.map((m) => m.id));
    expect([...engine.tables].sort()).toEqual([
      'email_verifications',
      'oauth_states',
      'refresh_token_denylist',
      'users',
    ]);
  });

  it('keeps the ledger honest when a migration fails halfway through', async () => {
    const engine = makeEngine({
      failWhen: (text) => text.includes('CREATE TABLE IF NOT EXISTS oauth_states'),
    });
    await expect(runIdentityMigrations(engine.db)).rejects.toThrow(/simulated engine failure/);

    // 001 + 002 are recorded; the failed step and everything after stay pending.
    expect(engine.ledger.map(([id]) => id)).toEqual(['001_users', '002_refresh_token_denylist']);
    const pending = await pendingMigrations(engine.db);
    expect(pending.map((m) => m.id)).toEqual(['003_oauth_states', '004_email_verifications']);

    // The retry resumes from the failed step instead of replaying the whole set.
    engine.failWhen = () => false;
    const retry = await runIdentityMigrations(engine.db);
    expect(retry.applied).toEqual(['003_oauth_states', '004_email_verifications']);
    expect(engine.ledger.map(([id]) => id)).toEqual(IDENTITY_MIGRATIONS.map((m) => m.id));
  });
});

// ── Introspection ────────────────────────────────────────────────────────

describe('migrationStatus / schemaVersion', () => {
  it('reports every migration as pending on a database that never ran the versioned path', async () => {
    const engine = makeEngine();
    const status = await migrationStatus(engine.db);
    expect(status.map((entry) => entry.appliedAt)).toEqual([null, null, null, null]);
    expect(await schemaVersion(engine.db)).toBeNull();
  });

  it('reports applied timestamps and the highest applied version', async () => {
    const engine = makeEngine();
    await runIdentityMigrations(engine.db);
    const status = await migrationStatus(engine.db);
    expect(status.every((entry) => entry.appliedAt instanceof Date)).toBe(true);
    expect(await schemaVersion(engine.db)).toBe('004_email_verifications');
  });
});

// ── Readiness gate ───────────────────────────────────────────────────────

describe('assertIdentitySchemaCurrent', () => {
  it('passes and returns the version when nothing is pending', async () => {
    const engine = makeEngine();
    await runIdentityMigrations(engine.db);
    await expect(assertIdentitySchemaCurrent(engine.db)).resolves.toBe('004_email_verifications');
  });

  it('throws with the pending ids when the database is behind the code', async () => {
    const engine = makeEngine();
    // Drift: someone removed the ledger row for 003 while the objects remain.
    engine.ledger = [
      ['001_users', 'users'],
      ['002_refresh_token_denylist', 'denylist'],
    ];
    await expect(assertIdentitySchemaCurrent(engine.db)).rejects.toThrow(
      /2 pending migration\(s\) \[003_oauth_states, 004_email_verifications\]/,
    );
  });
});

// ── Rollback ─────────────────────────────────────────────────────────────

describe('rollbackIdentityMigrations', () => {
  it('reverses applied migrations in reverse order and clears their ledger rows', async () => {
    const engine = makeEngine();
    await runIdentityMigrations(engine.db);

    const rolledBack = await rollbackIdentityMigrations(engine.db);
    expect(rolledBack).toEqual([
      '004_email_verifications',
      '003_oauth_states',
      '002_refresh_token_denylist',
      '001_users',
    ]);
    expect(engine.ledger).toEqual([]);
    expect(engine.tables.size).toBe(0);
  });

  it('stops at the requested target version', async () => {
    const engine = makeEngine();
    await runIdentityMigrations(engine.db);

    const rolledBack = await rollbackIdentityMigrations(engine.db, { to: '001_users' });
    expect(rolledBack).toEqual([
      '004_email_verifications',
      '003_oauth_states',
      '002_refresh_token_denylist',
    ]);
    expect(await appliedMigrationIds(engine.db)).toEqual(['001_users']);
    expect(engine.tables.has('users')).toBe(true);
    expect(engine.tables.has('oauth_states')).toBe(false);
  });

  it('refuses an unknown target WITHOUT touching the database', async () => {
    const engine = makeEngine();
    await runIdentityMigrations(engine.db);
    const before = engine.statements.length;

    await expect(rollbackIdentityMigrations(engine.db, { to: 'nope' })).rejects.toThrow(
      /Unknown migration id for rollback target: nope/,
    );
    expect(engine.statements.length).toBe(before);
  });

  it('rolls back only migrations that were actually applied', async () => {
    const engine = makeEngine();
    engine.ledger = [['001_users', 'users']];
    engine.tables.add('users');

    const rolledBack = await rollbackIdentityMigrations(engine.db);
    expect(rolledBack).toEqual(['001_users']);
    expect(engine.tables.size).toBe(0);
  });
});

// ── Single-flight bootstrap ──────────────────────────────────────────────

describe('ensureIdentitySchema (process-wide single flight)', () => {
  it('runs the migration set exactly once for concurrent callers', async () => {
    resetIdentitySchemaBootstrap();
    const engine = makeEngine();
    const execute = vi.fn(engine.db.execute.bind(engine.db));
    const db: MigrationExecutor = { execute: (query) => execute(query) };

    const [a, b, c] = await Promise.all([
      ensureIdentitySchema(db),
      ensureIdentitySchema(db),
      ensureIdentitySchema(db),
    ]);
    expect(a.applied).toEqual(IDENTITY_MIGRATIONS.map((m) => m.id));
    expect(b).toBe(a);
    expect(c).toBe(a);
    // One ledger setup + 4 migration statements + 1 ledger SELECT + 4 ledger
    // writes — the set ran once, not three times.
    expect(engine.ledger).toHaveLength(IDENTITY_MIGRATIONS.length);
    expect(engine.tables.size).toBe(4);
    resetIdentitySchemaBootstrap();
  });

  it('clears the memo on failure so a retry re-attempts', async () => {
    resetIdentitySchemaBootstrap();
    const engine = makeEngine({
      failWhen: (text) => text.includes('CREATE TABLE IF NOT EXISTS users'),
    });
    await expect(ensureIdentitySchema(engine.db)).rejects.toThrow(/simulated engine failure/);

    engine.failWhen = () => false;
    const retry = await ensureIdentitySchema(engine.db);
    expect(retry.applied).toEqual(IDENTITY_MIGRATIONS.map((m) => m.id));
    resetIdentitySchemaBootstrap();
  });
});
