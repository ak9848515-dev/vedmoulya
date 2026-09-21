// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Settings → linked surface (UX-07)
//
// Some settings sections are HONESTLY just doors to an existing screen that owns
// that capability (Memory, Knowledge, Providers). They declare where the
// capability lives instead of duplicating its controls — UX-07 forbids two
// owners for one setting.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@vedmoulya/ui';
import { ArrowRight } from 'lucide-react';

export interface LinkedSurfaceSectionProps {
  title: string;
  description: string;
  /** What the user will find there — stated as fact, not as a promise. */
  bullets: readonly string[];
  route: string;
  linkLabel: string;
  testId: string;
}

export function LinkedSurfaceSection({
  title,
  description,
  bullets,
  route,
  linkLabel,
  testId,
}: LinkedSurfaceSectionProps): React.JSX.Element {
  return (
    <Card variant="standard" padding="lg" data-testid={testId}>
      <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F8FAFC]">{title}</h3>
      <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">{description}</p>

      <ul className="mt-4 space-y-1.5">
        {bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex items-start gap-2 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]"
          >
            <span
              className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#CBD5E1] dark:bg-[#475569]"
              aria-hidden="true"
            />
            {bullet}
          </li>
        ))}
      </ul>

      <Link
        href={route}
        className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
      >
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </Card>
  );
}
