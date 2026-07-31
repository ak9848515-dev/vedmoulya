'use client';

import React from 'react';
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
  Briefcase,
  BookOpen,
  TrendingUp,
  FileText,
  Mic,
  Search,
  Award,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useCareer } from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignedOutCard } from '../../components/SignedOutCard.js';
import { useEffect } from 'react';

export default function CareerPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user } = useAuthStore();
  const userId = user?.userId ?? '';
  const { isLoading } = useCareer(userId);
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = React.useState('profile');

  useEffect(() => {
    setActiveSection('career');
    setBreadcrumbs([{ label: 'Career', href: '/career' }, { label: 'Professional Profile' }]);
  }, [setActiveSection, setBreadcrumbs]);

  // Hydration guard: prevent SSR/client mismatch from zustand persist
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Career Intelligence..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignedOutCard />;
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827]">
              Career Intelligence
            </h1>
            <Badge variant="ai" size="sm">
              AI-Powered
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B]">
            AI-powered career insights, skills analysis, and growth recommendations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" size="md" className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Skills Analyzed
          </Badge>
        </div>
      </div>

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
                    {['Experience', 'Industry', 'Strengths', 'Growth Areas'].map((field) => (
                      <div key={field} className="p-3 rounded-lg bg-[#F8FAFC]">
                        <p className="text-[12px] font-medium text-[#94A3B8]">{field}</p>
                        <p className="text-[14px] text-[#374151] mt-0.5">—</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <Card variant="standard" padding="lg">
                <h3 className="text-[18px] font-semibold text-[#111827] mb-4">Quick Stats</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Profile Completeness', value: 0 },
                    { label: 'ATS Readiness', value: 0 },
                    { label: 'Market Fit', value: 0 },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[13px] text-[#64748B]">{stat.label}</span>
                        <span className="text-[13px] font-bold text-[#2B5FD9]">{stat.value}%</span>
                      </div>
                      <Progress value={stat.value} size="sm" />
                    </div>
                  ))}
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
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Technical', 'Domain', 'Soft Skills'].map((category) => (
                  <div
                    key={category}
                    className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]"
                  >
                    <p className="text-[13px] font-semibold text-[#374151] mb-3">{category}</p>
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[13px] text-[#64748B]">Skill {i}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((dot) => (
                              <div
                                key={dot}
                                className={`w-2 h-2 rounded-full ${dot <= 4 - i ? 'bg-[#2B5FD9]' : 'bg-[#E2E8F0]'}`}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
              <div className="space-y-4">
                {[
                  'Critical Gap: Cloud Architecture',
                  'Moderate Gap: System Design',
                  'Optional: Go Programming',
                ].map((gap, i) => (
                  <div
                    key={gap}
                    className="flex items-center justify-between p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-1.5 rounded-lg ${i === 0 ? 'bg-[#FEF2F2]' : i === 1 ? 'bg-[#FFFBEB]' : 'bg-[#EFF6FF]'}`}
                      >
                        <TrendingUp
                          className={`h-4 w-4 ${i === 0 ? 'text-[#EF4444]' : i === 1 ? 'text-[#F59E0B]' : 'text-[#3B82F6]'}`}
                        />
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-[#374151]">{gap}</p>
                        <p className="text-[12px] text-[#94A3B8]">Recommendation available</p>
                      </div>
                    </div>
                    <Badge variant={i === 0 ? 'danger' : i === 1 ? 'warning' : 'info'} size="sm">
                      {i === 0 ? 'Priority' : i === 1 ? 'Recommended' : 'Optional'}
                    </Badge>
                  </div>
                ))}
              </div>
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
              <div className="space-y-6">
                {[
                  { stage: 'Current Role', progress: 100, color: '#22C55E' },
                  { stage: 'Senior Level', progress: 35, color: '#2B5FD9' },
                  { stage: 'Lead / Architect', progress: 10, color: '#7C3AED' },
                  { stage: 'Principal / Director', progress: 0, color: '#CBD5E1' },
                ].map((milestone) => (
                  <div key={milestone.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[14px] font-medium text-[#374151]">
                        {milestone.stage}
                      </span>
                      <span className="text-[12px] text-[#64748B]">{milestone.progress}%</span>
                    </div>
                    <Progress
                      value={milestone.progress}
                      variant={
                        milestone.progress === 100
                          ? 'success'
                          : milestone.progress > 0
                            ? 'default'
                            : 'default'
                      }
                      size="md"
                    />
                  </div>
                ))}
              </div>
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
