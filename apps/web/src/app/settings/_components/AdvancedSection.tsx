// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → Advanced (UX-07)
//
// Real, read-only diagnostics plus doors to the existing engineering surfaces.
// Nothing here is configurable, and it says so: there are no hidden toggles
// pretending to change autonomy, execution or provider behaviour — those stay
// with the Brain / Missions / AI experiences that own them.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@vedmoulya/ui';
import { ArrowRight, Activity, GitBranch, Settings2, Terminal } from 'lucide-react';
import { useProviderRuntimeStatus } from '../../../lib/api-client.js';
import { useAuthStore } from '../../../stores/auth-store.js';

const SURFACES: ReadonlyArray<{ label: string; route: string; description: string }> = [
  {
    label: 'Execution strategy',
    route: '/execution-strategy',
    description: 'How missions choose and sequence execution steps.',
  },
  {
    label: 'Execution loop',
    route: '/loop',
    description: 'The autonomous mission loop and its current state.',
  },
  {
    label: 'Context fabric',
    route: '/context-fabric',
    description: 'What context is assembled before the AI answers.',
  },
];

function Fact({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#F1F5F9] dark:border-[#334155] last:border-0">
      <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">{label}</p>
      <p
        className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC] text-right break-all"
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

export function AdvancedSection(): React.JSX.Element {
  const { user, expiresAt } = useAuthStore();
  const runtime = useProviderRuntimeStatus(user?.userId ?? '');

  const runtimeMode = runtime.data?.mode ?? (runtime.isLoading ? 'Reading…' : 'Unknown');
  const knownProviders = runtime.data ? String(runtime.data.providers.length) : 'Unknown';

  return (
    <div className="space-y-4" data-testid="settings-advanced">
      <Card variant="standard" padding="lg">
        <div className="flex items-start gap-3 mb-4">
          <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" aria-hidden="true" />
          <div>
            <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Advanced
            </h3>
            <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              Read-only diagnostics. Autonomy, execution and provider behaviour are configured where
              they are owned — never from a hidden toggle here.
            </p>
          </div>
        </div>

        <div className="space-y-0">
          <Fact label="Runtime mode" value={runtimeMode} testId="advanced-runtime-mode" />
          <Fact label="Providers known" value={knownProviders} testId="advanced-providers-known" />
          <Fact label="User ID" value={user?.userId ?? '—'} testId="advanced-user-id" />
          <Fact
            label="Session expires"
            value={expiresAt ? new Date(expiresAt).toISOString() : '—'}
            testId="advanced-session-expiry"
          />
        </div>
      </Card>

      <Card variant="standard" padding="lg">
        <div className="flex items-start gap-3 mb-3">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-[#2B5FD9]" aria-hidden="true" />
          <div>
            <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Engineering surfaces
            </h3>
            <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              These screens exist and stay reachable; they are operator surfaces, not preferences.
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {SURFACES.map((surface) => (
            <li key={surface.route}>
              <Link
                href={surface.route}
                className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] p-3 transition-colors hover:border-[#2B5FD9]/40"
              >
                <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                    {surface.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                    {surface.description}
                  </span>
                </span>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#CBD5E1] dark:text-[#475569]"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-4 flex items-center gap-2 text-[12px] text-[#94A3B8]">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          Diagnostics are read from the live runtime; nothing is cached or estimated.
        </p>
      </Card>
    </div>
  );
}
