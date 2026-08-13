// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Decision Analytics view
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// Trend chart, per-type counts, and lifecycle (status) breakdown.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import { useEnterpriseBrainDashboard } from '../../lib/api-client.js';
import { BarChart3, TrendingUp } from 'lucide-react';
import { TYPE_LABELS, TYPE_COLORS, STATUS_COLORS, FALLBACK_COLOR, formatPct } from './brain-ui.js';

export function AnalyticsView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useEnterpriseBrainDashboard(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Computing decision analytics…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-10 w-10" />}
        title="Analytics unavailable"
        description="Decision analytics could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const maxTrend = Math.max(1, ...data.trend.map((t) => t.decisions));
  const maxType = Math.max(1, ...Object.values(data.byType));

  return (
    <div className="space-y-6">
      {/* ── Trend chart ─────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[#2B5FD9]" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              14-Day Decision Volume
            </h3>
            <p className="text-xs text-slate-400">Decisions per day with average confidence</p>
          </div>
        </div>
        <div className="mt-4 flex h-48 items-end gap-1">
          {data.trend.map((point) => (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
            >
              <div className="pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block dark:bg-white dark:text-slate-900">
                {point.date}: {point.decisions} decision(s) · {formatPct(point.avgConfidence)} avg
                confidence
              </div>
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
              <div className="mt-1 text-[9px] text-slate-300 dark:text-slate-600">
                {point.date.slice(8, 10)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Per-type counts ───────────────────────────────────────────── */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Decisions by Type
          </h3>
          <div className="mt-4 space-y-2.5">
            {Object.entries(data.byType)
              .filter(([, count]) => count > 0)
              .map(([type, count]) => {
                const color = TYPE_COLORS[type as keyof typeof TYPE_COLORS] ?? FALLBACK_COLOR;
                return (
                  <div key={type} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 truncate text-slate-500 dark:text-slate-400">
                      {TYPE_LABELS[type as keyof typeof TYPE_LABELS] ?? type}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(count / maxType) * 100}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="w-6 text-right font-semibold text-slate-600 dark:text-slate-300">
                      {count}
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* ── Lifecycle breakdown ───────────────────────────────────────── */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Decision Lifecycle
          </h3>
          <p className="text-xs text-slate-400">
            proposed → approved → handed off · or rejected / superseded
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.entries(data.byStatus)
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <div
                  key={status}
                  className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? ''}`}
                  >
                    {status.replace('_', ' ')}
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                    {count}
                  </div>
                </div>
              ))}
            {data.totals.decisions === 0 && (
              <p className="col-span-2 py-6 text-center text-xs text-slate-400">
                No decisions yet.
              </p>
            )}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-slate-800">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Overall confidence:
            </span>{' '}
            {formatPct(data.avgConfidence)} · {data.highConfidenceCount} high-confidence decision(s)
          </div>
        </Card>
      </div>
    </div>
  );
}
