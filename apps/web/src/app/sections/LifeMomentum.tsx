// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Home Section: Life Momentum (UX-03)
//
// Compact view of what is growing across Career, Learning, and Business.
// Uses real module status from the Life OS snapshot — never fabricated.
// Each area links to its UX-02 destination route.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Briefcase, BookOpen, BarChart3, ArrowRight } from 'lucide-react';
import type { ModuleSummary } from './types.js';
import { statusDotColors } from './types.js';

export interface LifeMomentumProps {
  career: ModuleSummary;
  learning: ModuleSummary;
  business: ModuleSummary;
}

interface Area {
  key: 'career' | 'learning' | 'business';
  label: string;
  route: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

const AREAS: readonly Area[] = [
  { key: 'career', label: 'Career', route: '/career', icon: Briefcase },
  { key: 'learning', label: 'Learning', route: '/learning', icon: BookOpen },
  { key: 'business', label: 'Business', route: '/business', icon: BarChart3 },
];

const STATUS_TEXT: Record<string, string> = {
  available: 'Active',
  degraded: 'Needs attention',
  unavailable: 'Unavailable',
};

export function LifeMomentum({ career, learning, business }: LifeMomentumProps): React.JSX.Element {
  const modules: Record<Area['key'], ModuleSummary> = { career, learning, business };

  return (
    <section aria-labelledby="life-momentum-heading">
      <h2
        id="life-momentum-heading"
        className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0EA5A9] dark:text-[#66D0D3] mb-3"
      >
        Life Momentum
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {AREAS.map((area) => {
          const mod = modules[area.key];
          const Icon = area.icon;
          const hasSummary = mod.summary.trim().length > 0;

          return (
            <Link
              key={area.key}
              href={area.route}
              className="group flex items-start gap-3 rounded-2xl border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4 transition-colors hover:border-[#2B5FD9]/30 dark:hover:border-[#6B8FEF]/30"
            >
              <span className="p-2 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
                <Icon className="h-4 w-4 text-[#2B5FD9] dark:text-[#6B8FEF]" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                    {area.label}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${statusDotColors[mod.status] ?? 'bg-[#94A3B8]'}`}
                    title={STATUS_TEXT[mod.status] ?? mod.status}
                    aria-label={STATUS_TEXT[mod.status] ?? mod.status}
                  />
                </div>
                <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 line-clamp-2">
                  {hasSummary ? mod.summary : `${area.label} is ready when you are.`}
                </p>
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-[#CBD5E1] dark:text-[#475569] mt-0.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
