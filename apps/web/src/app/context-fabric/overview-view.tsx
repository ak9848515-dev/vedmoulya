// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Overview view
// APP-001 — Post-V1 Application Platform Layer
// Fabric health at a glance: entity/relationship counts, personal vs
// business split, permission coverage, average confidence and sources.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- false-positive on the
   closed-set entity lookups in this view (same pattern as memory/os views). */

'use client';

import React from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import {
  useContextFabricHealth,
  useContextFabricSources,
  useContextFabricPersonalGraph,
} from '../../lib/api-client.js';
import { User, Boxes, ShieldCheck, TrendingUp, Database } from 'lucide-react';
import { Kpi, EntityIcon } from './components.js';
import { ENTITY_LABELS, pct } from './fabric-ui.js';

export function OverviewView({ userId }: { userId: string }): React.JSX.Element {
  const health = useContextFabricHealth(userId);
  const sources = useContextFabricSources(userId);
  const personal = useContextFabricPersonalGraph(userId);

  if (health.isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Scanning the context fabric…" size="lg" />
      </div>
    );
  }

  if (health.isError || !health.data) {
    return (
      <EmptyState
        icon={<User className="h-10 w-10" />}
        title="Context Fabric unavailable"
        description="The fabric layer could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void health.refetch() }}
      />
    );
  }

  const data = health.data;
  const topTypes = Object.entries(data.countByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

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
          sub="typed graph edges"
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5 dark:bg-[#1E293B]">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-[#2B5FD9]" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Entity distribution
            </h2>
          </div>
          <div className="mt-4 space-y-2.5">
            {topTypes.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <EntityIcon type={type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {ENTITY_LABELS[type] ?? type}
                    </span>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      {count}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-1.5 rounded-full bg-[#2B5FD9]"
                      style={{ width: `${(count / data.entityCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 dark:bg-[#1E293B]">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Context sources
            </h2>
          </div>
          <div className="mt-4 space-y-2">
            {(sources.data ?? []).map((source) => (
              <div
                key={source.source}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"
              >
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {source.source}
                </span>
                <span className="font-bold text-[#2B5FD9]">{source.entityCount}</span>
              </div>
            ))}
            {!sources.data && <p className="text-xs text-slate-400">Loading sources…</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5 dark:bg-[#1E293B]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#22C55E]" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Permission-aware retrieval
            </h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Identity → permission evaluation → eligible sources → retrieval → filtering → ranking →
            context package. Every entity carries a complete access model (owner, scope, grants) and
            the fabric never returns context the requester may not access.
          </p>
        </Card>
        <Card className="p-5 dark:bg-[#1E293B]">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#F59E0B]" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Minimum useful context
            </h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Assembly optimizes for relevance + completeness + permission safety + freshness + token
            efficiency — it never returns everything relevant, only the minimum useful package for
            the next agent or workflow.
          </p>
        </Card>
      </div>

      {personal.data && (
        <p className="text-xs text-slate-400">
          Personal graph: {personal.data.entities.length} entities ·{' '}
          {personal.data.relationships.length} relationships across{' '}
          {Object.keys(personal.data.stats.countByType).length} types.
        </p>
      )}
    </div>
  );
}
