// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Life Area Card (UX-05)
//
// A consistent human-facing card for each life area (Career, Learning, Business).
// Uses real module status from the Life OS snapshot — never fabricated.
// Each card links to its area page via UX-02 navigation routes.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ModuleSummary } from '../sections/types.js';
import { statusDotColors } from '../sections/types.js';

export interface LifeAreaCardProps {
  area: {
    key: string;
    label: string;
    route: string;
    description: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  };
  summary: ModuleSummary;
}

const STATUS_TEXT: Record<string, string> = {
  available: 'Active',
  degraded: 'Needs attention',
  unavailable: 'Unavailable',
};

export function LifeAreaCard({ area, summary }: LifeAreaCardProps): React.JSX.Element {
  const Icon = area.icon;
  const hasSummary = summary.summary.trim().length > 0;
  const hasNotifications = summary.notificationCount > 0;

  return (
    <Link
      href={area.route}
      className="group flex flex-col rounded-2xl border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5 transition-all hover:border-[#2B5FD9]/30 dark:hover:border-[#6B8FEF]/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/40">
            <Icon className="h-5 w-5 text-[#2B5FD9] dark:text-[#6B8FEF]" aria-hidden />
          </span>
          <div>
            <h3 className="text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              {area.label}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`h-2 w-2 rounded-full ${statusDotColors[summary.status] ?? 'bg-[#94A3B8]'}`}
                aria-hidden="true"
              />
              <span className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                {STATUS_TEXT[summary.status] ?? 'Unknown'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasNotifications && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[11px] font-semibold text-[#2B5FD9] dark:text-[#6B8FEF] px-1.5">
              {summary.notificationCount}
            </span>
          )}
          <ArrowRight
            className="h-4 w-4 shrink-0 text-[#CBD5E1] dark:text-[#475569] transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-[#64748B] dark:text-[#94A3B8] flex-1">
        {hasSummary ? summary.summary : area.description}
      </p>
    </Link>
  );
}
