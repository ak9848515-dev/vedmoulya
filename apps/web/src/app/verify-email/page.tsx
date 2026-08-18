// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Verify Email
// SPRINT-045 — PRODUCTION EMAIL VERIFICATION
// Two modes on one page:
//   /verify-email?token=...  → the emailed link target — consumes the token via
//                              POST /auth/verify-email and shows the outcome
//                              (verified / link expired / link invalid).
//   /verify-email?email=...  → the "check your email" state with a resend
//                              control (POST /auth/resend-verification). The
//                              resend endpoint always succeeds (no account
//                              enumeration) — only network failures surface.
// Reuses the EXISTING auth pages' visual design (gradient + Card). No session
// is applied here — after verification the user signs in normally.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Card } from '@vedmoulya/ui';
import { CheckCircle2, Mail, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import {
  AuthApiError,
  isNetworkError,
  resendVerificationEmail,
  verifyEmailToken,
} from '../../auth/auth-api.js';

type VerifyState = 'pending' | 'verifying' | 'verified' | 'expired' | 'invalid' | 'error';

function VerifyEmailInner(): React.JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email') ?? '';

  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'pending');
  const [email, setEmail] = useState(emailParam);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const consumedToken = useRef<string | null>(null);

  useEffect(() => {
    if (token && consumedToken.current !== token) {
      consumedToken.current = token;
      setState('verifying');
      void verifyEmailToken(token)
        .then(() => {
          setState('verified');
        })
        .catch((error: unknown) => {
          if (error instanceof AuthApiError && error.message === 'expired') {
            setState('expired');
          } else if (error instanceof AuthApiError && error.message === 'already-verified') {
            setState('verified');
          } else if (error instanceof AuthApiError && error.message === 'invalid') {
            setState('invalid');
          } else if (isNetworkError(error)) {
            setState('error');
          } else {
            setState('invalid');
          }
        });
    }
  }, [token]);

  const handleResend = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (resending) return;
    setResending(true);
    setResendMessage(null);
    try {
      await resendVerificationEmail(email.trim());
      setResendMessage('Verification link sent. Check your inbox.');
    } catch {
      setResendMessage('Could not send right now. Please try again shortly.');
    } finally {
      setResending(false);
    }
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
          <h1 className="text-[28px] font-heading font-bold text-white tracking-tight">
            Email verification
          </h1>
        </div>

        <Card variant="standard" padding="lg" className="shadow-2xl">
          {state === 'verifying' && (
            <div className="flex flex-col items-center gap-4 text-center" role="status">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                <Mail className="h-6 w-6 text-blue-600" aria-hidden="true" />
              </div>
              <p className="text-[14px] leading-relaxed text-gray-600">Verifying your email…</p>
            </div>
          )}

          {state === 'verified' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
              </div>
              <h2 className="text-[20px] font-heading font-bold text-gray-900">Email verified</h2>
              <p className="text-[14px] leading-relaxed text-gray-600">
                Your account is active. You can now sign in.
              </p>
              <Button variant="primary" size="lg" fullWidth className="h-12 !rounded-[16px]">
                <Link href="/login" className="flex w-full items-center justify-center">
                  Sign in
                </Link>
              </Button>
            </div>
          )}

          {state === 'expired' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <XCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />
              </div>
              <h2 className="text-[20px] font-heading font-bold text-gray-900">Link expired</h2>
              <p className="text-[14px] leading-relaxed text-gray-600">
                This verification link has expired. Request a new one and it will be sent to your
                inbox.
              </p>
              {email && (
                <form
                  onSubmit={(e) => {
                    void handleResend(e);
                  }}
                  className="w-full space-y-3"
                >
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={resending}
                    className="h-12 !rounded-[16px]"
                  >
                    {resending ? 'Sending…' : 'Send new link'}
                  </Button>
                  {resendMessage && <p className="text-[13px] text-[#15803D]">{resendMessage}</p>}
                </form>
              )}
              <Link
                href="/login"
                className="text-[14px] font-medium text-[#2563EB] hover:text-[#1E4AA8] transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          )}

          {state === 'invalid' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <XCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <h2 className="text-[20px] font-heading font-bold text-gray-900">Link invalid</h2>
              <p className="text-[14px] leading-relaxed text-gray-600">
                This verification link is not valid. It may have already been used or mistyped.
              </p>
              <Link
                href="/login"
                className="text-[14px] font-medium text-[#2563EB] hover:text-[#1E4AA8] transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <XCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <h2 className="text-[20px] font-heading font-bold text-gray-900">
                Something went wrong
              </h2>
              <p className="text-[14px] leading-relaxed text-gray-600">
                We could not reach the verification service. Check your connection and try the link
                again.
              </p>
              <Link
                href="/login"
                className="text-[14px] font-medium text-[#2563EB] hover:text-[#1E4AA8] transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          )}

          {state === 'pending' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <Mail className="h-6 w-6 text-emerald-600" aria-hidden="true" />
              </div>
              <h2 className="text-[20px] font-heading font-bold text-gray-900">Check your email</h2>
              <p className="text-[14px] leading-relaxed text-gray-600">
                We sent a verification link to{' '}
                <span className="font-medium text-gray-900">{email.trim() || 'your inbox'}</span>.
                Click it to activate your account, then sign in.
              </p>
              <form
                onSubmit={(e) => {
                  void handleResend(e);
                }}
                className="w-full space-y-3"
              >
                <label htmlFor="resend-email" className="sr-only">
                  Email
                </label>
                <input
                  id="resend-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  placeholder="you@example.com"
                  className="w-full rounded-[12px] border border-gray-300 px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={resending}
                  className="h-12 !rounded-[16px]"
                >
                  {resending ? 'Sending…' : 'Resend verification link'}
                </Button>
                {resendMessage && <p className="text-[13px] text-[#15803D]">{resendMessage}</p>}
              </form>
              <Link
                href="/login"
                className="text-[14px] font-medium text-[#2563EB] hover:text-[#1E4AA8] transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          )}
        </Card>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-[#D4E1FC]/80">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Verification links expire after 24 hours and can only be used once.
        </div>
      </div>
    </div>
  );
}

/** Loading skeleton shown while the Suspense boundary hydrates. */
function VerifyEmailLoading(): React.JSX.Element {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#1E4AA8] via-[#2B5FD9] to-[#5B8AEB] px-4 py-10">
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/15 backdrop-blur-md border border-white/25 shadow-xl">
          <Sparkles className="h-7 w-7 text-[#F59E0B]" aria-hidden="true" />
        </div>
        <Card variant="standard" padding="lg" className="w-full shadow-2xl">
          <div className="flex flex-col items-center gap-4 text-center" role="status">
            <div className="h-12 w-12 rounded-full bg-blue-50 animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage(): React.JSX.Element {
  return (
    <Suspense fallback={<VerifyEmailLoading />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
