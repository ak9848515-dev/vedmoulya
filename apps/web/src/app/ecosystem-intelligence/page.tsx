// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem Intelligence
// EPIC-015 — VedMoulya Intelligence (DISCOVERY + EVIDENCE + SECURITY + LICENSE
// + FRESHNESS — never a static directory).
//
// For THIS task, is something significantly better available? The Intelligence
// layer evaluates configured providers, free providers, local models, GitHub
// projects and paid providers — quality-first, evidence-backed, and NEVER
// auto-activated. Better options produce explicit approval recommendations.
// Google auth stays untouched; GitHub connects through a separate
// least-privilege flow with a first-class permission review.
//
// Tabs:
//   Task Intelligence  — findBetterOption + the free/local/github/provider
//                        questions (the Brain's intelligence seam).
//   GitHub Connect     — Connect GitHub (permission review, verify, revoke,
//                        disconnect, repositories — secrets never shown).
//   Repository         — Security + license + acquisition pipeline.
//   Intelligence Memory— Lifecycle records + relevance-gated notifications.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Loading, Tabs as TabsRoot, TabsList, TabsTrigger, TabsContent } from '@vedmoulya/ui';
import { Sparkles, GitBranch, ShieldCheck, Database, Radar } from 'lucide-react';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { TaskIntelligencePanel } from './task-panel.js';
import { GitHubConnectPanel } from './github-panel.js';
import { RepositoryIntelligencePanel } from './repository-panel.js';
import { IntelligenceMemoryPanel } from './memory-panel.js';

export default function EcosystemIntelligencePage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('task');

  useEffect(() => {
    setActiveSection('ecosystem-intelligence');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'Ecosystem Intelligence' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Ecosystem Intelligence..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-slide-up">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/30">
            <Radar className="h-5 w-5 text-[#2B5FD9]" />
          </div>
          <div>
            <h1 className="text-[24px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
              Ecosystem Intelligence
            </h1>
            <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] max-w-3xl">
              I know what you are trying to accomplish. I checked what you already have, what is
              currently available, the evidence, security and licensing — here is what I recommend,
              why, what it requires, and you decide. Nothing is auto-activated; declining is never
              failure.
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" />
          Evidence-first · quality-first · never auto-activated
        </div>
      </div>

      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="task">
            <Radar className="h-4 w-4 mr-1.5" /> Task Intelligence
          </TabsTrigger>
          <TabsTrigger value="github">
            <GitBranch className="h-4 w-4 mr-1.5" /> GitHub Connect
          </TabsTrigger>
          <TabsTrigger value="repository">
            <ShieldCheck className="h-4 w-4 mr-1.5" /> Repository
          </TabsTrigger>
          <TabsTrigger value="memory">
            <Database className="h-4 w-4 mr-1.5" /> Intelligence Memory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="task">
          <ErrorBoundary section="ecosystem-intelligence-task">
            <TaskIntelligencePanel userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="github">
          <ErrorBoundary section="ecosystem-intelligence-github">
            <GitHubConnectPanel userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="repository">
          <ErrorBoundary section="ecosystem-intelligence-repository">
            <RepositoryIntelligencePanel userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="memory">
          <ErrorBoundary section="ecosystem-intelligence-memory">
            <IntelligenceMemoryPanel userId={userId} />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
