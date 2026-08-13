/* eslint-disable security/detect-object-injection -- Heuristic rule: keys are typed literal unions (content status), not user input */
'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState, Progress } from '@vedmoulya/ui';
import {
  BarChart3,
  FileText,
  Users,
  FolderKanban,
  DollarSign,
  Clock,
  Zap,
  Sparkles,
} from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary.js';
import { useContentAgencyAnalytics } from '../../../lib/api-client.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import { AgencySubNav } from '../_components/AgencySubNav.js';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[#94A3B8]',
  review: 'bg-[#F59E0B]',
  approved: 'bg-[#22C55E]',
  scheduled: 'bg-[#3B82F6]',
  published: 'bg-[#8B5CF6]',
};

export default function AnalyticsPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Analytics', '/content-agency/analytics');
  const analytics = useContentAgencyAnalytics(userId);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading analytics..." size="lg" />
      </div>
    );
  }
  if (!userId) return <SignInRedirect />;

  const data = analytics.data;
  if (analytics.isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading analytics..." size="lg" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        <AgencySubNav />
        <Card variant="standard" padding="lg">
          <EmptyState
            title="Analytics unavailable"
            description="We couldn't load analytics data."
            action={{ label: 'Retry', onClick: () => void analytics.refetch() }}
          />
        </Card>
      </div>
    );
  }

  const statusTotal = Object.values(data.byStatus).reduce((s, n) => s + n, 0) || 1;
  const typeTotal = Object.values(data.byContentType).reduce((s, n) => s + n, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
          Analytics
        </h1>
        <Badge variant="info" size="sm">
          Agency performance
        </Badge>
      </div>
      <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8] -mt-4">
        Content created, revenue, time saved and AI usage across the agency.
      </p>

      <AgencySubNav />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#EFF4FE]">
              <FileText className="h-5 w-5 text-[#2B5FD9]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">Content created</p>
              <p className="text-[22px] font-bold text-[#111827] dark:text-[#F1F5F9]">
                {data.contentCreated}
              </p>
            </div>
          </div>
        </Card>
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F0FDF4]">
              <Users className="h-5 w-5 text-[#22C55E]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">Clients</p>
              <p className="text-[22px] font-bold text-[#111827] dark:text-[#F1F5F9]">
                {data.clients}
              </p>
            </div>
          </div>
        </Card>
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFFBEB]">
              <FolderKanban className="h-5 w-5 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">Projects</p>
              <p className="text-[22px] font-bold text-[#111827] dark:text-[#F1F5F9]">
                {data.projects}
              </p>
            </div>
          </div>
        </Card>
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F5F3FF]">
              <DollarSign className="h-5 w-5 text-[#7C3AED]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">Revenue</p>
              <p className="text-[22px] font-bold text-[#111827] dark:text-[#F1F5F9]">
                ${data.revenue.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* AI usage + time saved */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ErrorBoundary section="content-agency-analytics-ai">
          <Card variant="standard" padding="lg">
            <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9] flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-[#7C3AED]" /> AI Usage
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[22px] font-bold text-[#7C3AED]">{data.aiUsage.generations}</p>
                <p className="text-[11.5px] text-[#94A3B8]">Generations</p>
              </div>
              <div>
                <p className="text-[22px] font-bold text-[#7C3AED]">
                  {data.aiUsage.tokens.toLocaleString()}
                </p>
                <p className="text-[11.5px] text-[#94A3B8]">Tokens</p>
              </div>
              <div>
                <p className="text-[22px] font-bold text-[#7C3AED]">
                  ${data.aiUsage.cost.toFixed(4)}
                </p>
                <p className="text-[11.5px] text-[#94A3B8]">Cost</p>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12.5px] text-[#64748B]">Average quality score</span>
                <span className="text-[12.5px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                  {data.aiUsage.avgQualityScore}/10
                </span>
              </div>
              <Progress value={data.aiUsage.avgQualityScore * 10} size="md" variant="ai" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-[12.5px] text-[#64748B]">
              <Clock className="h-4 w-4 text-[#22C55E]" />
              <span>
                <span className="font-semibold text-[#111827] dark:text-[#F1F5F9]">
                  ~{(data.timeSavedMinutes / 60).toFixed(1)} hours
                </span>{' '}
                of writing time saved
              </span>
            </div>
          </Card>
        </ErrorBoundary>

        <ErrorBoundary section="content-agency-analytics-status">
          <Card variant="standard" padding="lg">
            <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9] flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-[#2B5FD9]" /> Content by status
            </h3>
            <div className="space-y-3">
              {Object.entries(data.byStatus).map(([status, count]) => (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 text-[12.5px] text-[#64748B] capitalize">
                      <span
                        className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] ?? 'bg-[#94A3B8]'}`}
                      />
                      {status}
                    </span>
                    <span className="text-[12.5px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                      {count}
                    </span>
                  </div>
                  <Progress value={(count / statusTotal) * 100} size="sm" />
                </div>
              ))}
              {Object.keys(data.byStatus).length === 0 && (
                <p className="text-[13px] text-[#94A3B8]">No content yet.</p>
              )}
            </div>
          </Card>
        </ErrorBoundary>
      </div>

      {/* Content types + top clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ErrorBoundary section="content-agency-analytics-types">
          <Card variant="standard" padding="lg">
            <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9] mb-4">
              Content by type
            </h3>
            <div className="space-y-3">
              {Object.entries(data.byContentType).map(([type, count]) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12.5px] text-[#64748B] capitalize">
                      {type.replace('_', ' ')}
                    </span>
                    <span className="text-[12.5px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                      {count}
                    </span>
                  </div>
                  <Progress value={(count / typeTotal) * 100} size="sm" variant="default" />
                </div>
              ))}
              {Object.keys(data.byContentType).length === 0 && (
                <p className="text-[13px] text-[#94A3B8]">No content yet.</p>
              )}
            </div>
          </Card>
        </ErrorBoundary>

        <ErrorBoundary section="content-agency-analytics-clients">
          <Card variant="standard" padding="lg">
            <h3 className="text-[16px] font-semibold text-[#111827] dark:text-[#F1F5F9] flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-[#F59E0B]" /> Top clients by content
            </h3>
            {data.byClient.length === 0 ? (
              <p className="text-[13px] text-[#94A3B8]">No client activity yet.</p>
            ) : (
              <ul className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                {data.byClient.map((client, i) => (
                  <li key={client.clientId} className="py-2.5 flex items-center gap-3">
                    <span className="w-5 text-[13px] font-semibold text-[#94A3B8]">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-[#374151] dark:text-[#E2E8F0] truncate">
                        {client.clientName}
                      </p>
                    </div>
                    <span className="text-[13px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                      {client.contentCount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </ErrorBoundary>
      </div>
    </div>
  );
}
