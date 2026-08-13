// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Auth Store (Zustand + persist)
// Holds the JWT access token, refresh token, expiry and session user.
// MOB-001 — Mobile Authentication
//
// Persistence is platform-aware (see auth/secure-store.ts):
//   • Native (Capacitor) → Android Keystore-encrypted secure storage, so the
//     JWT never touches plain SharedPreferences / WebView localStorage.
//   • Web → localStorage (keeps the E2E helper contract: key 'vedmoulya-auth').
// Hydration is asynchronous on every platform; gate session-dependent UI on
// `useAuthHydrated()` and `sessionReady`.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import { AUTH_PERSIST_KEY, createPlatformStateStorage } from '../auth/secure-store.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Access token expiry as an epoch-milliseconds timestamp. */
  expiresAt: number;
  user: AuthUser;
}

interface AuthState {
  /** JWT access token (null when signed out). */
  accessToken: string | null;
  /** Refresh token used to renew an expired access token. */
  refreshToken: string | null;
  /** Access token expiry (epoch ms) — null when signed out. */
  expiresAt: number | null;
  /** Session user derived from the verified token. */
  user: AuthUser | null;
  /** True when the device is offline; a cached session may still be shown. */
  offline: boolean;
  /** True once the startup session restore has finished (see session-manager). */
  sessionReady: boolean;

  // Actions
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  setOffline: (offline: boolean) => void;
  setSessionReady: (ready: boolean) => void;
}

// ── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      user: null,
      offline: false,
      sessionReady: false,

      setSession: (session: AuthSession): void => {
        set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          user: session.user,
          offline: false,
        });
      },
      clearSession: (): void => {
        set({
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          user: null,
        });
      },
      setOffline: (offline: boolean): void => {
        set({ offline });
      },
      setSessionReady: (ready: boolean): void => {
        set({ sessionReady: ready });
      },
    }),
    {
      name: AUTH_PERSIST_KEY,
      // Platform-aware storage: secure storage on native, localStorage on web.
      storage: createJSONStorage(() => createPlatformStateStorage()),
      // Only the durable session fields persist — transient UI state does not.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        user: state.user,
      }),
    },
  ),
);

// ── Selectors ───────────────────────────────────────────────────────────────

/** Get the current access token (for attaching the Authorization header). */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

// ── Hydration Guard ──────────────────────────────────────────────────────────

/**
 * Returns true once the persisted auth store has hydrated on the client.
 *
 * zustand persist rehydrates from the (possibly async) storage adapter on the
 * client, but on the server (SSR) the store always starts empty. Rendering
 * session-dependent UI before hydration causes React hydration mismatches.
 * Gate pages on this hook.
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    // If hydration already completed before this effect ran, mark hydrated now.
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

  return hydrated;
}
