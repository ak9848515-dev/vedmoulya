// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — UserMapper unit tests
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { UserMapper } from '../UserMapper.js';

describe('UserMapper.toReconstructionParams', () => {
  it('maps a full row with all fields', () => {
    const params = UserMapper.toReconstructionParams({
      id: 'u-1',
      email: 'user@example.com',
      display_name: 'Ada',
      given_name: 'Ada',
      family_name: 'Lovelace',
      avatar_url: 'https://x/a.png',
      bio: 'Bio',
      timezone: 'UTC',
      locale: 'en',
      theme: 'dark',
      language: 'fr',
      notifications_enabled: false,
      email_notifications: false,
      push_notifications: false,
      weekly_digest: true,
      reduced_motion: true,
      reduced_transparency: true,
      two_factor_enabled: true,
      session_timeout_minutes: 30,
      login_notifications: false,
      profile_visibility: 'public',
      show_online_status: false,
      allow_data_sharing: true,
      preferred_auth_method: 'google',
      status_state: 'suspended',
      email_verified: true,
      status_reason: 'violation',
      status_changed_at: '2026-01-01T00:00:00Z',
      entity_status: 'archived',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    });
    expect(params.id).toBe('u-1');
    expect(params.email).toBe('user@example.com');
    expect(params.displayName).toBe('Ada');
    expect(params.theme).toBe('dark');
    expect(params.language).toBe('fr');
    expect(params.notificationsEnabled).toBe(false);
    expect(params.weeklyDigest).toBe(true);
    expect(params.twoFactorEnabled).toBe(true);
    expect(params.sessionTimeoutMinutes).toBe(30);
    expect(params.profileVisibility).toBe('public');
    expect(params.preferredAuthMethod).toBe('google');
    expect(params.statusState).toBe('suspended');
    expect(params.emailVerified).toBe(true);
    expect(params.statusReason).toBe('violation');
    expect(params.statusChangedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(params.entityStatus).toBe('archived');
  });

  it('applies default fallbacks for missing optional fields', () => {
    const params = UserMapper.toReconstructionParams({
      id: 'u-1',
      email: 'user@example.com',
      display_name: 'Ada',
      status_state: 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect(params.theme).toBe('system');
    expect(params.language).toBe('en');
    expect(params.notificationsEnabled).toBe(true);
    expect(params.emailNotifications).toBe(true);
    expect(params.pushNotifications).toBe(true);
    expect(params.weeklyDigest).toBe(false);
    expect(params.reducedMotion).toBe(false);
    expect(params.reducedTransparency).toBe(false);
    expect(params.twoFactorEnabled).toBe(false);
    expect(params.sessionTimeoutMinutes).toBe(60);
    expect(params.loginNotifications).toBe(true);
    expect(params.profileVisibility).toBe('private');
    expect(params.showOnlineStatus).toBe(true);
    expect(params.allowDataSharing).toBe(false);
    expect(params.preferredAuthMethod).toBe('any');
    expect(params.emailVerified).toBe(false);
    expect(params.statusReason).toBeUndefined();
    expect(params.statusChangedAt).toBeUndefined();
    expect(params.entityStatus).toBe('active');
  });

  it('omits givenName/familyName/etc when absent from the row', () => {
    const params = UserMapper.toReconstructionParams({
      id: 'u-1',
      email: 'a@b.com',
      display_name: 'Min',
      status_state: 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect(params.givenName).toBeUndefined();
    expect(params.familyName).toBeUndefined();
    expect(params.avatarUrl).toBeUndefined();
    expect(params.bio).toBeUndefined();
  });
});

describe('UserMapper entity mapping', () => {
  function makeUser(): unknown {
    return {
      id: 'u-1',
      email: { toString: () => 'user@example.com' },
      profile: {
        displayName: 'Ada',
        givenName: 'Ada',
        familyName: 'Lovelace',
        avatarUrl: 'https://x/a.png',
        bio: 'Bio',
        timezone: 'UTC',
        locale: 'en',
      },
      preferences: {
        theme: 'dark',
        language: 'fr',
      },
      status: {
        state: 'active',
        emailVerified: true,
      },
      settings: {
        twoFactorEnabled: true,
        profileVisibility: 'private',
      },
      entityStatus: 'active',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };
  }

  it('toDTO maps all fields', () => {
    const dto = UserMapper.toDTO(makeUser() as never);
    expect(dto.id).toBe('u-1');
    expect(dto.email).toBe('user@example.com');
    expect(dto.displayName).toBe('Ada');
    expect(dto.givenName).toBe('Ada');
    expect(dto.theme).toBe('dark');
    expect(dto.statusState).toBe('active');
    expect(dto.emailVerified).toBe(true);
    expect(dto.twoFactorEnabled).toBe(true);
    expect(dto.profileVisibility).toBe('private');
    expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(dto.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('toRegisterDTO maps the lightweight fields', () => {
    const dto = UserMapper.toRegisterDTO(makeUser() as never);
    expect(dto.id).toBe('u-1');
    expect(dto.email).toBe('user@example.com');
    expect(dto.displayName).toBe('Ada');
    expect(dto.status).toBe('active');
  });

  it('toUpdateProfileDTO maps profile update fields', () => {
    const dto = UserMapper.toUpdateProfileDTO(makeUser() as never);
    expect(dto.id).toBe('u-1');
    expect(dto.displayName).toBe('Ada');
    expect(dto.email).toBe('user@example.com');
    expect(dto.avatarUrl).toBe('https://x/a.png');
    expect(dto.bio).toBe('Bio');
  });
});
