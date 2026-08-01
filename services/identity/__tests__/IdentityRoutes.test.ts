// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Identity Routes
// Verifies route wiring against the Hono app with a mocked service
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createIdentityRouter,
  identityRouteConfig,
} from '../src/presentation/routes/IdentityRoutes.js';

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

describe('IdentityRoutes', () => {
  let service: ReturnType<typeof makeService>;
  let app: ReturnType<typeof createIdentityRouter>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService();
    app = createIdentityRouter(service as never);
  });

  it('declares route metadata', () => {
    expect(identityRouteConfig.basePath).toBe('/api/v1/identity');
    expect(identityRouteConfig.tags).toContain('Identity');
    expect(identityRouteConfig.description).toContain('Identity');
  });

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

  it('lists users via GET /users', async () => {
    service.listUsers.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    const res = await app.request('/users?page=1&limit=20');
    expect(res.status).toBe(200);
    expect(service.listUsers).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('gets a user by email (route ordering before /:id)', async () => {
    service.getUserByEmail.mockResolvedValue({ id: 'usr_1' });
    const res = await app.request('/users/email/a@b.com');
    expect(res.status).toBe(200);
    expect(service.getUserByEmail).toHaveBeenCalledWith('a@b.com');
    expect(service.getUserById).not.toHaveBeenCalled();
  });

  it('gets a user by id', async () => {
    service.getUserById.mockResolvedValue({ id: 'usr_1' });
    const res = await app.request('/users/usr_1');
    expect(res.status).toBe(200);
    expect(service.getUserById).toHaveBeenCalledWith('usr_1');
  });

  it('updates a profile via PATCH /users/:id/profile', async () => {
    service.updateProfile.mockResolvedValue({ id: 'usr_1' });
    const res = await app.request('/users/usr_1/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Renamed' }),
    });
    expect(res.status).toBe(200);
    expect(service.updateProfile).toHaveBeenCalled();
  });

  it('updates preferences via PATCH /users/:id/preferences', async () => {
    service.updatePreferences.mockResolvedValue({ id: 'usr_1' });
    const res = await app.request('/users/usr_1/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme: 'dark' }),
    });
    expect(res.status).toBe(200);
  });

  it('updates settings via PATCH /users/:id/settings', async () => {
    service.updateSettings.mockResolvedValue({ id: 'usr_1' });
    const res = await app.request('/users/usr_1/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ twoFactorEnabled: true }),
    });
    expect(res.status).toBe(200);
  });

  it('activates and deactivates users', async () => {
    service.activateUser.mockResolvedValue({ id: 'usr_1' });
    const activate = await app.request('/users/usr_1/activate', { method: 'POST' });
    expect(activate.status).toBe(200);
    expect(service.activateUser).toHaveBeenCalledWith('usr_1');

    service.deactivateUser.mockResolvedValue({ id: 'usr_1' });
    const deactivate = await app.request('/users/usr_1/deactivate', { method: 'POST' });
    expect(deactivate.status).toBe(200);
    expect(service.deactivateUser).toHaveBeenCalled();
  });

  it('archives a user via DELETE /users/:id', async () => {
    service.archiveUser.mockResolvedValue(undefined);
    const res = await app.request('/users/usr_1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(service.archiveUser).toHaveBeenCalledWith('usr_1');
  });

  it('checks authentication via GET /users/:id/auth-check', async () => {
    service.checkAuthentication.mockResolvedValue({ allowed: true });
    const res = await app.request('/users/usr_1/auth-check');
    expect(res.status).toBe(200);
    expect(service.checkAuthentication).toHaveBeenCalledWith('usr_1');
  });
});
