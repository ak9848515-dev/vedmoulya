// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Auth Store (Zustand + persist)
// Holds the JWT access token and session user for the web application.
// Persists to localStorage so sessions survive page reloads.
// BLD-016C — Real Authentication
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

interface AuthState {
  /** JWT access token (null when signed out) */
  accessToken: string | null;
  /** Session user derived from the verified token */
  user: AuthUser | null;

  // Actions
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
}

// ── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,

      setSession: (accessToken: string, user: AuthUser): void => {
        set({ accessToken, user });
      },
      clearSession: (): void => {
        set({ accessToken: null, user: null });
      },
    }),
    {
      name: 'vedmoulya-auth',
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
 * zustand persist rehydrates from localStorage asynchronously on the client,
 * but on the server (SSR) the store always starts empty. Rendering session-
 * dependent UI before hydration causes React hydration mismatches (and
 * triggers the "no console errors" E2E assertions). Gate pages on this hook.
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
