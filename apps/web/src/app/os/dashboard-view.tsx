// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Dashboard view
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The overall health pass: OS health score, engine status, repository
// readiness, cross-engine integration pairs and the latest snapshot.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useOSDashboard } from '../../lib/api-client.js';
import { MonitorCog, Boxes, GitBranch, ShieldCheck, Activity } from 'lucide-react';
import {
  ENGINE_COLORS,
  ENGINE_LABELS,
  formatDate,
  latencyLabel,
  scoreColor,
  sprintOf,
} from './os-ui.js';
import { EngineRow, ScoreGauge, SnapshotRow, Kpi } from './components.js';
import type { OSCrossEnginePair, OSRepositoryStatus } from '@vedmoulya/os-intelligence';

export function DashboardView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useOSDashboard(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Scanning the operating system…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<MonitorCog className="h-10 w-10" />}
        title="Operating System unavailable"
        description="The OS integration layer could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const health = data.health;
  const healthy = health.engines.filter((e) => e.status === 'healthy').length;
  const degraded = health.engines.filter((e) => e.status === 'degraded').length;
  const unhealthy = health.engines.filter((e) => e.status === 'unhealthy').length;

  return (
    <div className="space-y-6">
      {/* ── Health score + KPI row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ScoreGauge score={health.overallScore} status={health.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <Kpi
            label="Engines"
            value={String(health.engines.length)}
            color="#2B5FD9"
            sub="11 Enterprise Intelligence engines"
          />
          <Kpi
            label="Healthy"
            value={String(healthy)}
            color="#22C55E"
            sub={`${degraded} degraded · ${unhealthy} unhealthy`}
            pulse={unhealthy > 0}
          />
          <Kpi
            label="Pipeline"
            value={health.pipeline.overallStatus}
            color={health.pipeline.valid ? '#22C55E' : '#F59E0B'}
            sub={`${health.pipeline.passedStages}/${health.pipeline.stages.length} stages passed`}
          />
          <Kpi
            label="Dependency graph"
            value={health.dependencies.acyclic ? 'Acyclic' : 'Cycles'}
            color={health.dependencies.acyclic ? '#22C55E' : '#EF4444'}
            sub={`${health.dependencies.consultationEdges.length} consultation edges`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Engine status ────────────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Boxes className="h-4 w-4 text-[#2B5FD9]" />
              Engine Status
            </h3>
            <Badge variant="info" className="text-[10px]">
              checked {formatDate(health.checkedAt)}
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Every engine probed through its narrow port contract, latency measured.
          </p>
          <div className="mt-4 space-y-3">
            {health.engines.map((engine) => (
              <EngineRow key={engine.engine} engine={engine} />
            ))}
          </div>
        </Card>

        {/* ── Repository readiness + cross-engine pairs ────────────────── */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <GitBranch className="h-4 w-4 text-[#8B5CF6]" />
              Repository Status
            </h3>
            <p className="text-xs text-slate-400">Production Postgres repositories</p>
            <div className="mt-3 space-y-2">
              {health.repositories.map((repo: OSRepositoryStatus) => (
                <RepositoryRow key={repo.engine} repo={repo} />
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4 text-[#22C55E]" />
              Cross-Engine Integration
            </h3>
            <p className="text-xs text-slate-400">The nine validated pairs</p>
            <div className="mt-3 space-y-2">
              {health.crossEngine.map((pair: OSCrossEnginePair) => (
                <CrossEngineRow key={pair.pair} pair={pair} />
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Diagnostics summary ───────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Activity className="h-4 w-4 text-[#06B6D4]" />
              Diagnostics
            </h3>
            <p className="text-xs text-slate-400">
              {health.diagnostics.passed} passed · {health.diagnostics.warnings} warnings ·{' '}
              {health.diagnostics.critical} critical — score{' '}
              {Math.round(health.diagnostics.healthScore)}/100
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-[#22C55E]/10 px-2.5 py-1 text-[11px] font-semibold text-[#22C55E]">
              {health.diagnostics.passed} passed
            </span>
            <span className="rounded-full bg-[#F59E0B]/10 px-2.5 py-1 text-[11px] font-semibold text-[#F59E0B]">
              {health.diagnostics.warnings} warnings
            </span>
            <span className="rounded-full bg-[#EF4444]/10 px-2.5 py-1 text-[11px] font-semibold text-[#EF4444]">
              {health.diagnostics.critical} critical
            </span>
          </div>
        </div>
      </Card>

      {/* ── Latest snapshot ───────────────────────────────────────────── */}
      {data.latestSnapshot && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: scoreColor(data.latestSnapshot.overallScore) }}
            />
            Latest Health Snapshot
          </h3>
          <SnapshotRow snapshot={data.latestSnapshot} />
        </div>
      )}

      {/* ── End-to-end latency ────────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: scoreColor(
                Math.max(0, Math.min(100, 100 - health.performance.endToEndLatencyMs / 10)),
              ),
            }}
          />
          End-to-End Health Pass
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          All eleven engine probes run in parallel — end-to-end latency equals the slowest engine,
          not the sum.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div>
            <div className="text-[11px] text-slate-400">Total</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {latencyLabel(health.performance.endToEndLatencyMs)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Port calls</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {health.performance.totalCalls}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Cross-engine pairs</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {health.crossEngine.length}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function RepositoryRow({ repo }: { repo: OSRepositoryStatus }): React.JSX.Element {
  const color = ENGINE_COLORS[repo.engine] ?? '#64748B';
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {sprintOf(repo.engine)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
          {ENGINE_LABELS[repo.engine]}
        </div>
        <div className="truncate text-[10px] text-slate-400">{repo.table}</div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          repo.status === 'ready' && repo.persisted
            ? 'bg-[#22C55E]/10 text-[#22C55E]'
            : 'bg-[#EF4444]/10 text-[#EF4444]'
        }`}
      >
        {repo.status === 'ready' && repo.persisted ? 'persisted' : 'missing'}
      </span>
    </div>
  );
}

function CrossEngineRow({ pair }: { pair: OSCrossEnginePair }): React.JSX.Element {
  const color =
    pair.status === 'validated' ? '#22C55E' : pair.status === 'not_checked' ? '#94A3B8' : '#EF4444';
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
        {pair.pair}
      </div>
      <span className="shrink-0 text-[10px] font-medium capitalize" style={{ color }}>
        {pair.status.replace('_', ' ')}
      </span>
    </div>
  );
}
