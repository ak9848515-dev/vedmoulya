// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Decision Timeline view
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// Chronological feed of decisions grouped by day.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useEnterpriseBrainTimeline } from '../../lib/api-client.js';
import { History } from 'lucide-react';
import {
  TYPE_LABELS,
  TYPE_COLORS,
  STATUS_COLORS,
  FALLBACK_COLOR,
  formatPct,
  formatDateTime,
} from './brain-ui.js';

export function TimelineView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useEnterpriseBrainTimeline(userId, 80);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Building decision timeline…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<History className="h-10 w-10" />}
        title="Timeline unavailable"
        description="The decision timeline could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const groups = new Map<string, typeof data>();
  for (const decision of data) {
    const day = new Date(decision.createdAt).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const bucket = groups.get(day);
    if (bucket) {
      bucket.push(decision);
    } else {
      groups.set(day, [decision]);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {[...groups.entries()].map(([day, decisions]) => (
        <div key={day}>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {day}
            </span>
            <span className="text-[10px] text-slate-400">{decisions.length} decision(s)</span>
          </div>
          <div className="relative space-y-2 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
            {decisions.map((decision) => {
              const color = TYPE_COLORS[decision.type] ?? FALLBACK_COLOR;
              return (
                <Card key={decision.decisionId} className="relative p-3">
                  <span
                    className="absolute -left-[22px] top-4 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {decision.title}
                    </span>
                    <Badge className={`text-[10px] ${STATUS_COLORS[decision.status] ?? ''}`}>
                      {decision.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-[10px] text-slate-400">
                      {formatDateTime(decision.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    <span>Goal: {decision.context.goalTitle}</span>
                    <span>Confidence {formatPct(decision.confidence.score)}</span>
                    <span>
                      {decision.recommendation.action} → {decision.recommendation.entityLabel}
                    </span>
                    <span className="font-mono" style={{ color }}>
                      {decision.decisionId}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-300 dark:text-slate-500">
                    {TYPE_LABELS[decision.type] ?? decision.type} · v{decision.version}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <EmptyState
          icon={<History className="h-10 w-10" />}
          title="No decisions yet"
          description="Run the pipeline in the Explorer tab to start the decision timeline."
        />
      )}
    </div>
  );
}
