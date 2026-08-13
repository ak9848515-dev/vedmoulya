// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Sign-In Redirect
// MOB-001 — Mobile Authentication
// Replaces the old "Sign In Required" card: an unauthenticated user is
// redirected to /login (with a `next` back-reference) instead of seeing an
// error message. Renders nothing while the redirect is in flight.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function SignInRedirect(): null {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const next = window.location.pathname + window.location.search;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [router]);

  return null;
}
