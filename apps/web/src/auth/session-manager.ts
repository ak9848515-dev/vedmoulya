// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Session Manager
// MOB-001 — Mobile Authentication
// Owns the authentication lifecycle on the client:
//
//   restoreSession()      → startup: hydrate → validate/refresh → sessionReady
//   signInWithEmailAndPassword()
//   signUpWithEmailAndPassword() → register via /auth/sign-up, then apply the
//                                 returned session through the SAME lifecycle
//   beginGoogleSignIn()   → fetch OAuth URL, save pending state, navigate
//   completeGoogleSignIn()→ called by /oauth2redirect with the code
//   refreshWithLock()     → single-flight token refresh (tRPC 401 retry)
//   refreshProfile()      → re-fetch /me (server-authoritative first-login
//                           completion), applied on every session restore
//   completeProfile()     → save the first-login profile via PATCH /me/profile
//   logout()              → server sign-out (best-effort) + clear everything
//
// Offline behavior: a network failure during validation/refresh NEVER logs the
// user out — the cached session stays usable and `offline` is flagged so the
// UI can show a banner. Only a definitive auth rejection clears the session.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useAuthStore, type AuthUser } from '../stores/auth-store.js';
import { clearPersistedSession } from './secure-store.js';
import {
  AuthApiError,
  exchangeGoogleCode,
  fetchGoogleAuthUrl,
  getProfile as apiGetProfile,
  isNetworkError,
  refreshAccessToken,
  signInWithEmail as apiSignInWithEmail,
  signOut as apiSignOut,
  signUpWithEmail as apiSignUpWithEmail,
  updateProfile as apiUpdateProfile,
  verifySession,
  type AuthTokenPair,
  type ProfileUpdateInput,
  type SignUpParams,
} from './auth-api.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Skew allowance: treat a token as expired 30s before its real expiry. */
const EXPIRY_SKEW_MS = 30_000;

const PENDING_OAUTH_KEY = 'vedmoulya-oauth-pending';

interface PendingOAuth {
  state: string;
  next: string;
}

// ── Session application ──────────────────────────────────────────────────────

function toAuthUser(session: {
  userId: string;
  email: string;
  role: string;
  displayName?: string;
  profileComplete?: boolean;
}): AuthUser {
  return {
    userId: session.userId,
    email: session.email,
    role: session.role,
    displayName: session.displayName,
    profileComplete: session.profileComplete,
  };
}

function applySession(session: {
  userId: string;
  email: string;
  role: string;
  displayName?: string;
  profileComplete?: boolean;
  tokens: AuthTokenPair;
}): void {
  const store = useAuthStore.getState();

  store.setSession({
    accessToken: session.tokens.accessToken,
    refreshToken: session.tokens.refreshToken,
    expiresAt: session.tokens.expiresAt,
    user: toAuthUser(session),
  });

  store.setSessionReady(true);
}

// ── First-login profile (SPRINT-041B) ───────────────────────────────────────

/**
 * Re-fetch the authenticated user's profile from the server and apply the
 * server-authoritative displayName + profileComplete to the store. Offline-safe
 * (a network failure keeps the cached profile — never logs out, mirroring the
 * token-restore behavior). Used after session restore and after profile save so
 * first-login routing always reflects server state, never client-only flags.
 */
export async function refreshProfile(): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return;
  try {
    const profile = await apiGetProfile(accessToken);
    useAuthStore.getState().setProfile({
      displayName: profile.displayName,
      profileComplete: profile.profileComplete,
    });
  } catch {
    // Offline or transient — keep the cached profile. Never clears the session.
  }
}

/**
 * Save the first-login profile through the existing PATCH /me/profile endpoint
 * and apply the returned server state. Returns ok on success; the caller
 * redirects to the intended destination.
 */
export async function completeProfile(data: ProfileUpdateInput): Promise<SignInOutcome> {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return { ok: false, error: 'Not authenticated.' };
  try {
    const profile = await apiUpdateProfile(accessToken, data);
    useAuthStore.getState().setProfile({
      displayName: profile.displayName,
      profileComplete: profile.profileComplete,
    });
    return { ok: true };
  } catch (error) {
    if (isNetworkError(error)) return { ok: false, error: 'offline' };
    const message =
      error instanceof AuthApiError
        ? error.message
        : 'Could not save your profile. Please try again.';
    return { ok: false, error: message };
  }
}

// ── Single-flight refresh ────────────────────────────────────────────────────

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Attempt to refresh the access token once (single-flight). Returns true when
 * a new token pair was applied. Never throws.
 */
export function refreshWithLock(): Promise<boolean> {
  if (refreshInFlight === null) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    // An expired access token with no refresh token is a dead session — the
    // user must sign in again.
    useAuthStore.getState().clearSession();
    return false;
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    const state = useAuthStore.getState();
    // Preserve the cached user; only the tokens rotate.
    useAuthStore.setState({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      offline: false,
      user: state.user,
    });
    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      // Offline: keep the cached session and flag it rather than logging out.
      useAuthStore.getState().setOffline(true);
      return false;
    }
    // Definitive rejection (invalid/expired refresh token): sign out locally.
    useAuthStore.getState().clearSession();
    return false;
  }
}

// ── Startup restore ──────────────────────────────────────────────────────────

let restorePromise: Promise<void> | null = null;

/**
 * Startup session restore. Runs once after the persisted store has hydrated:
 *  - no stored token             → sessionReady (first launch / signed out)
 *  - token still valid           → verify online (best-effort), keep on error
 *  - token expired               → refresh; refresh failure logs out (unless
 *                                  the network is down — then keep + offline)
 */
export function restoreSession(): Promise<void> {
  if (restorePromise === null) {
    restorePromise = doRestore().finally(() => {
      restorePromise = null;
    });
  }
  return restorePromise;
}

async function doRestore(): Promise<void> {
  const state = useAuthStore.getState();

  if (!state.accessToken || !state.user) {
    useAuthStore.getState().setSessionReady(true);
    return;
  }

  // Only a KNOWN-expired token is refreshed proactively. A token without a
  // stored expiry (e.g. legacy / E2E-injected sessions) is verified online —
  // its validity is decided by the server, never assumed expired.
  const knownExpired = state.expiresAt !== null && state.expiresAt <= Date.now() + EXPIRY_SKEW_MS;

  if (knownExpired) {
    // Expired: refresh (or clear when there is no refresh token).
    await refreshWithLock();
    useAuthStore.getState().setSessionReady(true);
    return;
  }

  try {
    await verifySession(state.accessToken);
    useAuthStore.setState({ offline: false });
  } catch (error) {
    if (isNetworkError(error)) {
      // Offline: keep the cached session and flag it rather than logging out.
      useAuthStore.setState({ offline: true });
    } else {
      // Token rejected server-side — try one refresh before giving up.
      await refreshWithLock();
    }
  }
  // Server-authoritative first-login completion on every load (SPRINT-041B).
  await refreshProfile();
  useAuthStore.getState().setSessionReady(true);
}

// ── Sign-in ─────────────────────────────────────────────────────────────────

export type SignInOutcome = { ok: true } | { ok: false; error: string };

/**
 * Sign-up outcome. `verificationRequired` (production/staging) means the
 * account was created but needs email verification before it can sign in —
 * the UI shows the "check your email" state instead of navigating on.
 */
export type SignUpOutcome =
  { ok: true; verificationRequired?: boolean } | { ok: false; error: string };

/** Email/password sign-in through the existing /auth/sign-in endpoint. */
export async function signInWithEmailAndPassword(
  email: string,
  password: string,
): Promise<SignInOutcome> {
  try {
    const session = await apiSignInWithEmail(email, password);
    applySession(session);
    return { ok: true };
  } catch (error) {
    if (isNetworkError(error)) return { ok: false, error: 'offline' };
    const message =
      error instanceof AuthApiError ? error.message : 'Sign-in failed. Please try again.';
    return { ok: false, error: message };
  }
}

// ── Sign-up ─────────────────────────────────────────────────────────────────

/**
 * Email/password account registration through the existing /auth/sign-up
 * endpoint. In development/test the returned AuthSession is applied through
 * the same lifecycle as sign-in (applySession → persisted store), so a freshly
 * registered user is authenticated immediately. In production/staging the
 * endpoint returns `verificationRequired` with NO session — the caller shows
 * the email-verification state and never applies a session.
 */
export async function signUpWithEmailAndPassword(params: SignUpParams): Promise<SignUpOutcome> {
  try {
    const response = await apiSignUpWithEmail(params);
    if (response.verificationRequired) {
      return { ok: true, verificationRequired: true };
    }
    if (response.session) {
      applySession(response.session);
    }
    return { ok: true };
  } catch (error) {
    if (isNetworkError(error)) return { ok: false, error: 'offline' };
    const message =
      error instanceof AuthApiError ? error.message : 'Sign-up failed. Please try again.';
    return { ok: false, error: message };
  }
}

/**
 * Start the Google OAuth redirect flow:
 * 1. Fetch the authorization URL + CSRF state from /auth/google/url.
 * 2. Persist the pending { state, next } for the callback to verify.
 * 3. Navigate the browser/WebView to Google (full-page redirect — the only
 *    transport compatible with the identity service's web-server OAuth flow).
 */
export async function beginGoogleSignIn(next: string): Promise<SignInOutcome> {
  try {
    const { url, state } = await fetchGoogleAuthUrl();
    const pending: PendingOAuth = { state, next };
    try {
      window.sessionStorage.setItem(PENDING_OAUTH_KEY, JSON.stringify(pending));
    } catch {
      // sessionStorage unavailable — proceed without state verification.
    }
    window.location.assign(url);
    return { ok: true };
  } catch (error) {
    if (isNetworkError(error)) return { ok: false, error: 'offline' };
    return { ok: false, error: 'Could not start Google sign-in. Please try again.' };
  }
}

/**
 * Complete the Google OAuth flow with the code the callback page received.
 * Verifies the CSRF state saved by beginGoogleSignIn, exchanges the code via
 * the existing /auth/google/callback endpoint and applies the session.
 */
export async function completeGoogleSignIn(
  code: string,
  state: string,
): Promise<{ ok: true; next: string } | { ok: false; error: string }> {
  let pending: PendingOAuth | null = null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_OAUTH_KEY);
    pending = raw ? (JSON.parse(raw) as PendingOAuth) : null;
  } catch {
    pending = null;
  }
  try {
    window.sessionStorage.removeItem(PENDING_OAUTH_KEY);
  } catch {
    // ignore
  }

  if (!pending || pending.state !== state) {
    return { ok: false, error: 'OAuth state mismatch. Please try signing in again.' };
  }

  try {
    const session = await exchangeGoogleCode(code);
    applySession(session);
    return { ok: true, next: pending.next };
  } catch (error) {
    if (isNetworkError(error)) return { ok: false, error: 'offline' };
    return { ok: false, error: 'Google sign-in failed. Please try again.' };
  }
}

// ── Logout ──────────────────────────────────────────────────────────────────

/**
 * Logout: best-effort server sign-out, then clear the JWT + cached user state
 * (secure storage / localStorage / memory) so nothing survives a restart.
 */
export async function logout(): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    try {
      await apiSignOut(accessToken);
    } catch {
      // Offline or rejected — local clearing below is the source of truth.
    }
  }
  useAuthStore.getState().clearSession();
  // Remove the persisted JWT/user entirely (not just null them). The persist
  // middleware's async write from clearSession resolves before this removal,
  // so no race on any backend.
  await clearPersistedSession();
  try {
    window.sessionStorage.removeItem(PENDING_OAUTH_KEY);
  } catch {
    // ignore
  }
}
