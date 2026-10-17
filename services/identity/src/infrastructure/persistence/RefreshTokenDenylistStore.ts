// ──────────────────────────────────────────────────────────────────
// VedMoulya — Refresh Token Denylist Store (S024-4A closure)
// Persists REVOKED refresh-token JTIs so replayed or logged-out tokens
// are rejected in the actual refresh validation path. Only the SHA-256
// hash of a JTI is stored; raw bearer/refresh tokens are never persisted.
//
// SEMANTICS (remediation A — session families are time-scoped):
//   • claim() is the ATOMIC single-use rotation primitive. It returns
//     true only for the caller that won the write, so two concurrent
//     refreshes of the same JTI cannot both mint a replacement pair.
//   • revokeForUser() records the instant a family was revoked; the
//     family is NOT a blanket boolean. A token issued AFTER that instant
//     (i.e. by a subsequent successful sign-in) belongs to a NEW family
//     and must refresh normally, while a token issued BEFORE or AT that
//     instant is rejected. A blanket marker previously made a legitimate
//     re-sign-in unable to refresh for the marker's whole lifetime.
// ──────────────────────────────────────────────────────────────────

import { randomUUID, createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDatabase } from './DatabaseConnection.js';
import { REFRESH_TOKEN_DENYLIST_SCHEMA_STATEMENTS, executeStatements } from './identitySchema.js';

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
  /**
   * ATOMIC single-use rotation. Returns TRUE only for the caller that
   * durably recorded the JTI first; every other concurrent caller (and
   * every later replay) receives FALSE. A FALSE result MUST be treated
   * as replay and must never mint a replacement pair.
   */
  claim(jti: string, userId: string, expiresAt: Date): Promise<boolean>;
  /** Persist a revoked JTI with its expiry (logout / explicit revocation). */
  revoke(jti: string, userId: string, expiresAt: Date): Promise<void>;
  /** TRUE when the JTI is revoked and the revocation has not expired. */
  isRevoked(jti: string): Promise<boolean>;
  /** Revoke every refresh token of a user (logout — family invalidation). */
  revokeForUser(userId: string): Promise<void>;
  /**
   * Instant of the user's most recent unexpired family revocation, or null.
   * Callers reject a refresh token only when the token was issued at or
   * before this instant, so a later sign-in starts an unaffected family.
   */
  familyRevokedAt(userId: string): Promise<Date | null>;
  /** Coarse predicate: TRUE when the user carries an unexpired family marker. */
  isUserRevoked(userId: string): Promise<boolean>;
  /** Remove expired denylist rows without deleting live replay evidence. */
  cleanup(): Promise<number>;
}

// ── Postgres ─────────────────────────────────────────────────────────────

type IdentityDatabase = ReturnType<typeof getDatabase>;

export class PostgresRefreshTokenDenylistStore implements RefreshTokenDenylistStore {
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
   * NOTE: the versioned migration path (remediation B) creates the same
   * table with the same shape from the SAME statement list
   * (`REFRESH_TOKEN_DENYLIST_SCHEMA_STATEMENTS`); this remains the defensive
   * fallback for local/dev/test databases and is a no-op on a migrated one.
   */
  async ensureTable(): Promise<void> {
    await executeStatements(this.database(), REFRESH_TOKEN_DENYLIST_SCHEMA_STATEMENTS);
  }

  async claim(jti: string, userId: string, expiresAt: Date): Promise<boolean> {
    const db = this.database();
    // The unique index on jti_hash is the arbiter: exactly one concurrent
    // INSERT ... ON CONFLICT DO NOTHING RETURNING wins.
    // TIMESTAMP BINDING (real-engine defect, fixed 2026-10-15): the
    // timestamptz parameter is passed as an ISO-8601 STRING with an explicit
    // `::timestamptz` cast. Binding a JS `Date` here (with or without the
    // former `sql.param(...)`) made postgres-js declare the column's OID and
    // then reject the Date instance:
    //   TypeError: The "string" argument must be of type string … Received an
    //   instance of Date
    // In production/staging that made EVERY denylist write throw, and since
    // refresh fails closed and signOut rethrows, logout and all refreshes
    // refused. Proven by RefreshTokenDenylistStore.postgres.test.ts.
    const rows = await db.execute(sql`
      INSERT INTO refresh_token_denylist (id, jti_hash, user_id, kind, revoked_at, expires_at, created_at)
      VALUES (${randomUUID()}, ${hashRefreshJti(jti)}, ${userId}, 'jti', now(), ${expiresAt.toISOString()}::timestamptz, now())
      ON CONFLICT (jti_hash) DO NOTHING
      RETURNING id
    `);
    return rows.length > 0;
  }

  async revoke(jti: string, userId: string, expiresAt: Date): Promise<void> {
    await this.claim(jti, userId, expiresAt);
  }

  async isRevoked(jti: string): Promise<boolean> {
    const db = this.database();
    const rows = await db.execute(sql`
      SELECT 1 FROM refresh_token_denylist
      WHERE jti_hash = ${hashRefreshJti(jti)}
        AND expires_at > now()
      LIMIT 1
    `);
    return rows.length > 0;
  }

  async revokeForUser(userId: string): Promise<void> {
    // User-wide logout: insert a family marker row for this revocation.
    // familyRevokedAt() matches any unexpired marker row of the same user,
    // so refresh attempts for tokens issued at or before this instant fail
    // even though the marker carries a synthetic (non-JTI) hash — no raw
    // bearer token is ever persisted.
    const db = this.database();
    const marker = `urn:revocation:user:${userId}:${Date.now()}:${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO refresh_token_denylist (id, jti_hash, user_id, kind, revoked_at, expires_at, created_at)
      VALUES (${randomUUID()}, ${hashRefreshJti(marker)}, ${userId}, 'family', now(), ${expiresAt.toISOString()}::timestamptz, now())
    `);
  }

  async familyRevokedAt(userId: string): Promise<Date | null> {
    const db = this.database();
    // kind='family' rows ONLY come from revokeForUser (logout); ordinary
    // per-JTI rotation rows use kind='jti', so a single rotation can never
    // invalidate the whole session family.
    //
    // TIME-ZONE CORRECTNESS (real-engine defect, fixed 2026-10-15): the
    // `revoked_at::timestamptz` cast is load-bearing. `AuthService` compares
    // this instant against the refresh token's `iat`, and an instant reported
    // too EARLY makes tokens minted before the logout look "newer than the
    // revocation" and refreshable — so reading the column without a zone
    // crossing silently widened the logout gap by (Node zone − DB zone),
    // measured at 330 minutes for Node Asia/Calcutta vs DB Etc/UTC.
    //
    // The cast is the TYPE-AGNOSTIC form, correct both before and after
    // migration 005 converts these columns to `timestamptz`: on a naive column
    // it interprets the stored wall clock in the session zone (exactly how it
    // was written, recovering the instant), and on a tz-aware column it is a
    // no-op. (`col AT TIME ZONE zone` would be WRONG on the tz-aware shape:
    // it returns a naive wall clock there.)
    const rows = (await db.execute(sql`
      SELECT revoked_at::timestamptz AS revoked_at
      FROM refresh_token_denylist
      WHERE user_id = ${userId}
        AND kind = 'family'
        AND expires_at > now()
      ORDER BY revoked_at DESC
      LIMIT 1
    `)) as Array<{ revoked_at?: Date | string | null }>;
    const raw = rows[0]?.revoked_at;
    if (raw === undefined || raw === null) return null;
    return raw instanceof Date ? raw : new Date(raw);
  }

  async isUserRevoked(userId: string): Promise<boolean> {
    return (await this.familyRevokedAt(userId)) !== null;
  }

  async cleanup(): Promise<number> {
    const db = this.database();
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

  async claim(jti: string, userId: string, expiresAt: Date): Promise<boolean> {
    const h = hashRefreshJti(jti);
    // Single-threaded event loop → check-and-set is atomic here, matching
    // the Postgres unique-index arbiter exactly.
    if (this.byJti.has(h)) return false;
    this.byJti.set(h, { userId, expiresAt });
    return true;
  }

  async revoke(jti: string, userId: string, expiresAt: Date): Promise<void> {
    await this.claim(jti, userId, expiresAt);
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
    // the Postgres kind='family' row. The LATEST marker wins so a second
    // logout cannot be shadowed by an earlier timestamp.
    this.userRevoked.set(userId, {
      at: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  async familyRevokedAt(userId: string): Promise<Date | null> {
    const rec = this.userRevoked.get(userId);
    if (!rec) return null;
    if (rec.expiresAt.getTime() <= Date.now()) {
      this.userRevoked.delete(userId);
      return null;
    }
    return rec.at;
  }

  async isUserRevoked(userId: string): Promise<boolean> {
    return (await this.familyRevokedAt(userId)) !== null;
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
