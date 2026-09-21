// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Context Bar (UX-06)
//
// Every AI section renders this at the top, so a person can always answer:
// "where am I, and what else is in my AI?"
//
//   AI › Intelligence · Memory · Knowledge · Context · Providers · Models ·
//   Marketplace                                   ← siblings, one tap away
//   AI › Memory                                   ← the existing PageContextBar
//   Deeper in Intelligence: Enterprise Brain …    ← the section's own surfaces
//
// It does NOT re-implement the hierarchy: the "AI › X" line and the back link
// come from the existing PageContextBar / usePageContext (UX-01), and the
// sections come from lib/ai-experience.ts, which resolves ownership against
// navigation-model.ts. Nothing here invents a route or a second navigation model.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import {
  AI_TOP_LEVEL_SECTIONS,
  aiSectionById,
  type AISectionId,
} from '../../../lib/ai-experience.js';
import { PageContextBar } from '../../../components/PageContextBar.js';
import { usePageContext } from '../../../lib/use-page-context.js';

export interface AIContextBarProps {
  sectionId: AISectionId;
  /** The page's own name, as the person would say it ("Memory"). */
  pageLabel: string;
  /** One honest sentence about what the page is for. */
  description?: string;
  /** The page's real route. Defaults to the section's canonical route. */
  pathname?: string;
}

export function AIContextBar({
  sectionId,
  pageLabel,
  description,
  pathname,
}: AIContextBarProps): React.JSX.Element {
  const section = aiSectionById(sectionId);
  // Models is a view of Providers: the bar shows where the screen really lives.
  const current = section.parentId === undefined ? section : aiSectionById(section.parentId);
  const context = usePageContext({ pathname: pathname ?? section.route, label: pageLabel });
  const surfaces = current.surfaces ?? [];

  return (
    <div className="mb-6 flex flex-col gap-3" data-testid="ai-context-bar">
      <PageContextBar context={context} label={pageLabel} description={description} />

      <div className="flex flex-wrap items-center gap-1.5" data-testid="ai-context-siblings">
        {AI_TOP_LEVEL_SECTIONS.map((sibling) => {
          const isCurrent = sibling.id === current.id;
          return (
            <Link
              key={sibling.id}
              href={sibling.route}
              aria-current={isCurrent ? 'page' : undefined}
              className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${
                isCurrent
                  ? 'bg-[#2B5FD9] text-white'
                  : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#94A3B8] dark:hover:bg-[#334155]'
              }`}
            >
              {sibling.label}
            </Link>
          );
        })}
      </div>

      {surfaces.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          <span className="text-[#94A3B8] dark:text-[#64748B]">Deeper in {current.label}:</span>
          {surfaces.map((surface) => (
            <Link
              key={surface.route}
              href={surface.route}
              className="text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
            >
              {surface.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
