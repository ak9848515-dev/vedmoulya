// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Google account connection (OAuth option in Configure AI)
//
// Reuse, not reinvention: this hook drives the EXISTING Google authorization
// flow already shipped for sign-in (services/identity `/auth/google/*` through
// apps/web/src/auth/session-manager.ts). It adds no new authentication system,
// no new endpoint and no new token handling — it only:
//
//   1. starts the existing flow with `beginGoogleSignIn(next)` and returns the
//      user to the provider they were configuring,
//   2. recognises the round trip (`?oauth=google`) so the UI can show the
//      connection the user just authorised,
//   3. keeps a device-local marker so the state survives a navigation,
//   4. lets the user disconnect that marker again.
//
// HONESTY: a Google account authorises the GOOGLE identity. It is not the same
// thing as Gemini API access, which is why the Configure screen still verifies
// the provider itself through the existing server-side connection probe and
// says so in plain language.
//
// SOURCE OF TRUTH: the account link is IDENTITY truth, exposed by the identity
// service as `googleLinked` on the session/profile (derived from the stored
// Google subject). The session value is authoritative on every device; the
// device-local marker only bridges the moment an OAuth round trip returns,
// before the refreshed profile has loaded.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useState } from 'react';
import { beginGoogleSignIn } from '../../auth/session-manager.js';
import { useAuthStore } from '../../stores/auth-store.js';

/** Marks the OAuth round trip in the URL (`?oauth=google`). */
export const GOOGLE_OAUTH_RETURN_VALUE = 'google';

const STORAGE_PREFIX = 'vedmoulya:google-oauth:';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

/** Read the device-local marker (never throws — storage may be unavailable). */
function readMarker(userId: string): boolean {
  if (typeof window === 'undefined' || userId === '') return false;
  try {
    return window.localStorage.getItem(storageKey(userId)) !== null;
  } catch {
    return false;
  }
}

function writeMarker(userId: string, connected: boolean): void {
  if (typeof window === 'undefined' || userId === '') return;
  try {
    if (connected) window.localStorage.setItem(storageKey(userId), new Date().toISOString());
    else window.localStorage.removeItem(storageKey(userId));
  } catch {
    // Storage unavailable — the in-memory state still reflects the session.
  }
}

export interface GoogleAccountConnection {
  /** True when the user authorised their Google account (this device). */
  connected: boolean;
  /** True while the browser is being redirected to Google. */
  connecting: boolean;
  /** Message when the flow could not start (offline, endpoint failure). */
  error: string | null;
  connect: () => Promise<void>;
  /** Removes the device-local connection marker (sign-in is untouched). */
  disconnect: () => void;
}

export function useGoogleAccountConnection(
  userId: string,
  /** Where Google should return the user (defaults to the providers screen). */
  returnPath = '/providers?provider=google',
  /** The URL marker that proves the round trip completed on this load. */
  returnedFromOAuth = false,
): GoogleAccountConnection {
  // IDENTITY truth: the session says whether this VedMoulya identity is linked
  // to a Google account. It survives reload/navigation and is device-independent.
  const sessionGoogleLinked = useAuthStore((state) => state.user?.googleLinked === true);
  const [markerConnected, setMarkerConnected] = useState<boolean>(
    () => returnedFromOAuth || readMarker(userId),
  );
  const connected = sessionGoogleLinked || markerConnected;
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The round trip is real evidence of a successful authorization — persist it
  // so the state survives navigation (a side effect, never a render-time write).
  useEffect(() => {
    if (!returnedFromOAuth) return;
    writeMarker(userId, true);
    setMarkerConnected(true);
  }, [returnedFromOAuth, userId]);

  const connect = useCallback(async (): Promise<void> => {
    setConnecting(true);
    setError(null);
    const next = `${returnPath}${returnPath.includes('?') ? '&' : '?'}oauth=${GOOGLE_OAUTH_RETURN_VALUE}`;
    const outcome = await beginGoogleSignIn(next);
    if (outcome.ok) {
      // The browser is navigating to Google — leave `connecting` on so the
      // button stays in its pending state during the redirect.
      return;
    }
    setConnecting(false);
    setError(
      outcome.error === 'offline'
        ? 'You appear to be offline. Check your connection and try again.'
        : outcome.error,
    );
  }, [returnPath]);

  const disconnect = useCallback((): void => {
    // Clears the device-local marker only. The server-side Google IDENTITY
    // link (googleLinked) is untouched — account linking is not sign-out and
    // is not unlinked from a provider screen.
    writeMarker(userId, false);
    setMarkerConnected(false);
    setError(null);
    // Drop the OAuth return marker from the URL so a later visit is not read
    // as "just authorised again".
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('oauth') !== null) {
        params.delete('oauth');
        const query = params.toString();
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${query ? `?${query}` : ''}`,
        );
      }
    }
  }, [userId]);

  return { connected, connecting, error, connect, disconnect };
}
