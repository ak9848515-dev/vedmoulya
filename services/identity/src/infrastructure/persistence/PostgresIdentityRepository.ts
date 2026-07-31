// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Identity Repository
// Concrete implementation of IdentityRepository using Drizzle ORM
// ──────────────────────────────────────────────────────────────────

import { eq, count, between } from 'drizzle-orm';
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
      passwordHash: user.passwordHash || '',
      passwordUpdatedAt: user.updatedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
