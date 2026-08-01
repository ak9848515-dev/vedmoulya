// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Identity Controller
// Verifies request validation, success responses, and error mapping
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from 'hono';
import { IdentityController } from '../src/presentation/controllers/IdentityController.js';
import { NotFoundError } from '@vedmoulya/core';

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

/** Build a Hono context stub exposing json/req like the real Context. */
function makeContext(overrides: Record<string, unknown> = {}): Context {
  const json = vi.fn(
    (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
  );
  const c = {
    json,
    req: {
      json: vi.fn(),
      param: vi.fn(),
      query: vi.fn(),
    },
    ...overrides,
  };
  if (overrides.json === undefined) c.json = json;
  return c as never;
}

describe('IdentityController', () => {
  let service: ReturnType<typeof makeService>;
  let controller: IdentityController;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService();
    controller = new IdentityController(service as never);
  });

  describe('registerUser', () => {
    const validBody = {
      email: 'new@example.com',
      displayName: 'New User',
      givenName: 'New',
      familyName: 'User',
      password: 'ValidPass1',
    };

    it('returns 201 with the created user', async () => {
      service.registerUser.mockResolvedValue({ id: 'usr_1' });
      const c = makeContext();
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue(validBody);

      const res = await controller.registerUser(c);
      expect(res.status).toBe(201);
      expect(service.registerUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', passwordHash: 'ValidPass1' }),
      );
    });

    it('returns 400 on invalid input', async () => {
      const c = makeContext();
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue({
        email: 'bad',
        displayName: 'X',
      });

      const res = await controller.registerUser(c);
      expect(res.status).toBe(400);
      expect(service.registerUser).not.toHaveBeenCalled();
    });

    it('maps service errors to error responses', async () => {
      service.registerUser.mockRejectedValue(new NotFoundError('User'));
      const c = makeContext();
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue(validBody);

      const res = await controller.registerUser(c);
      expect(res.status).toBe(404);
      expect(JSON.parse(await res.text())).toMatchObject({ success: false });
    });
  });

  describe('getUserById / getUserByEmail', () => {
    it('returns the user by id', async () => {
      service.getUserById.mockResolvedValue({ id: 'usr_1' });
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');

      const res = await controller.getUserById(c);
      expect(res.status).toBe(200);
      expect(service.getUserById).toHaveBeenCalledWith('usr_1');
    });

    it('returns the user by email', async () => {
      service.getUserByEmail.mockResolvedValue({ id: 'usr_1' });
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('a@b.com');

      const res = await controller.getUserByEmail(c);
      expect(res.status).toBe(200);
      expect(service.getUserByEmail).toHaveBeenCalledWith('a@b.com');
    });
  });

  describe('updateProfile / updatePreferences / updateSettings', () => {
    it('updates the profile', async () => {
      service.updateProfile.mockResolvedValue({ id: 'usr_1' });
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue({ displayName: 'Renamed' });

      const res = await controller.updateProfile(c);
      expect(res.status).toBe(200);
      expect(service.updateProfile).toHaveBeenCalledWith('usr_1', { displayName: 'Renamed' });
    });

    it('returns 400 for an invalid profile payload', async () => {
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue({ avatarUrl: 'not-a-url' });

      const res = await controller.updateProfile(c);
      expect(res.status).toBe(400);
    });

    it('updates preferences', async () => {
      service.updatePreferences.mockResolvedValue({ id: 'usr_1' });
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue({ theme: 'dark' });

      const res = await controller.updatePreferences(c);
      expect(res.status).toBe(200);
      expect(service.updatePreferences).toHaveBeenCalledWith('usr_1', { theme: 'dark' });
    });

    it('returns 400 for an invalid preferences payload', async () => {
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue({ theme: 'neon' });

      const res = await controller.updatePreferences(c);
      expect(res.status).toBe(400);
    });

    it('updates settings', async () => {
      service.updateSettings.mockResolvedValue({ id: 'usr_1' });
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue({ twoFactorEnabled: true });

      const res = await controller.updateSettings(c);
      expect(res.status).toBe(200);
      expect(service.updateSettings).toHaveBeenCalledWith('usr_1', { twoFactorEnabled: true });
    });
  });

  describe('activateUser / deactivateUser / deleteUser', () => {
    it('activates a user', async () => {
      service.activateUser.mockResolvedValue({ id: 'usr_1' });
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');

      const res = await controller.activateUser(c);
      expect(res.status).toBe(200);
      expect(service.activateUser).toHaveBeenCalledWith('usr_1');
    });

    it('deactivates a user with a reason', async () => {
      service.deactivateUser.mockResolvedValue({ id: 'usr_1' });
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue({ reason: 'Abuse' });

      const res = await controller.deactivateUser(c);
      expect(res.status).toBe(200);
      expect(service.deactivateUser).toHaveBeenCalledWith('usr_1', 'Abuse');
    });

    it('deactivates a user without a body', async () => {
      service.deactivateUser.mockResolvedValue({ id: 'usr_1' });
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');
      (c.req.json as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no body'));

      const res = await controller.deactivateUser(c);
      expect(res.status).toBe(200);
      expect(service.deactivateUser).toHaveBeenCalledWith('usr_1', undefined);
    });

    it('archives (deletes) a user', async () => {
      service.archiveUser.mockResolvedValue(undefined);
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');

      const res = await controller.deleteUser(c);
      expect(res.status).toBe(200);
      expect(service.archiveUser).toHaveBeenCalledWith('usr_1');
    });
  });

  describe('listUsers', () => {
    it('lists users with parsed pagination', async () => {
      service.listUsers.mockResolvedValue({ data: [], total: 0 });
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({ page: '2', limit: '10' });

      const res = await controller.listUsers(c);
      expect(res.status).toBe(200);
      expect(service.listUsers).toHaveBeenCalledWith({ page: 2, limit: 10 });
    });

    it('falls back to defaults for invalid pagination', async () => {
      service.listUsers.mockResolvedValue({ data: [], total: 0 });
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({ page: 'abc' });

      const res = await controller.listUsers(c);
      expect(res.status).toBe(200);
      expect(service.listUsers).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });
  });

  describe('checkAuthentication / validateRegistration', () => {
    it('checks authentication', async () => {
      service.checkAuthentication.mockResolvedValue({ allowed: true });
      const c = makeContext();
      (c.req.param as ReturnType<typeof vi.fn>).mockReturnValue('usr_1');

      const res = await controller.checkAuthentication(c);
      expect(res.status).toBe(200);
      expect(service.checkAuthentication).toHaveBeenCalledWith('usr_1');
    });

    it('returns valid for a well-formed registration', async () => {
      const c = makeContext();
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue({
        email: 'a@b.com',
        displayName: 'Test',
        password: 'ValidPass1',
      });

      const res = await controller.validateRegistration(c);
      expect(res.status).toBe(200);
      expect(JSON.parse(await res.text())).toMatchObject({
        data: { valid: true, errors: [] },
      });
    });

    it('collects issues for an invalid registration', async () => {
      const c = makeContext();
      (c.req.json as ReturnType<typeof vi.fn>).mockResolvedValue({
        email: 'nope',
        displayName: 'X',
      });

      const res = await controller.validateRegistration(c);
      expect(res.status).toBe(200);
      const body = JSON.parse(await res.text());
      expect(body.data.valid).toBe(false);
      expect(body.data.errors.length).toBeGreaterThan(0);
    });
  });
});
