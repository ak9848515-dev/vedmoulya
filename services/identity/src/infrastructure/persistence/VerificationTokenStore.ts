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
import { EMAIL_VERIFICATIONS_SCHEMA_STATEMENTS, executeStatements } from './identitySchema.js';

export interface VerificationTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

/** Shape of a row returned by the verification-token read. */
interface VerificationRow {
  id?: string | null;
  user_id?: string | null;
  token_hash?: string | null;
  expires_at?: Date | string | null;
  consumed_at?: Date | string | null;
}

/**
 * Decode a read-back instant. SQL already normalised it to an absolute
 * instant (`AT TIME ZONE current_setting('TimeZone')`), so this only has to
 * turn the driver's `Date` (or a string form) into a `Date`.
 */
function toInstant(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(value);
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

type IdentityDatabase = ReturnType<typeof getDatabase>;

export class PostgresVerificationTokenStore implements VerificationTokenStore {
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
    // migration `004_email_verifications` uses (remediation B).
    await executeStatements(this.database(), EMAIL_VERIFICATIONS_SCHEMA_STATEMENTS);
  }

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const db = this.database();
    await db.execute(sql`
      INSERT INTO email_verifications (id, user_id, token_hash, expires_at, consumed_at, created_at)
      -- expires_at is bound as an ISO-8601 string with an explicit cast:
      -- passing a JS Date made postgres-js reject it (ERR_INVALID_ARG_TYPE),
      -- which made verification-token issuance throw in production/staging.
      -- Covered by identity-stores.postgres.test.ts.
      VALUES (${sql.param(randomUUID())}, ${sql.param(userId)}, ${sql.param(tokenHash)}, ${expiresAt.toISOString()}::timestamptz, NULL, now())
      ON CONFLICT (user_id) DO UPDATE SET
        token_hash = EXCLUDED.token_hash,
        expires_at = EXCLUDED.expires_at,
        consumed_at = NULL
    `);
  }

  async findByHash(tokenHash: string): Promise<VerificationTokenRecord | null> {
    const db = this.database();
    // TIME-ZONE CORRECTNESS (real-engine defect, fixed 2026-10-15): the
    // `::timestamptz` casts are load-bearing, not decoration. `expiresAt` is
    // compared in JS against Date.now(), and a value read without a zone
    // crossing shifts by (Node zone − DB session zone) — measured at 330
    // minutes on this machine — which in a late-running zone would have
    // ACCEPTED EXPIRED verification tokens.
    //
    // The cast is deliberately the TYPE-AGNOSTIC form so this read is correct
    // both before and after migration 005 converts these columns to
    // `timestamptz`:
    //   • `timestamp`    → interpreted in the session zone, which is exactly
    //                      how the value was stored, recovering the instant;
    //   • `timestamptz`  → already an absolute instant, so the cast is a no-op.
    // (`col AT TIME ZONE zone` would be WRONG for the second shape: on a
    // tz-aware column it returns a naive wall clock.)
    const rows = (await db.execute(sql`
      SELECT id, user_id, token_hash,
             expires_at::timestamptz AS expires_at,
             consumed_at::timestamptz AS consumed_at
      FROM email_verifications
      WHERE token_hash = ${sql.param(tokenHash)}
      LIMIT 1
    `)) as VerificationRow[];
    const row = rows[0];
    if (!row) return null;
    // `expires_at` is NOT NULL, so a missing value cannot describe a real
    // token: fail closed (not found) rather than invent an expiry.
    const expiresAt = toInstant(row.expires_at);
    if (expiresAt === null) return null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      tokenHash: String(row.token_hash),
      expiresAt,
      consumedAt: toInstant(row.consumed_at),
    };
  }

  async markConsumed(id: string): Promise<void> {
    const db = this.database();
    await db.execute(sql`
      UPDATE email_verifications SET consumed_at = now() WHERE id = ${sql.param(id)}
    `);
  }

  async revokeForUser(userId: string): Promise<void> {
    const db = this.database();
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
    if (existing) this.records.delete(existing.tokenHash);
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
