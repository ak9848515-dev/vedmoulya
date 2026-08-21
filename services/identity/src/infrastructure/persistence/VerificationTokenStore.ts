// ──────────────────────────────────────────────────────────────────
// VedMoulya — Email Verification Token Store
// Persists email-verification tokens (SPRINT-045 — PRODUCTION EMAIL
// VERIFICATION). Only the SHA-256 hash of a token is ever stored; the raw
// token travels exclusively inside the emailed verification link.
// One active token per user (upsert); consumption is single-use.
// ──────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDatabase } from './DatabaseConnection.js';

export interface VerificationTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface VerificationTokenStore {
  /** Store a new token for a user, replacing any previous unexpired one. */
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;

  /** Look up a token by its hash (null when unknown). */
  findByHash(tokenHash: string): Promise<VerificationTokenRecord | null>;

  /** Mark a token consumed (single-use). */
  markConsumed(id: string): Promise<void>;

  /** Remove any existing token for a user (used by resend to invalidate). */
  revokeForUser(userId: string): Promise<void>;
}

// ── Postgres ─────────────────────────────────────────────────────────────

export class PostgresVerificationTokenStore implements VerificationTokenStore {
  /**
   * Idempotent schema bootstrap — the estate-wide convention (CREATE TABLE
   * IF NOT EXISTS on startup, wired alongside the identity `users` table).
   */
  async ensureTable(): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        token_hash varchar(64) NOT NULL,
        expires_at timestamp NOT NULL,
        consumed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS ev_user_id_idx ON email_verifications (user_id)`,
    );
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS ev_token_hash_idx ON email_verifications (token_hash)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS ev_expires_at_idx ON email_verifications (expires_at)`,
    );
  }

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`
      INSERT INTO email_verifications (id, user_id, token_hash, expires_at, consumed_at, created_at)
      VALUES (${sql.param(randomUUID())}, ${sql.param(userId)}, ${sql.param(tokenHash)}, ${sql.param(expiresAt)}, NULL, now())
      ON CONFLICT (user_id) DO UPDATE SET
        token_hash = EXCLUDED.token_hash,
        expires_at = EXCLUDED.expires_at,
        consumed_at = NULL
    `);
  }

  async findByHash(tokenHash: string): Promise<VerificationTokenRecord | null> {
    const db = getDatabase();
    const rows = await db.execute(sql`
      SELECT id, user_id, token_hash, expires_at, consumed_at
      FROM email_verifications
      WHERE token_hash = ${sql.param(tokenHash)}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      tokenHash: String(row.token_hash),
      expiresAt: new Date(row.expires_at as string),
      consumedAt: row.consumed_at ? new Date(row.consumed_at as string) : null,
    };
  }

  async markConsumed(id: string): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`
      UPDATE email_verifications SET consumed_at = now() WHERE id = ${sql.param(id)}
    `);
  }

  async revokeForUser(userId: string): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`
      UPDATE email_verifications SET consumed_at = now() WHERE user_id = ${sql.param(userId)}
    `);
  }
}

// ── In-Memory (hermetic tests) ───────────────────────────────────────────

export class InMemoryVerificationTokenStore implements VerificationTokenStore {
  private readonly records = new Map<string, VerificationTokenRecord>();

  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const existing = [...this.records.values()].find((r) => r.userId === userId);
    if (existing) this.records.delete(existing.id);
    this.records.set(tokenHash, {
      id: randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      consumedAt: null,
    });
    return Promise.resolve();
  }

  findByHash(tokenHash: string): Promise<VerificationTokenRecord | null> {
    return Promise.resolve(this.records.get(tokenHash) ?? null);
  }

  markConsumed(id: string): Promise<void> {
    for (const record of this.records.values()) {
      if (record.id === id) record.consumedAt = new Date();
    }
    return Promise.resolve();
  }

  revokeForUser(userId: string): Promise<void> {
    for (const record of this.records.values()) {
      if (record.userId === userId) record.consumedAt = new Date();
    }
    return Promise.resolve();
  }
}

/** Env-driven factory — Postgres in production/staging, in-memory otherwise. */
export function createVerificationTokenStore(): VerificationTokenStore {
  const env: string = process.env.NODE_ENV ?? 'development';
  if (env === 'production' || env === 'staging') {
    return new PostgresVerificationTokenStore();
  }
  return new InMemoryVerificationTokenStore();
}
