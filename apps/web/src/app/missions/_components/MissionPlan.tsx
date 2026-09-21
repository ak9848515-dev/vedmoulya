'use client';

import React from 'react';
import type { MissionStatusView } from '../../../lib/api-client.js';
import { GitBranch, Target, CheckCircle2, Circle, AlertTriangle, ArrowRight } from 'lucide-react';

interface MissionPlanProps {
  status: MissionStatusView;
}

export function MissionPlan({ status }: MissionPlanProps): React.JSX.Element {
  const objectives = status.objectives;

  if (objectives.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[#64748B]">
          <GitBranch className="h-4 w-4" />
          <h2 className="text-[15px] font-semibold text-[#111827]">Plan</h2>
        </div>
        <div className="rounded-lg border border-slate-200 p-6 text-center">
          <p className="text-[13px] text-[#64748B]">
            The mission plan will appear here once objectives are selected.
          </p>
        </div>
      </div>
    );
  }

  const completed = objectives.filter((o) => o.state === 'VERIFIED');
  const current = objectives.find((o) => o.state === 'RUNNING' || o.state === 'READY');
  const upcoming = objectives.filter((o) => o.state === 'PENDING' || o.state === 'SKIPPED');
  const blocked = objectives.filter((o) => o.state === 'BLOCKED' || o.state === 'FAILED');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[#64748B]">
        <GitBranch className="h-4 w-4" />
        <h2 className="text-[15px] font-semibold text-[#111827]">Plan</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
        <span className="inline-flex items-center gap-1">
          <Target className="h-3 w-3" />
          Understand
        </span>
        <ArrowRight className="h-3 w-3" />
        <span className="inline-flex items-center gap-1">
          <GitBranch className="h-3 w-3" />
          Plan
        </span>
        <ArrowRight className="h-3 w-3" />
        <span className="inline-flex items-center gap-1">
          <PlayIcon className="h-3 w-3" />
          Execute
        </span>
        <ArrowRight className="h-3 w-3" />
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Verify
        </span>
        <ArrowRight className="h-3 w-3" />
        <span className="inline-flex items-center gap-1">
          <FlagIcon className="h-3 w-3" />
          Complete
        </span>
      </div>

      <div className="space-y-4">
        {completed.length > 0 && (
          <PlanStage
            title="Completed"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            items={completed.map((o) => ({ id: o.objectiveId, title: o.title, state: o.state }))}
            tone="good"
          />
        )}
        {current && (
          <PlanStage
            title="Current"
            icon={<PlayIcon className="h-4 w-4 text-[#2B5FD9]" />}
            items={[{ id: current.objectiveId, title: current.title, state: current.state }]}
            tone="info"
            isCurrent
          />
        )}
        {upcoming.length > 0 && (
          <PlanStage
            title="Upcoming"
            icon={<Circle className="h-4 w-4 text-slate-400" />}
            items={upcoming.map((o) => ({ id: o.objectiveId, title: o.title, state: o.state }))}
            tone="neutral"
          />
        )}
        {blocked.length > 0 && (
          <PlanStage
            title="Blocked"
            icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
            items={blocked.map((o) => ({
              id: o.objectiveId,
              title: o.title,
              state: o.state,
              reason: o.failureReason,
            }))}
            tone="bad"
          />
        )}
      </div>
    </div>
  );
}

type PlanTone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

const TONE_BORDERS = new Map<PlanTone, string>([
  ['good', 'border-emerald-200'],
  ['warn', 'border-amber-200'],
  ['bad', 'border-rose-200'],
  ['info', 'border-[#2B5FD9]/50'],
  ['neutral', 'border-slate-200'],
]);

const TONE_BACKGROUNDS = new Map<PlanTone, string>([
  ['good', 'bg-emerald-50'],
  ['warn', 'bg-amber-50'],
  ['bad', 'bg-rose-50'],
  ['info', 'bg-[#2B5FD9]/5'],
  ['neutral', 'bg-slate-50'],
]);

function PlanStage({
  title,
  icon,
  items,
  tone,
  isCurrent,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ id: string; title: string; state: string; reason?: string }>;
  tone: PlanTone;
  isCurrent?: boolean;
}): React.JSX.Element {
  const borderColor = TONE_BORDERS.get(tone) ?? 'border-slate-200';
  const bgColor = TONE_BACKGROUNDS.get(tone) ?? 'bg-slate-50';

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-[13px] font-semibold uppercase tracking-wide">
          {title}
          {isCurrent ? (
            <span className="ml-2 text-[10px] font-normal text-[#64748B]">(in progress)</span>
          ) : (
            ''
          )}
        </h3>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-[13px]">
            {item.state === 'VERIFIED' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-[#111827]">{item.title}</p>
              {item.reason && <p className="text-[11px] text-rose-600 mt-0.5">{item.reason}</p>}
              <p className="text-[10px] text-[#64748B] uppercase tracking-wide">{item.state}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlayIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function FlagIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}
