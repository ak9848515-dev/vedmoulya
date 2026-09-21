// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mission Detail: Overview Tab (UX-04)
//
// Human summary of the mission: objective, state, truthful progress, current
// step, and ONE primary action that maps to a real backend command. All values
// come from the production MissionStatusView — nothing is fabricated.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Button } from '@vedmoulya/ui';
import type { MissionStatusView } from '../../../lib/api-client.js';
import { ObjectiveTimeline } from '../../autonomous-builder/ObjectiveTimeline.js';
import { Target, Activity, ArrowRight } from 'lucide-react';

const STATE_LABELS: Record<string, { label: string; badge: string }> = {
  CREATED: {
    label: 'Draft',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  RUNNING: { label: 'Running', badge: 'bg-[#2B5FD9]/10 text-[#2B5FD9]' },
  PAUSED: {
    label: 'Paused',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  WAITING_FOR_APPROVAL: {
    label: 'Awaiting Approval',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  WAITING_FOR_PROVIDER: {
    label: 'Waiting for Provider',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  BLOCKED: {
    label: 'Blocked',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  },
  COMPLETED: {
    label: 'Completed',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  FAILED: {
    label: 'Failed',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  },
  CANCELLED: {
    label: 'Cancelled',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

interface MissionOverviewProps {
  status: MissionStatusView;
  onStart: () => Promise<void>;
  onResume: () => Promise<void>;
  onApprove: () => Promise<void>;
  loopPending: boolean;
  isTerminal: boolean;
}

export function MissionOverview({
  status,
  onStart,
  onResume,
  onApprove,
  loopPending,
  isTerminal,
}: MissionOverviewProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const stateMeta = STATE_LABELS[status.state] ?? {
    label: status.state,
    badge: 'bg-slate-100 text-slate-700',
  };
  const isRunning = status.state === 'RUNNING' || loopPending;
  const verifiedCount = status.objectives.filter((o) => o.state === 'VERIFIED').length;
  const progressText =
    status.objectives.length > 0
      ? `${verifiedCount}/${status.objectives.length} objectives verified`
      : 'No objectives yet';

  const actionLabel = isRunning
    ? 'VedMoulya is working'
    : status.state === 'CREATED'
      ? 'Start Mission'
      : status.state === 'WAITING_FOR_APPROVAL'
        ? 'Review & Approve'
        : isTerminal
          ? 'View Result'
          : 'Continue';

  const handleAction = (): void => {
    void (async (): Promise<void> => {
      if (busy) return;
      setBusy(true);
      try {
        if (status.state === 'CREATED') await onStart();
        else if (status.state === 'WAITING_FOR_APPROVAL') await onApprove();
        else if (!isTerminal) await onResume();
      } finally {
        setBusy(false);
      }
    })();
  };

  const actionDisabled =
    busy ||
    isRunning ||
    isTerminal ||
    !['CREATED', 'PAUSED', 'BLOCKED', 'WAITING_FOR_PROVIDER', 'WAITING_FOR_APPROVAL'].includes(
      status.state,
    );

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${stateMeta.badge}`}
                data-testid="mission-state"
              >
                {stateMeta.label}
              </span>
              {isTerminal && status.outcome ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    status.state === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                  }`}
                  data-testid="mission-outcome"
                >
                  {status.outcome}
                </span>
              ) : null}
            </div>
            <h1 className="font-heading text-[24px] font-bold leading-tight text-[#111827] dark:text-[#F8FAFC]">
              {status.title}
            </h1>
            <p className="mt-1 max-w-2xl text-[14px] text-[#64748B] dark:text-[#94A3B8]">
              {status.objective}
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="shrink-0 bg-[#2B5FD9] text-white hover:bg-[#2450C4]"
            disabled={actionDisabled}
            onClick={handleAction}
            data-testid="primary-action"
          >
            {isRunning ? (
              <>
                <Activity className="mr-2 h-4 w-4" />
                VedMoulya is working
              </>
            ) : (
              <>
                {actionLabel}
                <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <InfoCard
          label="Objective"
          value={status.objective.slice(0, 80) + (status.objective.length > 80 ? '…' : '')}
        />
        <InfoCard label="Created" value={new Date(status.createdAt).toLocaleDateString()} />
        <InfoCard label="Progress" value={progressText} testId="overview-progress" />
        <InfoCard
          label="Current Step"
          value={
            status.currentObjective?.title ??
            (status.objectives.length > 0 ? 'Selecting next objective…' : 'No objectives yet')
          }
          testId="overview-current-step"
        />
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          <Target className="h-4 w-4 text-[#2B5FD9]" />
          Objective Timeline
        </h2>
        <ObjectiveTimeline objectives={status.objectives} />
      </div>

      {status.state === 'WAITING_FOR_APPROVAL' ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
          data-testid="approval-panel"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Your approval is needed
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            VedMoulya has reached a point that requires your approval to continue. Use the
            approve/reject controls below.
          </p>
          {status.outcomeReason ? (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              Reason: {status.outcomeReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {status.state === 'WAITING_FOR_PROVIDER' ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
          data-testid="provider-wait-note"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Waiting for an AI provider
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            No eligible provider is currently available. The mission checkpoint has been saved and
            will resume when a provider becomes available.
          </p>
          {status.outcomeReason ? (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              Reason: {status.outcomeReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {status.state === 'BLOCKED' ? (
        <div
          className="rounded-lg border border-rose-300 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/40"
          data-testid="blocked-panel"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-300">
            Mission is blocked
          </h3>
          <p className="mt-1 text-sm text-rose-700 dark:text-rose-400">
            This mission cannot continue automatically. Review the situation and decide how to
            proceed.
          </p>
          {status.outcomeReason ? (
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
              Reason: {status.outcomeReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {status.state === 'RUNNING' && !loopPending ? (
        <div
          className="rounded-lg border border-[#2B5FD9]/30 bg-[#2B5FD9]/5 p-4"
          data-testid="running-note"
        >
          <p className="text-[13px] text-[#2B5FD9]">
            VedMoulya is actively working on this mission. You can leave this page and return — the
            mission continues autonomously.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function InfoCard({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="mb-1 flex items-center gap-2 text-[#64748B] dark:text-slate-400">
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p
        className="text-[13px] leading-snug text-[#111827] dark:text-[#F8FAFC]"
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}
