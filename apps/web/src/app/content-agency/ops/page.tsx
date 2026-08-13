// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Client Operations Hub (EPIC-003 / AC-002)
// Business dashboard: revenue, win rate, clients, AI usage + module navigation.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import Link from 'next/link';
import {
  Users,
  FileText,
  FileSignature,
  BadgeDollarSign,
  Wallet,
  FolderOpen,
  Globe2,
  Bell,
  TrendingUp,
  DollarSign,
  Target,
  Sparkles,
  Timer,
  ArrowUpRight,
} from 'lucide-react';
import { Card, Badge, Loading, ErrorState, Button } from '@vedmoulya/ui';
import { AgencySubNav } from '../_components/AgencySubNav.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import {
  useBusinessAnalytics,
  useRevenueOverview,
  useOpsNotifications,
  useOpsExpiringContracts,
} from '../../../lib/api-client.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';

const MODULES = [
  {
    href: '/content-agency/ops/crm',
    label: 'Client CRM',
    description: 'Pipeline, health, timeline, tasks',
    icon: Users,
  },
  {
    href: '/content-agency/ops/proposals',
    label: 'Proposals',
    description: 'AI proposals, versions, exports',
    icon: FileText,
  },
  {
    href: '/content-agency/ops/contracts',
    label: 'Contracts',
    description: 'Versions, approvals, renewals',
    icon: FileSignature,
  },
  {
    href: '/content-agency/ops/quotations',
    label: 'Quotations',
    description: 'Packages, discounts, taxes',
    icon: BadgeDollarSign,
  },
  {
    href: '/content-agency/ops/payments',
    label: 'Payments',
    description: 'Revenue, cash flow, outstanding',
    icon: Wallet,
  },
  {
    href: '/content-agency/ops/documents',
    label: 'Documents',
    description: 'Uploads, versions, search',
    icon: FolderOpen,
  },
  {
    href: '/content-agency/ops/portal',
    label: 'Client Portal',
    description: 'Secure client access & approvals',
    icon: Globe2,
  },
  {
    href: '/content-agency/ops/notifications',
    label: 'Notifications',
    description: 'Proposals, approvals, invoices',
    icon: Bell,
  },
];

function formatMoney(value: number | undefined, currency = 'USD'): string {
  const n = value ?? 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function OpsHubPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Operations', '/content-agency/ops');
  const analytics = useBusinessAnalytics(userId);
  const revenue = useRevenueOverview(userId);
  const notifications = useOpsNotifications(userId);
  const expiring = useOpsExpiringContracts(userId, 30);

  if (!ready) return <Loading label="Loading operations…" />;
  if (!userId) return <SignInRedirect />;

  const unread = (notifications.data ?? []).filter((n) => !n.isRead).length;
  const expiringCount = expiring.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <AgencySubNav />

      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-[#2B5FD9] via-[#1E4AA8] to-[#7C3AED] p-6 md:p-8 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-white/15 text-white border-white/20">AC-002</Badge>
            <span className="text-[13px] text-white/80">
              Client Operations &amp; Revenue Engine
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading tracking-tight">
            Run the business, not just the content.
          </h1>
          <p className="mt-2 text-[14px] text-white/85 max-w-xl">
            Leads to revenue: CRM pipeline, AI proposals, contracts, quotations, invoicing, payments
            and a secure client portal — built on the VedMoulya platform.
          </p>
        </div>
      </div>

      {analytics.isError || revenue.isError ? (
        <ErrorState
          title="Could not load business metrics"
          onRetry={() => {
            void analytics.refetch();
          }}
        />
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Revenue (paid)"
              value={formatMoney(revenue.data?.paidTotal, revenue.data?.currency)}
              hint={`${String(revenue.data?.monthlyRevenue.at(-1)?.amount ?? 0)} this month`}
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Outstanding"
              value={formatMoney(revenue.data?.outstanding, revenue.data?.currency)}
              hint={`${String(revenue.data?.overdueCount ?? 0)} overdue`}
              tone={revenue.data?.overdueCount ? 'warn' : 'ok'}
            />
            <KpiCard
              icon={<Target className="h-4 w-4" />}
              label="Win rate"
              value={`${String(analytics.data?.winRate ?? 0)}%`}
              hint={`${String(analytics.data?.clients.total ?? 0)} clients`}
            />
            <KpiCard
              icon={<Timer className="h-4 w-4" />}
              label="Approval time"
              value={`${String(analytics.data?.approvalTimeDays ?? 0)}d`}
              hint={`${String(analytics.data?.contentGenerated ?? 0)} assets generated`}
            />
          </div>

          {/* AI usage + alerts */}
          <div className="grid lg:grid-cols-3 gap-4">
            <Card variant="elevated" className="lg:col-span-2 p-5">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
                <Sparkles className="h-4 w-4 text-[#7C3AED]" /> AI Usage
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <Metric label="Requests" value={String(analytics.data?.aiUsage.requests ?? 0)} />
                <Metric
                  label="Tokens"
                  value={(analytics.data?.aiUsage.tokens ?? 0).toLocaleString()}
                />
                <Metric label="AI cost" value={formatMoney(analytics.data?.aiUsage.cost)} />
              </div>
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] dark:border-[#334155]">
                <div className="flex items-center justify-between text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                  <span>Monthly revenue (last 6 months)</span>
                  <span>Avg delivery {analytics.data?.avgDeliveryDays ?? 0}d</span>
                </div>
                <div className="mt-2 flex items-end gap-1.5 h-16">
                  {(revenue.data?.monthlyRevenue ?? []).map((m) => (
                    <div
                      key={m.month}
                      className="flex-1 rounded-t-md bg-[#2B5FD9]/15 dark:bg-[#2B5FD9]/30"
                      style={{
                        height: `${String(Math.max(8, Math.min(100, (m.amount / Math.max(1, revenue.data?.paidTotal ?? 1)) * 300)))}%`,
                      }}
                      title={`${m.month}: ${formatMoney(m.amount)}`}
                    />
                  ))}
                </div>
              </div>
            </Card>

            <Card variant="elevated" className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
                  <Bell className="h-4 w-4 text-[#2B5FD9]" /> Attention
                </div>
                {unread > 0 && <Badge className="bg-[#EF4444] text-white">{unread} unread</Badge>}
              </div>
              <AttentionRow
                label={`${String(expiringCount)} contract${expiringCount === 1 ? '' : 's'} expiring soon`}
                href="/content-agency/ops/contracts"
              />
              <AttentionRow
                label={`${String(revenue.data?.pendingCount ?? 0)} invoices awaiting payment`}
                href="/content-agency/ops/payments"
              />
              <AttentionRow
                label={`${String(revenue.data?.overdueCount ?? 0)} overdue invoices`}
                href="/content-agency/ops/payments"
              />
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  window.location.assign('/content-agency/ops/notifications');
                }}
              >
                Open notifications
              </Button>
            </Card>
          </div>

          {/* Module cards */}
          <div>
            <h2 className="text-[15px] font-bold text-[#111827] dark:text-white mb-3">Modules</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {MODULES.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link key={mod.href} href={mod.href} className="group">
                    <Card
                      variant="interactive"
                      className="h-full p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="h-9 w-9 rounded-xl bg-[#2B5FD9]/10 dark:bg-[#2B5FD9]/25 flex items-center justify-center text-[#2B5FD9] dark:text-[#6B8FEF]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-[#94A3B8] opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="mt-3 text-[13.5px] font-semibold text-[#111827] dark:text-white">
                        {mod.label}
                      </div>
                      <div className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8] leading-snug">
                        {mod.description}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: 'ok' | 'warn';
}): React.JSX.Element {
  return (
    <Card variant="elevated" className="p-4">
      <div className="flex items-center gap-2 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
        <span className={props.tone === 'warn' ? 'text-[#EF4444]' : 'text-[#2B5FD9]'}>
          {props.icon}
        </span>
        {props.label}
      </div>
      <div className="mt-2 text-[20px] font-bold text-[#111827] dark:text-white font-heading">
        {props.value}
      </div>
      <div className="mt-1 text-[11.5px] text-[#94A3B8] dark:text-[#64748B]">{props.hint}</div>
    </Card>
  );
}

function Metric(props: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-xl bg-[#F5F7FA] dark:bg-[#1E293B] p-3">
      <div className="text-[16px] font-bold text-[#111827] dark:text-white">{props.value}</div>
      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{props.label}</div>
    </div>
  );
}

function AttentionRow(props: { label: string; href: string }): React.JSX.Element {
  return (
    <Link
      href={props.href}
      className="block rounded-xl px-3 py-2 text-[12.5px] text-[#374151] dark:text-[#E2E8F0] bg-[#F5F7FA] dark:bg-[#1E293B] hover:bg-[#EEF2F7] dark:hover:bg-[#243049] transition-colors"
    >
      {props.label}
    </Link>
  );
}
