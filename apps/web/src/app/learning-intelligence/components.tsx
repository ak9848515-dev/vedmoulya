// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Learning Intelligence: presentational components
// EPIC-004 / EI-007 — Enterprise Learning Intelligence Platform
// Pure presentational components extracted from the Explorer view so they can
// be rendered in Storybook with fixture DTOs (same convention as the
// ExecutionStrategyExplorer components.js).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Badge } from '@vedmoulya/ui';
import type { LearningEventDTO } from '@vedmoulya/learning-intelligence';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatPct,
  formatUsd,
  formatMs,
  formatDate,
} from './learning-ui.js';

export interface LearningEventRowProps {
  event: LearningEventDTO;
}

/** One row in the learning event log: category dot, outcome badges,
 *  and the measurable signals (quality, cost, latency, confidence). */
export function LearningEventRow({ event }: LearningEventRowProps): React.JSX.Element {
  const color = CATEGORY_COLORS[event.category] ?? '#64748B';
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {event.entityLabel}
          </span>
          <Badge variant="info" className="text-[10px]">
            {CATEGORY_LABELS[event.category] ?? event.category}
          </Badge>
          <Badge
            variant={event.outcome === 'success' ? 'success' : 'danger'}
            className="text-[10px]"
          >
            {event.outcome}
          </Badge>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span>Quality {formatPct(event.quality)}</span>
          <span>Cost {formatUsd(event.costUsd)}</span>
          <span>{formatMs(event.latencyMs)}</span>
          <span>Conf {formatPct(event.confidence)}</span>
          <span>
            {event.sourceRef
              ? `${event.sourceRef.sourceType} · ${event.sourceRef.sourceId}`
              : 'manual'}
          </span>
          <span>{formatDate(event.occurredAt)}</span>
        </div>
      </div>
      <span className="text-[11px] font-mono text-slate-400">{event.entityId}</span>
    </div>
  );
}
