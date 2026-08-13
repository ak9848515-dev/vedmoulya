// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Learning Intelligence: Timeline view
// EPIC-004 / EI-007 — Enterprise Learning Intelligence Platform
// Chronological feed of learning signals grouped by day.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useLearningIntelligenceTimeline } from '../../lib/api-client.js';
import { History } from 'lucide-react';
import { CATEGORY_COLORS, formatPct, formatUsd, formatMs } from './learning-ui.js';

export function TimelineView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useLearningIntelligenceTimeline(userId, 60);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Building learning timeline…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<History className="h-10 w-10" />}
        title="Timeline unavailable"
        description="The learning timeline could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  // Group events by day (descending).
  const groups = new Map<string, typeof data>();
  for (const event of data) {
    const day = new Date(event.occurredAt).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const bucket = groups.get(day);
    if (bucket) {
      bucket.push(event);
    } else {
      groups.set(day, [event]);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {[...groups.entries()].map(([day, events]) => (
        <div key={day}>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {day}
            </span>
            <span className="text-[10px] text-slate-400">{events.length} signal(s)</span>
          </div>
          <div className="relative space-y-2 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
            {events.map((event) => {
              const color = CATEGORY_COLORS[event.category] ?? '#64748B';
              return (
                <Card key={event.eventId} className="relative p-3">
                  <span
                    className="absolute -left-[22px] top-4 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900"
                    style={{ backgroundColor: event.outcome === 'success' ? '#22C55E' : '#EF4444' }}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {event.entityLabel}
                    </span>
                    <Badge variant="info" className="text-[10px]">
                      {event.category}
                    </Badge>
                    <Badge
                      variant={event.outcome === 'success' ? 'success' : 'danger'}
                      className="text-[10px]"
                    >
                      {event.outcome}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    <span>Quality {formatPct(event.quality)}</span>
                    <span>Cost {formatUsd(event.costUsd)}</span>
                    <span>{formatMs(event.latencyMs)}</span>
                    {event.feedback !== undefined && (
                      <span>Feedback {formatPct(event.feedback)}</span>
                    )}
                    {event.businessOutcome !== undefined && (
                      <span>Business {formatPct(event.businessOutcome)}</span>
                    )}
                    <span className="font-mono" style={{ color }}>
                      {event.entityId}
                    </span>
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
          title="No learning signals yet"
          description="Record events in the Explorer tab to start the learning timeline."
        />
      )}
    </div>
  );
}
