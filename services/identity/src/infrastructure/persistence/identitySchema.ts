// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Schema Statements (single source of truth)
//
// Remediation B: every identity table's DDL lives HERE exactly once. Both
// consumers import these arrays instead of carrying their own copy of the
// SQL:
//   • migrations.ts        — the versioned, ledger-recorded path
//                            (authoritative; runs at boot, awaited).
//   • <store>.ensureTable() — the per-store defensive fallback used by the
//                            DI registration and by dev/test bootstrap.
//
// Every statement is idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT
// EXISTS`) so running either path against an existing database is a no-op
// and never destroys data. The statements are drizzle `SQL` objects, so
// they bind identically through `db.execute(...)` in both paths.
//
// NO DATE PARAMETERS: no statement binds a JS `Date` (defaults use the
// database's own `now()`). Binding a `Date` through drizzle's `sql.param()`
// is the defect that previously made every identity store write throw in
// production/staging (see RefreshTokenDenylistStore.claim and
// RefreshTokenDenylistStore.postgres.test.ts).
//
// TZ-AWARE INSTANTS: every instant column is declared `timestamptz`. A
// `timestamp WITHOUT time zone` holds no offset, so its value only means
// anything relative to the session's zone, and a reader in a different zone
// silently shifts it — the defect fixed on 2026-10-15, which widened the
// post-logout revocation gap and could accept expired verification tokens.
// Fresh databases therefore get the unambiguous type directly. Migration
// `005_timestamptz_instants` performs the same conversion for databases
// created before this change (running either path is a no-op for the other).
// ──────────────────────────────────────────────────────────────────

import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

/**
 * `users` — the identity record.
 *
 * Mirrors `schema/users.ts` column-for-column. The 4 `ALTER TABLE ... ADD
 * COLUMN IF NOT EXISTS` statements exist because `CREATE TABLE IF NOT
 * EXISTS` does NOT add columns to a table that already exists (first-login
 * profile setup, SPRINT-041B). They never overwrite stored values — the new
 * columns are NULL until the user saves.
 *
 * The unique indexes on status/createdAt declared in the drizzle schema are
 * deliberately NOT created: a unique index on status (two users both
 * 'pending') or on createdAt would break multi-user operation.
 */
export const USERS_SCHEMA_STATEMENTS: SQL[] = [
  sql`
      CREATE TABLE IF NOT EXISTS users (
        id varchar(64) PRIMARY KEY,
        email varchar(255) NOT NULL,
        email_verified boolean NOT NULL DEFAULT false,
        display_name varchar(100) NOT NULL,
        given_name varchar(100),
        family_name varchar(100),
        avatar_url text,
        bio text,
        timezone varchar(64),
        locale varchar(10),
        age integer,
        gender varchar(32),
        purpose varchar(64),
        primary_goal varchar(200),
        theme varchar(16) NOT NULL DEFAULT 'system',
        language varchar(10) NOT NULL DEFAULT 'en',
        notifications_enabled boolean NOT NULL DEFAULT true,
        email_notifications boolean NOT NULL DEFAULT true,
        push_notifications boolean NOT NULL DEFAULT true,
        weekly_digest boolean NOT NULL DEFAULT false,
        reduced_motion boolean NOT NULL DEFAULT false,
        reduced_transparency boolean NOT NULL DEFAULT false,
        two_factor_enabled boolean NOT NULL DEFAULT false,
        session_timeout_minutes integer NOT NULL DEFAULT 60,
        login_notifications boolean NOT NULL DEFAULT true,
        profile_visibility varchar(16) NOT NULL DEFAULT 'private',
        show_online_status boolean NOT NULL DEFAULT true,
        allow_data_sharing boolean NOT NULL DEFAULT false,
        preferred_auth_method varchar(16) NOT NULL DEFAULT 'any',
        status_state varchar(16) NOT NULL DEFAULT 'pending',
        status_reason text,
        status_changed_at timestamptz,
        entity_status varchar(16) NOT NULL DEFAULT 'active',
        password_hash text NOT NULL,
        password_updated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        google_id varchar(128),
        auth_provider varchar(32) NOT NULL DEFAULT 'email'
      );
    `,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email)`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id)`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS age integer`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender varchar(32)`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS purpose varchar(64)`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_goal varchar(200)`,
];

/**
 * `refresh_token_denylist` — revoked refresh-token JTIs (hash only) plus the
 * user-wide session-family markers written by `revokeForUser()` (kind =
 * 'family'). The unique index on `jti_hash` is the arbiter that makes
 * rotation claims single-use under concurrency.
 */
export const REFRESH_TOKEN_DENYLIST_SCHEMA_STATEMENTS: SQL[] = [
  sql`
      CREATE TABLE IF NOT EXISTS refresh_token_denylist (
        id varchar(64) PRIMARY KEY,
        jti_hash varchar(64) NOT NULL,
        user_id varchar(64) NOT NULL,
        kind varchar(16) NOT NULL DEFAULT 'jti',
        revoked_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS rtd_jti_hash_idx ON refresh_token_denylist (jti_hash)`,
  sql`CREATE INDEX IF NOT EXISTS rtd_user_id_idx ON refresh_token_denylist (user_id)`,
];

/** `oauth_states` — single-use Google OAuth `state` hashes. */
export const OAUTH_STATES_SCHEMA_STATEMENTS: SQL[] = [
  sql`
      CREATE TABLE IF NOT EXISTS oauth_states (
        id varchar(64) PRIMARY KEY,
        state_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS oauth_states_hash_idx ON oauth_states (state_hash)`,
  sql`CREATE INDEX IF NOT EXISTS oauth_states_expires_idx ON oauth_states (expires_at)`,
];

/** `email_verifications` — single-use, expiring email-verification tokens. */
export const EMAIL_VERIFICATIONS_SCHEMA_STATEMENTS: SQL[] = [
  sql`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        token_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS ev_user_id_idx ON email_verifications (user_id)`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS ev_token_hash_idx ON email_verifications (token_hash)`,
  sql`CREATE INDEX IF NOT EXISTS ev_expires_at_idx ON email_verifications (expires_at)`,
];

/** Execute one statement list sequentially against a drizzle database. */
export async function executeStatements(
  db: { execute(query: SQL): Promise<unknown> },
  statements: SQL[],
): Promise<void> {
  for (const statement of statements) {
    await db.execute(statement);
  }
}
