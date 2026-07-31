// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Database Schema
// Drizzle ORM schema for the users table
// Maps to the User domain entity
// ──────────────────────────────────────────────────────────────────

import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 64 }).primaryKey(),

    // ── Identity ─────────────────────────────────────────────────────────
    email: varchar('email', { length: 255 }).notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),

    // ── Profile ───────────────────────────────────────────────────────────
    displayName: varchar('display_name', { length: 100 }).notNull(),
    givenName: varchar('given_name', { length: 100 }),
    familyName: varchar('family_name', { length: 100 }),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    timezone: varchar('timezone', { length: 64 }),
    locale: varchar('locale', { length: 10 }),

    // ── Preferences ───────────────────────────────────────────────────────
    theme: varchar('theme', { length: 16 }).default('system').notNull(),
    language: varchar('language', { length: 10 }).default('en').notNull(),
    notificationsEnabled: boolean('notifications_enabled').default(true).notNull(),
    emailNotifications: boolean('email_notifications').default(true).notNull(),
    pushNotifications: boolean('push_notifications').default(true).notNull(),
    weeklyDigest: boolean('weekly_digest').default(false).notNull(),
    reducedMotion: boolean('reduced_motion').default(false).notNull(),
    reducedTransparency: boolean('reduced_transparency').default(false).notNull(),

    // ── Settings ──────────────────────────────────────────────────────────
    twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
    sessionTimeoutMinutes: integer('session_timeout_minutes').default(60).notNull(),
    loginNotifications: boolean('login_notifications').default(true).notNull(),
    profileVisibility: varchar('profile_visibility', { length: 16 }).default('private').notNull(),
    showOnlineStatus: boolean('show_online_status').default(true).notNull(),
    allowDataSharing: boolean('allow_data_sharing').default(false).notNull(),
    preferredAuthMethod: varchar('preferred_auth_method', { length: 16 }).default('any').notNull(),

    // ── Status ────────────────────────────────────────────────────────────
    statusState: varchar('status_state', { length: 16 }).default('pending').notNull(),
    statusReason: text('status_reason'),
    statusChangedAt: timestamp('status_changed_at'),

    // ── Entity ────────────────────────────────────────────────────────────
    entityStatus: varchar('entity_status', { length: 16 }).default('active').notNull(),

    // ── Password ──────────────────────────────────────────────────────────
    passwordHash: text('password_hash').notNull(),
    passwordUpdatedAt: timestamp('password_updated_at').defaultNow().notNull(),

    // ── Metadata ──────────────────────────────────────────────────────────
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),

    // ── Auth Provider Links ───────────────────────────────────────────────
    googleId: varchar('google_id', { length: 128 }),
    authProvider: varchar('auth_provider', { length: 32 }).default('email').notNull(),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    uniqueIndex('users_google_id_idx').on(table.googleId),
    uniqueIndex('users_status_idx').on(table.statusState),
    uniqueIndex('users_created_at_idx').on(table.createdAt),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
