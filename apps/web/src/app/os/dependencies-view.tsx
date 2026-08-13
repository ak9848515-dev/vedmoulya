// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Dependencies view
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The engine dependency matrix: the package build graph (the acyclicity gate —
// no circular dependencies) and the runtime consultation graph (the
// integration matrix of who consults whom through narrow port contracts).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed Record lookups keyed by the closed
   OSEngineId union (ENGINE_COLORS[engine], ENGINE_LABELS[target],
   data.matrix[engine]) — no runtime attacker-controlled keys. */

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useOSDependencyGraph } from '../../lib/api-client.js';
import { Share2, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ENGINE_COLORS, ENGINE_LABELS, sprintOf } from './os-ui.js';
import type { OSDependencyEdge, OSEngineId } from '@vedmoulya/os-intelligence';

export function DependenciesView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useOSDependencyGraph(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Building the dependency matrix…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Share2 className="h-10 w-10" />}
        title="Dependency graph unavailable"
        description="The OS dependency matrix could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Gate summary ───────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Share2 className="h-4 w-4 text-[#2B5FD9]" />
              Engine Dependency Matrix
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Package build graph (the acyclicity gate) + runtime consultation graph (who consults
              whom).
            </p>
          </div>
          <Badge
            variant={data.acyclic ? 'success' : 'danger'}
            className="flex items-center gap-1 text-[11px]"
          >
            {data.acyclic ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {data.acyclic ? 'No circular dependencies' : 'Circular dependencies found'}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Engines" value={String(data.nodes.length)} color="#2B5FD9" />
          <MiniStat
            label="Package edges"
            value={String(data.packageEdges.length)}
            color="#8B5CF6"
          />
          <MiniStat
            label="Consultation edges"
            value={String(data.consultationEdges.length)}
            color="#06B6D4"
          />
          <MiniStat
            label="Package cycles"
            value={String(data.packageCycles.length)}
            color="#22C55E"
          />
        </div>
      </Card>

      {/* ── Package build graph ────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Package Build Graph
          </h3>
          <Badge variant="info" className="text-[10px]">
            acyclicity gate
          </Badge>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Engine-to-engine workspace dependencies — the real `@vedmoulya/*` imports. Must stay
          acyclic.
        </p>
        <div className="mt-4 space-y-2">
          {data.packageEdges.map((edge) => (
            <EdgeRow key={`package-${edge.from}-${edge.to}`} edge={edge} />
          ))}
        </div>
        {data.packageEdges.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">No package edges.</p>
        )}
      </Card>

      {/* ── Runtime consultation graph ─────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Runtime Consultation Matrix
          </h3>
          <Badge variant="info" className="text-[10px]">
            integration matrix
          </Badge>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Who consults whom through narrow port contracts — the integration statement of the
          operating system.
        </p>
        <div className="mt-4 space-y-2">
          {data.consultationEdges.map((edge) => (
            <EdgeRow key={`consult-${edge.from}-${edge.to}`} edge={edge} />
          ))}
        </div>
        {data.consultationEdges.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">No consultation edges.</p>
        )}
      </Card>

      {/* ── Consultation map (per engine) ──────────────────────────────── */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Who Consults Whom
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Every engine's consultation fan-out — cycles here are expected and informational in an
          integrated OS.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.nodes.map((engine: OSEngineId) => {
            const targets = data.matrix[engine];
            return (
              <div
                key={engine}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold text-white"
                    style={{ backgroundColor: ENGINE_COLORS[engine] ?? '#64748B' }}
                  >
                    {sprintOf(engine)}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {ENGINE_LABELS[engine]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {targets.length === 0 && (
                    <span className="text-[10px] text-slate-400">no engine consultations</span>
                  )}
                  {targets.map((target) => (
                    <span
                      key={target}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <ArrowRight className="h-2.5 w-2.5" />
                      {ENGINE_LABELS[target]}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function EdgeRow({ edge }: { edge: OSDependencyEdge }): React.JSX.Element {
  const fromColor = ENGINE_COLORS[edge.from] ?? '#64748B';
  const toColor = ENGINE_COLORS[edge.to] ?? '#64748B';
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
          style={{ backgroundColor: fromColor }}
        >
          {sprintOf(edge.from)}
        </span>
        <span className="shrink-0 text-xs font-medium text-slate-700 dark:text-slate-200">
          {ENGINE_LABELS[edge.from]}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
          style={{ backgroundColor: toColor }}
        >
          {sprintOf(edge.to)}
        </span>
        <span className="shrink-0 text-xs font-medium text-slate-700 dark:text-slate-200">
          {ENGINE_LABELS[edge.to]}
        </span>
      </div>
      <span className="hidden truncate text-[11px] text-slate-400 md:block">{edge.reason}</span>
      <span className="shrink-0 text-[10px] font-medium capitalize text-slate-400">
        {edge.kind}
      </span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-0.5 text-xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
