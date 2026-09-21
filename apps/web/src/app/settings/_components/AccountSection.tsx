// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → Account (UX-07)
//
// REAL session facts only: the identity the Identity Service authenticated
// (userId / email / role / profile completion), read from the auth store — the
// same store every protected screen uses. Sign out here is the ONE sign-out
// control in the product (it used to live under Security).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Button, Badge } from '@vedmoulya/ui';
import { CheckCircle2, LogOut, Mail, ShieldCheck, User } from 'lucide-react';
import { logout } from '../../../auth/session-manager.js';
import { useAuthStore } from '../../../stores/auth-store.js';

function Row({
  icon,
  label,
  value,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  testId?: string;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#F1F5F9] dark:border-[#334155] last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[#64748B] dark:text-[#94A3B8] shrink-0">{icon}</span>
        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">{label}</p>
      </div>
      <p
        className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC] text-right break-all"
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

export function AccountSection(): React.JSX.Element {
  const { user, expiresAt } = useAuthStore();

  if (!user) {
    return (
      <Card variant="standard" padding="lg">
        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          Sign in to see your account.
        </p>
      </Card>
    );
  }

  async function handleLogout(): Promise<void> {
    await logout();
    window.location.assign('/login');
  }

  const sessionExpiry = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <Card variant="standard" padding="lg" data-testid="settings-account">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Account</h3>
          <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            The identity you are signed in as.
          </p>
        </div>
        <Badge variant={user.profileComplete === false ? 'warning' : 'success'} size="sm">
          {user.profileComplete === false ? 'Profile incomplete' : 'Signed in'}
        </Badge>
      </div>

      <div className="space-y-0">
        <Row
          icon={<User className="h-4 w-4" aria-hidden="true" />}
          label="Name"
          value={user.displayName ?? '—'}
          testId="account-name"
        />
        <Row
          icon={<Mail className="h-4 w-4" aria-hidden="true" />}
          label="Email"
          value={user.email}
          testId="account-email"
        />
        <Row
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          label="Role"
          value={user.role || '—'}
          testId="account-role"
        />
        <Row
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          label="User ID"
          value={user.userId}
          testId="account-user-id"
        />
        <Row
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          label="Session expires"
          value={sessionExpiry}
          testId="account-session-expiry"
        />
      </div>

      {user.profileComplete === false ? (
        <div
          className="mt-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 dark:border-[#78350F] dark:bg-[#451A03]"
          data-testid="account-profile-incomplete"
        >
          <p className="text-[13px] text-[#92400E] dark:text-[#FDE68A]">
            Your profile is not complete yet.{' '}
            <Link href="/settings?tab=profile" className="font-medium underline">
              Finish your profile
            </Link>{' '}
            so VedMoulya can work from real goals.
          </p>
        </div>
      ) : null}

      <div className="mt-6 pt-6 border-t border-[#E2E8F0] dark:border-[#334155] flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-[#94A3B8]">
          Signing out clears this session and returns you to the login screen.
        </p>
        <Button
          variant="secondary"
          size="md"
          className="text-[#EF4444]"
          data-testid="account-sign-out"
          onClick={() => {
            void handleLogout();
          }}
        >
          <LogOut className="h-4 w-4 mr-1.5" aria-hidden="true" /> Sign out
        </Button>
      </div>
    </Card>
  );
}
