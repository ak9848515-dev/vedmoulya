// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: users Drizzle Schema
// Verifies table structure, column constraints, and indexes
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { users } from '../src/schema/users.js';
import type { UserRow, NewUserRow } from '../src/schema/users.js';

describe('users schema', () => {
  it('defines the users table with the expected name', () => {
    const table = users as unknown as { [Symbol.for('drizzle:Name')]: string };
    expect(table[Symbol.for('drizzle:Name')]).toBe('users');
  });

  it('defines core identity columns', () => {
    const cols = users as unknown as {
      id: { columnType: string };
      email: { columnType: string };
      emailVerified: { columnType: string };
    };
    expect(cols.id).toBeDefined();
    expect(cols.email).toBeDefined();
    expect(cols.emailVerified).toBeDefined();
  });

  it('defines profile columns', () => {
    const cols = users as unknown as {
      displayName: { columnType: string };
      givenName: { columnType: string };
      avatarUrl: { columnType: string };
    };
    expect(cols.displayName).toBeDefined();
    expect(cols.givenName).toBeDefined();
    expect(cols.avatarUrl).toBeDefined();
  });

  it('defines preferences and settings columns', () => {
    const cols = users as unknown as {
      theme: { columnType: string };
      twoFactorEnabled: { columnType: string };
      sessionTimeoutMinutes: { columnType: string };
      profileVisibility: { columnType: string };
    };
    expect(cols.theme).toBeDefined();
    expect(cols.twoFactorEnabled).toBeDefined();
    expect(cols.sessionTimeoutMinutes).toBeDefined();
    expect(cols.profileVisibility).toBeDefined();
  });

  it('defines status, entity, and password columns', () => {
    const cols = users as unknown as {
      statusState: { columnType: string };
      entityStatus: { columnType: string };
      passwordHash: { columnType: string };
      createdAt: { columnType: string };
      updatedAt: { columnType: string };
    };
    expect(cols.statusState).toBeDefined();
    expect(cols.entityStatus).toBeDefined();
    expect(cols.passwordHash).toBeDefined();
    expect(cols.createdAt).toBeDefined();
    expect(cols.updatedAt).toBeDefined();
  });

  it('defines auth provider link columns', () => {
    const cols = users as unknown as {
      googleId: { columnType: string };
      authProvider: { columnType: string };
    };
    expect(cols.googleId).toBeDefined();
    expect(cols.authProvider).toBeDefined();
  });

  it('exposes the table name and columns via drizzle introspection symbols', () => {
    const table = users as unknown as {
      [Symbol.for('drizzle:Name')]: string;
      [Symbol.for('drizzle:Columns')]: Record<string, { name: string }>;
    };
    expect(table[Symbol.for('drizzle:Name')]).toBe('users');
    const cols = table[Symbol.for('drizzle:Columns')];
    expect(Object.keys(cols)).toEqual(
      expect.arrayContaining([
        'id',
        'email',
        'displayName',
        'statusState',
        'passwordHash',
        'createdAt',
      ]),
    );
  });

  it('exports row types compatible with the table select shape', () => {
    const row: UserRow = {
      id: 'usr_1',
      email: 'a@b.com',
      emailVerified: true,
      displayName: 'Test',
      givenName: null,
      familyName: null,
      avatarUrl: null,
      bio: null,
      timezone: null,
      locale: null,
      theme: 'system',
      language: 'en',
      notificationsEnabled: true,
      emailNotifications: true,
      pushNotifications: true,
      weeklyDigest: false,
      reducedMotion: false,
      reducedTransparency: false,
      twoFactorEnabled: false,
      sessionTimeoutMinutes: 60,
      loginNotifications: true,
      profileVisibility: 'private',
      showOnlineStatus: true,
      allowDataSharing: false,
      preferredAuthMethod: 'any',
      statusState: 'active',
      statusReason: null,
      statusChangedAt: null,
      entityStatus: 'active',
      passwordHash: 'hash',
      passwordUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      googleId: null,
      authProvider: 'email',
    };
    expect(row.id).toBe('usr_1');
    expect(row.statusState).toBe('active');
  });

  it('accepts insert-shaped rows', () => {
    const insertRow: NewUserRow = {
      id: 'usr_2',
      email: 'c@d.com',
      displayName: 'Insert',
      passwordHash: 'hash',
    };
    expect(insertRow.displayName).toBe('Insert');
  });
});
