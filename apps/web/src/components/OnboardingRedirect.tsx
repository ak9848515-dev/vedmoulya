// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Onboarding Redirect (first-login gate)
// SPRINT-041B — First-Login Profile Setup Verification
// The SINGLE central gate that routes authenticated-but-incomplete users to
// the first-login profile setup (/onboarding/profile), preserving `?next=` so
// the intended destination is resumed after completion. Mounted once in
// Providers — no per-page wiring needed.
//
// Rules (mirroring SignInRedirect's convention):
//   • Fires ONLY on an EXPLICIT server-derived `profileComplete === false`
//     (never on undefined — legacy persisted sessions and pre-refresh states
//     are never bounced until the server confirms).
//   • Auth-flow screens are excluded (/login, /signup, /oauth2redirect,
//     /onboarding/profile) so the sign-in/sign-up flows stay deterministic and
//     no redirect loop is possible.
//   • Returning users with a completed profile never see onboarding.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthHydrated, useAuthStore } from '../stores/auth-store.js';

/** Screens that must never be hijacked by the first-login gate. */
const EXCLUDED_PATHS = new Set(['/login', '/signup', '/oauth2redirect', '/onboarding/profile']);

export function OnboardingRedirect(): null {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hydrated || !sessionReady) return;
    // Explicit false only — unknown completion (legacy sessions, in-flight
    // refresh) is never treated as incomplete.
    if (!user || user.profileComplete !== false) return;

    // The effect re-runs on every client-side route change (pathname is a
    // dependency), so a router.replace() after registration lands here and the
    // incomplete user is routed to first-login setup instead of the destination.
    if (EXCLUDED_PATHS.has(pathname)) return;

    const next = pathname + window.location.search;
    router.replace(`/onboarding/profile?next=${encodeURIComponent(next)}`);
  }, [hydrated, sessionReady, user, pathname, router]);

  return null;
}
