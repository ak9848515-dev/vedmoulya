// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge panels (EPIC-017)
// Premium, progressive-disclosure panels for the /live-intelligence page:
// stage rail, capability candidates, current-vs-better comparison,
// recommendation + approval, configuration/execution hand-off, outcome
// evaluation, task-specific performance and AI World notifications.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

/* eslint-disable security/detect-object-injection -- Record lookups below use
   closed union keys (AcquisitionClass / BridgeStage / BridgeHandoffKind) against
   bounded style/label records — same documented pattern as the brain panels. */

import React from 'react';
import { Card } from '@vedmoulya/ui';
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  Lock,
  Shield,
  Coins,
  Cpu,
  Scale,
  ExternalLink,
  ArrowRight,
  Workflow,
  Sparkles,
  TrendingUp,
  Bell,
  Ban,
  Zap,
  XCircle,
} from 'lucide-react';
import type {
  BridgeCandidate,
  BridgeComparison,
  BridgeExecutionHandoff,
  BridgeLoopRun,
  BridgeNotificationEvent,
  BridgeOutcomeEvaluation,
  BridgePerformanceFact,
  BridgeRecommendation,
} from '@vedmoulya/live-intelligence-bridge';
import { formatDateTime } from './bridge-ui.js';

// ── Section heading ──────────────────────────────────────────────────────────

export function BridgeSectionHeading(props: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}): React.JSX.Element {
  const { icon, title, sub } = props;
  return (
    <div className="mt-6 flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B]">{icon}</div>
      <div>
        <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">{title}</h3>
        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{sub}</p>
      </div>
    </div>
  );
}

// ── Stage rail ───────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  UNDERSTAND: 'Understand',
  DISCOVER: 'Discover',
  COMPARE: 'Compare',
  RECOMMEND: 'Recommend',
  APPROVAL: 'Approval',
  CONFIGURE: 'Configure',
  HANDOFF: 'Hand-off',
  PLAN: 'Plan',
  EXECUTE: 'Execute',
  VERIFY: 'Verify',
  EVALUATE: 'Evaluate',
  FEEDBACK: 'Feedback',
  NOTIFY: 'Notify',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  BLOCKED: 'Blocked',
};

const MAIN_STAGES = [
  'UNDERSTAND',
  'DISCOVER',
  'COMPARE',
  'RECOMMEND',
  'APPROVAL',
  'EXECUTE',
  'VERIFY',
  'EVALUATE',
] as const;

function stageIcon(status: string): React.ReactNode {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case 'blocked':
    case 'failed':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Circle className="h-4 w-4" />;
  }
}

export function BridgeStageRail(props: {
  stageStatuses: BridgeLoopRun['stageStatuses'];
  stage: BridgeLoopRun['stage'];
}): React.JSX.Element {
  const { stageStatuses, stage } = props;
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {MAIN_STAGES.map((s, i) => {
        const status = stageStatuses[s];
        const active = stage === s;
        const done = status === 'completed';
        const color =
          status === 'completed'
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
            : status === 'running' || active
              ? 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#93C5FD]'
              : status === 'blocked' || status === 'failed'
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500';
        return (
          <React.Fragment key={s}>
            {i > 0 && (
              <div
                className={`h-px w-3 ${done ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-slate-200 dark:bg-slate-700'}`}
              />
            )}
            <div
              title={`${STAGE_LABELS[s] ?? s}: ${status}`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${color}`}
            >
              {stageIcon(status)}
              {STAGE_LABELS[s] ?? s}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Candidate list (progressive disclosure) ──────────────────────────────────

const COST_STYLE: Record<string, string> = {
  FREE_API: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  FREE_WITH_QUOTA: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  LOCAL_MODEL: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  OPEN_SOURCE: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  GITHUB_PROJECT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  PAID: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  EXTERNAL_APPLICATION: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  MANUAL: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  UNKNOWN: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

function qualityBar(quality?: number): React.ReactNode {
  if (quality === undefined) {
    return <span className="text-[10px] text-[#94A3B8]">Quality: UNKNOWN</span>;
  }
  const pct = Math.max(0, Math.min(100, quality));
  const blocks = Math.round(pct / 10);
  return (
    <span className="inline-flex items-center gap-1" title={`Quality ${pct}/100`}>
      <span className="font-mono text-[10px] tracking-tight text-[#0F172A] dark:text-[#E2E8F0]">
        {'█'.repeat(blocks)}
        <span className="text-[#CBD5E1] dark:text-[#334155]">{'█'.repeat(10 - blocks)}</span>
      </span>
      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">{pct}</span>
    </span>
  );
}

export function BridgeCandidateList(props: { candidates: BridgeCandidate[] }): React.JSX.Element {
  const { candidates } = props;
  const visible = candidates.slice(0, 8);
  const hidden = candidates.length - visible.length;
  return (
    <div className="space-y-2">
      {visible.map((c, i) => (
        // key: candidate display names repeat across capabilities (the same
        // provider/model can serve several capabilities) — composite key keeps
        // React reconciliation stable without duplicate-key warnings.
        <Card
          key={`${c.capability}|${c.candidate}|${i}`}
          variant="standard"
          padding="md"
          className="dark:bg-[#1E293B]"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
                {c.candidate}
              </p>
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                {c.capability} · {c.integrationType} · {c.source}
              </p>
            </div>
            <span
              className={`px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide ${COST_STYLE[c.costClass] ?? COST_STYLE.UNKNOWN}`}
            >
              {c.costClass.replaceAll('_', ' ')}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {qualityBar(c.quality)}
            <span
              className={`inline-flex items-center gap-1 text-[10px] ${
                c.securityStatus === 'TRUSTED' ||
                c.securityStatus === 'TRUSTED_WITH_REVIEW' ||
                c.securityStatus === 'SECURITY_REVIEWED'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : c.securityStatus === 'BLOCKED' || c.securityStatus === 'SUSPICIOUS'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-[#94A3B8]'
              }`}
            >
              <Shield className="h-3 w-3" />
              {c.securityStatus === 'SECURITY_REVIEWED'
                ? 'No blocking indicators found'
                : c.securityStatus}
            </span>
            <span className="text-[10px] text-[#94A3B8]">{c.availability}</span>
            {c.approvalRequired && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <Lock className="h-3 w-3" />
                Approval required
              </span>
            )}
          </div>
          {c.qualityEvidence.length > 0 && (
            <p className="mt-1.5 text-[10px] text-[#94A3B8] truncate">
              Evidence: {c.qualityEvidence.slice(0, 3).join(' · ')}
            </p>
          )}
        </Card>
      ))}
      {hidden > 0 && (
        <p className="text-[10px] text-[#94A3B8] flex items-center gap-1">
          <ArrowRight className="h-3 w-3" /> +{hidden} more candidates (bounded view)
        </p>
      )}
    </div>
  );
}

// ── Comparison — current vs better ───────────────────────────────────────────

export function BridgeComparisonCard(props: { comparison: BridgeComparison }): React.JSX.Element {
  const { comparison } = props;
  const alt = comparison.alternative;
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center gap-1.5">
        <Scale className="h-4 w-4 text-[#7C3AED]" />
        <h4 className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          {comparison.capability}
        </h4>
        {comparison.betterOptionAvailable && (
          <span className="ml-auto px-1.5 py-px rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-bold uppercase tracking-wide">
            Better option available
          </span>
        )}
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Current</p>
          {comparison.current ? (
            <>
              <p className="text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                {comparison.current.name}
              </p>
              {comparison.current.quality !== undefined && (
                <p className="text-[10px] text-[#94A3B8]">
                  Quality {comparison.current.quality}/100
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-[#94A3B8]">Nothing configured yet</p>
          )}
        </div>
        <div className="rounded-lg border border-[#16A34A]/30 bg-[#F0FDF4] dark:bg-[#14532D]/30 p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-[#16A34A] dark:text-[#4ADE80]">
            Recommended
          </p>
          {alt ? (
            <>
              <p className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                {alt.candidate}
              </p>
              {alt.quality !== undefined && (
                <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                  Quality {alt.quality}/100
                </p>
              )}
              <p className="mt-0.5 text-[10px] text-[#16A34A] dark:text-[#4ADE80]">
                {alt.costClass.replaceAll('_', ' ')}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-[#94A3B8]">—</p>
          )}
        </div>
      </div>

      {comparison.why.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {comparison.why.map((w) => (
            <li key={w} className="flex gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              <span className="text-[#16A34A] mt-0.5">•</span>
              {w}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Recommendation + approval ────────────────────────────────────────────────

const RECOMMENDATION_ICONS: Record<BridgeRecommendation['kind'], React.ReactNode> = {
  BETTER_CAPABILITY_FOUND: <Sparkles className="h-4 w-4 text-[#F59E0B]" />,
  USEFUL_OPEN_SOURCE_FOUND: <Workflow className="h-4 w-4 text-[#16A34A]" />,
  FREE_LOCAL_MODEL_AVAILABLE: <Cpu className="h-4 w-4 text-[#06B6D4]" />,
  HIGHER_QUALITY_OPTION: <TrendingUp className="h-4 w-4 text-[#7C3AED]" />,
};

export function BridgeApprovalPanel(props: {
  recommendation: BridgeRecommendation;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}): React.JSX.Element {
  const { recommendation: r, busy, onApprove, onReject } = props;
  const isPaid =
    r.acquisition === 'PAID' ||
    r.acquisition === 'FREE_WITH_QUOTA' ||
    r.acquisition === 'GITHUB_PROJECT';
  return (
    <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[#FFFBEB] dark:bg-[#78350F]/30 shrink-0">
          {RECOMMENDATION_ICONS[r.kind] ?? <Sparkles className="h-4 w-4 text-[#F59E0B]" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">{r.title}</p>

          {/* Current vs recommended */}
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">Current</p>
              {r.current ? (
                <>
                  <p className="text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                    {r.current.name}
                  </p>
                  {r.current.quality !== undefined && (
                    <p className="text-[10px] text-[#94A3B8]">Quality {r.current.quality}/100</p>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-[#94A3B8]">—</p>
              )}
            </div>
            <div className="rounded-lg border border-[#16A34A]/30 bg-[#F0FDF4] dark:bg-[#14532D]/30 p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#16A34A] dark:text-[#4ADE80]">
                Recommended
              </p>
              <p className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                {r.recommended.name}
              </p>
              {r.recommended.quality !== undefined && (
                <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                  Quality {r.recommended.quality}/100
                </p>
              )}
            </div>
          </div>

          {/* Why */}
          {r.recommended.why.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Why</p>
              <ul className="mt-1 space-y-0.5">
                {r.recommended.why.map((w) => (
                  <li
                    key={w}
                    className="flex gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]"
                  >
                    <span className="text-[#16A34A] mt-0.5">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Facts */}
          <div className="mt-3 flex items-center gap-2 flex-wrap text-[10px]">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-px rounded-full font-bold uppercase tracking-wide ${COST_STYLE[r.acquisition] ?? COST_STYLE.UNKNOWN}`}
            >
              <Coins className="h-3 w-3" />
              {r.acquisition.replaceAll('_', ' ')}
            </span>
            {r.cost?.amountUsd !== undefined && (
              <span className="inline-flex items-center gap-1 text-[#64748B] dark:text-[#94A3B8]">
                ${r.cost.amountUsd}
                {r.cost.cadence === 'monthly' ? '/mo' : r.cost.cadence === 'per_use' ? '/use' : ''}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[#64748B] dark:text-[#94A3B8]">
              <Shield className="h-3 w-3" />
              {r.security === 'SECURITY_REVIEWED' ? 'No blocking indicators found' : r.security}
            </span>
            {r.freeAlternative && (
              <span className="inline-flex items-center gap-1 text-[#16A34A] dark:text-[#4ADE80]">
                <Zap className="h-3 w-3" />
                Free alternative: {r.freeAlternative}
              </span>
            )}
            {r.localAlternative && (
              <span className="inline-flex items-center gap-1 text-[#06B6D4] dark:text-[#22D3EE]">
                <Cpu className="h-3 w-3" />
                Local: {r.localAlternative}
              </span>
            )}
          </div>

          {r.requires.length > 0 && (
            <p className="mt-2 text-[10px] text-[#94A3B8]">Requires: {r.requires.join(' · ')}</p>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {r.state === 'PENDING' && r.approvalRequired ? (
              <>
                <button
                  onClick={onApprove}
                  disabled={busy}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                    isPaid ? 'bg-[#7C3AED] hover:bg-[#6D28D9]' : 'bg-[#16A34A] hover:bg-[#15803D]'
                  }`}
                >
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {isPaid ? 'Approve & Configure' : 'Use recommended'}
                </button>
                <button
                  onClick={onReject}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  <Ban className="h-3 w-3" />
                  Keep current
                </button>
              </>
            ) : r.state === 'ACCEPTED' ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approved — continuing with the best available option
              </span>
            ) : r.state === 'DECLINED' ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <Ban className="h-3.5 w-3.5" />
                Declined — continuing with the best available option
              </span>
            ) : null}
            {r.approvalRequired && r.state === 'PENDING' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <Lock className="h-3 w-3" />
                Explicit approval required
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Hand-off (configuration / execution) ─────────────────────────────────────

const HANDOFF_STYLE: Record<string, string> = {
  CONFIGURE: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  MANUAL: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  EXTERNAL: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  EXECUTE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  UNAVAILABLE: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

export function BridgeHandoffCard(props: {
  handoff: BridgeExecutionHandoff;
  onProceed: () => void;
  busy: boolean;
}): React.JSX.Element {
  const { handoff, onProceed, busy } = props;
  const needsAction =
    handoff.kind === 'CONFIGURE' || handoff.kind === 'MANUAL' || handoff.kind === 'EXTERNAL';
  return (
    <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
      <div className="flex items-center gap-1.5">
        <Workflow className="h-4 w-4 text-[#2B5FD9]" />
        <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Hand-off</h3>
        <span
          className={`ml-auto px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide ${HANDOFF_STYLE[handoff.kind] ?? HANDOFF_STYLE.UNAVAILABLE}`}
        >
          {handoff.kind}
        </span>
      </div>
      <p className="mt-2 text-[12px] text-[#374151] dark:text-[#E2E8F0]">{handoff.detail}</p>
      <p className="mt-1 text-[10px] text-[#94A3B8]">
        Plan {handoff.planId}
        {handoff.executionId ? ' · Execution ' + handoff.executionId : ''} · Step “
        {handoff.stepTitle}”
      </p>
      {needsAction && (
        <div className="mt-3 flex items-center gap-2">
          {handoff.deepLink ? (
            <a
              href={handoff.deepLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B5FD9] text-white text-[11px] font-semibold hover:bg-[#1E4BB8] transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Configure
            </a>
          ) : null}
          <button
            onClick={onProceed}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-[11px] font-semibold hover:bg-[#15803D] transition-colors disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowRight className="h-3 w-3" />
            )}
            Proceed to execution
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Outcome evaluation ───────────────────────────────────────────────────────

export function BridgeOutcomePanel(props: { outcome: BridgeOutcomeEvaluation }): React.JSX.Element {
  const { outcome: o } = props;
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-[#7C3AED]" />
        <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Outcome evaluation
        </h3>
        <span
          className={`ml-auto px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide ${
            o.taskCompleted
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
          }`}
        >
          {o.taskCompleted ? 'Completed' : 'Partial'}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
          <p className="font-bold uppercase tracking-wide text-[#94A3B8]">Quality</p>
          <p className="mt-0.5 text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {o.quality}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
          <p className="font-bold uppercase tracking-wide text-[#94A3B8]">Accuracy</p>
          <p className="mt-0.5 text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {o.accuracy}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
          <p className="font-bold uppercase tracking-wide text-[#94A3B8]">Validation</p>
          <p
            className={`mt-0.5 text-[12px] font-semibold ${o.validation === 'PASSED' ? 'text-emerald-600 dark:text-emerald-400' : o.validation === 'FAILED' ? 'text-rose-600 dark:text-rose-400' : 'text-[#111827] dark:text-[#F8FAFC]'}`}
          >
            {o.validation}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
          <p className="font-bold uppercase tracking-wide text-[#94A3B8]">Latency / Cost</p>
          <p className="mt-0.5 text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {o.latencyMs}ms · ${o.costUsd.toFixed(4)}
          </p>
        </div>
      </div>
      {o.failures.length > 0 && (
        <ul className="mt-3 space-y-1">
          {o.failures.map((f) => (
            <li key={f} className="flex gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}
      {o.providerPerformance.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
            Provider performance
          </p>
          <ul className="mt-1 space-y-1">
            {o.providerPerformance.map((p) => (
              <li
                key={p.provider + '-' + p.role}
                className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]"
              >
                <span className={p.succeeded ? 'text-emerald-500' : 'text-rose-500'}>
                  {p.succeeded ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                </span>
                {p.provider} · {p.role} · {p.latencyMs}ms
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ── Task-specific performance ────────────────────────────────────────────────

export function BridgePerformancePanel(props: {
  facts: BridgePerformanceFact[];
}): React.JSX.Element {
  const { facts } = props;
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-4 w-4 text-[#06B6D4]" />
        <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Task-specific performance
        </h3>
        <span className="ml-auto text-[10px] text-[#94A3B8]">
          derived · reversible · time-aware
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {facts.map((f) => (
          <li key={f.id} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                {f.providerId} · {f.capability}
              </p>
              <span className="text-[10px] text-[#94A3B8]">{formatDateTime(f.recordedAt)}</span>
            </div>
            <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
              Task quality: {f.taskQuality} · Privacy {f.privacyBenefit} · Cost benefit{' '}
              {f.costBenefit} · {f.derived ? 'inferred from outcome' : 'explicit'}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── AI World notifications ───────────────────────────────────────────────────

export function BridgeNotificationList(props: {
  events: BridgeNotificationEvent[];
}): React.JSX.Element {
  const { events } = props;
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center gap-1.5">
        <Bell className="h-4 w-4 text-[#F59E0B]" />
        <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Sent to AI World
        </h3>
        <span className="ml-auto text-[10px] text-[#94A3B8]">relevance-gated — no spam</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {events.map((e) => (
          <li key={e.id} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                {e.title}
              </p>
              <span className="text-[10px] text-[#94A3B8]">relevance {e.relevance}</span>
            </div>
            <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">{e.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
