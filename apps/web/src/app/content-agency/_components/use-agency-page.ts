// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency page helpers (EPIC-003 / AC-001)
// Shared auth guard + navigation wiring so every module screen stays thin.
//
// UX-01 / UX-05: Content Agency is presented as a Life → Business workspace.
// The trail is therefore declared through `usePageContext` against the ONE
// navigation model (which now owns /content-agency under Life), so all 20
// sub-screens show "Life › Content Agency › <screen>" without each having to
// re-implement the hierarchy.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { usePageContext } from '../../../lib/use-page-context.js';
import { useAuthStore, useAuthHydrated } from '../../../stores/auth-store.js';

export interface AgencyPageState {
  /** True when auth has hydrated and the session is ready. */
  ready: boolean;
  /** Current signed-in user id ('' when signed out). */
  userId: string;
}

/** The sub-screen's own route, derived from the module root and the title. */
function agencyRouteFor(title: string, route?: string): string {
  if (route !== undefined) return route;
  if (title === 'Dashboard') return '/content-agency';
  return `/content-agency/${title.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Wire breadcrumbs + sidebar section for a content-agency screen and expose
 * the auth-guard state. Usage:
 *   const { ready, userId } = useAgencyPage('Clients', '/content-agency/clients');
 *   if (!ready) return <Loading .../>;
 *   if (!userId) return <SignInRedirect />;
 */
export function useAgencyPage(title: string, route?: string): AgencyPageState {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const pathname = agencyRouteFor(title, route);

  usePageContext({ pathname, label: 'Content Agency' });

  return {
    ready: hydrated && sessionReady,
    userId: user?.userId ?? '',
  };
}
