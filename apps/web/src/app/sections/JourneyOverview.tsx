// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Journey Overview
// Daily, weekly, and monthly progress with momentum and consistency indicators
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Progress } from '@vedmoulya/ui';
import { TrendingUp, Zap, Target, CalendarDays } from 'lucide-react';
import type { ExecutionSummary, Metrics } from './types.js';

export interface JourneyOverviewProps {
  execution: Pick<ExecutionSummary, 'completedToday' | 'activePlans' | 'totalEstimatedMinutes'>;
  metrics: Pick<Metrics, 'lifeScore'> & {
    streak?: number;
    weeklyCompletion?: number;
    monthlyCompletion?: number;
    consistency?: number;
    momentum?: number;
  };
}

export function JourneyOverview({ execution, metrics }: JourneyOverviewProps): React.JSX.Element {
  const completionRate =
    execution.activePlans > 0
      ? Math.round(
          (execution.completedToday / (execution.activePlans + execution.completedToday)) * 100,
        )
      : 0;

  // Weekly activity is rendered honestly from the real weekly-completion total
  // exposed by the Life OS snapshot (days active of 5 target days) plus a real
  // streak — never invented per-day magnitudes. (SPRINT-047 data-honesty pass)

  return (
    <section>
      <h2 className="text-[20px] font-heading font-semibold text-[#111827] mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-[#2B5FD9]" />
        Journey Overview
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Day */}
        <Card variant="standard" padding="md">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#EFF4FE]">
              <Target className="h-5 w-5 text-[#2B5FD9]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">Today</p>
              <p className="text-[22px] font-bold text-[#111827]">{execution.completedToday}</p>
              <p className="text-[11px] text-[#94A3B8]">
                of ~{execution.activePlans + execution.completedToday} tasks
              </p>
              <Progress value={completionRate} size="sm" className="mt-2" />
            </div>
          </div>
        </Card>

        {/* Week */}
        <Card variant="standard" padding="md">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#F5F3FF]">
              <TrendingUp className="h-5 w-5 text-[#7C3AED]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">This Week</p>
              <p className="text-[22px] font-bold text-[#111827]">
                {metrics.weeklyCompletion ?? '--'}
              </p>
              <p className="text-[11px] text-[#94A3B8]">of 5 target days</p>
              <Progress
                value={metrics.weeklyCompletion ? (metrics.weeklyCompletion / 5) * 100 : 0}
                variant="ai"
                size="sm"
                className="mt-2"
              />
            </div>
          </div>
        </Card>

        {/* Month */}
        <Card variant="standard" padding="md">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#F0FDF4]">
              <CalendarDays className="h-5 w-5 text-[#22C55E]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">This Month</p>
              <p className="text-[22px] font-bold text-[#111827]">
                {metrics.monthlyCompletion ?? '--'}
              </p>
              <p className="text-[11px] text-[#94A3B8]">of 22 target days</p>
              <Progress
                value={metrics.monthlyCompletion ? (metrics.monthlyCompletion / 22) * 100 : 0}
                variant="success"
                size="sm"
                className="mt-2"
              />
            </div>
          </div>
        </Card>

        {/* Momentum */}
        <Card variant="standard" padding="md">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#FFFBEB]">
              <Zap className="h-5 w-5 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">Momentum</p>
              <p className="text-[22px] font-bold text-[#111827]">
                {metrics.momentum ?? metrics.consistency ?? '--'}
              </p>
              <p className="text-[11px] text-[#94A3B8]">
                {metrics.momentum && metrics.momentum >= 70
                  ? 'Strong'
                  : metrics.momentum && metrics.momentum >= 40
                    ? 'Building'
                    : 'Getting started'}
              </p>
              <Progress
                value={metrics.momentum ?? 0}
                variant="default"
                size="sm"
                className="mt-2"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Weekly Activity Summary — honest representation from real data */}
      <Card variant="standard" padding="md" className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-[#F59E0B]" />
          <p className="text-[14px] font-semibold text-[#111827]">Weekly Activity</p>
          <Badge variant="default" size="sm" className="ml-auto">
            This Week
          </Badge>
        </div>
        <div className="flex items-center gap-6 text-[13px] text-[#64748B]">
          {metrics.weeklyCompletion !== undefined && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#111827]">
                {metrics.weeklyCompletion ?? '--'} / 5 active days
              </span>
            </div>
          )}
          {metrics.streak !== undefined && metrics.streak > 0 && (
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[#F59E0B]" />
              <span className="font-medium text-[#111827]">{metrics.streak}-day streak</span>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
