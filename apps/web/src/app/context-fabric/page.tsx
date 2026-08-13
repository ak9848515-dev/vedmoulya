// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric Explorer
// APP-001 — Post-V1 Application Platform Layer
// The unified context abstraction: personal intelligence graph, business /
// enterprise context graph, permission-gated hybrid search, minimum-useful
// context packages, explanations, provenance, permissions and diagnostics.
// Answers: given this user, this goal, this task and this permission set —
// what information is relevant, where did it come from, why was it selected,
// and what is the minimum useful context package for the next agent/workflow?
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Tabs as TabsRoot, TabsList, TabsTrigger, TabsContent } from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import dynamic from 'next/dynamic';
// Heavy tab views are lazy-loaded (BLD-016-B convention) so the initial
// /context-fabric page bundle stays within the 50 kB budget.
const OverviewView = dynamic(
  () => import('./overview-view.js').then((m) => ({ default: m.OverviewView })),
  { ssr: false, loading: () => null },
);
const PersonalGraphView = dynamic(
  () => import('./personal-graph-view.js').then((m) => ({ default: m.PersonalGraphView })),
  { ssr: false, loading: () => null },
);
const BusinessGraphView = dynamic(
  () => import('./business-graph-view.js').then((m) => ({ default: m.BusinessGraphView })),
  { ssr: false, loading: () => null },
);
const SearchView = dynamic(
  () => import('./search-view.js').then((m) => ({ default: m.SearchView })),
  { ssr: false, loading: () => null },
);
const PackageView = dynamic(
  () => import('./package-view.js').then((m) => ({ default: m.PackageView })),
  { ssr: false, loading: () => null },
);
const ProvenanceView = dynamic(
  () => import('./provenance-view.js').then((m) => ({ default: m.ProvenanceView })),
  { ssr: false, loading: () => null },
);
const PermissionsView = dynamic(
  () => import('./permissions-view.js').then((m) => ({ default: m.PermissionsView })),
  { ssr: false, loading: () => null },
);
const DiagnosticsView = dynamic(
  () => import('./diagnostics-view.js').then((m) => ({ default: m.DiagnosticsView })),
  { ssr: false, loading: () => null },
);
import {
  LayoutDashboard,
  User,
  Building2,
  Search,
  Package,
  ScrollText,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'personal', label: 'Personal Graph', icon: User },
  { id: 'business', label: 'Business Graph', icon: Building2 },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'package', label: 'Context Package', icon: Package },
  { id: 'provenance', label: 'Provenance', icon: ScrollText },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
  { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
] as const;

export default function ContextFabricPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setActiveSection('context-fabric');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'Context & Personal Intelligence Fabric' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse text-lg font-semibold text-slate-500">
          Loading Context &amp; Personal Intelligence Fabric…
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
          <User className="h-4 w-4" />
          APP-001 · Post-V1 · Context &amp; Personal Intelligence Fabric
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
          Context &amp; Personal Intelligence Fabric
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          The unified context abstraction over personal context, enterprise context, memory,
          documents, knowledge, goals, tasks, projects, capabilities and execution history — with
          provenance, permission-aware retrieval and minimum-useful context packages for the next
          agent or workflow. No context item reaches an agent simply because it is technically
          searchable.
        </p>
      </header>

      <ErrorBoundary>
        <TabsRoot value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap gap-1">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                <tab.icon className="mr-1.5 h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <OverviewView userId={userId} />
          </TabsContent>
          <TabsContent value="personal">
            <PersonalGraphView userId={userId} />
          </TabsContent>
          <TabsContent value="business">
            <BusinessGraphView userId={userId} />
          </TabsContent>
          <TabsContent value="search">
            <SearchView userId={userId} />
          </TabsContent>
          <TabsContent value="package">
            <PackageView userId={userId} />
          </TabsContent>
          <TabsContent value="provenance">
            <ProvenanceView userId={userId} />
          </TabsContent>
          <TabsContent value="permissions">
            <PermissionsView userId={userId} />
          </TabsContent>
          <TabsContent value="diagnostics">
            <DiagnosticsView userId={userId} />
          </TabsContent>
        </TabsRoot>
      </ErrorBoundary>
    </div>
  );
}
