// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Identity Routes
// Verifies route wiring against the Hono app with a mocked service,
// AND the fail-closed authorization policy added in the Sprint
// 022–025 closure phase (Phase 4B): public self-service only, every
// other route requires authentication, and user management requires
// the matching CASL ability or ownership of the addressed record.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createIdentityRouter,
  identityRouteConfig,
  type IdentityRouterAuth,
} from '../src/presentation/routes/IdentityRoutes.js';
import type { AccessTokenPayload } from '../src/auth/TokenService.js';

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

/**
 * A deterministic access-token verifier double. Only the tokens it knows
 * resolve to a session — anything else is invalid, exactly like the real
 * `TokenService.verifyAccessToken` returning null.
 */
const SESSION: Record<string, AccessTokenPayload> = {
  'tok-user': { sub: 'usr_1', email: 'user@example.com', role: 'user', type: 'access' },
  'tok-other': { sub: 'usr_2', email: 'other@example.com', role: 'user', type: 'access' },
  'tok-moderator': {
    sub: 'usr_mod',
    email: 'mod@example.com',
    role: 'moderator',
    type: 'access',
  },
  'tok-admin': { sub: 'usr_admin', email: 'admin@example.com', role: 'admin', type: 'access' },
};

const auth: IdentityRouterAuth = {
  verifyToken: async (token) => SESSION[token] ?? null,
};

const bearer = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

describe('IdentityRoutes', () => {
  let service: ReturnType<typeof makeService>;
  let app: ReturnType<typeof createIdentityRouter>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService();
    app = createIdentityRouter(service as never, auth);
  });

  it('declares route metadata', () => {
    expect(identityRouteConfig.basePath).toBe('/api/v1/identity');
    expect(identityRouteConfig.tags).toContain('Identity');
    expect(identityRouteConfig.description).toContain('Identity');
    expect(identityRouteConfig.authorization).toContain('fail-closed');
  });

  // ── Public surface (no token) ────────────────────────────────────────────

  it('serves a health check', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'healthy', service: 'identity' });
  });

  it('registers a user via POST /users', async () => {
    service.registerUser.mockResolvedValue({ id: 'usr_1' });
    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'new@example.com',
        displayName: 'New User',
        password: 'ValidPass1',
      }),
    });
    expect(res.status).toBe(201);
    expect(service.registerUser).toHaveBeenCalled();
  });

  it('validates registration via POST /users/validate', async () => {
    const res = await app.request('/users/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'new@example.com',
        displayName: 'New User',
        password: 'ValidPass1',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { valid: boolean } };
    expect(body.data.valid).toBe(true);
  });

  // ── Fail-closed: no token / invalid token ────────────────────────────────

  it.each([
    ['GET', '/users'],
    ['GET', '/users/usr_1'],
    ['GET', '/users/email/a@b.com'],
    ['PATCH', '/users/usr_1/profile'],
    ['PATCH', '/users/usr_1/preferences'],
    ['PATCH', '/users/usr_1/settings'],
    ['POST', '/users/usr_1/activate'],
    ['POST', '/users/usr_1/deactivate'],
    ['DELETE', '/users/usr_1'],
    ['GET', '/users/usr_1/auth-check'],
  ])('%s %s without a token → 401 and the service is never reached', async (method, path) => {
    const res = await app.request(path, { method });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NO_TOKEN');
    for (const fn of [
      service.listUsers,
      service.getUserById,
      service.getUserByEmail,
      service.updateProfile,
      service.updatePreferences,
      service.updateSettings,
      service.activateUser,
      service.deactivateUser,
      service.archiveUser,
      service.checkAuthentication,
    ]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('rejects an invalid/expired token with 401 TOKEN_INVALID', async () => {
    const res = await app.request('/users', { headers: bearer('not-a-real-token') });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('TOKEN_INVALID');
    expect(service.listUsers).not.toHaveBeenCalled();
  });

  // ── Administrative routes require the matching ability ──────────────────

  it('denies the user list to a plain user (403) and never calls the service', async () => {
    const res = await app.request('/users?page=1&limit=20', { headers: bearer('tok-user') });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(service.listUsers).not.toHaveBeenCalled();
  });

  it('allows a moderator to list users', async () => {
    service.listUsers.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
    const res = await app.request('/users?page=1&limit=20', {
      headers: bearer('tok-moderator'),
    });
    expect(res.status).toBe(200);
    expect(service.listUsers).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('allows an admin to list users', async () => {
    service.listUsers.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
    const res = await app.request('/users', { headers: bearer('tok-admin') });
    expect(res.status).toBe(200);
  });

  it('denies email lookup to a plain user (403)', async () => {
    const res = await app.request('/users/email/a@b.com', { headers: bearer('tok-user') });
    expect(res.status).toBe(403);
    expect(service.getUserByEmail).not.toHaveBeenCalled();
  });

  it('allows email lookup to a moderator (route ordering before /:id)', async () => {
    service.getUserByEmail.mockResolvedValue({ id: 'usr_1' });
    const res = await app.request('/users/email/a@b.com', {
      headers: bearer('tok-moderator'),
    });
    expect(res.status).toBe(200);
    expect(service.getUserByEmail).toHaveBeenCalledWith('a@b.com');
    expect(service.getUserById).not.toHaveBeenCalled();
  });

  it('activate/deactivate require the update-User ability', async () => {
    service.activateUser.mockResolvedValue({ id: 'usr_1' });
    service.deactivateUser.mockResolvedValue({ id: 'usr_1' });

    const denied = await app.request('/users/usr_1/activate', {
      method: 'POST',
      headers: bearer('tok-user'),
    });
    expect(denied.status).toBe(403);
    expect(service.activateUser).not.toHaveBeenCalled();

    const activate = await app.request('/users/usr_1/activate', {
      method: 'POST',
      headers: bearer('tok-moderator'),
    });
    expect(activate.status).toBe(200);
    expect(service.activateUser).toHaveBeenCalledWith('usr_1');

    const deactivate = await app.request('/users/usr_1/deactivate', {
      method: 'POST',
      headers: bearer('tok-moderator'),
    });
    expect(deactivate.status).toBe(200);
    expect(service.deactivateUser).toHaveBeenCalled();
  });

  it('archive (DELETE) is admin-only: a moderator is denied, an admin succeeds', async () => {
    service.archiveUser.mockResolvedValue(undefined);

    const denied = await app.request('/users/usr_1', {
      method: 'DELETE',
      headers: bearer('tok-moderator'),
    });
    expect(denied.status).toBe(403);
    expect(service.archiveUser).not.toHaveBeenCalled();

    const allowed = await app.request('/users/usr_1', {
      method: 'DELETE',
      headers: bearer('tok-admin'),
    });
    expect(allowed.status).toBe(200);
    expect(service.archiveUser).toHaveBeenCalledWith('usr_1');
  });

  // ── Self-service routes require ownership of the addressed record ───────

  it('gets a user by id only for the owner', async () => {
    service.getUserById.mockResolvedValue({ id: 'usr_1' });

    const forbidden = await app.request('/users/usr_1', { headers: bearer('tok-other') });
    expect(forbidden.status).toBe(403);
    expect(service.getUserById).not.toHaveBeenCalled();

    const res = await app.request('/users/usr_1', { headers: bearer('tok-user') });
    expect(res.status).toBe(200);
    expect(service.getUserById).toHaveBeenCalledWith('usr_1');
  });

  it('updates a profile only for the owner', async () => {
    service.updateProfile.mockResolvedValue({ id: 'usr_1' });

    const forbidden = await app.request('/users/usr_1/profile', {
      method: 'PATCH',
      headers: bearer('tok-other'),
      body: JSON.stringify({ displayName: 'Renamed' }),
    });
    expect(forbidden.status).toBe(403);
    expect(service.updateProfile).not.toHaveBeenCalled();

    const res = await app.request('/users/usr_1/profile', {
      method: 'PATCH',
      headers: bearer('tok-user'),
      body: JSON.stringify({ displayName: 'Renamed' }),
    });
    expect(res.status).toBe(200);
    expect(service.updateProfile).toHaveBeenCalled();
  });

  it('updates preferences for the owner', async () => {
    service.updatePreferences.mockResolvedValue({ id: 'usr_1' });
    const res = await app.request('/users/usr_1/preferences', {
      method: 'PATCH',
      headers: bearer('tok-user'),
      body: JSON.stringify({ theme: 'dark' }),
    });
    expect(res.status).toBe(200);
  });

  it('updates settings for the owner', async () => {
    service.updateSettings.mockResolvedValue({ id: 'usr_1' });
    const res = await app.request('/users/usr_1/settings', {
      method: 'PATCH',
      headers: bearer('tok-user'),
      body: JSON.stringify({ twoFactorEnabled: true }),
    });
    expect(res.status).toBe(200);
  });

  it('checks authentication for the owner only', async () => {
    service.checkAuthentication.mockResolvedValue({ allowed: true });

    const forbidden = await app.request('/users/usr_1/auth-check', {
      headers: bearer('tok-other'),
    });
    expect(forbidden.status).toBe(403);
    expect(service.checkAuthentication).not.toHaveBeenCalled();

    const res = await app.request('/users/usr_1/auth-check', { headers: bearer('tok-user') });
    expect(res.status).toBe(200);
    expect(service.checkAuthentication).toHaveBeenCalledWith('usr_1');
  });

  // ── The verifier is a REQUIRED dependency (fail-closed by construction) ──

  it('cannot be constructed without an authentication verifier', () => {
    // Type-level guarantee: the second argument is not optional. At runtime a
    // missing verifier must throw rather than serve an unguarded surface.
    expect(() => (createIdentityRouter as unknown as (s: unknown) => unknown)(service)).toThrow(
      /requires an access-token verifier/,
    );
  });
});
