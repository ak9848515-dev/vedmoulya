import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthRouter } from '../src/auth/AuthRoutes.js';

function createMockService() {
  return {
    signInWithEmail: vi.fn().mockResolvedValue({
      success: true,
      session: { tokens: { accessToken: 'at', refreshToken: 'rt' } },
    }),
    signUp: vi.fn().mockResolvedValue({
      success: true,
      session: { tokens: { accessToken: 'at', refreshToken: 'rt' } },
    }),
    signInWithGoogle: vi.fn().mockResolvedValue({
      success: true,
      session: { tokens: { accessToken: 'at', refreshToken: 'rt' } },
    }),
    getGoogleAuthUrl: vi
      .fn()
      .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?client_id=test'),
    verifySession: vi.fn().mockResolvedValue({ sub: 'user-1', email: 'a@b.com', role: 'user' }),
    signOut: vi.fn().mockResolvedValue(undefined),
    refreshSession: vi
      .fn()
      .mockResolvedValue({ tokens: { accessToken: 'new-at', refreshToken: 'new-rt' } }),
    verifyEmail: vi.fn().mockResolvedValue({ success: true }),
    resendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
    getProfile: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com' }),
    updateProfile: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com' }),
  };
}

describe('AuthRoutes — Google OAuth browser navigation', () => {
  let service: ReturnType<typeof createMockService>;
  let router: ReturnType<typeof createAuthRouter>;

  beforeEach(() => {
    service = createMockService();
    router = createAuthRouter(service as never);
  });

  it('GET /google/callback with browser Accept header and no code returns HTML redirect', async () => {
    const res = await router.request('/google/callback', {
      headers: { accept: 'text/html' },
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('missing_code');
  });

  it('GET /google/callback with browser Accept header and code returns HTML page', async () => {
    const res = await router.request('/google/callback?code=abc123def456&state=s1', {
      headers: { accept: 'text/html' },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Signing in');
    expect(html).toContain('fetch');
    expect(html).toContain('abc123def456');
  });

  it('HTML callback persists a Zustand-compatible envelope containing state', async () => {
    // Regression: the callback must write the FULL parsed persist object `s`
    // (which carries the `state` key the Zustand store hydrates from), never
    // the inner `s.state` — a bare inner object hydrates to an empty session
    // and bounces the just-authenticated user back to /login.
    const res = await router.request('/google/callback?code=abc123def456&state=s1', {
      headers: { accept: 'text/html' },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // The persisted value must be the top-level `s` object (the envelope),
    // NOT `s.state` (the inner payload without the persist wrapper). The
    // trailing `)` closes the setItem call, `}` closes the try block.
    expect(html).toContain(`JSON.stringify(s))}`);
    expect(html).not.toContain(`JSON.stringify(s.state))}`);
    // The envelope must carry the `state` key so HydratableEnvelope.state is
    // defined for the Zustand persist middleware (persist reads .state).
    expect(html).toContain(`s.state={accessToken:t.accessToken`);
  });

  it('GET /google/callback with JSON Accept and code delegates to signInWithGoogle', async () => {
    const res = await router.request('/google/callback?code=abc123def456&state=s1', {
      headers: { accept: 'application/json' },
    });
    expect(res.status).toBe(200);
    expect(service.signInWithGoogle).toHaveBeenCalled();
  });

  it('GET /google/callback with JSON Accept and no code returns error', async () => {
    const res = await router.request('/google/callback', {
      headers: { accept: 'application/json' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('MISSING_CODE');
  });

  it('GET /google/callback with JSON Accept and Google auth failure returns 401', async () => {
    service.signInWithGoogle.mockResolvedValue({ success: false, error: 'Google auth failed' });
    const res = await router.request('/google/callback?code=badcode&state=s1', {
      headers: { accept: 'application/json' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('GOOGLE_AUTH_FAILED');
  });

  it('GET /google/url returns auth URL with origin', async () => {
    const res = await router.request('/google/url');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.url).toContain('google.com');
    expect(body.data.state).toBeTruthy();
    expect(service.getGoogleAuthUrl).toHaveBeenCalled();
  });
});

describe('AuthRoutes — /me and /me/profile', () => {
  let service: ReturnType<typeof createMockService>;
  let router: ReturnType<typeof createAuthRouter>;

  beforeEach(() => {
    service = createMockService();
    router = createAuthRouter(service as never);
  });

  it('GET /me returns profile when authenticated', async () => {
    const res = await router.request('/me', {
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET /me returns 401 without auth header', async () => {
    const res = await router.request('/me');
    expect(res.status).toBe(401);
  });

  it('GET /me returns 401 with invalid token', async () => {
    service.verifySession.mockResolvedValue(null);
    const res = await router.request('/me', {
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(res.status).toBe(401);
  });

  it('PATCH /me/profile updates profile', async () => {
    const res = await router.request('/me/profile', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ displayName: 'New Name' }),
    });
    expect(res.status).toBe(200);
  });

  it('PATCH /me/profile returns 401 without auth header', async () => {
    const res = await router.request('/me/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Name' }),
    });
    expect(res.status).toBe(401);
  });

  it('PATCH /me/profile returns 401 with invalid token', async () => {
    service.verifySession.mockResolvedValue(null);
    const res = await router.request('/me/profile', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer bad',
      },
      body: JSON.stringify({ displayName: 'New Name' }),
    });
    expect(res.status).toBe(401);
  });

  it('PATCH /me/profile returns 400 on validation error', async () => {
    const res = await router.request('/me/profile', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ displayName: '' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('AuthRoutes — session verification', () => {
  let service: ReturnType<typeof createMockService>;
  let router: ReturnType<typeof createAuthRouter>;

  beforeEach(() => {
    service = createMockService();
    router = createAuthRouter(service as never);
  });

  it('GET /session returns user info when authenticated', async () => {
    const res = await router.request('/session', {
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.userId).toBe('user-1');
  });

  it('GET /session returns 401 without auth', async () => {
    const res = await router.request('/session');
    expect(res.status).toBe(401);
  });

  it('GET /session returns 401 with invalid token', async () => {
    service.verifySession.mockResolvedValue(null);
    const res = await router.request('/session', {
      headers: { authorization: 'Bearer bad' },
    });
    expect(res.status).toBe(401);
  });
});

describe('AuthRoutes — sign-out edge cases', () => {
  let service: ReturnType<typeof createMockService>;
  let router: ReturnType<typeof createAuthRouter>;

  beforeEach(() => {
    service = createMockService();
    router = createAuthRouter(service as never);
  });

  it('POST /sign-out without auth still succeeds', async () => {
    const res = await router.request('/sign-out', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('POST /sign-out with valid token signs out the user', async () => {
    const res = await router.request('/sign-out', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    expect(service.signOut).toHaveBeenCalledWith('user-1');
  });

  it('POST /sign-out with invalid token still succeeds (no user to sign out)', async () => {
    service.verifySession.mockResolvedValue(null);
    const res = await router.request('/sign-out', {
      method: 'POST',
      headers: { authorization: 'Bearer bad' },
    });
    expect(res.status).toBe(200);
    expect(service.signOut).not.toHaveBeenCalled();
  });
});

describe('AuthRoutes — token refresh', () => {
  let service: ReturnType<typeof createMockService>;
  let router: ReturnType<typeof createAuthRouter>;

  beforeEach(() => {
    service = createMockService();
    router = createAuthRouter(service as never);
  });

  it('POST /refresh returns new tokens for valid refresh token', async () => {
    const res = await router.request('/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'valid-rt' }),
    });
    expect(res.status).toBe(200);
    expect(service.refreshSession).toHaveBeenCalledWith('valid-rt');
  });

  it('POST /refresh returns 401 for invalid refresh token', async () => {
    service.refreshSession.mockResolvedValue(null);
    const res = await router.request('/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'bad-rt' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /refresh returns 400 for validation error', async () => {
    const res = await router.request('/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe('AuthRoutes — verify-email', () => {
  let service: ReturnType<typeof createMockService>;
  let router: ReturnType<typeof createAuthRouter>;

  beforeEach(() => {
    service = createMockService();
    router = createAuthRouter(service as never);
  });

  it('POST /verify-email returns success for valid token', async () => {
    const res = await router.request('/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'a'.repeat(25) }),
    });
    expect(res.status).toBe(200);
  });

  it('POST /verify-email returns 400 for short token', async () => {
    const res = await router.request('/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /verify-email returns 400 for verification failure', async () => {
    service.verifyEmail.mockResolvedValue({ success: false, error: 'invalid' });
    const res = await router.request('/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'a'.repeat(25) }),
    });
    expect(res.status).toBe(400);
  });
});

describe('AuthRoutes — resend-verification', () => {
  let service: ReturnType<typeof createMockService>;
  let router: ReturnType<typeof createAuthRouter>;

  beforeEach(() => {
    service = createMockService();
    router = createAuthRouter(service as never);
  });

  it('POST /resend-verification returns success', async () => {
    const res = await router.request('/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(200);
  });

  it('POST /resend-verification returns 400 for invalid email', async () => {
    const res = await router.request('/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('AuthRoutes — health', () => {
  let service: ReturnType<typeof createMockService>;
  let router: ReturnType<typeof createAuthRouter>;

  beforeEach(() => {
    service = createMockService();
    router = createAuthRouter(service as never);
  });

  it('GET /health returns healthy', async () => {
    const res = await router.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });
});
