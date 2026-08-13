// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: Timeline view
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// The full audit trail of the memory layer — every capture, validation,
// consolidation, ranking, compression, retrieval, reinforcement, archive and
// expiry event across the operating system.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import { useMemoryTimeline } from '../../lib/api-client.js';
import { ScrollText } from 'lucide-react';
import { TimelineRow } from './components.js';

export function TimelineView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useMemoryTimeline(userId, 60);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading memory timeline…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<ScrollText className="h-10 w-10" />}
        title="Timeline unavailable"
        description="The memory audit trail could not be reached."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-[#2B5FD9]" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Memory Timeline
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          The auditable history of the memory layer — who acted, when, and on what.
        </p>
      </Card>

      {data.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-10 w-10" />}
          title="No memory events yet"
          description="Captured memories will appear here with their full lifecycle audit trail."
        />
      ) : (
        <div className="relative space-y-3 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
          {data.map((entry) => (
            <div key={`${entry.memoryId}-${entry.timestamp}`} className="relative">
              <span className="absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2B5FD9] dark:border-slate-800" />
              <TimelineRow entry={entry} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
