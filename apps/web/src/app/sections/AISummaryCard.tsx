// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: AI Summary Card (MOB-002)
// Renders the AI-generated context summary from the snapshot (`contextSummary`,
// `currentFocus`) in a premium gradient card. Dark-mode aware.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Sparkles, Focus } from 'lucide-react';
import type { AIContext } from './types.js';

export interface AISummaryCardProps {
  aiContext: AIContext;
}

export function AISummaryCard({ aiContext }: AISummaryCardProps): React.JSX.Element {
  const summary = aiContext.contextSummary;
  const focus = aiContext.currentFocus;

  if (!summary && !focus) {
    // Graceful empty state — nothing synthesized yet.
    return (
      <section
        className="
          rounded-2xl p-4 border border-dashed border-[#E2E8F0] dark:border-[#334155]
          bg-white dark:bg-[#1E293B]
        "
      >
        <div className="flex items-center gap-2 text-[#64748B] dark:text-[#94A3B8]">
          <Sparkles className="h-4 w-4" />
          <p className="text-[13px]">
            Your AI summary will appear here once the Life OS has enough activity to synthesize.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="
        relative overflow-hidden rounded-2xl p-4 animate-slide-up
        bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#4C1D95]
        dark:from-[#6D28D9] dark:via-[#5B21B6] dark:to-[#3B0764]
      "
    >
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'radial-gradient(circle at 80% 20%, white 0%, transparent 45%), radial-gradient(circle at 15% 85%, white 0%, transparent 40%)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#C4B5FD]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C4B5FD]">
            AI Summary
          </p>
        </div>
        {summary && <p className="text-[14px] text-white/95 leading-relaxed mt-2">{summary}</p>}
        {focus && (
          <p className="flex items-center gap-1.5 text-[13px] text-[#DDD6FE] mt-2">
            <Focus className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">Focus: {focus}</span>
          </p>
        )}
      </div>
    </section>
  );
}
