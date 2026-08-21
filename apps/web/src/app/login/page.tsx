// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Login
// MOB-001 — Mobile Authentication
// Sign-in screen: "Continue with Google" (redirect OAuth through the existing
// Identity Service endpoints) plus an email/password option. Unauthenticated
// users are redirected here from every protected page; after a successful
// sign-in they land back on the page they came from (`next`).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, TextField } from '@vedmoulya/ui';
import { Loader2, Mail, Lock, WifiOff, ShieldCheck, Sparkles } from 'lucide-react';
import { beginGoogleSignIn, signInWithEmailAndPassword } from '../../auth/session-manager.js';
import { useAuthHydrated, useAuthStore } from '../../stores/auth-store.js';
import { GoogleIcon } from './GoogleIcon.js';

// ── Login Page ───────────────────────────────────────────────────────────────

export default function LoginPage(): React.JSX.Element {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, sessionReady, offline } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolved AT THE POINT OF USE (SPRINT-043E D1) — never cached in a
  // mount-time useMemo: the protected-route redirect (SignInRedirect →
  // router.replace('/login?next=...')) can land here with the query settling
  // after first render, so a mount-time capture keeps a stale '/' and signs
  // the user into the dashboard instead of the screen they were headed for.
  // Re-reading the query on every render (and again in the submit handlers)
  // keeps ?next= correct.
  const resolveNext = (): string => {
    if (typeof window === 'undefined') return '/';
    const param = new URLSearchParams(window.location.search).get('next');
    return param && param.startsWith('/') ? param : '/';
  };

  const next = resolveNext();

  // Already authenticated → skip the login screen.
  useEffect(() => {
    if (hydrated && sessionReady && user) {
      router.replace(next);
    }
  }, [hydrated, sessionReady, user, next, router]);

  const isSubmitting = submitting !== null;

  const handleGoogle = async (): Promise<void> => {
    if (isSubmitting) return;
    setError(null);
    setSubmitting('google');
    const outcome = await beginGoogleSignIn(next);
    if (!outcome.ok) {
      setSubmitting(null);
      setError(
        outcome.error === 'offline'
          ? 'You appear to be offline. Check your connection and try again.'
          : outcome.error,
      );
    }
    // On success the browser navigates to Google — state stays 'google'.
  };

  const handleEmailSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    setError(null);
    setSubmitting('email');
    const outcome = await signInWithEmailAndPassword(email.trim(), password);
    if (!outcome.ok) {
      setSubmitting(null);
      setError(
        outcome.error === 'offline'
          ? 'You appear to be offline. Check your connection and try again.'
          : outcome.error,
      );
      return;
    }
    router.replace(resolveNext());
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#1E4AA8] via-[#2B5FD9] to-[#5B8AEB] px-4 py-10">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, white 0%, transparent 45%), radial-gradient(circle at 80% 75%, white 0%, transparent 40%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-[20px] bg-white/15 backdrop-blur-md border border-white/25 shadow-xl">
            <Sparkles className="h-7 w-7 text-[#F59E0B]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-[28px] font-heading font-bold text-white tracking-tight">
              VedMoulya
            </h1>
            <p className="text-[15px] text-[#D4E1FC] mt-1">
              Your Life Operating System — sign in to continue
            </p>
          </div>
        </div>

        <Card variant="standard" padding="lg" className="shadow-2xl">
          {/* Offline notice (store flag set by the session restore) */}
          {offline && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A]">
              <WifiOff className="h-4 w-4 text-[#D97706] shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[13px] text-[#92400E] leading-relaxed">
                You&apos;re offline. You can still try signing in once you reconnect — your session
                will be restored automatically.
              </p>
            </div>
          )}

          {/* Google Sign-In */}
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={submitting === 'google'}
            onClick={() => {
              void handleGoogle();
            }}
            className="h-12 !rounded-[16px]"
          >
            {submitting !== 'google' && <GoogleIcon className="h-5 w-5" />}
            Continue with Google
          </Button>

          <div className="flex items-center gap-4 my-6" aria-hidden="true">
            <div className="h-px flex-1 bg-[#E2E8F0]" />
            <span className="text-[12px] font-medium uppercase tracking-wider text-[#94A3B8]">
              or
            </span>
            <div className="h-px flex-1 bg-[#E2E8F0]" />
          </div>

          {/* Email / Password */}
          {/* The explicit action/method make any PRE-HYDRATION or no-JS native
              submission a POST to /login — credentials travel in the request
              body, never in the URL/query string/history. Once React hydrates,
              handleEmailSubmit's preventDefault() stops native submission
              entirely, so the SPA flow is unchanged. */}
          <form
            action="/login"
            method="post"
            onSubmit={(e) => void handleEmailSubmit(e)}
            className="space-y-4"
          >
            <TextField
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              size="lg"
              leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              disabled={isSubmitting}
            />
            <TextField
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              size="lg"
              leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              disabled={isSubmitting}
            />

            {error && error !== 'offline' && (
              <p className="text-[14px] text-[#EF4444] leading-relaxed" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting === 'email'}
              className="h-12 !rounded-[16px]"
            >
              {submitting === 'email' ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          {/* First-login account creation (SPRINT-041A) — visually subordinate
              to Sign In; carries ?next= so a new user lands where they were
              headed. */}
          <div className="mt-6 pt-5 border-t border-[#E2E8F0] dark:border-[#334155] text-center">
            <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              New to VedMoulya?{' '}
              <Link
                href={next === '/' ? '/signup' : `/signup?next=${encodeURIComponent(next)}`}
                className="font-semibold text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-[#D4E1FC]/80">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Your session is stored securely on this device.
          {submitting === 'google' && !error && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-white/90">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Opening Google…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
