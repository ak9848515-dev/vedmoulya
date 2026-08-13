// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: Dashboard view
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import { useMemoryDashboard } from '../../lib/api-client.js';
import {
  Brain,
  Activity,
  Archive,
  Clock,
  Share2,
  BookMarked,
  Users,
  RotateCw,
  Gauge,
  ShieldCheck,
  Timer,
  Flame,
} from 'lucide-react';
import { TYPE_COLORS, FALLBACK_COLOR, formatDate, formatPct } from './memory-ui.js';
import { MemoryCard } from './components.js';

export function DashboardView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useMemoryDashboard(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading memory registry…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Brain className="h-10 w-10" />}
        title="Memory registry unavailable"
        description="The Enterprise Memory Layer could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const maxType = Math.max(1, ...Object.values(data.byType));
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.memories));

  return (
    <div className="space-y-6">
      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Kpi
          label="Memories"
          value={String(data.totals.memories)}
          icon={<Brain className="h-5 w-5" />}
          color="#2B5FD9"
        />
        <Kpi
          label="Active"
          value={String(data.totals.active)}
          icon={<Activity className="h-5 w-5" />}
          color="#22C55E"
        />
        <Kpi
          label="Archived"
          value={String(data.totals.archived)}
          icon={<Archive className="h-5 w-5" />}
          color="#64748B"
        />
        <Kpi
          label="Expired"
          value={String(data.totals.expired)}
          icon={<Clock className="h-5 w-5" />}
          color="#EF4444"
          pulse={data.totals.expired > 0}
        />
        <Kpi
          label="Relationships"
          value={String(data.totals.relationships)}
          icon={<Share2 className="h-5 w-5" />}
          color="#7C3AED"
        />
        <Kpi
          label="Citations"
          value={String(data.totals.citations)}
          icon={<BookMarked className="h-5 w-5" />}
          color="#0D9488"
        />
        <Kpi
          label="Consumers"
          value={String(data.totals.consumers)}
          icon={<Users className="h-5 w-5" />}
          color="#8B5CF6"
        />
        <Kpi
          label="Retrievals"
          value={String(data.totals.totalRetrievals)}
          icon={<RotateCw className="h-5 w-5" />}
          color="#06B6D4"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Type distribution ─────────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Memory by Type
          </h3>
          <p className="text-xs text-slate-400">The 14 memory classes of VedMoulya</p>
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
            {data.totals.memories === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                No memories yet — capture your first one in the Explorer tab.
              </p>
            )}
          </div>
        </Card>

        {/* ── Trend + quality scores ────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Memory Growth Trend
          </h3>
          <p className="text-xs text-slate-400">Captured memories over the last 14 days</p>
          <div className="mt-4 flex h-32 items-end gap-1.5">
            {data.trend.map((point) => (
              <div
                key={point.date}
                className="group relative flex flex-1 flex-col items-center justify-end"
                title={`${formatDate(point.date)}: ${point.memories} memories`}
              >
                <div
                  className="w-full rounded-t bg-[#2B5FD9] transition-all group-hover:bg-[#1E46B8]"
                  style={{
                    height: `${Math.max(4, Math.round((point.memories / maxTrend) * 100))}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/40">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Gauge className="h-3.5 w-3.5" /> Avg importance
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {data.totals.avgImportance.toFixed(2)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/40">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Avg confidence
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {formatPct(data.totals.avgConfidence)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/40">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Timer className="h-3.5 w-3.5" /> Avg recency
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {formatPct(data.totals.avgRecency)}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Retention countdown ───────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Retention Exposure
          </h3>
          <p className="text-xs text-slate-400">Memories per retention policy (TTL watch)</p>
          <div className="mt-4 space-y-3">
            {data.retentionCountdown.map((row) => {
              const policy =
                row.policy === 'ephemeral'
                  ? '#EF4444'
                  : row.policy === 'short_term'
                    ? '#F97316'
                    : row.policy === 'medium_term'
                      ? '#F59E0B'
                      : row.policy === 'long_term'
                        ? '#2B5FD9'
                        : '#22C55E';
              const maxPolicy = Math.max(1, ...data.retentionCountdown.map((r) => r.count));
              return (
                <div key={row.policy} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: policy }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium capitalize text-slate-700 dark:text-slate-200">
                        {row.policy.replace('_', ' ')}
                      </span>
                      <span className="text-slate-400">{row.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round((row.count / maxPolicy) * 100)}%`,
                          backgroundColor: policy,
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

      {/* ── Importance distribution ─────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Importance Distribution
        </h3>
        <p className="text-xs text-slate-400">
          What matters most to VedMoulya&apos;s future decisions
        </p>
        <div className="mt-4 flex h-28 items-end gap-4">
          {data.importanceDistribution.map((band) => {
            const maxBand = Math.max(1, ...data.importanceDistribution.map((b) => b.count));
            const color =
              band.band === 'high' ? '#22C55E' : band.band === 'medium' ? '#F59E0B' : '#EF4444';
            return (
              <div
                key={band.band}
                className="flex flex-1 flex-col items-center justify-end"
                title={`${band.band}: ${band.count}`}
              >
                <span className="mb-1 text-xs font-semibold text-slate-500">{band.count}</span>
                <div
                  className="w-full max-w-16 rounded-t transition-all"
                  style={{
                    height: `${Math.round((band.count / maxBand) * 100)}%`,
                    backgroundColor: color,
                  }}
                />
                <span className="mt-1 text-[11px] capitalize text-slate-400">{band.band}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Recent / important / retrieved ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#2B5FD9]" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Recent Memories
            </h3>
          </div>
          {data.recentMemories.map((item) => (
            <MemoryCard key={item.memoryId} item={item} />
          ))}
          {data.recentMemories.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-xs text-slate-400 dark:border-slate-600">
              Nothing captured yet.
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-[#F97316]" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Most Important
            </h3>
          </div>
          {data.mostImportant.map((item) => (
            <MemoryCard key={item.memoryId} item={item} />
          ))}
          {data.mostImportant.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-xs text-slate-400 dark:border-slate-600">
              Nothing captured yet.
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <RotateCw className="h-4 w-4 text-[#06B6D4]" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Most Retrieved
            </h3>
          </div>
          {data.mostRetrieved.map((item) => (
            <MemoryCard key={item.memoryId} item={item} />
          ))}
          {data.mostRetrieved.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-xs text-slate-400 dark:border-slate-600">
              Nothing retrieved yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

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
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div
        className={`mt-1 text-xl font-bold text-slate-900 dark:text-white ${pulse ? 'animate-pulse' : ''}`}
        style={{ color: pulse ? color : undefined }}
      >
        {value}
      </div>
    </Card>
  );
}
