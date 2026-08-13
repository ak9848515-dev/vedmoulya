// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Orchestrated AI Loop Engine
// EPIC-006 — Phase 15. The execution experience.
// Shows: Goal ↓ Plan ↓ Current task ↓ AI specialist ↓ Evidence ↓ Critique ↓
// Iteration ↓ Result — answering "WHY is VedMoulya doing this?" without
// exposing raw model internals. Every run is bounded (six hard budgets) and
// always ends with an explicit termination reason.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Card, Loading, Button } from '@vedmoulya/ui';
import {
  Rocket,
  Target,
  GitBranch,
  User,
  ShieldCheck,
  Scale,
  RefreshCw,
  Square,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Coins,
  Cpu,
  ListTree,
} from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import {
  useLoopStart,
  useLoopStatus,
  useLoopTrace,
  useLoopCancel,
  useLoopResume,
  useLoopPatterns,
  useLoopRuns,
} from '../../lib/api-client.js';
import type { LoopRunDTO, LoopTraceStep, LoopTask } from '@vedmoulya/loop-engine';
// Deep imports only — the loop-engine index pulls @vedmoulya/core → health →
// node:os into the client bundle (CERT-002 class). The catalog module is pure
// data + pure functions, safe for the browser bundle.
import { specialistLabel, patternLabel } from '@vedmoulya/loop-engine/catalog/loop-catalog';

const EXAMPLES = [
  {
    id: 'abap',
    label: 'ABAP Debugger Assistant',
    goal: 'My ABAP program dumps with a runtime error "FIELD-SYMBOL_ASSIGNMENT" at line 47. LOOP AT gt_items ASSIGNING FIELD-SYMBOL(<fs_row>), then READ TABLE gt_lookup WITH KEY id = <fs_row>-id ASSIGNING <fs_other>. Inside, MOVE-CORRESPONDING <fs_other> TO <fs_row>. It crashes when a key is missing. Diagnose the issue and produce corrected ABAP code with a static validation pass.',
  },
  {
    id: 'restaurant',
    label: 'Restaurant App Builder',
    goal: 'Build a modern restaurant application with online ordering, table reservations, a menu manager, and an admin dashboard.',
  },
  {
    id: 'ai-app',
    label: 'AI Application Builder',
    goal: 'Build an AI application that lets small business owners summarize their customer feedback and generate weekly insight reports.',
  },
] as const;

type ToneName = 'good' | 'warn' | 'bad' | 'info';

interface TerminationTone {
  label: string;
  tone: ToneName;
}

const TERMINATION_TONE: Record<string, TerminationTone> = {
  SUCCESS: { label: 'Completed successfully', tone: 'good' },
  BUDGET_EXCEEDED: { label: 'Stopped: budget exhausted', tone: 'warn' },
  ITERATION_LIMIT: { label: 'Stopped: iteration limit reached', tone: 'warn' },
  TIMEOUT: { label: 'Stopped: timeout', tone: 'warn' },
  EVIDENCE_INSUFFICIENT: { label: 'Stopped: insufficient evidence', tone: 'bad' },
  EVIDENCE_CONFLICT: { label: 'Stopped: conflicting evidence', tone: 'bad' },
  SECURITY_BLOCK: { label: 'Blocked: security policy', tone: 'bad' },
  TOOL_FAILURE: { label: 'Stopped: tool failure', tone: 'bad' },
  PROVIDER_FAILURE: { label: 'Stopped: provider failure', tone: 'bad' },
  VALIDATION_FAILURE: { label: 'Stopped: validation failure', tone: 'bad' },
  USER_CLARIFICATION_REQUIRED: { label: 'Clarification required', tone: 'info' },
  CANCELLED: { label: 'Cancelled', tone: 'info' },
};

function toneClass(tone: 'good' | 'warn' | 'bad' | 'info'): string {
  switch (tone) {
    case 'good':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30';
    case 'warn':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30';
    case 'bad':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30';
    case 'info':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30';
  }
}

function fmtTokens(n: number | undefined): string {
  return n === undefined ? '—' : n.toLocaleString();
}

function fmtCost(n: number | undefined): string {
  return n === undefined ? '—' : `$${n.toFixed(4)}`;
}

function fmtLatency(n: number | undefined): string {
  if (n === undefined) return '—';
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

function phaseIcon(phase: LoopTraceStep['status']): React.ReactNode {
  switch (phase) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'abstained':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'blocked':
    case 'failed':
      return <AlertTriangle className="h-4 w-4 text-rose-500" />;
    default:
      return <RefreshCw className="h-4 w-4 text-slate-400" />;
  }
}

// ── Trace Timeline: the explainable execution trace ─────────────────────────

function TraceTimeline({ steps }: { steps: LoopTraceStep[] }): React.JSX.Element {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No steps recorded yet — the loop is still planning its first wave.
      </p>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-700">
      {steps.map((step, i) => (
        <li key={`${step.taskId}-${i}`} className="relative">
          <span className="absolute -left-[26px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-[#0F172A]">
            {phaseIcon(step.status)}
          </span>
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#1E293B]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {step.title}
                </span>
              </div>
              <span className="text-[11px] font-medium text-[#2B5FD9]">
                {specialistLabel(step.capability)}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {step.message}
            </p>
            {step.selectionReason && (
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                <span className="font-medium">Why this specialist:</span> {step.selectionReason}
              </p>
            )}
            {step.evidenceState && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                <Scale className="h-3 w-3" />
                evidence: {step.evidenceState}
              </span>
            )}
            {step.refinementAction && (
              <span className="mt-2 ml-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <RefreshCw className="h-3 w-3" />
                refine: {step.refinementAction.replaceAll('_', ' ')}
              </span>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Coins className="h-3 w-3" />
                {fmtTokens(step.tokens.total)} tokens
              </span>
              <span className="inline-flex items-center gap-1">{fmtCost(step.costUsd)}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {fmtLatency(step.latencyMs)}
              </span>
              {step.provider && step.provider !== 'none' && (
                <span className="inline-flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  {step.provider}/{step.model}
                </span>
              )}
              {step.toolCalls > 0 && (
                <span className="inline-flex items-center gap-1">
                  🔧 {step.toolCalls} tool call(s)
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Plan View: the typed task graph ─────────────────────────────────────────

function PlanView({ run }: { run: LoopRunDTO }): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {run.graph.entryTaskIds.map((id) => (
          <span
            key={id}
            className="rounded-full bg-[#2B5FD9]/10 px-2.5 py-1 text-[11px] font-semibold text-[#2B5FD9]"
          >
            start: {run.graph.tasks.find((t) => t.taskId === id)?.title}
          </span>
        ))}
      </div>
      {run.graph.tasks.map((task: LoopTask) => (
        <div key={task.taskId} className="flex items-start gap-2">
          <span className="mt-1 text-[11px] font-mono font-semibold text-slate-400">
            {task.taskId.replace('task-', 'T')}
          </span>
          <div className="flex-1 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {task.title}
              </span>
              <span className="text-[11px] font-medium text-[#7C3AED]">
                {specialistLabel(task.capability)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.description}</p>
            {task.dependencies.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                depends on: {task.dependencies.map((d) => d.replace('task-', 'T')).join(', ')}
              </p>
            )}
            {task.parallelEligible && (
              <span className="mt-1.5 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                parallel eligible
              </span>
            )}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-400">
        Graph validated: {run.graph.validated ? 'yes' : 'no'} · {run.graph.tasks.length} tasks
      </p>
    </div>
  );
}

// ── Spec View: the typed GoalSpecification (Phase 1) ────────────────────────

function SpecView({ run }: { run: LoopRunDTO }): React.JSX.Element {
  const spec = run.specification;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Objective
        </p>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{spec.objective}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Required capabilities
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {spec.requiredCapabilities.map((cap) => (
              <span
                key={cap}
                className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
              >
                {specialistLabel(cap)}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Evidence requirements
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            {spec.evidenceRequirements.map((ev, i) => (
              <li key={i}>
                <span className="font-medium text-slate-600 dark:text-slate-300">{ev.reason}</span>{' '}
                · {ev.groundingRequired ? 'grounding required' : 'optional'}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Success criteria
        </p>
        <ul className="mt-1.5 space-y-1 text-xs text-slate-500 dark:text-slate-400">
          {spec.successCriteria.map((c) => (
            <li key={c.criterionId} className="flex items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 text-emerald-500" />
              {c.description}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          risk: {spec.riskLevel}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          tier: {spec.qualityTier}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          max iterations: {spec.maxIterations}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          pattern: {patternLabel(spec.pattern)}
        </span>
      </div>
      {spec.derivationReasons.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Why this interpretation
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-500 dark:text-slate-400">
            {spec.derivationReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Result View: final content + critic verdict + memory proposals ──────────

function ResultView({ run }: { run: LoopRunDTO }): React.JSX.Element | null {
  const tone = terminationTone(run.terminationReason);
  if (run.status === 'suspended' && run.terminationReason === 'USER_CLARIFICATION_REQUIRED') {
    return null; // handled by the resume panel in the page
  }
  return (
    <div className="space-y-4">
      <div className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${toneClass(tone.tone)}`}>
        {tone.label}
        {run.terminationReason ? ` — ${run.terminationReason}` : ''}
      </div>
      {run.finalCritic && (
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Critic verdict: {run.finalCritic.verdict}
            </span>
            <span className="text-xs text-slate-400">
              {Math.round(run.finalCritic.score * 100)}% of checks passed
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {run.finalCritic.checks.slice(0, 6).map((check, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400"
              >
                {check.passed ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 text-emerald-500" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3 w-3 text-amber-500" />
                )}
                <span>
                  <span className="font-medium">{check.name}:</span> {check.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {run.finalContent && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1E293B]">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {run.finalContent}
          </pre>
        </div>
      )}
      {run.proposedMemories.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Proposed memory (requires your approval — never written automatically)
          </p>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            {run.proposedMemories[0]?.content}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Run Panel: live execution experience ────────────────────────────────────

function RunPanel({
  userId,
  runId,
  onClear,
  onResumed,
}: {
  userId: string;
  runId: string;
  onClear: () => void;
  onResumed: (newRunId: string) => void;
}): React.JSX.Element {
  const [polling, setPolling] = useState(true);
  const trace = useLoopTrace(userId, runId, polling ? 1200 : 0);
  const run = trace.data;
  // Stop polling once the run reaches a terminal status (also when it needs
  // clarification — the resume action refetches explicitly).
  useEffect(() => {
    if (
      run &&
      (run.status === 'completed' ||
        run.status === 'cancelled' ||
        run.status === 'failed' ||
        run.status === 'suspended')
    ) {
      setPolling(false);
    }
  }, [run?.status]);

  const status = useLoopStatus(userId, runId, polling ? 1200 : 0);
  const cancelMutation = useLoopCancel();
  const resumeMutation = useLoopResume();
  const [clarification, setClarification] = useState('');

  const isActive = run?.status === 'pending' || run?.status === 'running';
  const needsClarification = run?.status === 'suspended';

  if (!run) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading execution trace…" size="lg" />
      </div>
    );
  }

  const tone = terminationTone(run.terminationReason);

  return (
    <div className="space-y-6">
      {/* Header: run identity + budget snapshot */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[#2B5FD9]" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Run {run.runId}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isActive ? 'bg-[#2B5FD9]/10 text-[#2B5FD9]' : toneClass(tone.tone)
            }`}
          >
            {run.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void cancelMutation.mutateAsync({ userId, runId }).then(() => {
                  void trace.refetch();
                });
              }}
            >
              <Square className="mr-1 h-3.5 w-3.5" />
              Cancel run
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClear}>
            New goal
          </Button>
        </div>
      </div>

      {/* Budget snapshot */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <BudgetCell
          label="Iterations"
          value={`${run.budgetUsage.iterations}/${run.budgetConfig.maxIterations}`}
        />
        <BudgetCell
          label="Tokens"
          value={`${fmtTokens(run.budgetUsage.tokensTotal)}/${fmtTokens(run.budgetConfig.maxTokens)}`}
        />
        <BudgetCell
          label="Cost"
          value={`${fmtCost(run.budgetUsage.costUsd)}/${fmtCost(run.budgetConfig.maxCostUsd)}`}
        />
        <BudgetCell
          label="Latency"
          value={`${fmtLatency(run.budgetUsage.latencyMs)}/${fmtLatency(run.budgetConfig.maxLatencyMs)}`}
        />
        <BudgetCell
          label="Provider calls"
          value={`${run.budgetUsage.providerCalls}/${run.budgetConfig.maxProviderCalls}`}
        />
        <BudgetCell
          label="Tool calls"
          value={`${run.budgetUsage.toolCalls}/${run.budgetConfig.maxToolCalls}`}
        />
      </div>

      {/* Resume panel for suspended runs (Phase 12/14) */}
      {needsClarification && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/30 dark:bg-sky-500/10">
          <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">
            {run.finalCritic?.reasons[0] ?? 'This goal needs clarification before we continue.'}
          </p>
          <textarea
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-600 dark:bg-[#0F172A] dark:text-slate-100"
            rows={2}
            value={clarification}
            onChange={(e) => {
              setClarification(e.target.value);
            }}
            placeholder="Add the missing requirement or detail…"
          />
          <Button
            className="mt-2"
            size="sm"
            disabled={resumeMutation.isPending || !clarification.trim()}
            onClick={() => {
              void resumeMutation.mutateAsync({ userId, runId, clarification }).then((res) => {
                const dto = res as unknown as { data?: { runId?: string } };
                if (dto.data?.runId && dto.data.runId !== runId) {
                  onResumed(dto.data.runId);
                } else {
                  void trace.refetch();
                  void status.refetch();
                }
              });
            }}
          >
            <Play className="mr-1 h-3.5 w-3.5" />
            Resume with clarification
          </Button>
        </div>
      )}

      {/* Evidence states */}
      {run.evidenceStates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Evidence
          </span>
          {run.evidenceStates.map((state, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
            >
              <Scale className="h-3 w-3" />
              {state}
            </span>
          ))}
        </div>
      )}

      {/* Sections */}
      <section>
        <SectionHeading
          icon={<Target className="h-4 w-4" />}
          title="Interpretation (GoalSpecification)"
        />
        <Card className="p-5 dark:bg-[#1E293B]">
          <SpecView run={run} />
        </Card>
      </section>

      <section>
        <SectionHeading icon={<ListTree className="h-4 w-4" />} title="Plan (TaskGraph)" />
        <Card className="p-5 dark:bg-[#1E293B]">
          <PlanView run={run} />
        </Card>
      </section>

      <section>
        <SectionHeading icon={<GitBranch className="h-4 w-4" />} title="Execution trace" />
        <Card className="p-5 dark:bg-[#1E293B]">
          <TraceTimeline steps={run.steps} />
        </Card>
      </section>

      <section>
        <SectionHeading icon={<CheckCircle2 className="h-4 w-4" />} title="Result" />
        <Card className="p-5 dark:bg-[#1E293B]">
          <ResultView run={run} />
        </Card>
      </section>
    </div>
  );
}

function BudgetCell({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center dark:border-slate-700 dark:bg-[#1E293B]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}): React.JSX.Element {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-[#2B5FD9]">{icon}</span>
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
    </div>
  );
}

// ── Start Panel: goal input + template presets ──────────────────────────────

function StartPanel({
  userId,
  onStarted,
}: {
  userId: string;
  onStarted: (runId: string) => void;
}): React.JSX.Element {
  const startMutation = useLoopStart();
  const patterns = useLoopPatterns(userId);
  const runs = useLoopRuns(userId);
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStart = (): void => {
    if (!goal.trim()) {
      setError('Describe the goal you want VedMoulya to solve.');
      return;
    }
    setError(null);
    void startMutation
      .mutateAsync({ userId, goal: goal.trim() })
      .then((res) => {
        const dto = res as unknown as { data?: { runId?: string } };
        if (dto.data?.runId) onStarted(dto.data.runId);
        else setError('The loop did not return a run id.');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to start the loop.');
      });
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 dark:bg-[#1E293B]">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Describe a complex goal
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          VedMoulya will understand the goal, decompose it into a typed task graph, assign each task
          to an AI specialist through the runtime, evaluate the work with an explicit critic, and
          refine — bounded by hard token, cost, latency, iteration, provider and tool budgets. Every
          run ends with an explicit termination reason.
        </p>
        <textarea
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-[#0F172A] dark:text-slate-100"
          rows={4}
          value={goal}
          onChange={(e) => {
            setGoal(e.target.value);
          }}
          placeholder='e.g. "Build an ABAP debugger that diagnoses this dump and returns corrected code…"'
        />
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={handleStart} disabled={startMutation.isPending}>
            {startMutation.isPending ? (
              <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-1 h-4 w-4" />
            )}
            Start orchestrated loop
          </Button>
          <span className="text-[11px] text-slate-400">bounded · evidence-first · explainable</span>
        </div>
      </Card>

      <Card className="p-5 dark:bg-[#1E293B]">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Controlled demonstrations
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Three templates the catalog recognizes deterministically. The architecture stays generic —
          these are declarative templates, not special-case code.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              className="rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-[#2B5FD9] hover:bg-[#2B5FD9]/5 dark:border-slate-700"
              onClick={() => {
                setGoal(ex.goal);
              }}
            >
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{ex.label}</p>
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {ex.goal}
              </p>
            </button>
          ))}
        </div>
        {(patterns.data?.length ?? 0) > 0 && (
          <p className="mt-3 text-[11px] text-slate-400">
            Recognized patterns: {patterns.data?.map((p) => p.label).join(' · ')}
          </p>
        )}
      </Card>

      {(runs.data?.length ?? 0) > 0 && (
        <Card className="p-5 dark:bg-[#1E293B]">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#2B5FD9]" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Recent runs
            </h2>
          </div>
          <div className="mt-3 space-y-2">
            {runs.data?.slice(0, 6).map((run) => (
              <button
                key={run.runId}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left transition-colors hover:border-[#2B5FD9] dark:border-slate-700"
                onClick={() => {
                  onStarted(run.runId);
                }}
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                  {run.goal}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                    {run.status}
                  </span>
                  {run.terminationReason && (
                    <span className="text-slate-400">{run.terminationReason}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/** Resolve a termination tone safely (terminationReason may be absent mid-run). */
function terminationTone(reason: LoopRunDTO['terminationReason']): TerminationTone {
  const fallback: TerminationTone = { label: 'Stopped', tone: 'info' };
  return TERMINATION_TONE[reason ?? ''] ?? fallback;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function LoopPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    setActiveSection('loop');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'AI Loop Engine' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse text-lg font-semibold text-slate-500">
          Loading AI Loop Engine…
        </div>
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  return (
    <div className="content-container py-6">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-[#2B5FD9]">
          <GitBranch className="h-4 w-4" />
          EPIC-006 · Orchestrated AI Loop Engine
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">AI Loop Engine</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
          Controlled, measurable, evidence-first orchestration. A complex goal is understood,
          decomposed into a typed task graph, assigned to AI specialists through the AI runtime
          (never provider SDKs), critiqued and refined — bounded by six hard budgets, with an
          explicit termination reason on every run. VedMoulya decides WHO should do WHAT, WHY, WHAT
          evidence is required, WHETHER the result is good enough, WHAT must be corrected, and WHEN
          the process must stop.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> always bounded
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5 text-[#2B5FD9]" /> specialist selection via AI-SELECT
          </span>
          <span className="inline-flex items-center gap-1">
            <Scale className="h-3.5 w-3.5 text-violet-500" /> evidence-first grounding
          </span>
        </div>
      </header>

      {runId ? (
        <RunPanel
          key={runId}
          userId={userId}
          runId={runId}
          onClear={() => {
            setRunId(null);
          }}
          onResumed={(nextRunId) => {
            setRunId(nextRunId);
          }}
        />
      ) : (
        <StartPanel
          userId={userId}
          onStarted={(id) => {
            setRunId(id);
          }}
        />
      )}
    </div>
  );
}
