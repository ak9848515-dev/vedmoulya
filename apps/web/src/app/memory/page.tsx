// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// The Enterprise Memory Layer of VedMoulya. This screen exposes the Memory
// Dashboard, Explorer (capture), Retrieval Console, Timeline, Relationships &
// Memory Graph, Importance Dashboard, Usage Analytics, Compression Dashboard,
// and Retention Manager — every memory recorded, ranked, compressed,
// consolidated, cited, retained and retrieved by every Enterprise Intelligence
// Engine. Knowledge is authoritative facts; memory is evolving experience. The
// two systems remain architecturally separate but tightly integrated.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Tabs as TabsRoot, TabsList, TabsTrigger, TabsContent } from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import dynamic from 'next/dynamic';
// Heavy tab views are lazy-loaded (BLD-016-B convention) so the initial
// /memory page bundle stays within the 50 kB budget.
const DashboardView = dynamic(
  () => import('./dashboard-view.js').then((m) => ({ default: m.DashboardView })),
  { ssr: false, loading: () => null },
);
const ExplorerView = dynamic(
  () => import('./explorer-view.js').then((m) => ({ default: m.ExplorerView })),
  { ssr: false, loading: () => null },
);
const RetrievalView = dynamic(
  () => import('./retrieval-view.js').then((m) => ({ default: m.RetrievalView })),
  { ssr: false, loading: () => null },
);
const TimelineView = dynamic(
  () => import('./timeline-view.js').then((m) => ({ default: m.TimelineView })),
  { ssr: false, loading: () => null },
);
const RelationshipsView = dynamic(
  () => import('./relationships-view.js').then((m) => ({ default: m.RelationshipsView })),
  { ssr: false, loading: () => null },
);
const ImportanceView = dynamic(
  () => import('./importance-view.js').then((m) => ({ default: m.ImportanceView })),
  { ssr: false, loading: () => null },
);
const AnalyticsView = dynamic(
  () => import('./analytics-view.js').then((m) => ({ default: m.AnalyticsView })),
  { ssr: false, loading: () => null },
);
const CompressionView = dynamic(
  () => import('./compression-view.js').then((m) => ({ default: m.CompressionView })),
  { ssr: false, loading: () => null },
);
const RetentionView = dynamic(
  () => import('./retention-view.js').then((m) => ({ default: m.RetentionView })),
  { ssr: false, loading: () => null },
);
import {
  Brain,
  ListChecks,
  Search,
  ScrollText,
  Share2,
  Flame,
  BarChart3,
  FileArchive,
  Hourglass,
} from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Brain },
  { id: 'explorer', label: 'Explorer', icon: ListChecks },
  { id: 'retrieval', label: 'Retrieval', icon: Search },
  { id: 'timeline', label: 'Timeline', icon: ScrollText },
  { id: 'relationships', label: 'Relationships', icon: Share2 },
  { id: 'importance', label: 'Importance', icon: Flame },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'compression', label: 'Compression', icon: FileArchive },
  { id: 'retention', label: 'Retention', icon: Hourglass },
] as const;

export default function MemoryPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    setActiveSection('memory');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'Enterprise Memory Center' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse text-lg font-semibold text-slate-500">
          Loading Enterprise Memory Center…
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
          <Brain className="h-4 w-4" />
          EPIC-004 · EI-010 · Enterprise Memory Intelligence Platform
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
          Enterprise Memory Center
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          The Enterprise Memory Layer — it records, retrieves, ranks, compresses, consolidates and
          evolves experience across the entire operating system. VedMoulya remembers users,
          projects, goals, tasks, decisions, executions, provider performance, learning, context,
          knowledge usage and business outcomes. Knowledge is authoritative facts; memory is
          evolving experience.
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
        <TabsContent value="retrieval" className="mt-4">
          <ErrorBoundary>
            <RetrievalView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <ErrorBoundary>
            <TimelineView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="relationships" className="mt-4">
          <ErrorBoundary>
            <RelationshipsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="importance" className="mt-4">
          <ErrorBoundary>
            <ImportanceView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <ErrorBoundary>
            <AnalyticsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="compression" className="mt-4">
          <ErrorBoundary>
            <CompressionView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="retention" className="mt-4">
          <ErrorBoundary>
            <RetentionView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
