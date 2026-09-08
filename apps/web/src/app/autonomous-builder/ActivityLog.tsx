// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Builder: Activity Log (BLD-024)
//
// Renders the REAL structured activity events delivered by the backend
// (bounded in memory server-side). Never fabricates entries; sanitization
// (secret redaction + truncation) happens in MissionService before the
// event can reach the browser.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import type { MissionActivityEvent } from '../../lib/api-client.js';

export function ActivityLog({ events }: { events: MissionActivityEvent[] }): React.JSX.Element {
  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="activity-empty">
        No activity recorded yet.
      </p>
    );
  }
  const ordered = [...events].reverse(); // newest first (display order only)
  return (
    <ul className="space-y-1.5" data-testid="activity-log" aria-live="polite">
      {ordered.map((event) => (
        <li key={event.id} className="flex flex-col">
          <span className="text-sm">
            <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {event.kind.replace(/_/g, ' ')}
            </span>
            {event.message}
          </span>
          <span className="text-[10px] text-slate-400">
            {new Date(event.at).toLocaleTimeString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
