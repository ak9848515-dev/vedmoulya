// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mission Detail: Activity Tab (UX-04)
//
// Renders the REAL sanitized activity events delivered by MissionStatusView,
// newest first, with technical event kinds translated into user-understandable
// language. The original backend message is preserved as supporting context.
// Nothing is fabricated; unknown kinds fall back to their raw text.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import type { MissionStatusView } from '../../../lib/api-client.js';
import { Clock, History } from 'lucide-react';

interface MissionActivityProps {
  status: MissionStatusView;
}

/** Technical event kind → user-understandable language. */
const EVENT_LABELS = new Map<string, string>([
  ['MISSION_STARTED', 'Mission started'],
  ['MISSION_COMPLETED', 'Mission completed'],
  ['MISSION_FAILED', 'Mission encountered an issue'],
  ['MISSION_CANCELLED', 'Mission was cancelled'],
  ['MISSION_PAUSED', 'Mission was paused'],
  ['MISSION_RESUMED', 'Mission resumed'],
  ['MISSION_APPROVED', 'Action approved'],
  ['MISSION_BLOCKED', 'Mission is blocked'],
  ['OBJECTIVE_SELECTED', 'Objective selected'],
  ['OBJECTIVE_STARTED', 'Started working on the objective'],
  ['OBJECTIVE_VERIFIED', 'Objective verified'],
  ['OBJECTIVE_FAILED', 'Objective could not be completed'],
  ['PLAN_CREATED', 'Plan created'],
  ['PROVIDER_SELECTED', 'AI provider selected'],
  ['TOOL_CALLED', 'Tool executed'],
  ['FILE_CHANGED', 'Files updated'],
  ['VERIFICATION_COMPLETED', 'Verification completed'],
  ['CHECKPOINT_SAVED', 'Checkpoint saved'],
  ['NEXT_OBJECTIVE_SELECTED', 'Next objective selected'],
  ['WAITING_FOR_PROVIDER', 'Waiting for an available AI provider'],
  ['WAITING_FOR_APPROVAL', 'Waiting for your approval'],
]);

function translateEvent(kind: string): string {
  return EVENT_LABELS.get(kind) ?? kind;
}

export function MissionActivity({ status }: MissionActivityProps): React.JSX.Element {
  const events = status.activity;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#64748B]">
        <History className="h-4 w-4" />
        <h2 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Activity</h2>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-slate-200 p-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <p
            className="text-[13px] text-[#64748B] dark:text-slate-400"
            data-testid="activity-empty"
          >
            No activity recorded yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="activity-list" aria-live="polite">
          {[...events].reverse().map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" />
              <div className="min-w-0">
                <p className="text-[13px] text-[#111827] dark:text-[#F8FAFC]">
                  {translateEvent(event.kind)}
                </p>
                {event.message && event.message !== event.kind ? (
                  <p className="mt-0.5 text-[12px] text-[#64748B] dark:text-slate-400">
                    {event.message}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  {new Date(event.at).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
