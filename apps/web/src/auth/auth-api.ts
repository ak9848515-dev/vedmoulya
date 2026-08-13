// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Identity Auth API Client
// MOB-001 — Mobile Authentication
// Thin typed client for the EXISTING Identity Service auth REST endpoints
// (services/identity/src/auth/AuthRoutes.ts). No endpoint is modified — the
// client only consumes the documented contract:
//
//   POST /auth/sign-in                     → { data: AuthSession }
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
  tokens: AuthTokenPair;
}

export interface GoogleAuthUrlResult {
  url: string;
  state: string;
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
