// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency page helpers (EPIC-003 / AC-001)
// Shared auth guard + navigation wiring so every module screen stays thin.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect } from 'react';
import { useNavigationStore } from '../../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../../stores/auth-store.js';

export interface AgencyPageState {
  /** True when auth has hydrated and the session is ready. */
  ready: boolean;
  /** Current signed-in user id ('' when signed out). */
  userId: string;
}

/**
 * Wire breadcrumbs + sidebar section for a content-agency screen and expose
 * the auth-guard state. Usage:
 *   const { ready, userId } = useAgencyPage('Clients', '/content-agency/clients');
 *   if (!ready) return <Loading .../>;
 *   if (!userId) return <SignInRedirect />;
 */
export function useAgencyPage(title: string, route = '/content-agency'): AgencyPageState {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const setActiveSection = useNavigationStore((s) => s.setActiveSection);
  const setBreadcrumbs = useNavigationStore((s) => s.setBreadcrumbs);

  useEffect(() => {
    setActiveSection('content-agency');
    setBreadcrumbs([
      { label: 'Content Agency', href: '/content-agency' },
      ...(title === 'Dashboard' || route === '/content-agency'
        ? []
        : [{ label: title, href: route }]),
    ]);
  }, [setActiveSection, setBreadcrumbs, title, route]);

  return {
    ready: hydrated && sessionReady,
    userId: user?.userId ?? '',
  };
}
