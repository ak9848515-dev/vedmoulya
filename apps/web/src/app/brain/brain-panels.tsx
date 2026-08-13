// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — VedMoulya Brain: presentational panels
// EPIC-016 — The VedMoulya Brain (central intelligence & orchestration)
// Pure presentational components rendered by /brain/page.tsx with live
// BrainTask data. Every panel is honest: UNKNOWN stays UNKNOWN, nothing is
// fabricated, and sensitive approvals always require an explicit user click.
// Exported individually so component tests can render them with fixtures.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

/* eslint-disable security/detect-object-injection -- Record lookups below use
   closed-union keys (BrainStageStatus, BrainTaskStatus) and colour lookups
   derived from typed scores — never attacker-controlled input; the rule is a
   false positive on these presentational maps (same convention as
   packages/ui/src/components/display/Display.tsx). */
import React from 'react';
import { Card, Badge } from '@vedmoulya/ui';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  ShieldAlert,
  UserRound,
  Cpu,
  Sparkles,
  Coins,
  Clock,
  Lock,
  AlertTriangle,
  ListChecks,
  GitBranch,
  ScrollText,
  Eye,
  Ban,
} from 'lucide-react';
import type {
  BrainTask,
  BrainStage,
  BrainStageStatus,
  BrainDecisionRecord,
  BrainSynthesis,
  BrainVerification,
} from '@vedmoulya/brain';
import {
  PIPELINE_STAGES,
  STAGE_STATUS_COLORS,
  TASK_STATUS_COLORS,
  QUALITY_LABELS,
  SENSITIVE_ACTION_LABELS,
  formatStageStatus,
  formatMode,
  formatRole,
  formatStage,
  confidenceBarColor,
  confidenceBadge,
  formatDateTime,
  formatUsd,
} from './brain-ui.js';

// ── Pipeline stage rail ──────────────────────────────────────────────────────

export function BrainStageRail(props: {
  stageStatuses: Record<BrainStage, BrainStageStatus>;
  stage: BrainStage;
}): React.JSX.Element {
  const { stageStatuses, stage } = props;
  const isTerminal = stage === 'CANCELLED' || stage === 'FAILED';

  if (isTerminal) {
    return (
      <div
        className={`rounded-xl border p-3 text-[12px] font-semibold ${
          stage === 'FAILED'
            ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        {stage === 'FAILED' ? 'Task failed' : 'Task cancelled'}
      </div>
    );
  }

  return (
    <ol className="flex items-start gap-1 overflow-x-auto pb-1" aria-label="Brain pipeline stages">
      {PIPELINE_STAGES.map((s) => {
        const status = stageStatuses[s];
        const isCurrent = s === stage;
        const active = status === 'running';
        return (
          <li key={s} className="flex flex-col items-center gap-1.5 min-w-[76px] px-1">
            <div className="flex items-center gap-1 w-full">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
                  status === 'completed'
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-[#2B5FD9] text-white'
                      : isCurrent
                        ? 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF] ring-2 ring-[#2B5FD9]/30'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}
              >
                {status === 'completed' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="text-[10px] font-bold">{s === 'RESULT' ? '✓' : ''}</span>
                )}
              </div>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>
            <span
              className={`text-[10px] font-semibold whitespace-nowrap ${
                isCurrent ? 'text-[#111827] dark:text-[#F8FAFC]' : 'text-[#94A3B8]'
              }`}
            >
              {formatStage(s)}
            </span>
            <span
              className={`px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide ${statusColor(status)}`}
            >
              {formatStageStatus(status)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function statusColor(status: BrainStageStatus): string {
  return (
    STAGE_STATUS_COLORS[status] ??
    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
  );
}

// ── Task meta strip ──────────────────────────────────────────────────────────

export function BrainTaskMeta(props: { task: BrainTask }): React.JSX.Element {
  const { task } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${TASK_STATUS_COLORS[task.status] ?? ''}`}
      >
        {task.status.replaceAll('_', ' ')}
      </span>
      <Badge variant="info" size="sm">
        {formatMode(task.mode)} mode
      </Badge>
      <Badge variant="draft" size="sm">
        Quality: {QUALITY_LABELS[task.qualityTarget] ?? task.qualityTarget}
      </Badge>
      <Badge variant="draft" size="sm">
        <Lock className="h-3 w-3 mr-0.5" />
        {task.privacyRequirement === 'PRIVATE' ? 'Private' : 'Standard'}
      </Badge>
      <span className="text-[11px] text-[#94A3B8]">
        {task.roleAssignments.length} provider role{task.roleAssignments.length === 1 ? '' : 's'}
        {task.providerOutputs.length > 0
          ? ` · ${task.providerOutputs.length} output${task.providerOutputs.length === 1 ? '' : 's'}`
          : ''}
      </span>
    </div>
  );
}

// ── Intent / understanding panel ─────────────────────────────────────────────

export function BrainIntentPanel(props: { task: BrainTask }): React.JSX.Element {
  const { task } = props;
  const intent = task.intent;
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center gap-1.5">
        <UserRound className="h-4 w-4 text-[#2B5FD9]" />
        <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Understanding
        </h3>
      </div>
      <p className="mt-2 text-[13px] text-[#374151] dark:text-[#E2E8F0]">{intent.objective}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="px-2 py-0.5 rounded-full bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[10px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF]">
          Domain: {intent.domain}
        </span>
        {intent.constraints.map((c) => (
          <span
            key={c}
            className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300"
          >
            {c}
          </span>
        ))}
        {intent.authorizedActions.map((a) => (
          <span
            key={a}
            className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
          >
            authorized: {a}
          </span>
        ))}
      </div>
      {intent.ambiguities.length > 0 && (
        <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-2">
          <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
            Ambiguities
          </p>
          <ul className="mt-1 space-y-0.5">
            {intent.ambiguities.map((a) => (
              <li key={a} className="text-[11px] text-amber-800 dark:text-amber-300">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
      {intent.assumptions.length > 0 && (
        <details className="mt-2">
          <summary className="text-[10px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] cursor-pointer hover:underline select-none">
            Bounded assumptions ({intent.assumptions.length})
          </summary>
          <ul className="mt-1.5 space-y-1">
            {intent.assumptions.map((a, i) => (
              <li key={`assume-${i}`} className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">
                  {a.assumption}
                </span>{' '}
                — {a.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

// ── Provider / capability assignments ────────────────────────────────────────

export function BrainProviderAssignments(props: { task: BrainTask }): React.JSX.Element {
  const { task } = props;
  if (task.roleAssignments.length === 0) {
    return (
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-4 w-4 text-[#7C3AED]" />
          <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Providers & roles
          </h3>
        </div>
        <p className="mt-2 text-[12px] text-[#94A3B8] flex items-center gap-1.5">
          <MinusCircle className="h-3.5 w-3.5" />
          No role assignments yet — run the pipeline to select providers for each capability.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-4 w-4 text-[#7C3AED]" />
          <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Providers & roles
          </h3>
        </div>
        <Badge variant="info" size="sm">
          {task.roleAssignments.length}-provider
        </Badge>
      </div>

      <div className="mt-3 space-y-2.5">
        {task.roleAssignments.map((assignment) => (
          <div
            key={`${assignment.providerId}-${assignment.capability}`}
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  {assignment.providerName}
                </p>
                <p className="text-[10px] text-[#94A3B8]">
                  {formatRole(assignment.role)} · {assignment.capability}
                  {assignment.modelId ? ` · ${assignment.modelId}` : ''}
                </p>
              </div>
              {assignment.quality !== undefined && (
                <div className="text-right">
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: confidenceBarColor(assignment.quality) }}
                  >
                    {Math.round(assignment.quality * 100)}
                  </span>
                  <div className="mt-0.5 w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(assignment.quality * 100)}%`,
                        background: confidenceBarColor(assignment.quality),
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              {assignment.reason}
            </p>
            {assignment.evidence.length > 0 && (
              <details className="mt-1.5">
                <summary className="text-[10px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] cursor-pointer hover:underline select-none">
                  Evidence ({assignment.evidence.length})
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {assignment.evidence.map((e, i) => (
                    <li key={`ev-${i}`} className="text-[10px] text-[#94A3B8]">
                      • {e}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      {/* Execution graph waves */}
      {task.graph.waves.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide flex items-center gap-1">
            <GitBranch className="h-3 w-3" /> Execution graph
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {task.graph.waves.map((wave, i) => (
              <React.Fragment key={`wave-${i}`}>
                {i > 0 && <ArrowGap />}
                <span className="px-2 py-0.5 rounded-md bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[10px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF]">
                  {wave.length} parallel node{wave.length === 1 ? '' : 's'}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ArrowGap(): React.JSX.Element {
  return <span className="text-[#94A3B8] text-[10px]">→</span>;
}

// ── Budget panel ─────────────────────────────────────────────────────────────

export function BrainBudgetPanel(props: { task: BrainTask }): React.JSX.Element {
  const { task } = props;
  const b = task.budget;
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Budget</h3>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <span className="text-[#64748B] dark:text-[#94A3B8]">Tokens</span>
        <span className="text-right font-medium text-[#374151] dark:text-[#E2E8F0]">
          {b.maxTokens.toLocaleString()}
        </span>
        <span className="text-[#64748B] dark:text-[#94A3B8]">Max cost</span>
        <span className="text-right font-medium text-[#374151] dark:text-[#E2E8F0]">
          {formatUsd(b.maxCostUsd)}
        </span>
        <span className="text-[#64748B] dark:text-[#94A3B8]">Max iterations</span>
        <span className="text-right font-medium text-[#374151] dark:text-[#E2E8F0]">
          {b.maxIterations}
        </span>
        <span className="text-[#64748B] dark:text-[#94A3B8]">Estimated cost</span>
        <span className="text-right font-medium text-[#374151] dark:text-[#E2E8F0]">
          {b.estimatedCostUsd !== undefined ? (
            formatUsd(b.estimatedCostUsd)
          ) : (
            <span className="text-[#94A3B8]">UNKNOWN</span>
          )}
        </span>
      </div>
    </Card>
  );
}

// ── Approval panel ───────────────────────────────────────────────────────────

export function BrainApprovalPanel(props: {
  task: BrainTask;
  onApprove: (action: string) => void;
  onReject: (action: string) => void;
  onRequest: (action: string) => void;
  busy: boolean;
}): React.JSX.Element {
  const { task, onApprove, onReject, onRequest, busy } = props;

  if (task.approvalRequired.length === 0) {
    return (
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4 text-emerald-500" />
          <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Approval</h3>
        </div>
        <div className="mt-2.5 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 p-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[12px] font-medium text-emerald-800 dark:text-emerald-300">
            No sensitive actions pending — no approval required.
          </p>
        </div>
        <RequestApprovalDetails onRequest={onRequest} busy={busy} />
      </Card>
    );
  }

  const approvable = task.approvalRequired.filter((a) => SENSITIVE_ACTION_LABELS[a] !== undefined);
  const informational = task.approvalRequired.filter(
    (a) => SENSITIVE_ACTION_LABELS[a] === undefined,
  );

  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center gap-1.5">
        <ShieldAlert className="h-4 w-4 text-amber-500" />
        <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Approval required
        </h3>
        {task.status === 'AWAITING_APPROVAL' && (
          <Badge variant="warning" size="sm">
            paused
          </Badge>
        )}
      </div>

      {informational.map((item) => (
        <div
          key={item}
          className="mt-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-2.5 flex items-start gap-2"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
              {item.replaceAll('_', ' ')}
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
              A required capability has no eligible provider — the Brain never fakes execution.
              Configure a provider in the Provider Registry, then retry.
            </p>
          </div>
        </div>
      ))}

      {approvable.length === 0 && <RequestApprovalDetails onRequest={onRequest} busy={busy} />}

      {approvable.map((action) => (
        <div
          key={action}
          className="mt-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3"
        >
          <p className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            {SENSITIVE_ACTION_LABELS[action] ?? action}
          </p>
          <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            This action is irreversible or sensitive — the Brain pauses for your explicit decision.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => {
                onApprove(action);
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Approve
            </button>
            <button
              onClick={() => {
                onReject(action);
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Ban className="h-3 w-3" />
              Reject
            </button>
            <span className="text-[10px] text-[#94A3B8]">
              Rejecting continues with the best available alternative.
            </span>
          </div>
        </div>
      ))}
    </Card>
  );
}

function RequestApprovalDetails(props: {
  onRequest: (action: string) => void;
  busy: boolean;
}): React.JSX.Element {
  const { onRequest, busy } = props;
  return (
    <details className="mt-2.5">
      <summary className="text-[10px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] cursor-pointer hover:underline select-none">
        Request approval for a sensitive action (publish, send, deploy…)
      </summary>
      <p className="mt-1.5 text-[11px] text-[#94A3B8]">
        The Brain never takes an irreversible action without your explicit approval. If this task
        will publish, send, deploy, purchase or install something, request approval first.
      </p>
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {Object.entries(SENSITIVE_ACTION_LABELS).map(([action, label]) => (
          <button
            key={action}
            onClick={() => {
              onRequest(action);
            }}
            disabled={busy}
            className="px-2 py-1 rounded-full bg-[#F1F5F9] dark:bg-[#334155] text-[10px] font-medium text-[#64748B] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#475569] transition-colors disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}

// ── Verification panel ───────────────────────────────────────────────────────

export function BrainVerificationPanel(props: {
  verification: BrainVerification;
}): React.JSX.Element {
  const { verification } = props;
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ListChecks className="h-4 w-4 text-[#06B6D4]" />
          <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Verification
          </h3>
        </div>
        <Badge variant={verification.passed ? 'success' : 'warning'} size="sm">
          {verification.passed ? 'passed' : 'gaps found'}
        </Badge>
      </div>
      <ul className="mt-3 space-y-2">
        {verification.checks.map((check) => (
          <li key={check.name} className="flex items-start gap-2">
            {check.passed ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            )}
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                {check.name}
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{check.detail}</p>
              {check.evidence.length > 0 && (
                <p className="text-[10px] text-[#94A3B8]">{check.evidence.join(' · ')}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Synthesis / result panel ─────────────────────────────────────────────────

export function BrainSynthesisPanel(props: { synthesis: BrainSynthesis }): React.JSX.Element {
  const { synthesis } = props;
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-[#7C3AED]" />
        <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Synthesized result
        </h3>
        <Badge variant="info" size="sm">
          {synthesis.providerCount} provider{synthesis.providerCount === 1 ? '' : 's'}
        </Badge>
      </div>
      {synthesis.summary && (
        <p className="mt-2.5 text-[12px] text-[#374151] dark:text-[#E2E8F0] leading-relaxed">
          {synthesis.summary}
        </p>
      )}
      {synthesis.claims.length > 0 && (
        <div className="mt-3 space-y-2">
          {synthesis.claims.map((claim, i) => (
            <div
              key={`claim-${i}`}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] text-[#374151] dark:text-[#E2E8F0]">{claim.claim}</p>
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${confidenceBadge(claim.confidence)}`}
                >
                  {Math.round(claim.confidence * 100)}%
                </span>
              </div>
              <p className="mt-1 text-[10px] text-[#94A3B8]">
                Providers: {claim.providers.join(', ') || '—'} · Conflict:{' '}
                {claim.conflictStatus.replaceAll('_', ' ')}
              </p>
              {claim.evidence.length > 0 && (
                <p className="mt-0.5 text-[10px] text-[#94A3B8]">
                  Evidence: {claim.evidence.join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {synthesis.unresolvedConflicts.length > 0 && (
        <div className="mt-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2.5">
          <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wide">
            Unresolved conflicts
          </p>
          {synthesis.unresolvedConflicts.map((c) => (
            <p key={c.topic} className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">
              {c.topic} — {c.disagreement}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Provider outputs ─────────────────────────────────────────────────────────

export function BrainOutputsPanel(props: { task: BrainTask }): React.JSX.Element {
  const { task } = props;
  if (task.providerOutputs.length === 0) {
    return (
      <p className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5" />
        No provider outputs recorded yet.
      </p>
    );
  }
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
        Provider outputs
      </h3>
      <div className="mt-2 space-y-2">
        {task.providerOutputs.map((output, i) => (
          <div
            key={`out-${i}`}
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
                {output.providerId}{' '}
                <span className="font-normal text-[#94A3B8]">
                  · {formatRole(output.role)} · {output.capability}
                </span>
              </p>
              {output.quality !== undefined && (
                <span
                  className="text-[10px] font-bold"
                  style={{ color: confidenceBarColor(output.quality) }}
                >
                  {Math.round(output.quality * 100)}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] line-clamp-3 whitespace-pre-wrap">
              {output.output || <span className="italic">(no output — recorded honestly)</span>}
            </p>
            {output.evidence.length > 0 && (
              <p className="mt-1 text-[10px] text-[#94A3B8]">
                Evidence: {output.evidence.join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Decision records (explainability) ────────────────────────────────────────

export function BrainDecisionRecordsPanel(props: {
  records: BrainDecisionRecord[];
}): React.JSX.Element {
  const { records } = props;
  if (records.length === 0) {
    return (
      <p className="text-[11px] text-[#94A3B8] flex items-center gap-1.5">
        <ScrollText className="h-3.5 w-3.5" />
        No decisions recorded yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {[...records].reverse().map((record) => (
        <details
          key={record.id}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] p-3"
        >
          <summary className="flex items-center justify-between gap-2 cursor-pointer select-none">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                {record.decision}
              </p>
              <p className="text-[10px] text-[#94A3B8]">
                {formatDateTime(record.createdAt)} · {record.provenance}
              </p>
            </div>
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${confidenceBadge(record.confidence)}`}
            >
              {Math.round(record.confidence * 100)}%
            </span>
          </summary>
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-[#374151] dark:text-[#E2E8F0]">{record.reason}</p>
            <p className="text-[11px]">
              <span className="text-[#94A3B8]">Selected: </span>
              <span className="font-medium text-[#2B5FD9] dark:text-[#6B8FEF]">
                {record.selected}
              </span>
            </p>
            {record.alternatives.length > 0 && (
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Alternatives: {record.alternatives.join(' · ')}
              </p>
            )}
            {record.evidence.length > 0 && (
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Evidence: {record.evidence.join(' · ')}
              </p>
            )}
            {record.providerId && (
              <p className="text-[10px] text-[#94A3B8]">
                Provider: {record.providerId}
                {record.modelId ? ` / ${record.modelId}` : ''}
              </p>
            )}
            {record.costEstimateUsd !== undefined && (
              <p className="text-[10px] text-[#94A3B8]">
                Cost estimate: {formatUsd(record.costEstimateUsd)}
              </p>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

// ── Small shared bits ────────────────────────────────────────────────────────

export function BrainSectionHeading(props: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
}): React.JSX.Element {
  const { icon, title, sub } = props;
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <h2 className="text-[15px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          {title}
        </h2>
        {sub && <p className="text-[11px] text-[#94A3B8]">{sub}</p>}
      </div>
    </div>
  );
}

export function BrainTimestamps(props: { task: BrainTask }): React.JSX.Element {
  const { task } = props;
  return (
    <div className="text-[10px] text-[#94A3B8] space-y-0.5">
      <p className="flex items-center gap-1">
        <Clock className="h-3 w-3" /> Created {formatDateTime(task.createdAt)}
      </p>
      <p className="flex items-center gap-1">
        <Coins className="h-3 w-3" /> Updated {formatDateTime(task.updatedAt)}
      </p>
      <p className="truncate">trace {task.traceId}</p>
    </div>
  );
}
