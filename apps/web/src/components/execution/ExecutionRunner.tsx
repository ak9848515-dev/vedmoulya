// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Runner (EPIC-014, Phase 6)
// Integrates execution DIRECTLY into the plan experience. The user sees:
//   PLAN → step timeline → current step → provider/tool → progress → output
//   → approval / manual / configure hand-offs → final result.
// Only what matters is shown; verification details and budget live behind
// progressive disclosure. States are honest: manual/external/configure steps
// are never reported as executed — they become clear hand-offs with a
// WHAT / WHY / ACTION / AFTER explanation.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card } from '@vedmoulya/ui';
import {
  Play,
  Loader2,
  CheckCircle2,
  Circle,
  MinusCircle,
  XCircle,
  UserRound,
  Settings2,
  Lock,
  Ban,
  ArrowRight,
  Coins,
  Gauge,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import type { ExecutionHandoff, ExecutionRun, StepRun } from '@vedmoulya/execution-bridge';
import {
  useExecutionStart,
  useExecutionApprove,
  useExecutionReject,
  useExecutionCompleteHandoff,
  useExecutionCancel,
  useExecutionIntelligence,
} from '../../lib/api-client.js';

const TERMINAL_STATES = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'BLOCKED', 'CANCELLED']);

const RUN_STYLE: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  PARTIAL: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  RUNNING: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  WAITING_FOR_APPROVAL: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  MANUAL_REQUIRED: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  CONFIGURE_REQUIRED: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  FAILED: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  BLOCKED: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  CANCELLED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  READY: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function StepIcon({ step }: { step: StepRun }): React.JSX.Element {
  switch (step.state) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />;
    case 'blocked':
    case 'failed':
      return <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
    case 'waiting_approval':
      return <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    case 'configure_required':
      return <Settings2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
    case 'manual_required':
      return <UserRound className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
    case 'skipped':
      return <MinusCircle className="h-4 w-4 text-slate-400 dark:text-slate-500" />;
    default:
      return <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />;
  }
}

function StepLabel({ step }: { step: StepRun }): string {
  switch (step.state) {
    case 'completed':
      return 'Done';
    case 'running':
      return 'Running…';
    case 'waiting_approval':
      return 'Needs your approval';
    case 'configure_required':
      return 'Needs configuration';
    case 'manual_required':
      return 'Manual step';
    case 'blocked':
      return 'Blocked';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Not available — skipped';
    default:
      return 'Waiting';
  }
}

export function ExecutionRunner({
  userId,
  planId,
}: {
  userId: string;
  planId: string;
}): React.JSX.Element {
  const [run, setRun] = useState<ExecutionRun | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const start = useExecutionStart();
  const approve = useExecutionApprove();
  const reject = useExecutionReject();
  const completeHandoff = useExecutionCompleteHandoff();
  const cancel = useExecutionCancel();
  const intelligence = useExecutionIntelligence(userId, run?.executionId ?? '');

  function apply(result: unknown): void {
    const payload = result as { data?: ExecutionRun };
    if (payload.data) {
      setRun(payload.data);
      setActionError(null);
    }
  }

  async function handleStart(): Promise<void> {
    setActionError(null);
    try {
      apply(await start.mutateAsync({ userId, planId }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not start execution.');
    }
  }

  async function handleApprove(executionId: string, stepId: string): Promise<void> {
    try {
      // eslint-disable-next-line security/detect-object-injection -- React state keyed by step id (never user-controlled object access)
      apply(await approve.mutateAsync({ userId, executionId, stepId, note: notes[stepId] }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not approve.');
    }
  }

  async function handleReject(executionId: string, stepId: string): Promise<void> {
    try {
      // eslint-disable-next-line security/detect-object-injection -- React state keyed by step id (never user-controlled object access)
      apply(await reject.mutateAsync({ userId, executionId, stepId, note: notes[stepId] }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not reject.');
    }
  }

  async function handleHandoff(executionId: string, stepId: string): Promise<void> {
    try {
      const stepNote = notes[stepId]; // eslint-disable-line security/detect-object-injection -- React state keyed by step id (never user-controlled object access)
      apply(await completeHandoff.mutateAsync({ userId, executionId, stepId, note: stepNote }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not record the hand-off.');
    }
  }

  async function handleCancel(executionId: string): Promise<void> {
    try {
      apply(await cancel.mutateAsync({ userId, executionId }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not cancel.');
    }
  }

  if (!run) {
    return (
      <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Execute this plan
            </h3>
            <p className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8] max-w-xl">
              VedMoulya runs the steps that are ready and automatable through your configured
              providers. Everything else stops at an honest hand-off — nothing is faked, nothing
              runs without your approval.
            </p>
          </div>
          <button
            onClick={() => {
              void handleStart();
            }}
            disabled={start.isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {start.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Execute plan
          </button>
        </div>
        {actionError && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {actionError}
          </p>
        )}
      </Card>
    );
  }

  const completedCount = run.steps.filter((s) => s.state === 'completed').length;
  const progress = run.steps.length > 0 ? Math.round((completedCount / run.steps.length) * 100) : 0;
  const handoff = (stepId: string): ExecutionHandoff | undefined =>
    run.handoffs.find((h) => h.stepId === stepId);
  const canCancel = !TERMINAL_STATES.has(run.status);

  return (
    <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
      {/* ── Run header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Execution
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${RUN_STYLE[run.status] ?? ''}`}
            >
              {run.status.replaceAll('_', ' ')}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[#64748B] dark:text-[#94A3B8] truncate max-w-md">
            {run.goal}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCancel && (
            <button
              onClick={() => {
                void handleCancel(run.executionId);
              }}
              disabled={cancel.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-[12px] font-medium text-[#64748B] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#334155] transition-colors disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancel run
            </button>
          )}
        </div>
      </div>

      {/* ── Progress ───────────────────────────────────────────────────── */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-[#94A3B8] mb-1">
          <span>Steps completed</span>
          <span>
            {completedCount} / {run.steps.length} · {progress}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#E2E8F0] dark:bg-[#334155] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#2B5FD9] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Next action ────────────────────────────────────────────────── */}
      {intelligence.data?.nextAction && !TERMINAL_STATES.has(run.status) && (
        <div className="mt-4 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/30 border border-[#2B5FD9]/20 px-3 py-2.5 flex items-start gap-2">
          <ArrowRight className="h-4 w-4 text-[#2B5FD9] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[#1E3A8A] dark:text-[#BFDBFE]">
            <span className="font-semibold">Next:</span> {intelligence.data.nextAction}
          </p>
        </div>
      )}

      {/* ── Step timeline ──────────────────────────────────────────────── */}
      <ol className="mt-5 space-y-0">
        {run.steps.map((step, index) => {
          const h = handoff(step.stepId);
          const isLast = index === run.steps.length - 1;
          return (
            <li key={step.stepId} className="relative flex gap-3 pb-5">
              {!isLast && (
                <span className="absolute left-[9px] top-6 bottom-0 w-px bg-[#E2E8F0] dark:bg-[#334155]" />
              )}
              <span
                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                  step.state === 'completed'
                    ? 'bg-emerald-100 dark:bg-emerald-950'
                    : step.state === 'running'
                      ? 'bg-blue-100 dark:bg-blue-950'
                      : 'bg-[#F1F5F9] dark:bg-[#334155]'
                }`}
              >
                <StepIcon step={step} />
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    {step.title}
                    <span className="ml-2 text-[10px] font-medium text-[#94A3B8]">
                      {step.capability.replaceAll('_', ' ')}
                    </span>
                  </h4>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
                    <StepLabel step={step} />
                  </span>
                </div>

                {/* Provider / tool */}
                {(step.provider || step.model) && step.state !== 'skipped' && (
                  <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    <span className="font-medium">{step.provider}</span>
                    {step.model ? ` · ${step.model}` : ''}
                    {step.state === 'completed' && (step.tokensUsed > 0 || step.costUsd > 0) && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[#94A3B8]">
                        <Coins className="h-3 w-3" /> ${step.costUsd.toFixed(4)} ·{' '}
                        {step.tokensUsed.toLocaleString()} tokens
                      </span>
                    )}
                  </p>
                )}

                {/* Output for completed steps (progressive disclosure) */}
                {step.state === 'completed' && step.output && (
                  <details className="mt-1.5">
                    <summary className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] cursor-pointer hover:underline select-none">
                      <Gauge className="h-3 w-3" />
                      Output
                    </summary>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748B] dark:text-[#94A3B8] whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {step.output}
                    </p>
                  </details>
                )}

                {/* Verification summary */}
                {step.verification?.post && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                    Verified · {step.verification.post.checks.filter((c) => c.passed).length}/
                    {step.verification.post.checks.length} checks passed
                  </p>
                )}

                {/* Failure / block reason */}
                {(step.state === 'failed' || step.state === 'blocked') && step.failureReason && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    {step.failureReason}
                  </p>
                )}

                {/* Hand-off panel (approval / manual / configure) — shown ONLY while the step is actually at a gate (never on an executed step). */}
                {h &&
                  !h.completed &&
                  (step.state === 'waiting_approval' ||
                    step.state === 'manual_required' ||
                    step.state === 'configure_required') && (
                    <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3">
                      <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        {step.state === 'waiting_approval'
                          ? 'Needs your approval'
                          : h.kind === 'CONFIGURE'
                            ? 'Configuration required'
                            : h.kind === 'EXTERNAL'
                              ? 'External application required'
                              : 'Manual step'}
                      </p>
                      <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
                        {h.what}
                      </p>
                      <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-300/80">
                        {h.why}
                      </p>
                      <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
                        <span className="font-semibold">You:</span> {h.action}
                      </p>
                      <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-300/80">
                        <span className="font-semibold">After:</span> {h.after}
                      </p>

                      <div className="mt-2 flex flex-col sm:flex-row gap-2">
                        {h.kind === 'CONFIGURE' && h.deepLink && (
                          <a
                            href={h.deepLink}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B5FD9] text-white text-[11px] font-semibold hover:bg-[#1E4BB8] transition-colors"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            Configure provider
                          </a>
                        )}
                        {h.kind === 'MANUAL' && step.state === 'waiting_approval' ? (
                          <>
                            <button
                              onClick={() => {
                                void handleApprove(run.executionId, step.stepId);
                              }}
                              disabled={approve.isPending}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                void handleReject(run.executionId, step.stepId);
                              }}
                              disabled={reject.isPending}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-[11px] font-semibold hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors disabled:opacity-50"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              value={notes[step.stepId] ?? ''}
                              onChange={(e) => {
                                setNotes((prev) => ({ ...prev, [step.stepId]: e.target.value }));
                              }}
                              placeholder={
                                h.kind === 'CONFIGURE'
                                  ? 'Configured provider (optional)'
                                  : 'What did you do? (optional)'
                              }
                              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-white dark:bg-[#0F172A] text-[11px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40"
                            />
                            <button
                              onClick={() => {
                                void handleHandoff(run.executionId, step.stepId);
                              }}
                              disabled={completeHandoff.isPending}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B5FD9] text-white text-[11px] font-semibold hover:bg-[#1E4BB8] transition-colors disabled:opacity-50"
                            >
                              <Wrench className="h-3.5 w-3.5" />
                              Mark as done
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* ── Final state (honest) ───────────────────────────────────────── */}
      {TERMINAL_STATES.has(run.status) && (
        <div
          className={`mt-2 rounded-lg p-3 flex items-start gap-2 ${
            run.status === 'COMPLETED'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900'
              : run.status === 'FAILED' || run.status === 'BLOCKED'
                ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900'
                : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900'
          }`}
        >
          {run.status === 'COMPLETED' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : run.status === 'FAILED' || run.status === 'BLOCKED' ? (
            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <p className="text-[12px] leading-relaxed text-[#374151] dark:text-[#E2E8F0]">
            {run.status === 'COMPLETED' && 'Every step is done — the plan was executed end to end.'}
            {run.status === 'PARTIAL' &&
              'The run finished with steps that could not be automated — they were honestly skipped or completed by you.'}
            {run.status === 'FAILED' &&
              'The run failed. Check the step reason above — no step was silently retried forever or replaced.'}
            {run.status === 'BLOCKED' &&
              'The run was blocked (budget, dependency, approval or availability). Check the step reason above.'}
            {run.status === 'CANCELLED' && 'The run was cancelled by you.'}
          </p>
        </div>
      )}

      {/* ── Budget (progressive disclosure) ────────────────────────────── */}
      <details className="mt-3">
        <summary className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] cursor-pointer hover:underline select-none">
          <Coins className="h-3 w-3" />
          Run budget & usage
        </summary>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] px-2.5 py-2">
            <p className="text-[#94A3B8]">Cost</p>
            <p className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
              ${run.budget.spentCostUsd.toFixed(4)}
            </p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] px-2.5 py-2">
            <p className="text-[#94A3B8]">Tokens</p>
            <p className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
              {run.budget.spentTokens.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] px-2.5 py-2">
            <p className="text-[#94A3B8]">Calls</p>
            <p className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
              {run.budget.iterations}
            </p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] px-2.5 py-2">
            <p className="text-[#94A3B8]">Limit</p>
            <p
              className={`font-semibold ${run.budget.exceeded ? 'text-rose-600 dark:text-rose-400' : 'text-[#111827] dark:text-[#F8FAFC]'}`}
            >
              ${run.budget.maxCostUsd.toFixed(2)}
              {run.budget.exceeded ? ' · exceeded' : ''}
            </p>
          </div>
        </div>
        {run.budget.failureReason && (
          <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            {run.budget.failureReason}
          </p>
        )}
      </details>

      {actionError && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          {actionError}
        </p>
      )}

      {/* Restart affordance for finished runs */}
      {TERMINAL_STATES.has(run.status) && (
        <button
          onClick={() => {
            void handleStart();
          }}
          disabled={start.isPending}
          className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Run it again
        </button>
      )}
    </Card>
  );
}
