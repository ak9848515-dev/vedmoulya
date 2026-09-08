// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Builder: Live Mission View (BLD-024)
//
// Displays the ACTUAL backend mission state. Rules enforced here:
//   - Backend state is authoritative; nothing is inferred from timers.
//   - Values that don't exist are shown as "Unavailable" — never fabricated.
//   - No progress percentages (the runtime exposes no such metric to the UI).
//   - Approval/provider-wait panels appear only in their real states.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Button } from '@vedmoulya/ui';
import type { MissionStatusView } from '../../lib/api-client.js';
import { ObjectiveTimeline } from './ObjectiveTimeline.js';
import { ActivityLog } from './ActivityLog.js';

export interface LiveMissionViewProps {
  status: MissionStatusView;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  /** Driven by an autonomous-loop mutation still in flight. */
  loopPending: boolean;
}

const TERMINAL_STATES = ['COMPLETED', 'FAILED', 'CANCELLED'];

function unavailable(value: string | number | undefined | null, suffix = ''): string {
  if (value === undefined || value === null || value === '' || Number.isNaN(value)) {
    return 'Unavailable';
  }
  return `${value}${suffix}`;
}

export function LiveMissionView({
  status,
  onPause,
  onResume,
  onCancel,
  onApprove,
  onReject,
  loopPending,
}: LiveMissionViewProps): React.JSX.Element {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const isTerminal = TERMINAL_STATES.includes(status.state);
  const canResume =
    ['PAUSED', 'BLOCKED', 'WAITING_FOR_PROVIDER', 'WAITING_FOR_APPROVAL'].includes(status.state) &&
    !loopPending;

  const wrap = (action: () => Promise<void>) => (): void => {
    void (async (): Promise<void> => {
      setBusy(true);
      try {
        await action();
      } finally {
        setBusy(false);
      }
    })();
  };

  const stateTone = isTerminal
    ? status.state === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
    : status.state === 'RUNNING'
      ? 'bg-[#2B5FD9]/10 text-[#2B5FD9]'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';

  return (
    <section className="space-y-6" data-testid="live-mission-view">
      {/* ── Header: state + identity ─────────────────────────────────── */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${stateTone}`}
            data-testid="mission-state"
          >
            {status.state}
          </span>
          {status.loopRunning || loopPending ? (
            <span className="text-xs text-slate-500 dark:text-slate-400" data-testid="loop-running">
              Autonomous loop executing — you can leave this page and return.
            </span>
          ) : null}
          <h2 className="ml-auto text-lg font-semibold">{status.title}</h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{status.objective}</p>
        {status.outcome ? (
          <p className="text-sm" data-testid="mission-outcome">
            Outcome: <span className="font-semibold">{status.outcome}</span>
            {status.outcomeReason ? ` — ${status.outcomeReason}` : ''}
          </p>
        ) : null}
        {/* Operator-hold reasons (approval/provider waits) are the runtime's
            own recorded reason — shown verbatim, never fabricated. */}
        {!status.outcome && status.outcomeReason ? (
          <p className="text-sm" data-testid="mission-reason">
            Reason: <span className="font-medium">{status.outcomeReason}</span>
          </p>
        ) : null}
      </header>

      {/* ── Facts grid: only real values; missing values say "Unavailable" ── */}
      <dl
        className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700 md:grid-cols-3"
        data-testid="mission-facts"
      >
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Provider
          </dt>
          <dd data-testid="fact-provider">{unavailable(status.provider)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Model
          </dt>
          <dd data-testid="fact-model">{unavailable(status.model)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Current objective
          </dt>
          <dd data-testid="fact-current-objective">
            {status.currentObjective?.title ?? (isTerminal ? 'None' : 'Unavailable')}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Objectives verified
          </dt>
          <dd data-testid="fact-verified">{status.budgetUsage.objectivesCompleted}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Tool calls
          </dt>
          <dd data-testid="fact-tool-calls">{status.budgetUsage.toolCallsExecuted}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Retries
          </dt>
          <dd data-testid="fact-retries">
            {unavailable(typeof status.attempts === 'number' ? status.attempts : undefined)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Tokens
          </dt>
          <dd data-testid="fact-tokens">{status.budgetUsage.tokensConsumed}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Cost
          </dt>
          <dd data-testid="fact-cost">${status.budgetUsage.costUsdConsumed.toFixed(4)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Last checkpoint
          </dt>
          <dd data-testid="fact-last-checkpoint">
            {status.checkpoints.length > 0
              ? new Date(
                  status.checkpoints[status.checkpoints.length - 1]?.timestamp ?? '',
                ).toLocaleString()
              : 'Unavailable'}
          </dd>
        </div>
      </dl>

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2" data-testid="mission-controls">
        {status.state === 'RUNNING' ? (
          <Button
            variant="secondary"
            onClick={wrap(onPause)}
            disabled={busy || loopPending}
            data-testid="pause-btn"
          >
            PAUSE
          </Button>
        ) : null}
        {canResume ? (
          <Button onClick={wrap(onResume)} disabled={busy || loopPending} data-testid="resume-btn">
            RESUME
          </Button>
        ) : null}
        {!isTerminal ? (
          confirmCancel ? (
            <span className="flex items-center gap-2">
              <span className="text-sm">Cancel this autonomous mission?</span>
              <Button
                variant="danger"
                onClick={wrap(onCancel)}
                disabled={busy}
                data-testid="cancel-confirm-btn"
              >
                Yes, cancel
              </Button>
              <Button
                variant="ghost"
                onClick={(): void => {
                  setConfirmCancel(false);
                }}
                disabled={busy}
                data-testid="cancel-abort-btn"
              >
                Keep running
              </Button>
            </span>
          ) : (
            <Button
              variant="secondary"
              onClick={(): void => {
                setConfirmCancel(true);
              }}
              disabled={busy}
              data-testid="cancel-btn"
            >
              CANCEL
            </Button>
          )
        ) : null}
      </div>

      {/* ── Approval panel (WAITING_FOR_APPROVAL only) ────────────────── */}
      {status.state === 'WAITING_FOR_APPROVAL' ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
          data-testid="approval-panel"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Approval required
          </h3>
          <p className="mt-1 text-sm" data-testid="approval-operation">
            Operation: {status.currentObjective?.title ?? 'Unavailable'}
          </p>
          <p className="text-sm" data-testid="approval-reason">
            {/* The runtime's recorded approval reason (mission outcomeReason)
                is authoritative when present; the objective reason is the
                fallback. The UI never invents a reason. */}
            Reason: {status.outcomeReason ?? status.currentObjective?.reason ?? 'Unavailable'}
          </p>
          <p className="text-sm" data-testid="approval-risk">
            Risk:{' '}
            {status.currentObjective?.failureReason ??
              'Governance requires explicit operator approval for this operation.'}
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={wrap(onApprove)} disabled={busy} data-testid="approve-btn">
              APPROVE
            </Button>
            <Button
              variant="danger"
              onClick={wrap(onReject)}
              disabled={busy}
              data-testid="reject-btn"
            >
              REJECT
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Provider-wait panel (WAITING_FOR_PROVIDER only) ───────────── */}
      {status.state === 'WAITING_FOR_PROVIDER' ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
          data-testid="provider-wait-panel"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Waiting for provider
          </h3>
          <p className="mt-1 text-sm">No eligible provider is currently available.</p>
          {status.outcomeReason ? (
            <p className="text-sm" data-testid="provider-wait-reason">
              Reason: {status.outcomeReason}
            </p>
          ) : null}
          <p className="text-sm">The mission checkpoint has been saved.</p>
          <p className="text-sm">The mission can resume when a provider becomes available.</p>
        </div>
      ) : null}

      {/* ── Objective timeline ───────────────────────────────────────── */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Objective timeline
        </h3>
        <ObjectiveTimeline objectives={status.objectives} />
      </div>

      {/* ── Verification evidence (only when it actually exists) ─────── */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Last verification
        </h3>
        {status.objectives.some((o) => o.evidence.length > 0) ? (
          <ul className="space-y-1" data-testid="verification-evidence">
            {[...status.objectives]
              .reverse()
              .find((o) => o.evidence.length > 0)
              ?.evidence.slice(0, 5)
              .map((item) => (
                <li key={item} className="font-mono text-xs text-slate-600 dark:text-slate-300">
                  {item}
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Unavailable</p>
        )}
      </div>

      {/* ── Activity log ─────────────────────────────────────────────── */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Activity
        </h3>
        <ActivityLog events={status.activity} />
      </div>
    </section>
  );
}
