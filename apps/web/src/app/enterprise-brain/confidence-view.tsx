// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Decision Confidence view
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// Confidence distribution (high / medium / low), the overall average, and
// per-type average confidence with the factors behind each level.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Loading, EmptyState, Badge } from '@vedmoulya/ui';
import { useEnterpriseBrainMetrics, useEnterpriseBrainDecisions } from '../../lib/api-client.js';
import { Gauge, ShieldCheck, ShieldAlert } from 'lucide-react';
import {
  TYPE_LABELS,
  TYPE_COLORS,
  CONFIDENCE_COLORS,
  FALLBACK_COLOR,
  formatPct,
} from './brain-ui.js';
import { ConfidenceBadge } from './components.js';

export function ConfidenceView({ userId }: { userId: string }): React.JSX.Element {
  const { data: metrics, isLoading, isError, refetch } = useEnterpriseBrainMetrics(userId);
  const { data: decisions } = useEnterpriseBrainDecisions(userId, { page: 1, limit: 100 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Assessing decision confidence…" size="lg" />
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <EmptyState
        icon={<Gauge className="h-10 w-10" />}
        title="Confidence data unavailable"
        description="Decision confidence could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const high = Object.values(metrics.byType).reduce(
    (sum, entry) => sum + (entry.avgConfidence >= 0.8 ? entry.count : 0),
    0,
  );

  const perType = Object.entries(metrics.byType)
    .filter(([, entry]) => entry.count > 0)
    .sort((a, b) => b[1].avgConfidence - a[1].avgConfidence);

  return (
    <div className="space-y-6">
      {/* ── Distribution ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#22C55E]/15 text-[#22C55E]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs text-slate-400">High confidence (≥80%)</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{high}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F59E0B]/15 text-[#F59E0B]">
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs text-slate-400">Overall average confidence</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {formatPct(metrics.avgConfidence)}
            </div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EF4444]/15 text-[#EF4444]">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs text-slate-400">Low-confidence decisions</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {metrics.totals.decisions - high}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Per-type average confidence ─────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Average Confidence by Decision Type
        </h3>
        <p className="text-xs text-slate-400">
          Confidence grows with engine data — degraded pipelines produce lower-confidence decisions,
          honestly.
        </p>
        <div className="mt-4 space-y-2.5">
          {perType.map(([type, entry]) => {
            const color = TYPE_COLORS[type as keyof typeof TYPE_COLORS] ?? FALLBACK_COLOR;
            const level =
              entry.avgConfidence >= 0.8 ? 'high' : entry.avgConfidence >= 0.5 ? 'medium' : 'low';
            return (
              <div key={type} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="w-44 shrink-0 truncate text-slate-500 dark:text-slate-400">
                  {TYPE_LABELS[type as keyof typeof TYPE_LABELS] ?? type}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(entry.avgConfidence * 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <ConfidenceBadge score={entry.avgConfidence} level={level} />
                <span className="w-8 text-right text-[10px] text-slate-400">{entry.count}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Confidence factors of recent decisions ──────────────────────── */}
      {decisions && decisions.items.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Confidence Factors — Recent Decisions
          </h3>
          <p className="text-xs text-slate-400">
            What raised or lowered each decision's confidence
          </p>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {decisions.items.slice(0, 10).map((decision) => (
              <div key={decision.decisionId} className="flex items-start gap-3 py-2.5">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[decision.type] ?? FALLBACK_COLOR }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {decision.title}
                    </span>
                    <Badge
                      className={`text-[10px] ${CONFIDENCE_COLORS[decision.confidence.level] ?? ''}`}
                    >
                      {formatPct(decision.confidence.score)}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                    {decision.confidence.factors.map((factor) => (
                      <span key={factor}>· {factor}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
