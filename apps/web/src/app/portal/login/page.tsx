// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Portal Login (EPIC-003 / AC-002, Module 7)
// Sign in with the access token issued by the agency.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe2, KeyRound, ArrowRight, Sparkles } from 'lucide-react';
import { Button, TextField } from '@vedmoulya/ui';
import { usePortalLogin } from '../../../lib/api-client.js';
import { setPortalToken, getPortalToken } from '../../../lib/portal-session.js';

export default function PortalLoginPage(): React.JSX.Element {
  const router = useRouter();
  const login = usePortalLogin();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const submit = async (): Promise<void> => {
    if (token.trim().length < 16) {
      setError('Please enter the full access token you received from the agency.');
      return;
    }
    setError('');
    const result = await login.mutateAsync({ token: token.trim() });
    const envelope = result as {
      success?: boolean;
      data?: unknown;
      error?: { message?: string } | null;
    };
    if (envelope.success === false) {
      setError(envelope.error?.message ?? 'Invalid access token');
      return;
    }
    setPortalToken(token.trim());
    router.push('/portal');
  };

  // Already signed in? Skip straight to the portal.
  useEffect(() => {
    if (getPortalToken()) {
      router.replace('/portal');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#2B5FD9] px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white dark:bg-[#0F172A]/90 border border-white/10 shadow-2xl p-8">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#2B5FD9] to-[#7C3AED] flex items-center justify-center text-white">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold font-heading text-[#111827] dark:text-white">
                Client Portal
              </h1>
              <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                VedMoulya AI Content Agency
              </p>
            </div>
          </div>

          <p className="mt-4 text-[13px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
            Sign in to review your content, approve or request changes, and view invoices and
            deliverables.
          </p>

          <div className="mt-5 space-y-3">
            <TextField
              label="Access token"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
              }}
              placeholder="Paste the token from your agency"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
            {error && (
              <div className="rounded-xl bg-[#FEF2F2] dark:bg-[#451A1A] border border-[#FECACA] dark:border-[#7F1D1D] px-3 py-2 text-[12.5px] text-[#B91C1C] dark:text-[#FCA5A5]">
                {error}
              </div>
            )}
            <Button fullWidth disabled={login.isPending} onClick={() => void submit()}>
              <KeyRound className="h-4 w-4" />
              {login.isPending ? 'Signing in…' : 'Sign in'}
              {!login.isPending && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-[#94A3B8]">
            <Sparkles className="h-3 w-3" /> Powered by the VedMoulya AI Content Agency
          </div>
        </div>
      </div>
    </div>
  );
}
