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

export class PostgresOAuthStateStore implements OAuthStateStore {
  /**
   * Idempotent schema bootstrap — the estate-wide convention (CREATE TABLE
   * IF NOT EXISTS on startup, wired alongside the identity `users` table).
   */
  async ensureTable(): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS oauth_states (
        id varchar(64) PRIMARY KEY,
        state_hash varchar(64) NOT NULL,
        expires_at timestamp NOT NULL,
        consumed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS oauth_states_hash_idx ON oauth_states (state_hash)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS oauth_states_expires_idx ON oauth_states (expires_at)`,
    );
  }

  async save(stateHash: string, expiresAt: Date): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`
      INSERT INTO oauth_states (id, state_hash, expires_at, consumed_at, created_at)
      VALUES (${sql.param(randomUUID())}, ${sql.param(stateHash)}, ${sql.param(expiresAt)}, NULL, now())
      ON CONFLICT (state_hash) DO UPDATE SET
        expires_at = EXCLUDED.expires_at,
        consumed_at = NULL
    `);
  }

  async consume(stateHash: string): Promise<boolean> {
    const db = getDatabase();
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
