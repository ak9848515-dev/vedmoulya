'use client';

import React, { useEffect } from 'react';
import {
  Card,
  Badge,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  Progress,
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
  Sparkles,
  BookHeart,
} from 'lucide-react';
import { useLearning } from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignedOutCard } from '../../components/SignedOutCard.js';

export default function LearningPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user } = useAuthStore();
  const userId = user?.userId ?? '';
  const { isLoading } = useLearning(userId);
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = React.useState('overview');

  useEffect(() => {
    setActiveSection('learning');
    setBreadcrumbs([{ label: 'Learning', href: '/learning' }, { label: 'Learning Home' }]);
  }, [setActiveSection, setBreadcrumbs]);

  // Hydration guard: prevent SSR/client mismatch from zustand persist
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Learning Intelligence..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignedOutCard />;
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827]">
              Learning Intelligence
            </h1>
            <Badge variant="ai" size="sm">
              Adaptive
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B]">
            Adaptive learning paths, knowledge retention, and skill development
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" size="md" className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> 5-day streak
          </Badge>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Paths',
            value: '3',
            icon: <BookOpen className="h-5 w-5 text-[#2B5FD9]" />,
            bg: 'bg-[#EFF4FE]',
          },
          {
            label: 'Completion Rate',
            value: '72%',
            icon: <TrendingUp className="h-5 w-5 text-[#22C55E]" />,
            bg: 'bg-[#F0FDF4]',
          },
          {
            label: 'Retention Score',
            value: '68%',
            icon: <Award className="h-5 w-5 text-[#7C3AED]" />,
            bg: 'bg-[#F5F3FF]',
          },
          {
            label: 'Assessments',
            value: '5',
            icon: <Target className="h-5 w-5 text-[#F59E0B]" />,
            bg: 'bg-[#FFFBEB]',
          },
        ].map((stat) => (
          <Card key={stat.label} variant="standard" padding="md">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
              <div>
                <p className="text-[12px] text-[#64748B] font-medium">{stat.label}</p>
                <p className="text-[22px] font-bold text-[#111827]">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
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
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 py-3 border-b border-[#F1F5F9] last:border-0"
                  >
                    <div className="p-2 rounded-lg bg-[#EFF4FE]">
                      <BookOpen className="h-4 w-4 text-[#2B5FD9]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-medium text-[#374151]">Learning Path {i}</p>
                      <Progress value={30 + i * 20} size="sm" className="mt-1" />
                    </div>
                    <span className="text-[13px] font-medium text-[#2B5FD9]">{30 + i * 20}%</span>
                  </div>
                ))}
              </Card>
              <Card variant="standard" padding="lg">
                <h3 className="text-[18px] font-semibold text-[#111827] mb-4">
                  Recommended Topics
                </h3>
                <div className="space-y-2">
                  {[
                    'Advanced TypeScript Patterns',
                    'System Design Fundamentals',
                    'Machine Learning Basics',
                    'Cloud Architecture',
                  ].map((topic) => (
                    <div
                      key={topic}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" />
                        <span className="text-[13px] text-[#374151]">{topic}</span>
                      </div>
                      <Badge variant="ai" size="sm">
                        AI Recommended
                      </Badge>
                    </div>
                  ))}
                </div>
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
