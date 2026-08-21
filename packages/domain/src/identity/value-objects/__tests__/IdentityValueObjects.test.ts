// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Identity value objects unit tests
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { UserProfile } from '../UserProfile.js';
import { UserPreferences } from '../UserPreferences.js';
import type { UserPreferencesProps } from '../UserPreferences.js';
import { Password } from '../Password.js';
import { IdentitySettings } from '../IdentitySettings.js';
import type { IdentitySettingsProps } from '../IdentitySettings.js';

describe('UserProfile', () => {
  const fullProps = {
    displayName: 'Ada Lovelace',
    givenName: 'Ada',
    familyName: 'Lovelace',
    avatarUrl: 'https://example.com/ada.png',
    bio: 'Mathematician',
    timezone: 'UTC',
    locale: 'en-GB',
  };

  it('exposes all fields from full props', () => {
    const profile = new UserProfile(fullProps);
    expect(profile.displayName).toBe('Ada Lovelace');
    expect(profile.givenName).toBe('Ada');
    expect(profile.familyName).toBe('Lovelace');
    expect(profile.avatarUrl).toBe('https://example.com/ada.png');
    expect(profile.bio).toBe('Mathematician');
    expect(profile.timezone).toBe('UTC');
    expect(profile.locale).toBe('en-GB');
  });

  it('accepts only a displayName', () => {
    const profile = new UserProfile({ displayName: 'Min' });
    expect(profile.displayName).toBe('Min');
    expect(profile.givenName).toBeUndefined();
    expect(profile.familyName).toBeUndefined();
    expect(profile.avatarUrl).toBeUndefined();
    expect(profile.bio).toBeUndefined();
    expect(profile.timezone).toBeUndefined();
    expect(profile.locale).toBeUndefined();
  });

  it('with() merges partial updates and keeps the rest', () => {
    const profile = new UserProfile(fullProps);
    const updated = profile.with({ bio: 'Analytical engine pioneer' });
    expect(updated.bio).toBe('Analytical engine pioneer');
    expect(updated.displayName).toBe('Ada Lovelace');
    expect(updated.timezone).toBe('UTC');
  });

  it('toJSON round-trips all fields', () => {
    const profile = new UserProfile(fullProps);
    expect(profile.toJSON()).toEqual(fullProps);
  });

  // ── SPRINT-041B — first-login profile completion ──────────────────────

  it('isComplete() is false until all first-login fields are present', () => {
    expect(new UserProfile({ displayName: 'A' }).isComplete()).toBe(false);
    expect(new UserProfile({ displayName: 'A', age: 30 }).isComplete()).toBe(false);
    expect(
      new UserProfile({
        displayName: 'A',
        age: 30,
        gender: 'female',
        purpose: 'learning',
      }).isComplete(),
    ).toBe(false);
  });

  it('isComplete() is true when age/gender/purpose/primaryGoal are all set', () => {
    const profile = new UserProfile({
      displayName: 'Ada',
      age: 36,
      gender: 'female',
      purpose: 'learning',
      primaryGoal: 'Master TypeScript',
    });
    expect(profile.isComplete()).toBe(true);
  });

  it('with() preserves and updates the first-login fields', () => {
    const profile = new UserProfile({ displayName: 'Ada' });
    const updated = profile.with({
      age: 36,
      gender: 'female',
      purpose: 'building',
      primaryGoal: 'Ship an app',
    });
    expect(updated.age).toBe(36);
    expect(updated.gender).toBe('female');
    expect(updated.purpose).toBe('building');
    expect(updated.primaryGoal).toBe('Ship an app');
    expect(updated.isComplete()).toBe(true);
    // The original is untouched (immutable value object).
    expect(profile.isComplete()).toBe(false);
  });
});

describe('UserPreferences', () => {
  const fullProps: UserPreferencesProps = {
    theme: 'dark',
    language: 'en',
    notificationsEnabled: true,
    emailNotifications: false,
    pushNotifications: true,
    weeklyDigest: true,
    reducedMotion: true,
    reducedTransparency: false,
  };

  it('exposes all fields', () => {
    const prefs = new UserPreferences(fullProps);
    expect(prefs.theme).toBe('dark');
    expect(prefs.language).toBe('en');
    expect(prefs.notificationsEnabled).toBe(true);
    expect(prefs.emailNotifications).toBe(false);
    expect(prefs.pushNotifications).toBe(true);
    expect(prefs.weeklyDigest).toBe(true);
    expect(prefs.reducedMotion).toBe(true);
    expect(prefs.reducedTransparency).toBe(false);
  });

  it('defaults() returns sensible defaults', () => {
    const defaults = UserPreferences.defaults();
    expect(defaults.theme).toBe('system');
    expect(defaults.language).toBe('en');
    expect(defaults.notificationsEnabled).toBe(true);
    expect(defaults.weeklyDigest).toBe(false);
    expect(defaults.reducedMotion).toBe(false);
  });

  it('with() merges partial updates', () => {
    const prefs = new UserPreferences(fullProps);
    const updated = prefs.with({ theme: 'light', weeklyDigest: false });
    expect(updated.theme).toBe('light');
    expect(updated.weeklyDigest).toBe(false);
    expect(updated.language).toBe('en');
    expect(updated.pushNotifications).toBe(true);
  });

  it('toJSON round-trips all fields', () => {
    const prefs = new UserPreferences(fullProps);
    expect(prefs.toJSON()).toEqual(fullProps);
  });
});

describe('Password', () => {
  it('fromHash stores the hash and updatedAt', () => {
    const when = new Date('2026-01-01T00:00:00Z');
    const password = Password.fromHash('hash-value', when);
    expect(password.hash).toBe('hash-value');
    expect(password.updatedAt).toEqual(when);
  });

  it('fromHash defaults updatedAt to now', () => {
    const password = Password.fromHash('hash-value');
    expect(password.updatedAt).toBeInstanceOf(Date);
  });

  it('toString and toJSON return the hash', () => {
    const password = Password.fromHash('h1');
    expect(password.toString()).toBe('h1');
    expect(password.toJSON()).toBe('h1');
  });

  it('equals compares hashes', () => {
    expect(Password.fromHash('a').equals(Password.fromHash('a'))).toBe(true);
    expect(Password.fromHash('a').equals(Password.fromHash('b'))).toBe(false);
  });

  it('evaluateStrength scores weak passwords', () => {
    const weak = Password.evaluateStrength('a');
    // lowercase only: 15 points -> weak
    expect(weak.score).toBe(15);
    expect(weak.label).toBe('weak');
  });

  it('evaluateStrength scores medium passwords', () => {
    // len>=8 (20) + lowercase (15) + number (15) = 50 -> fair
    const fair = Password.evaluateStrength('abcdefgh1');
    expect(fair.label).toBe('fair');
  });

  it('evaluateStrength scores strong passwords', () => {
    const strong = Password.evaluateStrength('Abcdefgh1');
    expect(strong.label).toBe('strong');
  });

  it('evaluateStrength scores very-strong passwords', () => {
    const veryStrong = Password.evaluateStrength('Abcdefgh1!xyz');
    expect(veryStrong.label).toBe('very-strong');
  });

  it('validate rejects short passwords', () => {
    expect(Password.validate('short')).toBe('Password must be at least 8 characters');
    expect(Password.validate('')).toBe('Password must be at least 8 characters');
  });

  it('validate requires uppercase, lowercase, and number', () => {
    expect(Password.validate('abcdefgh')).toContain('uppercase');
    expect(Password.validate('ABCDEFGH')).toContain('lowercase');
    expect(Password.validate('Abcdefgh')).toContain('number');
  });

  it('validate accepts a compliant password', () => {
    expect(Password.validate('Abcdefgh1')).toBeNull();
  });
});

describe('IdentitySettings', () => {
  const fullProps: IdentitySettingsProps = {
    twoFactorEnabled: true,
    sessionTimeoutMinutes: 30,
    loginNotifications: false,
    profileVisibility: 'connections',
    showOnlineStatus: false,
    allowDataSharing: true,
    preferredAuthMethod: 'google',
  };

  it('exposes all fields', () => {
    const settings = new IdentitySettings(fullProps);
    expect(settings.twoFactorEnabled).toBe(true);
    expect(settings.sessionTimeoutMinutes).toBe(30);
    expect(settings.loginNotifications).toBe(false);
    expect(settings.profileVisibility).toBe('connections');
    expect(settings.showOnlineStatus).toBe(false);
    expect(settings.allowDataSharing).toBe(true);
    expect(settings.preferredAuthMethod).toBe('google');
  });

  it('defaults() returns sensible defaults', () => {
    const defaults = IdentitySettings.defaults();
    expect(defaults.twoFactorEnabled).toBe(false);
    expect(defaults.sessionTimeoutMinutes).toBe(60);
    expect(defaults.profileVisibility).toBe('private');
    expect(defaults.preferredAuthMethod).toBe('any');
  });

  it('with() merges partial updates', () => {
    const settings = new IdentitySettings(fullProps);
    const updated = settings.with({ twoFactorEnabled: false, sessionTimeoutMinutes: 90 });
    expect(updated.twoFactorEnabled).toBe(false);
    expect(updated.sessionTimeoutMinutes).toBe(90);
    expect(updated.profileVisibility).toBe('connections');
    expect(updated.preferredAuthMethod).toBe('google');
  });

  it('toJSON round-trips all fields', () => {
    const settings = new IdentitySettings(fullProps);
    expect(settings.toJSON()).toEqual(fullProps);
  });
});
