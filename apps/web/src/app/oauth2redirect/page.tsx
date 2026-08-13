// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — OAuth Redirect Handler
// MOB-001 — Mobile Authentication
// This is the URL Google redirects to after a successful sign-in
// (default: <origin>/oauth2redirect — inside the Capacitor WebView that
// origin is https://localhost, the app's own local server). It verifies the
// CSRF state, exchanges the authorization code through the existing
// /auth/google/callback endpoint, stores the session, then routes the user to
// where they were headed.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@vedmoulya/ui';
import { Loader2, ShieldAlert } from 'lucide-react';
import { completeGoogleSignIn } from '../../auth/session-manager.js';

export default function OAuthRedirectPage(): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error');

    async function handle(): Promise<void> {
      if (oauthError) {
        setStatus('error');
        setMessage('Sign-in was cancelled or declined.');
        return;
      }
      if (!code || !state) {
        setStatus('error');
        setMessage('The sign-in response was incomplete. Please try again.');
        return;
      }

      const outcome = await completeGoogleSignIn(code, state);
      if (cancelled) return;

      if (!outcome.ok) {
        setStatus('error');
        setMessage(
          outcome.error === 'offline'
            ? 'You appear to be offline. Check your connection and try again.'
            : outcome.error,
        );
        return;
      } // Session applied — route back to where the user was headed.
      const next = outcome.next.startsWith('/') ? outcome.next : '/';
      router.replace(next);
    }

    void handle().catch(() => {
      if (!cancelled) {
        setStatus('error');
        setMessage('Something went wrong while signing you in. Please try again.');
      }
    });

    return (): void => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E4AA8] via-[#2B5FD9] to-[#5B8AEB] px-4">
      <Card variant="standard" padding="lg" className="w-full max-w-sm text-center shadow-2xl">
        {status === 'processing' ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="h-8 w-8 text-[#2B5FD9] animate-spin" aria-hidden="true" />
            <div>
              <h2 className="text-[18px] font-heading font-semibold text-[#111827]">{message}</h2>
              <p className="text-[14px] text-[#64748B] mt-1">
                Securing your session and loading your Life OS…
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-3 rounded-full bg-[#FEF2F2]">
              <ShieldAlert className="h-6 w-6 text-[#EF4444]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[18px] font-heading font-semibold text-[#111827]">
                Sign-in interrupted
              </h2>
              <p className="text-[14px] text-[#64748B] mt-1">{message}</p>
            </div>
            <a
              href="/login"
              className="inline-flex items-center justify-center h-10 px-4 text-[14px] font-medium text-white bg-[#2B5FD9] hover:bg-[#3B6FE3] rounded-[14px] transition-colors"
            >
              Back to Sign In
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}
