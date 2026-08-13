// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Learning Intelligence Dashboard
// EPIC-004 / EI-007 — Enterprise Learning Intelligence Platform
// VedMoulya learns from every execution: goals, tasks, capabilities,
// providers, contexts, strategies, sessions, quality scores, feedback, and
// business outcomes. This screen exposes the Learning Dashboard, Explorer,
// Timeline, Insights, Recommendations (with the human-approval workflow),
// and Analytics.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Tabs as TabsRoot, TabsList, TabsTrigger, TabsContent } from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import dynamic from 'next/dynamic';
// Heavy tab views are lazy-loaded (BLD-016-B convention) so the initial
// /learning-intelligence page bundle stays within the 50 kB budget.
const DashboardView = dynamic(
  () => import('./dashboard-view.js').then((m) => ({ default: m.DashboardView })),
  { ssr: false, loading: () => null },
);
const ExplorerView = dynamic(
  () => import('./explorer-view.js').then((m) => ({ default: m.ExplorerView })),
  { ssr: false, loading: () => null },
);
const TimelineView = dynamic(
  () => import('./timeline-view.js').then((m) => ({ default: m.TimelineView })),
  { ssr: false, loading: () => null },
);
const InsightsView = dynamic(
  () => import('./insights-view.js').then((m) => ({ default: m.InsightsView })),
  { ssr: false, loading: () => null },
);
const RecommendationsView = dynamic(
  () => import('./recommendations-view.js').then((m) => ({ default: m.RecommendationsView })),
  { ssr: false, loading: () => null },
);
const AnalyticsView = dynamic(
  () => import('./analytics-view.js').then((m) => ({ default: m.AnalyticsView })),
  { ssr: false, loading: () => null },
);
import { GraduationCap, ListChecks, History, Lightbulb, Sparkles, BarChart3 } from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: GraduationCap },
  { id: 'explorer', label: 'Explorer', icon: ListChecks },
  { id: 'timeline', label: 'Timeline', icon: History },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const;

export default function LearningIntelligencePage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    setActiveSection('learning-intelligence');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'Learning Intelligence' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse text-lg font-semibold text-slate-500">
          Loading Learning Intelligence…
        </div>
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  return (
    <div className="content-container py-6">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-[#2B5FD9]">
          <GraduationCap className="h-4 w-4" />
          EPIC-004 · EI-007 · Enterprise Learning Intelligence Platform
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
          Enterprise Learning Intelligence
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          VedMoulya learns from every execution. Outcomes across goals, tasks, capabilities,
          providers, contexts, strategies, sessions, quality scores, feedback, and business results
          become models, insights, recommendations, and reports — and learning never bypasses human
          approval.
        </p>
      </header>

      <TabsRoot value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <ErrorBoundary>
            <DashboardView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="explorer" className="mt-4">
          <ErrorBoundary>
            <ExplorerView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <ErrorBoundary>
            <TimelineView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="insights" className="mt-4">
          <ErrorBoundary>
            <InsightsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="recommendations" className="mt-4">
          <ErrorBoundary>
            <RecommendationsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <ErrorBoundary>
            <AnalyticsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
