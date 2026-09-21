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
  BookOpen,
  TrendingUp,
  Target,
  FileText,
  RefreshCw,
  Award,
  Zap,
  BookHeart,
} from 'lucide-react';
import { useLearning } from '../../lib/api-client.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { PageContextBar } from '../../components/PageContextBar.js';
import { LifeJourneyStrip, type JourneyStep } from '../life/LifeJourneyStrip.js';
import { usePageContext } from '../../lib/use-page-context.js';
import { Flag, Rocket } from 'lucide-react';

// ── UX-05 journey (real data only) ─────────────────────────────────────────
//
// Reads the REAL LearningSnapshotDTO: profile.goals, goals[], missions[],
// skillProgress[] and achievements[]. Every step degrades to an honest
// not-started state — nothing is invented.

interface LearningJourneyInput {
  profile?: { goals?: ReadonlyArray<string> } | null;
  goals?: ReadonlyArray<{ title?: string; status?: string }> | null;
  missions?: ReadonlyArray<{ title?: string; status?: string; progress?: number }> | null;
  skillProgress?: ReadonlyArray<unknown> | null;
  achievements?: ReadonlyArray<unknown> | null;
}

function learningJourneySteps(data: unknown): JourneyStep[] {
  const input = (typeof data === 'object' && data !== null ? data : {}) as LearningJourneyInput;

  // `Array.isArray` narrows a readonly array to `any[]`, which would then leak
  // `any` into every member access — assert the real element type back.
  const profileGoals = (
    Array.isArray(input.profile?.goals) ? input.profile.goals : []
  ) as ReadonlyArray<string>;
  const goals = (Array.isArray(input.goals) ? input.goals : []) as ReadonlyArray<{
    title?: string;
    status?: string;
  }>;
  const goalsCount = Math.max(profileGoals.length, goals.length);
  const firstGoal = goals[0]?.title ?? profileGoals[0] ?? '';

  const missions = (Array.isArray(input.missions) ? input.missions : []) as ReadonlyArray<{
    title?: string;
    status?: string;
    progress?: number;
  }>;
  const completedMissions = missions.filter((mission) => mission.status === 'completed').length;

  const skillsTracked = Array.isArray(input.skillProgress) ? input.skillProgress.length : 0;
  const achievements = Array.isArray(input.achievements) ? input.achievements.length : 0;

  return [
    {
      label: 'Goal',
      detail:
        goalsCount > 0
          ? `${goalsCount} learning goal${goalsCount === 1 ? '' : 's'}${
              firstGoal.length > 0 ? `, starting with “${firstGoal}”` : ''
            }.`
          : 'Set a learning goal to give this area a direction.',
      href: '/goals',
      icon: Flag,
      hasData: goalsCount > 0,
    },
    {
      label: 'Mission',
      detail:
        missions.length > 0
          ? `${missions.length} learning mission${missions.length === 1 ? '' : 's'} tracked.`
          : 'No learning mission has been started yet.',
      href: '/missions',
      icon: Rocket,
      hasData: missions.length > 0,
    },
    {
      label: 'Progress',
      detail:
        missions.length > 0 || skillsTracked > 0
          ? `${completedMissions} of ${missions.length} mission${
              missions.length === 1 ? '' : 's'
            } completed, ${skillsTracked} skill${skillsTracked === 1 ? '' : 's'} in progress.`
          : 'No learning progress recorded yet.',
      href: missions.length > 0 || skillsTracked > 0 ? '/progress' : null,
      icon: Zap,
      hasData: missions.length > 0 || skillsTracked > 0,
    },
    {
      label: 'Outcome',
      detail:
        achievements > 0
          ? `${achievements} achievement${achievements === 1 ? '' : 's'} earned.`
          : 'Outcomes appear once you complete learning work.',
      href: achievements > 0 ? '/progress' : null,
      icon: Award,
      hasData: achievements > 0,
    },
  ];
}

export default function LearningPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { isLoading, data } = useLearning(userId);
  const [activeTab, setActiveTab] = React.useState('overview');

  // UX-05: this screen is Life → Learning, and says so.
  const context = usePageContext({ pathname: '/learning', label: 'Learning' });

  // Hydration guard: prevent SSR/client mismatch from zustand persist
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Learning Intelligence..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Learning Intelligence..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* UX-05 — Life → Learning context */}
      <PageContextBar
        context={context}
        label="Learning"
        description="Learning is one area of your life in VedMoulya. What you set as a goal here becomes something you can work on."
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827]">Learning</h1>
            <Badge variant="ai" size="sm">
              Part of Life
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B]">
            What you are learning next and how far you have come.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" size="md" className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> 5-day streak
          </Badge>
        </div>
      </div>

      {/* UX-05 — Area → Goal → Mission → Progress → Outcome, from real data only. */}
      <LifeJourneyStrip steps={learningJourneySteps(data)} />

      {/* Stats Overview — only show real data */}
      <div className="rounded-2xl border border-dashed border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5">
        <p className="text-[14px] text-[#94A3B8]">
          Learning stats will appear here once you start your first learning path.
        </p>
      </div>

      {/* Tabs */}
      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BookHeart className="h-4 w-4 mr-1.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="paths">
            <BookOpen className="h-4 w-4 mr-1.5" /> Paths
          </TabsTrigger>
          <TabsTrigger value="missions">
            <Target className="h-4 w-4 mr-1.5" /> Missions
          </TabsTrigger>
          <TabsTrigger value="assessments">
            <FileText className="h-4 w-4 mr-1.5" /> Assessments
          </TabsTrigger>
          <TabsTrigger value="revision">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Revision
          </TabsTrigger>
          <TabsTrigger value="progress">
            <TrendingUp className="h-4 w-4 mr-1.5" /> Progress
          </TabsTrigger>
          <TabsTrigger value="achievements">
            <Award className="h-4 w-4 mr-1.5" /> Achievements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ErrorBoundary section="learning-overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card variant="standard" padding="lg">
                <h3 className="text-[18px] font-semibold text-[#111827] mb-4">
                  Active Learning Paths
                </h3>
                <p className="text-[14px] text-[#94A3B8]">
                  Your learning paths will appear here once you start learning.
                </p>
              </Card>
              <Card variant="standard" padding="lg">
                <h3 className="text-[18px] font-semibold text-[#111827] mb-4">
                  Recommended Topics
                </h3>
                <p className="text-[14px] text-[#94A3B8]">
                  AI recommendations will appear here once you have learning activity.
                </p>
              </Card>
            </div>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="paths">
          <ErrorBoundary section="learning-paths">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Learning Paths</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Structured learning paths with milestones and AI-adaptive pacing coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="missions">
          <ErrorBoundary section="learning-missions">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Mission-Based Learning</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Mission-based learning with projects and practical applications coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="assessments">
          <ErrorBoundary section="learning-assessments">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Assessments</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Knowledge assessments and skill validation coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="revision">
          <ErrorBoundary section="learning-revision">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Revision Center</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Spaced repetition and revision schedule coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="progress">
          <ErrorBoundary section="learning-progress">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Progress Analytics</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Detailed progress tracking and learning analytics coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="achievements">
          <ErrorBoundary section="learning-achievements">
            <Card variant="standard" padding="lg">
              <h3 className="text-[18px] font-semibold text-[#111827]">Achievements</h3>
              <p className="text-[14px] text-[#64748B] mt-2">
                Learning achievements and milestones coming soon.
              </p>
            </Card>
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
