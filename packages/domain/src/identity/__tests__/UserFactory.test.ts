// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: UserFactory
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { UserFactory } from '../factory/UserFactory.js';
import type { IdentityRepository } from '../repository/IdentityRepository.js';
import type { User } from '../entities/User.js';
import { Email } from '../value-objects/Email.js';

function repository(overrides: Partial<IdentityRepository> = {}): IdentityRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findByGoogleId: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findByCreatedAtRange: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    count: vi.fn().mockResolvedValue(0),
    countActive: vi.fn().mockResolvedValue(0),
    ...overrides,
  } as unknown as IdentityRepository;
}

const MINIMAL_RECONSTRUCTION = {
  id: 'usr_abc',
  email: 'person@example.com',
  displayName: 'Person',
  statusState: 'active' as const,
  emailVerified: true,
  entityStatus: 'active' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-02-01T00:00:00.000Z'),
};

describe('UserFactory.createNewUser', () => {
  it('creates a pending user with default preferences and settings', async () => {
    const factory = new UserFactory(repository());

    const { user, password } = await factory.createNewUser({
      email: 'New.Person@Example.com',
      displayName: 'New Person',
      givenName: 'New',
      familyName: 'Person',
      passwordHash: 'bcrypt$hash',
    });

    expect(user.email.toString()).toBe('new.person@example.com');
    expect(user.profile.displayName).toBe('New Person');
    expect(user.profile.givenName).toBe('New');
    expect(user.status.isPending).toBe(true);
    expect(user.status.emailVerified).toBe(false);
    expect(user.preferences.theme).toBe('system');
    expect(user.settings.sessionTimeoutMinutes).toBe(60);
    expect(user.passwordHash).toBe('bcrypt$hash');
    expect(password.hash).toBe('bcrypt$hash');
    expect(user.role.role).toBe('user');
  });

  it('accepts a command without optional names', async () => {
    const factory = new UserFactory(repository());

    const { user } = await factory.createNewUser({
      email: 'solo@example.com',
      displayName: 'Solo',
      passwordHash: 'bcrypt$hash',
    });

    expect(user.profile.givenName).toBeUndefined();
    expect(user.profile.familyName).toBeUndefined();
  });

  it('emits an identity.user.created event for the new aggregate', async () => {
    const factory = new UserFactory(repository());

    const { user } = await factory.createNewUser({
      email: 'events@example.com',
      displayName: 'Events',
      passwordHash: 'bcrypt$hash',
    });

    const events = user.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('identity.user.created');
    expect(events[0]!.data).toEqual({ email: 'events@example.com' });
  });

  it('refuses to create a second account for an existing email', async () => {
    const existing = { id: 'usr-existing' } as User;
    const findByEmail = vi.fn().mockResolvedValue(existing);
    const factory = new UserFactory(repository({ findByEmail }));

    await expect(
      factory.createNewUser({
        email: 'person@example.com',
        displayName: 'Person',
        passwordHash: 'bcrypt$hash',
      }),
    ).rejects.toThrow('A user with this email already exists');

    const passed = findByEmail.mock.calls[0]![0] as Email;
    expect(passed.toString()).toBe('person@example.com');
  });
});

describe('UserFactory.reconstructUser', () => {
  it('fills in documented defaults when optional persisted fields are absent', () => {
    const user = UserFactory.reconstructUser(MINIMAL_RECONSTRUCTION);

    expect(user.preferences.theme).toBe('system');
    expect(user.preferences.language).toBe('en');
    expect(user.preferences.notificationsEnabled).toBe(true);
    expect(user.preferences.emailNotifications).toBe(true);
    expect(user.preferences.pushNotifications).toBe(true);
    expect(user.preferences.weeklyDigest).toBe(false);
    expect(user.preferences.reducedMotion).toBe(false);
    expect(user.preferences.reducedTransparency).toBe(false);

    expect(user.settings.twoFactorEnabled).toBe(false);
    expect(user.settings.sessionTimeoutMinutes).toBe(60);
    expect(user.settings.loginNotifications).toBe(true);
    expect(user.settings.profileVisibility).toBe('private');
    expect(user.settings.showOnlineStatus).toBe(true);
    expect(user.settings.allowDataSharing).toBe(false);
    expect(user.settings.preferredAuthMethod).toBe('any');

    expect(user.googleId).toBeNull();
    expect(user.hasGoogleIdentity()).toBe(false);
    expect(user.authProvider).toBe('email');
    expect(user.role.role).toBe('user');
  });

  it('preserves every explicitly persisted field', () => {
    const changedAt = new Date('2026-03-01T00:00:00.000Z');
    const user = UserFactory.reconstructUser({
      ...MINIMAL_RECONSTRUCTION,
      givenName: 'Given',
      familyName: 'Family',
      avatarUrl: 'https://cdn.example.com/a.png',
      bio: 'Writer of things',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
      age: 34,
      gender: 'female',
      purpose: 'work',
      primaryGoal: 'ship',
      theme: 'dark',
      language: 'hi',
      notificationsEnabled: false,
      emailNotifications: false,
      pushNotifications: false,
      weeklyDigest: true,
      reducedMotion: true,
      reducedTransparency: true,
      twoFactorEnabled: true,
      sessionTimeoutMinutes: 15,
      loginNotifications: false,
      profileVisibility: 'connections',
      showOnlineStatus: false,
      allowDataSharing: true,
      preferredAuthMethod: 'google',
      statusState: 'locked',
      emailVerified: false,
      statusReason: 'Too many attempts',
      statusChangedAt: changedAt,
      passwordHash: 'bcrypt$hash',
      role: 'admin',
      googleId: 'google-sub-123',
      authProvider: 'google',
    });

    expect(user.profile).toMatchObject({
      displayName: 'Person',
      givenName: 'Given',
      familyName: 'Family',
      avatarUrl: 'https://cdn.example.com/a.png',
      bio: 'Writer of things',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
      age: 34,
      gender: 'female',
      purpose: 'work',
      primaryGoal: 'ship',
    });
    expect(user.preferences.toJSON()).toEqual({
      theme: 'dark',
      language: 'hi',
      notificationsEnabled: false,
      emailNotifications: false,
      pushNotifications: false,
      weeklyDigest: true,
      reducedMotion: true,
      reducedTransparency: true,
    });
    expect(user.settings.toJSON()).toEqual({
      twoFactorEnabled: true,
      sessionTimeoutMinutes: 15,
      loginNotifications: false,
      profileVisibility: 'connections',
      showOnlineStatus: false,
      allowDataSharing: true,
      preferredAuthMethod: 'google',
    });
    expect(user.status.state).toBe('locked');
    expect(user.status.reason).toBe('Too many attempts');
    expect(user.status.changedAt).toEqual(changedAt);
    expect(user.passwordHash).toBe('bcrypt$hash');
    expect(user.role.role).toBe('admin');
    expect(user.googleId).toBe('google-sub-123');
    expect(user.authProvider).toBe('google');
    expect(user.hasGoogleIdentity()).toBe(true);
    expect(user.createdAt).toEqual(MINIMAL_RECONSTRUCTION.createdAt);
    expect(user.updatedAt).toEqual(MINIMAL_RECONSTRUCTION.updatedAt);
  });

  it('infers google auth from a linked subject when the provider is absent', () => {
    const user = UserFactory.reconstructUser({
      ...MINIMAL_RECONSTRUCTION,
      googleId: 'google-sub-999',
    });

    expect(user.authProvider).toBe('google');
  });

  it('falls back to the default role for an unrecognised persisted role value', () => {
    const user = UserFactory.reconstructUser({ ...MINIMAL_RECONSTRUCTION, role: 'superuser' });
    expect(user.role.role).toBe('user');
  });

  it('reconstructs each persisted lifecycle state', () => {
    for (const state of ['pending', 'active', 'suspended', 'deleted', 'locked'] as const) {
      const user = UserFactory.reconstructUser({ ...MINIMAL_RECONSTRUCTION, statusState: state });
      expect(user.status.state).toBe(state);
    }
  });

  it('does not emit a created event when rebuilding from persistence', () => {
    const user = UserFactory.reconstructUser(MINIMAL_RECONSTRUCTION);
    expect(user.pullEvents()).toEqual([]);
  });
});
