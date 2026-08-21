// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Auth API Client Tests
// MOB-001 — Mobile Authentication
// Verifies the typed client for the Identity Service auth REST endpoints:
// request building, envelope parsing, error mapping, network errors.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthApiError,
  exchangeGoogleCode,
  fetchGoogleAuthUrl,
  getProfile,
  isNetworkError,
  refreshAccessToken,
  resendVerificationEmail,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  updateProfile,
  verifyEmailToken,
  verifySession,
} from '../auth-api.js';

const SESSION_BODY = {
  userId: 'user-1',
  email: 'user@vedmoulya.com',
  role: 'user',
  tokens: {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 60_000,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signInWithEmail', () => {
  it('returns the auth session on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: SESSION_BODY }));
    const session = await signInWithEmail('user@vedmoulya.com', 'secret');
    expect(session.userId).toBe('user-1');
    expect(session.tokens.accessToken).toBe('access-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/identity/auth/sign-in');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'user@vedmoulya.com',
      password: 'secret',
    });
  });

  it('throws AuthApiError with the backend message on 401', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'AUTH_FAILED', message: 'Invalid email or password' } },
        401,
      ),
    );
    await expect(signInWithEmail('a@b.com', 'wrong')).rejects.toMatchObject({
      name: 'AuthApiError',
      status: 401,
      code: 'AUTH_FAILED',
      message: 'Invalid email or password',
    });
  });

  it('propagates network errors so callers can detect offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(signInWithEmail('a@b.com', 'x')).rejects.toThrow(TypeError);
  });
});

describe('signUpWithEmail', () => {
  it('POSTs the registration payload to /sign-up and returns the session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: SESSION_BODY }));
    const response = await signUpWithEmail({
      email: 'user@vedmoulya.com',
      password: 'Secret123',
      displayName: 'Test User',
      givenName: 'Test',
      familyName: 'User',
    });
    expect(response.session?.userId).toBe('user-1');
    expect(response.session?.tokens.accessToken).toBe('access-1');
    expect(response.verificationRequired).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/identity/auth/sign-up');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'user@vedmoulya.com',
      password: 'Secret123',
      displayName: 'Test User',
      givenName: 'Test',
      familyName: 'User',
    });
  });

  it('omits optional name parts when not provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: SESSION_BODY }));
    await signUpWithEmail({
      email: 'user@vedmoulya.com',
      password: 'Secret123',
      displayName: 'Test User',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'user@vedmoulya.com',
      password: 'Secret123',
      displayName: 'Test User',
    });
  });

  it('throws AuthApiError with the backend message on duplicate email (409)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: 'REGISTRATION_FAILED', message: 'Email already registered' },
        },
        409,
      ),
    );
    await expect(
      signUpWithEmail({ email: 'taken@vedmoulya.com', password: 'Secret123', displayName: 'T' }),
    ).rejects.toMatchObject({
      name: 'AuthApiError',
      status: 409,
      code: 'REGISTRATION_FAILED',
      message: 'Email already registered',
    });
  });

  it('propagates network errors so callers can detect offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      signUpWithEmail({ email: 'a@b.com', password: 'Secret123', displayName: 'T' }),
    ).rejects.toThrow(TypeError);
  });
});

describe('fetchGoogleAuthUrl', () => {
  it('returns the OAuth URL and CSRF state', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { url: 'https://accounts.google.com/…', state: 'st-1' },
      }),
    );
    const result = await fetchGoogleAuthUrl();
    expect(result.url).toContain('accounts.google.com');
    expect(result.state).toBe('st-1');
  });
});

describe('exchangeGoogleCode', () => {
  it('calls the callback endpoint with the code and returns the session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: SESSION_BODY }));
    const session = await exchangeGoogleCode('auth-code-123');
    expect(session.userId).toBe('user-1');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/google/callback?code=auth-code-123');
  });
});

describe('refreshAccessToken', () => {
  it('returns a fresh token pair', async () => {
    const tokens = { accessToken: 'access-2', refreshToken: 'refresh-2', expiresAt: 999 };
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: tokens }));
    const result = await refreshAccessToken('refresh-1');
    expect(result.accessToken).toBe('access-2');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'refresh-1' });
  });

  it('throws AuthApiError when the refresh token is rejected', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: 'TOKEN_INVALID', message: 'Invalid or expired refresh token' },
        },
        401,
      ),
    );
    await expect(refreshAccessToken('bad')).rejects.toBeInstanceOf(AuthApiError);
  });
});

describe('verifySession', () => {
  it('attaches the bearer token and resolves on success', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { userId: 'u', email: 'e', role: 'user' } }),
    );
    await expect(verifySession('access-1')).resolves.toEqual({
      userId: 'u',
      email: 'e',
      role: 'user',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer access-1');
  });

  it('throws on 401 (invalid/expired token)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: 'TOKEN_INVALID', message: 'Invalid or expired access token' },
        },
        401,
      ),
    );
    await expect(verifySession('expired')).rejects.toBeInstanceOf(AuthApiError);
  });
});

describe('signOut', () => {
  it('POSTs to sign-out with the bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { message: 'Signed out' } }));
    await expect(signOut('access-1')).resolves.toEqual({ message: 'Signed out' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/sign-out');
    expect(init.method).toBe('POST');
  });
});

describe('getProfile (SPRINT-041B first-login)', () => {
  it('GETs /me with the bearer token and resolves the profile', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          userId: 'u',
          email: 'e',
          displayName: 'Ada',
          age: 30,
          gender: 'female',
          purpose: 'learning',
          primaryGoal: 'Master TS',
          profileComplete: true,
        },
      }),
    );
    const profile = await getProfile('access-1');
    expect(profile.profileComplete).toBe(true);
    expect(profile.primaryGoal).toBe('Master TS');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/identity/auth/me');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer access-1');
  });

  it('throws AuthApiError on 401', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: 'TOKEN_INVALID', message: 'Invalid or expired access token' },
        },
        401,
      ),
    );
    await expect(getProfile('expired')).rejects.toBeInstanceOf(AuthApiError);
  });
});

describe('updateProfile (SPRINT-041B first-login)', () => {
  it('PATCHes /me/profile with the payload and bearer token', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          userId: 'u',
          email: 'e',
          displayName: 'Ada',
          age: 30,
          gender: 'female',
          purpose: 'learning',
          primaryGoal: 'Master TS',
          profileComplete: true,
        },
      }),
    );
    const profile = await updateProfile('access-1', {
      age: 30,
      gender: 'female',
      purpose: 'learning',
      primaryGoal: 'Master TS',
    });
    expect(profile.profileComplete).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/me/profile');
    expect(init.method).toBe('PATCH');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer access-1');
    expect(JSON.parse(String(init.body))).toEqual({
      age: 30,
      gender: 'female',
      purpose: 'learning',
      primaryGoal: 'Master TS',
    });
  });

  it('throws AuthApiError with the backend validation message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: { fieldErrors: { age: ['Number must be less than or equal to 120'] } },
          },
        },
        400,
      ),
    );
    const err = await updateProfile('access-1', { age: 300 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthApiError);
    expect((err as AuthApiError).status).toBe(400);
  });
});

describe('verifyEmailToken', () => {
  it('POSTs the token to /verify-email and returns verified', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { verified: true } }));
    const result = await verifyEmailToken('tok-abc');
    expect(result.verified).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/identity/auth/verify-email');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ token: 'tok-abc' });
  });

  it('surfaces the backend failure code as an AuthApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, error: { code: 'VERIFY_FAILED', message: 'expired' } }, 400),
    );
    const err = await verifyEmailToken('stale-token').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthApiError);
    expect((err as AuthApiError).code).toBe('VERIFY_FAILED');
    expect((err as AuthApiError).message).toBe('expired');
  });
});

describe('resendVerificationEmail', () => {
  it('POSTs the email to /resend-verification', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { sent: true } }));
    const result = await resendVerificationEmail('user@vedmoulya.com');
    expect(result.sent).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/identity/auth/resend-verification');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'user@vedmoulya.com' });
  });
});

describe('isNetworkError', () => {
  it('recognizes fetch network failures and abort errors', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new DOMException('Aborted', 'AbortError'))).toBe(true);
    expect(isNetworkError(new AuthApiError(401, 'X', 'no'))).toBe(false);
  });
});
