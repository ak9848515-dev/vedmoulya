// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Learning Intelligence: Analytics view
// EPIC-004 / EI-007 — Enterprise Learning Intelligence Platform
// Trend charts, category statistics, and per-category learning reports.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, EmptyState, Select } from '@vedmoulya/ui';
import {
  useLearningIntelligenceAnalytics,
  useLearningIntelligenceReports,
} from '../../lib/api-client.js';
import type { LearningCategory } from '@vedmoulya/learning-intelligence';
import { BarChart3, TrendingUp, FileText } from 'lucide-react';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatPct,
  formatUsd,
  formatMs,
  formatDate,
} from './learning-ui.js';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

export function AnalyticsView({ userId }: { userId: string }): React.JSX.Element {
  const [category, setCategory] = useState('');
  const categoryParam = (category || undefined) as LearningCategory | undefined;
  const { data, isLoading, isError, refetch } = useLearningIntelligenceAnalytics(
    userId,
    categoryParam,
  );
  const { data: reports } = useLearningIntelligenceReports(userId, categoryParam);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Computing learning analytics…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-10 w-10" />}
        title="Analytics unavailable"
        description="Learning analytics could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const maxTrend = Math.max(1, ...data.trend.map((t) => t.events));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-48">
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
            }}
            options={CATEGORY_OPTIONS}
          />
        </div>
        <div className="flex gap-6 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" /> ≥70% success
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> 50–70%
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#EF4444]" /> &lt;50%
          </span>
        </div>
      </div>

      {/* ── Trend chart ─────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[#2B5FD9]" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              14-Day Trend
            </h3>
            <p className="text-xs text-slate-400">Events per day colored by daily success rate</p>
          </div>
        </div>
        <div className="mt-4 flex h-48 items-end gap-1">
          {data.trend.map((point) => (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
            >
              <div className="pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block dark:bg-white dark:text-slate-900">
                {point.date}: {point.events} event(s) · {formatPct(point.successRate)}
              </div>
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
              <div className="mt-1 text-[9px] text-slate-300 dark:text-slate-600">
                {point.date.slice(8, 10)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Category stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Object.entries(data.byCategory)
          .filter(([, stats]) => stats.events > 0)
          .map(([categoryKey, stats]) => {
            const color = CATEGORY_COLORS[categoryKey as keyof typeof CATEGORY_COLORS] ?? '#64748B';
            return (
              <Card key={categoryKey} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {CATEGORY_LABELS[categoryKey as keyof typeof CATEGORY_LABELS] ?? categoryKey}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {stats.events}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span>{formatPct(stats.successRate)} success</span>
                  <span>{stats.failures} failed</span>
                  <span>avg {formatUsd(stats.avgCostUsd)}</span>
                  <span>{stats.models} model(s)</span>
                </div>
              </Card>
            );
          })}
      </div>

      {/* ── Reports ─────────────────────────────────────────────────────── */}
      {reports && reports.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <FileText className="h-4 w-4 text-[#2B5FD9]" /> Learning Reports
          </h3>
          {reports.map((report) => {
            const color = CATEGORY_COLORS[report.category] ?? '#64748B';
            return (
              <Card key={report.reportId} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {report.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Badge variant="info">{report.totalEvents} events</Badge>
                    <Badge
                      variant={
                        report.successRate >= 0.8
                          ? 'success'
                          : report.successRate >= 0.6
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {formatPct(report.successRate)} success
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{report.summary}</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Avg cost
                    </span>{' '}
                    {formatUsd(report.avgCostUsd)} ·{' '}
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      latency
                    </span>{' '}
                    {formatMs(report.avgLatencyMs)} ·{' '}
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      quality
                    </span>{' '}
                    {formatPct(report.avgQuality)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <span className="font-semibold text-[#22C55E]">Top:</span>{' '}
                    {report.topEntities
                      .slice(0, 2)
                      .map((t) => t.entityLabel)
                      .join(', ') || '—'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <span className="font-semibold text-red-500">At risk:</span>{' '}
                    {report.atRiskEntities
                      .slice(0, 2)
                      .map((t) => t.entityLabel)
                      .join(', ') || '—'}
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-slate-300 dark:text-slate-500">
                  {formatDate(report.period.start)} → {formatDate(report.period.end)}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
