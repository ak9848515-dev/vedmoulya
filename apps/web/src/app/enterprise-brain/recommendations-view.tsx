// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Recommendations view
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// The human-approval gate: the Brain proposes plans and decisions; humans
// approve, reject, or hand an approved plan to the Execution Orchestrator.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Badge } from '@vedmoulya/ui';
import {
  useEnterpriseBrainPlans,
  useEnterpriseBrainDecisions,
  useApproveEnterpriseBrainPlan,
  useRejectEnterpriseBrainPlan,
  useHandOffEnterpriseBrainPlan,
  useApproveEnterpriseBrainDecision,
  useRejectEnterpriseBrainDecision,
} from '../../lib/api-client.js';
import { Sparkles, CheckCircle2, XCircle, Rocket, Eye } from 'lucide-react';
import { STATUS_COLORS, formatPct } from './brain-ui.js';
import { DecisionCard, PipelineStep } from './components.js';

export function RecommendationsView({ userId }: { userId: string }): React.JSX.Element {
  const plans = useEnterpriseBrainPlans(userId);
  const { data: decisionsData, refetch: refetchDecisions } = useEnterpriseBrainDecisions(userId, {
    page: 1,
    limit: 100,
  });
  const approvePlan = useApproveEnterpriseBrainPlan();
  const rejectPlan = useRejectEnterpriseBrainPlan();
  const handOffPlan = useHandOffEnterpriseBrainPlan();
  const approveDecision = useApproveEnterpriseBrainDecision();
  const rejectDecision = useRejectEnterpriseBrainDecision();
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (plans.isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Gathering enterprise recommendations…" size="lg" />
      </div>
    );
  }

  if (plans.isError || !plans.data) {
    return (
      <EmptyState
        icon={<Sparkles className="h-10 w-10" />}
        title="Recommendations unavailable"
        description="Pending decisions could not be loaded."
        action={{ label: 'Retry', onClick: () => void plans.refetch() }}
      />
    );
  }

  const plansWithDecisions = plans.data.map((plan) => ({
    plan,
    decisions: (decisionsData?.items ?? []).filter((d) => d.planId === plan.planId),
  }));

  const openPlan = plansWithDecisions.find((entry) => entry.plan.planId === openPlanId) ?? null;

  const act = async (
    action: (input: {
      planId: string;
      userId: string;
      actor: string;
      note?: string;
    }) => Promise<unknown>,
    planId: string,
  ): Promise<void> => {
    try {
      await action({
        planId,
        userId,
        actor: 'owner',
        note: note.trim() === '' ? undefined : note.trim(),
      });
      setNote('');
      setOpenPlanId(null);
      void plans.refetch();
      void refetchDecisions();
    } catch (error) {
      // The mutation throws on business failure via guardMutation.
      console.error(error);
    }
  };

  const actDecision = async (
    action: (input: {
      decisionId: string;
      userId: string;
      actor: string;
      note?: string;
    }) => Promise<unknown>,
    decisionId: string,
  ): Promise<void> => {
    try {
      await action({
        decisionId,
        userId,
        actor: 'owner',
        note: note.trim() === '' ? undefined : note.trim(),
      });
      setNote('');
      void plans.refetch();
      void refetchDecisions();
    } catch (error) {
      // The mutation throws on business failure via guardMutation.
      console.error(error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/10 p-3">
        <Sparkles className="h-5 w-5 text-[#7C3AED]" />
        <p className="text-xs text-slate-600 dark:text-slate-300">
          The Brain <strong>proposes</strong> — humans <strong>dispose</strong>. A plan may be
          handed to the Execution Orchestrator only after every one of its decisions has been
          approved.
        </p>
      </div>

      {/* ── Plan list ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {plansWithDecisions.map(({ plan, decisions }) => {
          const pending = decisions.filter((d) => d.status === 'proposed').length;
          const approved = decisions.filter((d) => d.status === 'approved').length;
          const isOpen = openPlanId === plan.planId;
          return (
            <Card
              key={plan.planId}
              className={`p-4 transition-all ${isOpen ? 'ring-2 ring-[#7C3AED]/50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {plan.goalTitle}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">{plan.planId}</div>
                </div>
                <Badge className={`text-[10px] ${STATUS_COLORS[plan.status] ?? ''}`}>
                  {plan.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                  {pending} pending · {approved} approved
                </span>
                <span>overall {formatPct(plan.overallConfidence)}</span>
                <span>v{plan.version}</span>
              </div>

              {/* ── Decision approval status chips ──────────────────────── */}
              {decisions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {decisions.map((decision) => (
                    <span
                      key={decision.decisionId}
                      className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                        decision.status === 'approved'
                          ? 'bg-[#22C55E]/15 text-[#15803D]'
                          : decision.status === 'proposed'
                            ? 'bg-[#F59E0B]/15 text-[#B45309]'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                      title={`${decision.type}: ${decision.status}`}
                    >
                      {decision.type.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {/* ── Actions ─────────────────────────────────────────────── */}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  onClick={() => {
                    setOpenPlanId(isOpen ? null : plan.planId);
                  }}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-[#2B5FD9] transition-colors hover:bg-[#2B5FD9]/10"
                >
                  <Eye className="h-3.5 w-3.5" /> {isOpen ? 'Hide decisions' : 'Review decisions'}
                </button>
                {plan.status === 'proposed' && (
                  <button
                    disabled={approvePlan.isPending || rejectPlan.isPending}
                    onClick={() => {
                      void act((input) => approvePlan.mutateAsync(input), plan.planId);
                    }}
                    className="ml-auto flex items-center gap-1 rounded-md bg-[#22C55E] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#16A34A] disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve plan
                  </button>
                )}
                {plan.status === 'approved' && (
                  <button
                    disabled={handOffPlan.isPending}
                    onClick={() => {
                      void act((input) => handOffPlan.mutateAsync(input), plan.planId);
                    }}
                    className="ml-auto flex items-center gap-1 rounded-md bg-[#06B6D4] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#0891B2] disabled:opacity-50"
                  >
                    <Rocket className="h-3.5 w-3.5" /> Hand off to orchestrator
                  </button>
                )}
                {(plan.status === 'proposed' || plan.status === 'approved') && (
                  <button
                    disabled={
                      approvePlan.isPending || rejectPlan.isPending || handOffPlan.isPending
                    }
                    onClick={() => {
                      void act((input) => rejectPlan.mutateAsync(input), plan.planId);
                    }}
                    className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:border-[#EF4444]/40 hover:text-red-500 disabled:opacity-50 dark:border-slate-700"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                )}
              </div>

              {/* ── Pipeline trace ──────────────────────────────────────── */}
              {plan.pipeline.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-100 pt-3 md:grid-cols-3 dark:border-slate-800">
                  {plan.pipeline.map((step, index) => (
                    <PipelineStep
                      key={step.step}
                      step={step}
                      index={index}
                      last={index === plan.pipeline.length - 1}
                    />
                  ))}
                </div>
              )}

              {/* ── Expandable decision cards ───────────────────────────── */}
              {isOpen && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {decisions.map((decision) => (
                    <DecisionCard
                      key={decision.decisionId}
                      decision={decision}
                      actions={
                        decision.status === 'proposed' ? (
                          <div className="flex gap-2">
                            <button
                              disabled={approveDecision.isPending || rejectDecision.isPending}
                              onClick={() => {
                                void actDecision(
                                  (input) => approveDecision.mutateAsync(input),
                                  decision.decisionId,
                                );
                              }}
                              className="rounded-md bg-[#22C55E] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#16A34A] disabled:opacity-50"
                            >
                              Approve decision
                            </button>
                            <button
                              disabled={approveDecision.isPending || rejectDecision.isPending}
                              onClick={() => {
                                void actDecision(
                                  (input) => rejectDecision.mutateAsync(input),
                                  decision.decisionId,
                                );
                              }}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-[#EF4444]/40 hover:text-red-500 disabled:opacity-50 dark:border-slate-700"
                            >
                              Reject decision
                            </button>
                          </div>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {plans.data.length === 0 && (
        <EmptyState
          icon={<Sparkles className="h-10 w-10" />}
          title="No decision plans yet"
          description="Decide a goal in the Explorer tab — the Brain will propose a fully explained plan for your approval."
        />
      )}

      {/* ── Optional audit note input ───────────────────────────────────── */}
      <Card className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
        <label className="text-xs font-medium text-slate-500" htmlFor="brain-audit-note">
          Audit note (optional)
        </label>
        <input
          id="brain-audit-note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
          placeholder="e.g. approved with the 2.50 USD budget cap"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition-colors focus:border-[#2B5FD9] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <p className="text-[10px] text-slate-400">
          Appended to the audit trail of every action you take in this tab.
        </p>
      </Card>

      {openPlan && (
        <p className="text-center text-[10px] text-slate-400">
          Plan {openPlan.plan.planId} · {openPlan.decisions.length} decision(s)
        </p>
      )}
    </div>
  );
}
