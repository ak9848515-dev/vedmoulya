// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System Dashboard
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The unified view of the complete Enterprise Operating System: every engine,
// its dependency matrix, the 15-stage event-flow pipeline, cross-engine
// integration pairs, repositories, diagnostics, performance and the persisted
// health snapshots — one operating system, no isolated components.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Tabs as TabsRoot, TabsList, TabsTrigger, TabsContent } from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import dynamic from 'next/dynamic';
// Heavy tab views are lazy-loaded (BLD-016-B convention) so the initial
// /os page bundle stays within the 50 kB budget.
const DashboardView = dynamic(
  () => import('./dashboard-view.js').then((m) => ({ default: m.DashboardView })),
  { ssr: false, loading: () => null },
);
const PipelineView = dynamic(
  () => import('./pipeline-view.js').then((m) => ({ default: m.PipelineView })),
  { ssr: false, loading: () => null },
);
const DependenciesView = dynamic(
  () => import('./dependencies-view.js').then((m) => ({ default: m.DependenciesView })),
  { ssr: false, loading: () => null },
);
const DiagnosticsView = dynamic(
  () => import('./diagnostics-view.js').then((m) => ({ default: m.DiagnosticsView })),
  { ssr: false, loading: () => null },
);
const PerformanceView = dynamic(
  () => import('./performance-view.js').then((m) => ({ default: m.PerformanceView })),
  { ssr: false, loading: () => null },
);
const SnapshotsView = dynamic(
  () => import('./snapshots-view.js').then((m) => ({ default: m.SnapshotsView })),
  { ssr: false, loading: () => null },
);
import { MonitorCog, Workflow, Share2, Stethoscope, Gauge, History } from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: MonitorCog },
  { id: 'pipeline', label: 'Pipeline', icon: Workflow },
  { id: 'dependencies', label: 'Dependencies', icon: Share2 },
  { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'snapshots', label: 'Snapshots', icon: History },
] as const;

export default function OSPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    setActiveSection('os');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'Enterprise Operating System' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse text-lg font-semibold text-slate-500">
          Loading Enterprise Operating System…
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
          <MonitorCog className="h-4 w-4" />
          EPIC-005 · OS-001 · Enterprise Operating System Integration
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
          Enterprise Operating System
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          The eleven Enterprise Intelligence Engines operating as one system. This dashboard
          integrates, validates, optimizes and certifies the complete platform — engine health, the
          dependency matrix, the 15-stage event-flow pipeline, cross-engine integration pairs,
          repository readiness, diagnostics and performance. No new engines, no isolated components
          — every engine consumes shared contracts, DTOs and repositories.
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
        <TabsContent value="pipeline" className="mt-4">
          <ErrorBoundary>
            <PipelineView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="dependencies" className="mt-4">
          <ErrorBoundary>
            <DependenciesView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="diagnostics" className="mt-4">
          <ErrorBoundary>
            <DiagnosticsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <ErrorBoundary>
            <PerformanceView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="snapshots" className="mt-4">
          <ErrorBoundary>
            <SnapshotsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
