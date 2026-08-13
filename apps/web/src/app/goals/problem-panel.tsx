// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Problem Understanding Panel (SPRINT-023)
//
// The front door of the problem→outcome flow: the user states a problem in
// plain language and VedMoulya shows WHAT IT UNDERSTOOD (intent · domain ·
// desired outcome · constraints · missing information · approval
// requirements · success criteria). It deliberately surfaces the OUTCOME
// vocabulary — not engine names or provider mechanics.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Button, TextField, Loading } from '@vedmoulya/ui';
import {
  Lightbulb,
  Target,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { OUTCOME_VERDICTS, OUTCOME_VERDICT_LABELS } from '@vedmoulya/brain';
import type { OutcomeVerdict } from '@vedmoulya/brain';
import { useGoalsUnderstandProblem } from '../../lib/api-client.js';

// ── SPRINT-024 — the honest outcome contract ────────────────────────
// Plain-language reporting states: "Task completed" is never shown merely
// because a provider returned a completion message — every result is
// checked against the REAL evidence first, and the outcome state below is
// what the user actually sees.
const JOURNEY_STEPS: ReadonlyArray<{ label: string; detail: string }> = [
  { label: 'Problem', detail: 'What you asked for' },
  { label: 'Planned', detail: 'What VedMoulya planned' },
  { label: 'Did', detail: 'What it actually did' },
  { label: 'Evidence', detail: 'The real artifact / result' },
  { label: 'Verification', detail: 'Independent checks' },
  { label: 'Outcome', detail: 'The honest result' },
];

const VERDICT_COLORS: Record<OutcomeVerdict, string> = {
  SUCCESS: 'bg-emerald-500',
  FAILED: 'bg-red-500',
  UNKNOWN: 'bg-zinc-500',
  AWAITING_APPROVAL: 'bg-amber-500',
  CANCELLED: 'bg-zinc-500',
  BUDGET_EXHAUSTED: 'bg-orange-500',
};

function OutcomeContractStrip(): React.JSX.Element {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
        From problem to a verified outcome
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {JOURNEY_STEPS.map((step, idx) => (
          <React.Fragment key={step.label}>
            <span className="rounded-md bg-zinc-800/80 px-2 py-1 text-[11px] font-medium text-zinc-200">
              {step.label}
              <span className="ml-1.5 hidden text-[10px] font-normal text-zinc-500 sm:inline">
                {step.detail}
              </span>
            </span>
            {idx < JOURNEY_STEPS.length - 1 && (
              <ArrowRight className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
        {OUTCOME_VERDICTS.map((verdict) => (
          <span key={verdict} className="flex items-center gap-1.5 text-[11px] text-zinc-300">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${VERDICT_COLORS[verdict]}`}
              aria-hidden
            />
            {OUTCOME_VERDICT_LABELS[verdict]}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Honesty rule: a provider saying “done” is never proof of success. “Completed — verified” is
        shown only after the real artifact passes independent checks; otherwise the result stays
        “Waiting for your approval”, “Could not complete safely”, or “Result could not be
        determined” — never a fabricated success.
      </p>
    </div>
  );
}

const INTENT_COLORS: Record<string, 'blue' | 'green' | 'amber' | 'gray'> = {
  ANSWER: 'blue',
  ACTION: 'green',
  OUTCOME: 'amber',
  UNKNOWN: 'gray',
};

const INTENT_LABELS: Record<string, string> = {
  ANSWER: 'Answer',
  ACTION: 'Action',
  OUTCOME: 'Outcome',
  UNKNOWN: 'Needs clarification',
};

export function ProblemPanel({ userId }: { userId: string }): React.JSX.Element {
  const [problem, setProblem] = useState('');
  const [submitted, setSubmitted] = useState('');
  const { data, isLoading, isError, refetch } = useGoalsUnderstandProblem(userId, submitted);

  const analyze = (e: React.SyntheticEvent): void => {
    e.preventDefault();
    if (problem.trim().length < 5) return;
    setSubmitted(problem.trim());
  };

  return (
    <Card>
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
        <div>
          <h2 className="font-semibold text-zinc-100">What do you want to accomplish?</h2>
          <p className="text-sm text-zinc-400">
            Describe a problem, task, or goal in plain language. VedMoulya will show what it
            understood before anything runs.
          </p>
        </div>
      </div>

      <form onSubmit={analyze} className="mt-4 flex flex-col gap-3">
        <TextField
          value={problem}
          onChange={(e) => {
            setProblem(e.target.value);
          }}
          placeholder="e.g. Automate my daily Excel report before Friday, without sharing the data externally"
          aria-label="Your problem"
        />
        <div>
          <Button type="submit" disabled={problem.trim().length < 5 || isLoading}>
            {isLoading ? <Loading label="Understanding…" /> : 'Understand'}
          </Button>
        </div>
      </form>

      {isError && submitted && (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          Could not understand the problem. Try again.
          <button className="ml-2 underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}

      {data && (
        <div className="mt-5 space-y-4 border-t border-zinc-800 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={INTENT_COLORS[data.intent] ?? 'gray'}>
              {INTENT_LABELS[data.intent] ?? data.intent}
            </Badge>
            <Badge color="gray">{data.domain}</Badge>
            <Badge color="gray">urgency {Math.round(data.urgency * 100)}%</Badge>
            <Badge color={data.confidence >= 0.6 ? 'green' : 'amber'}>
              understanding {Math.round(data.confidence * 100)}%
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md bg-zinc-900/60 p-3">
              <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <Target className="h-3.5 w-3.5" aria-hidden /> Desired outcome
              </p>
              <p className="mt-1 text-sm text-zinc-200">{data.desiredOutcome}</p>
            </div>
            <div className="rounded-md bg-zinc-900/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Required capabilities
              </p>
              <p className="mt-1 text-sm text-zinc-200">
                {data.requiredCapabilities.length > 0
                  ? data.requiredCapabilities.join(' · ')
                  : 'Not determined from the request'}
              </p>
            </div>
          </div>

          {data.constraints.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Constraints
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.constraints.map((c) => (
                  <Badge key={c.kind} color="gray">
                    {c.kind}: {c.value}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {data.successCriteria.length > 0 && (
            <div>
              <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Success criteria
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-zinc-300">
                {data.successCriteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {data.approvalRequirements.length > 0 && (
            <div>
              <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Approval will be required
              </p>
              <ul className="mt-1 space-y-1 text-sm text-zinc-300">
                {data.approvalRequirements.map((a) => (
                  <li key={a.action}>
                    {a.action} — {a.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.missingInformation.length > 0 && (
            <div>
              <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <HelpCircle className="h-3.5 w-3.5" aria-hidden /> Needed to proceed
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-zinc-400">
                {data.missingInformation.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SPRINT-024 — the honest outcome contract: how VedMoulya reports results. */}
          <OutcomeContractStrip />
        </div>
      )}
    </Card>
  );
}
