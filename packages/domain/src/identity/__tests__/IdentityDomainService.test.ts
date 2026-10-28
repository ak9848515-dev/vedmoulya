// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Identity Domain Service
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { IdentityDomainService } from '../services/IdentityDomainService.js';
import { UserFactory } from '../factory/UserFactory.js';
import type { IdentityRepository } from '../repository/IdentityRepository.js';
import type { User } from '../entities/User.js';
import { Email } from '../value-objects/Email.js';
import { Password } from '../value-objects/Password.js';

function userWith(
  statusState: 'pending' | 'active' | 'suspended' | 'deleted' | 'locked',
  options: { emailVerified?: boolean; statusReason?: string } = {},
): User {
  return UserFactory.reconstructUser({
    id: 'usr-1',
    email: 'person@example.com',
    displayName: 'Person',
    statusState,
    emailVerified: options.emailVerified ?? false,
    statusReason: options.statusReason,
    entityStatus: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

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

describe('IdentityDomainService.checkForDuplicates', () => {
  it('reports an existing account and returns it', async () => {
    const existing = userWith('active');
    const service = new IdentityDomainService(
      repository({ findByEmail: vi.fn().mockResolvedValue(existing) }),
    );

    const result = await service.checkForDuplicates(Email.create('person@example.com'));

    expect(result.emailExists).toBe(true);
    expect(result.existingUser).toBe(existing);
  });

  it('reports an unused address with no user attached', async () => {
    const service = new IdentityDomainService(repository());

    const result = await service.checkForDuplicates(Email.create('fresh@example.com'));

    expect(result.emailExists).toBe(false);
    expect(result.existingUser).toBeUndefined();
  });

  it('queries by the email value object it was given', async () => {
    const findByEmail = vi.fn().mockResolvedValue(null);
    const service = new IdentityDomainService(repository({ findByEmail }));

    await service.checkForDuplicates(Email.create(' Person@Example.COM '));

    expect(findByEmail).toHaveBeenCalledTimes(1);
    const passed = findByEmail.mock.calls[0]![0] as Email;
    expect(passed).toBeInstanceOf(Email);
    expect(passed.toString()).toBe('person@example.com');
  });
});

describe('IdentityDomainService.validatePasswordChange', () => {
  const service = new IdentityDomainService(repository());

  it('accepts a new password that differs from the current hash and meets policy', () => {
    expect(service.validatePasswordChange('hash-old', 'Str0ngPassw0rd', 'hash-new')).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('rejects reuse of the current password', () => {
    const result = service.validatePasswordChange('hash-same', 'Str0ngPassw0rd', 'hash-same');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('New password must be different from current password');
  });

  it('surfaces the password policy violation from Password.validate', () => {
    const result = service.validatePasswordChange('hash-old', 'weak', 'hash-new');

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Password must be at least 8 characters']);
  });

  it('accumulates both problems instead of reporting only the first', () => {
    const result = service.validatePasswordChange('hash-same', 'weak', 'hash-same');

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'New password must be different from current password',
      'Password must be at least 8 characters',
    ]);
  });

  it('reports each remaining policy rule independently', () => {
    expect(service.validatePasswordChange('h', 'alllowercase1', 'n').errors).toEqual([
      'Password must contain at least one uppercase letter',
    ]);
    expect(service.validatePasswordChange('h', 'ALLUPPERCASE1', 'n').errors).toEqual([
      'Password must contain at least one lowercase letter',
    ]);
    expect(service.validatePasswordChange('h', 'NoDigitsHere', 'n').errors).toEqual([
      'Password must contain at least one number',
    ]);
  });

  it('treats an empty new password as a length violation', () => {
    expect(Password.validate('')).toBe('Password must be at least 8 characters');
    expect(service.validatePasswordChange('h', '', 'n').errors).toContain(
      'Password must be at least 8 characters',
    );
  });
});

describe('IdentityDomainService.canAuthenticate', () => {
  const service = new IdentityDomainService(repository());

  it('allows an active account', () => {
    expect(service.canAuthenticate(userWith('active'))).toEqual({ allowed: true });
  });

  it('blocks a suspended account with its recorded reason', () => {
    expect(
      service.canAuthenticate(userWith('suspended', { statusReason: 'Chargeback review' })),
    ).toEqual({ allowed: false, reason: 'Chargeback review' });
  });

  it('falls back to a default reason when a suspension has none', () => {
    expect(service.canAuthenticate(userWith('suspended'))).toEqual({
      allowed: false,
      reason: 'Account suspended',
    });
  });

  it('blocks a deleted account', () => {
    expect(service.canAuthenticate(userWith('deleted'))).toEqual({
      allowed: false,
      reason: 'Account deleted',
    });
  });

  it('blocks a locked account with its recorded reason', () => {
    expect(
      service.canAuthenticate(userWith('locked', { statusReason: 'Too many attempts' })),
    ).toEqual({ allowed: false, reason: 'Too many attempts' });
  });

  it('falls back to a default reason when a lock has none', () => {
    expect(service.canAuthenticate(userWith('locked'))).toEqual({
      allowed: false,
      reason: 'Account locked',
    });
  });

  it('blocks a pending account whose email is unverified', () => {
    expect(service.canAuthenticate(userWith('pending', { emailVerified: false }))).toEqual({
      allowed: false,
      reason: 'Email not verified',
    });
  });

  it('allows a pending account once the email is verified', () => {
    expect(service.canAuthenticate(userWith('pending', { emailVerified: true }))).toEqual({
      allowed: true,
    });
  });
});

describe('IdentityDomainService.getUsersRequiringAttention', () => {
  it('keeps pending users and active entities, dropping inactive settled accounts', async () => {
    const pending = userWith('pending');
    const active = userWith('active');
    const deleted = UserFactory.reconstructUser({
      id: 'usr-2',
      email: 'gone@example.com',
      displayName: 'Gone',
      statusState: 'deleted',
      emailVerified: true,
      entityStatus: 'archived',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const service = new IdentityDomainService(
      repository({
        list: vi.fn().mockResolvedValue({ data: [pending, active, deleted], total: 3 }),
      }),
    );

    const result = await service.getUsersRequiringAttention();

    expect(result).toEqual([pending, active]);
  });

  it('reads the first page of users so the check is bounded', async () => {
    const list = vi.fn().mockResolvedValue({ data: [], total: 0 });
    const service = new IdentityDomainService(repository({ list }));

    await service.getUsersRequiringAttention();

    expect(list).toHaveBeenCalledWith({ page: 1, limit: 100 });
  });
});
