// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: Analytics view
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// The full Knowledge Layer analytics: per-category, per-source, lifecycle,
// validation, usage leaders, consumer leaders, and the registry growth trend.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useKnowledgeAnalytics } from '../../lib/api-client.js';
import { BarChart3, TrendingUp, Flame } from 'lucide-react';
import {
  CATEGORY_COLORS,
  SOURCE_COLORS,
  LIFECYCLE_COLORS,
  VALIDATION_COLORS,
  FALLBACK_COLOR,
  formatDate,
  formatPct,
} from './knowledge-ui.js';

export function AnalyticsView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useKnowledgeAnalytics(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Aggregating knowledge analytics…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-10 w-10" />}
        title="Analytics unavailable"
        description="The knowledge analytics service could not be reached."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const maxCategory = Math.max(1, ...Object.values(data.byCategory));
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.items));

  return (
    <div className="space-y-6">
      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Items" value={String(data.totals.items)} color="#2B5FD9" />
        <Kpi label="Active" value={String(data.totals.active)} color="#22C55E" />
        <Kpi label="Validated" value={String(data.totals.validated)} color="#0D9488" />
        <Kpi label="Total reads" value={String(data.totals.totalReads)} color="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── By category ──────────────────────────────────────────────── */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">By category</h3>
          <div className="mt-3 space-y-2.5">
            {Object.entries(data.byCategory)
              .filter(([, count]) => count > 0)
              .map(([category, count]) => {
                const color =
                  CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ?? FALLBACK_COLOR;
                return (
                  <div key={category} className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize text-slate-600 dark:text-slate-300">
                          {category}
                        </span>
                        <span className="text-slate-400">{count}</span>
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(count / maxCategory) * 100}%`,
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

        {/* ── By source type ───────────────────────────────────────────── */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            By source type
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(data.bySourceType)
              .filter(([, count]) => count > 0)
              .map(([source, count]) => (
                <div key={source} className="flex items-center gap-1.5">
                  <Badge
                    className={`text-[10px] ${SOURCE_COLORS[source as keyof typeof SOURCE_COLORS] ?? ''}`}
                  >
                    {source}
                  </Badge>
                  <span className="text-xs text-slate-400">{count}</span>
                </div>
              ))}
          </div>
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Lifecycle / validation
            </h4>
            <div className="mt-2 flex flex-wrap gap-3">
              {Object.entries(data.byLifecycle)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <Badge
                      className={`text-[10px] ${LIFECYCLE_COLORS[status as keyof typeof LIFECYCLE_COLORS] ?? ''}`}
                    >
                      {status}
                    </Badge>
                    <span className="text-xs text-slate-400">{count}</span>
                  </div>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              {Object.entries(data.byValidation)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <Badge
                      className={`text-[10px] ${VALIDATION_COLORS[status as keyof typeof VALIDATION_COLORS] ?? ''}`}
                    >
                      {status}
                    </Badge>
                    <span className="text-xs text-slate-400">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Usage leaders + consumers ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Flame className="h-4 w-4 text-[#F97316]" /> Usage leaders
          </h3>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {data.usageTop.slice(0, 6).map((usage) => (
              <div key={usage.knowledgeId} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                    {usage.title}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">{usage.knowledgeId}</div>
                </div>
                <span className="rounded-full bg-[#F97316]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C2410C]">
                  {usage.reads} reads
                </span>
                <span className="text-[10px] text-slate-400">{formatPct(usage.trust)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <TrendingUp className="h-4 w-4 text-[#22C55E]" /> Top consumers
          </h3>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {data.consumersTop.slice(0, 6).map((consumer) => (
              <div key={consumer.consumerId} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                    {consumer.consumerLabel}
                  </div>
                  <div className="text-[10px] text-slate-400">{consumer.consumerType}</div>
                </div>
                <span className="rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-[10px] font-semibold text-[#15803D]">
                  {consumer.usageCount} uses
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Trend ──────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Registry growth
        </h3>
        <div className="mt-4 flex h-32 items-end gap-1">
          {data.trend.map((point) => (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              title={`${point.date}: ${point.items} items (${point.active} active)`}
            >
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${Math.max(4, (point.items / maxTrend) * 100)}%`,
                  backgroundColor: point.active > 0 ? '#2B5FD9' : '#94A3B8',
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
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}): React.JSX.Element {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>
        {value}
      </div>
    </Card>
  );
}
