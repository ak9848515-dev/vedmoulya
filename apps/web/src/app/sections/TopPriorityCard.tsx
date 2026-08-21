// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Top Priority Card
// Highest-priority item from the priorities array with blocked/unblocked state
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Button, Badge } from '@vedmoulya/ui';
import { Target, AlertTriangle, ArrowRight } from 'lucide-react';
import type { Priority } from './types.js';
import { priorityLabel, priorityColor } from './types.js';

export interface TopPriorityCardProps {
  priority: Priority;
  /** Navigates to the priority's home (e.g. the goals view). Falls back to a no-op
      so the component remains safe to render in isolation (stories/docs). */
  onContinue?: () => void;
  /** Navigates to a place to review why this priority is blocked. */
  onReviewBlockers?: () => void;
}

export function TopPriorityCard({
  priority,
  onContinue,
  onReviewBlockers,
}: TopPriorityCardProps): React.JSX.Element {
  const icon = priority.isBlocked ? (
    <AlertTriangle className="h-6 w-6 text-[#EF4444]" />
  ) : (
    <Target className="h-6 w-6 text-[#2B5FD9]" />
  );

  const bgClass = priority.isBlocked ? 'bg-[#FEF2F2]' : 'bg-[#EFF4FE]';

  return (
    <Card variant="standard" padding="lg" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${bgClass}`}>{icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
                Top Priority
              </p>
              <span
                className={`text-[11px] font-semibold ${priorityColor[priority.priority] ?? ''}`}
              >
                {priorityLabel[priority.priority] ?? 'Unknown'}
              </span>
              {priority.isBlocked && (
                <Badge variant="danger" size="sm">
                  BLOCKED
                </Badge>
              )}
              <Badge variant="default" size="sm" className="capitalize">
                {priority.source}
              </Badge>
            </div>
            <h2 className="text-[20px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] mt-1">
              {priority.title}
            </h2>
            <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-1">
              {priority.description}
            </p>
            {priority.deadline && (
              <p className="text-[12px] text-[#94A3B8] mt-1">
                Due:{' '}
                {new Date(priority.deadline).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!priority.isBlocked && (
            <Button variant="primary" size="md" onClick={onContinue}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {priority.isBlocked && (
            <Button variant="secondary" size="md" onClick={onReviewBlockers}>
              Review Blockers
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
