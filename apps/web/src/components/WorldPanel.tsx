// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Panel (SPRINT-032)
// The MY WORLD surface inside the AICompanion:
//   • bounded world snapshot (entities, business units, roles, opportunities)
//   • revenue opportunity pipeline with zero/low-capital budget filters
//     (₹0 / ₹1000 / ₹5000 / ₹10000 / ₹25000) — scores are advisory, never
//     income promises
//   • honest external-world signal status (UNAVAILABLE until a live source
//     is connected — never SUCCESS)
// Same design tokens as the rest of the companion; nothing here executes,
// spends or authorizes — it only reads the world model.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Globe, Layers, LineChart, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../lib/trpc.js';
import { useAuthStore } from '../stores/auth-store.js';

interface OverviewData {
  bounded: boolean;
  entityCount: number;
  relationCount: number;
  businessUnits: number;
  roles: number;
  activeOpportunities: number;
  emergencyStopEngaged: boolean;
  autonomyLevel: number;
  settingsConfirmed: boolean;
  signals: Array<{ kind: string; status: string }>;
}

interface PipelineEntry {
  opportunityId: string;
  title: string;
  category: string;
  status: string;
  score: number;
  capitalMode: string;
  riskLevel: string;
  firstStep?: string;
  approvalRequired: boolean;
}

// SPRINT-033 Part A / F — founder briefing + revenue snapshot shapes.
interface FounderBriefing {
  advisory: boolean;
  today: {
    pendingApprovals: Array<{ title: string; category: string; status: string }>;
    activeOpportunities: number;
    highRiskOpportunities: number;
    revenueStreams: number;
    totalEstimatedMonthlyRevenueUsd?: number;
    emergencyStopEngaged: boolean;
    settingsConfirmed: boolean;
  };
  whatChanged: Array<{ type: string; label: string; updatedAt: string }>;
  attention: Array<{ category: string; title: string; reason: string; approvalRequired: boolean }>;
  hasContent: boolean;
}

interface RevenueSnapshot {
  advisory: boolean;
  streamCount: number;
  activeStreamCount: number;
  totalEstimatedMonthlyRevenueUsd?: number;
  totalActualMonthlyRevenueUsd?: number;
  estimatedMargin?: number;
  averageAutomationPercentage?: number;
}

const BUDGET_TIERS = [0, 1000, 5000, 10000, 25000];

const CAPITAL_STYLES: Record<string, string> = {
  NO_COST: 'bg-[#DCFCE7] text-[#15803D]',
  LOW_COST: 'bg-[#DCFCE7] text-[#15803D]',
  CAPITAL_REQUIRED: 'bg-[#FEF3C7] text-[#92400E]',
  UNKNOWN: 'bg-[#E2E8F0] text-[#64748B]',
};

const RISK_STYLES: Record<string, string> = {
  LOW: 'bg-[#DCFCE7] text-[#15803D]',
  MEDIUM: 'bg-[#FEF3C7] text-[#92400E]',
  HIGH: 'bg-[#FEE2E2] text-[#B91C1C]',
  UNKNOWN: 'bg-[#E2E8F0] text-[#64748B]',
};

function inr(value: number): string {
  if (value === 0) return '₹0';
  return `₹${value.toLocaleString('en-IN')}`;
}

export function WorldPanel(): React.JSX.Element {
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const [budget, setBudget] = useState(0);
  const overviewQuery = api.world.overview.useQuery(
    { userId },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  // The budget is part of the query input — changing it re-runs the query.
  const pipelineQuery = api.world.opportunityPipeline.useQuery(
    { userId, budgetInr: budget },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [briefing, setBriefing] = useState<FounderBriefing | null>(null);
  const [revenue, setRevenue] = useState<RevenueSnapshot | null>(null);
  const [error, setError] = useState('');

  // SPRINT-033 — founder briefing + revenue snapshot queries.
  const briefingQuery = api.world.founderBriefing.useQuery(
    { userId },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const revenueQuery = api.world.revenueSnapshot.useQuery(
    { userId },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );

  const load = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setError('');
    try {
      const [overviewResult, pipelineResult, briefingResult, revenueResult] = await Promise.all([
        overviewQuery.refetch(),
        pipelineQuery.refetch(),
        briefingQuery.refetch(),
        revenueQuery.refetch(),
      ]);
      if (overviewResult.data?.success && overviewResult.data.data) {
        setOverview(overviewResult.data.data as unknown as OverviewData);
      } else {
        setError('Could not reach the world model.');
      }
      if (pipelineResult.data?.success && pipelineResult.data.data) {
        setPipeline(pipelineResult.data.data as unknown as PipelineEntry[]);
      }
      if (briefingResult.data?.success && briefingResult.data.data) {
        setBriefing(briefingResult.data.data as unknown as FounderBriefing);
      }
      if (revenueResult.data?.success && revenueResult.data.data) {
        setRevenue(revenueResult.data.data as unknown as RevenueSnapshot);
      }
    } catch {
      setError('Could not reach the world model.');
    }
  }, [userId, overviewQuery, pipelineQuery, briefingQuery, revenueQuery]);

  useEffect(() => {
    void load();
  }, [userId]);

  const onBudget = (tier: number): void => {
    setBudget(tier);
    void load();
  };

  const refresh = (): void => {
    void load();
  };

  // The JSX below references the local refresh helper for the header button.

  const signals = overview?.signals ?? [];
  const unavailableSignals = signals.filter((s) => s.status === 'UNAVAILABLE').length;

  return (
    <div className="w-full" data-testid="world-panel">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151]">
          <Layers className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
          MY WORLD
        </span>
        <button
          onClick={() => {
            refresh();
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#64748B] hover:bg-[#F1F5F9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
          aria-label="Refresh world model"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && (
        <div
          className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 mb-2 text-[12px] text-[#B91C1C]"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Bounded world snapshot */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 mb-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[16px] font-semibold text-[#1F2937]">{overview?.entityCount ?? 0}</p>
            <p className="text-[10px] text-[#64748B]">entities</p>
          </div>
          <div>
            <p className="text-[16px] font-semibold text-[#1F2937]">
              {overview?.businessUnits ?? 0}
            </p>
            <p className="text-[10px] text-[#64748B]">business units</p>
          </div>
          <div>
            <p className="text-[16px] font-semibold text-[#1F2937]">{overview?.roles ?? 0}</p>
            <p className="text-[10px] text-[#64748B]">AI roles</p>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-[#94A3B8]">
          A bounded index of what matters — never a graph of everything.
        </p>
      </div>

      {/* SPRINT-033 Part A — Founder briefing (advisory, no-spam) */}
      {briefing && briefing.hasContent && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 mb-2">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-1">
            <Layers className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
            FOUNDER BRIEFING
          </span>
          {briefing.today.pendingApprovals.length > 0 && (
            <p className="text-[11px] text-[#64748B]">
              {briefing.today.pendingApprovals.length} pending approval
              {briefing.today.pendingApprovals.length === 1 ? '' : 's'}.
            </p>
          )}
          {briefing.today.highRiskOpportunities > 0 && (
            <p className="text-[11px] text-[#B91C1C]">
              {briefing.today.highRiskOpportunities} high-risk opportunity
              {briefing.today.highRiskOpportunities === 1 ? '' : 'ies'} need review.
            </p>
          )}
          {briefing.today.emergencyStopEngaged && (
            <p className="text-[11px] font-medium text-[#B91C1C]">
              Emergency stop is engaged — autonomous activity is halted.
            </p>
          )}
          {!briefing.today.settingsConfirmed && (
            <p className="text-[11px] text-[#92400E]">
              Autonomy settings are not confirmed — the system stays fail-closed.
            </p>
          )}
          <p className="text-[10px] text-[#94A3B8]">
            Advisory only — nothing here approves, spends or executes.
          </p>
        </div>
      )}

      {/* SPRINT-033 Part F — Revenue snapshot (evidence-only) */}
      {revenue && revenue.streamCount > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 mb-2">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-1">
            <LineChart className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
            Revenue snapshot
          </span>
          <p className="text-[11px] text-[#64748B]">
            {revenue.activeStreamCount} active of {revenue.streamCount} streams
            {revenue.totalEstimatedMonthlyRevenueUsd !== undefined
              ? ` · est. ₹${Math.round(revenue.totalEstimatedMonthlyRevenueUsd * 83)}/mo`
              : ' · no revenue evidence yet'}
            {revenue.estimatedMargin !== undefined
              ? ` · advisory margin ${Math.round(revenue.estimatedMargin * 100)}%`
              : ''}
            {revenue.averageAutomationPercentage !== undefined
              ? ` · ${Math.round(revenue.averageAutomationPercentage * 100)}% automated`
              : ''}
          </p>
          <p className="text-[10px] text-[#94A3B8]">Evidence-only figures — never a promise.</p>
        </div>
      )}

      {/* Revenue opportunity pipeline + budget filter */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 mb-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-1">
          <Briefcase className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
          Opportunity pipeline
        </span>
        <div className="flex flex-wrap gap-1 mb-2" role="group" aria-label="Capital budget filter">
          {BUDGET_TIERS.map((tier) => (
            <button
              key={tier}
              onClick={() => {
                onBudget(tier);
              }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                budget === tier
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
              }`}
              aria-pressed={budget === tier}
            >
              {inr(tier)}
            </button>
          ))}
        </div>
        {pipeline.length === 0 ? (
          <p className="text-[12px] text-[#94A3B8]">
            No opportunities ranked yet — scores are advisory, never promises.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {pipeline.slice(0, 4).map((entry) => (
              <li
                key={entry.opportunityId}
                className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-medium text-[#1F2937]">
                    {entry.title}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${CAPITAL_STYLES[entry.capitalMode] ?? CAPITAL_STYLES.UNKNOWN}`}
                  >
                    {entry.capitalMode}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${RISK_STYLES[entry.riskLevel] ?? RISK_STYLES.UNKNOWN}`}
                  >
                    {entry.riskLevel} risk
                  </span>
                  {entry.approvalRequired && (
                    <span className="rounded-full bg-[#F5F3FF] px-1.5 py-0.5 text-[9px] font-medium text-[#7C3AED]">
                      approval required
                    </span>
                  )}
                  {entry.firstStep && (
                    <span className="truncate text-[10px] text-[#94A3B8]">{entry.firstStep}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* External world signals — honest status */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 mb-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-1">
          <Globe className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
          External signals
        </span>
        <p className="text-[11px] text-[#64748B]">
          {signals.length === 0
            ? 'No signal sources connected yet.'
            : unavailableSignals === signals.length
              ? 'No live world-data source is connected — status is UNAVAILABLE, never fabricated.'
              : `${signals.length - unavailableSignals} of ${signals.length} signal sources reachable.`}
        </p>
      </div>

      <p className="mt-1 flex items-center gap-1 px-1 text-[10px] text-[#94A3B8]">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        The world model never executes, spends or authorizes — approval stays with the existing
        authority.
      </p>
    </div>
  );
}
