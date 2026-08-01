// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Identity Schemas
// Covers every exported Zod schema's valid/invalid cases.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  userIdParam,
  paginationQuery,
  registerUserSchema,
  updateProfileSchema,
  updatePreferencesSchema,
  updateSettingsSchema,
  changeEmailSchema,
  changePasswordSchema,
  deactivateUserSchema,
} from '../src/presentation/validation/IdentitySchemas.js';

const validPassword = 'ValidPass1';

describe('userIdParam', () => {
  it('accepts a non-empty id', () => {
    expect(userIdParam.safeParse({ id: 'usr_1' }).success).toBe(true);
  });

  it('rejects an empty id', () => {
    const result = userIdParam.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });
});

describe('paginationQuery', () => {
  it('applies defaults', () => {
    const result = paginationQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('parses string numbers via coercion', () => {
    const result = paginationQuery.safeParse({ page: '3', limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(50);
    }
  });

  it('rejects a negative page and an over-limit page size', () => {
    expect(paginationQuery.safeParse({ page: -1 }).success).toBe(false);
    expect(paginationQuery.safeParse({ limit: 101 }).success).toBe(false);
    expect(paginationQuery.safeParse({ limit: 0 }).success).toBe(false);
  });
});

describe('registerUserSchema', () => {
  const base = { email: 'a@b.com', displayName: 'Test', password: validPassword };

  it('accepts a valid registration', () => {
    expect(registerUserSchema.safeParse(base).success).toBe(true);
  });

  it('accepts optional givenName and familyName', () => {
    expect(registerUserSchema.safeParse({ ...base, givenName: 'A', familyName: 'B' }).success).toBe(
      true,
    );
  });

  it('rejects an invalid email', () => {
    expect(registerUserSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });

  it('rejects a short display name', () => {
    expect(registerUserSchema.safeParse({ ...base, displayName: 'A' }).success).toBe(false);
  });

  it('rejects passwords missing required character classes', () => {
    expect(registerUserSchema.safeParse({ ...base, password: 'lowercase1' }).success).toBe(false);
    expect(registerUserSchema.safeParse({ ...base, password: 'UPPERCASE1' }).success).toBe(false);
    expect(registerUserSchema.safeParse({ ...base, password: 'NoDigitsHere' }).success).toBe(false);
    expect(registerUserSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('accepts an empty payload', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid fields', () => {
    expect(
      updateProfileSchema.safeParse({
        displayName: 'New Name',
        avatarUrl: 'https://example.com/a.png',
        bio: 'Hello',
        timezone: 'UTC',
        locale: 'en',
      }).success,
    ).toBe(true);
  });

  it('accepts an empty-string avatarUrl (clearing)', () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: '' }).success).toBe(true);
  });

  it('rejects an invalid avatar url and over-long bio', () => {
    expect(updateProfileSchema.safeParse({ avatarUrl: 'not-a-url' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ bio: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('updatePreferencesSchema', () => {
  it('accepts valid preferences', () => {
    expect(
      updatePreferencesSchema.safeParse({
        theme: 'dark',
        language: 'en',
        notificationsEnabled: true,
        emailNotifications: false,
        pushNotifications: true,
        weeklyDigest: true,
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown theme', () => {
    expect(updatePreferencesSchema.safeParse({ theme: 'neon' }).success).toBe(false);
  });
});

describe('updateSettingsSchema', () => {
  it('accepts valid settings', () => {
    expect(
      updateSettingsSchema.safeParse({
        twoFactorEnabled: true,
        sessionTimeoutMinutes: 30,
        loginNotifications: false,
        profileVisibility: 'public',
        showOnlineStatus: false,
        allowDataSharing: true,
        preferredAuthMethod: 'google',
      }).success,
    ).toBe(true);
  });

  it('rejects out-of-range session timeout and invalid enums', () => {
    expect(updateSettingsSchema.safeParse({ sessionTimeoutMinutes: 1 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ sessionTimeoutMinutes: 2000 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ profileVisibility: 'nobody' }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ preferredAuthMethod: 'magic' }).success).toBe(false);
  });
});

describe('changeEmailSchema', () => {
  it('accepts a valid email and password', () => {
    expect(changeEmailSchema.safeParse({ email: 'new@b.com', password: 'pw' }).success).toBe(true);
  });

  it('rejects an invalid email or empty password', () => {
    expect(changeEmailSchema.safeParse({ email: 'x', password: 'pw' }).success).toBe(false);
    expect(changeEmailSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts a valid change', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: validPassword })
        .success,
    ).toBe(true);
  });

  it('rejects a weak new password and empty current password', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'weak' }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({ currentPassword: '', newPassword: validPassword }).success,
    ).toBe(false);
  });
});

describe('deactivateUserSchema', () => {
  it('accepts an empty payload', () => {
    expect(deactivateUserSchema.safeParse({}).success).toBe(true);
  });

  it('accepts an optional reason and rejects over-long reasons', () => {
    expect(deactivateUserSchema.safeParse({ reason: 'Inactive' }).success).toBe(true);
    expect(deactivateUserSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
  });
});
