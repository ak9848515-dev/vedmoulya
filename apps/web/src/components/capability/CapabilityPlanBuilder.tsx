// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Capability Plan Builder (EPIC-013)
// Shared by the dedicated /capability-marketplace page and the /applications
// create flow. Outcome → FactoryCapabilityPlan with steps, candidates,
// automation, approvals, evidence and Configure-Provider deep-links.
// Reuses the same capability.* API — no duplicated planner logic.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card } from '@vedmoulya/ui';
import {
  Wand2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Settings2,
  UserRound,
  ShieldAlert,
  ExternalLink,
  Clock,
  Coins,
} from 'lucide-react';
import { useCapabilityPlan } from '../../lib/api-client.js';
import { AIPlanInsightCard } from './AIPlanInsightCard.js';
import type { FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';

const AUTOMATION_STYLE: Record<string, string> = {
  FULLY_AUTOMATED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  PARTIALLY_AUTOMATED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  HUMAN_APPROVAL: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  MANUAL: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const CLASS_LABEL: Record<string, string> = {
  READY: 'Ready to use',
  CONFIGURE: 'Configure first',
  EVALUATE: 'Evaluate',
  EXTERNAL: 'External application',
  MANUAL: 'Manual action',
  UNAVAILABLE: 'Unavailable',
  UNKNOWN: 'Unknown',
};

export function CapabilityPlanBuilder({ userId }: { userId: string }): React.JSX.Element {
  const [outcome, setOutcome] = useState('');
  const [plan, setPlan] = useState<FactoryCapabilityPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const planMutation = useCapabilityPlan();

  async function runPlan(outcomeToPlan: string): Promise<void> {
    setError(null);
    setPlan(null);
    try {
      const result = await planMutation.mutateAsync({ userId, outcome: outcomeToPlan });
      const payload = result as { data?: FactoryCapabilityPlan };
      if (payload.data) setPlan(payload.data);
    } catch {
      setError('Could not build the plan right now. Please try again.');
    }
  }

  function handleConfigure(family: string | undefined): void {
    const target = family ? `/providers?provider=${encodeURIComponent(family)}` : '/providers';
    window.location.assign(target);
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 dark:bg-[#1E293B]">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Capability plan first
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Before building, VedMoulya turns your outcome into a capability plan: the required steps,
          who can perform each one, what can be automated, and what needs approval. Then it hands
          off to the factory.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && outcome.trim().length >= 3) {
                void runPlan(outcome.trim());
              }
            }}
            placeholder="e.g. Create a 60-second educational video…"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-[#0F172A] dark:text-slate-100"
          />
          <button
            onClick={() => {
              void runPlan(outcome.trim());
            }}
            disabled={outcome.trim().length < 3 || planMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2B5FD9] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E4BB8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {planMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Plan it
          </button>
        </div>
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
      </Card>

      {plan && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              AI PLAN
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${AUTOMATION_STYLE[plan.automationLevel] ?? ''}`}
            >
              {plan.automationLevel.replaceAll('_', ' ')}
            </span>
            <span className="text-[11px] text-slate-400">{plan.automationPercent}% automated</span>
            {plan.estimatedCostUsd !== undefined && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Coins className="h-3.5 w-3.5" /> ~${plan.estimatedCostUsd.toFixed(2)}
              </span>
            )}
            {plan.estimatedTimeMinutes !== undefined && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="h-3.5 w-3.5" /> ~{plan.estimatedTimeMinutes} min
              </span>
            )}
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2B5FD9] to-[#7C3AED] transition-all duration-500"
              style={{ width: `${plan.automationPercent}%` }}
            />
          </div>

          {plan.humanApprovalPoints.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Requires approval
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {plan.humanApprovalPoints.map((point) => (
                  <span
                    key={point.id}
                    className="inline-flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-300"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    {point.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {plan.aiInsight?.confident && <AIPlanInsightCard insight={plan.aiInsight} />}

          {plan.steps.map((step, index) => {
            const selected = step.candidates.find((c) => c.id === step.selectedCandidateId);
            return (
              <Card key={step.id} className="p-4 dark:bg-[#1E293B]">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EFF4FE] text-[11px] font-bold text-[#2B5FD9] dark:bg-[#1E3A8A]/40">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                        {step.title}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${AUTOMATION_STYLE[step.automation] ?? ''}`}
                      >
                        {step.automation.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">{step.purpose}</p>
                    {selected ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {selected.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {CLASS_LABEL[selected.classification] ?? selected.classification}
                        </span>
                        {selected.integrationType === 'EXTERNAL_APPLICATION' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                            <ExternalLink className="h-3 w-3" /> External application — API not
                            assumed
                          </span>
                        )}
                        {selected.configurable && selected.suggestedFamily && (
                          <button
                            onClick={() => {
                              handleConfigure(selected.suggestedFamily);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#2B5FD9] px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-[#1E4BB8]"
                          >
                            <Settings2 className="h-3 w-3" />
                            Configure Provider
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                        <UserRound className="h-3.5 w-3.5" />
                        No eligible tool — a human performs this step.
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {plan.risks.length > 0 && (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <h3 className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Risks
              </h3>
              <ul className="mt-1 space-y-1">
                {plan.risks.map((risk, i) => (
                  <li
                    key={`risk-${i}`}
                    className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
                  >
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
