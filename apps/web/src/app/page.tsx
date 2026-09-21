// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Home (UX-03)
//
// "What matters to me right now?"
//
// The primary personal experience. A clear focal point in the first viewport
// that immediately communicates who this space belongs to, what matters now,
// what to do next, and what VedMoulya can help with.
//
// Hierarchy:
//   Greeting → Today's Priority → Primary Mission → VedMoulya Insight →
//   Life Momentum → Recent Activity → Ask VedMoulya
//
// Data sources: ALL from the certified Life OS snapshot (useLifeOSSnapshot).
// No fabricated data. Empty/honest states for every section.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loading, Card, Button } from '@vedmoulya/ui';
import { RefreshCw, AlertTriangle, Sparkles, Target, ArrowRight, CloudOff } from 'lucide-react';
import { useLifeOSSnapshot, useMissionHistory } from '../lib/api-client.js';
import { missionDetailRoute } from '../lib/navigation-model.js';
import { useAuthStore, useAuthHydrated } from '../stores/auth-store.js';
import type {
  IdentitySummary,
  ModuleSummary,
  DecisionSummary,
  ExecutionSummary,
  MemorySummary,
  Priority,
  Recommendation,
  Notification,
  Metrics,
  AIContext,
} from './sections/types.js';
import { ErrorBoundary } from '../components/ErrorBoundary.js';
import { SignInRedirect } from '../components/SignInRedirect.js';
import { TodayMissionCard } from './sections/TodayMissionCard.js';
import { AISummaryCard } from './sections/AISummaryCard.js';
import { AskAIInput } from './sections/AskAIInput.js';
import { LifeMomentum } from './sections/LifeMomentum.js';
import { RecentActivity } from './sections/RecentActivity.js';
import { DashboardSkeleton } from './sections/DashboardSkeleton.js';
import { usePullToRefresh } from '../lib/use-pull-to-refresh.js';
import { markStartup, STARTUP_MARKS } from '../lib/startup.js';
import {
  cacheDashboardSnapshot,
  readCachedDashboard,
  type CachedDashboardEntry,
} from '../lib/dashboard-cache.js';

// Below-the-fold sections are lazy-loaded to keep the landing chunk small.
const ExecutionCenter = dynamic(
  () => import('./sections/ExecutionCenter.js').then((mod) => ({ default: mod.ExecutionCenter })),
  { ssr: false, loading: () => null },
);
const DecisionCenter = dynamic(
  () => import('./sections/DecisionCenter.js').then((mod) => ({ default: mod.DecisionCenter })),
  { ssr: false, loading: () => null },
);
const JourneyOverview = dynamic(
  () => import('./sections/JourneyOverview.js').then((mod) => ({ default: mod.JourneyOverview })),
  { ssr: false, loading: () => null },
);
const RecommendationsPanel = dynamic(
  () =>
    import('./sections/RecommendationsPanel.js').then((mod) => ({
      default: mod.RecommendationsPanel,
    })),
  { ssr: false, loading: () => null },
);
const NotificationsPanel = dynamic(
  () =>
    import('./sections/NotificationsPanel.js').then((mod) => ({ default: mod.NotificationsPanel })),
  { ssr: false, loading: () => null },
);
const ModuleStatusGrid = dynamic(
  () => import('./sections/ModuleStatusGrid.js').then((mod) => ({ default: mod.ModuleStatusGrid })),
  { ssr: false, loading: () => null },
);
const MemoryTimeline = dynamic(
  () => import('./sections/MemoryTimeline.js').then((mod) => ({ default: mod.MemoryTimeline })),
  { ssr: false, loading: () => null },
);
const PrioritiesList = dynamic(
  () => import('./sections/PrioritiesList.js').then((mod) => ({ default: mod.PrioritiesList })),
  { ssr: false, loading: () => null },
);
const AIInsights = dynamic(
  () => import('./sections/AIInsights.js').then((mod) => ({ default: mod.AIInsights })),
  { ssr: false, loading: () => null },
);

// ── Default Values for Missing Data ──────────────────────────────────────────

const defaultIdentity: IdentitySummary = {
  displayName: 'User',
  email: '',
  role: '',
  purpose: '',
  primaryGoal: '',
  currentJourney: '',
  greeting: 'Hello',
};

const defaultMetrics: Metrics = {
  lifeScore: 0,
  moduleEngagement: {},
  totalNotifications: 0,
  unreadNotifications: 0,
  totalRecommendations: 0,
  activeRecommendations: 0,
};

const defaultExecution: ExecutionSummary = {
  activePlans: 0,
  blockedPlans: 0,
  completedToday: 0,
  totalEstimatedMinutes: 0,
  recoverySuggestions: [],
};

const defaultDecisions: DecisionSummary = {
  pendingDecisions: 0,
  decisionsToday: 0,
  averageConfidence: 0,
  highRiskCount: 0,
  topPending: [],
};

const defaultMemory: MemorySummary = {
  totalMemories: 0,
  recentCount: 0,
  importantEvents: 0,
  aiObservations: [],
  reflectionPrompts: [],
};

const defaultAIContext: AIContext = {
  currentFocus: '',
  recentActivity: [],
  suggestedQuestions: [],
  contextSummary: '',
  topPriorities: [],
  crossDomainInsights: [],
};

const defaultModule = (mod: string): ModuleSummary => ({
  module: mod,
  status: 'available',
  summary: '',
  metrics: {},
  lastUpdated: '',
  hasNotifications: false,
  notificationCount: 0,
});

// ── Safe extraction helpers ──────────────────────────────────────────────────

function safeObj<T>(val: unknown, defaults: T): T {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return { ...defaults, ...val };
  }
  return defaults;
}

function safeArr<TVal>(val: unknown): TVal[] {
  return Array.isArray(val) ? (val as TVal[]) : [];
}

// ── Time-of-day greeting ─────────────────────────────────────────────────────

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Mission states in which nothing further is expected. */
const TERMINAL_MISSION_STATES = ['COMPLETED', 'FAILED', 'CANCELLED'];

// ── Home Page ───────────────────────────────────────────────────────────────

export default function Home(): React.JSX.Element {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, sessionReady, offline } = useAuthStore();
  const userId = user?.userId ?? '';
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useLifeOSSnapshot(userId);

  // ── UX-03 canonical mission entry ──────────────────────────────────────
  // The Home journey is Home → today's mission → Missions → mission detail →
  // execution → verification → result. The PRIMARY Mission CTA therefore goes
  // to the canonical operational mission experience when a REAL mission id
  // exists, and to the Missions landing page otherwise. `/goals` stays fully
  // valid and is still reachable where a goal (not a mission) is the subject.
  //
  // No mission id is ever fabricated: `useMissionHistory` only returns missions
  // that actually exist, and `missionDetailRoute` refuses empty ids.
  const missionHistory = useMissionHistory(userId);
  const liveMission = useMemo(
    () => missionHistory.data?.find((entry) => !TERMINAL_MISSION_STATES.includes(entry.state)),
    [missionHistory.data],
  );
  const latestMission = liveMission ?? missionHistory.data?.[0];
  const missionRoute = missionDetailRoute(latestMission?.missionId);

  /** Where "continue working" should take the user. */
  const continueRoute = missionRoute ?? '/missions';

  // ── Offline cache ─────────────────────────────────────────────────────
  const [cachedEntry, setCachedEntry] = useState<CachedDashboardEntry | null>(null);
  const usingCache = !data && cachedEntry !== null;

  useEffect(() => {
    if (data?.success && data.data) {
      cacheDashboardSnapshot(data.data);
      setCachedEntry(null);
      markStartup(STARTUP_MARKS.firstData);
    }
  }, [data]);

  useEffect(() => {
    if ((isError || offline) && !data) {
      setCachedEntry(readCachedDashboard());
    }
  }, [isError, offline, data]);

  useEffect(() => {
    const onRetry = (): void => {
      void refetch();
    };
    window.addEventListener('vedmoulya:retry-sync', onRetry);
    return (): void => {
      window.removeEventListener('vedmoulya:retry-sync', onRetry);
    };
  }, [refetch]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────
  const pullToRefresh = usePullToRefresh({ onRefresh: refetch });

  // ── Hydration guard ───────────────────────────────────────────────────
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loading label="Loading your Life OS..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  // ── Loading State ─────────────────────────────────────────────────────
  if (isLoading && !usingCache) {
    return <DashboardSkeleton />;
  }

  // ── Error State ───────────────────────────────────────────────────────
  if ((isError || !data?.success) && cachedEntry === null) {
    const errorMessage = error?.message ?? 'Could not load your dashboard.';
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Card variant="standard" padding="lg" className="max-w-md text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-[#FEF2F2] dark:bg-[#450A0A]">
              <AlertTriangle className="h-6 w-6 text-[#EF4444]" />
            </div>
            <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Unable to Load Home
            </h2>
            <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8]">{errorMessage}</p>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                void refetch();
              }}
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Extract typed data from live or cached snapshot ────────────────────
  const raw = (data?.success ? (data.data as Record<string, unknown>) : cachedEntry?.data) as
    Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Card variant="standard" padding="lg" className="max-w-md text-center">
          <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8]">
            No data available yet — setting up your Life OS.
          </p>
          <Button
            variant="primary"
            size="md"
            className="mt-3"
            onClick={() => {
              void refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      </div>
    );
  }

  // ── Typed data extraction (all REAL production data from snapshot) ─────
  const identity: IdentitySummary = safeObj(raw.identity, defaultIdentity);
  const metrics: Metrics = safeObj(raw.metrics, defaultMetrics);
  const execution: ExecutionSummary = safeObj(raw.execution, defaultExecution);
  const decisions: DecisionSummary = safeObj(raw.decisions, defaultDecisions);
  const memory: MemorySummary = safeObj(raw.memory, defaultMemory);
  const aiContext: AIContext = safeObj(raw.aiContext, defaultAIContext);
  const career: ModuleSummary = safeObj(raw.career, defaultModule('career'));
  const learning: ModuleSummary = safeObj(raw.learning, defaultModule('learning'));
  const business: ModuleSummary = safeObj(raw.business, defaultModule('business'));
  const marketplace: ModuleSummary = safeObj(raw.marketplace, defaultModule('marketplace'));
  const priorities: Priority[] = safeArr<Priority>(raw.priorities);
  const recommendations: Recommendation[] = safeArr<Recommendation>(raw.crossDomainRecommendations);
  const notifications: Notification[] = safeArr<Notification>(raw.globalNotifications);
  const topPriority: Priority | undefined = priorities[0];

  const rawMetrics = raw.metrics as Record<string, unknown> | undefined;
  const journeyMetrics = {
    ...metrics,
    streak: rawMetrics?.streak as number | undefined,
    weeklyCompletion: rawMetrics?.weeklyCompletion as number | undefined,
    monthlyCompletion: rawMetrics?.monthlyCompletion as number | undefined,
    consistency: rawMetrics?.consistency as number | undefined,
    momentum: rawMetrics?.momentum as number | undefined,
  };

  const cacheAgeMinutes = cachedEntry
    ? Math.max(1, Math.round((Date.now() - cachedEntry.fetchedAt) / 60000))
    : 0;

  const displayName = identity.displayName || 'User';
  const hasInsight = Boolean(aiContext.contextSummary || aiContext.currentFocus);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div ref={pullToRefresh.pageRef} className="relative space-y-6 md:space-y-8 pb-4 md:pb-8">
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pullToRefresh.refreshing ? 44 : Math.min(pullToRefresh.pullDistance, 72) }}
        aria-hidden="true"
      >
        {pullToRefresh.refreshing ? (
          <RefreshCw className="h-5 w-5 text-[#2B5FD9] dark:text-[#6B8FEF] animate-spin" />
        ) : (
          pullToRefresh.pullDistance > 0 && (
            <RefreshCw
              className="h-4 w-4 text-[#2B5FD9] dark:text-[#6B8FEF]"
              style={{
                transform: `rotate(${String(Math.min(pullToRefresh.pullDistance * 2, 180))}deg)`,
              }}
            />
          )
        )}
      </div>

      {/* Cached-data notice */}
      {usingCache && (
        <div
          role="status"
          className="animate-banner-in flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FFFBEB] dark:bg-[#451A03] border border-[#FDE68A] dark:border-[#78350F] text-[#92400E] dark:text-[#FDE68A] text-[12px] font-medium"
        >
          <CloudOff className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            {offline
              ? `You're offline — showing data cached ${String(cacheAgeMinutes)} min ago.`
              : `Showing cached data from ${String(cacheAgeMinutes)} min ago — pull to refresh or retry.`}
          </span>
          <button
            onClick={() => {
              void refetch();
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 transition-colors text-[#B45309] dark:text-[#FBBF24] font-semibold"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          1. GREETING — who this space belongs to
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="greeting">
        <header className="space-y-1">
          <h1 className="text-[28px] md:text-[36px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC] tracking-tight">
            {timeGreeting()},{' '}
            <span className="text-[#2B5FD9] dark:text-[#6B8FEF]">{displayName}</span>
          </h1>
          <p className="text-[15px] md:text-[17px] text-[#64748B] dark:text-[#94A3B8]">
            {identity.purpose || "Here's what matters today."}
          </p>
        </header>
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          2. TODAY'S PRIORITY — the single most important thing
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="priority">
        {topPriority ? (
          <Card
            variant="standard"
            padding="lg"
            className="overflow-hidden relative dark:bg-[#1E293B] dark:border-[#334155]"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2B5FD9] via-[#5B8AEB] to-[#7C3AED]" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2B5FD9] dark:text-[#6B8FEF]">
                  Today&apos;s Priority
                </p>
                <h2 className="text-[19px] md:text-[22px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] mt-1 leading-snug">
                  {topPriority.title}
                </h2>
                <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-1 line-clamp-2">
                  {topPriority.description}
                </p>
                {topPriority.deadline && (
                  <p className="text-[12px] text-[#94A3B8] mt-2">
                    Due{' '}
                    {new Date(topPriority.deadline).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                size="md"
                className="shrink-0"
                onClick={() => {
                  // UX-03: today's priority leads into the mission journey.
                  router.push(continueRoute);
                }}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ) : (
          <Card variant="standard" padding="lg" className="dark:bg-[#1E293B] dark:border-[#334155]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#F0FDF4] dark:bg-[#0F291D]">
                <Target className="h-5 w-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-[15px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                  All caught up
                </p>
                <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
                  No pending priorities — set a new goal to keep the momentum going.
                </p>
              </div>
            </div>
          </Card>
        )}
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          3. PRIMARY MISSION — active mission with continue action
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="mission">
        <TodayMissionCard
          priority={topPriority}
          execution={execution}
          onContinue={() => {
            // UX-03: the canonical mission experience, not the goals list.
            router.push(continueRoute);
          }}
          onReviewBlockers={() => {
            // Blockers are mission state, so review them where missions live.
            router.push(missionRoute ?? '/goals');
          }}
        />
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          4. VEDMOULYA INSIGHT — what VedMoulya is noticing
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="insight">
        {hasInsight ? (
          <AISummaryCard aiContext={aiContext} />
        ) : (
          <div className="rounded-2xl border border-dashed border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5">
            <div className="flex items-center gap-2 text-[#64748B] dark:text-[#94A3B8]">
              <Sparkles className="h-4 w-4" />
              <p className="text-[13px]">
                Ask VedMoulya what to focus on next — insights appear here once there is activity to
                synthesize.
              </p>
            </div>
          </div>
        )}
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          5. LIFE MOMENTUM — career, learning, business
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="momentum">
        <LifeMomentum career={career} learning={learning} business={business} />
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          6. RECENT ACTIVITY — continuation surface
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="activity">
        <RecentActivity priorities={priorities} memory={memory} />
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          7. ASK VEDMOULYA — immediate AI access
          ═══════════════════════════════════════════════════════════════════ */}
      {userId && (
        <ErrorBoundary section="ask-ai">
          <AskAIInput userId={userId} />
        </ErrorBoundary>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DEEP DIVE — all detail sections, progressively disclosed
          ═══════════════════════════════════════════════════════════════════ */}
      <details className="group rounded-[20px] border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B]">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-semibold text-[#374151] dark:text-[#E2E8F0] hover:bg-[#F1F5F9] dark:hover:bg-[#0F172A] transition-colors rounded-[20px]">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5A9]" aria-hidden="true" />
            Explore more — journey, execution, modules, recommendations
          </span>
          <span
            className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8] transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          >
            ▾
          </span>
        </summary>
        <div className="space-y-6 px-4 pb-4">
          {/* Journey Overview */}
          <ErrorBoundary section="journey">
            <JourneyOverview
              execution={{
                completedToday: execution.completedToday,
                activePlans: execution.activePlans,
                totalEstimatedMinutes: execution.totalEstimatedMinutes,
              }}
              metrics={journeyMetrics}
            />
          </ErrorBoundary>

          {/* Execution + Decision Center */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ErrorBoundary section="execution">
              <ExecutionCenter execution={execution} />
            </ErrorBoundary>
            <ErrorBoundary section="decisions">
              <DecisionCenter decisions={decisions} />
            </ErrorBoundary>
          </div>

          {/* AI Insights + Stats */}
          <ErrorBoundary section="ai-insights">
            <AIInsights
              metrics={{ lifeScore: metrics.lifeScore }}
              execution={{
                completedToday: execution.completedToday,
                activePlans: execution.activePlans,
              }}
              memory={{ totalMemories: memory.totalMemories }}
              aiContext={aiContext}
              recommendationCount={recommendations.length}
            />
          </ErrorBoundary>

          {/* Recommendations + Notifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ErrorBoundary section="recommendations">
              <RecommendationsPanel recommendations={recommendations} />
            </ErrorBoundary>
            <ErrorBoundary section="notifications">
              <NotificationsPanel
                notifications={notifications}
                unreadCount={metrics.unreadNotifications}
              />
            </ErrorBoundary>
          </div>

          {/* Module Status Grid */}
          <ErrorBoundary section="module-status">
            <ModuleStatusGrid
              career={career}
              learning={learning}
              business={business}
              marketplace={marketplace}
            />
          </ErrorBoundary>

          {/* Memory Timeline */}
          <ErrorBoundary section="memory-timeline">
            <MemoryTimeline memory={memory} />
          </ErrorBoundary>

          {/* All Priorities */}
          <ErrorBoundary section="priorities">
            <PrioritiesList priorities={priorities} />
          </ErrorBoundary>
        </div>
      </details>

      {/* Data freshness footer */}
      <p className="text-center text-[12px] text-[#94A3B8] dark:text-[#64748B] pt-2">
        {dataUpdatedAt
          ? `Last synced ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'VedMoulya Life OS'}
      </p>
    </div>
  );
}
