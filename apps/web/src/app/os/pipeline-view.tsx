// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Pipeline view
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The 15-stage end-to-end event flow — Goal → Project → Task Planning →
// Capability → Knowledge → Memory → Provider → Context → Decision → Strategy →
// Execution Graph → Execution Session → Learning → Knowledge Update → Memory
// Update. Every stage is validated against the owning engine's live data.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useOSPipelineHealth } from '../../lib/api-client.js';
import { Workflow, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { latencyLabel } from './os-ui.js';
import { StageRow } from './components.js';

export function PipelineView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useOSPipelineHealth(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Validating the event flow…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Workflow className="h-10 w-10" />}
        title="Pipeline validation unavailable"
        description="The OS pipeline validator could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Pipeline summary ───────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Workflow className="h-4 w-4 text-[#2B5FD9]" />
              15-Stage Event Flow
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Goal → … → Memory Update — every stage owned by exactly one engine and validated
              against its live registry data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                data.overallStatus === 'ready'
                  ? 'success'
                  : data.overallStatus === 'degraded'
                    ? 'warning'
                    : 'danger'
              }
              className="text-[11px]"
            >
              {data.overallStatus}
            </Badge>
            <Badge variant="info" className="text-[11px]">
              {latencyLabel(data.totalLatencyMs)} total
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <PipelineStat
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Passed"
            value={data.passedStages}
            color="#22C55E"
          />
          <PipelineStat
            icon={<MinusCircle className="h-4 w-4" />}
            label="Not started"
            value={data.notStartedStages}
            color="#94A3B8"
          />
          <PipelineStat
            icon={<XCircle className="h-4 w-4" />}
            label="Failed"
            value={data.failedStages}
            color="#EF4444"
          />
          <PipelineStat
            icon={<Workflow className="h-4 w-4" />}
            label="Stages"
            value={data.stages.length}
            color="#2B5FD9"
          />
        </div>
      </Card>

      {/* ── Stage flow ─────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="space-y-2">
          {data.stages.map((stage, index) => (
            <StageRow key={stage.stage} stage={stage} index={index} />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          Stages are validated in the canonical event-flow order. Not-started stages are tolerated
          (kept in the pipeline) but keep the overall status “degraded” — it becomes “ready” only
          when every stage passes against live engine data.
        </p>
      </Card>
    </div>
  );
}

function PipelineStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
