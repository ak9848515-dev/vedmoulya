// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Identity Auth API Client
// MOB-001 — Mobile Authentication
// Thin typed client for the EXISTING Identity Service auth REST endpoints
// (services/identity/src/auth/AuthRoutes.ts). No endpoint is modified — the
// client only consumes the documented contract:
//
//   POST /auth/sign-in                     → { data: AuthSession }
//   POST /auth/sign-up                     → { data: AuthSession | { verificationRequired } }
//   POST /auth/verify-email                → { data: { verified } } (SPRINT-045)
//   POST /auth/resend-verification         → { data: { sent } } (SPRINT-045)
//   GET  /auth/google/url                  → { data: { url, state } }
//   GET  /auth/google/callback?code=...    → { data: AuthSession }
//   POST /auth/refresh                     → { data: TokenPair }
//   GET  /auth/session                     → { data: { userId, email, role } }
//   POST /auth/sign-out                    → { data: { message } }
//
// All responses use the { success, data | error } envelope.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { authEndpoint } from './config.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token expiry as an epoch-milliseconds timestamp. */
  expiresAt: number;
}

export interface AuthSession {
  userId: string;
  email: string;
  role: string;
  /** Display name (name is mandatory at registration). */
  displayName: string;
  /** First-login profile completion — server-derived, authoritative. */
  profileComplete: boolean;
  tokens: AuthTokenPair;
}

/** Self-service profile read/write payloads (GET /me, PATCH /me/profile). */
export interface ProfileView {
  userId: string;
  email: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  age?: number;
  gender?: string;
  purpose?: string;
  primaryGoal?: string;
  profileComplete: boolean;
}

export interface ProfileUpdateInput {
  displayName?: string;
  givenName?: string;
  familyName?: string;
  age?: number;
  gender?: string;
  purpose?: string;
  primaryGoal?: string;
}

export interface GoogleAuthUrlResult {
  url: string;
  state: string;
}

/** Payload for the Identity Service email/password sign-up endpoint. */
export interface SignUpParams {
  email: string;
  password: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
}

/**
 * Sign-up response. In development/test the Identity Service returns a full
 * AuthSession immediately; in production/staging an account requires email
 * verification, so NO session is issued and `verificationRequired` is set —
 * the UI must show the "check your email" state instead of navigating on.
 */
export interface SignUpResponse {
  session?: AuthSession;
  verificationRequired?: boolean;
}

/** Thrown for non-2xx responses; carries the backend error envelope. */
export class AuthApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
  }
}

/** True when a fetch failed at the network layer (offline / DNS / timeout). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.name === 'AbortError');
}

// ── Core request helper ──────────────────────────────────────────────────────

interface ApiEnvelope {
  success: boolean;
  data?: unknown;
  error?: { code?: string; message?: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Network-level failures (offline, unreachable) bubble up as-is so callers
  // can distinguish "offline" from "rejected".
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(authEndpoint(path), {
    ...init,
    headers,
  });

  let envelope: ApiEnvelope | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope;
  } catch {
    envelope = null;
  }

  if (!response.ok || !envelope?.success) {
    throw new AuthApiError(
      response.status,
      envelope?.error?.code ?? 'REQUEST_FAILED',
      envelope?.error?.message ?? `Request failed with status ${String(response.status)}`,
    );
  }

  return envelope.data as T;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** Email/password sign-in — returns the full auth session. */
export function signInWithEmail(email: string, password: string): Promise<AuthSession> {
  return request<AuthSession>('sign-in', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Email/password account registration through the EXISTING /auth/sign-up
 * endpoint. In development/test the Identity Service returns a full AuthSession
 * (the new user is authenticated immediately) which the caller applies via the
 * normal session lifecycle; in production/staging it returns
 * `verificationRequired: true` with NO session — the caller shows the
 * email-verification state. Duplicate email → AuthApiError (status 409).
 */
export async function signUpWithEmail(params: SignUpParams): Promise<SignUpResponse> {
  // The endpoint's `data` is polymorphic: in development/test it is the full
  // AuthSession; in production/staging it is `{ verificationRequired: true }`
  // with NO session. Normalize both into the SignUpResponse contract.
  const data = await request<SignUpResponse | AuthSession>('sign-up', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if ('verificationRequired' in data) {
    return { verificationRequired: true };
  }
  return { session: data as AuthSession };
}

/** Verify an email-verification token (the emailed link target). */
export function verifyEmailToken(token: string): Promise<{ verified: boolean }> {
  return request<{ verified: boolean }>('verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/**
 * Re-send the verification email. The endpoint always succeeds (no account
 * enumeration) — the UI treats any non-network response as "sent".
 */
export function resendVerificationEmail(email: string): Promise<{ sent: boolean }> {
  return request<{ sent: boolean }>('resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Fetch the Google OAuth authorization URL + CSRF state. */
export function fetchGoogleAuthUrl(): Promise<GoogleAuthUrlResult> {
  return request<GoogleAuthUrlResult>('google/url');
}

/** Exchange the OAuth code returned by Google for an auth session. */
export function exchangeGoogleCode(code: string): Promise<AuthSession> {
  return request<AuthSession>(`google/callback?code=${encodeURIComponent(code)}`);
}

/** Refresh an expired access token; returns a new token pair. */
export function refreshAccessToken(refreshToken: string): Promise<AuthTokenPair> {
  return request<AuthTokenPair>('refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

/** Verify the current access token (throws AuthApiError 401 when invalid). */
export function verifySession(
  accessToken: string,
): Promise<{ userId: string; email: string; role: string }> {
  return request<{ userId: string; email: string; role: string }>('session', {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

/** Server-side sign-out (best-effort; local clearing must always happen). */
export function signOut(accessToken: string): Promise<{ message: string }> {
  return request<{ message: string }>('sign-out', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

/** Read the authenticated user's own profile (server-authoritative first-login
 *  completion state). GET /me — the userId comes from the token, never input. */
export function getProfile(accessToken: string): Promise<ProfileView> {
  return request<ProfileView>('me', {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

/** Save the authenticated user's own profile (first-login profile setup).
 *  PATCH /me/profile — cross-user updates are impossible (userId from token). */
export function updateProfile(accessToken: string, data: ProfileUpdateInput): Promise<ProfileView> {
  return request<ProfileView>('me/profile', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(data),
  });
}
