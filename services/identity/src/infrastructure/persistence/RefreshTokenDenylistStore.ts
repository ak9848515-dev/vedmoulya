// ──────────────────────────────────────────────────────────────────
// VedMoulya — Refresh Token Denylist Store (S024-4A closure)
// Persists REVOKED refresh-token JTIs so replayed or logged-out tokens
// are rejected in the actual refresh validation path. Only the SHA-256
// hash of a JTI is stored; raw bearer/refresh tokens are never persisted.
// ──────────────────────────────────────────────────────────────────

import { randomUUID, createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDatabase } from './DatabaseConnection.js';

/** Hash a JTI for storage — raw JWT IDs are never persisted. */
export function hashRefreshJti(jti: string): string {
  return createHash('sha256').update(jti).digest('hex');
}

export interface RefreshTokenDenylistRecord {
  id: string;
  jtiHash: string;
  userId: string;
  revokedAt: Date;
  expiresAt: Date;
}

export interface RefreshTokenDenylistStore {
  /** Persist a revoked JTI with its expiry (single-use rotation/logout). */
  revoke(jti: string, userId: string, expiresAt: Date): Promise<void>;
  /** TRUE when the JTI is revoked and the revocation has not expired. */
  isRevoked(jti: string): Promise<boolean>;
  /** Revoke every refresh token of a user (logout — family invalidation). */
  revokeForUser(userId: string): Promise<void>;
  /** Check whether a user-wide revocation covers a token. */
  isUserRevoked(userId: string): Promise<boolean>;
  /** Remove expired denylist rows without deleting live replay evidence. */
  cleanup(): Promise<number>;
}

// ── Postgres ─────────────────────────────────────────────────────────────

export class PostgresRefreshTokenDenylistStore implements RefreshTokenDenylistStore {
  /**
   * Idempotent schema bootstrap — the estate-wide convention (CREATE TABLE
   * IF NOT EXISTS on startup, wired alongside the identity `users` table).
   */
  async ensureTable(): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS refresh_token_denylist (
        id varchar(64) PRIMARY KEY,
        jti_hash varchar(64) NOT NULL,
        user_id varchar(64) NOT NULL,
        kind varchar(16) NOT NULL DEFAULT 'jti',
        revoked_at timestamp NOT NULL DEFAULT now(),
        expires_at timestamp NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS rtd_jti_hash_idx ON refresh_token_denylist (jti_hash)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS rtd_user_id_idx ON refresh_token_denylist (user_id)`,
    );
  }

  async revoke(jti: string, userId: string, expiresAt: Date): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`
      INSERT INTO refresh_token_denylist (id, jti_hash, user_id, kind, revoked_at, expires_at, created_at)
      VALUES (${sql.param(randomUUID())}, ${sql.param(hashRefreshJti(jti))}, ${sql.param(userId)}, 'jti', now(), ${sql.param(expiresAt)}, now())
      ON CONFLICT (jti_hash) DO NOTHING
    `);
  }

  async isRevoked(jti: string): Promise<boolean> {
    const db = getDatabase();
    const rows = await db.execute(sql`
      SELECT 1 FROM refresh_token_denylist
      WHERE jti_hash = ${sql.param(hashRefreshJti(jti))}
        AND expires_at > now()
      LIMIT 1
    `);
    return rows.length > 0;
  }

  async revokeForUser(userId: string): Promise<void> {
    // User-wide logout: insert a family marker row for this revocation.
    // isUserRevoked() matches any unexpired marker row of the same user,
    // so refresh attempts after logout fail even though the marker carries
    // a synthetic (non-JTI) hash — no raw bearer token is ever persisted.
    const db = getDatabase();
    const marker = `urn:revocation:user:${userId}:${Date.now()}:${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO refresh_token_denylist (id, jti_hash, user_id, kind, revoked_at, expires_at, created_at)
      VALUES (${sql.param(randomUUID())}, ${sql.param(hashRefreshJti(marker))}, ${sql.param(userId)}, 'family', now(), ${sql.param(expiresAt)}, now())
    `);
  }

  async isUserRevoked(userId: string): Promise<boolean> {
    const db = getDatabase();
    // kind='family' rows ONLY come from revokeForUser (logout); ordinary
    // per-JTI rotation rows use kind='jti', so a single rotation can never
    // invalidate the whole session family.
    const rows = await db.execute(sql`
      SELECT 1 FROM refresh_token_denylist
      WHERE user_id = ${sql.param(userId)}
        AND kind = 'family'
        AND expires_at > now()
      LIMIT 1
    `);
    return rows.length > 0;
  }

  async cleanup(): Promise<number> {
    const db = getDatabase();
    const result = await db.execute(sql`
      DELETE FROM refresh_token_denylist
      WHERE expires_at <= now()
      RETURNING id
    `);
    return result.length;
  }
}

// ── In-Memory (hermetic tests / local development) ─────────────────────────

export class InMemoryRefreshTokenDenylistStore implements RefreshTokenDenylistStore {
  private readonly byJti = new Map<string, { userId: string; expiresAt: Date }>();
  private readonly userRevoked = new Map<string, { at: Date; expiresAt: Date }>();

  async revoke(jti: string, userId: string, expiresAt: Date): Promise<void> {
    const h = hashRefreshJti(jti);
    if (this.byJti.has(h)) return; // idempotent single-use
    this.byJti.set(h, { userId, expiresAt });
  }

  async isRevoked(jti: string): Promise<boolean> {
    const rec = this.byJti.get(hashRefreshJti(jti));
    if (!rec) return false;
    if (rec.expiresAt.getTime() <= Date.now()) {
      this.byJti.delete(hashRefreshJti(jti));
      return false;
    }
    return true;
  }

  async revokeForUser(userId: string): Promise<void> {
    // Family marker expires with the longest refresh lifetime (7d), same as
    // the Postgres kind='family' row, so logout cannot revoke forever.
    this.userRevoked.set(userId, {
      at: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  async isUserRevoked(userId: string): Promise<boolean> {
    const rec = this.userRevoked.get(userId);
    if (!rec) return false;
    if (rec.expiresAt.getTime() <= Date.now()) {
      this.userRevoked.delete(userId);
      return false;
    }
    return true;
  }

  async cleanup(): Promise<number> {
    let n = 0;
    for (const [h, rec] of this.byJti) {
      if (rec.expiresAt.getTime() <= Date.now()) {
        this.byJti.delete(h);
        n++;
      }
    }
    for (const [u, rec] of this.userRevoked) {
      if (rec.expiresAt.getTime() <= Date.now()) {
        this.userRevoked.delete(u);
        n++;
      }
    }
    return n;
  }
}

/** Env-driven factory — Postgres in production/staging, in-memory otherwise. */
export function createRefreshTokenDenylistStore(): RefreshTokenDenylistStore {
  const env: string = process.env.NODE_ENV ?? 'development';
  if (env === 'production' || env === 'staging') {
    return new PostgresRefreshTokenDenylistStore();
  }
  return new InMemoryRefreshTokenDenylistStore();
}
