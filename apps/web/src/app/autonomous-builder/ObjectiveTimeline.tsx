// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Builder: Objective Timeline (BLD-024)
//
// Renders the objective timeline STRICTLY from backend mission state.
// Symbols: ✓ VERIFIED, → RUNNING, ○ PENDING/READY, ! BLOCKED/FAILED.
// Nothing is inferred or fabricated — the state strings come from the
// MissionControllerService through the status endpoint.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import type { MissionObjectiveView } from '../../lib/api-client.js';

export function ObjectiveTimeline({
  objectives,
}: {
  objectives: MissionObjectiveView[];
}): React.JSX.Element {
  if (objectives.length === 0) {
    return (
      <p className="text-sm text-[--muted-fg,theme(colors.slate.500)]" data-testid="timeline-empty">
        No objectives yet — the runtime selects the first objective after RUN.
      </p>
    );
  }
  return (
    <ol className="space-y-2" data-testid="objective-timeline">
      {objectives.map((objective) => {
        const symbol =
          objective.state === 'VERIFIED'
            ? '✓'
            : objective.state === 'RUNNING'
              ? '→'
              : objective.state === 'BLOCKED' || objective.state === 'FAILED'
                ? '!'
                : '○';
        const tone =
          objective.state === 'VERIFIED'
            ? 'text-emerald-600 dark:text-emerald-400'
            : objective.state === 'RUNNING'
              ? 'text-[#2B5FD9]'
              : objective.state === 'BLOCKED' || objective.state === 'FAILED'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500 dark:text-slate-400';
        return (
          <li
            key={objective.objectiveId}
            className="flex flex-col gap-0.5"
            data-testid={`objective-${objective.objectiveId}`}
          >
            <span className="flex items-baseline gap-2">
              <span className={`font-mono text-sm ${tone}`} aria-hidden="true">
                {symbol}
              </span>
              <span className="text-sm font-medium">{objective.title}</span>
              <span className={`text-xs uppercase tracking-wide ${tone}`}>{objective.state}</span>
            </span>
            {objective.state === 'BLOCKED' && objective.failureReason ? (
              <span className="ml-6 text-xs text-rose-600 dark:text-rose-400">
                Reason: {objective.failureReason}
              </span>
            ) : null}
            {objective.state === 'FAILED' && objective.failureReason ? (
              <span className="ml-6 text-xs text-rose-600 dark:text-rose-400">
                Reason: {objective.failureReason}
              </span>
            ) : null}
            {objective.state === 'VERIFIED' && objective.verificationMethod ? (
              <span className="ml-6 text-xs text-slate-500 dark:text-slate-400">
                Verified via {objective.verificationMethod}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
