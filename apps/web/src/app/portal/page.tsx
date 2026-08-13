// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Portal Dashboard (EPIC-003 / AC-002, Module 7)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Building2,
  FolderKanban,
  FileText,
  Receipt,
  Bell,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card, Loading, ErrorState } from '@vedmoulya/ui';
import { PortalShell } from './_components/PortalShell.js';
import { getPortalToken } from '../../lib/portal-session.js';
import { usePortalDashboard } from '../../lib/api-client.js';

export default function PortalDashboardPage(): React.JSX.Element | null {
  const [token, setToken] = useState('');
  useEffect(() => {
    setToken(getPortalToken());
  }, []);
  const dashboard = usePortalDashboard(token);

  if (!token) return null;

  return (
    <PortalShell>
      {dashboard.isError ? (
        <ErrorState
          title="Could not load your dashboard"
          onRetry={() => {
            void dashboard.refetch();
          }}
        />
      ) : dashboard.isLoading || !dashboard.data ? (
        <Loading label="Loading your portal…" />
      ) : (
        <div className="space-y-6">
          {/* Hero */}
          <div className="rounded-3xl bg-gradient-to-br from-[#2B5FD9] to-[#7C3AED] p-6 text-white relative overflow-hidden">
            <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-white/80 text-[12.5px]">
                <Building2 className="h-4 w-4" /> {dashboard.data.session.email}
              </div>
              <h1 className="mt-1 text-2xl font-bold font-heading">
                Welcome, {dashboard.data.session.company}
              </h1>
              <p className="mt-1 text-[13px] text-white/85">
                Your projects, content and invoices at a glance.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              icon={<FolderKanban className="h-4 w-4" />}
              label="Projects"
              value={String(dashboard.data.projects.length)}
            />
            <Stat
              icon={<FileText className="h-4 w-4" />}
              label="Content"
              value={String(dashboard.data.contentStats.total)}
            />
            <Stat
              icon={<Receipt className="h-4 w-4" />}
              label="Invoices"
              value={String(dashboard.data.invoices.length)}
            />
          </div>

          {/* Awaiting approval */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-bold text-[#111827] dark:text-white">
                Content awaiting your review
              </h2>
              <Link
                href="/portal/content"
                className="text-[12.5px] text-[#2B5FD9] dark:text-[#6B8FEF] inline-flex items-center gap-1 hover:underline"
              >
                Review all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {dashboard.data.contentStats.awaitingApproval > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {dashboard.data.content
                  .filter((c) => c.status === 'review')
                  .slice(0, 4)
                  .map((item) => (
                    <Link key={item.id} href={`/portal/content?id=${item.id}`}>
                      <Card variant="interactive" className="p-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-[#F59E0B]" />
                          <span className="text-[13px] font-medium text-[#111827] dark:text-white truncate">
                            {item.title}
                          </span>
                        </div>
                        <div className="mt-1 text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                          {item.contentType} · {new Date(item.updatedAt).toLocaleDateString()}
                        </div>
                      </Card>
                    </Link>
                  ))}
              </div>
            ) : (
              <Card variant="elevated" className="p-5 text-center text-[13px] text-[#94A3B8]">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-[#10B981]" />
                Nothing waiting for your review — nice!
              </Card>
            )}
          </div>

          {/* Recent notifications */}
          {dashboard.data.notifications.length > 0 && (
            <div>
              <h2 className="text-[14px] font-bold text-[#111827] dark:text-white mb-3 flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-[#2B5FD9]" /> Updates
              </h2>
              <Card variant="elevated" className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                {dashboard.data.notifications.slice(0, 5).map((n) => (
                  <div key={n.id} className="px-4 py-3">
                    <div className="text-[13px] font-medium text-[#111827] dark:text-white">
                      {n.title}
                    </div>
                    <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                      {n.message}
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-1">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}
    </PortalShell>
  );
}

function Stat(props: { icon: React.ReactNode; label: string; value: string }): React.JSX.Element {
  return (
    <Card variant="elevated" className="p-4 text-center">
      <div className="mx-auto h-8 w-8 rounded-lg bg-[#2B5FD9]/10 dark:bg-[#2B5FD9]/25 flex items-center justify-center text-[#2B5FD9]">
        {props.icon}
      </div>
      <div className="mt-2 text-[18px] font-bold font-heading text-[#111827] dark:text-white">
        {props.value}
      </div>
      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{props.label}</div>
    </Card>
  );
}
