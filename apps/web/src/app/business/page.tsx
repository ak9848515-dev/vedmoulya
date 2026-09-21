'use client';

import React from 'react';
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
} from 'lucide-react';
import { useBusiness } from '../../lib/api-client.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { PageContextBar } from '../../components/PageContextBar.js';
import { LifeJourneyStrip, type JourneyStep } from '../life/LifeJourneyStrip.js';
import { usePageContext } from '../../lib/use-page-context.js';
import { Flag, Rocket } from 'lucide-react';

// ── UX-05 journey (real data only) ─────────────────────────────────────────
//
// Reads the REAL BusinessSnapshotDTO: profile.businessName, goals[],
// milestones[]. Every step degrades to an honest not-started state — a
// business goal, project or revenue figure is never invented.

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
  // `Array.isArray` narrows a readonly array to `any[]`, which would then leak
  // `any` into every member access — assert the real element type back.
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

export default function BusinessPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { isLoading, data } = useBusiness(userId);
  const [activeTab, setActiveTab] = React.useState('overview');

  // UX-05: this screen is Life → Business, and says so.
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
              Business
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

      {/* Stats Grid — only show real data */}
      <div className="rounded-2xl border border-dashed border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5">
        <p className="text-[14px] text-[#94A3B8]">
          Business metrics will appear here once you set up your business profile.
        </p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card variant="standard" padding="lg">
                <h3 className="text-[18px] font-semibold text-[#111827] mb-4">Active Projects</h3>
                <p className="text-[14px] text-[#94A3B8]">
                  Your projects will appear here once you set up your business profile.
                </p>
              </Card>
              <Card variant="standard" padding="lg">
                <h3 className="text-[18px] font-semibold text-[#111827] mb-4">
                  Strategic Insights
                </h3>
                <p className="text-[14px] text-[#94A3B8]">
                  AI-powered business insights will appear here once you have business activity.
                </p>
              </Card>
            </div>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="goals">
          <ErrorBoundary section="business-goals">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Business Goals</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Strategic goals and OKR tracking coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="projects">
          <ErrorBoundary section="business-projects">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Projects</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Project management and execution tracking coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="kpis">
          <ErrorBoundary section="business-kpis">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">
                Key Performance Indicators
              </h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                KPI monitoring and analytics coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="finance">
          <ErrorBoundary section="business-finance">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Financial Overview</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Revenue, expenses, and cash flow tracking coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="risks">
          <ErrorBoundary section="business-risks">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Risk Intelligence</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Business risk analysis and mitigation tracking coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="opportunities">
          <ErrorBoundary section="business-opportunities">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Opportunity Center</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Growth opportunities and market intelligence coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
