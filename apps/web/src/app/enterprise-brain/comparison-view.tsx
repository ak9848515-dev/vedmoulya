// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Decision Comparison view
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// Side-by-side comparison of the chosen recommendation vs the alternatives
// the Brain considered, with the trade-offs and risks that decided it.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import { useEnterpriseBrainDecisions } from '../../lib/api-client.js';
import { GitCompareArrows, Check, X } from 'lucide-react';
import { TYPE_LABELS, TYPE_COLORS, FALLBACK_COLOR, formatPct } from './brain-ui.js';

export function ComparisonView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useEnterpriseBrainDecisions(userId, {
    page: 1,
    limit: 100,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Comparing decision alternatives…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<GitCompareArrows className="h-10 w-10" />}
        title="Comparisons unavailable"
        description="Decision comparisons could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  // Only the latest plan's decisions — one comparison per decision type.
  const latestPlanId = data.items[0]?.planId;
  const decisions = data.items.filter((d) => d.planId === latestPlanId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/10 p-3">
        <GitCompareArrows className="h-5 w-5 text-[#7C3AED]" />
        <p className="text-xs text-slate-600 dark:text-slate-300">
          The Brain never just picks — it weighs <strong>alternatives</strong> and the{' '}
          <strong>trade-offs</strong> and <strong>risks</strong> that separate them.
        </p>
      </div>

      {decisions.map((decision) => {
        const color = TYPE_COLORS[decision.type] ?? FALLBACK_COLOR;
        return (
          <Card key={decision.decisionId} className="p-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {TYPE_LABELS[decision.type] ?? decision.type}
              </h3>
              <span className="ml-auto text-[10px] text-slate-400">
                {formatPct(decision.confidence.score)} confidence
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {/* Chosen */}
              <div className="rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#15803D]">
                  <Check className="h-3.5 w-3.5" /> Chosen
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {decision.recommendation.action} → {decision.recommendation.entityLabel}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                  {decision.recommendation.entityId}
                </div>
              </div>

              {/* Alternatives */}
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <X className="h-3.5 w-3.5" /> Alternatives considered
                </div>
                {decision.reason.alternatives.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {decision.reason.alternatives.map((alternative) => (
                      <li key={alternative}>· {alternative}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">None documented.</p>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-[#0D9488]">Trade-offs:</span>
                <ul className="mt-1 space-y-0.5">
                  {decision.reason.tradeoffs.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-red-500">Risks:</span>
                <ul className="mt-1 space-y-0.5">
                  {decision.reason.risks.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        );
      })}

      {data.items.length === 0 && (
        <EmptyState
          icon={<GitCompareArrows className="h-10 w-10" />}
          title="Nothing to compare yet"
          description="Decide a goal in the Explorer tab to see chosen vs alternative comparisons."
        />
      )}
    </div>
  );
}
