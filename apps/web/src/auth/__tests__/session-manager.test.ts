// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Session Manager Tests
// MOB-001 — Mobile Authentication
// Verifies the six scenarios from the MOB-001 acceptance matrix:
//   1. First launch         — no stored session → signed out, ready
//   2. Login                — email/password → session stored + persisted
//   3. App restart          — persisted session rehydrated + validated
//   4. Logout               — JWT + cached user + persisted state cleared
//   5. Expired token        — refreshed via /auth/refresh; rejection signs out
//   6. Offline              — network failure keeps the cached session
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/auth-store.js';
import { clearMemoryStore, readPersistedSession } from '../secure-store.js';
import {
  beginGoogleSignIn,
  completeGoogleSignIn,
  completeProfile,
  logout,
  refreshProfile,
  restoreSession,
  signInWithEmailAndPassword,
  signUpWithEmailAndPassword,
} from '../session-manager.js';

const NOW = Date.now();

const SESSION_BODY = {
  userId: 'user-1',
  email: 'user@vedmoulya.com',
  role: 'user',
  tokens: {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: NOW + 60_000,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Reset the in-memory store + persisted storage between tests. */
function resetStore(): void {
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    user: null,
    offline: false,
    sessionReady: false,
  });
  clearMemoryStore();
}

function seedSession(session: typeof SESSION_BODY): void {
  useAuthStore.getState().setSession({
    accessToken: session.tokens.accessToken,
    refreshToken: session.tokens.refreshToken,
    expiresAt: session.tokens.expiresAt,
    user: { userId: session.userId, email: session.email, role: session.role },
  });
}

/**
 * Emulate an app restart: the persisted snapshot survives, the in-memory
 * store boots fresh and rehydrates from persistence.
 */
async function simulateRestart(): Promise<void> {
  const snapshot = await readPersistedSession();
  resetStore(); // writes nulls to storage, so restore the snapshot afterwards
  if (snapshot !== null) {
    const { createPlatformStateStorage, AUTH_PERSIST_KEY } = await import('../secure-store.js');
    await createPlatformStateStorage().setItem(AUTH_PERSIST_KEY, snapshot);
  }
  await useAuthStore.persist.rehydrate();
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  resetStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearMemoryStore();
});

// ── 1. First launch ─────────────────────────────────────────────────────────

describe('first launch', () => {
  it('boots signed-out and ready when nothing is stored', async () => {
    await restoreSession();
    const state = useAuthStore.getState();
    expect(state.sessionReady).toBe(true);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── 2. Login ────────────────────────────────────────────────────────────────

describe('login', () => {
  it('signs in with email/password and persists the session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: SESSION_BODY }));

    const outcome = await signInWithEmailAndPassword('user@vedmoulya.com', 'secret');
    expect(outcome).toEqual({ ok: true });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access-1');
    expect(state.refreshToken).toBe('refresh-1');
    expect(state.user?.email).toBe('user@vedmoulya.com');

    const persisted = await readPersistedSession();
    expect(persisted).toContain('access-1');
    expect(persisted).toContain('user@vedmoulya.com');
  });

  it('surfaces a friendly error for bad credentials', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { success: false, error: { code: 'AUTH_FAILED', message: 'Invalid email or password' } },
        401,
      ),
    );
    const outcome = await signInWithEmailAndPassword('user@vedmoulya.com', 'wrong');
    expect(outcome).toEqual({ ok: false, error: 'Invalid email or password' });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('detects offline sign-in', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const outcome = await signInWithEmailAndPassword('user@vedmoulya.com', 'secret');
    expect(outcome).toEqual({ ok: false, error: 'offline' });
  });
});

// ── 2b. Sign-up (SPRINT-041A) ────────────────────────────────────────────────

describe('sign-up', () => {
  it('registers through the existing API and applies the returned session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: SESSION_BODY }));

    const outcome = await signUpWithEmailAndPassword({
      displayName: 'Test User',
      email: 'user@vedmoulya.com',
      password: 'Secret123',
    });
    expect(outcome).toEqual({ ok: true });

    // The same lifecycle as sign-in: session applied + persisted.
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access-1');
    expect(state.refreshToken).toBe('refresh-1');
    expect(state.user?.email).toBe('user@vedmoulya.com');
    expect(state.sessionReady).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/sign-up');
    expect(JSON.parse(String(init.body))).toEqual({
      displayName: 'Test User',
      email: 'user@vedmoulya.com',
      password: 'Secret123',
    });
  });

  it('surfaces the backend message for a duplicate email', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: { code: 'REGISTRATION_FAILED', message: 'Email already registered' },
        },
        409,
      ),
    );
    const outcome = await signUpWithEmailAndPassword({
      displayName: 'Test User',
      email: 'taken@vedmoulya.com',
      password: 'Secret123',
    });
    expect(outcome).toEqual({ ok: false, error: 'Email already registered' });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('detects offline sign-up', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const outcome = await signUpWithEmailAndPassword({
      displayName: 'Test User',
      email: 'user@vedmoulya.com',
      password: 'Secret123',
    });
    expect(outcome).toEqual({ ok: false, error: 'offline' });
  });

  // SPRINT-045 — production/staging sign-up requires email verification: the
  // backend returns verificationRequired with NO session, so the client must
  // NOT apply a session and must surface the flag to the UI ("check your
  // email" state instead of navigating on).
  it('does not apply a session when verification is required', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { verificationRequired: true } }),
    );
    const outcome = await signUpWithEmailAndPassword({
      displayName: 'Test User',
      email: 'user@vedmoulya.com',
      password: 'Secret123',
    });
    expect(outcome).toEqual({ ok: true, verificationRequired: true });
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

// ── 3. App restart ──────────────────────────────────────────────────────────

describe('app restart', () => {
  it('restores the persisted session and validates it online', async () => {
    seedSession(SESSION_BODY);
    await simulateRestart();
    expect(useAuthStore.getState().user?.email).toBe('user@vedmoulya.com');

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { userId: 'user-1', email: 'user@vedmoulya.com', role: 'user' },
      }),
    );
    await restoreSession();

    const state = useAuthStore.getState();
    expect(state.sessionReady).toBe(true);
    expect(state.user?.email).toBe('user@vedmoulya.com');
    // Validation hit /auth/session with the bearer token.
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer access-1');
  });
});

// ── 4. Logout ───────────────────────────────────────────────────────────────

describe('logout', () => {
  it('clears the JWT, cached user and persisted state, and notifies the server', async () => {
    seedSession(SESSION_BODY);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { message: 'Signed out' } }),
    );

    await logout();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();

    // The persisted session must be removed entirely — no JWT survives.
    await expect(readPersistedSession()).resolves.toBeNull();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer access-1');
  });

  it('still clears locally when the server is unreachable', async () => {
    seedSession(SESSION_BODY);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await logout();

    expect(useAuthStore.getState().user).toBeNull();
    await expect(readPersistedSession()).resolves.toBeNull();
  });
});

// ── 5. Expired token ────────────────────────────────────────────────────────

describe('expired token', () => {
  it('refreshes an expired access token during restore', async () => {
    seedSession({
      ...SESSION_BODY,
      tokens: { ...SESSION_BODY.tokens, accessToken: 'stale-access', expiresAt: NOW - 60_000 },
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { accessToken: 'fresh-access', refreshToken: 'refresh-2', expiresAt: NOW + 60_000 },
      }),
    );

    await restoreSession();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('fresh-access');
    expect(state.refreshToken).toBe('refresh-2');
    expect(state.user?.email).toBe('user@vedmoulya.com');
    expect(state.sessionReady).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/refresh');
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'refresh-1' });
  });

  it('signs out when the refresh token is rejected', async () => {
    seedSession({
      ...SESSION_BODY,
      tokens: { ...SESSION_BODY.tokens, accessToken: 'stale-access', expiresAt: NOW - 60_000 },
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: { code: 'TOKEN_INVALID', message: 'Invalid or expired refresh token' },
        },
        401,
      ),
    );

    await restoreSession();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.sessionReady).toBe(true);
  });

  it('keeps a session with no stored expiry when the server validates it (E2E-compat)', async () => {
    // Sessions injected without expiresAt (e.g. the E2E auth helper) must be
    // validated online, not treated as expired.
    useAuthStore.setState({
      accessToken: 'access-1',
      refreshToken: null,
      expiresAt: null,
      user: { userId: 'user-1', email: 'user@vedmoulya.com', role: 'user' },
      offline: false,
      sessionReady: false,
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { userId: 'user-1', email: 'user@vedmoulya.com', role: 'user' },
      }),
    );

    await restoreSession();

    const state = useAuthStore.getState();
    expect(state.sessionReady).toBe(true);
    expect(state.user?.email).toBe('user@vedmoulya.com');
  });

  it('does not refresh when there is no refresh token (email provider edge)', async () => {
    seedSession({
      ...SESSION_BODY,
      tokens: { ...SESSION_BODY.tokens, refreshToken: '', expiresAt: NOW - 60_000 },
    });

    await restoreSession();

    expect(useAuthStore.getState().user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── 6. Offline ──────────────────────────────────────────────────────────────

describe('offline behavior', () => {
  it('keeps a valid cached session and flags offline when validation cannot reach the server', async () => {
    seedSession(SESSION_BODY);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await restoreSession();

    const state = useAuthStore.getState();
    expect(state.user?.email).toBe('user@vedmoulya.com');
    expect(state.offline).toBe(true);
    expect(state.sessionReady).toBe(true);
  });

  it('keeps an expired cached session and flags offline when refresh cannot reach the server', async () => {
    seedSession({
      ...SESSION_BODY,
      tokens: { ...SESSION_BODY.tokens, expiresAt: NOW - 60_000 },
    });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await restoreSession();

    const state = useAuthStore.getState();
    expect(state.user?.email).toBe('user@vedmoulya.com');
    expect(state.offline).toBe(true);
    expect(state.accessToken).toBe('access-1');
  });
});

// ── Google OAuth flow ───────────────────────────────────────────────────────

describe('google sign-in', () => {
  function stubBrowser(): { assign: ReturnType<typeof vi.fn> } {
    const storage = new Map<string, string>();
    const assign = vi.fn();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v);
        },
        removeItem: (k: string) => {
          storage.delete(k);
        },
      },
      location: { assign },
    } as unknown as Window & typeof globalThis);
    return { assign };
  }

  it('begins the redirect flow with the fetched auth URL and saved state', async () => {
    const { assign } = stubBrowser();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { url: 'https://accounts.google.com/auth', state: 'st-9' },
      }),
    );

    const outcome = await beginGoogleSignIn('/career');
    expect(outcome.ok).toBe(true);
    expect(assign).toHaveBeenCalledWith('https://accounts.google.com/auth');
  });

  it('completes the flow: verifies state, exchanges the code, applies the session', async () => {
    const { assign } = stubBrowser();
    // Simulate the pending state left by beginGoogleSignIn.
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        sessionStorage: {
          getItem: () => JSON.stringify({ state: 'st-9', next: '/career' }),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        location: { assign },
      }),
    );

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: SESSION_BODY }));
    const outcome = await completeGoogleSignIn('code-1', 'st-9');

    expect(outcome).toEqual({ ok: true, next: '/career' });
    expect(useAuthStore.getState().accessToken).toBe('access-1');
  });

  it('rejects a mismatched CSRF state', async () => {
    stubBrowser();
    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window ?? {}, {
        sessionStorage: {
          getItem: () => JSON.stringify({ state: 'st-9', next: '/' }),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
      }),
    );

    const outcome = await completeGoogleSignIn('code-1', 'st-ATTACKER');
    expect(outcome.ok).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('first-login profile (SPRINT-041B)', () => {
  beforeEach(() => {
    resetStore();
    fetchMock.mockReset();
  });

  it('sign-up session carries the server-derived displayName + profileComplete=false', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { ...SESSION_BODY, displayName: 'New User', profileComplete: false },
      }),
    );
    const outcome = await signUpWithEmailAndPassword({
      email: 'new@vedmoulya.com',
      password: 'ValidPass1',
      displayName: 'New User',
    });
    expect(outcome.ok).toBe(true);
    expect(useAuthStore.getState().user?.displayName).toBe('New User');
    expect(useAuthStore.getState().user?.profileComplete).toBe(false);
  });

  it('refreshProfile applies the server-authoritative completion state', async () => {
    seedSession(SESSION_BODY);
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          userId: 'user-1',
          email: 'user@vedmoulya.com',
          displayName: 'Ada',
          age: 30,
          gender: 'female',
          purpose: 'learning',
          primaryGoal: 'Master TS',
          profileComplete: true,
        },
      }),
    );

    await refreshProfile();
    expect(useAuthStore.getState().user?.profileComplete).toBe(true);
    expect(useAuthStore.getState().user?.displayName).toBe('Ada');
  });

  it('refreshProfile is offline-safe (keeps cached state, never clears the session)', async () => {
    seedSession(SESSION_BODY);
    useAuthStore.setState({
      user: { ...SESSION_BODY, displayName: 'Cached', profileComplete: false },
    } as never);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await refreshProfile();
    expect(useAuthStore.getState().accessToken).toBe('access-1');
    expect(useAuthStore.getState().user?.profileComplete).toBe(false);
  });

  it('completeProfile PATCHes the profile and applies the returned state', async () => {
    seedSession(SESSION_BODY);
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          userId: 'user-1',
          email: 'user@vedmoulya.com',
          displayName: 'New User',
          age: 25,
          gender: 'male',
          purpose: 'career',
          primaryGoal: 'Become senior',
          profileComplete: true,
        },
      }),
    );

    const outcome = await completeProfile({
      displayName: 'New User',
      age: 25,
      gender: 'male',
      purpose: 'career',
      primaryGoal: 'Become senior',
    });
    expect(outcome).toEqual({ ok: true });
    expect(useAuthStore.getState().user?.profileComplete).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({
      displayName: 'New User',
      age: 25,
      gender: 'male',
      purpose: 'career',
      primaryGoal: 'Become senior',
    });
  });

  it('completeProfile surfaces backend validation errors', async () => {
    seedSession(SESSION_BODY);
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
        },
        400,
      ),
    );

    const outcome = await completeProfile({ age: 300 } as never);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('Invalid input');
    expect(useAuthStore.getState().user?.profileComplete).toBeUndefined();
  });

  it('completeProfile is rejected when there is no session', async () => {
    const outcome = await completeProfile({ displayName: 'X' });
    expect(outcome.ok).toBe(false);
  });
});
