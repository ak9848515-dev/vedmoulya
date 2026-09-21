// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Life Journey Strip (UX-05)
//
// The human journey every life area shares:
//
//   Area → Goal → Mission → Progress → Outcome
//
// It renders THAT SHAPE honestly. Steps with real data link to the real surface
// that owns them; steps without data are shown as plainly not started. Nothing
// is fabricated: no invented goal, no invented mission, no invented percentage.
// ────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface JourneyStep {
  /** Step name, as the user would say it ("Goal"). */
  label: string;
  /** One honest sentence — an empty state when there is nothing yet. */
  detail: string;
  /** A REAL route this step opens, or null when the step has not started. */
  href: string | null;
  icon: LucideIcon;
  /** True only when the step has real data behind it. */
  hasData: boolean;
}

export interface LifeJourneyStripProps {
  steps: readonly JourneyStep[];
  /** Section heading. Defaults to the shared journey language. */
  title?: string;
}

export function LifeJourneyStrip({
  steps,
  title = 'Your journey in this area',
}: LifeJourneyStripProps): React.JSX.Element {
  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5"
      data-testid="life-journey-strip"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B] dark:text-[#94A3B8]">
        {title}
      </p>

      <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const body = (
            <>
              <div className="flex items-center gap-1.5">
                <Icon
                  className={`h-3.5 w-3.5 ${
                    step.hasData
                      ? 'text-[#2B5FD9] dark:text-[#6B8FEF]'
                      : 'text-[#94A3B8] dark:text-[#64748B]'
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`text-[12px] font-semibold ${
                    step.hasData
                      ? 'text-[#374151] dark:text-[#E2E8F0]'
                      : 'text-[#94A3B8] dark:text-[#64748B]'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                {step.detail}
              </p>
            </>
          );

          return (
            <li key={step.label} className="relative flex items-start gap-2">
              {step.href !== null ? (
                <Link
                  href={step.href}
                  data-testid={`journey-step-${step.label.toLowerCase()}`}
                  className="group w-full rounded-xl border border-[#E8EDF5] dark:border-[#334155] bg-[#FBFCFE] dark:bg-[#0F172A] p-3 transition-colors hover:border-[#2B5FD9]/30 dark:hover:border-[#6B8FEF]/30"
                >
                  {body}
                </Link>
              ) : (
                <div
                  data-testid={`journey-step-${step.label.toLowerCase()}`}
                  className="w-full rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-3"
                >
                  {body}
                </div>
              )}
              {index < steps.length - 1 && (
                <ArrowRight
                  className="hidden sm:block absolute -right-[13px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#CBD5E1] dark:text-[#475569] z-10"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
