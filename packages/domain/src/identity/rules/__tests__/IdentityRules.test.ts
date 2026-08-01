// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Identity business rules unit tests
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  displayNameRule,
  passwordRule,
  canAuthenticateRule,
  emailChangeRule,
  accountDeletionRule,
  validate,
} from '../IdentityRules.js';
import { IdentityStatus } from '../../value-objects/IdentityStatus.js';
import { User } from '../../entities/User.js';
import { UserProfile } from '../../value-objects/UserProfile.js';
import { UserPreferences } from '../../value-objects/UserPreferences.js';
import { IdentitySettings } from '../../value-objects/IdentitySettings.js';
import { Email } from '../../value-objects/Email.js';

function makeUser(overrides?: { status?: IdentityStatus; entityStatus?: string }): User {
  return new User({
    id: { value: 'u-1' } as never,
    email: Email.create('user@example.com'),
    profile: new UserProfile({ displayName: 'Test User' }),
    preferences: UserPreferences.defaults(),
    settings: IdentitySettings.defaults(),
    status: overrides?.status ?? IdentityStatus.active(),
    entityStatus: (overrides?.entityStatus as never) ?? 'active',
  });
}

describe('displayNameRule', () => {
  it('accepts a valid name', () => {
    expect(displayNameRule('Ada Lovelace')).toEqual({ valid: true });
  });

  it('rejects short or empty names', () => {
    expect(displayNameRule('').valid).toBe(false);
    expect(displayNameRule('a').valid).toBe(false);
    expect(displayNameRule('   ').valid).toBe(false);
  });

  it('rejects names longer than 100 chars', () => {
    expect(displayNameRule('x'.repeat(101)).valid).toBe(false);
  });

  it('rejects names with invalid characters', () => {
    expect(displayNameRule('bad<script>').valid).toBe(false);
    expect(displayNameRule('bad\\name').valid).toBe(false);
  });

  it('accepts a name of exactly 100 chars', () => {
    expect(displayNameRule('x'.repeat(100)).valid).toBe(true);
  });
});

describe('passwordRule', () => {
  it('accepts a compliant password', () => {
    expect(passwordRule('Abcdefgh1').valid).toBe(true);
  });

  it('rejects a weak password', () => {
    expect(passwordRule('short').valid).toBe(false);
  });
});

describe('canAuthenticateRule', () => {
  it('allows active and pending accounts', () => {
    expect(canAuthenticateRule(IdentityStatus.active()).valid).toBe(true);
    expect(canAuthenticateRule(IdentityStatus.pending()).valid).toBe(true);
  });

  it('rejects suspended, deleted, and locked accounts', () => {
    expect(canAuthenticateRule(IdentityStatus.suspended('violation')).valid).toBe(false);
    expect(canAuthenticateRule(IdentityStatus.deleted()).valid).toBe(false);
    expect(canAuthenticateRule(IdentityStatus.locked('too many attempts')).valid).toBe(false);
  });
});

describe('emailChangeRule', () => {
  it('allows email change for verified users', () => {
    const user = makeUser({ status: IdentityStatus.active().withEmailVerified() });
    expect(emailChangeRule(user, 'new@example.com').valid).toBe(true);
  });

  it('blocks email change for pending unverified users', () => {
    const user = makeUser({ status: IdentityStatus.pending() });
    const result = emailChangeRule(user, 'new@example.com');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Verify current email');
  });
});

describe('accountDeletionRule', () => {
  it('allows deletion of active accounts', () => {
    expect(accountDeletionRule(makeUser()).valid).toBe(true);
  });

  it('blocks deletion of archived accounts', () => {
    const user = makeUser({ entityStatus: 'archived' });
    const result = accountDeletionRule(user);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('already archived');
  });
});

describe('validate composite', () => {
  it('returns the first failing rule result', () => {
    const result = validate([displayNameRule, passwordRule], 'short');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must be at least 8 characters');
  });

  it('returns valid when all rules pass', () => {
    const result = validate([displayNameRule, passwordRule], 'Abcdefgh1');
    expect(result.valid).toBe(true);
  });
});
