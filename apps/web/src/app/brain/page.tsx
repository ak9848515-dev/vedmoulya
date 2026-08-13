// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — The VedMoulya Brain
// EPIC-016 — central intelligence & orchestration coordinator.
//
// The Brain understands an objective, plans capabilities (EPIC-013), selects
// N providers with roles (quality-first), executes through the frozen runtime,
// verifies, synthesizes and explains every decision — gated on explicit user
// approval for sensitive actions. Nothing is faked: unavailable capabilities
// are honest hand-offs, provider failures are recorded, budgets fail closed,
// and every decision row shows WHY / selected / alternatives / evidence.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import {
  BrainCircuit,
  Loader2,
  Wand2,
  AlertTriangle,
  Sparkles,
  ScrollText,
  ArrowRight,
  Ban,
  CheckCircle2,
  XCircle,
  History,
  Play,
} from 'lucide-react';
import { api } from '../../lib/trpc.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
  useBrainCreateTask,
  useBrainPlan,
  useBrainSelectResources,
  useBrainExecute,
  useBrainVerify,
  useBrainRequestApproval,
  useBrainApprove,
  useBrainReject,
  useBrainCancel,
  useBrainEvaluateOutcome,
  useBrainListTasks,
} from '../../lib/api-client.js';
import type { BrainTask } from '@vedmoulya/brain';
import {
  BrainStageRail,
  BrainTaskMeta,
  BrainIntentPanel,
  BrainProviderAssignments,
  BrainBudgetPanel,
  BrainApprovalPanel,
  BrainVerificationPanel,
  BrainSynthesisPanel,
  BrainOutputsPanel,
  BrainDecisionRecordsPanel,
  BrainSectionHeading,
  BrainTimestamps,
} from './brain-panels.js';
import { formatDateTime, nextStepOf, nextStepLabel, type PipelineStep } from './brain-ui.js';
import { BrainOperationsSection } from './brain-dashboard.js';

const EXAMPLES = [
  {
    label: 'Blog post',
    outcome: 'Write a high-quality blog post about AI productivity for professionals',
  },
  {
    label: 'Research brief',
    outcome: 'Research the current state of open-source local LLMs and summarize the best options',
  },
  {
    label: 'Video script',
    outcome: 'Create a professional script for a 2-minute explainer video about renewable energy',
  },
  {
    label: 'Competitor analysis',
    outcome: 'Analyze the competitive landscape for a small business SaaS pricing strategy',
  },
];

export default function BrainPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();

  const [objective, setObjective] = useState('');
  const [task, setTask] = useState<BrainTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'create' | PipelineStep>(null);
  // Synchronous in-flight guard: React state updates are async, so a rapid
  // double-click on Run/Continue could otherwise launch two concurrent chains
  // against the same task (duplicated role assignments / outputs).
  const inFlight = useRef(false);

  const createTask = useBrainCreateTask();
  const planTask = useBrainPlan();
  const selectResources = useBrainSelectResources();
  const executeTask = useBrainExecute();
  const verifyTask = useBrainVerify(userId, task?.id ?? '');
  const requestApprovalAction = useBrainRequestApproval();
  const approveAction = useBrainApprove();
  const rejectAction = useBrainReject();
  const cancelTask = useBrainCancel();
  const evaluateOutcome = useBrainEvaluateOutcome();
  const history = useBrainListTasks(userId);
  const utils = api.useUtils();

  useEffect(() => {
    setActiveSection('brain');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'VedMoulya Brain' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  // ── Guards ────────────────────────────────────────────────────────────
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading the VedMoulya Brain..." size="lg" />
      </div>
    );
  }
  if (!user) {
    return <SignInRedirect />;
  }

  // Never surface raw service internals in the UI (EPIC-016 §21). The
  // capability-marketplace page follows the same generic-message convention.
  function errorMessage(_e: unknown): string {
    return 'The Brain could not complete that step right now. Check that providers are configured in the Provider Registry, then try again.';
  }

  // ── Pipeline steps ────────────────────────────────────────────────────
  async function createStep(input: string): Promise<BrainTask> {
    setBusy('create');
    const res = await createTask.mutateAsync({ userId, input });
    const next = (res as { data?: BrainTask }).data;
    if (!next) throw new Error('The Brain could not create the task.');
    setTask(next);
    // Refresh the Recent-tasks list with the new task.
    void utils.brain.listTasks.invalidate();
    return next;
  }

  async function planStep(current: BrainTask): Promise<BrainTask> {
    setBusy('plan');
    const res = await planTask.mutateAsync({ userId, taskId: current.id });
    const next = (res as { data?: BrainTask }).data;
    if (!next) throw new Error('Capability planning did not return a task.');
    setTask(next);
    return next;
  }

  async function resourcesStep(current: BrainTask): Promise<BrainTask> {
    setBusy('selectResources');
    const res = await selectResources.mutateAsync({ userId, taskId: current.id });
    const next = (res as { data?: BrainTask }).data;
    if (!next) throw new Error('Provider selection did not return a task.');
    setTask(next);
    return next;
  }

  async function executeStep(current: BrainTask): Promise<BrainTask> {
    setBusy('execute');
    const res = await executeTask.mutateAsync({ userId, taskId: current.id });
    const next = (res as { data?: BrainTask }).data;
    if (!next) throw new Error('Execution did not return a task.');
    setTask(next);
    return next;
  }

  async function verifyStep(): Promise<void> {
    setBusy('verify');
    const res = await verifyTask.refetch();
    if (res.isError) {
      setError('Verification could not be completed right now. Please try again.');
      return;
    }
    const envelope = res.data as { data?: BrainTask } | undefined;
    if (envelope?.data) {
      setTask(envelope.data);
    } else {
      setError(
        'Verification returned no result — the pipeline is complete up to the last recorded stage.',
      );
    }
  }

  async function runFull(target?: string): Promise<void> {
    // Examples set objective state AND run immediately — the run must read the
    // explicit target (the state closure would still be the previous value).
    const input = (target ?? objective).trim();
    if (busy || inFlight.current || input.length < 3) return;
    inFlight.current = true;
    setError(null);
    try {
      let current = await createStep(input);
      current = await planStep(current);
      current = await resourcesStep(current);
      current = await executeStep(current);
      if (current.status !== 'CANCELLED' && current.status !== 'FAILED') {
        await verifyStep();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  /** Advance a single stage from the current task (progressive disclosure). */
  async function continueFrom(current: BrainTask): Promise<void> {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const step = nextStepOf(current);
      if (step === 'plan') {
        const next = await planStep(current);
        await continueFrom(next);
      } else if (step === 'selectResources') {
        const next = await resourcesStep(current);
        await continueFrom(next);
      } else if (step === 'execute') {
        const next = await executeStep(current);
        await continueFrom(next);
      } else if (step === 'verify') {
        await verifyStep();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  async function handleRequestApproval(action: string): Promise<void> {
    if (!task) return;
    setError(null);
    try {
      const res = await requestApprovalAction.mutateAsync({ userId, taskId: task.id, action });
      const next = (res as { data?: BrainTask }).data;
      if (next) setTask(next);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleApprove(action: string): Promise<void> {
    if (!task) return;
    setError(null);
    try {
      const res = await approveAction.mutateAsync({ userId, taskId: task.id, action });
      const next = (res as { data?: BrainTask }).data;
      if (next) setTask(next);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleReject(action: string): Promise<void> {
    if (!task) return;
    setError(null);
    try {
      const res = await rejectAction.mutateAsync({ userId, taskId: task.id, action });
      const next = (res as { data?: BrainTask }).data;
      if (next) setTask(next);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleCancel(): Promise<void> {
    if (!task) return;
    setError(null);
    try {
      const res = await cancelTask.mutateAsync({ userId, taskId: task.id });
      const next = (res as { data?: BrainTask }).data;
      if (next) setTask(next);
      void utils.brain.listTasks.invalidate();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleEvaluate(
    accepted: boolean,
    satisfaction: 'YES' | 'PARTIALLY' | 'NO' = accepted ? 'YES' : 'NO',
  ): Promise<void> {
    if (!task) return;
    setError(null);
    try {
      const res = await evaluateOutcome.mutateAsync({
        userId,
        taskId: task.id,
        outputAccepted: accepted,
        satisfaction,
      });
      const next = (res as { data?: BrainTask }).data;
      if (next) setTask(next);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function openHistoryTask(id: string): void {
    const found = history.data?.find((h) => h.id === id);
    if (found) setTask(found);
    setError(null);
  }

  const nextLabel = task ? nextStepLabel(nextStepOf(task)) : null;
  const showOutcome = Boolean(
    task &&
    (task.status === 'COMPLETED' || task.status === 'PARTIAL') &&
    task.stage === 'RESULT' &&
    !task.outcome,
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-slide-up">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/30">
          <BrainCircuit className="h-5 w-5 text-[#2B5FD9]" />
        </div>
        <div>
          <h1 className="text-[24px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
            VedMoulya Brain
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Understand → Plan → Select providers → Execute → Verify → Explain. The Brain
            coordinates, it never executes AI itself.
          </p>
        </div>
      </div>

      {/* ── Operating dashboard (EPIC-020 §13) ───────────────────────── */}
      {/* Answers: what is the Brain doing, why, what needs approval, what it
          learned, and what can improve life/business/income — with the
          continuous AI World discovery surface. */}
      <ErrorBoundary section="brain-operations">
        <BrainOperationsSection userId={userId} />
      </ErrorBoundary>

      {/* ── Task input ─────────────────────────────────────────────────── */}
      <ErrorBoundary section="brain-input">
        <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
          <label
            htmlFor="brain-objective"
            className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]"
          >
            What do you want the Brain to accomplish?
          </label>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input
              id="brain-objective"
              value={objective}
              onChange={(e) => {
                setObjective(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && objective.trim().length >= 3) {
                  void runFull();
                }
              }}
              placeholder="Write a high-quality blog post about AI productivity…"
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[13px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40"
            />
            <button
              onClick={() => {
                void runFull();
              }}
              disabled={objective.trim().length < 3 || busy !== null}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2B5FD9] text-white text-[13px] font-semibold hover:bg-[#1E4BB8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Run the Brain
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[#94A3B8]">Try:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                onClick={() => {
                  setObjective(example.outcome);
                  void runFull(example.outcome);
                }}
                disabled={busy !== null}
                className="px-2.5 py-1 rounded-full bg-[#F1F5F9] dark:bg-[#334155] text-[11px] font-medium text-[#64748B] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#475569] transition-colors disabled:opacity-50"
              >
                {example.label}
              </button>
            ))}
          </div>
          {error && (
            <p className="mt-3 text-[12px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
        </Card>
      </ErrorBoundary>

      {/* ── Active task ────────────────────────────────────────────────── */}
      {task && (
        <ErrorBoundary section="brain-task">
          <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
            {/* Main column */}
            <div className="space-y-4 min-w-0">
              {/* Objective + meta */}
              <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#2B5FD9] dark:text-[#6B8FEF] uppercase tracking-wide">
                      Task {task.id}
                    </p>
                    <h2 className="mt-0.5 text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      {task.objective}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.status !== 'CANCELLED' && task.status !== 'FAILED' && (
                      <button
                        onClick={() => {
                          void handleCancel();
                        }}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        <Ban className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                    {nextLabel && (
                      <button
                        onClick={() => {
                          void continueFrom(task);
                        }}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B5FD9] text-white text-[11px] font-semibold hover:bg-[#1E4BB8] transition-colors disabled:opacity-50"
                      >
                        {busy !== null ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        {nextLabel}
                      </button>
                    )}
                  </div>
                </div>

                {/* Stage rail */}
                <div className="mt-4">
                  <BrainStageRail stageStatuses={task.stageStatuses} stage={task.stage} />
                </div>

                {/* Meta chips */}
                <div className="mt-4">
                  <BrainTaskMeta task={task} />
                </div>
              </Card>

              {/* Understanding */}
              <BrainIntentPanel task={task} />

              {/* Providers & roles */}
              <BrainProviderAssignments task={task} />

              {/* Approval gates */}
              <BrainApprovalPanel
                task={task}
                onApprove={(action) => {
                  void handleApprove(action);
                }}
                onReject={(action) => {
                  void handleReject(action);
                }}
                onRequest={(action) => {
                  void handleRequestApproval(action);
                }}
                busy={busy !== null}
              />

              {/* Outputs */}
              {task.providerOutputs.length > 0 && <BrainOutputsPanel task={task} />}

              {/* Verification */}
              {task.verification && <BrainVerificationPanel verification={task.verification} />}

              {/* Synthesis */}
              {task.synthesis && <BrainSynthesisPanel synthesis={task.synthesis} />}

              {/* Outcome evaluation */}
              {showOutcome && (
                <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#7C3AED]" />
                    <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      Did this result work for you?
                    </h3>
                  </div>
                  <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Your feedback feeds the Brain's learning feed — nothing is inferred silently.
                  </p>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        void handleEvaluate(true, 'YES');
                      }}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Yes — solved it
                    </button>
                    <button
                      onClick={() => {
                        void handleEvaluate(true, 'PARTIALLY');
                      }}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3" />
                      Partially
                    </button>
                    <button
                      onClick={() => {
                        void handleEvaluate(false, 'NO');
                      }}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3 w-3" />
                      No
                    </button>
                  </div>
                </Card>
              )}

              {/* Decision explanation */}
              {task.decisionRecords.length > 0 && (
                <div>
                  <BrainSectionHeading
                    icon={<ScrollText className="h-4 w-4 text-[#06B6D4]" />}
                    title="Why the Brain chose what it chose"
                    sub="Every decision: reason, selected option, alternatives, evidence, confidence."
                  />
                  <div className="mt-3">
                    <BrainDecisionRecordsPanel records={task.decisionRecords} />
                  </div>
                </div>
              )}
            </div>

            {/* Side column */}
            <div className="space-y-4">
              <BrainBudgetPanel task={task} />
              <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
                <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  Trace
                </h3>
                <div className="mt-2">
                  <BrainTimestamps task={task} />
                </div>
              </Card>
              <BrainHistoryCard
                tasks={history.data ?? []}
                currentId={task.id}
                onOpen={(id) => {
                  openHistoryTask(id);
                }}
              />
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!task && busy === null && (
        <EmptyState
          icon={<BrainCircuit className="h-8 w-8" />}
          title="Describe an objective"
          description="The Brain will understand it, plan the required capabilities, select the best providers with roles, execute through the frozen runtime, verify the result and explain every decision — pausing for your approval on sensitive actions."
        />
      )}
    </div>
  );
}

// ── History card ─────────────────────────────────────────────────────────────

function BrainHistoryCard(props: {
  tasks: BrainTask[];
  currentId: string;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const { tasks, currentId, onOpen } = props;
  const recent = [...tasks].reverse().slice(0, 8);
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-1.5">
        <History className="h-4 w-4 text-[#2B5FD9]" />
        Recent Brain tasks
      </h3>
      {recent.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {recent.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => {
                  onOpen(h.id);
                }}
                className={`w-full text-left rounded-lg px-2.5 py-2 border transition-colors ${
                  h.id === currentId
                    ? 'border-[#2B5FD9]/40 bg-[#EFF4FE] dark:bg-[#1E3A8A]/40'
                    : 'border-slate-200 dark:border-slate-700 hover:border-[#2B5FD9]/40 hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                }`}
              >
                <p className="text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0] truncate">
                  {h.objective}
                </p>
                <p className="mt-0.5 flex items-center justify-between gap-2">
                  <span
                    className={`px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide ${
                      h.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : h.status === 'PARTIAL'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {h.status.replaceAll('_', ' ')}
                  </span>
                  <span className="text-[9px] text-[#94A3B8]">{formatDateTime(h.updatedAt)}</span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-[#94A3B8]">No tasks yet — run the Brain above.</p>
      )}
      {tasks.length > 8 && (
        <p className="mt-2 text-[10px] text-[#94A3B8] flex items-center gap-1">
          <ArrowRight className="h-3 w-3" /> Showing the {recent.length} most recent of{' '}
          {tasks.length}
        </p>
      )}
    </Card>
  );
}
