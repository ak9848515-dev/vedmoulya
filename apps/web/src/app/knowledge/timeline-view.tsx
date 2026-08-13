// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: Timeline view
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// The audit trail of the Knowledge Layer — every created / updated /
// validated / versioned / related / consumed / lifecycle / deleted event,
// actor-scoped and timestamped.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   ACTION_COLORS is a fixed UI color map keyed by audit-action strings with a
   safe fallback (`??`); the key comes from the platform's own audit trail,
   never from user input. */

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useKnowledgeTimeline } from '../../lib/api-client.js';
import { ScrollText } from 'lucide-react';
import { TimelineRow } from './components.js';

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-[#22C55E] text-white',
  updated: 'bg-[#2B5FD9] text-white',
  validated: 'bg-[#0D9488] text-white',
  versioned: 'bg-[#7C3AED] text-white',
  related: 'bg-[#06B6D4] text-white',
  consumed: 'bg-[#8B5CF6] text-white',
  lifecycle: 'bg-[#F59E0B] text-white',
  deleted: 'bg-[#EF4444] text-white',
};

export function TimelineView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useKnowledgeTimeline(userId, 100);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading knowledge timeline…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<ScrollText className="h-10 w-10" />}
        title="Timeline unavailable"
        description="The knowledge audit trail could not be reached."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const byAction = new Map<string, number>();
  data.forEach((entry) => {
    byAction.set(entry.action, (byAction.get(entry.action) ?? 0) + 1);
  });

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          {Array.from(byAction.entries()).map(([action, count]) => (
            <Badge
              key={action}
              className={`text-[10px] ${ACTION_COLORS[action] ?? 'bg-slate-200 text-slate-600'}`}
            >
              {action} · {count}
            </Badge>
          ))}
          <Badge variant="info" className="ml-auto text-[10px]">
            {data.length} events
          </Badge>
        </div>
      </Card>

      <Card className="divide-y divide-slate-100 p-2 dark:divide-slate-800">
        {data.map((entry) => (
          <TimelineRow
            key={`${entry.knowledgeId}-${entry.timestamp}-${entry.action}`}
            entry={entry}
          />
        ))}
      </Card>
    </div>
  );
}
