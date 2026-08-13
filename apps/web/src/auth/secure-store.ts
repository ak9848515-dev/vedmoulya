// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Secure Session Storage
// MOB-001 — Mobile Authentication
// Backs the zustand persist middleware with the most secure storage the
// current platform provides:
//
//   Native (Capacitor)  → @aparajita/capacitor-secure-storage
//                         (Android Keystore / EncryptedSharedPreferences,
//                          iOS Keychain) — the JWT never touches plain
//                          SharedPreferences or the WebView's localStorage.
//   Web                  → localStorage (same behavior as before MOB-001,
//                          keeps the E2E auth helper working).
//   SSR / unit tests     → in-memory map.
//
// The adapter implements zustand's StateStorage (async-capable), so the
// existing `useAuthHydrated()` hook still signals when the persisted session
// has been restored.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import type { StateStorage } from 'zustand/middleware';
import { isNativePlatform } from './platform.js';

/** Persisted store key — MUST stay 'vedmoulya-auth' (E2E helper writes it). */
export const AUTH_PERSIST_KEY = 'vedmoulya-auth';

// ── Key/Value abstraction ────────────────────────────────────────────────────

interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// ── Native: Android Keystore / iOS Keychain ──────────────────────────────────

/**
 * Lazily resolves the secure-storage plugin so the web bundle never pulls in
 * the native plugin implementation. getItem may throw or return null for a
 * missing key depending on platform/version — both are treated as "absent".
 */
function createNativeStore(): KeyValueStore {
  return {
    async getItem(key: string): Promise<string | null> {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      try {
        return await SecureStorage.getItem(key);
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      await SecureStorage.setItem(key, value);
    },
    async removeItem(key: string): Promise<void> {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      try {
        await SecureStorage.removeItem(key);
      } catch {
        // Removing an absent key must not fail the logout flow.
      }
    },
  };
}

// ── Web: localStorage with in-memory fallback (tests / SSR) ─────────────────

const memoryStore = new Map<string, string>();

/** Reset the in-memory fallback — used by tests and the mobile logout flow. */
export function clearMemoryStore(): void {
  memoryStore.clear();
}

function createWebStore(): KeyValueStore {
  const canUseLocalStorage =
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

  return {
    getItem(key: string): Promise<string | null> {
      if (canUseLocalStorage) return Promise.resolve(window.localStorage.getItem(key));
      return Promise.resolve(memoryStore.get(key) ?? null);
    },
    setItem(key: string, value: string): Promise<void> {
      if (canUseLocalStorage) {
        window.localStorage.setItem(key, value);
      } else {
        memoryStore.set(key, value);
      }
      return Promise.resolve();
    },
    removeItem(key: string): Promise<void> {
      if (canUseLocalStorage) {
        window.localStorage.removeItem(key);
      } else {
        memoryStore.delete(key);
      }
      return Promise.resolve();
    },
  };
}

// ── Zustand StateStorage adapter ─────────────────────────────────────────────

let nativeStore: KeyValueStore | null = null;

function resolveStore(): KeyValueStore {
  if (isNativePlatform()) {
    if (nativeStore === null) nativeStore = createNativeStore();
    return nativeStore;
  }
  return createWebStore();
}

/** Zustand StateStorage backed by the best storage for the current platform. */
export function createPlatformStateStorage(): StateStorage {
  const store = resolveStore();
  return {
    getItem: (name: string) => store.getItem(name),
    setItem: (name: string, value: string) => store.setItem(name, value),
    removeItem: (name: string) => store.removeItem(name),
  };
}

// ── Direct vault helpers (logout / tests) ────────────────────────────────────

/** Read the raw persisted session JSON for the auth store (null when absent). */
export async function readPersistedSession(): Promise<string | null> {
  const store = resolveStore();
  return store.getItem(AUTH_PERSIST_KEY);
}

/** Remove the persisted session entirely (logout). */
export async function clearPersistedSession(): Promise<void> {
  const store = resolveStore();
  await store.removeItem(AUTH_PERSIST_KEY);
}
