// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System Dashboard: shared presentational
// components
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// StatusBadge, ScoreGauge, Kpi, EngineRow, StageRow, FindingRow, SnapshotRow —
// the shared building blocks for every OS dashboard view.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed Record lookups keyed by the closed
   OSEngineHealthStatus / OSPipelineStageStatus / OSDiagnosticSeverity /
   OSEngineId unions (STATUS_STYLES[status], ENGINE_COLORS[engine], …) — no
   runtime attacker-controlled keys. */

import React from 'react';
import type {
  OSDiagnosticFinding,
  OSEngineStatus,
  OSHealthSnapshot,
  OSPipelineStage,
} from '@vedmoulya/os-intelligence';
import {
  ENGINE_COLORS,
  ENGINE_LABELS,
  SEVERITY_STYLES,
  STAGE_STYLES,
  STATUS_STYLES,
  formatDate,
  formatTime,
  latencyLabel,
  scoreColor,
  sprintOf,
} from './os-ui.js';

// ── Status badge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: OSEngineStatus['status'] }): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export function StageBadge({ status }: { status: OSPipelineStage['status'] }): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLES[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export function SeverityBadge({
  severity,
}: {
  severity: OSDiagnosticFinding['severity'];
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}

// ── KPI tile ─────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string;
  color: string;
  sub?: string;
  pulse?: boolean;
}

export function Kpi({ label, value, color, sub, pulse }: KpiProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold" style={{ color }}>
          {value}
        </span>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: color }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
          </span>
        )}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

// ── Overall score gauge ──────────────────────────────────────────────────────

export function ScoreGauge({
  score,
  status,
}: {
  score: number;
  status: string;
}): React.JSX.Element {
  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="flex items-center gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            strokeWidth="10"
            className="stroke-slate-100 dark:stroke-slate-800"
          />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {Math.round(score)}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            health
          </span>
        </div>
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Operating System
        </div>
        <div className="text-xl font-bold capitalize text-slate-900 dark:text-white">{status}</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Engines · Dependencies · Pipeline · Diagnostics
        </div>
      </div>
    </div>
  );
}

// ── Engine row ───────────────────────────────────────────────────────────────

export function EngineRow({ engine }: { engine: OSEngineStatus }): React.JSX.Element {
  const color = ENGINE_COLORS[engine.engine] ?? '#64748B';
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {sprintOf(engine.engine)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {engine.name}
        </div>
        <div className="truncate text-[11px] text-slate-400">
          {engine.packageName} · {engine.engine}
        </div>
      </div>
      <div className="hidden text-right md:block">
        <div className="text-[11px] text-slate-400">latency</div>
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {latencyLabel(engine.latencyMs)}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[11px] text-slate-400">data</div>
        <div className="max-w-40 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
          {engine.dataSummary}
        </div>
      </div>
      <StatusBadge status={engine.status} />
    </div>
  );
}

// ── Pipeline stage row ───────────────────────────────────────────────────────

export function StageRow({
  stage,
  index,
}: {
  stage: OSPipelineStage;
  index: number;
}): React.JSX.Element {
  const color = ENGINE_COLORS[stage.engine] ?? '#64748B';
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
          {stage.label}
        </div>
        <div className="truncate text-[11px] text-slate-400">
          {ENGINE_LABELS[stage.engine]} · {stage.detail}
        </div>
      </div>
      <span className="hidden text-[11px] text-slate-400 sm:block">
        {latencyLabel(stage.latencyMs)}
      </span>
      <StageBadge status={stage.status} />
    </div>
  );
}

// ── Diagnostic finding row ───────────────────────────────────────────────────

export function FindingRow({ finding }: { finding: OSDiagnosticFinding }): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <SeverityBadge severity={finding.severity} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-800 dark:text-slate-200">{finding.message}</div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          {finding.category} {finding.engine ? `· ${finding.engine}` : ''} · {finding.id}
        </div>
      </div>
    </div>
  );
}

// ── Snapshot row ─────────────────────────────────────────────────────────────

export function SnapshotRow({ snapshot }: { snapshot: OSHealthSnapshot }): React.JSX.Element {
  const color = scoreColor(snapshot.overallScore);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {Math.round(snapshot.overallScore)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium capitalize text-slate-800 dark:text-slate-200">
          {snapshot.status} · {snapshot.engineCount} engines
        </div>
        <div className="text-[11px] text-slate-400">
          {formatDate(snapshot.checkedAt)} · pipeline {snapshot.pipelineStatus} · acyclic{' '}
          {snapshot.dependencyAcyclic ? '✓' : '✗'} · {snapshot.passedChecks} checks
        </div>
      </div>
      <div className="flex gap-3 text-center">
        <div>
          <div className="text-[10px] text-slate-400">healthy</div>
          <div className="text-xs font-semibold text-[#22C55E]">{snapshot.healthyCount}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">warnings</div>
          <div className="text-xs font-semibold text-[#F59E0B]">{snapshot.warningFindings}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">critical</div>
          <div className="text-xs font-semibold text-[#EF4444]">{snapshot.criticalFindings}</div>
        </div>
      </div>
      <span className="text-[11px] text-slate-400">{formatTime(snapshot.checkedAt)}</span>
    </div>
  );
}
