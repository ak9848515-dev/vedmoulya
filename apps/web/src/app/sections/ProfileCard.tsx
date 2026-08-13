// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: User Profile Card (MOB-002)
// Premium identity card: avatar (initial-based), display name, email, role
// badge and primary goal. Falls back to the auth-store user when the snapshot
// identity is sparse. Dark-mode aware.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Badge } from '@vedmoulya/ui';
import { Mail, Flag, Sparkles } from 'lucide-react';
import type { IdentitySummary } from './types.js';

export interface ProfileCardProps {
  identity: IdentitySummary;
  /** Fallback email from the auth session when the snapshot omits it. */
  fallbackEmail?: string;
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U'
  );
}

export function ProfileCard({ identity, fallbackEmail }: ProfileCardProps): React.JSX.Element {
  const name = identity.displayName || 'User';
  const email = identity.email || fallbackEmail || '';

  return (
    <section
      className="
        flex items-center gap-4 p-4 rounded-2xl
        bg-white dark:bg-[#1E293B] border border-[#E8EDF5] dark:border-[#334155]
        shadow-sm animate-slide-up
      "
    >
      {/* Avatar */}
      <div
        className="
          relative h-14 w-14 shrink-0 rounded-full
          bg-gradient-to-br from-[#2B5FD9] to-[#5B8AEB]
          flex items-center justify-center text-white text-[18px] font-bold
          ring-4 ring-[#EFF4FE] dark:ring-[#1E3A5F]
        "
        aria-hidden="true"
      >
        {initials(name)}
        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#22C55E] ring-2 ring-white dark:ring-[#1E293B]" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
            {name}
          </h2>
          <Badge variant="ai" size="sm" className="shrink-0 hidden sm:inline-flex">
            <Sparkles className="h-3 w-3 mr-1" /> Pro
          </Badge>
        </div>
        {email && (
          <p className="flex items-center gap-1.5 text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 truncate">
            <Mail className="h-3 w-3 shrink-0" /> {email}
          </p>
        )}
        {identity.primaryGoal && (
          <p className="flex items-center gap-1.5 text-[13px] text-[#2B5FD9] dark:text-[#6B8FEF] mt-0.5 truncate">
            <Flag className="h-3 w-3 shrink-0" /> {identity.primaryGoal}
          </p>
        )}
      </div>
    </section>
  );
}
