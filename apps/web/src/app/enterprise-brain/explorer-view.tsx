// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Decision Explorer view
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// Filterable decision list plus the interactive "decide a goal" panel that
// runs the full pipeline (Receive Goal → … → Explain) live.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Select, TextField } from '@vedmoulya/ui';
import { useEnterpriseBrainDecisions, useDecideEnterpriseBrainGoal } from '../../lib/api-client.js';
import type { BrainDecisionStatus, BrainDecisionType } from '@vedmoulya/enterprise-brain';
import { BRAIN_DECISION_TYPES } from '@vedmoulya/enterprise-brain';
import { ListChecks, BrainCircuit, Search } from 'lucide-react';
import { TYPE_COLORS, FALLBACK_COLOR } from './brain-ui.js';
import { DecisionCard, PipelineStep } from './components.js';

const TYPE_OPTIONS = [
  { value: '', label: 'All decision types' },
  ...BRAIN_DECISION_TYPES.map((type) => ({ value: type, label: type.replace(/_/g, ' ') })),
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'proposed', label: 'Proposed' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'handed_off', label: 'Handed off' },
  { value: 'superseded', label: 'Superseded' },
];

export function ExplorerView({ userId }: { userId: string }): React.JSX.Element {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useEnterpriseBrainDecisions(userId, {
    type: (type || undefined) as BrainDecisionType | undefined,
    status: (status || undefined) as BrainDecisionStatus | undefined,
    page,
    limit: 6,
  });

  const decide = useDecideEnterpriseBrainGoal();
  const [goalId, setGoalId] = useState('goal_blog_seed');
  const [budget, setBudget] = useState('');
  const [planSummary, setPlanSummary] = useState<{
    planId: string;
    goalTitle: string;
    overallConfidence: number;
    pipeline: Array<{ step: string; engine: string; consulted: boolean; note?: string }>;
    decisions: number;
  } | null>(null);
  const [decideError, setDecideError] = useState('');

  const runPipeline = async (e: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setDecideError('');
    setPlanSummary(null);
    try {
      const result = await decide.mutateAsync({
        userId,
        goalId: goalId.trim(),
        budgetUsd: budget.trim() === '' ? undefined : Number(budget.trim()),
      });
      const plan = result.data as {
        planId: string;
        goalTitle: string;
        overallConfidence: number;
        pipeline: Array<{ step: string; engine: string; consulted: boolean; note?: string }>;
        decisions: unknown[];
      };
      setPlanSummary({
        planId: plan.planId,
        goalTitle: plan.goalTitle,
        overallConfidence: plan.overallConfidence,
        pipeline: plan.pipeline,
        decisions: plan.decisions.length,
      });
      void refetch();
    } catch (error) {
      setDecideError(error instanceof Error ? error.message : 'The pipeline could not complete.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading decisions…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<ListChecks className="h-10 w-10" />}
        title="Decisions unavailable"
        description="The decision log could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / 6));

  return (
    <div className="space-y-4">
      {/* ── Decide a goal (run the pipeline live) ───────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#2B5FD9]">
          <BrainCircuit className="h-4 w-4" />
          Decide a goal — run the Enterprise Brain pipeline
        </div>
        <form
          onSubmit={(e) => void runPipeline(e)}
          className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4"
        >
          <TextField
            label="Goal id"
            value={goalId}
            onChange={(e) => {
              setGoalId(e.target.value);
            }}
            placeholder="goal_blog_seed"
          />
          <TextField
            label="Budget (USD, optional)"
            value={budget}
            onChange={(e) => {
              setBudget(e.target.value);
            }}
            placeholder="2.50"
          />
          <div className="flex items-end">
            <button
              type="submit"
              disabled={decide.isPending}
              className="w-full rounded-lg bg-[#2B5FD9] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E4BB8] disabled:opacity-50"
            >
              {decide.isPending ? 'Deciding…' : 'Decide'}
            </button>
          </div>
          <p className="col-span-full text-[11px] text-slate-400">
            Consults the Goal, Learning, Capability, Provider, Context, and Execution Strategy
            engines — produces an explained plan that is{' '}
            <strong>handed to the Execution Orchestrator only after human approval</strong>. The
            Brain never executes.
          </p>
        </form>
        {decideError && (
          <p className="mt-2 rounded-md bg-[#EF4444]/10 px-3 py-2 text-xs text-red-600">
            {decideError}
          </p>
        )}
        {planSummary && (
          <div className="animate-slide-up mt-4 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
                <span className="text-sm font-bold text-slate-800 dark:text-white">
                  {planSummary.goalTitle}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span>{planSummary.decisions} decisions</span>
                <span>{planSummary.planId}</span>
                <span className="font-semibold text-[#22C55E]">
                  {Math.round(planSummary.overallConfidence * 100)}% overall confidence
                </span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-0 md:grid-cols-4 lg:grid-cols-6">
              {planSummary.pipeline.map((step, index) => (
                <PipelineStep
                  key={step.step}
                  step={step}
                  index={index}
                  last={index === planSummary.pipeline.length - 1}
                />
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-44 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Decision type</label>
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            options={TYPE_OPTIONS}
          />
        </div>
        <div className="min-w-36">
          <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="flex items-center gap-2 pb-1 text-xs text-slate-400">
          <Search className="h-4 w-4" />
          {data.total} decision(s)
        </div>
      </Card>

      {/* ── Decision list ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.items.map((decision) => (
          <DecisionCard key={decision.decisionId} decision={decision} />
        ))}
      </div>
      {data.items.length === 0 && (
        <EmptyState
          icon={<ListChecks className="h-10 w-10" />}
          title="No decisions match"
          description="Run the pipeline above, or clear the filters."
        />
      )}
      {data.items.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40">
          <span className="text-xs text-slate-500">
            {data.total} decision(s) · page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
              }}
              className="rounded-md px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
              }}
              className="rounded-md px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-slate-300 dark:text-slate-600">
        <span
          className="inline-block h-2 w-2 rounded-full bg-slate-400"
          style={{ backgroundColor: TYPE_COLORS.provider_selection ?? FALLBACK_COLOR }}
        />{' '}
        Colored dots map to the 14 decision types.
      </p>
    </div>
  );
}
