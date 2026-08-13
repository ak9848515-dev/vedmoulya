// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Performance view
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// End-to-end and per-engine latency measurement of the health pass. All eleven
// engine probes run in parallel (fan-out), so end-to-end latency equals the
// slowest engine rather than the sum of all engines.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import { useOSPerformance } from '../../lib/api-client.js';
import { Gauge, Zap } from 'lucide-react';
import { ENGINE_COLORS, ENGINE_LABELS, latencyLabel, sprintOf } from './os-ui.js';
import type { OSPerformanceMetric } from '@vedmoulya/os-intelligence';

export function PerformanceView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useOSPerformance(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Measuring engine latency…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Gauge className="h-10 w-10" />}
        title="Performance metrics unavailable"
        description="The OS performance probe could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const maxAvg = Math.max(1, ...data.perEngine.map((m) => m.avgLatencyMs));
  const maxTotal = Math.max(1, ...data.perEngine.map((m) => m.totalLatencyMs));

  return (
    <div className="space-y-6">
      {/* ── End-to-end ─────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Zap className="h-4 w-4 text-[#2B5FD9]" />
              End-to-End Health Pass
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              All {data.perEngine.length} engine probes run in parallel — end-to-end latency is the
              slowest engine, not the sum.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="text-right">
              <div className="text-[11px] text-slate-400">End-to-end</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {latencyLabel(data.endToEndLatencyMs)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-400">Port calls</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {data.totalCalls}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Per-engine latency ─────────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Per-Engine Latency
        </h3>
        <p className="text-xs text-slate-400">Average port latency per engine probe (ms).</p>
        <div className="mt-4 space-y-3">
          {data.perEngine.map((metric: OSPerformanceMetric) => {
            const color = ENGINE_COLORS[metric.engine] ?? '#64748B';
            return (
              <div key={metric.engine} className="flex items-center gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {sprintOf(metric.engine)}
                </span>
                <div className="w-28 shrink-0 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                  {ENGINE_LABELS[metric.engine]}
                </div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(2, (metric.avgLatencyMs / maxAvg) * 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <div className="w-16 shrink-0 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {latencyLabel(metric.avgLatencyMs)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Cumulative call cost ───────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Gauge className="h-4 w-4 text-[#06B6D4]" />
          Cumulative Port Time
        </h3>
        <p className="text-xs text-slate-400">
          Total measured latency per engine across the pass — the fan-out sum, informational only.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {data.perEngine.map((metric: OSPerformanceMetric) => {
            const color = ENGINE_COLORS[metric.engine] ?? '#64748B';
            return (
              <div
                key={`total-${metric.engine}`}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {ENGINE_LABELS[metric.engine]}
                  </span>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                  {latencyLabel(metric.totalLatencyMs)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {metric.calls} call{metric.calls === 1 ? '' : 's'} · avg{' '}
                  {latencyLabel(metric.avgLatencyMs)}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (metric.totalLatencyMs / maxTotal) * 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
