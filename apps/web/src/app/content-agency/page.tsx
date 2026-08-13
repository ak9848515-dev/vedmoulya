/* eslint-disable security/detect-object-injection -- Heuristic rule: keys are typed literal unions (content status), not user input */
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import {
  FileText,
  Users,
  FolderKanban,
  DollarSign,
  Clock,
  Sparkles,
  Zap,
  CalendarDays,
  ArrowRight,
} from 'lucide-react';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { useContentAgencyDashboard } from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { AgencySubNav } from './_components/AgencySubNav.js';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-[#F1F5F9] text-[#64748B]' },
  review: { label: 'In Review', className: 'bg-[#FFFBEB] text-[#B45309]' },
  approved: { label: 'Approved', className: 'bg-[#F0FDF4] text-[#15803D]' },
  scheduled: { label: 'Scheduled', className: 'bg-[#EFF4FE] text-[#1D4ED8]' },
  published: { label: 'Published', className: 'bg-[#F5F3FF] text-[#6D28D9]' },
};
const DEFAULT_STATUS_STYLE = { label: 'Draft', className: 'bg-[#F1F5F9] text-[#64748B]' };

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const style = STATUS_STYLES[status] ?? DEFAULT_STATUS_STYLE;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}

export default function ContentAgencyPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const dashboard = useContentAgencyDashboard(userId);
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();

  useEffect(() => {
    setActiveSection('content-agency');
    setBreadcrumbs([{ label: 'Content Agency', href: '/content-agency' }, { label: 'Dashboard' }]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Content Agency..." size="lg" />
      </div>
    );
  }

  if (!user) return <SignInRedirect />;

  const data = dashboard.data;

  if (dashboard.isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Content Agency..." size="lg" />
      </div>
    );
  }

  const stats = data?.analytics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
              AI Content Agency
            </h1>
            <Badge variant="info" size="sm">
              Revenue Module
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8]">
            Clients, brands, and AI-generated content — end to end.
          </p>
        </div>
        <Link
          href="/content-agency/generator"
          className="inline-flex items-center gap-2 rounded-lg bg-[#2B5FD9] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#1E4FC4] transition-colors"
        >
          <Sparkles className="h-4 w-4" /> Generate Content
        </Link>
      </div>

      <AgencySubNav />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#EFF4FE]">
              <FileText className="h-5 w-5 text-[#2B5FD9]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">Content Created</p>
              <p className="text-[22px] font-bold text-[#111827] dark:text-[#F1F5F9]">
                {stats?.contentCreated ?? 0}
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
                {stats?.clients ?? 0}
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
                {stats?.projects ?? 0}
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
                ${(stats?.revenue ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* AI usage strip */}
      {stats?.aiUsage && stats.aiUsage.generations > 0 && (
        <Card
          variant="standard"
          padding="md"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-gradient-to-r from-[#F5F3FF] to-[#EFF4FE] dark:from-[#1E1B4B] dark:to-[#172554]"
        >
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#7C3AED]">
            <Zap className="h-4 w-4" /> AI Pipeline
          </span>
          <span className="text-[13px] text-[#64748B]">
            {stats.aiUsage.generations} generations · {stats.aiUsage.tokens.toLocaleString()} tokens
            · ${stats.aiUsage.cost.toFixed(4)} cost
          </span>
          <span className="text-[13px] text-[#64748B]">
            Avg quality{' '}
            <span className="font-semibold text-[#111827] dark:text-[#F1F5F9]">
              {stats.aiUsage.avgQualityScore}/10
            </span>
          </span>
          <span className="text-[13px] text-[#64748B]">
            Time saved{' '}
            <span className="font-semibold text-[#111827] dark:text-[#F1F5F9]">
              ~{(stats.timeSavedMinutes / 60).toFixed(1)}h
            </span>
          </span>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Content */}
        <ErrorBoundary section="content-agency-upcoming">
          <Card variant="standard" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                Upcoming Content
              </h3>
              <Link
                href="/content-agency/calendar"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#2B5FD9] hover:underline"
              >
                <CalendarDays className="h-3.5 w-3.5" /> Calendar
              </Link>
            </div>
            {!data?.upcomingContent.length ? (
              <EmptyState
                title="Nothing scheduled"
                description="Generate content and schedule it to see it here."
                action={{
                  label: 'Open Generator',
                  onClick: () => {
                    window.location.href = '/content-agency/generator';
                  },
                }}
              />
            ) : (
              <ul className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                {data.upcomingContent.map((entry) => (
                  <li key={entry.contentId} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-[#374151] dark:text-[#E2E8F0] truncate">
                        {entry.title}
                      </p>
                      <p className="text-[12px] text-[#64748B] truncate">
                        {entry.clientName} · {entry.contentType}
                      </p>
                    </div>
                    <span className="text-[12px] text-[#94A3B8] whitespace-nowrap">
                      {new Date(entry.scheduledFor).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <StatusBadge status={entry.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </ErrorBoundary>

        {/* Recent Content */}
        <ErrorBoundary section="content-agency-recent">
          <Card variant="standard" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-semibold text-[#111827] dark:text-[#F1F5F9]">
                Recent Content
              </h3>
              <Link
                href="/content-agency/review"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#2B5FD9] hover:underline"
              >
                Review queue <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {!data?.recentContent.length ? (
              <EmptyState
                title="No content yet"
                description="Your AI-generated assets will appear here."
                action={{
                  label: 'Create your first',
                  onClick: () => {
                    window.location.href = '/content-agency/generator';
                  },
                }}
              />
            ) : (
              <ul className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                {data.recentContent.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-[#374151] dark:text-[#E2E8F0] truncate">
                        {item.title}
                      </p>
                      <p className="text-[12px] text-[#64748B] flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {' · '}
                        {item.versions.length} version{item.versions.length === 1 ? '' : 's'}
                        {item.aiMetadata ? ' · AI' : ''}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </ErrorBoundary>
      </div>

      {dashboard.isError && !data && (
        <Card variant="standard" padding="md">
          <p className="text-[13.5px] text-[#EF4444]">
            Couldn&apos;t load the dashboard.
            <button
              onClick={() => void dashboard.refetch()}
              className="ml-2 font-semibold text-[#2B5FD9] hover:underline"
            >
              Retry
            </button>
          </p>
        </Card>
      )}
    </div>
  );
}
