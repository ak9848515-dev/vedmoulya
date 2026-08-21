// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: "Ask VedMoulya anything"
// SPRINT-048 — First-login intelligence (immediate AI readiness)
//
// The first thing a founder sees after the hero: a premium ask bar that opens
// the existing AI Companion (AI-RUNTIME-002 stream) with the typed question —
// no API keys, no provider configuration, no model selection required.
//
// Honesty: the readiness chip reflects the REAL runtime provider registry
// (providers.getRuntimeStatus → canExecute). "AI Ready" is only claimed when a
// provider that can actually execute exists (dev mock counts, real keys count,
// catalog-only providers never do). This is composition over the existing
// provider runtime + AI Companion + UI store — no new engine.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Sparkles, Settings2 } from 'lucide-react';
import { useUIStore } from '../../stores/ui-store.js';
import { useProviderRuntimeStatus } from '../../lib/api-client.js';

export interface AskAIInputProps {
  userId: string;
}

const SAMPLE_QUESTIONS = [
  'What should I focus on today?',
  'What should I learn next for my career?',
];

export function AskAIInput({ userId }: AskAIInputProps): React.JSX.Element {
  const router = useRouter();
  const setAiPanelOpen = useUIStore((s) => s.setAiPanelOpen);
  const setPendingQuestion = useUIStore((s) => s.setPendingQuestion);
  const [value, setValue] = useState('');
  const runtime = useProviderRuntimeStatus(userId);

  // Honest readiness: at least one registered provider that can actually
  // execute a request (EPIC-019 vocabulary). Unknown while the query loads.
  const readinessKnown = !runtime.isLoading && !runtime.isError;
  const ready = readinessKnown && (runtime.data?.providers ?? []).some((p) => p.canExecute);

  const ask = (question: string): void => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setPendingQuestion(trimmed);
    setValue('');
    setAiPanelOpen(true);
  };

  return (
    <section
      aria-label="Ask VedMoulya anything"
      className="rounded-[20px] border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4 md:p-5 animate-slide-up"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
          <Sparkles className="h-4 w-4 text-[#7C3AED]" aria-hidden="true" />
          Ask VedMoulya anything
        </p>
        {readinessKnown ? (
          ready ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              AI Ready
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                router.push('/providers');
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              AI setup needed
              <Settings2 className="h-3 w-3" aria-hidden="true" />
            </button>
          )
        ) : (
          <span className="text-[11px] text-[#94A3B8]">Checking AI…</span>
        )}
      </div>

      <form
        className="flex items-center gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          ask(value);
        }}
      >
        <label htmlFor="ask-vedmoulya-input" className="sr-only">
          Ask VedMoulya anything
        </label>
        <input
          id="ask-vedmoulya-input"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          placeholder="Ask VedMoulya anything…"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-[14px] border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] px-4 text-[14px] text-[#111827] dark:text-[#E2E8F0] placeholder:text-[#94A3B8] transition-all duration-150 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Ask"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2B5FD9] text-white transition-all hover:bg-[#1E4AA8] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {SAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              ask(q);
            }}
            className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] text-[#64748B] transition-colors hover:bg-[#EFF4FE] hover:text-[#2B5FD9] dark:bg-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#1E3A5F] dark:hover:text-[#6B8FEF]"
          >
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}
