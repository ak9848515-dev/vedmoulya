// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Diagnostics view
// APP-001 — Post-V1 Application Platform Layer
// Fabric health + diagnostics: entity/relationship counts, personal vs
// business split, permission coverage, average confidence, per-type and
// per-source distribution, and the consumption model of the fabric.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- false-positive on the
   closed-set entity lookups in this view (same pattern as memory/os views). */

'use client';

import React from 'react';
import { Card, Loading, EmptyState, Badge } from '@vedmoulya/ui';
import { useContextFabricHealth } from '../../lib/api-client.js';
import { Stethoscope, CheckCircle2, Info } from 'lucide-react';
import { Kpi } from './components.js';
import { ENTITY_LABELS, pct } from './fabric-ui.js';

export function DiagnosticsView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useContextFabricHealth(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Running fabric diagnostics…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Stethoscope className="h-10 w-10" />}
        title="Diagnostics unavailable"
        description="The fabric health probe could not be reached."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const checks = [
    {
      label: 'Personal intelligence graph',
      ok: data.personalCount > 0,
      detail: `${data.personalCount} personal entities`,
    },
    {
      label: 'Business / enterprise context graph',
      ok: data.businessCount > 0,
      detail: `${data.businessCount} business entities`,
    },
    {
      label: 'Permission-aware context',
      ok: data.permissionCoverage >= 0.9,
      detail: `${pct(data.permissionCoverage)} entities carry a complete access model`,
    },
    {
      label: 'Provenance quality',
      ok: data.avgConfidence >= 0.8,
      detail: `average confidence ${pct(data.avgConfidence)}`,
    },
    {
      label: 'Relationship density',
      ok: data.relationshipCount > 0,
      detail: `${data.relationshipCount} typed graph edges`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Entities"
          value={String(data.entityCount)}
          color="#2B5FD9"
          sub={`${data.personalCount} personal · ${data.businessCount} business`}
        />
        <Kpi
          label="Relationships"
          value={String(data.relationshipCount)}
          color="#7C3AED"
          sub="typed edges"
        />
        <Kpi
          label="Permission coverage"
          value={pct(data.permissionCoverage)}
          color="#22C55E"
          sub="complete access models"
        />
        <Kpi
          label="Avg confidence"
          value={pct(data.avgConfidence)}
          color="#F59E0B"
          sub="provenance quality"
        />
      </div>

      <Card className="p-5 dark:bg-[#1E293B]">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-[#2B5FD9]" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Fabric health checks
          </h2>
        </div>
        <div className="mt-4 space-y-2">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700"
            >
              {check.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22C55E]" />
              ) : (
                <Info className="h-4 w-4 shrink-0 text-[#F59E0B]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {check.label}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{check.detail}</p>
              </div>
              <Badge
                className={
                  check.ok
                    ? 'bg-[#F0FDF4] text-[#166534] dark:bg-[#14532D] dark:text-[#BBF7D0]'
                    : 'bg-[#FFFBEB] text-[#854D0E] dark:bg-[#451A03] dark:text-[#FDE68A]'
                }
              >
                {check.ok ? 'PASS' : 'INFO'}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5 dark:bg-[#1E293B]">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Per-type distribution
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(data.countByType).map(([type, count]) => (
              <Badge
                key={type}
                className="bg-[#EEF2FF] text-[#2B5FD9] dark:bg-[#1E3A8A] dark:text-[#BFDBFE]"
              >
                {ENTITY_LABELS[type] ?? type}: {count}
              </Badge>
            ))}
          </div>
        </Card>
        <Card className="p-5 dark:bg-[#1E293B]">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Per-source distribution
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(data.countBySource).map(([source, count]) => (
              <Badge
                key={source}
                className="bg-[#F5F3FF] text-[#7C3AED] dark:bg-[#4C1D95] dark:text-[#DDD6FE]"
              >
                {source}: {count}
              </Badge>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
