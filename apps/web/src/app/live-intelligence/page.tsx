// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge (EPIC-017)
//
// The full loop, operating through the EXISTING ecosystem:
//   USER TASK → BRAIN UNDERSTAND → CAPABILITY DISCOVERY → PROVIDER/MODEL
//   INTELLIGENCE → ECOSYSTEM INTELLIGENCE → SECURITY/LICENSE/AVAILABILITY →
//   TASK-SPECIFIC QUALITY → COMPARE CURRENT VS BETTER → RECOMMENDATION →
//   USER APPROVAL → CONFIGURATION/HAND-OFF → VALIDATION → ROUTING →
//   EPIC-014 EXECUTION → VERIFY → EVALUATE → MEMORY/PREFERENCE FEEDBACK.
//
// The UI communicates WHAT AM I DOING / WHY THIS PROVIDER / IS THERE A BETTER
// OPTION / WHAT WILL IT COST / IS IT FREE / IS IT LOCAL / IS IT SAFE / DO I
// NEED TO APPROVE / WHAT HAPPENS NEXT — progressive disclosure, premium
// VedMoulya design system. No fabricated evidence: UNKNOWN stays UNKNOWN,
// paid options require explicit approval, GitHub/external stay honest
// hand-off boundaries.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import {
  Zap,
  Loader2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  History,
  Play,
  Shield,
  Scale,
  Workflow,
} from 'lucide-react';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
  useLiveIntelligenceStart,
  useLiveIntelligenceDiscover,
  useLiveIntelligenceCompare,
  useLiveIntelligenceRecommend,
  useLiveIntelligenceApprove,
  useLiveIntelligenceReject,
  useLiveIntelligenceHandOff,
  useLiveIntelligenceEvaluateAndLearn,
  useLiveIntelligenceList,
} from '../../lib/api-client.js';
import type { BridgeLoopRun } from '@vedmoulya/live-intelligence-bridge';
import {
  BridgeStageRail,
  BridgeCandidateList,
  BridgeComparisonCard,
  BridgeApprovalPanel,
  BridgeHandoffCard,
  BridgeOutcomePanel,
  BridgePerformancePanel,
  BridgeNotificationList,
  BridgeSectionHeading,
} from './bridge-panels.js';
import {
  formatDateTime,
  nextBridgeStepOf,
  nextBridgeStepLabel,
  type BridgeStep,
} from './bridge-ui.js';

const EXAMPLES = [
  {
    label: 'Blog post',
    outcome: 'Write a high-quality blog post about AI productivity for professionals',
  },
  {
    label: 'Video script',
    outcome: 'Create a professional script for a 2-minute explainer video about renewable energy',
  },
  {
    label: 'Research brief',
    outcome: 'Research the current state of open-source local LLMs and summarize the best options',
  },
  {
    label: 'Competitor analysis',
    outcome: 'Analyze the competitive landscape for a small business SaaS pricing strategy',
  },
];

export default function LiveIntelligencePage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();

  const [objective, setObjective] = useState('');
  const [loop, setLoop] = useState<BridgeLoopRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'start' | 'evaluate' | BridgeStep>(null);
  const inFlight = useRef(false);

  const startLoop = useLiveIntelligenceStart();
  const discoverLoop = useLiveIntelligenceDiscover();
  const compareLoop = useLiveIntelligenceCompare();
  const recommendLoop = useLiveIntelligenceRecommend();
  const approveAction = useLiveIntelligenceApprove();
  const rejectAction = useLiveIntelligenceReject();
  const handOffAction = useLiveIntelligenceHandOff();
  const evaluateAction = useLiveIntelligenceEvaluateAndLearn();
  const history = useLiveIntelligenceList(userId);

  useEffect(() => {
    setActiveSection('live-intelligence');
    setBreadcrumbs([
      { label: 'Enterprise Intelligence', href: '/intelligence' },
      { label: 'Live Intelligence Bridge' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading the Live Intelligence Bridge..." size="lg" />
      </div>
    );
  }
  if (!user) {
    return <SignInRedirect />;
  }

  function errorMessage(_e: unknown): string {
    return 'The Bridge could not complete that step right now. Check that providers are configured in the Provider Registry, then try again.';
  }

  function applyLoop(res: unknown): BridgeLoopRun {
    const next = (res as { data?: BridgeLoopRun }).data;
    if (!next) throw new Error('The Bridge did not return the updated loop.');
    setLoop(next);
    return next;
  }

  async function startStep(input: string): Promise<BridgeLoopRun> {
    setBusy('start');
    const res = await startLoop.mutateAsync({ userId, objective: input });
    return applyLoop(res);
  }

  async function discoverStep(current: BridgeLoopRun): Promise<BridgeLoopRun> {
    setBusy('discover');
    const res = await discoverLoop.mutateAsync({ userId, loopId: current.loopId });
    return applyLoop(res);
  }

  async function compareStep(current: BridgeLoopRun): Promise<BridgeLoopRun> {
    setBusy('compare');
    const res = await compareLoop.mutateAsync({ userId, loopId: current.loopId });
    return applyLoop(res);
  }

  async function recommendStep(current: BridgeLoopRun): Promise<BridgeLoopRun> {
    setBusy('recommend');
    const res = await recommendLoop.mutateAsync({ userId, loopId: current.loopId });
    return applyLoop(res);
  }

  async function handOffStep(current: BridgeLoopRun): Promise<BridgeLoopRun> {
    setBusy('handoff');
    const res = await handOffAction.mutateAsync({ userId, loopId: current.loopId });
    return applyLoop(res);
  }

  async function evaluateStep(current: BridgeLoopRun): Promise<BridgeLoopRun> {
    setBusy('evaluate');
    const res = await evaluateAction.mutateAsync({
      userId,
      loopId: current.loopId,
      outputAccepted: true,
    });
    return applyLoop(res);
  }

  async function runFull(target?: string): Promise<void> {
    const input = (target ?? objective).trim();
    if (busy || inFlight.current || input.length < 3) return;
    inFlight.current = true;
    setError(null);
    try {
      const started = await startStep(input);
      const discovered = await discoverStep(started);
      const compared = await compareStep(discovered);
      await recommendStep(compared);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  /** Advance one stage at a time (progressive disclosure). */
  async function continueFrom(current: BridgeLoopRun): Promise<void> {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      const step = nextBridgeStepOf(current);
      if (step === 'discover') {
        const next = await discoverStep(current);
        await continueFrom(next);
      } else if (step === 'compare') {
        const next = await compareStep(current);
        await continueFrom(next);
      } else if (step === 'recommend') {
        await recommendStep(current);
      } else if (step === 'handoff') {
        const next = await handOffStep(current);
        // After hand-off, the execution status determines the next action:
        // awaiting approval / configure / manual boundaries never auto-advance.
        if (
          next.stage === 'EXECUTE' &&
          next.executionHandoff?.kind === 'EXECUTE' &&
          next.status === 'EXECUTING'
        ) {
          await evaluateStep(next);
        }
      } else {
        // step === 'approve' — approval is an explicit user action; the approval
        // panel is already surfaced. The user decides. Never auto-approve.
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  async function handleApprove(recommendationId: string): Promise<void> {
    if (!loop) return;
    setError(null);
    try {
      const res = await approveAction.mutateAsync({
        userId,
        loopId: loop.loopId,
        recommendationId,
      });
      applyLoop(res);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleReject(recommendationId: string): Promise<void> {
    if (!loop) return;
    setError(null);
    try {
      const res = await rejectAction.mutateAsync({ userId, loopId: loop.loopId, recommendationId });
      applyLoop(res);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleHandOff(): Promise<void> {
    if (!loop) return;
    setError(null);
    try {
      const res = await handOffAction.mutateAsync({ userId, loopId: loop.loopId });
      applyLoop(res);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleEvaluate(accepted: boolean): Promise<void> {
    if (!loop) return;
    setError(null);
    try {
      const res = await evaluateAction.mutateAsync({
        userId,
        loopId: loop.loopId,
        outputAccepted: accepted,
      });
      applyLoop(res);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function openHistoryLoop(id: string): void {
    const found = history.data?.find((h) => h.loopId === id);
    if (found) setLoop(found);
    setError(null);
  }

  const nextLabel = loop ? nextBridgeStepLabel(nextBridgeStepOf(loop)) : null;
  const awaitingApproval = loop?.status === 'AWAITING_APPROVAL';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-slide-up">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#F0FDF4] dark:bg-[#14532D]/30">
          <Zap className="h-5 w-5 text-[#16A34A]" />
        </div>
        <div>
          <h1 className="text-[24px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
            Live Intelligence Bridge
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Understand → Discover → Compare → Recommend → Approve → Execute → Verify → Learn. The
            Bridge connects the Brain to the ecosystem — it never fabricates evidence, and never
            activates anything without you.
          </p>
        </div>
      </div>

      {/* ── Task input ─────────────────────────────────────────────────── */}
      <ErrorBoundary section="bridge-input">
        <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
          <label
            htmlFor="bridge-objective"
            className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]"
          >
            What do you want to accomplish?
          </label>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input
              id="bridge-objective"
              value={objective}
              onChange={(e) => {
                setObjective(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && objective.trim().length >= 3) {
                  void runFull();
                }
              }}
              placeholder="Create a professional AI video…"
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[13px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40"
            />
            <button
              onClick={() => {
                void runFull();
              }}
              disabled={objective.trim().length < 3 || busy !== null}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-[#15803D] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Run the Bridge
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

      {/* ── Active loop ────────────────────────────────────────────────── */}
      {loop && (
        <ErrorBoundary section="bridge-loop">
          <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
            {/* Main column */}
            <div className="space-y-4 min-w-0">
              {/* Objective + meta + stage rail */}
              <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#16A34A] dark:text-[#4ADE80] uppercase tracking-wide">
                      Loop {loop.loopId}
                    </p>
                    <h2 className="mt-0.5 text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      {loop.objective}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {loop.status !== 'COMPLETED' &&
                      loop.status !== 'PARTIAL' &&
                      loop.status !== 'FAILED' && (
                        <button
                          onClick={() => {
                            void continueFrom(loop);
                          }}
                          disabled={busy !== null || awaitingApproval}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-[11px] font-semibold hover:bg-[#15803D] transition-colors disabled:opacity-50"
                        >
                          {busy !== null ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          {nextLabel ?? 'Continue'}
                        </button>
                      )}
                  </div>
                </div>

                <div className="mt-4">
                  <BridgeStageRail stageStatuses={loop.stageStatuses} stage={loop.stage} />
                </div>

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      loop.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : loop.status === 'AWAITING_APPROVAL'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : loop.status === 'FAILED' || loop.status === 'BLOCKED'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {loop.status.replaceAll('_', ' ')}
                  </span>
                  {loop.capabilities.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded-full bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9] dark:text-[#93C5FD] text-[10px] font-semibold"
                    >
                      {c}
                    </span>
                  ))}
                  <span className="text-[10px] text-[#94A3B8]">
                    {formatDateTime(loop.updatedAt)}
                  </span>
                </div>

                {loop.failureReason && (
                  <p className="mt-3 text-[12px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {loop.failureReason}
                  </p>
                )}
              </Card>

              {/* Candidates (progressive disclosure) */}
              {loop.candidates.length > 0 && (
                <BridgeSectionHeading
                  icon={<Workflow className="h-4 w-4 text-[#16A34A]" />}
                  title="Capability candidates"
                  sub="Evidence-first candidates from the provider registry, AI World and local-model intelligence — UNKNOWN stays UNKNOWN."
                />
              )}
              {loop.candidates.length > 0 && (
                <div className="mt-3">
                  <BridgeCandidateList candidates={loop.candidates} />
                </div>
              )}

              {/* Comparisons — current vs better */}
              {loop.comparisons.length > 0 && (
                <BridgeSectionHeading
                  icon={<Scale className="h-4 w-4 text-[#7C3AED]" />}
                  title="Current vs better — for THIS task"
                  sub="Structured reasons only — never hidden chain-of-thought."
                />
              )}
              {loop.comparisons.map((c) => (
                <div key={c.capability} className="mt-3">
                  <BridgeComparisonCard comparison={c} />
                </div>
              ))}

              {/* Recommendations + approval */}
              {loop.recommendations.length > 0 && (
                <BridgeSectionHeading
                  icon={<Sparkles className="h-4 w-4 text-[#F59E0B]" />}
                  title="Recommendations"
                  sub="Material improvements are offered, never activated — paid, GitHub and external options always require your approval."
                />
              )}
              {loop.recommendations.map((r) => (
                <div key={r.id} className="mt-3">
                  <BridgeApprovalPanel
                    recommendation={r}
                    busy={busy !== null}
                    onApprove={() => {
                      void handleApprove(r.id);
                    }}
                    onReject={() => {
                      void handleReject(r.id);
                    }}
                  />
                </div>
              ))}

              {/* Hand-off — configuration / execution */}
              {loop.executionHandoff && (
                <div className="mt-4">
                  <BridgeHandoffCard
                    handoff={loop.executionHandoff}
                    onProceed={() => {
                      void handleHandOff();
                    }}
                    busy={busy !== null}
                  />
                </div>
              )}

              {/* Outcome + feedback */}
              {loop.outcome && (
                <div className="mt-4">
                  <BridgeOutcomePanel outcome={loop.outcome} />
                </div>
              )}
              {loop.performance.length > 0 && (
                <div className="mt-4">
                  <BridgePerformancePanel facts={loop.performance} />
                </div>
              )}

              {/* Notifications emitted to AI World */}
              {loop.notifications.length > 0 && (
                <div className="mt-4">
                  <BridgeNotificationList events={loop.notifications} />
                </div>
              )}

              {/* Outcome evaluation prompt */}
              {loop.executionHandoff && loop.status === 'EXECUTING' && !loop.outcome && (
                <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#7C3AED]" />
                    <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      Did this result work for you?
                    </h3>
                  </div>
                  <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Your feedback becomes task-specific performance evidence — reversible,
                    time-aware, never a global ranking.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        void handleEvaluate(true);
                      }}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Accept result
                    </button>
                    <button
                      onClick={() => {
                        void handleEvaluate(false);
                      }}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3 w-3" />
                      Reject result
                    </button>
                  </div>
                </Card>
              )}
            </div>

            {/* Side column */}
            <div className="space-y-4">
              <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
                <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-[#16A34A]" />
                  Boundaries
                </h3>
                <ul className="mt-2 space-y-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  <li className="flex gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" /> Quality
                    first — free/local never automatically beats evidence.
                  </li>
                  <li className="flex gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" /> Paid,
                    GitHub and external options always require your approval.
                  </li>
                  <li className="flex gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" /> Nothing is
                    fabricated — UNKNOWN stays UNKNOWN.
                  </li>
                  <li className="flex gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" /> Declining
                    is never task failure — the best available option continues.
                  </li>
                </ul>
              </Card>
              <BridgeHistoryCard
                loops={history.data ?? []}
                currentId={loop.loopId}
                onOpen={(id) => {
                  openHistoryLoop(id);
                }}
              />
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!loop && busy === null && (
        <EmptyState
          icon={<Zap className="h-8 w-8" />}
          title="Describe an objective"
          description="The Bridge will understand it through the Brain, discover candidates, compare what you have against what is available, recommend only material improvements (with evidence and cost), pause for your approval, hand off to configuration or execution, verify, and record task-specific performance feedback."
        />
      )}
    </div>
  );
}

// ── History card ─────────────────────────────────────────────────────────────

function BridgeHistoryCard(props: {
  loops: BridgeLoopRun[];
  currentId: string;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const { loops, currentId, onOpen } = props;
  const recent = [...loops].reverse().slice(0, 8);
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
      <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-1.5">
        <History className="h-4 w-4 text-[#16A34A]" />
        Recent Bridge loops
      </h3>
      {recent.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {recent.map((h) => (
            <li key={h.loopId}>
              <button
                onClick={() => {
                  onOpen(h.loopId);
                }}
                className={`w-full text-left rounded-lg px-2.5 py-2 border transition-colors ${
                  h.loopId === currentId
                    ? 'border-[#16A34A]/40 bg-[#F0FDF4] dark:bg-[#14532D]/40'
                    : 'border-slate-200 dark:border-slate-700 hover:border-[#16A34A]/40 hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
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
                        : h.status === 'AWAITING_APPROVAL'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : h.status === 'FAILED' || h.status === 'BLOCKED'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
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
        <p className="mt-2 text-[11px] text-[#94A3B8]">No loops yet — run the Bridge above.</p>
      )}
      {loops.length > 8 && (
        <p className="mt-2 text-[10px] text-[#94A3B8] flex items-center gap-1">
          <ArrowRight className="h-3 w-3" /> Showing the {recent.length} most recent of{' '}
          {loops.length}
        </p>
      )}
    </Card>
  );
}
