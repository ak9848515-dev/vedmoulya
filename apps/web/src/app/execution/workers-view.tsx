// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Execution Explorer: Workers View
// EPIC-004 / EI-005 — Enterprise Execution Orchestrator
// The platform worker fleet (research, writing, review, seo, publishing,
// translation, ocr, vision, memory, knowledge, custom) that future runtime
// adapters dispatch work items to. Orchestration metadata only — the fleet
// is described, never driven to run AI from this screen.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading } from '@vedmoulya/ui';
import { Cpu, Activity, Users } from 'lucide-react';
import { useExecutionOrchestratorWorkers } from '../../lib/api-client.js';
import { CAPABILITY_LABELS, WORKER_KIND_LABELS } from './explorer-data.js';
import type { ExecutionWorkerDTO } from '@vedmoulya/execution-orchestrator';

const WORKER_STATUS_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }
> = {
  idle: { label: 'Idle', variant: 'success' },
  busy: { label: 'Busy', variant: 'info' },
  offline: { label: 'Offline', variant: 'danger' },
  paused: { label: 'Paused', variant: 'warning' },
};

export function WorkersView({ userId }: { userId: string }): React.JSX.Element {
  const { data: workers, isLoading, isError } = useExecutionOrchestratorWorkers(userId);

  if (isLoading || !workers) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading worker fleet..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load the worker fleet
          </h2>
        </Card>
      </div>
    );
  }

  const idle = workers.filter((w) => w.status === 'idle').length;
  const busy = workers.filter((w) => w.status === 'busy').length;
  const avgHealth =
    workers.length > 0 ? workers.reduce((sum, w) => sum + w.health, 0) / workers.length : 0;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Fleet stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FleetStat
          label="Workers"
          value={String(workers.length)}
          icon={<Users className="h-5 w-5 text-[#2B5FD9]" />}
          bg="bg-[#EFF4FE] dark:bg-[#1E3A8A]/40"
        />
        <FleetStat
          label="Idle"
          value={String(idle)}
          icon={<Activity className="h-5 w-5 text-[#22C55E]" />}
          bg="bg-[#F0FDF4] dark:bg-[#14532D]/40"
        />
        <FleetStat
          label="Busy"
          value={String(busy)}
          icon={<Cpu className="h-5 w-5 text-[#7C3AED]" />}
          bg="bg-[#F5F3FF] dark:bg-[#4C1D95]/40"
        />
        <FleetStat
          label="Avg Health"
          value={`${(avgHealth * 100).toFixed(0)}%`}
          icon={<Activity className="h-5 w-5 text-[#F59E0B]" />}
          bg="bg-[#FFFBEB] dark:bg-[#78350F]/40"
        />
      </div>

      {/* Fleet grid */}
      {workers.length === 0 ? (
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <p className="text-[13px] text-[#94A3B8]">
            No workers registered. The platform fleet is seeded at runtime by the API gateway
            (createCatalogWorkers — 11 worker kinds).
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workers.map((worker) => (
            <WorkerCard key={worker.workerId} worker={worker} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FleetStat({
  label,
  value,
  icon,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
}): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium truncate">
            {label}
          </p>
          <p className="text-[20px] font-bold text-[#111827] dark:text-[#F8FAFC]">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export function WorkerCard({ worker }: { worker: ExecutionWorkerDTO }): React.JSX.Element {
  const status = WORKER_STATUS_BADGE[worker.status] ?? {
    label: worker.status,
    variant: 'default' as const,
  };
  const loadPct =
    worker.concurrency > 0 ? Math.min(100, (worker.activeTasks / worker.concurrency) * 100) : 0;
  return (
    <Card
      variant="standard"
      padding="md"
      className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 dark:bg-[#1E293B] dark:border-[#334155] flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
            <Cpu className="h-4 w-4 text-[#2B5FD9]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
              {worker.name}
            </h3>
            <p className="text-[11px] text-[#94A3B8] truncate">{worker.workerId}</p>
          </div>
        </div>
        <Badge variant={status.variant} size="sm" className="shrink-0">
          {status.label}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {worker.capabilities.map((cap) => (
          <span
            key={cap}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED] dark:text-[#C4B5FD]"
          >
            {CAPABILITY_LABELS[cap] ?? cap}
          </span>
        ))}
      </div>

      <div className="mt-auto space-y-2">
        <div>
          <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8] mb-1">
            <span>
              Load {worker.activeTasks}/{worker.concurrency}
            </span>
            <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
              {Math.round(worker.health * 100)}% health
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                loadPct >= 90 ? 'bg-[#EF4444]' : loadPct >= 60 ? 'bg-[#F59E0B]' : 'bg-[#22C55E]'
              }`}
              style={{ width: `${String(loadPct)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9] dark:border-[#334155]">
          <span className="text-[11px] text-[#94A3B8]">
            {WORKER_KIND_LABELS[worker.kind] ?? worker.kind}
          </span>
          <span className="text-[11px] text-[#94A3B8]">concurrency {worker.concurrency}</span>
        </div>
      </div>
    </Card>
  );
}
