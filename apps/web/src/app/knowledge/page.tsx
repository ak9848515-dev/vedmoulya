// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// The authoritative knowledge layer of VedMoulya. This screen exposes the
// Knowledge Dashboard, Explorer, Search, Relationship Explorer, Dependency
// Graph, Timeline, Version History (+ Diff Viewer), Trust Dashboard, Analytics,
// and Consumers — every item versioned, validated, searchable, explainable,
// traceable, and reusable by every Enterprise Intelligence Engine.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Tabs as TabsRoot, TabsList, TabsTrigger, TabsContent } from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import dynamic from 'next/dynamic';
// Heavy tab views are lazy-loaded (BLD-016-B convention) so the initial
// /knowledge page bundle stays within the 50 kB budget.
const DashboardView = dynamic(
  () => import('./dashboard-view.js').then((m) => ({ default: m.DashboardView })),
  { ssr: false, loading: () => null },
);
const ExplorerView = dynamic(
  () => import('./explorer-view.js').then((m) => ({ default: m.ExplorerView })),
  { ssr: false, loading: () => null },
);
const SearchView = dynamic(
  () => import('./search-view.js').then((m) => ({ default: m.SearchView })),
  { ssr: false, loading: () => null },
);
const RelationshipsView = dynamic(
  () => import('./relationships-view.js').then((m) => ({ default: m.RelationshipsView })),
  { ssr: false, loading: () => null },
);
const DependenciesView = dynamic(
  () => import('./dependencies-view.js').then((m) => ({ default: m.DependenciesView })),
  { ssr: false, loading: () => null },
);
const TimelineView = dynamic(
  () => import('./timeline-view.js').then((m) => ({ default: m.TimelineView })),
  { ssr: false, loading: () => null },
);
const VersionsView = dynamic(
  () => import('./versions-view.js').then((m) => ({ default: m.VersionsView })),
  { ssr: false, loading: () => null },
);
const TrustView = dynamic(() => import('./trust-view.js').then((m) => ({ default: m.TrustView })), {
  ssr: false,
  loading: () => null,
});
const AnalyticsView = dynamic(
  () => import('./analytics-view.js').then((m) => ({ default: m.AnalyticsView })),
  { ssr: false, loading: () => null },
);
const ConsumersView = dynamic(
  () => import('./consumers-view.js').then((m) => ({ default: m.ConsumersView })),
  { ssr: false, loading: () => null },
);
import {
  Library,
  ListChecks,
  Search,
  Share2,
  GitBranch,
  ScrollText,
  History,
  ShieldCheck,
  BarChart3,
  Users,
} from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Library },
  { id: 'explorer', label: 'Explorer', icon: ListChecks },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'relationships', label: 'Relationships', icon: Share2 },
  { id: 'dependencies', label: 'Dependencies', icon: GitBranch },
  { id: 'timeline', label: 'Timeline', icon: ScrollText },
  { id: 'versions', label: 'Versions', icon: History },
  { id: 'trust', label: 'Trust', icon: ShieldCheck },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'consumers', label: 'Consumers', icon: Users },
] as const;

export default function KnowledgePage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    setActiveSection('knowledge');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'Enterprise Knowledge Center' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse text-lg font-semibold text-slate-500">
          Loading Enterprise Knowledge Center…
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
          <Library className="h-4 w-4" />
          EPIC-004 · EI-009 · Enterprise Knowledge Intelligence Platform
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
          Enterprise Knowledge Center
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          The authoritative knowledge source used by every Enterprise Intelligence Engine. VedMoulya
          knows what it knows, where it came from, who uses it, whether it is trusted, whether it is
          current, what depends on it, and how it should be used.
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
        <TabsContent value="search" className="mt-4">
          <ErrorBoundary>
            <SearchView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="relationships" className="mt-4">
          <ErrorBoundary>
            <RelationshipsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="dependencies" className="mt-4">
          <ErrorBoundary>
            <DependenciesView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <ErrorBoundary>
            <TimelineView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="versions" className="mt-4">
          <ErrorBoundary>
            <VersionsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="trust" className="mt-4">
          <ErrorBoundary>
            <TrustView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <ErrorBoundary>
            <AnalyticsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="consumers" className="mt-4">
          <ErrorBoundary>
            <ConsumersView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
