// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Decision History view
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// The flattened, versioned, actor-scoped audit trail of every decision —
// created / approved / rejected / handed off / superseded.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import { useEnterpriseBrainHistory } from '../../lib/api-client.js';
import { ScrollText } from 'lucide-react';
import { HistoryRow } from './components.js';

export function HistoryView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useEnterpriseBrainHistory(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading decision history…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<ScrollText className="h-10 w-10" />}
        title="History unavailable"
        description="The decision audit trail could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="flex items-center gap-2 rounded-xl border border-[#06B6D4]/30 bg-[#06B6D4]/10 p-3">
        <ScrollText className="h-5 w-5 text-[#06B6D4]" />
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Every decision transition is <strong>versioned</strong> and appends an{' '}
          <strong>actor-scoped, timestamped</strong> audit entry — full DecisionHistory for
          governance and rollback.
        </p>
      </Card>

      <Card className="divide-y divide-slate-100 px-4 dark:divide-slate-800">
        {data.slice(0, 120).map((entry) => (
          <HistoryRow key={`${entry.historyId}-${entry.version}`} entry={entry} />
        ))}
        {data.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            No decision history yet — decide a goal to start the audit trail.
          </p>
        )}
      </Card>
      {data.length > 120 && (
        <p className="text-center text-[10px] text-slate-400">
          Showing the 120 most recent entries.
        </p>
      )}
    </div>
  );
}
