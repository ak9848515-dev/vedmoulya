// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Goal Explorer: shared components
// EPIC-004 / EI-006 — Enterprise Goal & Task Intelligence Engine
// Storybook-exported components that previously lived in the route page.
// Route pages may only export `default` + reserved Next.js fields, so the
// reusable card lives here and the page + stories import it.
// ─────────────────────────────────────────────────────────────────────────────

import type React from 'react';
import { Card, Badge } from '@vedmoulya/ui';
import { Sparkles, ListChecks, ShieldAlert, Flag, TrendingUp } from 'lucide-react';
import type { GoalDTO } from '@vedmoulya/goals';
import {
  CATEGORY_LABELS,
  STATUS_BADGE,
  PRIORITY_BADGE,
  RISK_BADGE,
  percentColor,
} from './explorer-data.js';

export function GoalCard({
  goal,
  busy,
  onAnalyze,
  onGenerate,
  onValidate,
}: {
  goal: GoalDTO;
  busy: boolean;
  onAnalyze: (goalId: string) => void;
  onGenerate: (goalId: string) => void;
  onValidate: (goalId: string) => void;
}): React.JSX.Element {
  const statusMeta = STATUS_BADGE[goal.status];
  const priorityMeta = PRIORITY_BADGE[goal.priority];
  const riskMeta = goal.classification ? RISK_BADGE[goal.classification.riskLevel] : null;

  return (
    <Card
      variant="standard"
      padding="md"
      className="dark:bg-[#1E293B] dark:border-[#334155] flex flex-col"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={statusMeta.variant} size="sm">
              {statusMeta.label}
            </Badge>
            <Badge variant={priorityMeta.variant} size="sm">
              {priorityMeta.label}
            </Badge>
            {riskMeta && (
              <Badge variant={riskMeta.variant} size="sm">
                {riskMeta.label} risk
              </Badge>
            )}
          </div>
          <h3 className="text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] leading-snug">
            {goal.title}
          </h3>
          <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] mt-1 line-clamp-2">
            {goal.description}
          </p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9]">
          {CATEGORY_LABELS[goal.category]}
        </span>
      </div>

      {/* Score / confidence */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] w-20 shrink-0">
            Goal score
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
            <div
              className={`h-full rounded-full ${percentColor(goal.goalScore)}`}
              style={{ width: `${String(Math.round(goal.goalScore * 100))}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-[#111827] dark:text-[#F8FAFC] w-8 text-right">
            {goal.goalScore.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] w-20 shrink-0">
            Confidence
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
            <div
              className={`h-full rounded-full ${percentColor(goal.confidence)}`}
              style={{ width: `${String(Math.round(goal.confidence * 100))}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-[#111827] dark:text-[#F8FAFC] w-8 text-right">
            {String(Math.round(goal.confidence * 100))}%
          </span>
        </div>
      </div>

      {/* Meta chips */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
        <span className="px-1.5 py-0.5 rounded bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
          {goal.complexity}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
          {String(goal.estimatedEffort)}h effort
        </span>
        {goal.classification && (
          <span className="px-1.5 py-0.5 rounded bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
            {String(goal.classification.requiredCapabilities.length)} capabilities
          </span>
        )}
        <span className="px-1.5 py-0.5 rounded bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
          {String(goal.successCriteria.length)} criteria
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
          {String(goal.milestones.length)} milestones
        </span>
        {goal.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded-full bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED]"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-[#F1F5F9] dark:border-[#334155] flex flex-wrap items-center gap-2">
        <ActionButton
          label="Analyze"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          className="bg-[#7C3AED] hover:bg-[#6D28D9]"
          disabled={busy}
          onClick={() => {
            onAnalyze(goal.goalId);
          }}
        />
        <ActionButton
          label="Generate Tasks"
          icon={<ListChecks className="h-3.5 w-3.5" />}
          className="bg-[#2B5FD9] hover:bg-[#2450C4]"
          disabled={busy}
          onClick={() => {
            onGenerate(goal.goalId);
          }}
        />
        <ActionButton
          label="Validate"
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          className="bg-[#0D9488] hover:bg-[#0F766E]"
          disabled={busy}
          onClick={() => {
            onValidate(goal.goalId);
          }}
        />
        {goal.milestones.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-[#94A3B8]">
            <Flag className="h-3 w-3" /> planned
          </span>
        )}
      </div>

      {/* Classification strip */}
      {goal.classification && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
          {goal.classification.businessDomain.slice(0, 2).map((d) => (
            <span
              key={d}
              className="px-1.5 py-0.5 rounded-full bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9] border border-[#2B5FD9]/30 capitalize"
            >
              {d}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-[#94A3B8]">
            <TrendingUp className="h-3 w-3" /> est.{' '}
            {goal.classification.estimatedCostRangeUsd.min.toFixed(2)}–
            {goal.classification.estimatedCostRangeUsd.max.toFixed(2)} USD
          </span>
        </div>
      )}
    </Card>
  );
}

function ActionButton({
  label,
  icon,
  className,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  className: string;
  disabled?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white transition-colors disabled:opacity-40 ${className}`}
    >
      {icon} {label}
    </button>
  );
}
