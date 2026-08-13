// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: Usage Analytics
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// Who consumes memory, what gets retrieved, and how the memory layer is used
// across the operating system — per type, source, lifecycle, compression and
// consumer.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import { useMemoryAnalytics } from '../../lib/api-client.js';
import { BarChart3, RotateCw, Users } from 'lucide-react';
import { TYPE_COLORS, SOURCE_COLORS, FALLBACK_COLOR, formatDate } from './memory-ui.js';
import { ConsumerRow } from './components.js';

export function AnalyticsView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useMemoryAnalytics(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading memory analytics…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-10 w-10" />}
        title="Analytics unavailable"
        description="The memory usage analytics could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const maxType = Math.max(1, ...Object.values(data.byType));
  const maxSource = Math.max(1, ...Object.values(data.bySourceType));
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.memories));

  return (
    <div className="space-y-6">
      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Total retrievals"
          value={String(data.totals.totalRetrievals)}
          icon={<RotateCw className="h-5 w-5" />}
          color="#06B6D4"
        />
        <Kpi
          label="Consumers"
          value={String(data.totals.consumers)}
          icon={<Users className="h-5 w-5" />}
          color="#8B5CF6"
        />
        <Kpi
          label="Citations"
          value={String(data.totals.citations)}
          icon={<BarChart3 className="h-5 w-5" />}
          color="#0D9488"
        />
        <Kpi
          label="Avg importance"
          value={data.totals.avgImportance.toFixed(2)}
          icon={<BarChart3 className="h-5 w-5" />}
          color="#F59E0B"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── By type ───────────────────────────────────────────────────── */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Memories by Type
          </h3>
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
                        <span className="font-medium capitalize text-slate-700 dark:text-slate-200">
                          {type.replace('_', ' ')}
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
          </div>
        </Card>

        {/* ── By source ─────────────────────────────────────────────────── */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Memories by Source
          </h3>
          <div className="mt-4 space-y-3">
            {Object.entries(data.bySourceType)
              .filter(([, count]) => count > 0)
              .map(([source, count]) => {
                const color = SOURCE_COLORS[source as keyof typeof SOURCE_COLORS] ?? FALLBACK_COLOR;
                return (
                  <div key={source} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium capitalize text-slate-700 dark:text-slate-200">
                          {source}
                        </span>
                        <span className="text-slate-400">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round((count / maxSource) * 100)}%`,
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
      </div>

      {/* ── Usage top ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Most Retrieved Memories
          </h3>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {data.usageTop.map((row) => (
              <div
                key={row.memoryId}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                    {row.title}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    importance {(row.importance * 100).toFixed(0)}%
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#06B6D4] px-2 py-0.5 text-[11px] font-semibold text-white">
                  {row.retrievals}×
                </span>
              </div>
            ))}
            {data.usageTop.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">No retrievals recorded yet.</p>
            )}
          </div>
        </Card>

        {/* ── Consumer top ──────────────────────────────────────────────── */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Top Consumers
          </h3>
          <p className="text-xs text-slate-400">Who uses the memory layer most</p>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {data.consumersTop.map((consumer) => (
              <ConsumerRow
                key={consumer.consumerId}
                consumer={{
                  consumerId: consumer.consumerId,
                  consumerType: consumer.consumerType,
                  consumerLabel: consumer.consumerLabel,
                  usageCount: consumer.usageCount,
                  firstUsedAt: '',
                  lastUsedAt: '',
                }}
              />
            ))}
            {data.consumersTop.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">No consumers yet.</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Trend ───────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">14-Day Trend</h3>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {data.trend.map((point) => (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              title={`${formatDate(point.date)}: ${point.memories} memories`}
            >
              <div
                className="w-full rounded-t bg-[#8B5CF6] transition-all group-hover:bg-[#6D28D9]"
                style={{ height: `${Math.max(4, Math.round((point.memories / maxTrend) * 100))}%` }}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}): React.JSX.Element {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</div>
    </Card>
  );
}
