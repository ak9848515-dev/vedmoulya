// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: presentational components
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// Pure presentational components extracted from the dashboard views so they
// can be rendered in Storybook with fixture DTOs (same convention as the
// Learning Intelligence components.js).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Badge, Card } from '@vedmoulya/ui';
import type { BrainDecisionDTO, BrainPlanDTO, BrainHistoryDTO } from '@vedmoulya/enterprise-brain';
import {
  TYPE_COLORS,
  TYPE_LABELS,
  STATUS_COLORS,
  ACTION_COLORS,
  CONFIDENCE_COLORS,
  CONFIDENCE_BAR_COLORS,
  FALLBACK_COLOR,
  formatPct,
  formatDateTime,
} from './brain-ui.js';
import {
  CheckCircle2,
  GitBranch,
  History,
  Lightbulb,
  ShieldAlert,
  ArrowRightLeft,
} from 'lucide-react';

// ── ConfidenceBadge ──────────────────────────────────────────────────────────

export interface ConfidenceBadgeProps {
  score: number;
  level: 'low' | 'medium' | 'high';
}

export function ConfidenceBadge({ score, level }: ConfidenceBadgeProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONFIDENCE_COLORS[level] ?? ''}`}
    >
      {level.toUpperCase()} · {formatPct(score)}
    </span>
  );
}

// ── ConfidenceBar ────────────────────────────────────────────────────────────

export function ConfidenceBar({ score }: { score: number }): React.JSX.Element {
  const level = score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.round(score * 100)}%`,
            backgroundColor: CONFIDENCE_BAR_COLORS[level] ?? FALLBACK_COLOR,
          }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[10px] font-medium text-slate-400">
        {formatPct(score)}
      </span>
    </div>
  );
}

// ── DecisionCard ─────────────────────────────────────────────────────────────

export interface DecisionCardProps {
  decision: BrainDecisionDTO;
  /** Optional actions row rendered below the explanation. */
  actions?: React.ReactNode;
}

/** One fully explained decision: recommendation, confidence, and the full
 *  explainability block (why · evidence · trade-offs · alternatives · risks). */
export function DecisionCard({ decision, actions }: DecisionCardProps): React.JSX.Element {
  const color = TYPE_COLORS[decision.type] ?? FALLBACK_COLOR;
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-col p-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {TYPE_LABELS[decision.type] ?? decision.type}
          </span>
        </div>
        <Badge className={`text-[10px] ${STATUS_COLORS[decision.status] ?? ''}`}>
          {decision.status.replace('_', ' ')}
        </Badge>
      </div>

      <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">{decision.title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{decision.description}</p>

      {/* ── Recommendation ─────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
        <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">
          {decision.recommendation.action}
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {decision.recommendation.entityLabel}
        </span>
        <span className="text-[11px] font-mono text-slate-400">
          {decision.recommendation.entityId}
        </span>
        <div className="ml-auto w-32">
          <ConfidenceBar score={decision.confidence.score} />
        </div>
      </div>

      {/* ── Explainability ─────────────────────────────────────────────── */}
      <div className="mt-3">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" />
          <p className="text-xs text-slate-600 dark:text-slate-300">{decision.reason.why}</p>
        </div>

        <button
          onClick={() => {
            setOpen((value) => !value);
          }}
          className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#2B5FD9] transition-colors hover:text-[#1E4BB8]"
        >
          {open ? 'Hide' : 'Show'} evidence · trade-offs · alternatives · risks
        </button>

        {open && (
          <div className="mt-2 space-y-3 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-800">
            <section>
              <h4 className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" /> Evidence
              </h4>
              <ul className="mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
                {decision.reason.evidence.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
            </section>
            <section>
              <h4 className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                <ArrowRightLeft className="h-3.5 w-3.5 text-[#0D9488]" /> Trade-offs
              </h4>
              <ul className="mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
                {decision.reason.tradeoffs.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
            </section>
            <section>
              <h4 className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                <GitBranch className="h-3.5 w-3.5 text-[#7C3AED]" /> Alternatives
              </h4>
              <ul className="mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
                {decision.reason.alternatives.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
            </section>
            <section>
              <h4 className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                <ShieldAlert className="h-3.5 w-3.5 text-[#EF4444]" /> Risks
              </h4>
              <ul className="mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
                {decision.reason.risks.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-300 dark:text-slate-500">
        <span>
          v{decision.version} · {formatDateTime(decision.updatedAt)} · {decision.actor}
        </span>
        {decision.confidence.factors.slice(0, 2).map((factor) => (
          <span key={factor} className="hidden truncate md:inline">
            {factor}
          </span>
        ))}
      </div>

      {actions && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">{actions}</div>
      )}
    </Card>
  );
}

// ── PipelineStep ─────────────────────────────────────────────────────────────

export interface PipelineStepProps {
  step: { step: string; engine: string; consulted: boolean; note?: string };
  index: number;
  last?: boolean;
}

/** One step of the decision pipeline trace. */
export function PipelineStep({ step, index, last = false }: PipelineStepProps): React.JSX.Element {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
            step.consulted
              ? 'bg-[#2B5FD9] text-white'
              : 'bg-slate-200 text-slate-500 dark:bg-slate-700'
          }`}
        >
          {index + 1}
        </span>
        {!last && <span className="w-px flex-1 bg-slate-200 dark:bg-slate-700" />}
      </div>
      <div className="pb-4">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{step.step}</div>
        <div className="text-[10px] text-slate-400">
          {step.engine}
          {step.consulted ? '' : ' · unavailable'}
          {step.note ? ` · ${step.note}` : ''}
        </div>
      </div>
    </div>
  );
}

// ── PlanCard ─────────────────────────────────────────────────────────────────

export interface PlanCardProps {
  plan: BrainPlanDTO;
  onOpen?: (planId: string) => void;
}

/** One decision plan: goal, pipeline trace, overall confidence. */
export function PlanCard({ plan, onOpen }: PlanCardProps): React.JSX.Element {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
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
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span>{plan.decisions.length} decisions</span>
        <span>overall {formatPct(plan.overallConfidence)}</span>
        <span>v{plan.version}</span>
        <span>{plan.actor}</span>
      </div>
      {plan.pipeline.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-100 pt-3 md:grid-cols-3 dark:border-slate-800">
          {plan.pipeline.map((step, index) => (
            <div key={step.step} className="flex items-center gap-1.5 text-[10px]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${step.consulted ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}
              />
              <span className="truncate text-slate-500 dark:text-slate-400">
                {index + 1}. {step.step}
              </span>
            </div>
          ))}
        </div>
      )}
      {onOpen && (
        <button
          onClick={() => {
            onOpen(plan.planId);
          }}
          className="mt-3 text-[11px] font-semibold text-[#2B5FD9] transition-colors hover:text-[#1E4BB8]"
        >
          Open plan →
        </button>
      )}
    </Card>
  );
}

// ── HistoryRow ───────────────────────────────────────────────────────────────

export interface HistoryRowProps {
  entry: BrainHistoryDTO;
}

/** One DecisionHistory entry (versioned, actor-scoped audit trail). */
export function HistoryRow({ entry }: HistoryRowProps): React.JSX.Element {
  const color = TYPE_COLORS[entry.type] ?? FALLBACK_COLOR;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <History className="h-4 w-4 text-slate-400" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {TYPE_LABELS[entry.type] ?? entry.type}
          </span>
          <Badge
            className={`text-[10px] ${ACTION_COLORS[entry.action] ?? 'bg-slate-400 text-white'}`}
          >
            {entry.action.replace('_', ' ')}
          </Badge>
          <span className="text-[10px] text-slate-400">v{entry.version}</span>
        </div>
        <div className="mt-0.5 text-[10px] text-slate-400">
          {entry.actor}
          {entry.note ? ` · ${entry.note}` : ''} · {formatDateTime(entry.timestamp)}
          <span className="ml-1 font-mono" style={{ color }}>
            {entry.decisionId}
          </span>
        </div>
      </div>
    </div>
  );
}
