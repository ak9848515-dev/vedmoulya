// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Brain Operating Dashboard (EPIC-020 §13)
//
// Answers the five operating questions with EXISTING telemetry:
//   • What is VedMoulya doing?          → status hero + active tasks
//   • What needs my approval?           → pending approval queue
//   • What did it learn?                → learning feed + adaptive scores
//   • What can improve my life/income?  → opportunities + AI World discoveries
//   • Provider/usage health            → provider chips + usage/cost
// No clutter: compact cards, everything owner-scoped through brain.*
// procedures (IDOR refused at the gateway).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card } from '@vedmoulya/ui';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Compass,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  useBrainCorrectLearning,
  useBrainDashboard,
  useBrainDailyPriorities,
  useBrainDiscoverIntelligence,
  useBrainListOpportunities,
  useBrainListIntelligenceEvents,
  useBrainUpdateOpportunity,
  useBrainUpdateIntelligenceEvent,
} from '../../lib/api-client.js';

// ── Status hero ──────────────────────────────────────────────────────────────

export function BrainStatusHero({ userId }: { userId: string }): React.JSX.Element {
  const dashboard = useBrainDashboard(userId);
  const view = dashboard.data;

  if (!view) {
    return (
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
            Brain Operations
          </p>
          <Loader2 className="h-4 w-4 animate-spin text-[#94A3B8]" />
        </div>
      </Card>
    );
  }

  const statusMeta: Record<typeof view.brainStatus, { label: string; cls: string }> = {
    IDLE: {
      label: 'Idle — ready for your next objective',
      cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    },
    WORKING: {
      label: 'Working — executing tasks',
      cls: 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]',
    },
    AWAITING_APPROVAL: {
      label: 'Needs your approval',
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
  };
  const meta = statusMeta[view.brainStatus];

  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="p-2 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/30">
          <BrainCircuit className="h-4 w-4 text-[#2B5FD9]" />
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${meta.cls}`}>
          {meta.label}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-[#64748B] dark:text-[#CBD5E1]">
          {view.activeTasks} active task{view.activeTasks === 1 ? '' : 's'}
        </span>
        {view.scheduler.nextDiscoveryAt && (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-[#64748B] dark:text-[#CBD5E1] flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            next AI World scan {new Date(view.scheduler.nextDiscoveryAt).toLocaleString()}
          </span>
        )}
        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-[#64748B] dark:text-[#CBD5E1]">
          {view.usage.costUsd > 0 ? `$${view.usage.costUsd.toFixed(4)} used` : 'no AI spend yet'}
        </span>
      </div>

      {/* Pending approvals — the most important surface */}
      {view.pendingApprovals.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {view.pendingApprovals.length} action{view.pendingApprovals.length === 1 ? '' : 's'}{' '}
            waiting for your approval
          </p>
          <ul className="mt-1.5 space-y-1">
            {view.pendingApprovals.map((a) => (
              <li
                key={a.taskId}
                className="text-[11px] text-amber-700 dark:text-amber-400 truncate"
              >
                <span className="font-medium">{a.actions.join(', ')}</span> — {a.objective}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Provider health chips */}
      {view.providerHealth.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {view.providerHealth.map((p) => (
            <span
              key={p.providerId}
              title={`${p.availability} · quota ${p.quotaUsedPercent}%`}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                p.availability === 'AVAILABLE'
                  ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300'
                  : p.availability === 'LIMITED'
                    ? 'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300'
                    : p.availability === 'UNAVAILABLE'
                      ? 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300'
                      : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              {p.name}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Opportunities (mission §12) ──────────────────────────────────────────────

export function BrainOpportunitiesPanel({ userId }: { userId: string }): React.JSX.Element {
  const opportunities = useBrainListOpportunities(userId);
  const update = useBrainUpdateOpportunity();
  const items = (opportunities.data ?? [])
    .filter((o) => o.status === 'NEW' || o.status === 'RECOMMENDED' || o.status === 'ACCEPTED')
    .slice(0, 8);

  if (items.length === 0) {
    return (
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          <Lightbulb className="h-4 w-4 text-[#7C3AED]" />
          Opportunities
        </h3>
        <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          Evidence-backed opportunities will appear here as the Brain discovers free/open resources
          and recognizes recurring work — always with uncertainty, never an income promise.
        </p>
      </Card>
    );
  }

  const setStatus = (id: string, status: 'ACCEPTED' | 'DISMISSED'): void => {
    void update.mutateAsync({ userId, opportunityId: id, status }).then(() => {
      void opportunities.refetch();
    });
  };

  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
        <Lightbulb className="h-4 w-4 text-[#7C3AED]" />
        Opportunities
      </h3>
      <ul className="mt-2 space-y-2">
        {items.map((o) => (
          <li key={o.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  <span
                    className={`px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide ${
                      o.category === 'cost_saving'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : o.category === 'automation'
                          ? 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]'
                          : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                    }`}
                  >
                    {o.category.replaceAll('_', ' ')}
                  </span>
                  <span className="truncate">{o.title}</span>
                </p>
                <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] line-clamp-2">
                  {o.description}
                </p>
                <p className="mt-1 text-[10px] text-[#94A3B8]">
                  Uncertainty {Math.round(o.uncertainty * 100)}% — evidence, not a promise.
                </p>
              </div>
              {o.status === 'ACCEPTED' ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  <CheckCircle2 className="h-3 w-3" /> Noted
                </span>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setStatus(o.id, 'ACCEPTED');
                    }}
                    title="Acknowledge this opportunity"
                    className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setStatus(o.id, 'DISMISSED');
                    }}
                    title="Not relevant for me"
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Continuous AI World intelligence (mission §8) ────────────────────────────

export function BrainIntelligenceEventsPanel({ userId }: { userId: string }): React.JSX.Element {
  const events = useBrainListIntelligenceEvents(userId);
  const discover = useBrainDiscoverIntelligence();
  const update = useBrainUpdateIntelligenceEvent();
  const opportunities = useBrainListOpportunities(userId);
  const items = (events.data ?? [])
    .filter((e) => e.status === 'NEW' || e.status === 'RECOMMENDED' || e.status === 'REVIEWED')
    .slice(0, 8);

  const runDiscovery = (): void => {
    void discover.mutateAsync({ userId }).then(() => {
      // A discovery run can create opportunities — refresh BOTH surfaces.
      void events.refetch();
      void opportunities.refetch();
    });
  };

  const setStatus = (id: string, status: 'REVIEWED' | 'DISMISSED'): void => {
    void update.mutateAsync({ userId, eventId: id, status }).then(() => {
      void events.refetch();
    });
  };

  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          <Compass className="h-4 w-4 text-[#06B6D4]" />
          Continuous AI World
        </h3>
        <button
          onClick={runDiscovery}
          disabled={discover.isPending}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2B5FD9] text-white text-[11px] font-semibold hover:bg-[#1E4BB8] transition-colors disabled:opacity-50"
        >
          {discover.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Discover
        </button>
      </div>
      <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
        Screened discoveries from AI World → the Brain. Discovery is never adoption: nothing is
        installed, subscribed or executed without your approval.
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-[11px] text-[#94A3B8]">
          No material discoveries yet — run Discover to pull the latest screened AI World items.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    <span
                      className={`px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide ${
                        e.security === 'BLOCKED' || e.security === 'SUSPICIOUS'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : e.security === 'UNKNOWN' || e.security === 'SECURITY_REVIEW_REQUIRED'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {e.security.replaceAll('_', ' ')}
                    </span>
                    <span className="truncate">{e.title}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] line-clamp-2">
                    {e.description}
                  </p>
                  <p className="mt-1 text-[10px] text-[#94A3B8] flex items-center gap-1">
                    {e.kind.replaceAll('_', ' ')} · relevance {Math.round(e.relevance * 100)}%
                  </p>
                </div>
                {e.status === 'REVIEWED' ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    <CheckCircle2 className="h-3 w-3" /> Reviewed
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setStatus(e.id, 'REVIEWED');
                      }}
                      title="Acknowledged — I have seen this"
                      className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setStatus(e.id, 'DISMISSED');
                      }}
                      title="Not relevant"
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Learning feed (mission §10 + SPRINT-025) ──────────────────────────────────
// SPRINT-025: every learning row now distinguishes WHO stated it:
//   • YOU TOLD ME   → EXPLICIT (user correction / acceptance) — highest authority
//   • I OBSERVED    → verified FACT (execution + independent verification)
//   • I INFERRED    → weak pattern, low confidence, never a belief
//   • UNKNOWN       → cannot learn from this yet (honest)
// Confidence and evidence are surfaced per signal; a compact "Correct"
// affordance lets the user override any inference directly.

function SourceBadge({
  source,
  kind,
}: {
  source: 'EXPLICIT' | 'INFERRED';
  kind: 'FACT' | 'INFERENCE' | 'UNKNOWN';
}): React.JSX.Element {
  const meta =
    source === 'EXPLICIT'
      ? {
          label: 'You told me',
          cls: 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]',
        }
      : kind === 'FACT'
        ? {
            label: 'I observed',
            cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
          }
        : kind === 'UNKNOWN'
          ? {
              label: 'Cannot learn yet',
              cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
            }
          : {
              label: 'I inferred',
              cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
            };
  return (
    <span
      className={`px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

export function BrainLearningPanel({
  view,
  userId,
}: {
  view: NonNullable<ReturnType<typeof useBrainDashboard>['data']>;
  userId?: string;
}): React.JSX.Element {
  const correct = useBrainCorrectLearning();
  const [open, setOpen] = React.useState(false);
  const [statement, setStatement] = React.useState('');
  const [target, setTarget] = React.useState<'approach' | 'provider' | 'result' | 'preference'>(
    'approach',
  );

  const submitCorrection = (): void => {
    if (!userId || statement.trim().length < 3) return;
    void correct
      .mutateAsync({ userId, statement: statement.trim(), target })
      .then(() => {
        setStatement('');
        setOpen(false);
      })
      .catch(() => undefined);
  };

  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          <TrendingUp className="h-4 w-4 text-[#22C55E]" />
          What VedMoulya learned
        </h3>
        <button
          onClick={() => {
            setOpen((v) => !v);
          }}
          className="px-2.5 py-1 rounded-lg bg-[#2B5FD9] text-white text-[11px] font-semibold hover:bg-[#1E4BB8] transition-colors"
        >
          Correct
        </button>
      </div>
      <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
        Learning is evidence-based — every signal shows who stated it, and you can correct anything.
        Corrections always outrank inferred patterns.
      </p>

      {open && (
        <div className="mt-2 rounded-lg border border-[#2B5FD9]/30 dark:border-[#1E3A8A]/60 bg-[#F5F8FF] dark:bg-[#0F172A]/60 p-2.5 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(['approach', 'provider', 'result', 'preference'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTarget(t);
                }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                  target === t
                    ? 'bg-[#2B5FD9] text-white'
                    : 'bg-slate-100 text-[#64748B] dark:bg-slate-800 dark:text-[#94A3B8] hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={statement}
              onChange={(e) => {
                setStatement(e.target.value);
              }}
              placeholder={`e.g. don't use this ${target} again`}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[12px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] outline-none focus:ring-1 focus:ring-[#2B5FD9]"
            />
            <button
              onClick={submitCorrection}
              disabled={statement.trim().length < 3 || correct.isPending}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {correct.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p className="text-[10px] text-[#94A3B8]">
            Saved as an explicit fact — it outranks any inferred pattern about this.
          </p>
        </div>
      )}

      {view.learning.length === 0 && view.corrections.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          No outcomes recorded yet — accept or reject a Brain result to build the evidence ledger.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {view.corrections.slice(0, 3).map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-[#2B5FD9]/20 dark:border-[#1E3A8A]/40 bg-[#F5F8FF] dark:bg-[#0F172A]/50 p-2"
            >
              <div className="flex items-center gap-1.5">
                <SourceBadge source="EXPLICIT" kind="FACT" />
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{c.target}</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                “{c.statement}”
              </p>
            </li>
          ))}
          {view.learning.slice(0, 5).map((l) => (
            <li
              key={l.taskId}
              className="rounded-lg border border-slate-100 dark:border-slate-800 p-2"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`font-semibold text-[11px] ${
                    l.verdict === 'SUCCESS'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : l.verdict === 'FAILED'
                        ? 'text-rose-600 dark:text-rose-400'
                        : l.verdict === 'UNKNOWN'
                          ? 'text-slate-500 dark:text-slate-400'
                          : l.outcome === 'SUCCESS'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : l.outcome === 'PARTIAL'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {l.verdict ?? l.outcome}
                </span>
                <span className="text-[10px] text-[#94A3B8]">· {l.taskType}</span>
              </div>
              {l.signals.slice(0, 2).map((s, i) => (
                <div key={i} className="mt-1 flex items-start gap-1.5">
                  <SourceBadge source={s.source} kind={s.kind} />
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-snug">
                    {s.fact}{' '}
                    <span className="text-[#94A3B8]">
                      · confidence {Math.round(s.confidence * 100)}%
                    </span>
                  </p>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
      {view.adaptiveScores.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
            Adaptive provider evidence
          </p>
          <ul className="mt-1 space-y-0.5">
            {view.adaptiveScores.slice(0, 5).map((s) => (
              <li
                key={`${s.providerId}-${s.capability}`}
                className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8]"
              >
                <span className="truncate">
                  {s.providerId} · {s.capability}
                </span>
                <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  {Math.round(s.qualityScore * 100)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ── Dashboard assembly ───────────────────────────────────────────────────────

// ── Today's Top 5 (EPIC-020 · Outcome & Revenue layer §8) ───────────────────

export function BrainDailyPrioritiesPanel({ userId }: { userId: string }): React.JSX.Element {
  const priorities = useBrainDailyPriorities(userId, 5);
  const items = priorities.data ?? [];

  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          <SparklesIcon className="h-4 w-4 text-[#7C3AED]" />
          Today's most valuable actions
        </h3>
        {priorities.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#94A3B8]" />}
      </div>
      <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
        Ranked transparently — urgency, impact, money/time evidence and quality first; cost never
        outranks quality.
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-[11px] text-[#94A3B8]">
          Nothing to prioritize yet — run the Brain or discover new capabilities and today's top
          actions will appear here.
        </p>
      ) : (
        <ol className="mt-2 space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5"
            >
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[10px] font-bold text-[#2B5FD9] dark:text-[#6B8FEF] shrink-0 mt-px">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    <span
                      className={`px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide ${
                        item.category === 'EARNING'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : item.category === 'APPROVAL'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : item.category === 'CONTINUE'
                              ? 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]'
                              : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                      }`}
                    >
                      {item.category.replaceAll('_', ' ')}
                    </span>
                    <span className="truncate">{item.title}</span>
                  </p>
                  {item.whyItMatters.slice(0, 1).map((why, i) => (
                    <p
                      key={i}
                      className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8] line-clamp-2"
                    >
                      {why}
                    </p>
                  ))}
                  <p className="mt-1 text-[10px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF]">
                    Next: {item.recommendedNextAction}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap shrink-0">
                  {Math.round(item.priorityScore * 100)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function SparklesIcon(props: { className?: string }): React.JSX.Element {
  return <Sparkles className={props.className ?? ''} />;
}

export function BrainOperationsSection({ userId }: { userId: string }): React.JSX.Element {
  return (
    <div className="space-y-4 animate-slide-up">
      <BrainStatusHero userId={userId} />
      <BrainDailyPrioritiesPanel userId={userId} />
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <BrainOpportunitiesPanel userId={userId} />
        <BrainIntelligenceEventsPanel userId={userId} />
      </div>
      <BrainLearningFeed userId={userId} />
    </div>
  );
}

function BrainLearningFeed({ userId }: { userId: string }): React.JSX.Element {
  const dashboard = useBrainDashboard(userId);
  if (!dashboard.data) return <React.Fragment />;
  return <BrainLearningPanel view={dashboard.data} userId={userId} />;
}
