// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Home Section: Recent Activity (UX-03)
//
// A compact continuation surface: the latest priorities and recent AI
// observations. Not a full activity log — just enough to remind the user
// what was happening and where they left off. All data is real.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, ArrowRight, Sparkles } from 'lucide-react';
import type { Priority, MemorySummary } from './types.js';
import { priorityColor, priorityLabel } from './types.js';

export interface RecentActivityProps {
  priorities: Priority[];
  memory: Pick<MemorySummary, 'aiObservations' | 'recentCount'>;
}

export function RecentActivity({ priorities, memory }: RecentActivityProps): React.JSX.Element {
  const recentPriorities = priorities.slice(0, 3);
  const recentObservations = memory.aiObservations.slice(0, 2);
  const hasContent = recentPriorities.length > 0 || recentObservations.length > 0;

  if (!hasContent) {
    return (
      <section aria-labelledby="recent-activity-heading">
        <h2
          id="recent-activity-heading"
          className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0EA5A9] dark:text-[#66D0D3] mb-3"
        >
          Recent Activity
        </h2>
        <div className="rounded-2xl border border-dashed border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5 text-center">
          <p className="text-[13px] text-[#94A3B8]">
            No recent activity yet — start a mission or set a goal to begin your journey.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="recent-activity-heading">
      <h2
        id="recent-activity-heading"
        className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0EA5A9] dark:text-[#66D0D3] mb-3"
      >
        Recent Activity
      </h2>
      <div className="rounded-2xl border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] divide-y divide-[#F1F5F9] dark:divide-[#334155]">
        {/* Recent priorities */}
        {recentPriorities.map((p) => (
          <Link
            key={p.id}
            href="/goals"
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A]"
          >
            <Clock className="h-4 w-4 text-[#94A3B8] shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
                {p.title}
              </p>
              <p className="text-[11.5px] text-[#94A3B8]">
                <span className={`font-medium ${priorityColor[p.priority] ?? ''}`}>
                  {priorityLabel[p.priority] ?? ''}
                </span>
                {p.source && <span> · {p.source}</span>}
              </p>
            </div>
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 text-[#CBD5E1] dark:text-[#475569]"
              aria-hidden="true"
            />
          </Link>
        ))}

        {/* Recent AI observations */}
        {recentObservations.map((obs, i) => (
          <div key={`obs-${String(i)}`} className="flex items-start gap-3 px-4 py-3">
            <Sparkles className="h-4 w-4 text-[#7C3AED] shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] line-clamp-2">{obs}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
