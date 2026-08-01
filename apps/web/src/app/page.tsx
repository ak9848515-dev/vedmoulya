// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Landing Page
// Composes all 9 Dashboard sections from real Life OS API data
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Loading, Card, Button } from '@vedmoulya/ui';
import {
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Quote,
  Target,
  TrendingUp,
  ArrowRight,
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
import { SignedOutCard } from '../components/SignedOutCard.js';
import { TopPriorityCard } from './sections/TopPriorityCard.js';
import { ExecutionCenter } from './sections/ExecutionCenter.js';
import { DecisionCenter } from './sections/DecisionCenter.js';

// Below-the-fold sections are lazy-loaded (same convention as AppShell's
// NotificationsDrawer/AICompanion) to keep the landing page chunk within the
// 50 kB bundle budget (BLD-016-B). `ssr: false` + null loading means they
// split into their own chunks and hydrate only when the route mounts.
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

// ── Session (from real auth, BLD-016C) ──────────────────────────────────────

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
  const hydrated = useAuthHydrated();
  const { user } = useAuthStore();
  const userId = user?.userId ?? '';
  const { data, isLoading, isError, error, refetch } = useLifeOSSnapshot(userId);

  // ── Hydration guard (prevents SSR/client mismatch from zustand persist) ──
  if (!hydrated) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loading label="Loading your Life OS..." size="lg" />
      </div>
    );
  }

  // ── Signed-Out State (real auth enforced — no token, no dashboard) ─────
  if (!user) {
    return <SignedOutCard />;
  }

  // ── Loading State ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loading label="Loading your Life OS..." size="lg" />
      </div>
    );
  }

  // ── Error State ───────────────────────────────────────────────────────
  if (isError || !data?.success) {
    const errorMessage = error?.message ?? 'Could not load your dashboard.';
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Card variant="standard" padding="lg" className="max-w-md text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-[#FEF2F2]">
              <AlertTriangle className="h-6 w-6 text-[#EF4444]" />
            </div>
            <h2 className="text-[18px] font-heading font-semibold text-[#111827]">
              Unable to Load Dashboard
            </h2>
            <p className="text-[14px] text-[#64748B]">{errorMessage}</p>
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

  // ── Extract typed data from snapshot ──────────────────────────────────
  const raw = data.data as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Card variant="standard" padding="lg" className="max-w-md text-center">
          <p className="text-[14px] text-[#64748B]">No dashboard data available.</p>
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

  // ── Render Sections ───────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-8">
      {/* ═══════════════════════════════════════════════════════════════════
          PREMIUM HERO: Greeting + Life Score + Daily Focus + Quote
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="hero">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1E4AA8] via-[#2B5FD9] to-[#5B8AEB] p-8 md:p-10">
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
                  <h1 className="text-[32px] md:text-[42px] font-heading font-bold text-white tracking-tight">
                    Good{' '}
                    {new Date().getHours() < 12
                      ? 'Morning'
                      : new Date().getHours() < 17
                        ? 'Afternoon'
                        : ' Evening'}
                    , <span className="text-[#A8C2F7]">{identity.displayName}</span>
                  </h1>
                  <Sparkles className="h-6 w-6 text-[#F59E0B]" />
                </div>
                <p className="text-[18px] text-[#D4E1FC] max-w-2xl leading-relaxed">
                  {identity.purpose ||
                    'Building a sustainable livelihood through knowledge, execution, and intelligent technology.'}
                </p>

                {/* Stats Row */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2">
                    <TrendingUp className="h-4 w-4 text-[#A8C2F7]" />
                    <span className="text-white text-[14px] font-medium">
                      Life Score:{' '}
                      <span className="text-[#A8C2F7] font-bold">{metrics.lifeScore}</span>/100
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2">
                    <Target className="h-4 w-4 text-[#A8C2F7]" />
                    <span className="text-white text-[14px] font-medium">
                      {execution.completedToday} tasks done today
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2">
                    <Quote className="h-4 w-4 text-[#A8C2F7]" />
                    <span className="text-white/80 text-[13px] italic">
                      Small steps lead to great achievements
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Continue Journey Button */}
            <div className="mt-8 flex items-center gap-4">
              <button className="inline-flex items-center gap-2 bg-white text-[#2B5FD9] px-6 py-3 rounded-full text-[15px] font-semibold hover:bg-[#F1F5F9] transition-all shadow-lg hover:shadow-xl">
                Continue Your Journey <ArrowRight className="h-4 w-4" />
              </button>
              <button className="inline-flex items-center gap-2 bg-white/15 text-white px-6 py-3 rounded-full text-[15px] font-medium hover:bg-white/25 transition-all">
                <Sparkles className="h-4 w-4" /> AI Summary
              </button>
            </div>

            {/* AI Context Summary */}
            {aiContext.contextSummary && (
              <div className="mt-6 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-[#F59E0B]" />
                  <span className="text-[13px] font-medium text-[#D4E1FC]">AI Context</span>
                </div>
                <p className="text-[14px] text-white/90 leading-relaxed">
                  {aiContext.contextSummary}
                </p>
              </div>
            )}
          </div>
        </section>
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: Today's Top Priority
          ═══════════════════════════════════════════════════════════════════ */}
      {topPriority && (
        <ErrorBoundary section="top-priority">
          <TopPriorityCard priority={topPriority} />
        </ErrorBoundary>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: Execution + Decision Center (two-column)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ErrorBoundary section="execution">
          <ExecutionCenter execution={execution} />
        </ErrorBoundary>
        <ErrorBoundary section="decisions">
          <DecisionCenter decisions={decisions} />
        </ErrorBoundary>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: Module Status Grid
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="module-status">
        <ModuleStatusGrid
          career={career}
          learning={learning}
          business={business}
          marketplace={marketplace}
        />
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5: Memory Timeline
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="memory-timeline">
        <MemoryTimeline memory={memory} />
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6: Journey Overview (daily/weekly/monthly + momentum)
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
          SECTION 7: Priorities List
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="priorities">
        <PrioritiesList priorities={priorities} />
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 8: AI Recommendations + Notifications (two-column)
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
          SECTION 9: AI Insights + Stats
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
          SECTION 10: Quick Actions
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="quick-actions">
        <QuickActions />
      </ErrorBoundary>
    </div>
  );
}
