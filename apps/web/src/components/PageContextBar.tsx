// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Page Context Bar (UX-01 / UX-02 / UX-05)
//
// The visible half of `usePageContext`. Renders the ONE thing that was missing
// from the legacy module screens: an honest statement of where the user is.
//
//   Life › Career        ← /career
//   AI › Providers       ← /providers
//
// It is presentation only: the parent comes from the navigation model, the
// label is the page's own, and nothing is duplicated. It never invents a
// route, a score or a capability — it just makes existing ownership visible.
// ────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { PageContext } from '../lib/use-page-context.js';

export interface PageContextBarProps {
  context: PageContext;
  /** The page's own name, as the user would say it ("Career"). */
  label: string;
  /** Extra sentence explaining what this page is for. Honest, never marketing. */
  description?: string;
}

export function PageContextBar({
  context,
  label,
  description,
}: PageContextBarProps): React.JSX.Element | null {
  // A destination landing page (Life, AI) is already the top of its own tree —
  // showing "Life › Life" would be noise.
  if (context.isOwnerLanding) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="page-context-bar">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
        <Link
          href={context.ownerRoute}
          className="text-[12.5px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] transition-colors"
        >
          {context.ownerLabel}
        </Link>
        <span className="text-[12.5px] text-[#CBD5E1] dark:text-[#475569]" aria-hidden="true">
          ›
        </span>
        <span
          className="text-[12.5px] font-semibold text-[#374151] dark:text-[#E2E8F0]"
          aria-current="page"
        >
          {label}
        </span>
      </nav>

      <Link
        href={context.ownerRoute}
        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to {context.ownerLabel}
      </Link>

      {description !== undefined && (
        <p className="w-full text-[13px] text-[#64748B] dark:text-[#94A3B8]">{description}</p>
      )}
    </div>
  );
}
