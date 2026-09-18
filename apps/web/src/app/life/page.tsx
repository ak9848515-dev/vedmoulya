// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Life (UX-02 destination)
//
// The human hub for Career · Learning · Business. Those modules keep their own
// routes, screens and data — Life simply gives them one front door in primary
// navigation instead of three competing sidebar entries.
//
// Every status shown here comes from the certified Life OS snapshot the Home
// dashboard already reads; nothing is invented, and an unknown module is
// reported as unavailable rather than optimistically green.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Loading } from '@vedmoulya/ui';
import { ArrowRight, Briefcase, BookOpen, BarChart3 } from 'lucide-react';
import { useLifeOSSnapshot } from '../../lib/api-client.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { statusDotColors, type ModuleSummary } from '../sections/types.js';

interface LifeArea {
  key: 'career' | 'learning' | 'business';
  label: string;
  route: string;
  description: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const LIFE_AREAS: readonly LifeArea[] = [
  {
    key: 'career',
    label: 'Career',
    route: '/career',
    description: 'Your career goals, skills and the work you are building.',
    icon: Briefcase,
  },
  {
    key: 'learning',
    label: 'Learning',
    route: '/learning',
    description: 'What you are learning next and how far you have come.',
    icon: BookOpen,
  },
  {
    key: 'business',
    label: 'Business',
    route: '/business',
    description: 'Ventures, clients, opportunities and the results they produce.',
    icon: BarChart3,
  },
];

const STATUS_LABEL: Record<string, string> = {
  available: 'Active',
  degraded: 'Needs attention',
  unavailable: 'Unavailable',
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function moduleSummary(value: unknown, module: string): ModuleSummary {
  const raw = asRecord(value);
  return {
    module,
    status:
      raw.status === 'available' || raw.status === 'degraded' || raw.status === 'unavailable'
        ? raw.status
        : 'unavailable',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    metrics: {},
    lastUpdated: typeof raw.lastUpdated === 'string' ? raw.lastUpdated : '',
    hasNotifications: raw.hasNotifications === true,
    notificationCount: typeof raw.notificationCount === 'number' ? raw.notificationCount : 0,
  };
}

export default function LifePage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { data, isLoading } = useLifeOSSnapshot(userId);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loading label="Loading your life..." size="lg" />
      </div>
    );
  }
  if (!user) {
    return <SignInRedirect />;
  }

  const raw = asRecord(data?.data);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2B5FD9] dark:text-[#6B8FEF]">
          Life
        </p>
        <h1 className="mt-1 text-[30px] leading-tight font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          The areas you are growing
        </h1>
        <p className="mt-2 text-[14px] text-[#64748B] dark:text-[#94A3B8] max-w-2xl">
          Career, learning and business — three parts of one life, not three separate apps.
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[30vh] gap-3">
          <Loading label="Reading your areas..." size="md" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {LIFE_AREAS.map((area) => {
          const summary = moduleSummary(raw[area.key], area.key);
          const Icon = area.icon;
          return (
            <Card key={area.key} className="dark:bg-[#1E293B] dark:border-[#334155] flex flex-col">
              <div className="flex items-center gap-2.5">
                <Icon className="h-5 w-5 text-[#2B5FD9] dark:text-[#6B8FEF]" aria-hidden={true} />
                <h2 className="text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  {area.label}
                </h2>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                  <span
                    className={`h-2 w-2 rounded-full ${statusDotColors[summary.status] ?? 'bg-[#94A3B8]'}`}
                    aria-hidden="true"
                  />
                  {STATUS_LABEL[summary.status] ?? 'Unavailable'}
                </span>
              </div>

              <p className="mt-3 text-[13px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                {summary.summary.trim() !== '' ? summary.summary : area.description}
              </p>

              <Link
                href={area.route}
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
              >
                Open {area.label}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Card>
          );
        })}
      </div>

      <Card className="dark:bg-[#1E293B] dark:border-[#334155]">
        <p className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Looking for what is changing?
        </p>
        <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          Momentum, consistency and your journey across all three areas live in Progress.
        </p>
        <Link
          href="/progress"
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
        >
          Open Progress
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </Card>
    </div>
  );
}
