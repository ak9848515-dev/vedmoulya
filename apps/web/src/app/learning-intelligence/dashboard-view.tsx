// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Learning Intelligence: Dashboard view
// EPIC-004 / EI-007 — Enterprise Learning Intelligence Platform
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useLearningIntelligenceDashboard } from '../../lib/api-client.js';
import {
  Activity,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Lightbulb,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_LABELS, formatPct, formatDate } from './learning-ui.js';

export function DashboardView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useLearningIntelligenceDashboard(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Aggregating learning signals…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Activity className="h-10 w-10" />}
        title="Learning dashboard unavailable"
        description="The learning engine could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const maxTrend = Math.max(1, ...data.trend.map((t) => t.events));
  const pendingCount = data.totals.pendingApprovals;

  return (
    <div className="space-y-6">
      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Kpi
          label="Events"
          value={String(data.totals.events)}
          icon={<Activity className="h-5 w-5" />}
          color="#2B5FD9"
        />
        <Kpi
          label="Successes"
          value={String(data.totals.successes)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="#22C55E"
        />
        <Kpi
          label="Failures"
          value={String(data.totals.failures)}
          icon={<XCircle className="h-5 w-5" />}
          color="#EF4444"
        />
        <Kpi
          label="Models"
          value={String(data.totals.models)}
          icon={<TrendingUp className="h-5 w-5" />}
          color="#7C3AED"
        />
        <Kpi
          label="Insights"
          value={String(data.totals.insights)}
          icon={<Lightbulb className="h-5 w-5" />}
          color="#F59E0B"
        />
        <Kpi
          label="Reports"
          value={String(data.totals.reports)}
          icon={<Activity className="h-5 w-5" />}
          color="#0D9488"
        />
        <Kpi
          label="Pending"
          value={String(pendingCount)}
          icon={<Clock className="h-5 w-5" />}
          color="#F97316"
          pulse={pendingCount > 0}
        />
        <Kpi
          label="Approved"
          value={String(data.totals.approved)}
          icon={<ShieldCheck className="h-5 w-5" />}
          color="#06B6D4"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Category grid ─────────────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Learning by Category
          </h3>
          <p className="text-xs text-slate-400">Events, success rate, and tracked models</p>
          <div className="mt-4 space-y-3">
            {Object.entries(data.byCategory).map(([category, stats]) => {
              const color = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ?? '#64748B';
              return (
                <div key={category} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
                      </span>
                      <span className="text-slate-400">
                        {stats.events} · {formatPct(stats.successRate)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(stats.successRate * 100)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Trend chart ───────────────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            14-Day Learning Trend
          </h3>
          <p className="text-xs text-slate-400">Events per day with success rate</p>
          <div className="mt-4 flex h-40 items-end gap-1">
            {data.trend.map((point) => (
              <div
                key={point.date}
                className="group relative flex flex-1 flex-col items-center justify-end"
                title={`${point.date}: ${point.events} event(s), ${formatPct(point.successRate)} success`}
              >
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(4, (point.events / maxTrend) * 100)}%`,
                    backgroundColor:
                      point.successRate >= 0.7
                        ? '#22C55E'
                        : point.successRate >= 0.5
                          ? '#F59E0B'
                          : '#EF4444',
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{formatDate(data.trend[0]?.date)}</span>
            <span>Today</span>
          </div>
        </Card>

        {/* ── Recent events ─────────────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Recent Signals
            </h3>
            <Sparkles className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 space-y-2">
            {data.recentEvents.slice(0, 6).map((event) => {
              return (
                <div
                  key={event.eventId}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
                >
                  <span
                    className="flex h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: event.outcome === 'success' ? '#22C55E' : '#EF4444' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                      {event.entityLabel}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {event.category} · {formatDate(event.occurredAt)}
                    </div>
                  </div>
                  <Badge
                    variant={event.outcome === 'success' ? 'success' : 'danger'}
                    className="text-[10px]"
                  >
                    {event.outcome}
                  </Badge>
                </div>
              );
            })}
            {data.recentEvents.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">No events recorded yet.</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Pending approvals banner ────────────────────────────────────── */}
      {pendingCount > 0 && (
        <div className="animate-slide-up flex items-center justify-between rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-[#F59E0B]" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                {pendingCount} recommendation{pendingCount === 1 ? '' : 's'} awaiting human approval
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Learning never bypasses human approval — review them in the Recommendations tab.
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-[#F59E0B]" />
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  color,
  pulse = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  pulse?: boolean;
}): React.JSX.Element {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          pulse ? 'animate-pulse' : ''
        }`}
        style={{ backgroundColor: `${color}1A`, color }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs text-slate-400">{label}</div>
        <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
      </div>
    </Card>
  );
}
