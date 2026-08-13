// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Insight Card (EPIC-013 enrichment overlay)
// Shared by the /capability-marketplace page and the /applications capability
// plan builder. Renders the ADVISORY aiInsight attached by the enrichment seam
// (natural-language summary + AI-suggested steps/capabilities). The
// deterministic plan always remains the source of truth.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { CAPABILITY_LABELS } from '@vedmoulya/capability-marketplace';
import type { FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';

export function AIPlanInsightCard({
  insight,
}: {
  insight: NonNullable<FactoryCapabilityPlan['aiInsight']>;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
        <Sparkles className="h-3.5 w-3.5" />
        AI insight
      </p>
      {insight.summary && (
        <p className="mt-1 text-[12px] text-violet-900 dark:text-violet-200">{insight.summary}</p>
      )}
      {insight.suggestedSteps.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-medium text-violet-700 dark:text-violet-300">
            AI suggested steps
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {insight.suggestedSteps.map((suggestion, i) => (
              <span
                key={`ai-step-${i}`}
                className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
              >
                {suggestion}
              </span>
            ))}
          </div>
        </div>
      )}
      {insight.suggestedCapabilities.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-medium text-violet-700 dark:text-violet-300">
            AI suggested capabilities
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {insight.suggestedCapabilities.map((id) => (
              <span
                key={id}
                className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
              >
                {CAPABILITY_LABELS[id]}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="mt-2 text-[10px] text-violet-500 dark:text-violet-400">
        Suggested by {insight.provider} · {insight.model} — the deterministic plan above remains the
        source of truth.
      </p>
    </div>
  );
}
