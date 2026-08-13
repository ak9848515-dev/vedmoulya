// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Secure Storage Adapter Tests
// MOB-001 — Mobile Authentication
// Verifies the zustand StateStorage adapter (in-memory fallback in non-browser
// environments — the same contract the native secure storage implements) and
// the vault helpers used by logout.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../../stores/auth-store.js';
import {
  AUTH_PERSIST_KEY,
  clearMemoryStore,
  clearPersistedSession,
  createPlatformStateStorage,
  readPersistedSession,
} from '../secure-store.js';

const SESSION = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: Date.now() + 60_000,
  user: { userId: 'user-1', email: 'user@vedmoulya.com', role: 'user' },
};

beforeEach(() => {
  clearMemoryStore();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    user: null,
    offline: false,
    sessionReady: false,
  });
});

afterEach(() => {
  clearMemoryStore();
});

describe('createPlatformStateStorage', () => {
  it('round-trips values through the storage adapter', async () => {
    const storage = createPlatformStateStorage();
    await storage.setItem(AUTH_PERSIST_KEY, '{"hello":"world"}');
    await expect(storage.getItem(AUTH_PERSIST_KEY)).resolves.toBe('{"hello":"world"}');
    await storage.removeItem(AUTH_PERSIST_KEY);
    await expect(storage.getItem(AUTH_PERSIST_KEY)).resolves.toBeNull();
  });

  it('returns null for absent keys', async () => {
    const storage = createPlatformStateStorage();
    await expect(storage.getItem('missing-key')).resolves.toBeNull();
  });
});

describe('persist round-trip', () => {
  it('persists the session through the store and reads it back', async () => {
    useAuthStore.getState().setSession(SESSION);
    const persisted = await readPersistedSession();
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted as string).state.accessToken).toBe('access-1');

    // Simulate a restart: capture what persisted, reset the in-memory store
    // (its setState would otherwise overwrite storage with nulls), restore the
    // snapshot, then rehydrate — mirroring a fresh JS context booting from
    // persisted secure storage.
    const snapshot = await readPersistedSession();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      user: null,
      offline: false,
      sessionReady: false,
    });
    await createPlatformStateStorage().setItem(AUTH_PERSIST_KEY, snapshot as string);
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState().user?.email).toBe('user@vedmoulya.com');
  });

  it('does not persist transient UI flags (offline / sessionReady)', async () => {
    useAuthStore.getState().setSession(SESSION);
    useAuthStore.setState({ offline: true, sessionReady: true });
    const persisted = JSON.parse((await readPersistedSession()) as string) as {
      state: Record<string, unknown>;
    };
    expect(persisted.state.offline).toBeUndefined();
    expect(persisted.state.sessionReady).toBeUndefined();
  });
});

describe('clearPersistedSession', () => {
  it('removes the persisted session entirely (logout contract)', async () => {
    useAuthStore.getState().setSession(SESSION);
    await expect(readPersistedSession()).resolves.not.toBeNull();
    await clearPersistedSession();
    await expect(readPersistedSession()).resolves.toBeNull();
  });
});
