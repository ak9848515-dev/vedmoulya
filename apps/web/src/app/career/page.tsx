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
  Briefcase,
  BookOpen,
  TrendingUp,
  FileText,
  Mic,
  Search,
  Award,
  ArrowRight,
  Sparkles,
  Flag,
  Rocket,
  Trophy,
} from 'lucide-react';
import { useCareer } from '../../lib/api-client.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { PageContextBar } from '../../components/PageContextBar.js';
import { LifeJourneyStrip, type JourneyStep } from '../life/LifeJourneyStrip.js';
import { usePageContext } from '../../lib/use-page-context.js';

// ── UX-05 journey (real data only) ─────────────────────────────────────────
//
// Every field read here exists on the REAL CareerSnapshotDTO. When a field is
// absent or empty the step is shown honestly as not-started — a goal, mission
// or percentage is never invented.

interface CareerJourneyInput {
  profile?: { targetRole?: string | null } | null;
  skills?: { totalCount?: number; skills?: ReadonlyArray<unknown> } | null;
  gaps?: ReadonlyArray<unknown> | null;
  roadmap?: {
    milestones?: ReadonlyArray<{ status?: string; title?: string }>;
    targetStage?: string | null;
  } | null;
}

function careerJourneySteps(data: unknown): JourneyStep[] {
  const input = (typeof data === 'object' && data !== null ? data : {}) as CareerJourneyInput;

  const targetRole = typeof input.profile?.targetRole === 'string' ? input.profile.targetRole : '';
  // `Array.isArray` narrows a readonly array to `any[]`, which would then leak
  // `any` into every member access — assert the real element type back.
  const milestones = (
    Array.isArray(input.roadmap?.milestones) ? input.roadmap.milestones : []
  ) as ReadonlyArray<{ status?: string; title?: string }>;
  const completed = milestones.filter((milestone) => milestone.status === 'completed').length;
  const skillCount =
    typeof input.skills?.totalCount === 'number'
      ? input.skills.totalCount
      : Array.isArray(input.skills?.skills)
        ? input.skills.skills.length
        : 0;
  const gapCount = Array.isArray(input.gaps) ? input.gaps.length : 0;
  const targetStage =
    typeof input.roadmap?.targetStage === 'string' ? input.roadmap.targetStage : '';

  return [
    {
      label: 'Goal',
      detail:
        targetRole.length > 0
          ? `Target role: ${targetRole}`
          : 'Set a target role to give this area a direction.',
      href: '/goals',
      icon: Flag,
      hasData: targetRole.length > 0,
    },
    {
      label: 'Mission',
      detail:
        milestones.length > 0
          ? 'Career work runs as missions you can start, watch and verify.'
          : 'No career mission has been started yet.',
      href: '/missions',
      icon: Rocket,
      hasData: milestones.length > 0,
    },
    {
      label: 'Progress',
      detail:
        milestones.length > 0
          ? `${completed} of ${milestones.length} roadmap milestone${
              milestones.length === 1 ? '' : 's'
            } completed.`
          : 'No roadmap milestones recorded yet.',
      href: milestones.length > 0 ? '/progress' : null,
      icon: TrendingUp,
      hasData: milestones.length > 0,
    },
    {
      label: 'Outcome',
      detail:
        skillCount > 0 || gapCount > 0
          ? `${skillCount} skill${skillCount === 1 ? '' : 's'} tracked, ${gapCount} gap${
              gapCount === 1 ? '' : 's'
            } identified${targetStage.length > 0 ? ` for ${targetStage}` : ''}.`
          : 'Outcomes appear once your career profile is set up.',
      href: skillCount > 0 || gapCount > 0 ? '/progress' : null,
      icon: Trophy,
      hasData: skillCount > 0 || gapCount > 0,
    },
  ];
}

export default function CareerPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { isLoading, data } = useCareer(userId);
  const [activeTab, setActiveTab] = React.useState('profile');

  // UX-05: this screen is Life → Career, and says so.
  const context = usePageContext({ pathname: '/career', label: 'Career' });

  // Hydration guard: prevent SSR/client mismatch from zustand persist
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Career Intelligence..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Career Intelligence..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* UX-05 — Life → Career context: the user must know which area this is. */}
      <PageContextBar
        context={context}
        label="Career"
        description="Career is one area of your life in VedMoulya. Goals here become missions you can run."
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827]">Career</h1>
            <Badge variant="ai" size="sm">
              Part of Life
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B]">
            Your career goals, skills and the work you are building.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" size="md" className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Skills Analyzed
          </Badge>
        </div>
      </div>

      {/* UX-05 — Area → Goal → Mission → Progress → Outcome, from real data only. */}
      <LifeJourneyStrip steps={careerJourneySteps(data)} />

      {/* Tabs */}
      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile">
            <Briefcase className="h-4 w-4 mr-1.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="skills">
            <BookOpen className="h-4 w-4 mr-1.5" /> Skills
          </TabsTrigger>
          <TabsTrigger value="gaps">
            <TrendingUp className="h-4 w-4 mr-1.5" /> Gap Analysis
          </TabsTrigger>
          <TabsTrigger value="roadmap">
            <ArrowRight className="h-4 w-4 mr-1.5" /> Roadmap
          </TabsTrigger>
          <TabsTrigger value="resume">
            <FileText className="h-4 w-4 mr-1.5" /> Resume
          </TabsTrigger>
          <TabsTrigger value="interview">
            <Mic className="h-4 w-4 mr-1.5" /> Interview
          </TabsTrigger>
          <TabsTrigger value="jobs">
            <Search className="h-4 w-4 mr-1.5" /> Job Match
          </TabsTrigger>
          <TabsTrigger value="certifications">
            <Award className="h-4 w-4 mr-1.5" /> Certifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ErrorBoundary section="career-profile">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card variant="standard" padding="lg" className="md:col-span-2">
                <h3 className="text-[18px] font-semibold text-[#111827] mb-4">
                  Professional Profile
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b border-[#E2E8F0]">
                    <div className="h-16 w-16 rounded-full bg-[#EFF4FE] flex items-center justify-center">
                      <Briefcase className="h-8 w-8 text-[#2B5FD9]" />
                    </div>
                    <div>
                      <p className="text-[16px] font-semibold text-[#111827]">Current Position</p>
                      <p className="text-[14px] text-[#64748B]">Loading from API...</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Experience', value: '—' },
                      { label: 'Industry', value: '—' },
                      { label: 'Strengths', value: 'Set up your career profile to see strengths' },
                      {
                        label: 'Growth Areas',
                        value: 'Set up your career profile to see growth areas',
                      },
                    ].map((field) => (
                      <div key={field.label} className="p-3 rounded-lg bg-[#F8FAFC]">
                        <p className="text-[12px] font-medium text-[#94A3B8]">{field.label}</p>
                        <p className="text-[14px] text-[#374151] mt-0.5">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <Card variant="standard" padding="lg">
                <h3 className="text-[18px] font-semibold text-[#111827] mb-4">Quick Stats</h3>
                <div className="space-y-4">
                  <p className="text-[13px] text-[#94A3B8]">
                    Complete your career profile to see stats here.
                  </p>
                </div>
              </Card>
            </div>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="skills">
          <ErrorBoundary section="career-skills">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-4">Skills Inventory</h3>
              <p className="text-[14px] text-[#64748B] mb-6">
                Skills data loading from career service...
              </p>{' '}
              <p className="text-[14px] text-[#94A3B8]">
                Skills data will appear here once your career profile is set up.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="gaps">
          <ErrorBoundary section="career-gaps">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-2">Skill Gap Analysis</h3>
              <p className="text-[14px] text-[#64748B] mb-6">
                AI-powered analysis of skills needed for your career goals
              </p>
              <p className="text-[14px] text-[#94A3B8]">
                Skill gap analysis will appear once your career profile is set up.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="roadmap">
          <ErrorBoundary section="career-roadmap">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827] mb-2">Career Roadmap</h3>
              <p className="text-[14px] text-[#64748B] mb-6">
                Your personalized career progression plan
              </p>
              <p className="text-[14px] text-[#94A3B8]">
                Your career roadmap will appear once your career profile is set up.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="resume">
          <ErrorBoundary section="career-resume">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Resume Intelligence</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Resume analysis and ATS optimization coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="interview">
          <ErrorBoundary section="career-interview">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Interview Center</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Mock interviews and readiness assessment coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="jobs">
          <ErrorBoundary section="career-jobs">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Job Matching</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                AI-powered job matching and market insights coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="certifications">
          <ErrorBoundary section="career-certifications">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Certifications</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Certification tracking and recommendations coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
