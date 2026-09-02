// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Identity Repository
// Concrete implementation of IdentityRepository using Drizzle ORM
// ──────────────────────────────────────────────────────────────────

import { eq, count, between, sql } from 'drizzle-orm';
import { BaseRepository, type PaginationParams, type PaginatedResult } from '@vedmoulya/core';
import type { IdentityRepository, User } from '@vedmoulya/domain';
import type { UserId, Email } from '@vedmoulya/domain';
import { UserFactory } from '@vedmoulya/domain';
import { users } from '../../schema/users.js';
import type { UserRow } from '../../schema/users.js';
import { getDatabase } from './DatabaseConnection.js';

export class PostgresIdentityRepository extends BaseRepository implements IdentityRepository {
  constructor() {
    super('identity');
  }

  // SPRINT-077 — concurrency guard: multiple callers (ProductionRepositories
  // fire-and-forget + auth-app deterministic await) invoke ensureTable()
  // concurrently on cold start. PostgreSQL's CREATE TABLE IF NOT EXISTS is NOT
  // safe against concurrent DDL — two sessions can both pass the existence
  // check and race, producing a pg_type_typname_nsp_index violation. The
  // static promise ensures the DDL executes exactly once per process; all
  // concurrent callers await the same promise.
  private static ddlPromise: Promise<void> | null = null;

  /**
   * Idempotent schema bootstrap — the estate-wide convention (every other
   * Postgres store creates its table with `CREATE TABLE IF NOT EXISTS` on
   * startup; the identity store was the ONE exception: its DB init only opened
   * a connection, so first-run auth failed with REGISTRATION_FAILED against a
   * missing `users` table). Mirrors `schema/users.ts` column-for-column.
   *
   * NOTE: the drizzle schema also declares `uniqueIndex` on statusState and
   * createdAt — deliberately NOT mirrored here: a unique index on status
   * (e.g. two users both 'pending') or on createdAt would break multi-user
   * operation. The table has never been migrated anywhere, so no legacy
   * contract is lost by creating the semantically-correct DDL (unique email /
   * google_id only — email uniqueness is what enforces "duplicate email
   * rejected" at the database level).
   */
  async ensureTable(): Promise<void> {
    if (PostgresIdentityRepository.ddlPromise) {
      return PostgresIdentityRepository.ddlPromise;
    }
    PostgresIdentityRepository.ddlPromise = this.runDdl();
    try {
      await PostgresIdentityRepository.ddlPromise;
    } catch (error: unknown) {
      // SPRINT-077 — clear on rejection so getAuthApp()'s built-in retry
      // mechanism can re-attempt after transient PG failures. The estate
      // convention treats ensureTable() failure as non-fatal/deferrable;
      // all DDL uses IF NOT EXISTS so retry is idempotent. No concurrent
      // DDL risk: runDdl() has settled (the promise rejected), so no
      // lingering connection is executing DDL when we clear the guard.
      PostgresIdentityRepository.ddlPromise = null;
      throw error;
    }
  }

  /** Execute the DDL statements exactly once per process. */
  private async runDdl(): Promise<void> {
    const db = getDatabase();
    await db.execute(sql`
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
        status_changed_at timestamp,
        entity_status varchar(16) NOT NULL DEFAULT 'active',
        password_hash text NOT NULL,
        password_updated_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        google_id varchar(128),
        auth_provider varchar(32) NOT NULL DEFAULT 'email'
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email)`);
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id)`,
    );
    // SPRINT-041B — first-login profile columns. CREATE TABLE IF NOT EXISTS does
    // NOT add columns to a table that already exists (e.g. the local Docker DB
    // bootstrapped in SPRINT-040), so add them idempotently here. Never writes
    // over existing values — new columns are NULL until the founder saves.
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS age integer`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender varchar(32)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS purpose varchar(64)`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_goal varchar(200)`);
  }

  /** Find a user by their unique identifier */
  async findById(id: UserId): Promise<User | null> {
    const db = getDatabase();
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const row = rows[0];
    return row ? this.rowToUser(row) : null;
  }

  /** Find a user by their email address */
  async findByEmail(email: Email): Promise<User | null> {
    const db = getDatabase();
    const rows = await db.select().from(users).where(eq(users.email, email.normalized)).limit(1);
    const row = rows[0];
    return row ? this.rowToUser(row) : null;
  }

  /** Find a user by their linked Google subject id (null when none) */
  async findByGoogleId(googleId: string): Promise<User | null> {
    const db = getDatabase();
    const rows = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    const row = rows[0];
    return row ? this.rowToUser(row) : null;
  }

  /** Save a new user (insert) */
  async save(user: User): Promise<void> {
    const db = getDatabase();
    const row = this.userToRow(user);
    await db.insert(users).values(row);
    this.logger.info('User saved', { userId: user.id });
  }

  /** Update an existing user */
  async update(user: User): Promise<void> {
    const db = getDatabase();
    const row = this.userToRow(user);
    await db.update(users).set(row).where(eq(users.id, user.id));
    this.logger.info('User updated', { userId: user.id });
  }

  /** Delete a user by their identifier (hard delete) */
  async delete(id: UserId): Promise<void> {
    const db = getDatabase();
    await db.delete(users).where(eq(users.id, id));
    this.logger.info('User deleted', { userId: id });
  }

  /** Check if a user with the given email exists */
  async exists(email: Email): Promise<boolean> {
    const db = getDatabase();
    const result = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.email, email.normalized));
    return (result[0]?.count ?? 0) > 0;
  }

  /** List users with pagination */
  async list(params: PaginationParams): Promise<PaginatedResult<User>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db.select().from(users).limit(params.limit).offset(offset).orderBy(users.createdAt),
      db.select({ count: count() }).from(users),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: UserRow) => this.rowToUser(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  /** Find users created within a date range */
  async findByCreatedAtRange(
    start: Date,
    end: Date,
    params: PaginationParams,
  ): Promise<PaginatedResult<User>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(users)
        .where(between(users.createdAt, start, end))
        .limit(params.limit)
        .offset(offset)
        .orderBy(users.createdAt),
      db
        .select({ count: count() })
        .from(users)
        .where(between(users.createdAt, start, end)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: UserRow) => this.rowToUser(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  /** Count total users */
  async count(): Promise<number> {
    const db = getDatabase();
    const result = await db.select({ count: count() }).from(users);
    return result[0]?.count ?? 0;
  }

  /** Count active users */
  async countActive(): Promise<number> {
    const db = getDatabase();
    const result = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.statusState, 'active'));
    return result[0]?.count ?? 0;
  }

  // ── Mapping Helpers ─────────────────────────────────────────────────────

  /** Convert a database row to a User domain entity */
  private rowToUser(row: UserRow): User {
    return UserFactory.reconstructUser({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      givenName: row.givenName ?? undefined,
      familyName: row.familyName ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      bio: row.bio ?? undefined,
      timezone: row.timezone ?? undefined,
      locale: row.locale ?? undefined,
      age: row.age ?? undefined,
      gender: row.gender ?? undefined,
      purpose: row.purpose ?? undefined,
      primaryGoal: row.primaryGoal ?? undefined,
      theme: row.theme as 'light' | 'dark' | 'system',
      language: row.language,
      notificationsEnabled: row.notificationsEnabled,
      emailNotifications: row.emailNotifications,
      pushNotifications: row.pushNotifications,
      weeklyDigest: row.weeklyDigest,
      reducedMotion: row.reducedMotion,
      reducedTransparency: row.reducedTransparency,
      twoFactorEnabled: row.twoFactorEnabled,
      sessionTimeoutMinutes: row.sessionTimeoutMinutes,
      loginNotifications: row.loginNotifications,
      profileVisibility: row.profileVisibility as 'public' | 'private' | 'connections',
      showOnlineStatus: row.showOnlineStatus,
      allowDataSharing: row.allowDataSharing,
      preferredAuthMethod: row.preferredAuthMethod as 'email' | 'google' | 'any',
      statusState: row.statusState as 'pending' | 'active' | 'suspended' | 'deleted' | 'locked',
      emailVerified: row.emailVerified,
      statusReason: row.statusReason ?? undefined,
      statusChangedAt: row.statusChangedAt ?? undefined,
      passwordHash: row.passwordHash,
      entityStatus: row.entityStatus as 'active' | 'inactive' | 'archived' | 'deleted',
      googleId: row.googleId ?? null,
      authProvider: (row.authProvider as 'email' | 'google' | undefined) ?? 'email',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /** Convert a User domain entity to a database row */
  private userToRow(user: User): typeof users.$inferInsert {
    return {
      id: user.id,
      email: user.email.normalized,
      emailVerified: user.status.emailVerified,
      displayName: user.profile.displayName,
      givenName: user.profile.givenName ?? null,
      familyName: user.profile.familyName ?? null,
      avatarUrl: user.profile.avatarUrl ?? null,
      bio: user.profile.bio ?? null,
      timezone: user.profile.timezone ?? null,
      locale: user.profile.locale ?? null,
      age: user.profile.age ?? null,
      gender: user.profile.gender ?? null,
      purpose: user.profile.purpose ?? null,
      primaryGoal: user.profile.primaryGoal ?? null,
      theme: user.preferences.theme,
      language: user.preferences.language,
      notificationsEnabled: user.preferences.notificationsEnabled,
      emailNotifications: user.preferences.emailNotifications,
      pushNotifications: user.preferences.pushNotifications,
      weeklyDigest: user.preferences.weeklyDigest,
      reducedMotion: user.preferences.reducedMotion,
      reducedTransparency: user.preferences.reducedTransparency,
      twoFactorEnabled: user.settings.twoFactorEnabled,
      sessionTimeoutMinutes: user.settings.sessionTimeoutMinutes,
      loginNotifications: user.settings.loginNotifications,
      profileVisibility: user.settings.profileVisibility,
      showOnlineStatus: user.settings.showOnlineStatus,
      allowDataSharing: user.settings.allowDataSharing,
      preferredAuthMethod: user.settings.preferredAuthMethod,
      statusState: user.status.state,
      statusReason: user.status.reason ?? null,
      statusChangedAt: user.status.changedAt,
      entityStatus: user.entityStatus,
      googleId: user.googleId,
      authProvider: user.authProvider,
      passwordHash: user.passwordHash || '',
      passwordUpdatedAt: user.updatedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
