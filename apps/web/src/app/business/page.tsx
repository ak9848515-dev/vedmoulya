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
  BarChart3,
  Goal,
  FolderKanban,
  TrendingUp,
  LineChart,
  DollarSign,
  PiggyBank,
  Shield,
  Lightbulb,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useBusiness } from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';

export default function BusinessPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { isLoading } = useBusiness(userId);
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = React.useState('overview');

  useEffect(() => {
    setActiveSection('business');
    setBreadcrumbs([{ label: 'Business', href: '/business' }, { label: 'Business Dashboard' }]);
  }, [setActiveSection, setBreadcrumbs]);

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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827]">
              Business Intelligence
            </h1>
            <Badge variant="info" size="sm">
              Real-time
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B]">
            AI-powered business insights, KPI tracking, and strategic recommendations
          </p>
        </div>
        <Badge variant="success" size="md" className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> All Systems Healthy
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Projects',
            value: '6',
            icon: <FolderKanban className="h-5 w-5 text-[#2B5FD9]" />,
            bg: 'bg-[#EFF4FE]',
          },
          {
            label: 'Revenue (MTD)',
            value: '$12.4k',
            icon: <LineChart className="h-5 w-5 text-[#22C55E]" />,
            bg: 'bg-[#F0FDF4]',
          },
          {
            label: 'Risk Score',
            value: '23',
            icon: <Shield className="h-5 w-5 text-[#F59E0B]" />,
            bg: 'bg-[#FFFBEB]',
          },
          {
            label: 'Profit Margin',
            value: '18.5%',
            icon: <PiggyBank className="h-5 w-5 text-[#7C3AED]" />,
            bg: 'bg-[#F5F3FF]',
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
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 py-3 border-b border-[#F1F5F9] last:border-0"
                  >
                    <div
                      className={`p-2 rounded-lg ${i === 0 ? 'bg-[#EFF4FE]' : i === 1 ? 'bg-[#FFFBEB]' : 'bg-[#F0FDF4]'}`}
                    >
                      <FolderKanban
                        className={`h-4 w-4 ${i === 0 ? 'text-[#2B5FD9]' : i === 1 ? 'text-[#F59E0B]' : 'text-[#22C55E]'}`}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-medium text-[#374151]">
                        Project Alpha {i + 1}
                      </p>
                      <Progress
                        value={30 + i * 25}
                        size="sm"
                        variant={i === 0 ? 'default' : i === 1 ? 'success' : 'default'}
                        className="mt-1"
                      />
                    </div>
                    <Badge variant={i === 1 ? 'warning' : i === 0 ? 'info' : 'success'} size="sm">
                      {i === 0 ? 'Active' : i === 1 ? 'At Risk' : 'On Track'}
                    </Badge>
                  </div>
                ))}
              </Card>
              <Card variant="standard" padding="lg">
                <h3 className="text-[18px] font-semibold text-[#111827] mb-4">
                  Strategic Insights
                </h3>
                <div className="space-y-3">
                  {[
                    { text: 'Revenue growth 12% above target this quarter', type: 'positive' },
                    { text: 'Customer acquisition cost decreased by 8%', type: 'positive' },
                    {
                      text: 'Two projects identified as at-risk — review resource allocation',
                      type: 'warning',
                    },
                    { text: 'New market opportunity detected in APAC region', type: 'info' },
                  ].map((insight) => (
                    <div
                      key={insight.text}
                      className={`flex items-start gap-2 p-3 rounded-lg ${insight.type === 'positive' ? 'bg-[#F0FDF4]' : insight.type === 'warning' ? 'bg-[#FFFBEB]' : 'bg-[#EFF6FF]'}`}
                    >
                      <Sparkles
                        className={`h-4 w-4 mt-0.5 ${insight.type === 'positive' ? 'text-[#22C55E]' : insight.type === 'warning' ? 'text-[#F59E0B]' : 'text-[#3B82F6]'}`}
                      />
                      <p className="text-[13px] text-[#374151]">{insight.text}</p>
                    </div>
                  ))}
                </div>
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
