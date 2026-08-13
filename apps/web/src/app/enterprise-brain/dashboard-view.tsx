// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Dashboard view
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useEnterpriseBrainDashboard } from '../../lib/api-client.js';
import {
  BrainCircuit,
  ListChecks,
  Clock,
  CheckCircle2,
  Rocket,
  Gauge,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import {
  TYPE_LABELS,
  TYPE_COLORS,
  STATUS_COLORS,
  FALLBACK_COLOR,
  formatPct,
  formatDate,
} from './brain-ui.js';
import { DecisionCard } from './components.js';

export function DashboardView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useEnterpriseBrainDashboard(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Synthesizing enterprise decisions…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<BrainCircuit className="h-10 w-10" />}
        title="Enterprise Brain unavailable"
        description="The decision engine could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const maxType = Math.max(1, ...Object.values(data.byType));
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.decisions));

  return (
    <div className="space-y-6">
      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Kpi
          label="Decisions"
          value={String(data.totals.decisions)}
          icon={<BrainCircuit className="h-5 w-5" />}
          color="#2B5FD9"
        />
        <Kpi
          label="Plans"
          value={String(data.totals.plans)}
          icon={<ListChecks className="h-5 w-5" />}
          color="#7C3AED"
        />
        <Kpi
          label="Pending approval"
          value={String(data.totals.pendingApprovals)}
          icon={<Clock className="h-5 w-5" />}
          color="#F59E0B"
          pulse={data.totals.pendingApprovals > 0}
        />
        <Kpi
          label="Approved"
          value={String(data.totals.approved)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="#22C55E"
        />
        <Kpi
          label="Handed off"
          value={String(data.totals.handedOff)}
          icon={<Rocket className="h-5 w-5" />}
          color="#06B6D4"
        />
        <Kpi
          label="Avg confidence"
          value={formatPct(data.avgConfidence)}
          icon={<Gauge className="h-5 w-5" />}
          color="#0D9488"
        />
        <Kpi
          label="High confidence"
          value={String(data.highConfidenceCount)}
          icon={<ShieldCheck className="h-5 w-5" />}
          color="#8B5CF6"
        />
        <Kpi
          label="Superseded"
          value={String(data.totals.superseded)}
          icon={<ArrowRight className="h-5 w-5" />}
          color="#64748B"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Decision type distribution ────────────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Decisions by Type
          </h3>
          <p className="text-xs text-slate-400">The 14 things the Brain decides</p>
          <div className="mt-4 space-y-3">
            {Object.entries(data.byType)
              .filter(([, count]) => count > 0)
              .map(([type, count]) => {
                const color = TYPE_COLORS[type as keyof typeof TYPE_COLORS] ?? FALLBACK_COLOR;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {TYPE_LABELS[type as keyof typeof TYPE_LABELS] ?? type}
                        </span>
                        <span className="text-slate-400">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round((count / maxType) * 100)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            {data.totals.decisions === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                No decisions yet — decide a goal in the Explorer tab.
              </p>
            )}
          </div>
        </Card>

        {/* ── Trend chart ───────────────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            14-Day Decision Trend
          </h3>
          <p className="text-xs text-slate-400">Decisions per day</p>
          <div className="mt-4 flex h-40 items-end gap-1">
            {data.trend.map((point) => (
              <div
                key={point.date}
                className="group relative flex flex-1 flex-col items-center justify-end"
                title={`${point.date}: ${point.decisions} decision(s), ${formatPct(point.avgConfidence)} avg confidence`}
              >
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${Math.max(4, (point.decisions / maxTrend) * 100)}%`,
                    backgroundColor:
                      point.avgConfidence >= 0.8
                        ? '#22C55E'
                        : point.avgConfidence >= 0.5
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

        {/* ── Status breakdown + recent decisions ───────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Decision Lifecycle
            </h3>
            <Badge variant="info" className="text-[10px]">
              {data.totals.decisions} total
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {Object.entries(data.byStatus)
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <Badge
                    className={`text-[10px] ${STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? ''}`}
                  >
                    {status.replace('_', ' ')}
                  </Badge>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{count}</span>
                </div>
              ))}
            {data.totals.decisions === 0 && (
              <p className="text-xs text-slate-400">Nothing decided yet.</p>
            )}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Recent decisions
            </h4>
            <div className="mt-2 space-y-2">
              {data.recentDecisions.slice(0, 4).map((decision) => {
                const color = TYPE_COLORS[decision.type] ?? FALLBACK_COLOR;
                return (
                  <div key={decision.decisionId} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate text-slate-600 dark:text-slate-300">
                      {decision.title}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                      {formatPct(decision.confidence.score)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Pending approvals banner ────────────────────────────────────── */}
      {data.totals.pendingApprovals > 0 && (
        <div className="animate-slide-up flex items-center justify-between rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-[#F59E0B]" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                {data.totals.pendingApprovals} decision
                {data.totals.pendingApprovals === 1 ? '' : 's'} awaiting human approval
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                The Brain proposes; humans dispose. Review them in the Recommendations tab before
                handing the plan to the orchestrator.
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-[#F59E0B]" />
        </div>
      )}

      {/* ── Latest plan with its explainability ─────────────────────────── */}
      {data.recentPlans[0] && data.recentPlans[0].decisions[0] && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Latest Plan — {data.recentPlans[0].goalTitle}
            </h3>{' '}
            <Badge className={`text-[10px] ${STATUS_COLORS[data.recentPlans[0].status] ?? ''}`}>
              {data.recentPlans[0].status.replace('_', ' ')}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <DecisionCard decision={data.recentPlans[0].decisions[0]} />
            <DecisionCard
              decision={data.recentPlans[0].decisions[1] ?? data.recentPlans[0].decisions[0]}
            />
          </div>
        </Card>
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
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${pulse ? 'animate-pulse' : ''}`}
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
