'use client';

import React from 'react';
import Link from 'next/link';
import {
  Card,
  Badge,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  Loading,
} from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
  BarChart3,
  Goal,
  FolderKanban,
  TrendingUp,
  DollarSign,
  Shield,
  Lightbulb,
  Zap,
  ArrowRight,
  Sparkles,
  Play,
  CheckCircle2,
  Flag,
  Rocket,
} from 'lucide-react';
import { useBusiness, useRevenueOverview } from '../../lib/api-client.js';
import { OpportunityMonitoringPanel } from '../../components/OpportunityMonitoringPanel.js';
import { AutonomousBusinessPanel } from '../../components/AutonomousBusinessPanel.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { PageContextBar } from '../../components/PageContextBar.js';
import { LifeJourneyStrip, type JourneyStep } from '../life/LifeJourneyStrip.js';
import { usePageContext } from '../../lib/use-page-context.js';

// ── UX-05 journey (real data only) ─────────────────────────────────────────
interface BusinessJourneyInput {
  profile?: { businessName?: string; stage?: string } | null;
  vision?: string;
  goals?: ReadonlyArray<{ title?: string; status?: string }> | null;
  milestones?: ReadonlyArray<{ status?: string }> | null;
  projects?: ReadonlyArray<unknown> | null;
}

function businessJourneySteps(data: unknown): JourneyStep[] {
  const input = (typeof data === 'object' && data !== null ? data : {}) as BusinessJourneyInput;

  const businessName =
    typeof input.profile?.businessName === 'string' ? input.profile.businessName : '';
  const goals = (Array.isArray(input.goals) ? input.goals : []) as ReadonlyArray<{
    title?: string;
    status?: string;
  }>;
  const activeGoals = goals.filter((goal) => goal.status === 'active').length;
  const milestones = (Array.isArray(input.milestones) ? input.milestones : []) as ReadonlyArray<{
    status?: string;
  }>;
  const completedMilestones = milestones.filter(
    (milestone) => milestone.status === 'completed',
  ).length;
  const projects = Array.isArray(input.projects) ? input.projects.length : 0;

  return [
    {
      label: 'Goal',
      detail:
        goals.length > 0
          ? `${activeGoals} active business goal${
              activeGoals === 1 ? '' : 's'
            } of ${goals.length} tracked.`
          : businessName.length > 0
            ? `Set the first goal for ${businessName}.`
            : 'Set a business goal to give this area a direction.',
      href: '/goals',
      icon: Flag,
      hasData: goals.length > 0,
    },
    {
      label: 'Mission',
      detail:
        projects > 0
          ? `${projects} project${projects === 1 ? '' : 's'} recorded for this business.`
          : 'No business mission has been started yet.',
      href: '/missions',
      icon: Rocket,
      hasData: projects > 0,
    },
    {
      label: 'Progress',
      detail:
        milestones.length > 0
          ? `${completedMilestones} of ${milestones.length} milestone${
              milestones.length === 1 ? '' : 's'
            } completed.`
          : 'No business milestones recorded yet.',
      href: milestones.length > 0 ? '/progress' : null,
      icon: TrendingUp,
      hasData: milestones.length > 0,
    },
    {
      label: 'Outcome',
      detail:
        completedMilestones > 0
          ? `Outcomes are tracked from completed milestones (${completedMilestones}).`
          : 'Outcomes appear once business work is completed.',
      href: completedMilestones > 0 ? '/progress' : null,
      icon: DollarSign,
      hasData: completedMilestones > 0,
    },
  ];
}

/** Money as the API reports it. `undefined` renders as 0 — never as an estimate. */
function money(value: number | undefined, currency = 'USD'): string {
  return (value ?? 0).toLocaleString('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
}

/** One real figure from the revenue overview read. No comparison, no forecast. */
function FinanceStat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] px-4 py-3">
      <p className="text-[20px] font-semibold text-[#111827] dark:text-[#F8FAFC]">{value}</p>
      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{label}</p>
    </div>
  );
}

interface GoalItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: number;
  progress: number;
  status: string;
  targetDate?: string;
  milestones?: Array<{ id: string; title: string; status: string }>;
}

interface ProjectItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  progress: number;
  budget: number;
  spent: number;
  deliverables?: string[];
}

interface KpiItem {
  id: string;
  name: string;
  description: string;
  category: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  period: string;
}

interface RiskItem {
  id: string;
  title: string;
  description: string;
  category: string;
  severity?: string;
  riskScore?: number;
  mitigation?: string;
}

interface InsightItem {
  id: string;
  title: string;
  summary: string;
  category: string;
}

export default function BusinessPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { isLoading, data } = useBusiness(userId);
  const revenue = useRevenueOverview(userId);
  const [activeTab, setActiveTab] = React.useState('overview');

  const context = usePageContext({ pathname: '/business', label: 'Business' });

  // Hydration guard: prevent SSR/client mismatch from zustand persist
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Business Intelligence..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Business Intelligence..." size="lg" />
      </div>
    );
  }

  // Type-safe extraction of business model arrays
  const raw = (data ?? {}) as Record<string, unknown>;
  const goals = (Array.isArray(raw.goals) ? raw.goals : []) as GoalItem[];
  const projects = (Array.isArray(raw.projects) ? raw.projects : []) as ProjectItem[];
  const kpis = (Array.isArray(raw.kpis) ? raw.kpis : []) as KpiItem[];
  const risks = (Array.isArray(raw.risks) ? raw.risks : []) as RiskItem[];
  const insights = (Array.isArray(raw.insights) ? raw.insights : []) as InsightItem[];
  const profile = (
    typeof raw.profile === 'object' && raw.profile !== null ? raw.profile : null
  ) as {
    businessName?: string;
    stage?: string;
    teamSize?: number;
  } | null;

  return (
    <div className="space-y-8">
      {/* UX-05 — Life → Business context */}
      <PageContextBar
        context={context}
        label="Business"
        description="Business is one area of your life in VedMoulya. Ventures, clients and results live here."
      />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
              {profile?.businessName ? profile.businessName : 'Business'}
            </h1>
            <Badge variant="ai" size="sm">
              Part of Life
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8]">
            Ventures, clients and the results they produce.
          </p>
        </div>
        <Badge variant="success" size="md" className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> All Systems Healthy
        </Badge>
      </div>

      {/* UX-05 — Area → Goal → Mission → Progress → Outcome, from real data only. */}
      <LifeJourneyStrip steps={businessJourneySteps(data)} />

      {/* Quick Overview Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4">
          <p className="text-[20px] font-bold text-[#111827] dark:text-[#F8FAFC]">
            {goals.filter((g) => g.status === 'active').length} / {goals.length}
          </p>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Active Goals</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4">
          <p className="text-[20px] font-bold text-[#111827] dark:text-[#F8FAFC]">
            {projects.filter((p) => p.status === 'in_progress').length} / {projects.length}
          </p>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Active Projects</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4">
          <p className="text-[20px] font-bold text-[#111827] dark:text-[#F8FAFC]">
            {kpis.filter((k) => k.currentValue >= k.targetValue).length} / {kpis.length}
          </p>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">KPIs On Target</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4">
          <p className="text-[20px] font-bold text-[#111827] dark:text-[#F8FAFC]">
            {profile?.stage ? profile.stage.toUpperCase() : 'ACTIVE'}
          </p>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Venture Stage</p>
        </div>
      </div>

      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-1.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="goals">
            <Goal className="h-4 w-4 mr-1.5" /> Goals
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderKanban className="h-4 w-4 mr-1.5" /> Projects
          </TabsTrigger>
          <TabsTrigger value="kpis">
            <TrendingUp className="h-4 w-4 mr-1.5" /> KPIs
          </TabsTrigger>
          <TabsTrigger value="finance">
            <DollarSign className="h-4 w-4 mr-1.5" /> Finance
          </TabsTrigger>
          <TabsTrigger value="risks">
            <Shield className="h-4 w-4 mr-1.5" /> Risks
          </TabsTrigger>
          <TabsTrigger value="opportunities">
            <Lightbulb className="h-4 w-4 mr-1.5" /> Opportunities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ErrorBoundary section="business-overview">
            <div className="space-y-6">
              {/* Embed Autonomous Business Engine directly at the top of the workspace */}
              <AutonomousBusinessPanel userId={userId} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card variant="standard" padding="lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                      Active Projects
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('projects');
                      }}
                      className="text-[12px] text-blue-600 dark:text-blue-400 font-medium hover:underline"
                    >
                      View all ({projects.length})
                    </button>
                  </div>
                  {projects.length > 0 ? (
                    <div className="space-y-3">
                      {projects.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[14px] text-[#111827] dark:text-[#F8FAFC]">
                              {p.title}
                            </span>
                            <Badge
                              variant={p.status === 'completed' ? 'success' : 'default'}
                              size="sm"
                            >
                              {p.status}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-[#64748B]">
                            <span>Progress: {p.progress}%</span>
                            <span>{p.category}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-[14px] text-[#94A3B8]">
                        No active projects recorded. Launch an autonomous workflow above or create
                        your first project.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('projects');
                        }}
                        className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-blue-600 hover:underline"
                      >
                        Explore Projects Tab →
                      </button>
                    </div>
                  )}
                </Card>

                <Card variant="standard" padding="lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[18px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                      Strategic Insights
                    </h3>
                    <Badge variant="ai" size="sm">
                      Autonomous Radar
                    </Badge>
                  </div>
                  {insights.length > 0 ? (
                    <div className="space-y-3">
                      {insights.slice(0, 3).map((insight) => (
                        <div
                          key={insight.id}
                          className="p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20"
                        >
                          <p className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                            {insight.title}
                          </p>
                          <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                            {insight.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-[14px] text-[#94A3B8]">
                        The autonomous intelligence engine continuously evaluates your market,
                        revenue, and operations. Launch an autonomous run above to generate
                        insights.
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="goals">
          <ErrorBoundary section="business-goals">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-[20px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    Business Goals & OKRs
                  </h3>
                  <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-2xl">
                    Track strategic objectives, milestones, and deliverables. Goals can be
                    autonomously planned and executed via the Autonomous Mission Controller.
                  </p>
                </div>
                <Link
                  href="/autonomous-builder"
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 dark:bg-blue-950/50 px-4 py-2 text-[13px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Auto-Plan Goal with AI
                </Link>
              </div>

              {goals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {goals.map((g) => (
                    <Card
                      key={g.id}
                      variant="standard"
                      padding="lg"
                      className="flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="default"
                            size="sm"
                            className="uppercase font-semibold text-[10px]"
                          >
                            {g.category}
                          </Badge>
                          <Badge
                            variant={
                              g.status === 'active'
                                ? 'success'
                                : g.status === 'completed'
                                  ? 'default'
                                  : 'warning'
                            }
                            size="sm"
                          >
                            {g.status}
                          </Badge>
                        </div>
                        <h4 className="text-[16px] font-semibold text-[#111827] dark:text-[#F8FAFC] mt-2">
                          {g.title}
                        </h4>
                        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1 line-clamp-2">
                          {g.description}
                        </p>

                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1">
                            <span>Progress</span>
                            <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
                              {g.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-[#E2E8F0] dark:bg-[#334155] rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, g.progress))}%` }}
                            />
                          </div>
                        </div>

                        {g.milestones && g.milestones.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[#334155]">
                            <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider mb-1.5">
                              Milestones (
                              {g.milestones.filter((m) => m.status === 'completed').length}/
                              {g.milestones.length})
                            </p>
                            <div className="space-y-1">
                              {g.milestones.slice(0, 3).map((m) => (
                                <div
                                  key={m.id}
                                  className="flex items-center gap-1.5 text-[12px] text-[#475569] dark:text-[#94A3B8]"
                                >
                                  <CheckCircle2
                                    className={`w-3.5 h-3.5 ${
                                      m.status === 'completed'
                                        ? 'text-emerald-500'
                                        : 'text-slate-300'
                                    }`}
                                  />
                                  <span className="truncate">{m.title}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between">
                        <span className="text-[11px] text-[#64748B]">
                          {g.targetDate
                            ? `Target: ${new Date(g.targetDate).toLocaleDateString()}`
                            : 'No deadline'}
                        </span>
                        <Link
                          href={`/autonomous-builder?objective=${encodeURIComponent(
                            `Execute business goal: ${g.title}. ${g.description}`,
                          )}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Execute with Agent
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card variant="standard" padding="lg" className="text-center py-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 mb-3">
                    <Goal className="w-6 h-6" />
                  </div>
                  <h4 className="text-[16px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    No Goals Defined Yet
                  </h4>
                  <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto mt-1 mb-4">
                    Setting goals gives your business autonomous missions direction and measurable
                    targets.
                  </p>
                  <Link
                    href={`/autonomous-builder?objective=${encodeURIComponent(
                      'Analyze business context and propose 3 strategic OKRs with measurable milestones.',
                    )}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-[13px] font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Auto-Generate Business Goals with Agent
                  </Link>
                </Card>
              )}
            </div>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="projects">
          <ErrorBoundary section="business-projects">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-[20px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    Business Projects & Initiatives
                  </h3>
                  <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-2xl">
                    Active operational initiatives, budgets, deliverables, and execution timelines
                    tracked across your ventures.
                  </p>
                </div>
                <Link
                  href="/autonomous-builder"
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 dark:bg-blue-950/50 px-4 py-2 text-[13px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Launch Project Mission
                </Link>
              </div>

              {projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((p) => (
                    <Card key={p.id} variant="standard" padding="lg">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant="default"
                          size="sm"
                          className="uppercase font-semibold text-[10px]"
                        >
                          {p.category}
                        </Badge>
                        <Badge
                          variant={
                            p.status === 'completed'
                              ? 'success'
                              : p.status === 'blocked'
                                ? 'danger'
                                : 'default'
                          }
                          size="sm"
                        >
                          {p.status}
                        </Badge>
                      </div>

                      <h4 className="text-[16px] font-semibold text-[#111827] dark:text-[#F8FAFC] mt-2">
                        {p.title}
                      </h4>
                      <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1 line-clamp-2">
                        {p.description}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
                        <div>
                          <p className="text-[11px] text-[#64748B]">Budget Spent</p>
                          <p className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
                            {money(p.spent)} / {money(p.budget)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[#64748B]">Progress</p>
                          <p className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
                            {p.progress}%
                          </p>
                        </div>
                      </div>

                      {p.deliverables && p.deliverables.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider mb-1">
                            Deliverables
                          </p>
                          <ul className="text-[12px] text-[#475569] dark:text-[#94A3B8] space-y-0.5">
                            {p.deliverables.slice(0, 3).map((d, idx) => (
                              <li key={idx} className="flex items-center gap-1.5 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span className="truncate">{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between">
                        <span className="text-[11px] text-[#64748B]">Priority: {p.priority}</span>
                        <Link
                          href={`/autonomous-builder?objective=${encodeURIComponent(
                            `Execute deliverables for project: ${p.title}. Deliverables: ${p.deliverables?.join(', ') ?? ''}`,
                          )}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Execute via Agent
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card variant="standard" padding="lg" className="text-center py-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 mb-3">
                    <FolderKanban className="w-6 h-6" />
                  </div>
                  <h4 className="text-[16px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    No Projects Recorded Yet
                  </h4>
                  <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto mt-1 mb-4">
                    Structure active operations into projects with deliverables, budget tracking,
                    and autonomous execution.
                  </p>
                  <Link
                    href={`/autonomous-builder?objective=${encodeURIComponent(
                      'Create an operational project plan with budget estimates and required deliverables.',
                    )}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-[13px] font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Auto-Plan Project with Agent
                  </Link>
                </Card>
              )}
            </div>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="kpis">
          <ErrorBoundary section="business-kpis">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-[20px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    Key Performance Indicators
                  </h3>
                  <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-2xl">
                    Live telemetry across revenue, operations, customer growth, and business
                    performance.
                  </p>
                </div>
                <Link
                  href="/revenue"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 py-2 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/30 transition-colors"
                >
                  Revenue workspace
                  <ArrowRight className="h-4 w-4 text-[#2B5FD9]" />
                </Link>
              </div>

              {/* KPI Performance Summary Matrix */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] p-4">
                  <p className="text-[22px] font-bold text-[#111827] dark:text-[#F8FAFC]">
                    {kpis.length}
                  </p>
                  <p className="text-[11px] text-[#64748B]">Total Tracked KPIs</p>
                </div>
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                  <p className="text-[22px] font-bold text-emerald-600 dark:text-emerald-400">
                    {kpis.filter((k) => k.currentValue >= k.targetValue).length}
                  </p>
                  <p className="text-[11px] text-[#64748B]">On Target</p>
                </div>
                <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-4">
                  <p className="text-[22px] font-bold text-rose-600 dark:text-rose-400">
                    {kpis.filter((k) => k.currentValue < k.targetValue * 0.5).length}
                  </p>
                  <p className="text-[11px] text-[#64748B]">At Risk (&lt;50% Target)</p>
                </div>
                <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                  <p className="text-[22px] font-bold text-blue-600 dark:text-blue-400">
                    {kpis.length > 0
                      ? `${Math.round(
                          (kpis.reduce(
                            (s, k) => s + (k.targetValue > 0 ? k.currentValue / k.targetValue : 0),
                            0,
                          ) /
                            kpis.length) *
                            100,
                        )}%`
                      : '0%'}
                  </p>
                  <p className="text-[11px] text-[#64748B]">Average Achievement</p>
                </div>
              </div>

              {kpis.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {kpis.map((kpi) => {
                    const ratio =
                      kpi.targetValue > 0
                        ? Math.round((kpi.currentValue / kpi.targetValue) * 100)
                        : 0;
                    return (
                      <Card key={kpi.id} variant="standard" padding="lg">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                            {kpi.category}
                          </span>
                          <span
                            className={`text-[11px] font-medium flex items-center gap-0.5 ${
                              kpi.trend === 'up'
                                ? 'text-emerald-600'
                                : kpi.trend === 'down'
                                  ? 'text-rose-600'
                                  : 'text-slate-500'
                            }`}
                          >
                            <TrendingUp
                              className={`w-3.5 h-3.5 ${
                                kpi.trend === 'down' ? 'rotate-180 text-rose-600' : ''
                              }`}
                            />
                            {kpi.trend}
                          </span>
                        </div>

                        <h4 className="text-[16px] font-semibold text-[#111827] dark:text-[#F8FAFC] mt-1.5">
                          {kpi.name}
                        </h4>
                        <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 line-clamp-1">
                          {kpi.description}
                        </p>

                        <div className="mt-3 flex items-baseline justify-between">
                          <span className="text-[22px] font-bold text-[#111827] dark:text-[#F8FAFC]">
                            {kpi.currentValue.toLocaleString()} {kpi.unit}
                          </span>
                          <span className="text-[12px] text-[#64748B]">
                            Target: {kpi.targetValue.toLocaleString()} {kpi.unit}
                          </span>
                        </div>

                        <div className="mt-2 w-full bg-[#E2E8F0] dark:bg-[#334155] rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              ratio >= 100
                                ? 'bg-emerald-500'
                                : ratio >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
                          />
                        </div>

                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#94A3B8]">
                          <span>Period: {kpi.period}</span>
                          <span>{ratio}% Achieved</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card variant="standard" padding="lg" className="text-center py-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 mb-3">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h4 className="text-[16px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    No KPIs Configured
                  </h4>
                  <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto mt-1 mb-4">
                    Establish key performance indicators to track health and inform autonomous
                    optimizations.
                  </p>
                  <Link
                    href={`/autonomous-builder?objective=${encodeURIComponent(
                      'Evaluate current business operations and propose 5 core KPIs across revenue, quality and growth.',
                    )}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-[13px] font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Auto-Configure KPIs with Agent
                  </Link>
                </Card>
              )}
            </div>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="finance">
          <ErrorBoundary section="business-finance">
            <Card variant="standard" padding="lg">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-[18px] font-semibold text-[#111827]">Financial Overview</h3>
                  <p className="text-[14px] text-[#64748B] mt-2 max-w-2xl">
                    Paid, outstanding and overdue totals from recorded invoices and payments — the
                    same owner-scoped figures the operations workspace reads. Revenue streams, the
                    cost-weighted ranking and the opportunity radar live in the Revenue workspace.
                  </p>
                </div>
                <Link
                  href="/revenue"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 py-2 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/30 transition-colors"
                >
                  Revenue workspace
                  <ArrowRight className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
                </Link>
              </div>

              {revenue.isLoading ? (
                <div className="mt-4 flex items-center justify-center py-4">
                  <Loading label="Loading revenue..." size="md" />
                </div>
              ) : revenue.isError ? (
                <div className="mt-4 flex items-center gap-3 flex-wrap" role="alert">
                  <p className="text-[13px] text-[#B91C1C]">
                    Revenue could not be loaded. No total is shown rather than a fabricated one.
                  </p>
                  <button
                    onClick={() => {
                      void revenue.refetch();
                    }}
                    className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#F1F5F9] transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <FinanceStat
                    label="Paid"
                    value={money(revenue.data?.paidTotal, revenue.data?.currency)}
                  />
                  <FinanceStat
                    label="Outstanding"
                    value={money(revenue.data?.outstanding, revenue.data?.currency)}
                  />
                  <FinanceStat label="Overdue" value={String(revenue.data?.overdueCount ?? 0)} />
                  <FinanceStat
                    label="Annual revenue"
                    value={money(revenue.data?.annualRevenue, revenue.data?.currency)}
                  />
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="risks">
          <ErrorBoundary section="business-risks">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-[20px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    Risk Intelligence Radar
                  </h3>
                  <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-2xl">
                    Proactive vulnerability and operational risk detection. Evaluate risk scores,
                    likelihoods, and autonomous mitigation safeguards.
                  </p>
                </div>
                <Link
                  href={`/autonomous-builder?objective=${encodeURIComponent(
                    'Perform full business risk audit across operational dependencies, vendor contracts and revenue exposure.',
                  )}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 dark:bg-rose-950/50 px-4 py-2 text-[13px] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  Run Autonomous Risk Audit
                </Link>
              </div>

              {/* Risk Summary Matrix */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] p-4">
                  <p className="text-[22px] font-bold text-[#111827] dark:text-[#F8FAFC]">
                    {risks.length}
                  </p>
                  <p className="text-[11px] text-[#64748B]">Identified Risks</p>
                </div>
                <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-4">
                  <p className="text-[22px] font-bold text-rose-600 dark:text-rose-400">
                    {
                      risks.filter((r) => r.severity === 'critical' || (r.riskScore ?? 0) >= 80)
                        .length
                    }
                  </p>
                  <p className="text-[11px] text-[#64748B]">Critical Risks</p>
                </div>
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                  <p className="text-[22px] font-bold text-amber-600 dark:text-amber-400">
                    {
                      risks.filter(
                        (r) =>
                          r.severity === 'high' ||
                          ((r.riskScore ?? 0) >= 60 && (r.riskScore ?? 0) < 80),
                      ).length
                    }
                  </p>
                  <p className="text-[11px] text-[#64748B]">High Severity</p>
                </div>
                <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                  <p className="text-[22px] font-bold text-blue-600 dark:text-blue-400">
                    {risks.length > 0
                      ? Math.round(
                          risks.reduce((sum, r) => sum + (r.riskScore ?? 0), 0) / risks.length,
                        )
                      : 0}
                  </p>
                  <p className="text-[11px] text-[#64748B]">Average Risk Score</p>
                </div>
              </div>

              {risks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {risks.map((risk) => (
                    <Card key={risk.id} variant="standard" padding="lg">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant="default"
                          size="sm"
                          className="uppercase font-semibold text-[10px]"
                        >
                          {risk.category}
                        </Badge>
                        <Badge
                          variant={
                            risk.severity === 'critical'
                              ? 'danger'
                              : risk.severity === 'high'
                                ? 'warning'
                                : 'default'
                          }
                          size="sm"
                        >
                          {risk.severity ?? 'moderate'}
                        </Badge>
                      </div>

                      <h4 className="text-[16px] font-semibold text-[#111827] dark:text-[#F8FAFC] mt-2">
                        {risk.title}
                      </h4>
                      <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                        {risk.description}
                      </p>

                      {risk.mitigation && (
                        <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[12px]">
                          <p className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider mb-0.5">
                            Mitigation Plan
                          </p>
                          <p className="text-slate-600 dark:text-slate-400">{risk.mitigation}</p>
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between text-[11px] text-[#64748B]">
                        <span>Risk Score: {risk.riskScore ?? 'N/A'} / 100</span>
                        <Link
                          href={`/autonomous-builder?objective=${encodeURIComponent(
                            `Formulate and execute mitigation plan for risk: ${risk.title}. Details: ${risk.description}`,
                          )}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:underline"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Mitigate with Agent
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card variant="standard" padding="lg" className="text-center py-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mb-3">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h4 className="text-[16px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    No Active Risks Detected
                  </h4>
                  <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto mt-1 mb-4">
                    The autonomous risk engine runs background checks to detect financial,
                    operational, and supplier vulnerabilities.
                  </p>
                  <Link
                    href={`/autonomous-builder?objective=${encodeURIComponent(
                      'Scan venture operations and identify any operational, financial or compliance risks.',
                    )}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-[13px] font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Run Autonomous Risk Scan
                  </Link>
                </Card>
              )}
            </div>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="opportunities">
          <ErrorBoundary section="business-opportunities">
            <div className="space-y-4">
              <Card variant="standard" padding="lg">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#111827]">Opportunity Center</h3>
                    <p className="text-[14px] text-[#64748B] mt-2 max-w-2xl">
                      Real opportunities from your configured source, ranked by the existing
                      qualification. You review every one, and a proposal is only ever a draft —
                      nothing is bid on, sent or accepted without you.
                    </p>
                  </div>
                  <Link
                    href="/revenue"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 py-2 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/30 transition-colors"
                  >
                    Revenue workspace
                    <ArrowRight className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
                  </Link>
                </div>
              </Card>
              <OpportunityMonitoringPanel
                onOpportunitiesChanged={() => {
                  void revenue.refetch();
                }}
              />
            </div>
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
