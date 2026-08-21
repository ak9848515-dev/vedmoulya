// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: AuthRoutes
// Covers all auth HTTP endpoints (sign-in, sign-up, sign-out, refresh,
// Google OAuth, session, health) via a mocked AuthService.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { createAuthRouter, authRouteConfig } from '../src/auth/AuthRoutes.js';
import type { AuthService } from '../src/auth/AuthService.js';

const tokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: Date.now() + 60_000,
};

function mockAuthService(): Record<string, unknown> {
  return {
    signInWithEmail: vi.fn(),
    signUp: vi.fn(),
    verifySession: vi.fn(),
    refreshSession: vi.fn(),
    getGoogleAuthUrl: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  };
}

function app(service: Record<string, unknown>): ReturnType<typeof createAuthRouter> {
  return createAuthRouter(service as unknown as AuthService);
}

describe('createAuthRouter', () => {
  it('exposes route configuration metadata', () => {
    expect(authRouteConfig.basePath).toBe('/api/v1/identity/auth');
    expect(authRouteConfig.tags).toContain('Authentication');
  });

  it('GET /health returns healthy', async () => {
    const res = await app(mockAuthService()).request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('healthy');
  });

  // ── SPRINT-041B — first-login profile (GET /me + PATCH /me/profile) ────

  describe('GET /me', () => {
    it('returns the authenticated user profile', async () => {
      const service = mockAuthService();
      (service.verifySession as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: 'usr_1',
        email: 'a@b.com',
        role: 'user',
      });
      (service.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'usr_1',
        email: 'a@b.com',
        displayName: 'A',
        profileComplete: false,
      });
      const res = await app(service).request('/me', {
        headers: { authorization: 'Bearer token' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: { userId: string } };
      expect(body.success).toBe(true);
      expect(body.data.userId).toBe('usr_1');
      // userId came from the token (payload.sub), never from client input.
      expect(service.getProfile).toHaveBeenCalledWith('usr_1');
    });

    it('rejects a missing token with 401', async () => {
      const res = await app(mockAuthService()).request('/me');
      expect(res.status).toBe(401);
    });

    it('rejects an invalid token with 401', async () => {
      const service = mockAuthService();
      (service.verifySession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const res = await app(service).request('/me', {
        headers: { authorization: 'Bearer bad' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /me/profile', () => {
    it('updates the authenticated user profile (userId from token — no IDOR surface)', async () => {
      const service = mockAuthService();
      (service.verifySession as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: 'usr_1',
        email: 'a@b.com',
        role: 'user',
      });
      (service.updateProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'usr_1',
        email: 'a@b.com',
        displayName: 'A',
        age: 30,
        gender: 'female',
        purpose: 'learning',
        primaryGoal: 'Master TS',
        profileComplete: true,
      });
      const res = await app(service).request('/me/profile', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          age: 30,
          gender: 'female',
          purpose: 'learning',
          primaryGoal: 'Master TS',
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: { profileComplete: boolean } };
      expect(body.success).toBe(true);
      expect(body.data.profileComplete).toBe(true);
      expect(service.updateProfile).toHaveBeenCalledWith(
        'usr_1',
        expect.objectContaining({ age: 30 }),
      );
    });

    it('rejects invalid profile data with 400 (backend remains authoritative)', async () => {
      const service = mockAuthService();
      (service.verifySession as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: 'usr_1',
        email: 'a@b.com',
        role: 'user',
      });
      const res = await app(service).request('/me/profile', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ age: 300 }),
      });
      expect(res.status).toBe(400);
      expect(service.updateProfile).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated update with 401', async () => {
      const res = await app(mockAuthService()).request('/me/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ age: 30 }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /sign-in', () => {
    it('signs in successfully', async () => {
      const service = mockAuthService();
      (service.signInWithEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        session: { userId: 'u1', email: 'a@b.com', role: 'user', tokens },
      });
      const res = await app(service).request('/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'secret' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: { userId: string } };
      expect(body.success).toBe(true);
      expect(body.data.userId).toBe('u1');
    });

    it('returns 400 for invalid input', async () => {
      const service = mockAuthService();
      const res = await app(service).request('/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: '' }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 when credentials are wrong', async () => {
      const service = mockAuthService();
      (service.signInWithEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Invalid email or password',
      });
      const res = await app(service).request('/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /sign-up', () => {
    it('registers a user (201)', async () => {
      const service = mockAuthService();
      (service.signUp as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        session: { userId: 'u2', email: 'new@b.com', role: 'user', tokens },
      });
      const res = await app(service).request('/sign-up', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'new@b.com',
          password: 'ValidPass1',
          displayName: 'New',
        }),
      });
      expect(res.status).toBe(201);
    });

    it('returns 400 for a weak password', async () => {
      const service = mockAuthService();
      const res = await app(service).request('/sign-up', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'new@b.com',
          password: 'weak',
          displayName: 'New',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 409 when the email is already registered', async () => {
      const service = mockAuthService();
      (service.signUp as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Email already registered',
      });
      const res = await app(service).request('/sign-up', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'dup@b.com',
          password: 'ValidPass1',
          displayName: 'Dup',
        }),
      });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /sign-out', () => {
    it('returns signed out without a token', async () => {
      const service = mockAuthService();
      const res = await app(service).request('/sign-out', { method: 'POST' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { message: string } };
      expect(body.data.message).toBe('Signed out');
    });

    it('signs out the session user when a valid token is present', async () => {
      const service = mockAuthService();
      (service.verifySession as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: 'u1',
        email: 'a@b.com',
        role: 'user',
        type: 'access',
      });
      const res = await app(service).request('/sign-out', {
        method: 'POST',
        headers: { Authorization: 'Bearer token-1' },
      });
      expect(res.status).toBe(200);
      expect(service.signOut).toHaveBeenCalledWith('u1');
    });
  });

  describe('POST /refresh', () => {
    it('returns a new token pair', async () => {
      const service = mockAuthService();
      (service.refreshSession as ReturnType<typeof vi.fn>).mockResolvedValue({ tokens });
      const res = await app(service).request('/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'rt-1' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { accessToken: string } };
      expect(body.data.accessToken).toBe('access-token');
    });

    it('returns 401 for an invalid refresh token', async () => {
      const service = mockAuthService();
      (service.refreshSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const res = await app(service).request('/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'bad' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 for missing token', async () => {
      const service = mockAuthService();
      const res = await app(service).request('/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Google OAuth', () => {
    it('GET /google/url returns an authorization URL', async () => {
      const service = mockAuthService();
      (service.getGoogleAuthUrl as ReturnType<typeof vi.fn>).mockReturnValue(
        'https://google.com/auth',
      );
      const res = await app(service).request('/google/url');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { url: string; state: string } };
      expect(body.data.url).toContain('google.com');
      expect(body.data.state).toBeTruthy();
    });

    it('GET /google/callback returns 400 without a code', async () => {
      const service = mockAuthService();
      const res = await app(service).request('/google/callback');
      expect(res.status).toBe(400);
    });

    it('GET /google/callback returns a session on success', async () => {
      const service = mockAuthService();
      (service.signInWithGoogle as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        session: { userId: 'u3', email: 'g@b.com', role: 'user', tokens },
      });
      const res = await app(service).request('/google/callback?code=code-1');
      expect(res.status).toBe(200);
    });

    it('GET /google/callback returns 401 when the provider fails', async () => {
      const service = mockAuthService();
      (service.signInWithGoogle as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Google authentication failed',
      });
      const res = await app(service).request('/google/callback?code=bad');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /session', () => {
    it('returns the session payload for a valid token', async () => {
      const service = mockAuthService();
      (service.verifySession as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: 'u1',
        email: 'a@b.com',
        role: 'user',
        type: 'access',
      });
      const res = await app(service).request('/session', {
        headers: { Authorization: 'Bearer token-1' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { userId: string; email: string } };
      expect(body.data.userId).toBe('u1');
      expect(body.data.email).toBe('a@b.com');
    });

    it('returns 401 without a token', async () => {
      const service = mockAuthService();
      const res = await app(service).request('/session');
      expect(res.status).toBe(401);
    });

    it('returns 401 for an invalid token', async () => {
      const service = mockAuthService();
      (service.verifySession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const res = await app(service).request('/session', {
        headers: { Authorization: 'Bearer bad' },
      });
      expect(res.status).toBe(401);
    });
  });
});
