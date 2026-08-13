// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Network Status Hook (MOB-002)
// Listens to browser online/offline events and mirrors the state into the
// auth store's `offline` flag (already consumed by the session manager and
// login screen). Also exposes a manual reconnect trigger so cached screens
// can offer an explicit "retry synchronization" button.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/auth-store.js';
import { hapticWarning } from './haptics.js';

export function useNetworkStatus(): { isOnline: boolean; reconnect: () => void } {
  // `navigator.onLine` is authoritative where supported; the Capacitor
  // WebView maps it to the device connectivity state.
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const goOnline = (): void => {
      setIsOnline(true);
      // Offline → online: clear the flag so the session manager can refresh
      // the token and caches can be revalidated (auto-reconnect, MOB-002).
      useAuthStore.getState().setOffline(false);
    };
    const goOffline = (): void => {
      setIsOnline(false);
      useAuthStore.getState().setOffline(true);
      void hapticWarning();
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return (): void => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const reconnect = useCallback((): void => {
    useAuthStore.getState().setOffline(false);
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
  }, []);

  return { isOnline, reconnect };
}
