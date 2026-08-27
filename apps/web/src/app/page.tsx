// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Landing Page
// Composes all Life OS sections from real API data
// BLD-016-B — Dashboard Landing Experience
// MOB-002 — Production Mobile Experience:
//   • premium welcome screen (hero) + user profile card
//   • today's mission + AI summary cards
//   • quick actions wired to module routes
//   • loading skeletons, graceful empty states, error states
//   • pull-to-refresh, offline cache fallback, auto retry on reconnect
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loading, Card, Button } from '@vedmoulya/ui';
import {
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Quote,
  Target,
  TrendingUp,
  ArrowRight,
  Users,
  BookOpen,
  Brain,
  BarChart3,
  Store,
  CloudOff,
} from 'lucide-react';
import { useLifeOSSnapshot } from '../lib/api-client.js';
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

// ── Section Components ───────────────────────────────────────────────────────

import dynamic from 'next/dynamic';
import { ErrorBoundary } from '../components/ErrorBoundary.js';
import { SignInRedirect } from '../components/SignInRedirect.js';
import { TopPriorityCard } from './sections/TopPriorityCard.js';
import { ExecutionCenter } from './sections/ExecutionCenter.js';
import { DecisionCenter } from './sections/DecisionCenter.js';
import { ProfileCard } from './sections/ProfileCard.js';
import { TodayMissionCard } from './sections/TodayMissionCard.js';
import { AISummaryCard } from './sections/AISummaryCard.js';
import { AskAIInput } from './sections/AskAIInput.js';
import { DashboardSkeleton } from './sections/DashboardSkeleton.js';
import { usePullToRefresh } from '../lib/use-pull-to-refresh.js';
import { markStartup, STARTUP_MARKS } from '../lib/startup.js';
import {
  cacheDashboardSnapshot,
  readCachedDashboard,
  type CachedDashboardEntry,
} from '../lib/dashboard-cache.js';

// Below-the-fold sections are lazy-loaded to keep the landing chunk small.
const ModuleStatusGrid = dynamic(
  () => import('./sections/ModuleStatusGrid.js').then((mod) => ({ default: mod.ModuleStatusGrid })),
  { ssr: false, loading: () => null },
);
const MemoryTimeline = dynamic(
  () => import('./sections/MemoryTimeline.js').then((mod) => ({ default: mod.MemoryTimeline })),
  { ssr: false, loading: () => null },
);
const JourneyOverview = dynamic(
  () => import('./sections/JourneyOverview.js').then((mod) => ({ default: mod.JourneyOverview })),
  { ssr: false, loading: () => null },
);
const PrioritiesList = dynamic(
  () => import('./sections/PrioritiesList.js').then((mod) => ({ default: mod.PrioritiesList })),
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
const AIInsights = dynamic(
  () => import('./sections/AIInsights.js').then((mod) => ({ default: mod.AIInsights })),
  { ssr: false, loading: () => null },
);
const QuickActions = dynamic(
  () => import('./sections/QuickActions.js').then((mod) => ({ default: mod.QuickActions })),
  { ssr: false, loading: () => null },
);
import type { QuickAction } from './sections/QuickActions.js';

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

// ── Home Page ───────────────────────────────────────────────────────────────

export default function Home(): React.JSX.Element {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, sessionReady, offline } = useAuthStore();
  const userId = user?.userId ?? '';
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useLifeOSSnapshot(userId);

  // ── Offline cache (MOB-002) ─────────────────────────────────────────────
  const [cachedEntry, setCachedEntry] = useState<CachedDashboardEntry | null>(null);
  const usingCache = !data && cachedEntry !== null;

  // Write the last successful snapshot to the offline cache.
  useEffect(() => {
    if (data?.success && data.data) {
      cacheDashboardSnapshot(data.data);
      setCachedEntry(null);
      markStartup(STARTUP_MARKS.firstData);
    }
  }, [data]);

  // When the live query fails or the device is offline, fall back to cache.
  useEffect(() => {
    if ((isError || offline) && !data) {
      setCachedEntry(readCachedDashboard());
    }
  }, [isError, offline, data]);

  // Re-sync on explicit retry (offline banner button).
  useEffect(() => {
    const onRetry = (): void => {
      void refetch();
    };
    window.addEventListener('vedmoulya:retry-sync', onRetry);
    return (): void => {
      window.removeEventListener('vedmoulya:retry-sync', onRetry);
    };
  }, [refetch]);

  // ── Pull-to-refresh (MOB-002) ───────────────────────────────────────────
  const pullToRefresh = usePullToRefresh({ onRefresh: refetch });

  // ── Hydration guard (prevents SSR/client mismatch) ──────────────────────
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loading label="Loading your Life OS..." size="lg" />
      </div>
    );
  }

  // ── Signed-Out State (real auth enforced — no token, no dashboard) ──────
  if (!user) {
    return <SignInRedirect />;
  }

  // ── Loading State → skeleton placeholders ───────────────────────────────
  if (isLoading && !usingCache) {
    return <DashboardSkeleton />;
  }

  // ── Error State (with cached fallback when available) ───────────────────
  // When the query failed AND no fresh-enough cache exists, show the error UI.
  // (If a cache exists, `usingCache` is true and we render from it below.)
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
              Unable to Load Dashboard
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
            No dashboard data available yet.
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

  // ── Journey Metrics (derived or from API) ─────────────────────────────
  const rawMetrics = raw.metrics as Record<string, unknown> | undefined;
  const journeyMetrics = {
    ...metrics,
    streak: rawMetrics?.streak as number | undefined,
    weeklyCompletion: rawMetrics?.weeklyCompletion as number | undefined,
    monthlyCompletion: rawMetrics?.monthlyCompletion as number | undefined,
    consistency: rawMetrics?.consistency as number | undefined,
    momentum: rawMetrics?.momentum as number | undefined,
  };

  // ── Quick actions wired to real routes (MOB-002) ───────────────────────
  const scrollToId = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const quickActions: QuickAction[] = [
    {
      label: 'Continue Mission',
      icon: <Target className="h-4 w-4" />,
      variant: 'primary',
      onClick: (): void => {
        scrollToId('todays-mission');
      },
    },
    {
      label: 'Review Career',
      icon: <Users className="h-4 w-4" />,
      variant: 'secondary',
      onClick: (): void => {
        router.push('/career');
      },
    },
    {
      label: 'Start Learning',
      icon: <BookOpen className="h-4 w-4" />,
      variant: 'secondary',
      onClick: (): void => {
        router.push('/learning');
      },
    },
    {
      label: 'Review Decisions',
      icon: <Brain className="h-4 w-4" />,
      variant: 'secondary',
      onClick: (): void => {
        scrollToId('decisions');
      },
    },
    {
      label: 'View Business',
      icon: <BarChart3 className="h-4 w-4" />,
      variant: 'ghost',
      onClick: (): void => {
        router.push('/business');
      },
    },
    {
      label: 'Browse Marketplace',
      icon: <Store className="h-4 w-4" />,
      variant: 'ghost',
      onClick: (): void => {
        router.push('/marketplace');
      },
    },
  ];

  const cacheAgeMinutes = cachedEntry
    ? Math.max(1, Math.round((Date.now() - cachedEntry.fetchedAt) / 60000))
    : 0;

  // ── Render Sections ───────────────────────────────────────────────────
  return (
    <div ref={pullToRefresh.pageRef} className="relative space-y-5 md:space-y-8 pb-4 md:pb-8">
      {/* ── Pull-to-refresh indicator (MOB-002) ───────────────────────── */}
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

      {/* ── Cached-data notice (MOB-002) ──────────────────────────────── */}
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
          USER PROFILE CARD (MOB-002)
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="profile">
        <ProfileCard identity={identity} fallbackEmail={user.email} />
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          PREMIUM HERO: Greeting + Life Score + Daily Focus + Quote
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="hero">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1E4AA8] via-[#2B5FD9] to-[#0EA5A9] p-6 md:p-10 animate-slide-up">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                'radial-gradient(circle at 25% 25%, white 0%, transparent 50%), radial-gradient(circle at 75% 75%, white 0%, transparent 50%)',
            }}
          />
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-[26px] md:text-[42px] font-heading font-bold text-white tracking-tight">
                    Good{' '}
                    {new Date().getHours() < 12
                      ? 'Morning'
                      : new Date().getHours() < 17
                        ? 'Afternoon'
                        : 'Evening'}
                    , <span className="text-[#A8C2F7]">{identity.displayName}</span>
                  </h1>
                  <Sparkles className="h-6 w-6 text-[#F59E0B]" />
                </div>
                <p className="text-[15px] md:text-[18px] text-[#D4E1FC] max-w-2xl leading-relaxed">
                  {identity.purpose ||
                    'Building a sustainable livelihood through knowledge, execution, and intelligent technology.'}
                </p>

                {/* Stats Row */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3.5 py-1.5">
                    <TrendingUp className="h-4 w-4 text-[#A8C2F7]" />
                    <span className="text-white text-[13px] md:text-[14px] font-medium">
                      Life Score:{' '}
                      <span className="text-[#A8C2F7] font-bold">{metrics.lifeScore}</span>/100
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3.5 py-1.5">
                    <Target className="h-4 w-4 text-[#A8C2F7]" />
                    <span className="text-white text-[13px] md:text-[14px] font-medium">
                      {execution.completedToday} tasks done today
                    </span>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3.5 py-1.5">
                    <Quote className="h-4 w-4 text-[#A8C2F7]" />
                    <span className="text-white/80 text-[13px] italic">
                      Small steps lead to great achievements
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Continue Journey Button */}
            <div className="mt-6 md:mt-8 flex items-center gap-3">
              <button
                onClick={() => {
                  scrollToId('todays-mission');
                }}
                className="inline-flex items-center gap-2 bg-white text-[#2B5FD9] px-5 py-2.5 md:px-6 md:py-3 rounded-full text-[14px] md:text-[15px] font-semibold hover:bg-[#F1F5F9] transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                Continue Your Journey <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  scrollToId('ai-summary');
                }}
                className="inline-flex items-center gap-2 bg-white/15 text-white px-5 py-2.5 md:px-6 md:py-3 rounded-full text-[14px] md:text-[15px] font-medium hover:bg-white/25 transition-all active:scale-95"
              >
                <Sparkles className="h-4 w-4" /> AI Summary
              </button>
            </div>
          </div>
        </section>
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          ASK — immediate AI readiness (SPRINT-048)
          A premium ask bar that opens the existing AI Companion with the
          typed question — no provider setup required to ask. The readiness
          chip reflects the REAL provider runtime (never a fabricated state).
          ═══════════════════════════════════════════════════════════════════ */}
      {userId && (
        <ErrorBoundary section="ask-ai">
          <AskAIInput userId={userId} />
        </ErrorBoundary>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          NOW — what matters this moment (SPRINT-043C IA tier)
          ═══════════════════════════════════════════════════════════════════ */}
      <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0EA5A9] dark:text-[#66D0D3]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5A9]" aria-hidden="true" />
        Now
      </p>

      {/* ═══════════════════════════════════════════════════════════════════
          TODAY'S MISSION (MOB-002)
          ═══════════════════════════════════════════════════════════════════ */}
      <div id="todays-mission">
        <ErrorBoundary section="mission">
          <TodayMissionCard
            priority={topPriority}
            execution={execution}
            onContinue={() => {
              router.push('/goals');
            }}
            onReviewBlockers={() => {
              router.push('/goals');
            }}
          />
        </ErrorBoundary>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          AI SUMMARY (MOB-002)
          ═══════════════════════════════════════════════════════════════════ */}
      <div id="ai-summary">
        <ErrorBoundary section="ai-summary">
          <AISummaryCard aiContext={aiContext} />
        </ErrorBoundary>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TOP PRIORITY (when a mission card isn't enough)
          ═══════════════════════════════════════════════════════════════════ */}
      {topPriority && (
        <ErrorBoundary section="top-priority">
          <TopPriorityCard
            priority={topPriority}
            onContinue={() => {
              router.push('/goals');
            }}
            onReviewBlockers={() => {
              router.push('/goals');
            }}
          />
        </ErrorBoundary>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Execution + Decision Center (two-column)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ErrorBoundary section="execution">
          <ExecutionCenter execution={execution} />
        </ErrorBoundary>
        <div id="decisions">
          <ErrorBoundary section="decisions">
            <DecisionCenter decisions={decisions} />
          </ErrorBoundary>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PROGRESS — Journey + Execution overview
          ═══════════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════════
          OPPORTUNITIES & SIGNALS — AI Recommendations + Notifications
          ═══════════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════════
          INTELLIGENCE — AI Insights + Stats
          ═══════════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════════
          DEEP DIVE — secondary overview, progressively disclosed
          (Module status · Memory timeline · Priorities · Quick actions)
          All capabilities remain reachable; only the initial viewport is
          decluttered (SPRINT-043C information-architecture principle).
          ═══════════════════════════════════════════════════════════════════ */}
      <details className="group rounded-[20px] border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B]">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-semibold text-[#374151] dark:text-[#E2E8F0] hover:bg-[#F1F5F9] dark:hover:bg-[#0F172A] transition-colors rounded-[20px]">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5A9]" aria-hidden="true" />
            Deep dive — module status, memory, priorities, quick actions
          </span>
          <span
            className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8] transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          >
            ▾
          </span>
        </summary>
        <div className="space-y-5 px-4 pb-4">
          <ErrorBoundary section="module-status">
            <ModuleStatusGrid
              career={career}
              learning={learning}
              business={business}
              marketplace={marketplace}
            />
          </ErrorBoundary>
          <ErrorBoundary section="memory-timeline">
            <MemoryTimeline memory={memory} />
          </ErrorBoundary>
          <ErrorBoundary section="priorities">
            <PrioritiesList priorities={priorities} />
          </ErrorBoundary>
          <ErrorBoundary section="quick-actions">
            <QuickActions actions={quickActions} />
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
