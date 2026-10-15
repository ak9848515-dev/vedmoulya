// ──────────────────────────────────────────────────────────────────
// VedMoulya — Google OAuth State Store
// Persists OAuth `state` values so the identity service can verify, on the
// callback, that IT is the party that issued the state. Only the SHA-256
// hash is stored; the raw state exists only inside the redirect.
//
// Consumption is single-use and time-bounded: the Postgres implementation
// consumes with one atomic `UPDATE ... WHERE consumed_at IS NULL AND
// expires_at > now() RETURNING`, so two concurrent callbacks carrying the
// same state cannot both succeed. This mirrors the EXISTING
// VerificationTokenStore pattern (SPRINT-045) — no second auth system.
// ──────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDatabase } from './DatabaseConnection.js';
import { OAUTH_STATES_SCHEMA_STATEMENTS, executeStatements } from './identitySchema.js';

export interface OAuthStateStore {
  /** Persist a state hash with its expiry. */
  save(stateHash: string, expiresAt: Date): Promise<void>;

  /**
   * Atomically consume a state. Returns TRUE only for a state that exists,
   * has not been consumed, and has not expired. A repeated call with the
   * same value returns FALSE (single-use).
   */
  consume(stateHash: string): Promise<boolean>;
}

// ── Postgres ─────────────────────────────────────────────────────────────

type IdentityDatabase = ReturnType<typeof getDatabase>;

export class PostgresOAuthStateStore implements OAuthStateStore {
  /**
   * `db` is injectable so real-engine tests can run against a dedicated
   * pool; production wiring passes nothing and shares the process-wide
   * identity pool (unchanged behaviour).
   */
  constructor(private readonly injectedDb?: IdentityDatabase) {}

  private database(): IdentityDatabase {
    return this.injectedDb ?? getDatabase();
  }

  /**
   * Idempotent schema bootstrap — the estate-wide convention (CREATE TABLE
   * IF NOT EXISTS on startup, wired alongside the identity `users` table).
   */
  async ensureTable(): Promise<void> {
    // Statements come from `identitySchema.ts`, the same source the versioned
    // migration `003_oauth_states` uses (remediation B — no duplicated DDL).
    await executeStatements(this.database(), OAUTH_STATES_SCHEMA_STATEMENTS);
  }

  async save(stateHash: string, expiresAt: Date): Promise<void> {
    const db = this.database();
    await db.execute(sql`
      INSERT INTO oauth_states (id, state_hash, expires_at, consumed_at, created_at)
      -- expires_at is bound as an ISO-8601 string with an explicit cast:
      -- passing a JS Date made postgres-js reject it (ERR_INVALID_ARG_TYPE),
      -- which made state persistence throw in production/staging and blocked
      -- Google sign-in. Covered by identity-stores.postgres.test.ts.
      VALUES (${sql.param(randomUUID())}, ${sql.param(stateHash)}, ${expiresAt.toISOString()}::timestamptz, NULL, now())
      ON CONFLICT (state_hash) DO UPDATE SET
        expires_at = EXCLUDED.expires_at,
        consumed_at = NULL
    `);
  }

  async consume(stateHash: string): Promise<boolean> {
    const db = this.database();
    // Single atomic statement: only the first callback can flip consumed_at.
    const rows = await db.execute(sql`
      UPDATE oauth_states SET consumed_at = now()
      WHERE state_hash = ${sql.param(stateHash)}
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING id
    `);
    return rows.length > 0;
  }
}

// ── In-Memory (hermetic tests / local development) ─────────────────────────

export class InMemoryOAuthStateStore implements OAuthStateStore {
  private readonly records = new Map<string, { expiresAt: Date; consumedAt: Date | null }>();

  save(stateHash: string, expiresAt: Date): Promise<void> {
    this.records.set(stateHash, { expiresAt, consumedAt: null });
    return Promise.resolve();
  }

  consume(stateHash: string): Promise<boolean> {
    const record = this.records.get(stateHash);
    if (!record) return Promise.resolve(false);
    if (record.consumedAt !== null) return Promise.resolve(false);
    if (record.expiresAt.getTime() <= Date.now()) return Promise.resolve(false);
    record.consumedAt = new Date();
    return Promise.resolve(true);
  }
}

/** Env-driven factory — Postgres in production/staging, in-memory otherwise. */
export function createOAuthStateStore(): OAuthStateStore {
  const env: string = process.env.NODE_ENV ?? 'development';
  if (env === 'production' || env === 'staging') {
    return new PostgresOAuthStateStore();
  }
  return new InMemoryOAuthStateStore();
}
