// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Today's Mission (MOB-002)
// The single most important thing to do today, derived from the top priority
// and the execution summary (active plans / completed today). Shows progress
// and a continue action. Dark-mode aware. Renders an encouraging empty state
// when nothing is scheduled.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Button, Badge } from '@vedmoulya/ui';
import { Target, CheckCircle2, AlertTriangle, ArrowRight, PartyPopper } from 'lucide-react';
import type { Priority, ExecutionSummary } from './types.js';

export interface TodayMissionCardProps {
  priority?: Priority;
  execution: Pick<ExecutionSummary, 'activePlans' | 'completedToday' | 'blockedPlans'>;
}

export function TodayMissionCard({
  priority,
  execution,
}: TodayMissionCardProps): React.JSX.Element {
  const hasMission = Boolean(priority);
  const doneToday = execution.completedToday;
  const isBlocked = priority?.isBlocked ?? false;

  return (
    <Card
      variant="standard"
      padding="lg"
      className="overflow-hidden relative animate-slide-up dark:bg-[#1E293B] dark:border-[#334155]"
    >
      {/* accent hairline */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2B5FD9] via-[#5B8AEB] to-[#7C3AED]" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A5F]">
            {isBlocked ? (
              <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
            ) : (
              <Target className="h-5 w-5 text-[#2B5FD9] dark:text-[#6B8FEF]" />
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B] dark:text-[#94A3B8]">
              Today&apos;s Mission
            </p>
            <p className="text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]">
              {execution.activePlans} active plan{execution.activePlans === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Badge variant="success" size="sm" className="shrink-0">
          <CheckCircle2 className="h-3 w-3 mr-1" /> {doneToday} done
        </Badge>
      </div>

      {hasMission && priority ? (
        <div className="mt-4">
          <h3 className="text-[19px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] leading-snug">
            {priority.title}
          </h3>
          <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-1 line-clamp-2">
            {priority.description}
          </p>
          <div className="mt-4 flex items-center gap-3">
            {!isBlocked && (
              <Button variant="primary" size="md" className="flex-1 sm:flex-none">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {isBlocked && (
              <Button variant="secondary" size="md" className="flex-1 sm:flex-none">
                Review Blockers
              </Button>
            )}
            {priority.deadline && (
              <span className="text-[12px] text-[#94A3B8]">
                Due{' '}
                {new Date(priority.deadline).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A]">
          <PartyPopper className="h-5 w-5 text-[#22C55E] shrink-0" />
          <div>
            <p className="text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0]">
              All caught up!
            </p>
            <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              No pending priorities — enjoy the calm, or add a new goal to keep the momentum.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
