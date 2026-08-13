// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Execution Explorer
// EPIC-004 / EI-005 — Enterprise Execution Orchestrator
// Converts an Execution Strategy (EI-004) into an executable workflow:
// execution graph (nodes, edges, stages, parallel groups, critical path,
// checkpoints), graph validation, scheduling, execution sessions with a state
// machine, monitoring, recovery planning, queue, and the worker fleet.
// Orchestrates execution — it never runs AI. Runtime engines (Hatchet,
// LangGraph, Temporal) plug in as adapters behind the RuntimeAdapter contract.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import dynamic from 'next/dynamic';
// Heavy tab views are lazy-loaded (BLD-016-B convention) so the initial
// /execution page bundle stays within the 50 kB budget.
const GraphStudioView = dynamic(
  () => import('./graph-studio-view.js').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => null },
);
const SessionsView = dynamic(
  () => import('./sessions-view.js').then((m) => ({ default: m.SessionsView })),
  { ssr: false, loading: () => null },
);
const WorkersView = dynamic(
  () => import('./workers-view.js').then((m) => ({ default: m.WorkersView })),
  { ssr: false, loading: () => null },
);
import { STATE_BADGE } from './explorer-data.js';
import { NODE_STATUS_STYLE } from './components.js';
import {
  Workflow,
  GitBranch,
  Layers,
  PlayCircle,
  Cpu,
  Users,
  Activity,
  Sparkles,
  ArrowRight,
  Map as MapIcon,
} from 'lucide-react';
import { useExecutionOrchestratorSummary } from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';

// ── Display Maps ────────────────────────────────────────────────────────────
// NODE_STATUS_STYLE moved to ./components.tsx (shared with the graph diagram).

// ── Graph Layout Helpers ────────────────────────────────────────────────────

// ── Page ────────────────────────────────────────────────────────────────────

export default function ExecutionPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setActiveSection('execution');
    setBreadcrumbs([{ label: 'Execution Orchestrator', href: '/execution' }, { label: 'Explore' }]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Execution Orchestrator..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[26px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
              Execution Orchestrator
            </h1>
            <Badge variant="ai" size="sm">
              EI-005
            </Badge>
          </div>
          <p className="text-[14px] md:text-[15px] text-[#64748B] dark:text-[#94A3B8] max-w-3xl">
            Converts any Execution Strategy into an executable workflow — graph, planner, scheduler,
            worker registry, queue, sessions, state machine, monitor, events, recovery, and
            validation. VedMoulya orchestrates execution; it never runs AI. Runtime engines
            (Hatchet, LangGraph, Temporal) remain adapters only.
          </p>
        </div>
        <Badge variant="info" size="sm" className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Orchestration-first — no AI execution
        </Badge>
      </div>

      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-1.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="graph">
            <GitBranch className="h-4 w-4 mr-1.5" /> Graph Studio
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <PlayCircle className="h-4 w-4 mr-1.5" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="workers">
            <Users className="h-4 w-4 mr-1.5" /> Workers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ErrorBoundary section="execution-overview">
            <ExecutionOverviewView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="graph">
          <ErrorBoundary section="execution-graph">
            <GraphStudioView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="sessions">
          <ErrorBoundary section="execution-sessions">
            <SessionsView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="workers">
          <ErrorBoundary section="execution-workers">
            <WorkersView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}

// ── TAB 1: Overview ─────────────────────────────────────────────────────────

function ExecutionOverviewView({ userId }: { userId: string }): React.JSX.Element {
  const { data: summary, isLoading, isError } = useExecutionOrchestratorSummary(userId);

  if (isLoading || !summary) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading Orchestrator Summary..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load the orchestrator summary
          </h2>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Execution Graphs"
          value={String(summary.totalGraphs)}
          icon={<GitBranch className="h-5 w-5 text-[#2B5FD9]" />}
          bg="bg-[#EFF4FE] dark:bg-[#1E3A8A]/40"
        />
        <StatCard
          label="Sessions"
          value={String(summary.totalSessions)}
          icon={<PlayCircle className="h-5 w-5 text-[#7C3AED]" />}
          bg="bg-[#F5F3FF] dark:bg-[#4C1D95]/40"
        />
        <StatCard
          label="Active Sessions"
          value={String(summary.activeSessions)}
          icon={<Activity className="h-5 w-5 text-[#F59E0B]" />}
          bg="bg-[#FFFBEB] dark:bg-[#78350F]/40"
        />
        <StatCard
          label="Workers"
          value={String(summary.totalWorkers)}
          icon={<Cpu className="h-5 w-5 text-[#22C55E]" />}
          bg="bg-[#F0FDF4] dark:bg-[#14532D]/40"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Session state distribution */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#2B5FD9]" /> Session State Machine
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.statusByState).map(([state, count]) => {
              const meta = STATE_BADGE[state] ?? { label: state, variant: 'default' as const };
              return (
                <Badge key={state} variant={meta.variant} size="sm" className="capitalize">
                  {meta.label}: {String(count)}
                </Badge>
              );
            })}
            {Object.keys(summary.statusByState).length === 0 && (
              <p className="text-[13px] text-[#94A3B8]">No sessions recorded yet.</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-[#F1F5F9] dark:border-[#334155] grid grid-cols-2 gap-2 text-[12px]">
            <OverviewMetric label="Completed" value={String(summary.completedSessions)} />
            <OverviewMetric label="Failed" value={String(summary.failedSessions)} />
            <OverviewMetric label="Idle workers" value={String(summary.idleWorkers)} />
            <OverviewMetric label="Busy workers" value={String(summary.busyWorkers)} />
          </div>
        </Card>

        {/* Pipeline explanation */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Workflow className="h-4 w-4 text-[#7C3AED]" /> The Execution Pipeline
          </h3>
          <div className="space-y-2">
            {[
              {
                label: 'Execution Strategy (EI-004)',
                detail: 'capabilities, providers, budgets, mode',
              },
              {
                label: 'Build Execution Graph',
                detail: 'nodes, edges, stages, parallel groups, critical path',
              },
              {
                label: 'Validate',
                detail: 'DAG + cycle detection, dependencies, budgets, capabilities',
              },
              {
                label: 'Create Session',
                detail: 'state machine: created → validated → ready → running → …',
              },
              {
                label: 'Schedule',
                detail: 'priority queue with parallel / sequential / delayed / retry entries',
              },
              {
                label: 'Monitor & Recover',
                detail: 'snapshots, events, checkpoints, resume / retry / rollback',
              },
              { label: 'Explain', detail: 'human-readable graph walkthrough for any stage' },
            ].map((step, idx) => (
              <div key={step.label} className="flex items-start gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED] text-[11px] font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                    {step.label}
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* State machine visual */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-[#2B5FD9]" /> Execution State Machine
        </h3>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          {[
            'created',
            'validated',
            'ready',
            'running',
            'waiting',
            'paused',
            'retrying',
            'completed',
            'failed',
            'cancelled',
          ].map((state, idx, arr) => (
            <React.Fragment key={state}>
              <span
                className={`px-2 py-1 rounded-md border font-medium ${
                  NODE_STATUS_STYLE[state] ?? 'border-[#E2E8F0]'
                }`}
              >
                {STATE_BADGE[state]?.label ?? state}
              </span>
              {idx < arr.length - 1 && (
                <ArrowRight className="h-3 w-3 shrink-0 text-[#CBD5E1] dark:text-[#475569]" />
              )}
            </React.Fragment>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
}): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium truncate">
            {label}
          </p>
          <p className="text-[20px] font-bold text-[#111827] dark:text-[#F8FAFC]">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#64748B] dark:text-[#94A3B8]">{label}</span>
      <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">{value}</span>
    </div>
  );
}

// ── TAB 2: Graph Studio (implemented below) ────────────────────────────────

// ── TAB 3: Sessions — lives in ./sessions-view.tsx ───────────────────────────

// ── TAB 4: Workers — lives in ./workers-view.tsx ────────────────────────────
