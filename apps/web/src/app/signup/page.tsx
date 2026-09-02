// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Sign Up
// SPRINT-041A — First-Login Account Creation
// First-login registration screen for the EXISTING Identity Service
// (POST /api/v1/identity/auth/sign-up). Collects exactly the fields the
// endpoint requires (displayName, email, password + optional givenName /
// familyName), validates client-side (the backend remains authoritative),
// then applies the returned AuthSession through the SAME session lifecycle as
// sign-in (session-manager → auth-store → persisted) — no second session
// implementation, no direct database access.
//
// `?next=` is preserved from /login so a first-time user lands on the screen
// they originally tried to reach; without it they land on `/`.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, TextField } from '@vedmoulya/ui';
import { Loader2, Mail, Lock, User, ShieldCheck, Sparkles, ArrowLeft } from 'lucide-react';
import { signUpWithEmailAndPassword, beginGoogleSignIn } from '../../auth/session-manager.js';
import { GoogleIcon } from '../login/GoogleIcon.js';
import { useAuthHydrated, useAuthStore } from '../../stores/auth-store.js';

// ── Client-side validation (mirrors the backend zod schema) ─────────────────
// The Identity Service remains authoritative — these only catch obvious errors
// before the round trip and surface backend errors verbatim afterwards.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,}$/;

interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validate(
  displayName: string,
  email: string,
  password: string,
  confirmPassword: string,
): FieldErrors {
  const errors: FieldErrors = {};

  if (!displayName.trim()) {
    errors.displayName = 'Enter your display name.';
  } else if (displayName.trim().length < 2) {
    errors.displayName = 'Display name must be at least 2 characters.';
  } else if (displayName.trim().length > 100) {
    errors.displayName = 'Display name must be 100 characters or fewer.';
  }

  if (!email.trim()) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Create a password.';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  } else if (!PASSWORD_RE.test(password)) {
    errors.password =
      'Password must contain an uppercase letter, a lowercase letter, and a number.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
    // eslint-disable-next-line security/detect-possible-timing-attacks -- both sides are already known client-side form state, not a secret comparison
  } else if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

// ── Sign Up Page ─────────────────────────────────────────────────────────────

export default function SignUpPage(): React.JSX.Element {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // SPRINT-045 — production/staging sign-up requires email verification; when
  // the server responds with verificationRequired (no session issued), the
  // page swaps to the account-completion state instead of navigating on.
  const [verificationSent, setVerificationSent] = useState(false);
  // PART 3 PATH A — Google is the account-COMPLETION step: after the signup
  // details are saved, the user confirms with Google. The Identity Service
  // resolves the existing account by Google's verified email, links the
  // Google identity (duplicate-free), issues the session, and the central
  // first-login gate routes the user to onboarding. Email verification
  // remains available as the alternative secure completion path.
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  // PART 3 PATH A — after the signup form is accepted, the user is required to
  // complete the account with Google. This gate keeps authentication independent
  // of any AI credential while making Google identity the completion step.
  const [googleCompletion, setGoogleCompletion] = useState(false);

  // Resolved AT THE POINT OF USE (SPRINT-043E D1) — never cached in a
  // mount-time useMemo: the protected-route redirect can land here with the
  // query settling after first render, so a mount-time capture keeps a stale
  // '/' and the new user lands on the dashboard instead of the screen they
  // were headed for. Re-reading the query on every render (and again in the
  // submit handler) keeps ?next= correct.
  const resolveNext = (): string => {
    if (typeof window === 'undefined') return '/';
    const param = new URLSearchParams(window.location.search).get('next');
    return param && param.startsWith('/') ? param : '/';
  };

  const next = resolveNext();

  // Already authenticated → skip the sign-up screen (same rule as /login).
  useEffect(() => {
    if (hydrated && sessionReady && user) {
      router.replace(next);
    }
  }, [hydrated, sessionReady, user, next, router]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;

    const errors = validate(displayName, email, password, confirmPassword);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setFormError(null);
    setSubmitting(true);
    const outcome = await signUpWithEmailAndPassword({
      displayName: displayName.trim(),
      email: email.trim(),
      password,
      givenName: givenName.trim() || undefined,
      familyName: familyName.trim() || undefined,
    });
    if (!outcome.ok) {
      setSubmitting(false);
      setFormError(
        outcome.error === 'offline'
          ? 'You appear to be offline. Check your connection and try again.'
          : outcome.error,
      );
      return;
    }
    // PART 3 PATH A — Google is the account-COMPLETION step. The email/password
    // signup provisions a (possibly provisional) identity; Google authentication
    // is required to finish linking the account. So on success we do NOT
    // navigate away — we transition to the Google-completion card. (When email
    // verification is required in staging/production, the verification card
    // remains the gate as before.)
    if (outcome.verificationRequired) {
      setSubmitting(false);
      setVerificationSent(true);
      return;
    }
    setGoogleCompletion(true);
  };

  // PART 3 PATH A — complete the just-created account with Google. The
  // Identity Service resolves the EXISTING account by Google's verified
  // email, links the Google identity (no duplicate user), marks the email
  // verified via Google's attestation and issues the session; the central
  // onboarding gate then routes the user to first-login setup.
  const handleGoogle = async (): Promise<void> => {
    if (googleSubmitting) return;
    setGoogleError(null);
    setGoogleSubmitting(true);
    const outcome = await beginGoogleSignIn(next);
    if (!outcome.ok) {
      setGoogleSubmitting(false);
      setGoogleError(
        outcome.error === 'offline'
          ? 'You appear to be offline. Check your connection and try again.'
          : outcome.error,
      );
      return;
    }
    // On success the browser navigates to Google — state stays 'google'.
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
              Create your account
            </h1>
            <p className="text-[15px] text-[#D4E1FC] mt-1">
              Your Life Operating System — set up your profile to begin
            </p>
          </div>
        </div>

        {/* SPRINT-045 — email verification required (production/staging) */}
        {verificationSent && (
          <Card variant="standard" padding="lg" className="shadow-2xl">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <Mail className="h-6 w-6 text-emerald-600" aria-hidden="true" />
              </div>
              <h2 className="text-[20px] font-heading font-bold text-gray-900">Check your email</h2>
              <p className="text-[14px] leading-relaxed text-gray-600">
                We sent a verification link to{' '}
                <span className="font-medium text-gray-900">{email.trim()}</span>. Click it to
                activate your account, then sign in.
              </p>
              <div className="flex flex-col items-center gap-2">
                <Link
                  href={`/verify-email?email=${encodeURIComponent(email.trim())}`}
                  className="text-[14px] font-medium text-[#2563EB] hover:text-[#1E4AA8] transition-colors"
                >
                  Didn't get it? Resend the link
                </Link>
                <Link
                  href="/login"
                  className="text-[14px] font-medium text-[#2563EB] hover:text-[#1E4AA8] transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          </Card>
        )}
        {/* PART 3 PATH A — Google account completion step (after signup form accepted) */}
        {googleCompletion && (
          <Card variant="standard" padding="lg" className="shadow-2xl text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <ShieldCheck className="h-6 w-6 text-emerald-600" aria-hidden="true" />
              </div>
              <h2 className="text-[20px] font-heading font-bold text-gray-900">
                Complete with Google
              </h2>
              <p className="text-[14px] leading-relaxed text-gray-600 max-w-sm">
                Google authentication is required to finish activating your VedMoulya account. This
                links your Google identity to your account and issues your secure session — no AI
                setup is needed.
              </p>
              {googleError && (
                <p className="text-[13px] text-[#EF4444]" role="alert">
                  {googleError}
                </p>
              )}
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                loading={googleSubmitting}
                onClick={() => void handleGoogle()}
                className="h-12 !rounded-[16px] border-[#E2E8F0]"
              >
                {googleSubmitting ? 'Connecting…' : 'Continue with Google'}
              </Button>
            </div>
          </Card>
        )}

        {!verificationSent && !googleCompletion && (
          <Card variant="standard" padding="lg" className="shadow-2xl">
            {/* The explicit action/method make any PRE-HYDRATION or no-JS native
              submission a POST to /signup — credentials travel in the request
              body, never in the URL/query string/history (same hardening as the
              /login form).  Once React hydrates, handleSubmit's preventDefault()
              stops native submission entirely. */}
            <form
              action="/signup"
              method="post"
              onSubmit={(e) => void handleSubmit(e)}
              noValidate
              className="space-y-4"
            >
              <TextField
                label="Display Name"
                type="text"
                name="displayName"
                autoComplete="name"
                placeholder="How should we address you?"
                size="lg"
                leftIcon={<User className="h-4 w-4" aria-hidden="true" />}
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                }}
                error={fieldErrors.displayName}
                disabled={submitting}
              />
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
                error={fieldErrors.email}
                disabled={submitting}
              />
              <TextField
                label="Password"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="8+ chars, upper & lowercase, number"
                size="lg"
                leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                error={fieldErrors.password}
                disabled={submitting}
              />
              <TextField
                label="Confirm Password"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                size="lg"
                leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                }}
                error={fieldErrors.confirmPassword}
                disabled={submitting}
              />

              {/* Optional name parts (supported by the existing API) */}
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Given Name (optional)"
                  type="text"
                  name="givenName"
                  autoComplete="given-name"
                  placeholder="First"
                  size="lg"
                  value={givenName}
                  onChange={(e) => {
                    setGivenName(e.target.value);
                  }}
                  disabled={submitting}
                />
                <TextField
                  label="Family Name (optional)"
                  type="text"
                  name="familyName"
                  autoComplete="family-name"
                  placeholder="Last"
                  size="lg"
                  value={familyName}
                  onChange={(e) => {
                    setFamilyName(e.target.value);
                  }}
                  disabled={submitting}
                />
              </div>

              {formError && formError !== 'offline' && (
                <p className="text-[14px] text-[#EF4444] leading-relaxed" role="alert">
                  {formError}
                </p>
              )}

              {/* PART 3 PATH B — skip the form: Google is the sole required
                  signup step. Google-provided profile information seeds the
                  account; only any missing required profile details are
                  collected later during onboarding (never AI credentials). */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[#E2E8F0] dark:border-[#334155]" />
                </div>
                <span className="relative inline-flex px-2 text-[12px] text-[#94A3B8]">
                  Or continue with Google
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                fullWidth
                loading={googleSubmitting}
                onClick={() => void handleGoogle()}
                className="h-12 !rounded-[16px] border-[#E2E8F0]"
              >
                <GoogleIcon className="h-5 w-5 mr-2" />
                {googleSubmitting ? 'Connecting…' : 'Continue with Google'}
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                className="h-12 !rounded-[16px]"
              >
                {submitting ? 'Creating account…' : 'Create Account'}
              </Button>
            </form>
          </Card>
        )}

        {/* Footer: back to login */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-[#D4E1FC]/90 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Sign In
          </Link>
          <div className="flex items-center justify-center gap-1.5 text-[12px] text-[#D4E1FC]/80">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Your session is stored securely on this device.
            {submitting && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-white/90">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Creating your account…
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
