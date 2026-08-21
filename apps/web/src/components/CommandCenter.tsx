// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Founder Command Center (SPRINT-034 + SPRINT-035)
//
// Presentation/composition ONLY. The Command Center composes the EXISTING
// read models (world overview + founder briefing + revenue snapshot +
// opportunity pipeline + control-plane posture + blueprint approvals + cost)
// into one surface: TODAY / PORTFOLIO / INTELLIGENCE / AUTOMATION / APPROVALS.
//
// SPRINT-035 drill-downs (still presentation-only, still over existing reads):
//   • PORTFOLIO    — expandable revenue-stream cards (identity/kind/status/
//                     revenue+cost evidence/margin/assumptions) + cost view
//                     (measured cost/day + provider split + revenue-vs-cost,
//                     UNKNOWN never displayed as zero)
//   • INTELLIGENCE — expandable opportunity cards (category/evidence/factors/
//                     score/cost/margin/founder involvement/next action)
//   • AUTOMATION   — blueprint approval detail + a BOUNDED owner-scoped
//                     timeline composed from the existing stores
//   • APPROVALS    — full exposure with expandable detail
//   • TODAY        — expandable attention lines
//
// It creates NO new intelligence engine and duplicates NO existing data logic.
// Approvals route ONLY through the existing authority
// (world.decideBlueprintApproval → Brain approve/reject).
// Nothing here executes, spends or authorizes by itself.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Globe,
  LayoutDashboard,
  LineChart,
  RefreshCw,
  ShieldCheck,
  Workflow,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/trpc.js';
import { useAuthStore } from '../stores/auth-store.js';
import { EvidenceEntryPanel } from './EvidenceEntryPanel.js';
import { DigitalTwinSpatial } from './spatial/DigitalTwinSpatial.js';
import { OpportunityRadarSpatial } from './spatial/OpportunityRadarSpatial.js';
import { IntelligenceGraph } from './spatial/IntelligenceGraph.js';
import { buildIntelligenceGraph } from '../lib/intelligence-graph-data.js';
import type { RadarSpatialEntry, TwinDimension } from '../lib/spatial/radar-mappings.js';

interface CommandCenterView {
  ownerId: string;
  generatedAt: string;
  advisory: true;
  today: {
    briefingHasContent: boolean;
    pendingApprovals: Array<{ title: string; category: string; status: string }>;
    highRiskOpportunities: number;
    attention: Array<{
      category: string;
      title: string;
      reason: string;
      approvalRequired: boolean;
    }>;
    changes: Array<{ type: string; label: string; updatedAt: string }>;
    emergencyStopEngaged: boolean;
    settingsConfirmed: boolean;
  };
  portfolio: {
    businessUnits: number;
    revenueStreams: number;
    activeRevenueStreams: number;
    totalEstimatedMonthlyRevenueUsd?: number;
    totalActualMonthlyRevenueUsd?: number;
    costDailyUsd?: number;
    costProviderUsd?: number;
    revenueVsCost?: { label: string; status: string };
    pipelineOpportunities: number;
  };
  intelligence: {
    signals: Array<{ kind: string; status: string }>;
    signalHealth: Array<{
      kind: string;
      status: string;
      lastSuccessAt?: string;
      lastErrorAt?: string;
      lastError?: string;
      configured: boolean;
    }>;
    entityCount: number;
    relationCount: number;
  };
  automation: {
    workflows: number;
    blueprintApprovals: Array<{
      id: string;
      blueprintId: string;
      action: string;
      status: string;
    }>;
    orchestrationPlans: Array<{
      id: string;
      goal: string;
      strategy: string;
      status: string;
      approved: boolean;
      steps: number;
    }>;
  };
  approvals: Array<{
    id: string;
    action: string;
    reason: string;
    businessUnitId?: string;
    workflowId?: string;
    providerId?: string;
    estimatedCostUsd?: number;
    riskLevel: string;
    expectedOutcome?: string;
    reversibility: 'REVERSIBLE' | 'IRREVERSIBLE' | 'UNKNOWN';
    authorityRequired: string;
  }>;
}

interface RevenueRankingEntry {
  streamId: string;
  streamName: string;
  kind: string;
  estimatedMonthlyRevenueUsd?: number;
  actualMonthlyRevenueUsd?: number;
  estimatedMonthlyCostUsd?: number;
  actualMonthlyCostUsd?: number;
  estimatedMargin?: number;
  roiUsd?: number;
  measuredCostUsd?: number;
  rankScore?: number;
  assumptions: string[];
  advisory: true;
}

interface RevenueStreamRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  businessUnitId?: string;
  estimatedMonthlyRevenueUsd?: { value: number; status: string; evidence: string[] };
  actualMonthlyRevenueUsd?: { value: number; status: string; evidence: string[] };
  estimatedMonthlyCostUsd?: { value: number; status: string; evidence: string[] };
  actualMonthlyCostUsd?: { value: number; status: string; evidence: string[] };
  automationPercentage?: { value: number; status: string; evidence: string[] };
  customerCount?: { value: number; status: string; evidence: string[] };
  note?: string;
  createdAt: string;
  updatedAt: string;
}

interface PipelineEntry {
  opportunityId: string;
  title: string;
  category: string;
  status: string;
  score: number;
  capitalMode: string;
  riskLevel: string;
  estimatedCost?: { label: string; status: string };
  estimatedValue?: { label: string; status: string };
  firstStep?: string;
  approvalRequired: boolean;
  evidence: string[];
}

interface TimelineEventRow {
  eventId: string;
  type: string;
  label: string;
  status?: string;
  at: string;
  stableKey: string;
}

interface OpportunityRadarRow {
  problemId: string;
  problemStatement: string;
  status: string;
  revenueState: string;
  level?: number;
  levelLabel?: string;
  scores?: {
    problemScore: number;
    opportunityScore: number;
    experimentScore: number;
  };
  evidenceCount: number;
  hasVerifiedPayment: boolean;
  stopReason?: string;
  nextAction: string;
}

interface OpportunityDrilldownResponse {
  problem: {
    problemStatement: string;
    status: string;
    revenueState: string;
  };
  assessment?: {
    opportunityScore: { value: number };
  } | null;
  observations: Array<{
    observedStatement: string;
    state: string;
    sourceType: string;
    sourceReference: string;
    provenance: { source: string; observedAt: string };
  }>;
  prospects: Array<{
    prospectReference: string;
    customerSegment: string;
    problemDiscussed: string;
    discoveryStatus: string;
  }>;
  nextBestAction: {
    action: string;
    why: string;
    cost: string;
    risk: string;
  } | null;
  revenueState: string;
  verifiedPaymentCount: number;
  advisory: true;
}

interface OpportunityRadarResponse {
  entries: OpportunityRadarRow[];
  counts: {
    newProblems: number;
    validatedProblems: number;
    highValueProblems: number;
    experimentCandidates: number;
    runningExperiments: number;
    completedExperiments: number;
    paymentEvidence: number;
    businessCandidates: number;
    rejectedOpportunities: number;
  };
}

type Tab = 'today' | 'portfolio' | 'intelligence' | 'ecosystem' | 'automation' | 'approvals';

const TABS: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'today', label: 'Today', icon: LayoutDashboard },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'intelligence', label: 'Intelligence', icon: Globe },
  { id: 'ecosystem', label: 'Ecosystem', icon: BrainCircuit },
  { id: 'automation', label: 'Automation', icon: Workflow },
  { id: 'approvals', label: 'Approvals', icon: ShieldCheck },
];

const RISK_STYLES: Record<string, string> = {
  LOW: 'bg-[#DCFCE7] text-[#15803D]',
  MEDIUM: 'bg-[#FEF3C7] text-[#92400E]',
  HIGH: 'bg-[#FEE2E2] text-[#B91C1C]',
  UNKNOWN: 'bg-[#E2E8F0] text-[#64748B]',
};

const TIMELINE_TYPE_LABELS: Record<string, string> = {
  OPPORTUNITY: 'opportunity',
  OUTCOME: 'outcome',
  APPROVAL: 'approval',
  REVENUE: 'revenue',
};

// Presentational projection OpportunityRadarRow -> spatial view model. Pure
// field copy (opportunityScore surfaces from the existing advisory score).
function toSpatialEntry(e: OpportunityRadarRow): RadarSpatialEntry {
  return {
    problemId: e.problemId,
    problemStatement: e.problemStatement,
    opportunityScore: e.scores?.opportunityScore,
    evidenceCount: e.evidenceCount,
    hasVerifiedPayment: e.hasVerifiedPayment,
    revenueState: e.revenueState,
    nextAction: e.nextAction,
    stopReason: e.stopReason,
  };
}

// Presentational projection of the EXISTING Command Center reads into Digital
// Twin dimensions. Pure composition — no new queries, no invented state:
//   • opportunities ← opportunityRadar entry count (0 is a real empty)
//   • evidence      ← sum of recorded evidenceCount across radar entries
//   • progress      ← opportunity pipeline count (real, not a score)
// Only dimensions backed by actually-loaded data are emitted; a dimension
// whose data source has not loaded is omitted (the twin renders UNKNOWN),
// never fabricated as a 0 score.
export function twinDimensionsFromCommandCenter(args: {
  radar: OpportunityRadarResponse | null;
  pipeline: PipelineEntry[];
}): TwinDimension[] {
  const dims: TwinDimension[] = [];
  if (args.radar) {
    const totalEvidence = args.radar.entries.reduce((n, e) => n + e.evidenceCount, 0);
    dims.push({
      key: 'opportunities',
      label: 'Opportunities',
      value: args.radar.entries.length,
      note:
        args.radar.entries.length === 1
          ? '1 tracked opportunity'
          : `${args.radar.entries.length} tracked opportunities`,
    });
    dims.push({
      key: 'evidence',
      label: 'Evidence',
      value: totalEvidence,
      note: totalEvidence === 0 ? 'no evidence records yet' : `${totalEvidence} evidence records`,
    });
  }
  if (args.pipeline.length > 0) {
    dims.push({
      key: 'progress',
      label: 'Progress',
      value: args.pipeline.length,
      note:
        args.pipeline.length === 1
          ? '1 pipeline opportunity'
          : `${args.pipeline.length} pipeline opportunities`,
    });
  }
  return dims;
}

export function CommandCenter(): React.JSX.Element {
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const [tab, setTab] = useState<Tab>('today');
  const [view, setView] = useState<CommandCenterView | null>(null);
  const [ranking, setRanking] = useState<RevenueRankingEntry[]>([]);
  const [streams, setStreams] = useState<RevenueStreamRow[]>([]);
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEventRow[]>([]);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [radar, setRadar] = useState<OpportunityRadarResponse | null>(null);
  const [radarView, setRadarView] = useState<'list' | 'spatial'>('list');
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState<string | null>(null);
  const [decideError, setDecideError] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const commandQuery = api.world.commandCenter.useQuery(
    { userId },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const rankingQuery = api.world.revenueRanking.useQuery(
    { userId },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const streamsQuery = api.world.listRevenueStreams.useQuery(
    { userId },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const pipelineQuery = api.world.opportunityPipeline.useQuery(
    { userId, limit: 8 },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const timelineQuery = api.world.timeline.useQuery(
    { userId, limit: 10, offset: 0 },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const radarQuery = api.world.opportunityRadar.useQuery(
    { userId, limit: 50 },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const [drilldownId, setDrilldownId] = useState<string | null>(null);
  const drilldownQuery = api.world.opportunityDrilldownView.useQuery(
    { userId, problemId: drilldownId ?? '' },
    { enabled: userId.length > 0 && drilldownId !== null, refetchOnWindowFocus: false },
  );
  const decideMutation = api.world.decideBlueprintApproval.useMutation();

  const loadTimeline = useCallback(
    async (_offset: number): Promise<void> => {
      if (!userId) return;
      try {
        const result = await timelineQuery.refetch();
        const raw = result.data?.data;
        const data = (raw ?? {}) as { events?: TimelineEventRow[]; hasMore?: boolean };
        setTimeline(data.events ?? []);
        setTimelineHasMore(data.hasMore === true);
      } catch {
        setError('Could not reach the command center.');
      }
    },
    [userId],
  );

  const load = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setError('');
    try {
      const [
        commandResult,
        rankingResult,
        streamsResult,
        pipelineResult,
        timelineResult,
        radarResult,
      ] = await Promise.all([
        commandQuery.refetch(),
        rankingQuery.refetch(),
        streamsQuery.refetch(),
        pipelineQuery.refetch(),
        timelineQuery.refetch(),
        radarQuery.refetch(),
      ]);
      if (commandResult.data?.success && commandResult.data.data) {
        setView(commandResult.data.data as unknown as CommandCenterView);
      } else {
        setError('Could not reach the command center.');
      }
      if (rankingResult.data?.success && rankingResult.data.data) {
        setRanking(
          (rankingResult.data.data as unknown as { entries?: RevenueRankingEntry[] }).entries ?? [],
        );
      }
      if (streamsResult.data?.success && streamsResult.data.data) {
        setStreams(streamsResult.data.data as unknown as RevenueStreamRow[]);
      }
      if (pipelineResult.data?.success && pipelineResult.data.data) {
        setPipeline(pipelineResult.data.data as unknown as PipelineEntry[]);
      }
      if (timelineResult.data?.success && timelineResult.data.data) {
        const data = timelineResult.data.data as unknown as {
          events?: TimelineEventRow[];
          hasMore?: boolean;
        };
        setTimeline(data.events ?? []);
        setTimelineHasMore(data.hasMore === true);
      }
      if (radarResult.data?.success && radarResult.data.data) {
        setRadar(radarResult.data.data as unknown as OpportunityRadarResponse);
      }
    } catch {
      setError('Could not reach the command center.');
    }
  }, [userId, commandQuery, rankingQuery, streamsQuery, pipelineQuery, timelineQuery, radarQuery]);

  useEffect(() => {
    void load();
  }, [userId]);

  const decide = async (requestId: string, decision: 'APPROVED' | 'REJECTED'): Promise<void> => {
    if (!userId) return;
    setDeciding(requestId);
    setDecideError('');
    try {
      const result = await decideMutation.mutateAsync({ userId, requestId, decision });
      if (!result.success) {
        setDecideError(
          (result.error as { message?: string }).message ?? 'The approval authority refused.',
        );
      }
      void load();
    } catch {
      setDecideError('Could not reach the approval authority.');
    } finally {
      setDeciding(null);
    }
  };

  const toggle = (key: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const twinDimensions = useMemo(
    () => twinDimensionsFromCommandCenter({ radar, pipeline }),
    [radar, pipeline],
  );
  const unavailableSignals = (
    view?.intelligence.signalHealth ??
    view?.intelligence.signals ??
    []
  ).filter((s) => s.status === 'UNAVAILABLE' || s.status === 'ERROR').length;
  const signals = view?.intelligence.signalHealth.length
    ? view.intelligence.signalHealth
    : (view?.intelligence.signals ?? []);
  const waitingApprovals = view?.approvals ?? [];
  const today = view?.today;
  const portfolio = view?.portfolio;

  return (
    <div className="w-full" data-testid="command-center">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151]">
          <LayoutDashboard className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
          FOUNDER COMMAND CENTER
        </span>
        <button
          onClick={() => {
            void load();
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#64748B] hover:bg-[#F1F5F9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
          aria-label="Refresh command center"
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

      {/* Tabs (mobile-friendly: stacked, touch targets) */}
      <div
        className="flex flex-wrap gap-1 mb-2"
        role="tablist"
        aria-label="Command center sections"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const count =
            id === 'approvals'
              ? waitingApprovals.length
              : id === 'today'
                ? (today?.attention.length ?? 0)
                : 0;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                tab === id
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
              }`}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {label}
              {count > 0 && id === 'approvals' && (
                <span className="rounded-full bg-[#FEE2E2] text-[#B91C1C] px-1.5 text-[9px] font-semibold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {today?.emergencyStopEngaged && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 mb-2 text-[12px] text-[#B91C1C] flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Emergency stop is engaged — autonomous activity is halted.
        </div>
      )}
      {today && !today.settingsConfirmed && (
        <p className="text-[11px] text-[#92400E] px-1 mb-2">
          Autonomy settings are not confirmed — the system stays fail-closed.
        </p>
      )}

      {/* ── TODAY ─────────────────────────────────────────────────────── */}
      {tab === 'today' && (
        <div className="space-y-2" role="tabpanel" aria-label="Today">
          {!today?.briefingHasContent && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] text-[#64748B]">
                No briefing content yet — nothing urgent needs attention. (No spam by design.)
              </p>
            </div>
          )}
          {today?.pendingApprovals.length ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] font-medium text-[#1F2937] mb-1">Pending approvals</p>
              <ul className="space-y-1">
                {today.pendingApprovals.slice(0, 4).map((p) => (
                  <li key={p.title} className="flex items-center gap-2 text-[11px] text-[#64748B]">
                    <ShieldCheck className="h-3 w-3 text-[#7C3AED]" aria-hidden="true" />
                    <span className="truncate">{p.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {today && today.highRiskOpportunities > 0 && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
              <p className="text-[12px] font-medium text-[#B91C1C]">
                {today.highRiskOpportunities} high-risk opportunity
                {today.highRiskOpportunities === 1 ? '' : 'ies'} need review.
              </p>
            </div>
          )}
          {today?.attention.length ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] font-medium text-[#1F2937] mb-1">Needs attention</p>
              <ul className="space-y-1.5">
                {today.attention.slice(0, 5).map((a) => (
                  <li
                    key={`${a.category}-${a.title}`}
                    className="rounded-lg bg-white border border-[#E2E8F0]"
                  >
                    <button
                      onClick={() => {
                        toggle(`attention-${a.category}-${a.title}`);
                      }}
                      aria-expanded={expanded.has(`attention-${a.category}-${a.title}`)}
                      className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-lg"
                    >
                      {expanded.has(`attention-${a.category}-${a.title}`) ? (
                        <ChevronDown
                          className="h-3 w-3 shrink-0 text-[#94A3B8]"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronRight
                          className="h-3 w-3 shrink-0 text-[#94A3B8]"
                          aria-hidden="true"
                        />
                      )}
                      <span className="text-[12px] font-medium text-[#1F2937]">{a.title}</span>
                    </button>
                    {expanded.has(`attention-${a.category}-${a.title}`) && (
                      <div className="px-2.5 pb-2 text-[10px] text-[#64748B] space-y-0.5">
                        <p>why it matters: {a.reason}</p>
                        <p>category: {a.category}</p>
                        <p>approval required: {a.approvalRequired ? 'yes' : 'no'}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {today?.changes.length ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] font-medium text-[#1F2937] mb-1">What changed</p>
              <ul className="space-y-1">
                {today.changes.slice(0, 5).map((c) => (
                  <li key={`${c.type}-${c.label}`} className="text-[11px] text-[#64748B] truncate">
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {/* ── PORTFOLIO ─────────────────────────────────────────────────── */}
      {tab === 'portfolio' && (
        <div className="space-y-2" role="tabpanel" aria-label="Portfolio">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2">
              <p className="text-[16px] font-semibold text-[#1F2937]">
                {portfolio?.businessUnits ?? 0}
              </p>
              <p className="text-[10px] text-[#64748B]">business units</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2">
              <p className="text-[16px] font-semibold text-[#1F2937]">
                {portfolio?.revenueStreams ?? 0}
              </p>
              <p className="text-[10px] text-[#64748B]">revenue streams</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2">
              <p className="text-[16px] font-semibold text-[#1F2937]">
                {portfolio?.pipelineOpportunities ?? 0}
              </p>
              <p className="text-[10px] text-[#64748B]">pipeline opportunities</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2">
              <p className="text-[16px] font-semibold text-[#1F2937]">
                {portfolio?.costDailyUsd !== undefined
                  ? `$${portfolio.costDailyUsd.toFixed(3)}`
                  : '—'}
              </p>
              <p className="text-[10px] text-[#64748B]">measured cost / day</p>
            </div>
          </div>
          {portfolio?.costProviderUsd !== undefined && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] text-[#64748B]">
                Measured provider cost (observed):{' '}
                <span className="font-medium text-[#1F2937]">
                  ${portfolio.costProviderUsd.toFixed(3)}
                </span>
              </p>
            </div>
          )}
          {portfolio?.revenueVsCost && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[11px] text-[#64748B]">
                <span className="font-medium text-[#1F2937]">
                  {portfolio.revenueVsCost.status}:
                </span>{' '}
                {portfolio.revenueVsCost.label}
              </p>
            </div>
          )}
          {portfolio?.totalEstimatedMonthlyRevenueUsd !== undefined && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] text-[#64748B]">
                Estimated monthly revenue (evidence-backed):{' '}
                <span className="font-medium text-[#1F2937]">
                  ${portfolio.totalEstimatedMonthlyRevenueUsd.toFixed(2)}
                </span>
              </p>
              <p className="text-[10px] text-[#94A3B8]">
                Estimates only — never a revenue promise.
              </p>
            </div>
          )}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-1">
              <LineChart className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
              Cost-weighted revenue ranking
            </span>
            {ranking.length === 0 ? (
              <p className="text-[11px] text-[#94A3B8]">
                No revenue streams with cost evidence yet — UNKNOWN cost is never treated as zero.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {ranking.slice(0, 5).map((entry) => (
                  <li
                    key={entry.streamId}
                    className="rounded-lg bg-white border border-[#E2E8F0] px-2.5 py-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-medium text-[#1F2937]">
                        {entry.streamName}
                      </span>
                      {entry.rankScore !== undefined ? (
                        <span className="shrink-0 rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[9px] font-medium text-[#15803D]">
                          ROI {entry.roiUsd?.toFixed(1)}×
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-[#E2E8F0] px-1.5 py-0.5 text-[9px] font-medium text-[#64748B]">
                          no margin evidence
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">
                      {entry.assumptions[0] ?? 'Advisory only.'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-[#94A3B8] mt-1">
              Ranked by margin-aware ROI — never pure revenue. Advisory, never a promise.
            </p>
          </div>
          {streams.length > 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] font-medium text-[#1F2937] mb-1">Revenue streams</p>
              <ul className="space-y-1.5">
                {streams.slice(0, 6).map((stream) => {
                  const key = `stream-${stream.id}`;
                  const expandedState = expanded.has(key);
                  return (
                    <li key={stream.id} className="rounded-lg bg-white border border-[#E2E8F0]">
                      <button
                        onClick={() => {
                          toggle(key);
                        }}
                        aria-expanded={expandedState}
                        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-lg"
                      >
                        {expandedState ? (
                          <ChevronDown
                            className="h-3 w-3 shrink-0 text-[#94A3B8]"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight
                            className="h-3 w-3 shrink-0 text-[#94A3B8]"
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate text-[12px] font-medium text-[#1F2937]">
                          {stream.name}
                        </span>
                        <span className="ml-auto shrink-0 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-medium text-[#64748B]">
                          {stream.status}
                        </span>
                      </button>
                      {expandedState && (
                        <div className="px-2.5 pb-2 text-[10px] text-[#64748B] space-y-0.5">
                          <p>kind: {stream.kind}</p>
                          <p>
                            revenue (est):{' '}
                            {stream.estimatedMonthlyRevenueUsd
                              ? `$${stream.estimatedMonthlyRevenueUsd.value.toFixed(2)} (${stream.estimatedMonthlyRevenueUsd.status})`
                              : 'UNKNOWN'}
                          </p>
                          <p>
                            revenue (actual):{' '}
                            {stream.actualMonthlyRevenueUsd
                              ? `$${stream.actualMonthlyRevenueUsd.value.toFixed(2)} (${stream.actualMonthlyRevenueUsd.status})`
                              : 'UNKNOWN'}
                          </p>
                          <p>
                            cost (est):{' '}
                            {stream.estimatedMonthlyCostUsd
                              ? `$${stream.estimatedMonthlyCostUsd.value.toFixed(2)} (${stream.estimatedMonthlyCostUsd.status})`
                              : 'UNKNOWN'}
                          </p>
                          <p>
                            cost (actual):{' '}
                            {stream.actualMonthlyCostUsd
                              ? `$${stream.actualMonthlyCostUsd.value.toFixed(2)} (${stream.actualMonthlyCostUsd.status})`
                              : 'UNKNOWN'}
                          </p>
                          <p>
                            automation:{' '}
                            {stream.automationPercentage
                              ? `${Math.round(stream.automationPercentage.value * 100)}%`
                              : 'UNKNOWN'}
                          </p>
                          {stream.note && <p>note: {stream.note}</p>}
                          <p className="text-[9px] text-[#94A3B8]">
                            Unknown figures are never treated as zero.
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── INTELLIGENCE ──────────────────────────────────────────────── */}
      {tab === 'intelligence' && (
        <div className="space-y-2" role="tabpanel" aria-label="Intelligence">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2">
              <p className="text-[16px] font-semibold text-[#1F2937]">
                {view?.intelligence.entityCount ?? 0}
              </p>
              <p className="text-[10px] text-[#64748B]">world entities</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2">
              <p className="text-[16px] font-semibold text-[#1F2937]">
                {view?.intelligence.relationCount ?? 0}
              </p>
              <p className="text-[10px] text-[#64748B]">relations</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-1">
              <Globe className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
              World signals
            </span>
            <p className="text-[11px] text-[#64748B]">
              {signals.length === 0
                ? 'No signal sources connected yet.'
                : unavailableSignals === signals.length
                  ? 'No live world-data source is reachable — status is UNAVAILABLE/ERROR, never fabricated.'
                  : `${signals.length - unavailableSignals} of ${signals.length} signal sources reachable.`}
            </p>
            {signals.length > 0 && (
              <ul className="space-y-1 mt-1.5">
                {signals.slice(0, 6).map((s) => (
                  <li
                    key={s.kind}
                    className="flex items-center gap-2 rounded-lg bg-white border border-[#E2E8F0] px-2.5 py-1.5 text-[10px]"
                  >
                    <span className="truncate text-[#1F2937]">{s.kind}</span>
                    <span className="ml-auto shrink-0 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 font-medium text-[#64748B]">
                      {s.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[9px] text-[#94A3B8] mt-1">
              Signal health is honest — a source is AVAILABLE only after a real observation.
            </p>
          </div>
          {pipeline.length > 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] font-medium text-[#1F2937] mb-1">Opportunity pipeline</p>
              <ul className="space-y-1.5">
                {pipeline.slice(0, 6).map((opportunity) => {
                  const key = `opp-${opportunity.opportunityId}`;
                  const expandedState = expanded.has(key);
                  return (
                    <li
                      key={opportunity.opportunityId}
                      className="rounded-lg bg-white border border-[#E2E8F0]"
                    >
                      <button
                        onClick={() => {
                          toggle(key);
                        }}
                        aria-expanded={expandedState}
                        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-lg"
                      >
                        {expandedState ? (
                          <ChevronDown
                            className="h-3 w-3 shrink-0 text-[#94A3B8]"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight
                            className="h-3 w-3 shrink-0 text-[#94A3B8]"
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate text-[12px] font-medium text-[#1F2937]">
                          {opportunity.title}
                        </span>
                        <span className="ml-auto shrink-0 rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[9px] font-medium text-[#15803D]">
                          {opportunity.score.toFixed(2)}
                        </span>
                      </button>
                      {expandedState && (
                        <div className="px-2.5 pb-2 text-[10px] text-[#64748B] space-y-0.5">
                          <p>category: {opportunity.category}</p>
                          <p>status: {opportunity.status}</p>
                          <p>
                            capital mode: {opportunity.capitalMode} · risk: {opportunity.riskLevel}
                          </p>
                          <p>
                            estimated cost:{' '}
                            {opportunity.estimatedCost
                              ? `${opportunity.estimatedCost.label} (${opportunity.estimatedCost.status})`
                              : 'UNKNOWN'}
                          </p>
                          <p>
                            estimated value:{' '}
                            {opportunity.estimatedValue
                              ? `${opportunity.estimatedValue.label} (${opportunity.estimatedValue.status})`
                              : 'UNKNOWN'}
                          </p>
                          <p>next action: {opportunity.firstStep ?? 'UNKNOWN'}</p>
                          <p>approval required: {opportunity.approvalRequired ? 'yes' : 'no'}</p>
                          {opportunity.evidence.length > 0 && (
                            <p>evidence: {opportunity.evidence.slice(0, 3).join('; ')}</p>
                          )}
                          <p className="text-[9px] text-[#94A3B8]">
                            Advisory score — never a promise, never a launch.
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {/* SPRINT-038 — Opportunity Radar (Part I). Presentation/composition
              ONLY: stage counts + per-problem WHAT/WHY/EVIDENCE/ECONOMICS/
              COST/EXPERIMENT/RESULT/NEXT ACTION over the existing problem
              read model. Empty datasets are shown as EMPTY — never
              fabricated. */}
          {/* SPRINT-042 — founder evidence ENTRY surface. Presentation-only
              read models meet the mutation surface: the founder records
              problems / observations / prospects / verified payments through
              the EXISTING gateway procedures (pure composition, no new
              engine); onSaved() refreshes the radar + drill-down below. */}
          <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 mb-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151]">
              <Briefcase className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
              Founder evidence
            </span>
            <EvidenceEntryPanel onSaved={() => void load()} />
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151]">
                <Briefcase className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
                Opportunity radar
              </span>
              {/* SPRINT-043D — presentation-level List/Radar toggle. Switches
                  the SAME already-fetched radar data between the dense list
                  (a11y/information fallback) and the SVG spatial view. No new
                  route, no new data-fetching, no duplicate gateway calls. */}
              <div
                className="flex rounded-lg bg-[#F1F5F9] p-0.5"
                role="group"
                aria-label="Opportunity radar view"
              >
                <button
                  type="button"
                  onClick={() => {
                    setRadarView('list');
                  }}
                  aria-pressed={radarView === 'list'}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                    radarView === 'list'
                      ? 'bg-white text-[#1F2937] shadow-sm'
                      : 'text-[#64748B] hover:text-[#1F2937]'
                  }`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRadarView('spatial');
                  }}
                  aria-pressed={radarView === 'spatial'}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                    radarView === 'spatial'
                      ? 'bg-white text-[#1F2937] shadow-sm'
                      : 'text-[#64748B] hover:text-[#1F2937]'
                  }`}
                >
                  Radar
                </button>
              </div>
            </div>
            {!radar ? (
              <p className="text-[11px] text-[#94A3B8]">
                No problems registered yet — the radar is EMPTY until real observations are entered
                (never fabricated).
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <div className="rounded-lg bg-white border border-[#E2E8F0] px-2 py-1.5 text-center">
                    <p className="text-[14px] font-semibold text-[#1F2937]">
                      {radar.counts.newProblems}
                    </p>
                    <p className="text-[9px] text-[#64748B]">new problems</p>
                  </div>
                  <div className="rounded-lg bg-white border border-[#E2E8F0] px-2 py-1.5 text-center">
                    <p className="text-[14px] font-semibold text-[#1F2937]">
                      {radar.counts.experimentCandidates}
                    </p>
                    <p className="text-[9px] text-[#64748B]">experiment candidates</p>
                  </div>
                  <div className="rounded-lg bg-white border border-[#E2E8F0] px-2 py-1.5 text-center">
                    <p className="text-[14px] font-semibold text-[#1F2937]">
                      {radar.counts.paymentEvidence}
                    </p>
                    <p className="text-[9px] text-[#64748B]">payment evidence</p>
                  </div>
                  <div className="rounded-lg bg-white border border-[#E2E8F0] px-2 py-1.5 text-center">
                    <p className="text-[14px] font-semibold text-[#1F2937]">
                      {radar.counts.businessCandidates}
                    </p>
                    <p className="text-[9px] text-[#64748B]">business candidates</p>
                  </div>
                  <div className="rounded-lg bg-white border border-[#E2E8F0] px-2 py-1.5 text-center">
                    <p className="text-[14px] font-semibold text-[#1F2937]">
                      {radar.counts.validatedProblems}
                    </p>
                    <p className="text-[9px] text-[#64748B]">validated problems</p>
                  </div>
                  <div className="rounded-lg bg-white border border-[#E2E8F0] px-2 py-1.5 text-center">
                    <p className="text-[14px] font-semibold text-[#1F2937]">
                      {radar.counts.highValueProblems}
                    </p>
                    <p className="text-[9px] text-[#64748B]">high-value problems</p>
                  </div>
                </div>
                {radarView === 'spatial' ? (
                  /* SPRINT-043D — SVG spatial view over the SAME entries. The
                     component owns its honest empty/UNKNOWN/STOP rendering and
                     delegates all mapping to lib/spatial/radar-mappings. */
                  <OpportunityRadarSpatial entries={radar.entries.map(toSpatialEntry)} />
                ) : radar.entries.length === 0 ? (
                  <p className="text-[11px] text-[#94A3B8]">
                    No radar entries yet — the dataset is EMPTY by design.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {radar.entries.slice(0, 8).map((entry) => {
                      const key = `radar-${entry.problemId}`;
                      const expandedState = expanded.has(key);
                      return (
                        <li
                          key={entry.problemId}
                          className="rounded-lg bg-white border border-[#E2E8F0]"
                        >
                          <button
                            onClick={() => {
                              toggle(key);
                              setDrilldownId(expandedState ? null : entry.problemId);
                            }}
                            aria-expanded={expandedState}
                            className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-lg"
                          >
                            {expandedState ? (
                              <ChevronDown
                                className="h-3 w-3 shrink-0 text-[#94A3B8]"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronRight
                                className="h-3 w-3 shrink-0 text-[#94A3B8]"
                                aria-hidden="true"
                              />
                            )}
                            <span className="truncate text-[12px] font-medium text-[#1F2937]">
                              {entry.problemStatement}
                            </span>
                            <span className="ml-auto shrink-0 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-medium text-[#64748B]">
                              {entry.levelLabel ?? 'UNKNOWN'}
                            </span>
                          </button>
                          {expandedState && (
                            <div className="px-2.5 pb-2 text-[10px] text-[#64748B] space-y-0.5">
                              <p>status: {entry.status}</p>
                              <p>revenue state: {entry.revenueState}</p>
                              {entry.scores && (
                                <p>
                                  scores — problem {entry.scores.problemScore.toFixed(2)} ·
                                  opportunity {entry.scores.opportunityScore.toFixed(2)} ·
                                  experiment {entry.scores.experimentScore.toFixed(2)} (advisory)
                                </p>
                              )}
                              <p>
                                evidence: {entry.evidenceCount} record
                                {entry.evidenceCount === 1 ? '' : 's'}
                                {entry.hasVerifiedPayment ? ' · verified payment ✓' : ''}
                              </p>
                              {entry.stopReason && (
                                <p className="text-[#B91C1C]">
                                  STOP recommended: {entry.stopReason}
                                </p>
                              )}
                              <p>next action: {entry.nextAction}</p>
                              <p className="text-[9px] text-[#94A3B8]">
                                Interest is not revenue — only a verified payment is revenue
                                evidence.
                              </p>
                              {/* SPRINT-039 — bounded drill-down: PROBLEM /
                                  EVIDENCE / CUSTOMERS / DECISION from the
                                  existing read model (never fabricated). */}
                              {drilldownId === entry.problemId && (
                                <div className="mt-1.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] p-1.5 space-y-1">
                                  {drilldownQuery.isLoading && (
                                    <p className="text-[#64748B]">Loading drill-down…</p>
                                  )}
                                  {drilldownQuery.error && (
                                    <p className="text-[#B91C1C]">Drill-down unavailable.</p>
                                  )}
                                  {drilldownQuery.data?.success && drilldownQuery.data.data
                                    ? ((): React.JSX.Element => {
                                        const dd = drilldownQuery.data
                                          .data as unknown as OpportunityDrilldownResponse;
                                        return (
                                          <>
                                            <p className="font-medium text-[#374151]">
                                              Evidence ({dd.observations.length})
                                            </p>
                                            {dd.observations.length === 0 ? (
                                              <p>No observations recorded yet — EMPTY by design.</p>
                                            ) : (
                                              <ul className="space-y-0.5">
                                                {dd.observations.slice(0, 3).map((o, i) => (
                                                  <li key={`obs-${i}`} className="truncate">
                                                    {o.observedStatement} ·{' '}
                                                    <span className="text-[#94A3B8]">
                                                      {o.state} · {o.provenance.source}
                                                    </span>
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                            <p className="font-medium text-[#374151] mt-1">
                                              Prospects ({dd.prospects.length})
                                            </p>
                                            {dd.prospects.length === 0 ? (
                                              <p>
                                                No customer discovery records yet — EMPTY by design.
                                              </p>
                                            ) : (
                                              <ul className="space-y-0.5">
                                                {dd.prospects.slice(0, 3).map((p, i) => (
                                                  <li key={`pro-${i}`} className="truncate">
                                                    {p.prospectReference} · {p.discoveryStatus}
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                            {dd.nextBestAction && (
                                              <>
                                                <p className="font-medium text-[#374151] mt-1">
                                                  Next best action
                                                </p>
                                                <p>
                                                  {dd.nextBestAction.action} —{' '}
                                                  {dd.nextBestAction.why}
                                                </p>
                                                <p className="text-[#94A3B8]">
                                                  cost: {dd.nextBestAction.cost} · risk:{' '}
                                                  {dd.nextBestAction.risk}
                                                </p>
                                              </>
                                            )}
                                            <p className="text-[#94A3B8]">
                                              revenue state: {dd.revenueState} ·{' '}
                                              {dd.verifiedPaymentCount} verified payment
                                              {dd.verifiedPaymentCount === 1 ? '' : 's'} · advisory
                                            </p>
                                          </>
                                        );
                                      })()
                                    : null}
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="text-[9px] text-[#94A3B8] mt-1">
                  Advisory radar over your own evidence — never fabricated customers, revenue or
                  market data.
                </p>
              </>
            )}
          </div>

          {/* SPRINT-043D — Digital Twin. A 2D/SVG orbital model of the
              founder's CURRENT operating state — NOT a human avatar. Dimensions
              are composed ONLY from the Command Center reads already fetched
              above (opportunities/evidence from the radar, progress from the
              pipeline): no new queries, no invented state. The twin component
              itself owns the honest forming/UNKNOWN rendering. */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-1">
              <Globe className="h-3.5 w-3.5 text-[#0EA5A9]" aria-hidden="true" />
              Digital Twin
            </span>
            <DigitalTwinSpatial dimensions={twinDimensions} />
            <p className="text-[9px] text-[#94A3B8] mt-1">
              Your operating state — each ring reveals itself only from recorded data. UNKNOWN is
              never shown as a score.
            </p>
          </div>
        </div>
      )}

      {/* ── AUTOMATION ────────────────────────────────────────────────── */}
      {tab === 'automation' && (
        <div className="space-y-2" role="tabpanel" aria-label="Automation">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-1">
              <Workflow className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
              Workflows & blueprints
            </span>
            <p className="text-[11px] text-[#64748B]">
              {view?.automation.workflows ?? 0} defined workflows ·{' '}
              {(view?.automation.blueprintApprovals ?? []).length} blueprint approval request
              {(view?.automation.blueprintApprovals ?? []).length === 1 ? '' : 's'}
            </p>
            {(view?.automation.blueprintApprovals ?? []).length > 0 && (
              <ul className="space-y-1 mt-1.5">
                {(view?.automation.blueprintApprovals ?? []).slice(0, 5).map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-2 rounded-lg bg-white border border-[#E2E8F0] px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="truncate text-[#1F2937]">{b.action}</span>
                    <span className="shrink-0 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-medium text-[#64748B]">
                      {b.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-[#94A3B8] mt-1">
              Blueprints never execute — execution stays with the existing bridge after approval.
            </p>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-1">
              <Workflow className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
              Multi-provider orchestration plans
            </span>
            {(view?.automation.orchestrationPlans ?? []).length === 0 ? (
              <p className="text-[11px] text-[#94A3B8]">
                No orchestration plans yet — plan a multi-provider workflow from the World panel.
              </p>
            ) : (
              <ul className="space-y-1 mt-1.5">
                {(view?.automation.orchestrationPlans ?? []).slice(0, 5).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg bg-white border border-[#E2E8F0] px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="truncate text-[#1F2937]">{p.goal}</span>
                    <span className="shrink-0 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-medium text-[#64748B]">
                      {p.strategy} · {p.steps} steps
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                        p.approved ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEF3C7] text-[#92400E]'
                      }`}
                    >
                      {p.approved ? 'APPROVED' : p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-[#94A3B8] mt-1">
              Plans are representations — only an approved plan is submitted to the existing
              execution bridge.
            </p>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <p className="text-[12px] font-medium text-[#1F2937] mb-1">Recent activity</p>
            {timeline.length === 0 ? (
              <p className="text-[11px] text-[#94A3B8]">
                No activity yet — the timeline is bounded and owner-scoped.
              </p>
            ) : (
              <ul className="space-y-1">
                {timeline.slice(0, 10).map((event) => (
                  <li
                    key={event.eventId}
                    className="flex items-center gap-2 rounded-lg bg-white border border-[#E2E8F0] px-2.5 py-1.5 text-[10px]"
                  >
                    <span className="shrink-0 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 font-medium text-[#64748B]">
                      {TIMELINE_TYPE_LABELS[event.type] ?? event.type}
                    </span>
                    <span className="truncate text-[#1F2937]">{event.label}</span>
                    {event.status && (
                      <span className="shrink-0 text-[#94A3B8]">{event.status}</span>
                    )}
                    <span className="ml-auto shrink-0 text-[9px] text-[#94A3B8]">
                      {new Date(event.at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {timelineHasMore && (
              <button
                onClick={() => {
                  void loadTimeline(0);
                }}
                className="mt-1.5 text-[10px] text-[#7C3AED] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded"
              >
                Load more
              </button>
            )}
            <p className="text-[9px] text-[#94A3B8] mt-1">
              Bounded history — never an unbounded query.
            </p>
          </div>
        </div>
      )}

      {/* ── ECOSYSTEM / INTELLIGENCE GRAPH (SPRINT-055) ──────────────── */}
      {tab === 'ecosystem' && (
        <div className="space-y-2" role="tabpanel" aria-label="Ecosystem">
          <IntelligenceGraph data={buildIntelligenceGraph()} />
        </div>
      )}

      {/* ── APPROVALS ─────────────────────────────────────────────────── */}
      {tab === 'approvals' && (
        <div className="space-y-2" role="tabpanel" aria-label="Approvals">
          {decideError && (
            <div
              className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[11px] text-[#B91C1C]"
              role="alert"
            >
              {decideError}
            </div>
          )}
          {waitingApprovals.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] text-[#64748B]">
                No pending approvals. Nothing can execute or spend without your explicit approval.
              </p>
            </div>
          ) : (
            waitingApprovals.map((approval) => {
              const key = `approval-${approval.id}`;
              const expandedState = expanded.has(key);
              return (
                <div
                  key={approval.id}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        toggle(key);
                      }}
                      aria-expanded={expandedState}
                      className="flex items-center gap-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded"
                    >
                      {expandedState ? (
                        <ChevronDown
                          className="h-3 w-3 shrink-0 text-[#94A3B8]"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronRight
                          className="h-3 w-3 shrink-0 text-[#94A3B8]"
                          aria-hidden="true"
                        />
                      )}
                      <span className="text-[12px] font-medium text-[#1F2937]">
                        {approval.action}
                      </span>
                    </button>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${RISK_STYLES[approval.riskLevel] ?? RISK_STYLES.UNKNOWN}`}
                    >
                      {approval.riskLevel} risk
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">{approval.reason}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px] text-[#94A3B8]">
                    {approval.providerId && <span>provider: {approval.providerId}</span>}
                    {approval.estimatedCostUsd !== undefined && (
                      <span>est. cost: ${approval.estimatedCostUsd.toFixed(2)}</span>
                    )}
                    <span>reversibility: {approval.reversibility}</span>
                    <span>authority required: {approval.authorityRequired}</span>
                  </div>
                  {expandedState && (
                    <div className="mt-1.5 space-y-0.5 text-[10px] text-[#64748B]">
                      {approval.businessUnitId && <p>business: {approval.businessUnitId}</p>}
                      {approval.workflowId && <p>workflow: {approval.workflowId}</p>}
                      <p>authority: {approval.authorityRequired}</p>
                      {approval.expectedOutcome && (
                        <p>expected outcome: {approval.expectedOutcome}</p>
                      )}
                    </div>
                  )}
                  {approval.expectedOutcome && !expandedState && (
                    <p className="text-[10px] text-[#94A3B8] mt-1">
                      expected outcome: {approval.expectedOutcome}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        void decide(approval.id, 'APPROVED');
                      }}
                      disabled={deciding === approval.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#15803D] text-white hover:bg-[#166534] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                    >
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        void decide(approval.id, 'REJECTED');
                      }}
                      disabled={deciding === approval.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#FEE2E2] text-[#B91C1C] hover:bg-[#FECACA] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                    >
                      <XCircle className="h-3 w-3" aria-hidden="true" />
                      Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
          <p className="text-[10px] text-[#94A3B8] px-1">
            Approvals route through the existing authority (the Brain) — no voice shortcut, no
            implicit approval.
          </p>
        </div>
      )}

      <p className="mt-2 flex items-center gap-1 px-1 text-[10px] text-[#94A3B8]">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        Presentation only — the command center never executes, spends or authorizes by itself.
      </p>
    </div>
  );
}
