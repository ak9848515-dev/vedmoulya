// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy: shared explorer components
// EPIC-004 / EI-004 — Enterprise Execution Strategy Engine
// Storybook-exported components that previously lived in the route page.
// Route pages may only export `default` + reserved Next.js fields, so the
// reusable cards live here and the page + stories import them.
// ─────────────────────────────────────────────────────────────────────────────

import type React from 'react';
import { Card, Badge } from '@vedmoulya/ui';
import { Workflow, Clock, Sparkles, ShieldCheck } from 'lucide-react';
import type { ExecutionStrategyDTO } from '@vedmoulya/execution-strategy';

export const MODE_LABELS: Record<string, string> = {
  sequential: 'Sequential',
  parallel: 'Parallel',
  hybrid: 'Hybrid',
  pipeline: 'Pipeline',
};

export const PRIORITY_BADGE: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  background: 'Background',
};

export const RISK_BADGE: Record<string, string> = {
  very_low: 'Very Low',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const CAPABILITY_LABELS: Record<string, string> = {
  reasoning: 'Reasoning',
  coding: 'Coding',
  vision: 'Vision',
  embeddings: 'Embeddings',
  summarization: 'Summarization',
  classification: 'Classification',
  translation: 'Translation',
  speech: 'Speech',
  image_understanding: 'Image Understanding',
  general_conversation: 'General Chat',
  content_generation: 'Content Generation',
};

export const TIER_LABELS: Record<string, string> = {
  premium: 'Premium',
  standard: 'Standard',
  economy: 'Economy',
  free: 'Free',
};

export function StrategyCard({ strategy }: { strategy: ExecutionStrategyDTO }): React.JSX.Element {
  return (
    <Card
      variant="standard"
      padding="md"
      className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 dark:bg-[#1E293B] dark:border-[#334155] flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
            <Workflow className="h-4 w-4 text-[#2B5FD9]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
              {strategy.goal}
            </h3>
            <p className="text-[11px] text-[#94A3B8]">
              {MODE_LABELS[strategy.executionMode] ?? strategy.executionMode} · v{strategy.version}
            </p>
          </div>
        </div>
        <Badge
          variant={
            strategy.priority === 'high'
              ? 'warning'
              : strategy.priority === 'critical'
                ? 'danger'
                : 'default'
          }
          size="sm"
          className="shrink-0"
        >
          {PRIORITY_BADGE[strategy.priority] ?? strategy.priority}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {strategy.capabilityPlan.requiredCapabilities.slice(0, 4).map((cap) => (
          <span
            key={cap}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED] dark:text-[#C4B5FD]"
          >
            {CAPABILITY_LABELS[cap] ?? cap}
          </span>
        ))}
      </div>

      <div className="mt-auto space-y-1.5 text-[12px]">
        <p className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            <strong className="text-[#111827] dark:text-[#F8FAFC]">
              {strategy.capabilityPlan.steps.length}
            </strong>{' '}
            steps · {strategy.providerCandidates.length} providers ·{' '}
            <strong className="text-[#111827] dark:text-[#F8FAFC]">
              {Math.round(strategy.confidence * 100)}%
            </strong>{' '}
            confidence
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            <strong className="text-[#111827] dark:text-[#F8FAFC]">
              {strategy.tokenBudget.expectedTokens.toLocaleString()}
            </strong>{' '}
            tokens ·{' '}
            <strong className="text-[#111827] dark:text-[#F8FAFC]">
              ${strategy.costBudget.expectedCostUsd.toFixed(2)}
            </strong>{' '}
            · ~{strategy.latencyBudget.expectedTimeMs}ms
          </span>
        </p>
      </div>

      <div className="mt-3 pt-3 border-t border-[#F1F5F9] dark:border-[#334155] flex items-center justify-between">
        <span className="text-[11px] text-[#94A3B8] truncate">{strategy.strategyId}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant={
              strategy.risk.level === 'high' || strategy.risk.level === 'critical'
                ? 'warning'
                : 'info'
            }
            size="sm"
          >
            {RISK_BADGE[strategy.risk.level] ?? strategy.risk.level} risk
          </Badge>
          <Badge variant={strategy.validation.passed ? 'success' : 'warning'} size="sm">
            {strategy.validation.passed ? 'Valid' : 'Check'}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

export function ValidationBadge({
  strategy,
}: {
  strategy: ExecutionStrategyDTO;
}): React.JSX.Element {
  return (
    <Card
      variant="standard"
      padding="md"
      className={`dark:bg-[#1E293B] dark:border-[#334155] ${strategy.validation.passed ? 'border-l-4 border-l-[#22C55E]' : 'border-l-4 border-l-[#F59E0B]'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck
          className={`h-4 w-4 ${strategy.validation.passed ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`}
        />
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Validation {strategy.validation.passed ? 'Passed' : 'Review Required'}
        </h3>
        <Badge variant={strategy.validation.passed ? 'success' : 'warning'} size="sm">
          {Math.round(strategy.validation.score * 100)}%
        </Badge>
      </div>
      <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mb-2">
        {strategy.validation.summary}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {strategy.validation.checks.map((check) => (
          <div key={check.check} className="flex items-center gap-2 text-[12px]">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${check.passed ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}`}
            />
            <span className="text-[#64748B] dark:text-[#94A3B8] truncate">
              {check.check}: {check.detail}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
