// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Capability Marketplace & Factory Intelligence
// EPIC-013 — connect AI World intelligence with the factory ecosystem.
//
// The user types an outcome ("Create a 60-second educational video") and sees
// a simple, premium plan: the ordered steps, who can perform each one,
// the automation level, what needs approval, and what remains unavailable —
// with evidence and honest "external application required" notices. Nothing
// is faked: API availability, automation and pricing are never assumed.
// "Configure Provider" deep-links into the EXISTING provider configuration.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Card, Loading, EmptyState, Badge } from '@vedmoulya/ui';
import {
  Radar,
  Wand2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Settings2,
  Cpu,
  UserRound,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Clock,
  Coins,
} from 'lucide-react';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
  useCapabilityPlan,
  useCapabilityMarketplaceView,
  useCapabilityListPlans,
} from '../../lib/api-client.js';
import { AIPlanInsightCard } from '../../components/capability/AIPlanInsightCard.js';
import { ExecutionRunner } from '../../components/execution/ExecutionRunner.js';
import type { FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';

const EXAMPLES = [
  {
    label: 'Educational video',
    outcome: 'Create a 60-second educational video about the solar system',
  },
  { label: 'Blog post', outcome: 'Write a blog post about AI productivity with images' },
  { label: 'Web app', outcome: 'Build an application that analyzes sales data' },
  { label: 'Podcast episode', outcome: 'Create a podcast episode about remote work with music' },
];

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

export default function CapabilityMarketplacePage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setBreadcrumbs } = useNavigationStore();
  const [outcome, setOutcome] = useState('');
  const [plan, setPlan] = useState<FactoryCapabilityPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planMutation = useCapabilityPlan();
  const capabilitiesView = useCapabilityMarketplaceView(userId);
  const history = useCapabilityListPlans(userId);

  useEffect(() => {
    setBreadcrumbs([{ label: 'AI Capability Marketplace', href: '/capability-marketplace' }]);
  }, [setBreadcrumbs]);

  // ── Guards ────────────────────────────────────────────────────────────
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading capability intelligence..." size="lg" />
      </div>
    );
  }
  if (!user) {
    return <SignInRedirect />;
  }

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

  const automationColor = plan
    ? (AUTOMATION_STYLE[plan.automationLevel] ?? AUTOMATION_STYLE.MANUAL)
    : '';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/30">
          <Radar className="h-5 w-5 text-[#2B5FD9]" />
        </div>
        <div>
          <h1 className="text-[24px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
            AI Capability Marketplace
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            What does it take? Who can do it? Can VedMoulya automate it?
          </p>
        </div>
      </div>

      {/* ── Plan builder ───────────────────────────────────────────────── */}
      <ErrorBoundary section="capability-builder">
        <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
          <label
            htmlFor="capability-outcome"
            className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]"
          >
            What do you want to create?
          </label>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input
              id="capability-outcome"
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && outcome.trim().length >= 3) {
                  void runPlan(outcome.trim());
                }
              }}
              placeholder="Create a 60-second educational video…"
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[13px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40"
            />
            <button
              onClick={() => {
                void runPlan(outcome.trim());
              }}
              disabled={outcome.trim().length < 3 || planMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2B5FD9] text-white text-[13px] font-semibold hover:bg-[#1E4BB8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {planMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Build plan
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[#94A3B8]">Try:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                onClick={() => {
                  setOutcome(example.outcome);
                  void runPlan(example.outcome);
                }}
                className="px-2.5 py-1 rounded-full bg-[#F1F5F9] dark:bg-[#334155] text-[11px] font-medium text-[#64748B] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#475569] transition-colors"
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

      {/* ── Plan result ────────────────────────────────────────────────── */}
      {plan && (
        <ErrorBoundary section="capability-plan">
          <div className="space-y-4">
            {/* Plan header */}
            <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    AI PLAN
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                    “{plan.requestedOutcome}”
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${automationColor}`}
                  >
                    {plan.automationLevel.replaceAll('_', ' ')}
                  </span>
                  {plan.estimatedCostUsd !== undefined && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      <Coins className="h-3.5 w-3.5" /> ~${plan.estimatedCostUsd.toFixed(2)}
                    </span>
                  )}
                  {plan.estimatedTimeMinutes !== undefined && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      <Clock className="h-3.5 w-3.5" /> ~{plan.estimatedTimeMinutes} min
                    </span>
                  )}
                </div>
              </div>

              {/* Automation bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-[#94A3B8] mb-1">
                  <span>Automation</span>
                  <span>{plan.automationPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#E2E8F0] dark:bg-[#334155] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#2B5FD9] to-[#7C3AED] transition-all duration-500"
                    style={{ width: `${plan.automationPercent}%` }}
                  />
                </div>
              </div>

              {/* Approval points */}
              {plan.humanApprovalPoints.length > 0 && (
                <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3">
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                    Requires approval
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
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

              {/* AI insight (optional enrichment overlay — advisory only) */}
              {plan.aiInsight?.confident && (
                <div className="mt-4">
                  <AIPlanInsightCard insight={plan.aiInsight} />
                </div>
              )}
            </Card>

            {/* Execute the plan (EPIC-014 — PLAN → EXECUTE → VERIFY) */}
            <ExecutionRunner userId={userId} planId={plan.id} />

            {/* Steps */}
            <div className="space-y-3">
              {plan.steps.map((step, index) => {
                const selected = step.candidates.find((c) => c.id === step.selectedCandidateId);
                return (
                  <Card key={step.id} variant="standard" padding="md" className="dark:bg-[#1E293B]">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-6 h-6 rounded-full bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 flex items-center justify-center text-[11px] font-bold text-[#2B5FD9]">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                            {step.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${AUTOMATION_STYLE[step.automation] ?? ''}`}
                          >
                            {step.automation.replaceAll('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#94A3B8]">{step.purpose}</p>

                        {/* Selected candidate */}
                        {selected ? (
                          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#F0FDF4] dark:bg-emerald-950/40 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {selected.name}
                            </span>
                            <span className="text-[10px] text-[#94A3B8]">
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
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#2B5FD9] text-white text-[10px] font-semibold hover:bg-[#1E4BB8] transition-colors"
                              >
                                <Settings2 className="h-3 w-3" />
                                Configure Provider
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                            <UserRound className="h-3.5 w-3.5" />
                            No eligible tool — a human performs this step.
                          </div>
                        )}

                        {/* Alternatives */}
                        {step.candidates.length > 1 && (
                          <details className="mt-2">
                            <summary className="text-[10px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] cursor-pointer hover:underline select-none">
                              Alternatives ({step.candidates.length - 1})
                            </summary>
                            <ul className="mt-1.5 space-y-1">
                              {step.candidates.slice(1).map((candidate) => (
                                <li
                                  key={candidate.id}
                                  className="text-[11px] text-[#64748B] dark:text-[#94A3B8]"
                                >
                                  {candidate.name}
                                  <span className="text-[#94A3B8]">
                                    {' '}
                                    —{' '}
                                    {CLASS_LABEL[candidate.classification] ??
                                      candidate.classification}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Risks + evidence */}
            {plan.risks.length > 0 && (
              <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
                <h3 className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  Risks
                </h3>
                <ul className="mt-1.5 space-y-1">
                  {plan.risks.map((risk, i) => (
                    <li
                      key={`risk-${i}`}
                      className="flex items-start gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]"
                    >
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {plan.evidence.length > 0 && (
              <details className="text-center">
                <summary className="text-[11px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] cursor-pointer hover:underline select-none inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Evidence ({plan.evidence.length})
                </summary>
                <ul className="mt-2 text-left space-y-1 max-w-2xl mx-auto">
                  {plan.evidence.slice(0, 8).map((evidence, i) => (
                    <li key={`ev-${i}`} className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {evidence.claim}
                      <span className="text-[#94A3B8]">
                        {' '}
                        — {evidence.confidence.toLowerCase().replaceAll('_', ' ')} (
                        {evidence.source})
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </ErrorBoundary>
      )}

      {/* ── Capability readiness + history ──────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
          <h2 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-1.5">
            <Cpu className="h-4 w-4 text-[#7C3AED]" />
            What VedMoulya can do today
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(capabilitiesView.data?.capabilities ?? [])
              .filter((c) => c.ready || c.configurable)
              .slice(0, 12)
              .map((c) => (
                <span
                  key={c.id}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    c.ready
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {c.label}
                </span>
              ))}
            {!capabilitiesView.isLoading &&
              (capabilitiesView.data?.capabilities ?? []).filter((c) => c.ready || c.configurable)
                .length === 0 && (
                <p className="text-[11px] text-[#94A3B8]">
                  No capability evidence yet — build your first plan.
                </p>
              )}
          </div>
        </Card>

        <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
          <h2 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Recent plans
          </h2>
          {history.data && history.data.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {history.data
                .slice(-4)
                .reverse()
                .map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-[#374151] dark:text-[#E2E8F0] truncate">
                      {h.requestedOutcome}
                    </span>
                    <Badge variant="info" size="sm">
                      {h.automationPercent}% auto
                    </Badge>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-3 text-[11px] text-[#94A3B8]">
              No plans yet — describe an outcome above to see the capability plan.
            </p>
          )}
          <button
            onClick={() => {
              window.location.assign('/applications');
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
          >
            Build it in the Application Factory
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Card>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!plan && !planMutation.isPending && (
        <EmptyState
          icon={<Wand2 className="h-8 w-8" />}
          title="Describe what you want to create"
          description="VedMoulya will turn your outcome into a capability plan: the required steps, who can perform each one, what can be automated, and what needs approval."
        />
      )}
    </div>
  );
}
