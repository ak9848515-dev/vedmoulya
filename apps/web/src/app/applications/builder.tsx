// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Product Builder (EPIC-009)
// The INTELLIGENCE LAYER ABOVE THE APPLICATION FACTORY. A two-panel premium
// product-builder experience:
//   LEFT   — the conversation: "What do you want to build?" → the progressive
//            flow (understanding → questions → defaults → plan → approve →
//            handoff to the Application Factory).
//   RIGHT  — the progressive intelligence panel: Understanding · Requirements
//            (with provenance) · Questions · Assumptions · Product · Design ·
//            Architecture · AI · Security · Cost · Plan.
// Everything comes from the real requirements.* API — nothing is faked. The
// user is never asked what can be safely defaulted, blocking questions are
// never skipped, critical unknowns block the plan, and no application is
// generated before the Phase 23 approval gate.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@vedmoulya/ui';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Coins,
  Compass,
  FileText,
  FolderOpen,
  Hammer,
  Layers,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  RefreshCw,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react';
import {
  useRequirementsAcceptAllDefaults,
  useRequirementsAnswer,
  useRequirementsApprove,
  useRequirementsDecideDefault,
  useRequirementsHandoffToFactory,
  useRequirementsList,
  useRequirementsPlan,
  useRequirementsResolveConflict,
  useRequirementsSession,
  useRequirementsStart,
} from '../../lib/api-client.js';
import type { IntentClaim, RequirementsSessionDTO } from '@vedmoulya/requirements';

const EXAMPLES = [
  {
    id: 'restaurant',
    label: 'Restaurant ordering app',
    idea: 'Build me a modern restaurant application.',
  },
  {
    id: 'abap',
    label: 'ABAP debugger assistant',
    idea: 'Build an ABAP debugger assistant that analyzes ABAP source, explains errors, retrieves SAP knowledge, and suggests corrections.',
  },
  {
    id: 'support',
    label: 'AI customer support',
    idea: 'Build an AI customer-support application that answers customers from a knowledge base and escalates unresolved issues.',
  },
  {
    id: 'finance',
    label: 'Finance dashboard',
    idea: 'Build a finance dashboard for a small business to track income, expenses, and monthly reports.',
  },
] as const;

// ── Small presentational helpers ────────────────────────────────────────────

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2B5FD9]/10 text-[#2B5FD9] dark:bg-[#2B5FD9]/20">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function Chip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'blue' | 'amber' | 'emerald' | 'rose' | 'violet';
}): React.JSX.Element {
  const tones: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function provenanceTone(source: string): 'blue' | 'neutral' | 'emerald' | 'amber' | 'violet' {
  switch (source) {
    case 'USER':
      return 'blue';
    case 'INFERENCE':
      return 'violet';
    case 'DEFAULT':
      return 'amber';
    case 'QUESTION':
      return 'emerald';
    default:
      return 'neutral';
  }
}

function kvList(label: string, items: string[] | undefined): React.JSX.Element | null {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#2B5FD9]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhasePill({ phase }: { phase: string }): React.JSX.Element {
  const tone: Record<string, string> = {
    UNDERSTANDING:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
    QUESTIONS:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    DEFAULTS:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30',
    READY_FOR_PLAN:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
    REVIEW:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30',
    APPROVED:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    HANDED_OFF:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    REJECTED:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  };
  const labels: Record<string, string> = {
    UNDERSTANDING: 'Understanding',
    QUESTIONS: 'Questions',
    DEFAULTS: 'Safe defaults',
    READY_FOR_PLAN: 'Ready for plan',
    REVIEW: 'Plan review',
    APPROVED: 'Approved',
    HANDED_OFF: 'Handed to factory',
    REJECTED: 'Rejected',
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${tone[phase] ?? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}
    >
      {labels[phase] ?? phase}
    </span>
  );
}

// ── Panel sections ──────────────────────────────────────────────────────────

function UnderstandingSection({ session }: { session: RequirementsSessionDTO }): React.JSX.Element {
  const intent = session.intent;
  if (!intent) {
    return <p className="text-xs text-slate-400">Understanding is being built…</p>;
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{intent.problem}</p>
        {intent.desiredOutcome && (
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {intent.desiredOutcome}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip tone="blue">{intent.archetype}</Chip>
          <Chip>{intent.applicationType}</Chip>
          {intent.platforms.map((p) => (
            <Chip key={p}>{p}</Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <SectionTitle icon={<Check className="h-4 w-4" />} title="Explicitly stated" />
          <ul className="mt-2 space-y-1">
            {(intent.explicit.length > 0
              ? intent.explicit
              : [{ label: 'Nothing explicit yet', value: '', isUnknown: false } as IntentClaim]
            ).map((c, i) => (
              <li
                key={i}
                className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300"
              >
                • {c.label}
                {c.value ? `: ${c.value}` : ''}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionTitle icon={<Wand2 className="h-4 w-4" />} title="Inferred (not assumed)" />
          <ul className="mt-2 space-y-1">
            {(intent.inferred.length > 0
              ? intent.inferred
              : [{ label: 'Nothing inferred', value: '', isUnknown: false } as IntentClaim]
            ).map((c, i) => (
              <li
                key={i}
                className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300"
              >
                • {c.label}
                {c.value ? `: ${c.value}` : ''}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {kvList('Known features', intent.knownFeatures)}
      {kvList('Known constraints', intent.knownConstraints)}
      {kvList('Success criteria', intent.successCriteria)}

      <div className="flex items-center gap-2 rounded-lg bg-[#2B5FD9]/5 px-3 py-2 dark:bg-[#2B5FD9]/10">
        <Target className="h-3.5 w-3.5 text-[#2B5FD9]" />
        <p className="text-[11px] text-slate-600 dark:text-slate-300">
          Confidence in this understanding:{' '}
          <strong>{Math.round(intent.overallConfidence * 100)}%</strong>
        </p>
      </div>
    </div>
  );
}

function RequirementsSection({ session }: { session: RequirementsSessionDTO }): React.JSX.Element {
  const reqs = session.requirements?.requirements ?? [];
  const byStatus = session.requirements?.counts.byStatus;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="blue">{reqs.length} requirements</Chip>
        {byStatus &&
          Object.entries(byStatus).map(([status, count]) =>
            count > 0 ? (
              <Chip
                key={status}
                tone={
                  status === 'CONFIRMED' ? 'emerald' : status === 'UNKNOWN' ? 'amber' : 'neutral'
                }
              >
                {status.toLowerCase()} ×{count}
              </Chip>
            ) : null,
          )}
      </div>
      {reqs.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400">{r.id}</span>
            <Chip tone={provenanceTone(r.source)}>source: {r.source.toLowerCase()}</Chip>
            <Chip
              tone={
                r.priority === 'CRITICAL' ? 'rose' : r.priority === 'HIGH' ? 'amber' : 'neutral'
              }
            >
              {r.priority.toLowerCase()}
            </Chip>
            <Chip
              tone={
                r.status === 'CONFIRMED' ? 'emerald' : r.status === 'UNKNOWN' ? 'amber' : 'neutral'
              }
            >
              {r.status.toLowerCase()}
            </Chip>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
            {r.description}
          </p>
          {r.reason && <p className="mt-1 text-[10px] italic text-slate-400">why: {r.reason}</p>}
        </div>
      ))}
      {reqs.length === 0 && (
        <p className="text-xs text-slate-400">No requirements extracted yet.</p>
      )}
    </div>
  );
}

function QuestionsSection({
  session,
  draftAnswers,
  setDraftAnswers,
  onSend,
  submitting,
}: {
  session: RequirementsSessionDTO;
  draftAnswers: Record<string, string>;
  setDraftAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSend: () => void;
  submitting: boolean;
}): React.JSX.Element {
  const bundles = session.questionPlan?.bundles ?? [];
  const openQuestions = (session.questionPlan?.all ?? []).filter((q) => q.answer === undefined);
  if (openQuestions.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          All questions answered. On to safe defaults.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        A few short questions — grouped by topic. These matter because their answers change the
        architecture or security of what gets built.
      </p>
      {bundles.map((bundle) => {
        const questions = bundle.questions.filter((q) => q.answer === undefined);
        if (questions.length === 0) return null;
        return (
          <div key={bundle.id}>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {bundle.title}
            </p>
            <div className="mt-2 space-y-3">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                      {q.text}
                    </p>
                    <Chip tone={q.class === 'BLOCKING' ? 'rose' : 'amber'}>
                      {q.class.toLowerCase()}
                    </Chip>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">why it matters: {q.rationale}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(q.options ?? []).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setDraftAnswers((prev) => ({ ...prev, [q.id]: opt.value }));
                        }}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          draftAnswers[q.id] === opt.value
                            ? 'border-[#2B5FD9] bg-[#2B5FD9] text-white'
                            : 'border-slate-300 text-slate-600 hover:border-[#2B5FD9] hover:text-[#2B5FD9] dark:border-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {q.freeText && (
                      <input
                        type="text"
                        value={draftAnswers[q.id] ?? ''}
                        onChange={(e) => {
                          setDraftAnswers((prev) => ({ ...prev, [q.id]: e.target.value }));
                        }}
                        placeholder="Your answer…"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] dark:border-slate-600 dark:bg-[#0F172A] dark:text-slate-100"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <Button onClick={onSend} disabled={submitting} className="w-full">
        {submitting ? (
          <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-1 h-4 w-4" />
        )}
        Send answers
      </Button>
    </div>
  );
}

function DefaultsSection({
  session,
  onAcceptAll,
  onDecide,
  submitting,
}: {
  session: RequirementsSessionDTO;
  onAcceptAll: () => void;
  onDecide: (id: string, decision: 'accepted' | 'edited' | 'rejected', value?: string) => void;
  submitting: boolean;
}): React.JSX.Element {
  const proposed = (session.defaults ?? []).filter((d) => d.status === 'proposed');
  if (proposed.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs text-emerald-700 dark:text-emerald-300">All defaults settled.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        For everything that can be safely defaulted, VedMoulya proposes a value — never silently.
        Review, accept, edit, or reject each one.
      </p>
      {proposed.map((d) => (
        <div key={d.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-1.5">
            {d.securitySensitive ? (
              <Chip tone="rose">security-sensitive</Chip>
            ) : (
              <Chip tone="neutral">assumption</Chip>
            )}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            {d.unknown} → <span className="text-[#2B5FD9]">{d.defaultValue}</span>
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            <strong className="text-slate-600 dark:text-slate-300">Assumption:</strong>{' '}
            {d.assumption}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            <strong className="text-slate-600 dark:text-slate-300">Reason:</strong> {d.reason}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            <strong className="text-slate-600 dark:text-slate-300">Impact:</strong> {d.impact}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                onDecide(d.id, 'accepted');
              }}
              className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
            >
              Accept
            </button>
            <button
              onClick={() => {
                onDecide(d.id, 'rejected');
              }}
              className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
      <Button onClick={onAcceptAll} disabled={submitting} variant="secondary" className="w-full">
        <Check className="mr-1 h-4 w-4" />
        Accept all safe defaults
      </Button>
    </div>
  );
}

function ConflictSection({
  session,
  onResolve,
}: {
  session: RequirementsSessionDTO;
  onResolve: (id: string, choice: string) => void;
}): React.JSX.Element {
  const open = (session.conflicts ?? []).filter((c) => c.status === 'open');
  if (open.length === 0) return <></>;
  return (
    <div className="space-y-3">
      {open.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10"
        >
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
            These requirements conflict
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-rose-600 dark:text-rose-200/80">
            {c.explanation}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                onResolve(c.id, 'a');
              }}
              className="rounded-full border border-rose-300 px-2.5 py-1 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-300"
            >
              Keep the first
            </button>
            <button
              onClick={() => {
                onResolve(c.id, 'b');
              }}
              className="rounded-full border border-rose-300 px-2.5 py-1 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-300"
            >
              Keep the second
            </button>
            <button
              onClick={() => {
                onResolve(c.id, 'both');
              }}
              className="rounded-full border border-rose-300 px-2.5 py-1 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-300"
            >
              Allow both
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanSection({
  session,
  onPlan,
  onApprove,
  onHandoff,
  submitting,
}: {
  session: RequirementsSessionDTO;
  onPlan: () => void;
  onApprove: () => void;
  onHandoff: () => void;
  submitting: boolean;
}): React.JSX.Element {
  const phase = session.phase;
  if (
    phase === 'UNDERSTANDING' ||
    phase === 'QUESTIONS' ||
    phase === 'DEFAULTS' ||
    phase === 'REJECTED'
  ) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center dark:border-slate-700">
        <Compass className="mx-auto h-6 w-6 text-slate-300" />
        <p className="mt-2 text-xs text-slate-400">
          The full product plan unlocks after questions and safe defaults are settled.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {phase === 'READY_FOR_PLAN' && (
        <Button onClick={onPlan} disabled={submitting} className="w-full">
          {submitting ? (
            <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-1 h-4 w-4" />
          )}
          Generate product plan
        </Button>
      )}
      {phase === 'REVIEW' && (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              The complete plan is ready for your review — approve it and VedMoulya will hand it to
              the Application Factory.
            </p>
          </div>
          <Button onClick={onApprove} disabled={submitting} className="w-full">
            {submitting ? (
              <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-4 w-4" />
            )}
            Approve plan
          </Button>
        </>
      )}
      {phase === 'APPROVED' && (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Plan approved. Hand it to the Application Factory to begin the structured build.
            </p>
          </div>
          <Button onClick={onHandoff} disabled={submitting} className="w-full">
            {submitting ? (
              <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-1 h-4 w-4" />
            )}
            Hand off to the Application Factory
          </Button>
        </>
      )}
    </div>
  );
}

function ReviewSummary({ session }: { session: RequirementsSessionDTO }): React.JSX.Element {
  const review = session.review;
  if (!review) return <></>;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <SectionTitle icon={<MessageSquareText className="h-4 w-4" />} title="What I understood" />
        <ul className="mt-2 space-y-1">
          {review.whatIUnderstood.map((s, i) => (
            <li key={i} className="text-[11px] text-slate-600 dark:text-slate-300">
              • {s}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            You explicitly requested
          </p>
          <ul className="mt-1.5 space-y-1">
            {review.explicitlyRequested.map((s, i) => (
              <li key={i} className="text-[11px] text-slate-600 dark:text-slate-300">
                • {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            I inferred (clearly marked)
          </p>
          <ul className="mt-1.5 space-y-1">
            {review.inferred.map((s, i) => (
              <li key={i} className="text-[11px] text-slate-600 dark:text-slate-300">
                • {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {review.dontKnow.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300">
            Still unknown
          </p>
          <ul className="mt-1.5 space-y-1">
            {review.dontKnow.map((s, i) => (
              <li key={i} className="text-[11px] text-amber-700 dark:text-amber-300/80">
                • {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Intelligence panel tabs ─────────────────────────────────────────────────

const PANEL_TABS = [
  { id: 'understanding', label: 'Understanding', icon: Target },
  { id: 'requirements', label: 'Requirements', icon: ListChecks },
  { id: 'questions', label: 'Questions', icon: CircleHelp },
  { id: 'assumptions', label: 'Assumptions', icon: Lightbulb },
  { id: 'product', label: 'Product', icon: FileText },
  { id: 'design', label: 'Design', icon: Sparkles },
  { id: 'architecture', label: 'Architecture', icon: Layers },
  { id: 'ai', label: 'AI', icon: Wand2 },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'cost', label: 'Cost', icon: Coins },
  { id: 'plan', label: 'Plan', icon: Hammer },
] as const;

// ── The Product Builder ─────────────────────────────────────────────────────

export default function ProductBuilder({
  userId,
  onHandedOff,
}: {
  userId: string;
  onHandedOff: (applicationId: string) => void;
}): React.JSX.Element {
  const [idea, setIdea] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('understanding');

  const start = useRequirementsStart();
  const list = useRequirementsList(userId);
  const sessionQuery = useRequirementsSession(userId, sessionId ?? 'none');
  const answer = useRequirementsAnswer();
  const acceptAll = useRequirementsAcceptAllDefaults();
  const decideDefault = useRequirementsDecideDefault();
  const resolveConflict = useRequirementsResolveConflict();
  const plan = useRequirementsPlan();
  const approve = useRequirementsApprove();
  const handoff = useRequirementsHandoffToFactory();

  const session = sessionQuery.data;
  const pending = [start, answer, acceptAll, plan, approve, handoff].some((m) => m.isPending);

  const autoTab = useMemo(() => {
    if (!session) return 'understanding';
    if (session.review) return 'plan';
    if ((session.defaults ?? []).some((d) => d.status === 'proposed')) return 'assumptions';
    if ((session.questionPlan?.all ?? []).some((q) => q.answer === undefined)) return 'questions';
    return 'understanding';
  }, [session]);

  useEffect(() => {
    if (session && !sessionId) return;
    setActiveTab(autoTab);
  }, [autoTab, session, sessionId]);

  const handleStart = (goal: string): void => {
    const trimmed = goal.trim();
    if (!trimmed) {
      setError('Describe the application you want to build — one or two sentences is enough.');
      return;
    }
    setError(null);
    setDraftAnswers({});
    void start
      .mutateAsync({ userId, idea: trimmed })
      .then((res) => {
        if (res.data?.sessionId) {
          setSessionId(res.data.sessionId);
          list.refetch().catch(() => {});
        } else {
          setError('The intelligence engine did not return a session.');
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to start the product conversation.');
      });
  };

  const handleAnswer = (): void => {
    if (!session) return;
    const open = (session.questionPlan?.all ?? []).filter((q) => q.answer === undefined);
    const answers = open
      .map((q) => ({ questionId: q.id, answer: draftAnswers[q.id] }))
      .filter(
        (a): a is { questionId: string; answer: string } =>
          typeof a.answer === 'string' && a.answer.trim().length > 0,
      );
    if (answers.length === 0) {
      setError('Answer at least one question — or answer all of them to move forward.');
      return;
    }
    setError(null);
    void answer
      .mutateAsync({ userId, sessionId: session.sessionId, answers })
      .then((res) => {
        if (res.data) {
          setDraftAnswers({});
          sessionQuery.refetch().catch(() => {});
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to record your answers.');
      });
  };

  const handleAcceptAll = (): void => {
    if (!session) return;
    void acceptAll
      .mutateAsync({ userId, sessionId: session.sessionId })
      .then(() => {
        sessionQuery.refetch().catch(() => {});
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to accept defaults.');
      });
  };

  const handleDecideDefault = (
    id: string,
    decision: 'accepted' | 'edited' | 'rejected',
    value?: string,
  ): void => {
    if (!session) return;
    void decideDefault
      .mutateAsync({
        userId,
        sessionId: session.sessionId,
        defaultId: id,
        decision,
        editedValue: value,
      })
      .then(() => {
        sessionQuery.refetch().catch(() => {});
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to decide the default.');
      });
  };

  const handleResolveConflict = (id: string, choice: string): void => {
    if (!session) return;
    void resolveConflict
      .mutateAsync({ userId, sessionId: session.sessionId, conflictId: id, choice })
      .then(() => {
        sessionQuery.refetch().catch(() => {});
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to resolve the conflict.');
      });
  };

  const handlePlan = (): void => {
    if (!session) return;
    void plan
      .mutateAsync({ userId, sessionId: session.sessionId })
      .then(() => {
        sessionQuery.refetch().catch(() => {});
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to generate the product plan.');
      });
  };

  const handleApprove = (): void => {
    if (!session) return;
    void approve
      .mutateAsync({ userId, sessionId: session.sessionId })
      .then(() => {
        sessionQuery.refetch().catch(() => {});
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to approve the plan.');
      });
  };

  const handleHandoff = (): void => {
    if (!session) return;
    void handoff
      .mutateAsync({ userId, sessionId: session.sessionId })
      .then((res) => {
        if (res.data?.applicationId) onHandedOff(res.data.applicationId);
        else setError('The factory did not return an application id.');
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Failed to hand off to the Application Factory.',
        );
      });
  };

  const renderTabContent = (): React.JSX.Element => {
    if (!session)
      return (
        <p className="text-xs text-slate-400">
          Start the conversation to build the intelligence panel.
        </p>
      );
    switch (activeTab) {
      case 'understanding':
        return <UnderstandingSection session={session} />;
      case 'requirements':
        return <RequirementsSection session={session} />;
      case 'questions':
        return (
          <QuestionsSection
            session={session}
            draftAnswers={draftAnswers}
            setDraftAnswers={setDraftAnswers}
            onSend={handleAnswer}
            submitting={answer.isPending}
          />
        );
      case 'assumptions':
        return (
          <DefaultsSection
            session={session}
            onAcceptAll={handleAcceptAll}
            onDecide={handleDecideDefault}
            submitting={acceptAll.isPending}
          />
        );
      case 'product':
        return (
          <div className="space-y-3">
            {session.brief ? (
              <>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  {session.brief.problem}
                </p>
                {kvList('Goals', session.brief.goals)}
                {kvList('Features', session.brief.features)}
                {kvList('Business rules', session.brief.businessRules)}
                {kvList('Data', session.brief.data)}
                {kvList('User journeys', session.brief.userJourneys)}
                {kvList('Success criteria', session.brief.successCriteria)}
                {kvList('Open questions', session.brief.openQuestions)}
              </>
            ) : (
              <p className="text-xs text-slate-400">
                The product brief appears once the plan is generated.
              </p>
            )}
          </div>
        );
      case 'design':
        return (
          <div className="space-y-3">
            {session.design ? (
              <>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {session.design.visualPersonality}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {session.design.targetAudience}
                  </p>
                </div>
                {kvList('Color system', session.design.colorSystem)}
                {kvList('Components', session.design.components)}
                {kvList('Interaction states', session.design.interactionStates)}
                {kvList('Empty / loading / error states', [
                  ...session.design.emptyStates,
                  ...session.design.loadingStates,
                  ...session.design.errorStates,
                ])}
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  <strong className="text-slate-600 dark:text-slate-300">Responsive:</strong>{' '}
                  {session.design.responsiveStrategy}
                </p>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  <strong className="text-slate-600 dark:text-slate-300">Accessibility:</strong>{' '}
                  {session.design.accessibility}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400">
                Design direction appears once the plan is generated.
              </p>
            )}
          </div>
        );
      case 'architecture':
        return (
          <div className="space-y-3">
            {session.architecture ? (
              <>
                {session.architecture.choices.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {c.layer}: {c.choice}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      why: {c.reason}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      alternative: {c.alternative}
                    </p>
                  </div>
                ))}
                {kvList('Observability', session.architecture.observability)}
                {kvList('Testing', session.architecture.testing)}
                {kvList(
                  'Complexity guard — deliberately avoided',
                  session.architecture.complexityGuard,
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400">
                Architecture appears once the plan is generated.
              </p>
            )}
          </div>
        );
      case 'ai':
        return (
          <div className="space-y-3">
            {session.aiStrategy ? (
              <>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Chip tone={session.aiStrategy.required ? 'blue' : 'neutral'}>
                      AI {session.aiStrategy.required ? 'required' : 'optional'}
                    </Chip>
                    {session.aiStrategy.ragRequired && <Chip tone="violet">RAG</Chip>}
                    {session.aiStrategy.toolCalling && <Chip tone="amber">tool calling</Chip>}
                    {session.aiStrategy.structuredOutput && (
                      <Chip tone="emerald">structured output</Chip>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-600 dark:text-slate-300">
                      Provider strategy:
                    </strong>{' '}
                    {session.aiStrategy.providerStrategy}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-600 dark:text-slate-300">Fallback:</strong>{' '}
                    {session.aiStrategy.fallback}
                  </p>
                </div>
                {session.aiStrategy.capabilities.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
                  >
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      {c.capability}
                    </p>
                    <p className="text-[10px] text-slate-400">{c.purpose}</p>
                  </div>
                ))}
                {session.ragStrategy?.required && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-500/30 dark:bg-violet-500/10">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                      RAG strategy
                    </p>
                    <p className="mt-1 text-[11px] text-violet-700 dark:text-violet-300/80">
                      {session.ragStrategy.retrievalStrategy}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {session.ragStrategy.groundingRequired && (
                        <Chip tone="violet">grounding required</Chip>
                      )}
                      {session.ragStrategy.evidenceRequired && (
                        <Chip tone="violet">evidence required</Chip>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400">
                AI strategy appears once the plan is generated.
              </p>
            )}
          </div>
        );
      case 'security':
        return (
          <div className="space-y-3">
            {session.security ? (
              <>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Authentication: {session.security.authentication}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Authorization: {session.security.authorization}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {session.security.roles.map((r) => (
                      <Chip key={r} tone="blue">
                        {r}
                      </Chip>
                    ))}
                  </div>
                </div>
                {kvList('Secrets', session.security.secrets)}
                {kvList('PII handling', session.security.pii)}
                {kvList('API security', session.security.apiSecurity)}
                {kvList('Audit & logging', [
                  ...session.security.audit,
                  ...session.security.logging,
                ])}
              </>
            ) : (
              <p className="text-xs text-slate-400">
                Security-by-design appears once the plan is generated.
              </p>
            )}
          </div>
        );
      case 'cost':
        return (
          <div className="space-y-3">
            {session.cost ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-700">
                    <p className="text-lg font-bold text-slate-800 dark:text-white">
                      ${session.cost.estimatedCostUsd.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-400">estimated cost</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-700">
                    <p className="text-lg font-bold text-slate-800 dark:text-white">
                      {(session.cost.totalTokens / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[10px] text-slate-400">tokens</p>
                  </div>
                </div>
                {kvList('Strategy', session.cost.strategy)}
                {kvList('Assumptions', session.cost.assumptions)}
              </>
            ) : (
              <p className="text-xs text-slate-400">
                Cost estimate appears once the plan is generated.
              </p>
            )}
          </div>
        );
      case 'plan':
        return (
          <div className="space-y-4">
            <ReviewSummary session={session} />
            {session.buildPlan && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Build plan
                </p>
                <div className="mt-1.5 space-y-1">
                  {session.buildPlan.steps.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 dark:border-slate-700"
                    >
                      <ChevronRight className="h-3 w-3 shrink-0 text-[#2B5FD9]" />
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">
                        {s.title}
                      </span>
                      <span className="ml-auto text-[10px] text-slate-400">{s.phase}</span>
                    </div>
                  ))}
                </div>
                {session.buildPlan.parallelWaves.length > 1 && (
                  <p className="mt-2 text-[10px] text-slate-400">
                    {session.buildPlan.parallelWaves.length} parallel waves · uses the EPIC-006 loop
                    engine: {session.buildPlan.usesLoopEngine ? 'yes' : 'no'}
                  </p>
                )}
              </div>
            )}
            <PlanSection
              session={session}
              onPlan={handlePlan}
              onApprove={handleApprove}
              onHandoff={handleHandoff}
              submitting={pending}
            />
          </div>
        );
      default:
        return <p className="text-xs text-slate-400">Select a panel.</p>;
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ── Conversation ── */}
      <div className="space-y-4">
        {!session && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#1E293B]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#2B5FD9] to-violet-500 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                  What do you want to build?
                </h2>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Describe the idea in plain words. VedMoulya acts as your product manager, business
                analyst, and solution architect: it understands the problem, extracts requirements
                with provenance, asks only the questions that matter, proposes safe defaults, and
                builds a complete product plan for your approval — before a single line of code is
                generated.
              </p>
              <textarea
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-relaxed dark:border-slate-600 dark:bg-[#0F172A] dark:text-slate-100"
                rows={4}
                value={idea}
                onChange={(e) => {
                  setIdea(e.target.value);
                  setError(null);
                }}
                placeholder='e.g. "Build me a modern restaurant application."'
              />
              {error && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {error}
                </p>
              )}
              <Button
                onClick={() => {
                  handleStart(idea);
                }}
                disabled={start.isPending}
                className="mt-3 w-full sm:w-auto"
              >
                {start.isPending ? (
                  <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                {start.isPending ? 'Understanding your idea…' : 'Start the product conversation'}
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#1E293B]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Try an example
              </h3>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => {
                      setIdea(ex.idea);
                      setError(null);
                    }}
                    className="rounded-xl border border-slate-200 p-2.5 text-left transition-colors hover:border-[#2B5FD9] hover:bg-[#2B5FD9]/5 dark:border-slate-700"
                  >
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      {ex.label}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-400">{ex.idea}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {session && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#1E293B]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#2B5FD9] to-violet-500 text-white">
                <MessageSquareText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                  {session.idea}
                </p>
                <p className="text-[10px] text-slate-400">{session.sessionId}</p>
              </div>
              <PhasePill phase={session.phase} />
            </div>

            <div className="mt-4 space-y-4">
              {session.intent && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Here is what I understand
                  </p>
                  <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                    {session.intent.problem}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip tone="blue">{session.intent.archetype}</Chip>
                    {session.intent.explicit.slice(0, 3).map((c) => (
                      <Chip key={c.label} tone="emerald">
                        {c.label}
                        {c.value ? `: ${c.value}` : ''}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              <ConflictSection session={session} onResolve={handleResolveConflict} />

              {(session.phase === 'UNDERSTANDING' || session.phase === 'QUESTIONS') && (
                <QuestionsSection
                  session={session}
                  draftAnswers={draftAnswers}
                  setDraftAnswers={setDraftAnswers}
                  onSend={handleAnswer}
                  submitting={answer.isPending}
                />
              )}

              {session.phase === 'DEFAULTS' && (
                <DefaultsSection
                  session={session}
                  onAcceptAll={handleAcceptAll}
                  onDecide={handleDecideDefault}
                  submitting={acceptAll.isPending}
                />
              )}

              <PlanSection
                session={session}
                onPlan={handlePlan}
                onApprove={handleApprove}
                onHandoff={handleHandoff}
                submitting={pending}
              />

              {error && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Existing sessions — resume */}
        {(list.data?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#1E293B]">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-[#2B5FD9]" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Your product conversations
              </h3>
            </div>
            <div className="mt-2 space-y-1.5">
              {list.data?.map((s) => (
                <button
                  key={s.sessionId}
                  onClick={() => {
                    setSessionId(s.sessionId);
                    setError(null);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left transition-colors hover:border-[#2B5FD9] dark:border-slate-700"
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                    {s.idea}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <PhasePill phase={s.phase} />
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Progressive intelligence panel ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#1E293B] lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2B5FD9]/10 text-[#2B5FD9]">
              <Compass className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
              Product intelligence
            </h3>
          </div>
          {session && <PhasePill phase={session.phase} />}
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Everything VedMoulya understands, infers, asks, assumes, and plans — with provenance.
          Never silent, never faked.
        </p>

        {/* Tab bar */}
        <div className="mt-4 flex flex-wrap gap-1">
          {PANEL_TABS.map((tab) => {
            const Icon = tab.icon;
            const available = session !== undefined;
            const hasData =
              (tab.id === 'understanding' && Boolean(session?.intent)) ||
              (tab.id === 'requirements' && Boolean(session?.requirements)) ||
              (tab.id === 'questions' && Boolean(session?.questionPlan)) ||
              (tab.id === 'assumptions' && Boolean(session?.defaults)) ||
              (tab.id === 'product' && Boolean(session?.brief)) ||
              (tab.id === 'design' && Boolean(session?.design)) ||
              (tab.id === 'architecture' && Boolean(session?.architecture)) ||
              (tab.id === 'ai' && Boolean(session?.aiStrategy)) ||
              (tab.id === 'security' && Boolean(session?.security)) ||
              (tab.id === 'cost' && Boolean(session?.cost)) ||
              (tab.id === 'plan' && Boolean(session?.review));
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                }}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#2B5FD9] text-white'
                    : hasData
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      : 'text-slate-300 dark:text-slate-600'
                }`}
                disabled={!available}
                title={hasData ? tab.label : `${tab.label} (unlocks as the plan progresses)`}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">{renderTabContent()}</div>
      </div>
    </div>
  );
}
