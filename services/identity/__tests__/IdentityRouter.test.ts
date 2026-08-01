// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Identity tRPC Router
// Verifies tRPC procedures and error mapping to TRPCError codes
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIdentityTrpcRouter } from '../src/presentation/trpc/IdentityRouter.js';
import { NotFoundError, ConflictError, ValidationError } from '@vedmoulya/core';

function makeService(overrides: Record<string, unknown> = {}) {
  return {
    registerUser: vi.fn(),
    getUserById: vi.fn(),
    getUserByEmail: vi.fn(),
    updateProfile: vi.fn(),
    updatePreferences: vi.fn(),
    updateSettings: vi.fn(),
    activateUser: vi.fn(),
    deactivateUser: vi.fn(),
    archiveUser: vi.fn(),
    listUsers: vi.fn(),
    checkAuthentication: vi.fn(),
    ...overrides,
  };
}

type Caller = {
  registerUser: (input: unknown) => Promise<unknown>;
  updateProfile: (input: unknown) => Promise<unknown>;
  updatePreferences: (input: unknown) => Promise<unknown>;
  updateSettings: (input: unknown) => Promise<unknown>;
  activateUser: (input: unknown) => Promise<unknown>;
  deactivateUser: (input: unknown) => Promise<unknown>;
  archiveUser: (input: unknown) => Promise<unknown>;
  getUserById: (input: unknown) => Promise<unknown>;
  getUserByEmail: (input: unknown) => Promise<unknown>;
  listUsers: (input: unknown) => Promise<unknown>;
  checkAuthentication: (input: unknown) => Promise<unknown>;
};

describe('IdentityRouter (tRPC)', () => {
  let service: ReturnType<typeof makeService>;
  let router: ReturnType<typeof createIdentityTrpcRouter>;
  let caller: Caller;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService();
    router = createIdentityTrpcRouter(service as never);
    const created = (router as { createCaller: (ctx: unknown) => Caller }).createCaller({});
    caller = created;
  });

  it('creates a router with all procedures', () => {
    const names = Object.keys(router);
    expect(names).toEqual(
      expect.arrayContaining([
        'registerUser',
        'updateProfile',
        'updatePreferences',
        'updateSettings',
        'activateUser',
        'deactivateUser',
        'archiveUser',
        'getUserById',
        'getUserByEmail',
        'listUsers',
        'checkAuthentication',
      ]),
    );
  });

  describe('registerUser', () => {
    it('registers a user successfully', async () => {
      service.registerUser.mockResolvedValue({ id: 'usr_1' });
      const result = await caller.registerUser({
        email: 'new@example.com',
        displayName: 'New User',
        password: 'ValidPass1',
      });
      expect(result).toMatchObject({ success: true, data: { id: 'usr_1' } });
    });

    it('maps NotFoundError to NOT_FOUND', async () => {
      service.registerUser.mockRejectedValue(new NotFoundError('User'));
      await expect(
        caller.registerUser({
          email: 'new@example.com',
          displayName: 'New User',
          password: 'ValidPass1',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('maps ConflictError to CONFLICT', async () => {
      service.registerUser.mockRejectedValue(new ConflictError('Email already registered'));
      await expect(
        caller.registerUser({
          email: 'new@example.com',
          displayName: 'New User',
          password: 'ValidPass1',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('maps ValidationError to BAD_REQUEST', async () => {
      service.registerUser.mockRejectedValue(new ValidationError('Invalid input'));
      await expect(
        caller.registerUser({
          email: 'new@example.com',
          displayName: 'New User',
          password: 'ValidPass1',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('maps unknown errors to INTERNAL_SERVER_ERROR', async () => {
      service.registerUser.mockRejectedValue(new Error('boom'));
      await expect(
        caller.registerUser({
          email: 'new@example.com',
          displayName: 'New User',
          password: 'ValidPass1',
        }),
      ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    });

    it('maps non-Error throws to INTERNAL_SERVER_ERROR', async () => {
      service.registerUser.mockRejectedValue('string failure');
      await expect(
        caller.registerUser({
          email: 'new@example.com',
          displayName: 'New User',
          password: 'ValidPass1',
        }),
      ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    });
  });

  describe('queries', () => {
    it('gets a user by id', async () => {
      service.getUserById.mockResolvedValue({ id: 'usr_1' });
      await expect(caller.getUserById('usr_1')).resolves.toMatchObject({
        success: true,
        data: { id: 'usr_1' },
      });
    });

    it('gets a user by email', async () => {
      service.getUserByEmail.mockResolvedValue({ id: 'usr_1' });
      await expect(caller.getUserByEmail('a@b.com')).resolves.toMatchObject({
        success: true,
      });
    });

    it('rejects an invalid email format', async () => {
      await expect(caller.getUserByEmail('not-an-email')).rejects.toBeDefined();
    });

    it('lists users with pagination', async () => {
      service.listUsers.mockResolvedValue({ data: [], total: 0 });
      await expect(caller.listUsers({ page: 1, limit: 20 })).resolves.toMatchObject({
        success: true,
      });
    });

    it('checks authentication', async () => {
      service.checkAuthentication.mockResolvedValue({ allowed: true });
      await expect(caller.checkAuthentication('usr_1')).resolves.toMatchObject({
        success: true,
        data: { allowed: true },
      });
    });
  });

  describe('mutations', () => {
    it('updates a profile', async () => {
      service.updateProfile.mockResolvedValue({ id: 'usr_1' });
      await expect(
        caller.updateProfile({ id: 'usr_1', data: { displayName: 'Renamed' } }),
      ).resolves.toMatchObject({ success: true });
    });

    it('updates preferences', async () => {
      service.updatePreferences.mockResolvedValue({ id: 'usr_1' });
      await expect(
        caller.updatePreferences({ id: 'usr_1', data: { theme: 'dark' } }),
      ).resolves.toMatchObject({ success: true });
    });

    it('updates settings', async () => {
      service.updateSettings.mockResolvedValue({ id: 'usr_1' });
      await expect(
        caller.updateSettings({ id: 'usr_1', data: { twoFactorEnabled: true } }),
      ).resolves.toMatchObject({ success: true });
    });

    it('activates a user', async () => {
      service.activateUser.mockResolvedValue({ id: 'usr_1' });
      await expect(caller.activateUser('usr_1')).resolves.toMatchObject({ success: true });
    });

    it('deactivates a user with a reason', async () => {
      service.deactivateUser.mockResolvedValue({ id: 'usr_1' });
      await expect(caller.deactivateUser({ id: 'usr_1', reason: 'Abuse' })).resolves.toMatchObject({
        success: true,
      });
    });

    it('archives a user', async () => {
      service.archiveUser.mockResolvedValue(undefined);
      await expect(caller.archiveUser('usr_1')).resolves.toMatchObject({
        success: true,
        data: { message: 'User archived' },
      });
    });

    it('maps archive failures to tRPC errors', async () => {
      service.archiveUser.mockRejectedValue(new NotFoundError('User'));
      await expect(caller.archiveUser('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
