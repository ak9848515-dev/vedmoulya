// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — IdentityApplicationService unit tests
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { IdentityApplicationService } from '../IdentityApplicationService.js';
import { ConflictError, NotFoundError } from '@vedmoulya/core';
import { UserFactory } from '@vedmoulya/domain';
import type { IdentityRepository } from '@vedmoulya/domain';

function makeRepo(overrides: Record<string, unknown> = {}): IdentityRepository {
  const repo: Record<string, unknown> = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByProviderId: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    ...overrides,
  };
  return repo as unknown as IdentityRepository;
}

function makeUser(overrides: Record<string, unknown> = {}): unknown {
  return UserFactory.reconstructUser({
    id: 'u-1',
    email: 'user@example.com',
    displayName: 'Ada',
    givenName: 'Ada',
    familyName: 'Lovelace',
    avatarUrl: 'https://x/a.png',
    bio: 'Bio',
    timezone: 'UTC',
    locale: 'en',
    theme: 'dark',
    language: 'en',
    statusState: 'active',
    emailVerified: true,
    entityStatus: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  });
}

describe('IdentityApplicationService — registration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registerUser creates, saves, and maps a new user', async () => {
    const repo = makeRepo({
      findByEmail: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    });
    const service = new IdentityApplicationService(repo);
    const dto = await service.registerUser({
      email: 'new@example.com',
      displayName: 'Grace',
      passwordHash: 'hashed',
    });
    expect(dto.email).toBe('new@example.com');
    expect(dto.displayName).toBe('Grace');
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('registerUser throws ConflictError on duplicate email', async () => {
    const repo = makeRepo({ findByEmail: vi.fn().mockResolvedValue(makeUser()) });
    const service = new IdentityApplicationService(repo);
    await expect(
      service.registerUser({
        email: 'user@example.com',
        displayName: 'Ada',
        passwordHash: 'hashed',
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('IdentityApplicationService — reads', () => {
  it('getUserById returns the DTO when found', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeUser()) });
    const service = new IdentityApplicationService(repo);
    const dto = await service.getUserById('u-1');
    expect(dto.id).toBe('u-1');
    expect(dto.email).toBe('user@example.com');
  });

  it('getUserById throws NotFoundError when missing', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new IdentityApplicationService(repo);
    await expect(service.getUserById('u-1')).rejects.toThrow(NotFoundError);
  });

  it('getUserByEmail returns the DTO when found', async () => {
    const repo = makeRepo({ findByEmail: vi.fn().mockResolvedValue(makeUser()) });
    const service = new IdentityApplicationService(repo);
    const dto = await service.getUserByEmail('user@example.com');
    expect(dto.email).toBe('user@example.com');
  });

  it('getUserByEmail throws NotFoundError when missing', async () => {
    const repo = makeRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    const service = new IdentityApplicationService(repo);
    await expect(service.getUserByEmail('user@example.com')).rejects.toThrow(NotFoundError);
  });

  it('listUsers maps paginated results', async () => {
    const repo = makeRepo({
      list: vi.fn().mockResolvedValue({
        data: [makeUser()],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
    });
    const service = new IdentityApplicationService(repo);
    const dto = await service.listUsers({ page: 1, limit: 10 });
    expect(dto.users).toHaveLength(1);
    expect(dto.total).toBe(1);
  });
});

describe('IdentityApplicationService — mutations', () => {
  it('updateProfile updates profile and persists', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeUser()),
      update: vi.fn().mockResolvedValue(undefined),
    });
    const service = new IdentityApplicationService(repo);
    const dto = await service.updateProfile('u-1', { displayName: 'Grace', bio: 'New bio' });
    expect(dto.displayName).toBe('Grace');
    expect(dto.bio).toBe('New bio');
    expect(repo.update).toHaveBeenCalledOnce();
  });

  it('updateProfile throws NotFoundError when missing', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new IdentityApplicationService(repo);
    await expect(service.updateProfile('u-1', { displayName: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('updatePreferences updates preferences and persists', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeUser()),
      update: vi.fn().mockResolvedValue(undefined),
    });
    const service = new IdentityApplicationService(repo);
    const dto = await service.updatePreferences('u-1', {
      theme: 'light',
      language: 'fr',
      notificationsEnabled: false,
    });
    expect(dto.theme).toBe('light');
    expect(repo.update).toHaveBeenCalledOnce();
  });

  it('updateSettings updates settings and persists', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeUser()),
      update: vi.fn().mockResolvedValue(undefined),
    });
    const service = new IdentityApplicationService(repo);
    const dto = await service.updateSettings('u-1', {
      twoFactorEnabled: true,
      sessionTimeoutMinutes: 30,
    });
    expect(dto.twoFactorEnabled).toBe(true);
    expect(repo.update).toHaveBeenCalledOnce();
  });

  it('activateUser activates a pending user', async () => {
    const repo = makeRepo({
      findById: vi
        .fn()
        .mockResolvedValue(makeUser({ statusState: 'pending', emailVerified: false })),
      update: vi.fn().mockResolvedValue(undefined),
    });
    const service = new IdentityApplicationService(repo);
    const dto = await service.activateUser('u-1');
    expect(dto.statusState).toBe('active');
  });

  it('deactivateUser suspends an active user', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeUser()),
      update: vi.fn().mockResolvedValue(undefined),
    });
    const service = new IdentityApplicationService(repo);
    const dto = await service.deactivateUser('u-1', 'policy violation');
    expect(dto.statusState).toBe('suspended');
  });

  it('archiveUser archives the user', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeUser()),
      update: vi.fn().mockResolvedValue(undefined),
    });
    const service = new IdentityApplicationService(repo);
    await service.archiveUser('u-1');
    expect(repo.update).toHaveBeenCalledOnce();
  });

  it('archiveUser throws NotFoundError when missing', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new IdentityApplicationService(repo);
    await expect(service.archiveUser('u-1')).rejects.toThrow(NotFoundError);
  });

  it('deleteUser hard-deletes the user', async () => {
    const repo = makeRepo({ delete: vi.fn().mockResolvedValue(undefined) });
    const service = new IdentityApplicationService(repo);
    await service.deleteUser('u-1');
    expect(repo.delete).toHaveBeenCalledOnce();
  });
});

describe('IdentityApplicationService — auth checks', () => {
  it('checkAuthentication returns blocked for missing user', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new IdentityApplicationService(repo);
    const result = await service.checkAuthentication('u-1');
    expect(result).toEqual({ allowed: false, reason: 'User not found' });
  });

  it('checkAuthentication allows an active verified user', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeUser()) });
    const service = new IdentityApplicationService(repo);
    const result = await service.checkAuthentication('u-1');
    expect(result.allowed).toBe(true);
  });

  it('checkAuthentication blocks a pending unverified user', async () => {
    const repo = makeRepo({
      findById: vi
        .fn()
        .mockResolvedValue(makeUser({ statusState: 'pending', emailVerified: false })),
    });
    const service = new IdentityApplicationService(repo);
    const result = await service.checkAuthentication('u-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Email not verified');
  });

  it('checkAuthentication blocks a suspended user', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeUser({ statusState: 'suspended' })),
    });
    const service = new IdentityApplicationService(repo);
    const result = await service.checkAuthentication('u-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

describe('IdentityApplicationService — validation', () => {
  it('validateRegistrationData returns no errors for valid input', () => {
    const service = new IdentityApplicationService(makeRepo());
    const errors = service.validateRegistrationData({
      email: 'user@example.com',
      displayName: 'Ada',
      password: 'Password1',
    });
    expect(errors).toEqual([]);
  });

  it('validateRegistrationData flags invalid email', () => {
    const service = new IdentityApplicationService(makeRepo());
    const errors = service.validateRegistrationData({
      email: 'not-an-email',
      displayName: 'Ada',
      password: 'Password1',
    });
    expect(errors).toContain('Invalid email address');
  });

  it('validateRegistrationData flags short display name', () => {
    const service = new IdentityApplicationService(makeRepo());
    const errors = service.validateRegistrationData({
      email: 'user@example.com',
      displayName: 'A',
      password: 'Password1',
    });
    expect(errors).toContain('Display name must be at least 2 characters');
  });

  it('validateRegistrationData flags weak password', () => {
    const service = new IdentityApplicationService(makeRepo());
    const errors = service.validateRegistrationData({
      email: 'user@example.com',
      displayName: 'Ada',
      password: 'short',
    });
    expect(errors).toContain('Password must be at least 8 characters');
  });
});
