// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: Dashboard view
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useKnowledgeDashboard } from '../../lib/api-client.js';
import {
  Library,
  FileCheck2,
  Eye,
  Share2,
  BadgeCheck,
  ShieldCheck,
  Gauge,
  Users,
  ArrowRight,
} from 'lucide-react';
import {
  CATEGORY_COLORS,
  LIFECYCLE_COLORS,
  TRUST_BAND_COLORS,
  FALLBACK_COLOR,
  formatDate,
  formatPct,
} from './knowledge-ui.js';
import { KnowledgeCard } from './components.js';

export function DashboardView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useKnowledgeDashboard(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading knowledge registry…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Library className="h-10 w-10" />}
        title="Knowledge registry unavailable"
        description="The Enterprise Knowledge Layer could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const maxCategory = Math.max(1, ...Object.values(data.byCategory));
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.items));

  return (
    <div className="space-y-6">
      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Kpi
          label="Knowledge items"
          value={String(data.totals.items)}
          icon={<Library className="h-5 w-5" />}
          color="#2B5FD9"
        />
        <Kpi
          label="Active"
          value={String(data.totals.active)}
          icon={<FileCheck2 className="h-5 w-5" />}
          color="#22C55E"
        />
        <Kpi
          label="In review"
          value={String(data.totals.review)}
          icon={<Eye className="h-5 w-5" />}
          color="#F59E0B"
          pulse={data.totals.review > 0}
        />
        <Kpi
          label="Validated"
          value={String(data.totals.validated)}
          icon={<BadgeCheck className="h-5 w-5" />}
          color="#0D9488"
        />
        <Kpi
          label="Relationships"
          value={String(data.totals.relationships)}
          icon={<Share2 className="h-5 w-5" />}
          color="#7C3AED"
        />
        <Kpi
          label="Consumers"
          value={String(data.totals.consumers)}
          icon={<Users className="h-5 w-5" />}
          color="#8B5CF6"
        />
        <Kpi
          label="Total reads"
          value={String(data.totals.totalReads)}
          icon={<Eye className="h-5 w-5" />}
          color="#06B6D4"
        />
        <Kpi
          label="Avg trust"
          value={formatPct(data.totals.avgTrust)}
          icon={<ShieldCheck className="h-5 w-5" />}
          color="#EF4444"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Category distribution ─────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Knowledge by Category
          </h3>
          <p className="text-xs text-slate-400">The 14 knowledge domains of VedMoulya</p>
          <div className="mt-4 space-y-3">
            {Object.entries(data.byCategory)
              .filter(([, count]) => count > 0)
              .map(([category, count]) => {
                const color =
                  CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ?? FALLBACK_COLOR;
                return (
                  <div key={category} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium capitalize text-slate-700 dark:text-slate-200">
                          {category}
                        </span>
                        <span className="text-slate-400">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round((count / maxCategory) * 100)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            {data.totals.items === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                No knowledge yet — add items in the Explorer tab.
              </p>
            )}
          </div>
        </Card>

        {/* ── Trust distribution + trend ────────────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Trust Distribution
          </h3>
          <p className="text-xs text-slate-400">How much VedMoulya can rely on each item</p>
          <div className="mt-4 flex h-32 items-end gap-3">
            {data.trustDistribution.map((band) => {
              const maxBand = Math.max(1, ...data.trustDistribution.map((b) => b.count));
              const color = TRUST_BAND_COLORS[band.band] ?? FALLBACK_COLOR;
              return (
                <div
                  key={band.band}
                  className="flex flex-1 flex-col items-center justify-end"
                  title={`${band.band}: ${band.count} items`}
                >
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(4, (band.count / maxBand) * 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                  <span className="mt-1 text-[10px] text-slate-400">{band.band}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Registry growth
            </h4>
            <div className="mt-2 flex h-16 items-end gap-1">
              {data.trend.map((point) => (
                <div
                  key={point.date}
                  className="flex-1 rounded-t bg-[#2B5FD9]/70 transition-all"
                  title={`${point.date}: ${point.items} items (${point.active} active)`}
                  style={{ height: `${Math.max(4, (point.items / maxTrend) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>{formatDate(data.trend[0]?.date)}</span>
              <span>Today</span>
            </div>
          </div>
        </Card>

        {/* ── Lifecycle + validation breakdown ──────────────────────────── */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Knowledge Lifecycle
            </h3>
            <Badge variant="info" className="text-[10px]">
              {data.totals.items} total
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {Object.entries(data.byLifecycle)
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <Badge
                    className={`text-[10px] ${LIFECYCLE_COLORS[status as keyof typeof LIFECYCLE_COLORS] ?? ''}`}
                  >
                    {status.replace('_', ' ')}
                  </Badge>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{count}</span>
                </div>
              ))}
            {data.totals.items === 0 && (
              <p className="text-xs text-slate-400">Nothing stored yet.</p>
            )}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Validation</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(data.byValidation)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <span
                    key={status}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  >
                    {status} · {count}
                  </span>
                ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
              <span>Avg confidence</span>
              <span className="flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400">
                <Gauge className="h-3.5 w-3.5" /> {formatPct(data.totals.avgConfidence)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Review queue banner ─────────────────────────────────────────── */}
      {data.totals.review > 0 && (
        <div className="animate-slide-up flex items-center justify-between rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-[#F59E0B]" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                {data.totals.review} knowledge item{data.totals.review === 1 ? '' : 's'} awaiting
                review
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Knowledge must be reviewed and validated before engines can rely on it. Review them
                in the Explorer tab.
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-[#F59E0B]" />
        </div>
      )}

      {/* ── Top trusted + most consumed + recent ────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {data.topTrusted[0] && (
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4 text-[#22C55E]" /> Most Trusted
            </h3>
            <div className="space-y-3">
              {data.topTrusted.slice(0, 3).map((item) => (
                <KnowledgeCard key={item.knowledgeId} item={item} />
              ))}
            </div>
          </Card>
        )}
        {data.mostConsumed[0] && (
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Users className="h-4 w-4 text-[#8B5CF6]" /> Most Consumed
            </h3>
            <div className="space-y-3">
              {data.mostConsumed.slice(0, 3).map((item) => (
                <KnowledgeCard key={item.knowledgeId} item={item} />
              ))}
            </div>
          </Card>
        )}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Recent Items
          </h3>
          <div className="space-y-2">
            {data.recentItems.slice(0, 5).map((item) => {
              const color = CATEGORY_COLORS[item.category] ?? FALLBACK_COLOR;
              return (
                <div key={item.knowledgeId} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate text-slate-600 dark:text-slate-300">{item.title}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                    {formatPct(item.trust.score)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
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
