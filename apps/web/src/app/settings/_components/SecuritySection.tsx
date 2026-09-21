// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → Security (UX-07)
//
// The old tab shipped a "Two-Factor Authentication · Enable" button with no
// handler and no backing capability. It is now an explicit not-available-yet
// notice, and the tab shows only REAL session facts (token type + expiry from
// the auth store). Sign out lives in Account — one control, one owner.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@vedmoulya/ui';
import { ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth-store.js';
import { SettingsNotice } from './SettingsNotice.js';

export function SecuritySection(): React.JSX.Element {
  const { user, expiresAt } = useAuthStore();

  const sessionExpiry = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="space-y-4" data-testid="settings-security">
      <Card variant="standard" padding="lg">
        <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Security</h3>
        <p className="mt-1 mb-4 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          How this session is protected today.
        </p>

        <div className="space-y-0">
          <div className="flex items-center justify-between gap-4 py-3 border-b border-[#F1F5F9] dark:border-[#334155]">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-[#22C55E]" aria-hidden="true" />
              <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">Session type</p>
            </div>
            <p
              className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]"
              data-testid="security-session-type"
            >
              Bearer JWT (expires)
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
              <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">Session expires</p>
            </div>
            <p
              className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]"
              data-testid="security-session-expiry"
            >
              {sessionExpiry}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
          Signing out of {user?.email ?? 'this account'} is available in{' '}
          <Link href="/settings" className="text-[#2B5FD9] dark:text-[#6B8FEF] underline">
            Account
          </Link>
          .
        </p>
      </Card>

      <SettingsNotice
        title="Two-factor authentication is not available yet"
        description="There is no way to enrol a second factor from VedMoulya today, so this screen does not pretend otherwise."
        planned={[
          'Enrol an authenticator app and store recovery codes',
          'Require the second factor on new sign-ins',
          'Show active sessions and revoke them',
        ]}
        tone="future"
      />
    </div>
  );
}
