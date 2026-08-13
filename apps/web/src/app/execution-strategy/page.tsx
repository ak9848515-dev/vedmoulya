// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Strategy Explorer
// EPIC-004 / EI-004 — Enterprise Execution Strategy Engine
// Given ANY business goal, VedMoulya produces a complete execution strategy
// without making any AI calls: capabilities, context reference, provider
// candidates, execution mode, budgets, latency, quality, risk, fallback,
// and validation readiness.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  TextField,
  Select,
  EmptyState,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
  Workflow,
  Gauge,
  ShieldCheck,
  Zap,
  Target,
  FileText,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Package,
  Cpu,
  ListChecks,
} from 'lucide-react';
import {
  useExecutionStrategySummary,
  useExecutionStrategyList,
  useExecutionStrategy,
  useExecutionStrategyExplain,
  useCreateExecutionStrategy,
  useValidateExecutionStrategy,
} from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import type {
  ExecutionStrategyDTO,
  ProviderCandidateDTO,
  CapabilityPlanStepDTO,
  StrategyExplanationDTO,
} from '@vedmoulya/execution-strategy';
// Shared explorer components + label maps (moved out of the route module so
// the page only exports `default` — Next.js forbids named exports in pages;
// Storybook imports them from ./components).
import {
  MODE_LABELS,
  PRIORITY_BADGE,
  RISK_BADGE,
  CAPABILITY_LABELS,
  TIER_LABELS,
  StrategyCard,
  ValidationBadge,
} from './components.js';

export default function ExecutionStrategyPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('registry');

  useEffect(() => {
    setActiveSection('execution-strategy');
    setBreadcrumbs([
      { label: 'Execution Strategy', href: '/execution-strategy' },
      { label: 'Explore' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Execution Strategy..." size="lg" />
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
              Execution Strategy
            </h1>
            <Badge variant="ai" size="sm">
              EI-004
            </Badge>
          </div>
          <p className="text-[14px] md:text-[15px] text-[#64748B] dark:text-[#94A3B8] max-w-2xl">
            Given ANY business goal, this engine produces a complete execution strategy —
            capabilities, context reference, provider candidates, execution mode, budgets, latency,
            quality, risk, fallback, and validation — without making any AI calls.
          </p>
        </div>
      </div>

      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="registry">
            <Workflow className="h-4 w-4 mr-1.5" /> Strategy Registry
          </TabsTrigger>
          <TabsTrigger value="builder">
            <Zap className="h-4 w-4 mr-1.5" /> Strategy Builder
          </TabsTrigger>
          <TabsTrigger value="detail">
            <Target className="h-4 w-4 mr-1.5" /> Strategy Detail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registry">
          <ErrorBoundary section="strategy-registry">
            <StrategyRegistryView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="builder">
          <ErrorBoundary section="strategy-builder">
            <StrategyBuilderView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="detail">
          <ErrorBoundary section="strategy-detail">
            <StrategyDetailView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}

// ── TAB 1: Registry ────────────────────────────────────────────────────────

function StrategyRegistryView({ userId }: { userId: string }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const { data: summary, isLoading: summaryLoading } = useExecutionStrategySummary(userId);
  const { data: listData, isLoading, isError } = useExecutionStrategyList(userId);

  if (isLoading || !listData || summaryLoading || !summary) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading Strategy Registry..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load the strategy registry
          </h2>
        </Card>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? listData.filter((s) =>
        `${s.goal} ${s.business.join(' ')} ${s.capabilityPlan.requiredCapabilities.join(' ')} ${s.executionMode}`
          .toLowerCase()
          .includes(q),
      )
    : listData;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Strategies',
            value: String(summary.total),
            icon: <Workflow className="h-5 w-5 text-[#2B5FD9]" />,
            bg: 'bg-[#EFF4FE] dark:bg-[#1E3A8A]/40',
          },
          {
            label: 'Avg Confidence',
            value: `${String(Math.round(summary.averageConfidence * 100))}%`,
            icon: <ShieldCheck className="h-5 w-5 text-[#22C55E]" />,
            bg: 'bg-[#F0FDF4] dark:bg-[#14532D]/40',
          },
          {
            label: 'Modes',
            value: String(Object.values(summary.countByExecutionMode).filter((v) => v > 0).length),
            icon: <Gauge className="h-5 w-5 text-[#7C3AED]" />,
            bg: 'bg-[#F5F3FF] dark:bg-[#4C1D95]/40',
          },
          {
            label: 'Priorities',
            value: String(Object.values(summary.countByPriority).filter((v) => v > 0).length),
            icon: <Target className="h-5 w-5 text-[#F59E0B]" />,
            bg: 'bg-[#FFFBEB] dark:bg-[#78350F]/40',
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            variant="standard"
            padding="md"
            className="dark:bg-[#1E293B] dark:border-[#334155]"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium truncate">
                  {stat.label}
                </p>
                <p className="text-[20px] font-bold text-[#111827] dark:text-[#F8FAFC]">
                  {stat.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex flex-col lg:flex-row gap-3 items-center">
          <div className="flex-1 min-w-0">
            <TextField
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search goals, capabilities, execution modes…"
              aria-label="Search strategies"
              leftIcon={<Workflow className="h-4 w-4 text-[#94A3B8]" />}
            />
          </div>
          <Badge variant="ai" size="sm" className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Strategy only — no AI execution
          </Badge>
        </div>
      </Card>

      {/* Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-8 w-8" />}
          title="No strategies found"
          description="Try adjusting your search."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((strategy) => (
            <StrategyCard key={strategy.strategyId} strategy={strategy} />
          ))}
        </div>
      )}

      {/* Mode distribution */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[#7C3AED]" /> Execution Mode Distribution
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(summary.countByExecutionMode)
            .filter(([, v]) => v > 0)
            .map(([mode, count]) => (
              <div
                key={mode}
                className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
              >
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium">
                  {MODE_LABELS[mode] ?? mode}
                </p>
                <p className="text-[18px] font-bold text-[#111827] dark:text-[#F8FAFC]">{count}</p>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

// ── TAB 2: Builder ─────────────────────────────────────────────────────────

function StrategyBuilderView({ userId }: { userId: string }): React.JSX.Element {
  const [goal, setGoal] = useState('Generate a blog post about enterprise AI strategy');
  const [goalId, setGoalId] = useState('goal_enterprise_blog');
  const [priority, setPriority] = useState('high');
  const [tier, setTier] = useState('premium');
  const [business, setBusiness] = useState('platform');
  const [maxCost, setMaxCost] = useState('2');
  const [maxLatency, setMaxLatency] = useState('30000');
  const createStrategy = useCreateExecutionStrategy();
  const [createdId, setCreatedId] = useState<string | null>(null);

  const handleCreate = (): void => {
    void createStrategy
      .mutateAsync({
        userId,
        goalId,
        goal,
        business: business ? [business] : [],
        priority: priority as ExecutionStrategyDTO['priority'],
        qualityTier: tier as ExecutionStrategyDTO['qualityTarget']['tier'],
        maxCostUsd: maxCost ? Number(maxCost) : undefined,
        maxLatencyMs: maxLatency ? Number(maxLatency) : undefined,
      })
      .then((res) => {
        const data = (res as { data?: ExecutionStrategyDTO }).data;
        if (data) setCreatedId(data.strategyId);
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Goal
            </label>
            <TextField
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
              }}
              placeholder="Describe the business goal"
              aria-label="Goal"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Goal ID
            </label>
            <TextField
              value={goalId}
              onChange={(e) => {
                setGoalId(e.target.value);
              }}
              placeholder="goal_id"
              aria-label="Goal ID"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Business Context
            </label>
            <TextField
              value={business}
              onChange={(e) => {
                setBusiness(e.target.value);
              }}
              placeholder="e.g. platform"
              aria-label="Business context"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Priority
            </label>
            <Select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
              }}
              aria-label="Priority"
              options={Object.entries(PRIORITY_BADGE).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Quality Tier
            </label>
            <Select
              value={tier}
              onChange={(e) => {
                setTier(e.target.value);
              }}
              aria-label="Quality tier"
              options={Object.entries(TIER_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Max Cost (USD)
            </label>
            <TextField
              value={maxCost}
              onChange={(e) => {
                setMaxCost(e.target.value);
              }}
              placeholder="2"
              aria-label="Max cost"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Max Latency (ms)
            </label>
            <TextField
              value={maxLatency}
              onChange={(e) => {
                setMaxLatency(e.target.value);
              }}
              placeholder="30000"
              aria-label="Max latency"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Badge variant="ai" size="sm" className="flex items-center gap-1.5">
            <Zap className="h-3 w-3" /> Planner → Candidates → Budgets → Risk → Fallback →
            Validation
          </Badge>
          <button
            onClick={handleCreate}
            disabled={createStrategy.isPending || !goal.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4] transition-colors disabled:opacity-50"
          >
            <Zap className="h-4 w-4" /> Create Strategy
          </button>
        </div>
        {createStrategy.isError && (
          <p className="mt-3 text-[13px] text-[#EF4444]">{createStrategy.error.message}</p>
        )}
      </Card>

      {createdId && (
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-2">
              <Package className="h-4 w-4 text-[#22C55E]" /> Strategy Created
            </h3>
            <Badge variant="success" size="sm">
              {createdId}
            </Badge>
          </div>
          <p className="mt-2 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Open the Strategy Detail tab and paste the strategy ID to inspect it.
          </p>
        </Card>
      )}
    </div>
  );
}

// ── TAB 3: Detail ──────────────────────────────────────────────────────────

function StrategyDetailView({ userId }: { userId: string }): React.JSX.Element {
  const [strategyId, setStrategyId] = useState('');
  const { data: strategy, isLoading, isError, refetch } = useExecutionStrategy(userId, strategyId);
  const { data: explanation } = useExecutionStrategyExplain(userId, strategyId);
  const validateStrategy = useValidateExecutionStrategy();
  const [validated, setValidated] = useState<ExecutionStrategyDTO | null>(null);

  const runValidate = (): void => {
    if (!strategyId) return;
    void validateStrategy
      .mutateAsync({ userId, id: strategyId })
      .then((res) => {
        const data = (res as { data?: ExecutionStrategyDTO }).data;
        if (data) setValidated(data);
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <TextField
              value={strategyId}
              onChange={(e) => {
                setStrategyId(e.target.value);
              }}
              placeholder="Enter strategy ID (e.g. strategy_...) or paste from the Builder"
              aria-label="Strategy ID"
              leftIcon={<Target className="h-4 w-4 text-[#94A3B8]" />}
            />
          </div>
          <button
            onClick={() => {
              void refetch();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Load
          </button>
          <button
            onClick={runValidate}
            disabled={!strategyId || validateStrategy.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#22C55E] text-white hover:bg-[#16A34A] transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Re-validate
          </button>
        </div>
      </Card>

      {isLoading && strategyId && (
        <div className="flex items-center justify-center h-[40vh]">
          <Loading label="Loading strategy..." size="lg" />
        </div>
      )}

      {isError && (
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Strategy not found
          </h2>
        </Card>
      )}

      {strategy && <StrategyDetailCard strategy={strategy} />}
      {validated && (
        <div className="mt-4">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-2">
            Last Validation Result
          </h3>
          <ValidationBadge strategy={validated} />
        </div>
      )}
      {explanation && <ExplanationCard explanation={explanation} />}
    </div>
  );
}

// ── Shared Components ───────────────────────────────────────────────────────
// StrategyCard / ValidationBadge live in ./components.tsx (exported for
// Storybook stories); the page re-imports them from there.
function StrategyDetailCard({ strategy }: { strategy: ExecutionStrategyDTO }): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              {strategy.goal}
            </h3>
            <p className="text-[12px] text-[#94A3B8] mt-1">
              {strategy.strategyId} · {strategy.goalId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="ai" size="sm">
              {MODE_LABELS[strategy.executionMode] ?? strategy.executionMode}
            </Badge>
            <Badge variant="success" size="sm">
              {Math.round(strategy.confidence * 100)}% confidence
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Capability flow */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-[#2B5FD9]" /> Capability Flow
          </h3>
          <div className="space-y-2">
            {strategy.capabilityPlan.steps.map((step, idx) => (
              <CapabilityStepRow key={step.stepId} step={step} idx={idx} />
            ))}
          </div>
        </Card>

        {/* Provider candidates */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#7C3AED]" /> Provider Candidates
            <span className="text-[11px] font-normal text-[#94A3B8]">
              ranked only — no selection
            </span>
          </h3>
          <div className="space-y-2">
            {strategy.providerCandidates.map((candidate) => (
              <ProviderCandidateRow key={candidate.providerId} candidate={candidate} />
            ))}
          </div>
        </Card>
      </div>

      {/* Budgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BudgetCard
          title="Token Budget"
          color="text-[#2B5FD9]"
          metrics={[
            { label: 'Expected', value: strategy.tokenBudget.expectedTokens.toLocaleString() },
            { label: 'Max', value: strategy.tokenBudget.maximumTokens.toLocaleString() },
            {
              label: 'Confidence',
              value: `${String(Math.round(strategy.tokenBudget.confidence * 100))}%`,
            },
          ]}
        />
        <BudgetCard
          title="Cost Budget"
          color="text-[#22C55E]"
          metrics={[
            { label: 'Expected', value: `$${strategy.costBudget.expectedCostUsd.toFixed(2)}` },
            { label: 'Max', value: `$${strategy.costBudget.maximumCostUsd.toFixed(2)}` },
            { label: 'Category', value: strategy.costBudget.category },
          ]}
        />
        <BudgetCard
          title="Latency Budget"
          color="text-[#F59E0B]"
          metrics={[
            { label: 'Expected', value: `${String(strategy.latencyBudget.expectedTimeMs)}ms` },
            { label: 'Max', value: `${String(strategy.latencyBudget.maximumTimeMs)}ms` },
            {
              label: 'Confidence',
              value: `${String(Math.round(strategy.latencyBudget.confidence * 100))}%`,
            },
          ]}
        />
      </div>

      {/* Risk + Quality + Fallback */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#F59E0B]" /> Risk
          </h3>
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant={
                strategy.risk.level === 'high' || strategy.risk.level === 'critical'
                  ? 'warning'
                  : 'info'
              }
              size="sm"
            >
              {RISK_BADGE[strategy.risk.level] ?? strategy.risk.level}
            </Badge>
            <span className="text-[12px] text-[#94A3B8]">
              {(strategy.risk.overallRisk * 100).toFixed(0)}%
            </span>
          </div>
          <div className="space-y-1.5">
            {strategy.risk.factors.map((f) => (
              <p key={f} className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                · {f}
              </p>
            ))}
          </div>
        </Card>

        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-[#22C55E]" /> Quality Target
          </h3>
          <div className="space-y-2 text-[13px]">
            <p className="text-[#64748B] dark:text-[#94A3B8]">
              Target:{' '}
              <strong className="text-[#111827] dark:text-[#F8FAFC]">
                {Math.round(strategy.qualityTarget.targetScore * 100)}%
              </strong>
            </p>
            <p className="text-[#64748B] dark:text-[#94A3B8]">
              Minimum:{' '}
              <strong className="text-[#111827] dark:text-[#F8FAFC]">
                {Math.round(strategy.qualityTarget.minimumScore * 100)}%
              </strong>
            </p>
            <p className="text-[#64748B] dark:text-[#94A3B8]">
              Tier:{' '}
              <strong className="text-[#111827] dark:text-[#F8FAFC]">
                {TIER_LABELS[strategy.qualityTarget.tier] ?? strategy.qualityTarget.tier}
              </strong>
            </p>
            <p className="text-[#64748B] dark:text-[#94A3B8]">
              Approval:{' '}
              <strong className="text-[#111827] dark:text-[#F8FAFC]">
                {strategy.qualityTarget.approvalRequired ? 'Yes' : 'No'}
              </strong>
            </p>
          </div>
        </Card>

        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-[#7C3AED]" /> Fallback & Retry
          </h3>
          <div className="space-y-2 text-[13px]">
            <p className="text-[#64748B] dark:text-[#94A3B8]">
              {strategy.fallbackPlan.description}
            </p>
            <p className="text-[#64748B] dark:text-[#94A3B8]">
              Retries:{' '}
              <strong className="text-[#111827] dark:text-[#F8FAFC]">
                {strategy.retryPolicy.maximumRetries}
              </strong>{' '}
              · delay {strategy.retryPolicy.retryDelayMs}ms
            </p>
            <p className="text-[#64748B] dark:text-[#94A3B8]">
              Escalation:{' '}
              <strong className="text-[#111827] dark:text-[#F8FAFC]">
                {strategy.retryPolicy.escalation}
              </strong>
            </p>
          </div>
        </Card>
      </div>

      <ValidationBadge strategy={strategy} />
    </div>
  );
}

function CapabilityStepRow({
  step,
  idx,
}: {
  step: CapabilityPlanStepDTO;
  idx: number;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
      <span className="w-6 h-6 shrink-0 rounded-full bg-[#2B5FD9] text-white text-[11px] font-bold flex items-center justify-center">
        {idx + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
            {step.label}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={step.skippable ? 'info' : 'default'} size="sm">
              {step.support}
            </Badge>
            <span className="text-[10px] text-[#94A3B8]">
              {CAPABILITY_LABELS[step.capability] ?? step.capability}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
          {step.description}
        </p>
      </div>
    </div>
  );
}

function ProviderCandidateRow({
  candidate,
}: {
  candidate: ProviderCandidateDTO;
}): React.JSX.Element {
  return (
    <div className="p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
          {candidate.name}
        </span>
        <span className="text-[11px] font-bold text-[#2B5FD9] shrink-0">
          {Math.round(candidate.rankScore * 100)}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#2B5FD9] dark:bg-[#6B8FEF]"
            style={{ width: `${String(Math.round(candidate.rankScore * 100))}%` }}
          />
        </div>
        <span className="text-[10px] text-[#94A3B8] w-24 text-right truncate">
          quality {Math.round(candidate.qualityEstimate * 100)}% · {candidate.latencyEstimateMs}ms
        </span>
      </div>
    </div>
  );
}

function BudgetCard({
  title,
  color,
  metrics,
}: {
  title: string;
  color: string;
  metrics: Array<{ label: string; value: string }>;
}): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <h3 className={`text-[15px] font-semibold ${color} mb-3`}>{title}</h3>
      <div className="space-y-2">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between">
            <span className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">{m.label}</span>
            <span className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
              {m.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ExplanationCard({
  explanation,
}: {
  explanation: StrategyExplanationDTO;
}): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#2B5FD9]" /> Strategy Explanation
      </h3>
      <div className="space-y-2 text-[13px]">
        <p className="text-[#64748B] dark:text-[#94A3B8]">
          <strong className="text-[#111827] dark:text-[#F8FAFC]">Capabilities:</strong>{' '}
          {explanation.capabilitySummary}
        </p>
        <p className="text-[#64748B] dark:text-[#94A3B8]">
          <strong className="text-[#111827] dark:text-[#F8FAFC]">Providers:</strong>{' '}
          {explanation.providerSummary}
        </p>
        <p className="text-[#64748B] dark:text-[#94A3B8]">
          <strong className="text-[#111827] dark:text-[#F8FAFC]">Budget:</strong>{' '}
          {explanation.budgetSummary}
        </p>
        <p className="text-[#64748B] dark:text-[#94A3B8]">
          <strong className="text-[#111827] dark:text-[#F8FAFC]">Risk:</strong>{' '}
          {explanation.riskSummary}
        </p>
        <p className="text-[#64748B] dark:text-[#94A3B8]">
          <strong className="text-[#111827] dark:text-[#F8FAFC]">Mode:</strong>{' '}
          {explanation.modeSummary}
        </p>
        <p className="text-[#64748B] dark:text-[#94A3B8]">
          <strong className="text-[#111827] dark:text-[#F8FAFC]">Validation:</strong>{' '}
          {explanation.validationSummary}
        </p>
      </div>
    </Card>
  );
}
