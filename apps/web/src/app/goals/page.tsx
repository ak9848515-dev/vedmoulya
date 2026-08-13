// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Goal Explorer
// EPIC-004 / EI-006 — Enterprise Goal & Task Intelligence Engine
// Transforms any user objective into a structured execution plan: goal
// registry, understanding, classification, lifecycle, task decomposition,
// prioritization, dependency DAG with critical path, milestones, success
// criteria, and validation. The engine understands goals — it never
// executes them. The task plan feeds EI-004 (Execution Strategy).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  TextField,
  Select,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import dynamic from 'next/dynamic';
// Heavy tab views are lazy-loaded (BLD-016-B convention) so the initial
// /goals page bundle stays within the 50 kB budget.
const TaskGraphView = dynamic(
  () => import('./task-graph-view.js').then((m) => ({ default: m.TaskGraphView })),
  { ssr: false, loading: () => null },
);
const LifecycleView = dynamic(
  () => import('./lifecycle-view.js').then((m) => ({ default: m.LifecycleView })),
  { ssr: false, loading: () => null },
);
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  UNDERSTANDING_PIPELINE,
  LIFECYCLE_FLOW,
  percentColor,
} from './explorer-data.js';
import { GoalCard } from './components.js';
import { ProblemPanel } from './problem-panel.js';
import {
  Target,
  Layers,
  Network,
  History,
  Sparkles,
  ArrowRight,
  Users,
  CheckCircle2,
  BarChart3,
  Search,
  PlusCircle,
  Zap,
  ListChecks,
} from 'lucide-react';
import {
  useGoalsSummary,
  useGoalSearch,
  useCreateGoal,
  useGenerateGoalTasks,
  useValidateGoal,
  useAnalyzeGoal,
} from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import type { GoalCategory, GoalStatus } from '@vedmoulya/goals';

// ── Page ────────────────────────────────────────────────────────────────────

export default function GoalsPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setActiveSection('goals');
    setBreadcrumbs([{ label: 'Goal & Task Intelligence', href: '/goals' }, { label: 'Explore' }]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Goal & Task Intelligence..." size="lg" />
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
              Goal & Task Intelligence
            </h1>
            <Badge variant="ai" size="sm">
              EI-006
            </Badge>
          </div>
          <p className="text-[14px] md:text-[15px] text-[#64748B] dark:text-[#94A3B8] max-w-3xl">
            Transforms any objective into a structured execution plan — goal registry,
            understanding, classification, lifecycle, task decomposition, prioritization, dependency
            DAG with critical path, milestones, success criteria, and validation. VedMoulya
            understands goals; it never executes them.
          </p>
        </div>
        <Badge variant="info" size="sm" className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Understanding only — no AI execution
        </Badge>
      </div>

      {/* SPRINT-023 — the problem→outcome front door: what VedMoulya understood. */}
      <ProblemPanel userId={userId} />

      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-1.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="goals">
            <Target className="h-4 w-4 mr-1.5" /> Goals
          </TabsTrigger>
          <TabsTrigger value="task-graph">
            <Network className="h-4 w-4 mr-1.5" /> Task Graph
          </TabsTrigger>
          <TabsTrigger value="lifecycle">
            <History className="h-4 w-4 mr-1.5" /> Lifecycle
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ErrorBoundary section="goals-overview">
            <GoalsOverviewView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="goals">
          <ErrorBoundary section="goals-registry">
            <GoalsRegistryView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="task-graph">
          <ErrorBoundary section="goals-task-graph">
            <TaskGraphView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="lifecycle">
          <ErrorBoundary section="goals-lifecycle">
            <LifecycleView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}

// ── TAB 1: Overview ─────────────────────────────────────────────────────────

function GoalsOverviewView({ userId }: { userId: string }): React.JSX.Element {
  const { data: summary, isLoading, isError } = useGoalsSummary(userId);

  if (isLoading || !summary) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading Goal Intelligence Summary..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load the goal summary
          </h2>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Goals"
          value={String(summary.totalGoals)}
          icon={<Target className="h-5 w-5 text-[#2B5FD9]" />}
          bg="bg-[#EFF4FE] dark:bg-[#1E3A8A]/40"
        />
        <StatCard
          label="Active"
          value={String(summary.activeGoals)}
          icon={<Users className="h-5 w-5 text-[#22C55E]" />}
          bg="bg-[#F0FDF4] dark:bg-[#14532D]/40"
        />
        <StatCard
          label="Completed"
          value={String(summary.completedGoals)}
          icon={<CheckCircle2 className="h-5 w-5 text-[#7C3AED]" />}
          bg="bg-[#F5F3FF] dark:bg-[#4C1D95]/40"
        />
        <StatCard
          label="Tasks Planned"
          value={String(summary.totalTasks)}
          icon={<ListChecks className="h-5 w-5 text-[#F59E0B]" />}
          bg="bg-[#FFFBEB] dark:bg-[#78350F]/40"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distributions */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#2B5FD9]" /> Goal Registry Distribution
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DistributionBlock
              title="By Category"
              counts={summary.byCategory}
              labelMap={CATEGORY_LABELS}
            />
            <DistributionBlock
              title="By Status"
              counts={summary.byStatus}
              labelMap={STATUS_LABELS}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-[#F1F5F9] dark:border-[#334155] grid grid-cols-2 gap-2 text-[12px]">
            <OverviewMetric label="Blocked" value={String(summary.blockedGoals)} />
            <OverviewMetric
              label="Avg confidence"
              value={`${String(Math.round(summary.avgConfidence * 100))}%`}
            />
            <OverviewMetric label="Avg goal score" value={summary.avgGoalScore.toFixed(2)} />
            <OverviewMetric label="By priority" value={formatPriority(summary.byPriority)} />
          </div>
        </Card>

        {/* Pipeline */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#7C3AED]" /> The Understanding Pipeline
          </h3>
          <div className="space-y-2">
            {UNDERSTANDING_PIPELINE.map((step, idx) => (
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

      {/* Lifecycle visual */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-[#2B5FD9]" /> Goal Lifecycle
        </h3>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          {LIFECYCLE_FLOW.map((state, idx, arr) => (
            <React.Fragment key={state}>
              <span className="px-2 py-1 rounded-md border border-[#E2E8F0] dark:border-[#334155] font-medium">
                {/* STATUS_LABELS is keyed by every lifecycle state — no untrusted keys reach this lookup. */}
                {/* eslint-disable-next-line security/detect-object-injection */}
                {STATUS_LABELS[state]}
              </span>
              {idx < arr.length - 1 && (
                <ArrowRight className="h-3 w-3 shrink-0 text-[#CBD5E1] dark:text-[#475569]" />
              )}
            </React.Fragment>
          ))}
          <span className="px-2 py-1 rounded-md border border-[#E2E8F0] dark:border-[#334155] font-medium text-[#94A3B8]">
            ⇄ blocked
          </span>
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

function DistributionBlock({
  title,
  counts,
  labelMap,
}: {
  title: string;
  counts: Record<string, number>;
  labelMap: Record<string, string>;
}): React.JSX.Element {
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-2">{title}</p>
      <div className="space-y-1.5">
        {Object.entries(counts).map(([key, count]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate capitalize">
              {/* labelMap keys come from the same closed distribution object as `key` — not user input. */}
              {/* eslint-disable-next-line security/detect-object-injection */}
              {labelMap[key] ?? key}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
              <div
                className={`h-full rounded-full ${percentColor(count / total)}`}
                style={{ width: `${String(Math.round((count / total) * 100))}%` }}
              />
            </div>
            <span className="w-6 text-right text-[11px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
              {String(count)}
            </span>
          </div>
        ))}
        {Object.keys(counts).length === 0 && (
          <p className="text-[12px] text-[#94A3B8]">No data yet.</p>
        )}
      </div>
    </div>
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

function formatPriority(byPriority: Record<string, number>): string {
  const entries = Object.entries(byPriority);
  if (entries.length === 0) return '—';
  return entries.map(([k, v]) => `${k}×${String(v)}`).join(' · ');
}

// ── TAB 2: Goals Registry ───────────────────────────────────────────────────

function GoalsRegistryView({ userId }: { userId: string }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const { data, isLoading, isError, refetch } = useGoalSearch(userId, {
    query: query || undefined,
    categories: category ? ([category] as GoalCategory[]) : undefined,
    statuses: status ? ([status] as GoalStatus[]) : undefined,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const createGoal = useCreateGoal();
  const analyzeGoal = useAnalyzeGoal();
  const generateTasks = useGenerateGoalTasks();
  const validateGoal = useValidateGoal();
  const [busyGoal, setBusyGoal] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const runCreate = (): void => {
    setCreateError(null);
    void createGoal
      .mutateAsync({
        userId,
        title,
        description,
        category: (createCategory || undefined) as GoalCategory | undefined,
      })
      .then(() => {
        setTitle('');
        setDescription('');
        setCreateCategory('');
        setShowCreate(false);
        void refetch();
      })
      .catch((err: unknown) => {
        setCreateError(err instanceof Error ? err.message : 'Could not create the goal.');
      });
  };

  const runAnalyze = (goalId: string): void => {
    setBusyGoal(goalId);
    void analyzeGoal
      .mutateAsync({ userId, goalId })
      .then(() => refetch())
      .catch(() => undefined)
      .finally(() => {
        setBusyGoal(null);
      });
  };

  const runGenerate = (goalId: string): void => {
    setBusyGoal(goalId);
    void generateTasks
      .mutateAsync({ userId, goalId })
      .then(() => refetch())
      .catch(() => undefined)
      .finally(() => {
        setBusyGoal(null);
      });
  };

  const runValidate = (goalId: string): void => {
    setBusyGoal(goalId);
    void validateGoal
      .mutateAsync({ userId, goalId })
      .then(() => refetch())
      .catch(() => undefined)
      .finally(() => {
        setBusyGoal(null);
      });
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading goals..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load goals
          </h2>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Toolbar */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Search
            </label>
            <TextField
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search goals by title, description, or tag…"
              aria-label="Search goals"
              leftIcon={<Search className="h-4 w-4 text-[#94A3B8]" />}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Category
            </label>
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
              }}
              aria-label="Filter by category"
              options={[
                { value: '', label: 'All categories' },
                ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Status
            </label>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
              }}
              aria-label="Filter by status"
              options={[
                { value: '', label: 'All statuses' },
                ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
            {String(data.total)} goal(s)
          </p>
          <button
            onClick={() => {
              setShowCreate((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4] transition-colors"
          >
            <PlusCircle className="h-4 w-4" /> New Goal
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mt-4 pt-4 border-t border-[#F1F5F9] dark:border-[#334155] space-y-3">
            <TextField
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              placeholder="Goal title (e.g. Grow recurring revenue by 25%)"
              aria-label="Goal title"
              leftIcon={<Target className="h-4 w-4 text-[#94A3B8]" />}
            />
            <TextField
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              placeholder="Describe the objective — VedMoulya will understand and classify it"
              aria-label="Goal description"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={createCategory}
                onChange={(e) => {
                  setCreateCategory(e.target.value);
                }}
                aria-label="Goal category (optional)"
                options={[
                  { value: '', label: 'Auto-detect category' },
                  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
                ]}
              />
              <button
                onClick={runCreate}
                disabled={!title.trim() || !description.trim() || createGoal.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#22C55E] text-white hover:bg-[#16A34A] transition-colors disabled:opacity-50"
              >
                <Zap className="h-4 w-4" /> Create Goal
              </button>
            </div>
            {createError && <p className="text-[13px] text-[#EF4444]">{createError}</p>}
          </div>
        )}
      </Card>

      {/* Goal cards */}
      {data.items.length === 0 && (
        <Card variant="standard" padding="lg" className="max-w-lg text-center dark:bg-[#1E293B]">
          <Target className="h-8 w-8 text-[#2B5FD9] mx-auto mb-2" />
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            No goals match
          </h2>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1">
            Adjust the filters or create a new goal.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {data.items.map((goal) => (
          <GoalCard
            key={goal.goalId}
            goal={goal}
            busy={busyGoal === goal.goalId}
            onAnalyze={runAnalyze}
            onGenerate={runGenerate}
            onValidate={runValidate}
          />
        ))}
      </div>
    </div>
  );
}
