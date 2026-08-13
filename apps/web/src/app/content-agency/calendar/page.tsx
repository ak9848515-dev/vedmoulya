'use client';

import React, { useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@vedmoulya/ui';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary.js';
import { useContentCalendar } from '../../../lib/api-client.js';
import { SignInRedirect } from '../../../components/SignInRedirect.js';
import { useAgencyPage } from '../_components/use-agency-page.js';
import { AgencySubNav } from '../_components/AgencySubNav.js';

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-[#94A3B8]',
  review: 'bg-[#F59E0B]',
  approved: 'bg-[#22C55E]',
  scheduled: 'bg-[#3B82F6]',
  published: 'bg-[#8B5CF6]',
};

/** Local date as YYYY-MM-DD (avoids UTC date drift for the calendar anchor). */
function localToday(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA');
}

export default function CalendarPage(): React.JSX.Element {
  const { ready, userId } = useAgencyPage('Calendar', '/content-agency/calendar');
  const [range, setRange] = useState<'month' | 'week' | 'day'>('month');
  const [anchor, setAnchor] = useState<string>(localToday());
  const calendar = useContentCalendar(userId, range, anchor);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading calendar..." size="lg" />
      </div>
    );
  }
  if (!userId) return <SignInRedirect />;

  const entries = calendar.data ?? [];

  function shift(days: number): void {
    const d = new Date(`${anchor}T12:00:00`);
    if (range === 'month') d.setMonth(d.getMonth() + days);
    else if (range === 'week') d.setDate(d.getDate() + days * 7);
    else d.setDate(d.getDate() + days);
    setAnchor(d.toISOString().slice(0, 10));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-heading font-bold text-[#111827] dark:text-[#F1F5F9]">
              Content Calendar
            </h1>
            <Badge variant="info" size="sm">
              {entries.length} scheduled
            </Badge>
          </div>
          <p className="text-[15px] text-[#64748B] dark:text-[#94A3B8]">
            Monthly, weekly and daily planning for every piece of content.
          </p>
        </div>
      </div>

      <AgencySubNav />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs
          value={range}
          onValueChange={(v) => {
            setRange(v as 'month' | 'week' | 'day');
          }}
        >
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="day">Day</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAnchor(localToday());
            }}
            className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] px-2.5 py-2 text-[12.5px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#2B5FD9] transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => {
              shift(-1);
            }}
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-[#64748B] hover:text-[#2B5FD9] transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[13.5px] font-medium text-[#111827] dark:text-[#F1F5F9] min-w-[110px] text-center capitalize">
            {new Date(`${anchor}T12:00:00`).toLocaleDateString(
              undefined,
              range === 'month'
                ? { month: 'long', year: 'numeric' }
                : { month: 'short', day: 'numeric' },
            )}
          </span>
          <button
            onClick={() => {
              shift(1);
            }}
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-[#64748B] hover:text-[#2B5FD9] transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ErrorBoundary section="content-agency-calendar">
        <TabsContent value={range} className="mt-0">
          {calendar.isLoading && !entries.length ? (
            <Loading label="Loading calendar..." />
          ) : !entries.length ? (
            <Card variant="standard" padding="lg">
              <EmptyState
                icon={<CalendarDays className="h-8 w-8 text-[#2B5FD9]" />}
                title="Nothing scheduled"
                description="Generate content, then schedule it from the Review screen."
              />
            </Card>
          ) : (
            <Card variant="standard" padding="lg">
              <ul className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                {entries.map((entry) => (
                  <li key={entry.contentId} className="flex items-center gap-3 py-3">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[entry.status] ?? 'bg-[#94A3B8]'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-[#374151] dark:text-[#E2E8F0] truncate">
                        {entry.title}
                      </p>
                      <p className="text-[12px] text-[#64748B] capitalize">
                        {entry.clientName} · {entry.contentType} · {entry.workflowStage}
                      </p>
                    </div>
                    <span className="text-[12px] text-[#94A3B8] whitespace-nowrap">
                      {new Date(entry.scheduledFor).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Badge variant="info" size="sm" className="capitalize">
                      {entry.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>
      </ErrorBoundary>
    </div>
  );
}
