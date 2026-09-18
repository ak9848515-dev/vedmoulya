// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Progress (UX-02 destination)
//
// "What is changing in my life?" — the personal-development view of the Life OS.
//
// This page adds NO new backend contract and NO invented numbers: it reads the
// SAME certified Life OS snapshot the Home dashboard reads
// (`useLifeOSSnapshot`) and reuses the existing Journey + Recommendations
// sections. Consolidating the remaining Progress surfaces (Journey, Insights,
// History as first-class tabs) is UX-05 work; what ships here is a real,
// deep-linkable Progress destination instead of a nav item that goes nowhere.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Loading } from '@vedmoulya/ui';
import { ArrowRight, History, TrendingUp } from 'lucide-react';
import { useLifeOSSnapshot } from '../../lib/api-client.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { JourneyOverview } from '../sections/JourneyOverview.js';
import { RecommendationsPanel } from '../sections/RecommendationsPanel.js';
import type { Recommendation } from '../sections/types.js';

/** Internal navigation for Progress. Only real surfaces are linked. */
const PROGRESS_SUB_NAV = [
  { label: 'Overview', href: '#overview' },
  { label: 'Journey', href: '#journey' },
  { label: 'Insights', href: '#insights' },
  { label: 'History', href: '/execution' },
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export default function ProgressPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { data, isLoading } = useLifeOSSnapshot(userId);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loading label="Loading your progress..." size="lg" />
      </div>
    );
  }
  if (!user) {
    return <SignInRedirect />;
  }

  const raw = asRecord(data?.data);
  const executionRaw = asRecord(raw.execution);
  const metricsRaw = asRecord(raw.metrics);
  const recommendations: Recommendation[] = Array.isArray(raw.crossDomainRecommendations)
    ? (raw.crossDomainRecommendations as Recommendation[])
    : [];

  const journeyMetrics = {
    lifeScore: numberOf(metricsRaw.lifeScore) ?? 0,
    streak: numberOf(metricsRaw.streak),
    weeklyCompletion: numberOf(metricsRaw.weeklyCompletion),
    monthlyCompletion: numberOf(metricsRaw.monthlyCompletion),
    consistency: numberOf(metricsRaw.consistency),
    momentum: numberOf(metricsRaw.momentum),
  };
  const execution = {
    completedToday: numberOf(executionRaw.completedToday) ?? 0,
    activePlans: numberOf(executionRaw.activePlans) ?? 0,
    totalEstimatedMinutes: numberOf(executionRaw.totalEstimatedMinutes) ?? 0,
  };

  return (
    <div id="overview" className="flex flex-col gap-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2B5FD9] dark:text-[#6B8FEF]">
          Progress
        </p>
        <h1 className="mt-1 text-[30px] leading-tight font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          What is changing in your life
        </h1>
        <p className="mt-2 text-[14px] text-[#64748B] dark:text-[#94A3B8] max-w-2xl">
          Your journey, momentum and consistency — the story behind the numbers, not a wall of
          metrics.
        </p>
      </header>

      {/* ── Internal navigation ─────────────────────────────────────────── */}
      <nav aria-label="Progress sections" className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {PROGRESS_SUB_NAV.map((item, index) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={index === 0 ? 'page' : undefined}
            className={
              index === 0
                ? 'text-[13.5px] font-semibold text-[#2B5FD9] dark:text-[#6B8FEF]'
                : 'text-[13.5px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] transition-colors'
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[40vh] gap-3">
          <Loading label="Gathering your journey..." size="md" />
        </div>
      ) : null}

      {/* ── Journey (real Life OS snapshot data) ───────────────────────── */}
      <div id="journey">
        <ErrorBoundary section="progress-journey">
          <JourneyOverview execution={execution} metrics={journeyMetrics} />
        </ErrorBoundary>
      </div>

      {/* ── Insights ───────────────────────────────────────────────────── */}
      <div id="insights">
        <ErrorBoundary section="progress-insights">
          <RecommendationsPanel
            recommendations={recommendations}
            emptyMessage="Nothing to change right now — keep going and check back after your next mission."
          />
        </ErrorBoundary>
      </div>

      {/* ── History (the real execution record lives in the Missions area) ─ */}
      <Card className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
            <History className="h-5 w-5 text-[#2B5FD9] dark:text-[#6B8FEF]" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">History</p>
            <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              Every mission, plan and result you have completed lives in your execution record.
            </p>
            <Link
              href="/execution"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
            >
              Open your execution record
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <TrendingUp
            className="hidden sm:block h-5 w-5 text-[#CBD5E1] dark:text-[#475569]"
            aria-hidden="true"
          />
        </div>
      </Card>
    </div>
  );
}
