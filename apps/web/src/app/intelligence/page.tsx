// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Integration Dashboard
// EPIC-004 / EI-006 / INT-001 — Enterprise Intelligence Integration Platform
// Visualizes the complete Enterprise Intelligence pipeline:
//   Goal → Capabilities → Providers → Context → Execution Strategy →
//   Execution Graph → Execution Session
// All connected. No AI calls. Integration only.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  Select,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
} from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
  Zap,
  Network,
  Target,
  Package,
  Cpu,
  Database,
  Workflow,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Shield,
} from 'lucide-react';
import {
  useIntelligenceDashboard,
  useIntelligencePipelineList,
  useBuildIntelligencePipeline,
} from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import type { PipelineDTO, PipelineSummaryDTO, EngineStatusDTO } from '@vedmoulya/intelligence';
// Deep import (not the package barrel): PIPELINE_CATALOG lives in a pure
// constant module. Importing it through the barrel would pull the full
// engine composition graph (PipelineBuilderService → @vedmoulya/ai →
// @vedmoulya/core → node:* built-ins) into the client bundle.
import { PIPELINE_CATALOG } from '@vedmoulya/intelligence/catalog/pipeline-catalog';

const PIPELINE_STAGES = [
  { key: 'goal', label: 'Goal', icon: Target, color: '#2B5FD9' },
  { key: 'capabilities', label: 'Capabilities', icon: Package, color: '#7C3AED' },
  { key: 'providers', label: 'Providers', icon: Cpu, color: '#0D9488' },
  { key: 'context', label: 'Context', icon: Database, color: '#F59E0B' },
  { key: 'strategy', label: 'Strategy', icon: Workflow, color: '#EC4899' },
  { key: 'execution-graph', label: 'Execution Graph', icon: Network, color: '#22C55E' },
  { key: 'execution-session', label: 'Session', icon: LayoutGrid, color: '#3B82F6' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  ready: 'bg-[#22C55E] text-white',
  degraded: 'bg-[#F59E0B] text-white',
  unknown: 'bg-[#94A3B8] text-white',
};

export default function IntelligencePage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    setActiveSection('intelligence');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'Integration Platform' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Enterprise Intelligence Platform..." size="lg" />
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
              Enterprise Intelligence
            </h1>
            <Badge variant="ai" size="sm">
              EI-006 / INT-001
            </Badge>
          </div>
          <p className="text-[14px] md:text-[15px] text-[#64748B] dark:text-[#94A3B8] max-w-3xl">
            Integrates every Enterprise Intelligence engine into one orchestrated pipeline: Goal →
            Capabilities → Providers → Context → Execution Strategy → Execution Graph → Execution
            Session. Plans and validates end-to-end readiness — never executes, never calls AI.
          </p>
        </div>
        <Badge variant="info" size="sm" className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Integration only — no AI execution
        </Badge>
      </div>

      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">
            <BarChart3 className="h-4 w-4 mr-1.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="pipelines">
            <Network className="h-4 w-4 mr-1.5" /> Pipelines
          </TabsTrigger>
          <TabsTrigger value="build">
            <Zap className="h-4 w-4 mr-1.5" /> Build Pipeline
          </TabsTrigger>
          <TabsTrigger value="engines">
            <Cpu className="h-4 w-4 mr-1.5" /> Engine Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <ErrorBoundary section="intelligence-dashboard">
            <DashboardView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="pipelines">
          <ErrorBoundary section="intelligence-pipelines">
            <PipelinesView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="build">
          <ErrorBoundary section="intelligence-build">
            <BuildPipelineView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="engines">
          <ErrorBoundary section="intelligence-engines">
            <EngineStatusView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}

// ── TAB 1: Dashboard Overview ───────────────────────────────────────────────

function DashboardView({ userId }: { userId: string }): React.JSX.Element {
  const { data: dashboard, isLoading, isError, refetch } = useIntelligenceDashboard(userId);

  if (isLoading || !dashboard) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading Enterprise Intelligence Dashboard..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load the Intelligence Dashboard
          </h2>
          <button
            onClick={() => {
              void refetch();
            }}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4] transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Engines"
          value={String(dashboard.engineStatus.length)}
          icon={<Cpu className="h-5 w-5 text-[#2B5FD9]" />}
          bg="bg-[#EFF4FE] dark:bg-[#1E3A8A]/40"
        />
        <StatCard
          label="Pipelines"
          value={String(dashboard.pipelineSummary.total)}
          icon={<Network className="h-5 w-5 text-[#7C3AED]" />}
          bg="bg-[#F5F3FF] dark:bg-[#4C1D95]/40"
        />
        <StatCard
          label="Ready"
          value={String(dashboard.pipelineSummary.ready)}
          icon={<CheckCircle2 className="h-5 w-5 text-[#22C55E]" />}
          bg="bg-[#F0FDF4] dark:bg-[#14532D]/40"
        />
        <StatCard
          label="Failed"
          value={String(dashboard.pipelineSummary.failed)}
          icon={<XCircle className="h-5 w-5 text-[#EF4444]" />}
          bg="bg-[#FEF2F2] dark:bg-[#450A0A]/40"
        />
      </div>

      {/* Pipeline Flow Visualization */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-4 flex items-center gap-2">
          <Network className="h-4 w-4 text-[#2B5FD9]" /> Enterprise Intelligence Pipeline Flow
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {PIPELINE_STAGES.map((stage, idx) => (
            <React.Fragment key={stage.key}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
                <stage.icon className="h-4 w-4" style={{ color: stage.color }} />
                <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                  {stage.label}
                </span>
              </div>
              {idx < PIPELINE_STAGES.length - 1 && (
                <ArrowRight className="h-4 w-4 shrink-0 text-[#CBD5E1] dark:text-[#475569]" />
              )}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* Engine Status Grid */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-[#7C3AED]" /> Engine Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dashboard.engineStatus.map((engine) => (
            <EngineStatusCard key={engine.engine} engine={engine} />
          ))}
        </div>
      </Card>

      {/* Quick Pipeline Summary */}
      {dashboard.pipelines.length > 0 && (
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#22C55E]" /> Recent Pipelines
          </h3>
          <div className="space-y-2">
            {dashboard.pipelines.slice(0, 5).map((p) => (
              <PipelineRow key={p.pipelineId} pipeline={p} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── TAB 2: Pipelines List ──────────────────────────────────────────────────

function PipelinesView({ userId }: { userId: string }): React.JSX.Element {
  const { data: pipelines, isLoading, isError, refetch } = useIntelligencePipelineList(userId);

  if (isLoading || !pipelines) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading pipelines..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load pipelines
          </h2>
        </Card>
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <EmptyState
        icon={<Network className="h-8 w-8" />}
        title="No pipelines built yet"
        description="Build your first Enterprise Intelligence pipeline from the Build tab."
      />
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          {String(pipelines.length)} pipeline(s) built
        </p>
        <button
          onClick={() => {
            void refetch();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {pipelines.map((pipeline) => (
          <PipelineDetailCard key={pipeline.pipelineId} pipeline={pipeline} />
        ))}
      </div>
    </div>
  );
}

// ── TAB 3: Build Pipeline ──────────────────────────────────────────────────

function BuildPipelineView({ userId }: { userId: string }): React.JSX.Element {
  const [goalId, setGoalId] = useState('goal_blog_seed');
  const buildPipeline = useBuildIntelligencePipeline();
  const [built, setBuilt] = useState<PipelineDTO | null>(null);

  const handleBuild = (): void => {
    void buildPipeline
      .mutateAsync({ userId, goalId })
      .then((result) => {
        const data = (result as { data?: PipelineDTO }).data;
        if (data) setBuilt(data);
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Goal ID
            </label>
            <Select
              value={goalId}
              onChange={(e) => {
                setGoalId(e.target.value);
              }}
              aria-label="Select a goal to build a pipeline for"
              options={PIPELINE_CATALOG.map((entry) => ({
                value: entry.goalId,
                label: `${entry.label} (${entry.goalId})`,
              }))}
            />
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              Select a goal from the seed catalog. The pipeline composes all six engines — no AI
              calls.
            </p>
          </div>
          <button
            onClick={handleBuild}
            disabled={buildPipeline.isPending || !goalId}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4] transition-colors disabled:opacity-50"
          >
            <Zap className="h-4 w-4" /> Build Pipeline
          </button>
        </div>
        {buildPipeline.isError && (
          <p className="mt-3 text-[13px] text-[#EF4444]">{buildPipeline.error.message}</p>
        )}
      </Card>

      {built && (
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#22C55E]" /> Pipeline Built
            </h3>
            <Badge variant={built.status === 'ready' ? 'success' : 'danger'} size="sm">
              {built.status}
            </Badge>
          </div>
          <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] mb-3">
            {built.pipelineId} — {built.goal}
          </p>

          {/* Steps */}
          <div className="space-y-2">
            {built.steps.map((step) => (
              <div
                key={step.stage}
                className="flex items-start gap-3 p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
              >
                {step.status === 'passed' ? (
                  <CheckCircle2 className="h-4 w-4 text-[#22C55E] mt-0.5 shrink-0" />
                ) : step.status === 'failed' ? (
                  <XCircle className="h-4 w-4 text-[#EF4444] mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-[#F59E0B] mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] capitalize">
                    {step.stage.replace(/-/g, ' ')}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Validation */}
          <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-[#334155]">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-[#2B5FD9]" />
              <span className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                Validation
              </span>
              <Badge variant={built.validation.passed ? 'success' : 'danger'} size="sm">
                {built.validation.passed ? 'Passed' : 'Failed'}
              </Badge>
            </div>
            <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              {built.validation.summary}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── TAB 4: Engine Status ───────────────────────────────────────────────────

function EngineStatusView({ userId }: { userId: string }): React.JSX.Element {
  const { data: dashboard, isLoading, isError } = useIntelligenceDashboard(userId);

  if (isLoading || !dashboard) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading engine status..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load engine status
          </h2>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dashboard.engineStatus.map((engine) => (
          <EngineDetailCard key={engine.engine} engine={engine} />
        ))}
      </div>
    </div>
  );
}

// ── Shared Components ───────────────────────────────────────────────────────

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

function EngineStatusCard({ engine }: { engine: EngineStatusDTO }): React.JSX.Element {
  return (
    <div className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC]">
          {engine.label}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[engine.status]}`}
        >
          {engine.status}
        </span>
      </div>
      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{engine.summary}</p>
    </div>
  );
}

function EngineDetailCard({ engine }: { engine: EngineStatusDTO }): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          {engine.label}
        </h3>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[engine.status]}`}
        >
          {engine.status}
        </span>
      </div>
      <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] mb-3">{engine.summary}</p>
      {Object.keys(engine.counts).length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(engine.counts).map(([key, count]) => (
            <div key={key} className="flex items-center justify-between text-[11px]">
              <span className="text-[#64748B] dark:text-[#94A3B8] capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
                {String(count)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PipelineRow({ pipeline }: { pipeline: PipelineSummaryDTO }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
          {pipeline.goal}
        </p>
        <p className="text-[10px] text-[#94A3B8]">{pipeline.pipelineId}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={pipeline.status === 'ready' ? 'success' : 'danger'} size="sm">
          {pipeline.status}
        </Badge>
        <Badge variant={pipeline.validated ? 'success' : 'warning'} size="sm">
          {pipeline.validated ? 'Valid' : 'Invalid'}
        </Badge>
      </div>
    </div>
  );
}

function PipelineDetailCard({ pipeline }: { pipeline: PipelineDTO }): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
            {pipeline.goal}
          </h3>
          <p className="text-[10px] text-[#94A3B8]">{pipeline.goalId}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={pipeline.status === 'ready' ? 'success' : 'danger'} size="sm">
            {pipeline.status}
          </Badge>
        </div>
      </div>

      {/* Steps mini-visual */}
      <div className="flex flex-wrap gap-1 mb-3">
        {pipeline.steps.map((step) => (
          <span
            key={step.stage}
            className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
              step.status === 'passed'
                ? 'bg-[#F0FDF4] dark:bg-[#14532D]/40 text-[#22C55E]'
                : step.status === 'failed'
                  ? 'bg-[#FEF2F2] dark:bg-[#450A0A]/40 text-[#EF4444]'
                  : 'bg-[#F8FAFC] dark:bg-[#0F172A] text-[#94A3B8]'
            }`}
          >
            {step.stage.replace(/-/g, ' ')}
          </span>
        ))}
      </div>

      {/* Artifacts */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <span className="text-[#64748B] dark:text-[#94A3B8]">Capabilities</span>
          <p className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {String(pipeline.artifacts.capabilities.length)}
          </p>
        </div>
        <div>
          <span className="text-[#64748B] dark:text-[#94A3B8]">Providers</span>
          <p className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {String(pipeline.artifacts.providers.length)}
          </p>
        </div>
        <div>
          <span className="text-[#64748B] dark:text-[#94A3B8]">Context</span>
          <p className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {String(pipeline.artifacts.contextItems)}
          </p>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-[#F1F5F9] dark:border-[#334155] flex items-center justify-between text-[11px]">
        <span className="text-[#94A3B8]">{pipeline.validation.summary}</span>
        <span className="text-[#94A3B8]">{pipeline.createdAt.slice(0, 10)}</span>
      </div>
    </Card>
  );
}
