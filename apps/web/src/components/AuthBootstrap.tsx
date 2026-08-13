// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Auth Bootstrap
// MOB-001 — Mobile Authentication
// Runs the startup session restore exactly once, after the persisted auth
// store has hydrated. Restore validates/refreshes the stored JWT (see
// session-manager) so the app boots into a verified session — or none —
// without flashing protected content.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useRef } from 'react';
import { restoreSession } from '../auth/session-manager.js';
import { useAuthHydrated } from '../stores/auth-store.js';

export interface AuthBootstrapProps {
  children: React.ReactNode;
}

export function AuthBootstrap({ children }: AuthBootstrapProps): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const started = useRef(false);

  useEffect(() => {
    if (hydrated && !started.current) {
      started.current = true;
      void restoreSession();
    }
  }, [hydrated]);

  return <>{children}</>;
}
