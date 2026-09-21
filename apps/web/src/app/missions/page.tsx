// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Missions Landing Page (UX-04)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading } from '@vedmoulya/ui';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { useMissionHistory, type MissionHistoryEntry } from '../../lib/api-client.js';
import {
  Rocket,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  ChevronRight,
  Clock,
  ArrowRight,
  Layers,
  Map as MapIcon,
  Activity,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { usePageContext } from '../../lib/use-page-context.js';
import { PageContextBar } from '../../components/PageContextBar.js';
import {
  ATTENTION_MISSION_STATES,
  TERMINAL_MISSION_STATES,
  filterMissions,
  missionFilterCounts,
  type MissionFilter,
} from './mission-filters.js';

// ── Filters (UX-04) ─────────────────────────────────────────────────────────

const FILTER_LABELS: ReadonlyArray<{ id: MissionFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' },
];

type StateToneKey = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

/**
 * State metadata. A Map (rather than an index signature) keeps the lookup a
 * real keyed get instead of a dynamic property access. (`Map` the icon is
 * imported as `MapIcon` so it cannot shadow the global collection.)
 */
const STATE_LABEL_ENTRIES: ReadonlyArray<[string, { label: string; tone: StateToneKey }]> = [
  ['CREATED', { label: 'Draft', tone: 'neutral' }],
  ['RUNNING', { label: 'Running', tone: 'info' }],
  ['PAUSED', { label: 'Paused', tone: 'warn' }],
  ['WAITING_FOR_APPROVAL', { label: 'Awaiting Approval', tone: 'warn' }],
  ['WAITING_FOR_PROVIDER', { label: 'Waiting', tone: 'warn' }],
  ['BLOCKED', { label: 'Blocked', tone: 'bad' }],
  ['COMPLETED', { label: 'Completed', tone: 'good' }],
  ['FAILED', { label: 'Failed', tone: 'bad' }],
  ['CANCELLED', { label: 'Cancelled', tone: 'neutral' }],
];

const STATE_LABELS_MAP = new Map<string, { label: string; tone: StateToneKey }>(
  STATE_LABEL_ENTRIES,
);

interface StateMeta {
  label: string;
  tone: StateToneKey;
}

const STATE_TONES: Record<StateToneKey, { badge: string; border: string; bg: string }> = {
  good: {
    badge: 'bg-emerald-100 text-emerald-800',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
  },
  warn: { badge: 'bg-amber-100 text-amber-800', border: 'border-amber-200', bg: 'bg-amber-50' },
  bad: { badge: 'bg-rose-100 text-rose-800', border: 'border-rose-200', bg: 'bg-rose-50' },
  info: {
    badge: 'bg-[#2B5FD9]/10 text-[#2B5FD9]',
    border: 'border-[#2B5FD9]/30',
    bg: 'bg-[#2B5FD9]/5',
  },
  neutral: { badge: 'bg-slate-100 text-slate-700', border: 'border-slate-200', bg: 'bg-slate-50' },
};

function getStateMeta(state: string): StateMeta {
  return STATE_LABELS_MAP.get(state) ?? { label: state, tone: 'neutral' };
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyState(): React.JSX.Element {
  return (
    <Card variant="standard" padding="lg" className="max-w-lg text-center border-slate-200">
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-[#2B5FD9]/10 p-3">
          <Rocket className="h-6 w-6 text-[#2B5FD9]" />
        </div>
        <div>
          <h2 className="text-[18px] font-heading font-semibold text-[#111827]">No missions yet</h2>
          <p className="text-[13px] text-[#64748B] mt-1 max-w-sm">
            Turn a goal into your first mission. VedMoulya will plan, execute, and verify it
            autonomously.
          </p>
        </div>
        <Link
          href="/goals"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4]"
        >
          <Target className="h-4 w-4" /> Create a Goal First
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}

// ── Mission card ──────────────────────────────────────────────────────────
//
// UX-04 hardening: each mission is presented EXACTLY once. The page used to
// render the same mission in a "next action" hero, an "active missions" list
// and the history list, which made the history surface unreadable and made
// filtering dishonest (the unfiltered hero list kept missions the filter had
// just excluded). The history card below is now the single, filtered surface.

function MissionCard({
  mission,
  isActive,
}: {
  mission: MissionHistoryEntry;
  isActive?: boolean;
}): React.JSX.Element {
  const stateMeta = getStateMeta(mission.state);
  const tone = STATE_TONES[stateMeta.tone];
  const isTerminal = TERMINAL_MISSION_STATES.includes(mission.state);
  const isWaiting = ATTENTION_MISSION_STATES.includes(mission.state);

  return (
    <Link href={`/autonomous-builder?mission=${mission.missionId}`} className="block">
      <Card
        variant="standard"
        padding="lg"
        className={`border rounded-lg transition-colors hover:border-[#2B5FD9]/50 ${isActive ? 'border-[#2B5FD9]' : 'border-slate-200'}`}
        data-testid={`mission-card-${mission.missionId}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge className={tone.badge} size="sm">
                {stateMeta.label}
              </Badge>
              {isTerminal && (
                <Badge
                  className={
                    mission.outcome === 'FAILED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }
                  size="sm"
                >
                  {mission.outcome}
                </Badge>
              )}
              {isWaiting && (
                <Badge className="bg-amber-100 text-amber-800" size="sm">
                  Needs attention
                </Badge>
              )}
            </div>
            <h3 className="text-[15px] font-heading font-semibold text-[#111827] line-clamp-2">
              {mission.title}
            </h3>
            <p className="text-[12px] text-[#64748B] mt-1 line-clamp-2">{mission.objective}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-[#94A3B8] shrink-0 mt-1" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
          <span className="inline-flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {mission.verifiedObjectives}/{mission.totalObjectives} verified
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(mission.createdAt).toLocaleDateString()}
          </span>
        </div>
        {mission.outcomeReason && (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-[11px] text-rose-600">{mission.outcomeReason}</p>
          </div>
        )}
        {mission.state === 'RUNNING' && (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-[11px] text-[#2B5FD9]">
              VedMoulya is actively working on this mission.
            </p>
          </div>
        )}
        {isWaiting && (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-[11px] text-amber-600">
              {mission.state === 'WAITING_FOR_APPROVAL'
                ? 'Waiting for your approval to continue.'
                : mission.state === 'WAITING_FOR_PROVIDER'
                  ? 'Waiting for an available AI provider.'
                  : mission.state === 'BLOCKED'
                    ? 'Blocked — needs intervention to continue.'
                    : 'Mission is paused. Resume when ready.'}
            </p>
          </div>
        )}
      </Card>
    </Link>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function MissionsPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const history = useMissionHistory(userId);
  const [filter, setFilter] = React.useState<MissionFilter>('all');

  // UX-04: /missions is the history / discovery surface of the Missions
  // destination; the canonical operational experience stays
  // /autonomous-builder?mission={id}.
  const context = usePageContext({ pathname: '/missions', label: 'All Missions' });

  if (!hydrated || !sessionReady)
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading..." size="lg" />
      </div>
    );
  if (!user) return <SignInRedirect />;

  const allMissions = history.data ?? [];
  const missions = filterMissions(allMissions, filter);
  const activeMissions = allMissions.filter((m) => !TERMINAL_MISSION_STATES.includes(m.state));
  const completedMissions = allMissions.filter((m) => m.state === 'COMPLETED');
  const needsAttention = allMissions.filter((m) => ATTENTION_MISSION_STATES.includes(m.state));
  const filterCounts = missionFilterCounts(allMissions);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* UX-04 — Missions → history hierarchy (AI/Missions parent context). */}
      <PageContextBar
        context={context}
        label="All Missions"
        description="Mission history and discovery. Open a mission to watch and control it while it runs."
      />

      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Rocket className="h-5 w-5 text-[#2B5FD9]" />
          <h1 className="text-[26px] md:text-[28px] font-heading font-bold text-[#111827]">
            Missions
          </h1>
        </div>
        <p className="text-[14px] text-[#64748B] max-w-2xl">
          Your goals become missions. VedMoulya plans, executes, verifies, and learns.
        </p>
        <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
          <Layers className="h-3.5 w-3.5" /> Goal → Mission → Plan → Execute → Verify → Result →
          Learning
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Rocket className="h-4 w-4 text-[#2B5FD9]" />}
          label="Active"
          value={activeMissions.length}
          bg="bg-[#2B5FD9]/10"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          label="Completed"
          value={completedMissions.length}
          bg="bg-emerald-100"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-rose-600" />}
          label="Failed"
          value={missions.filter((m) => m.state === 'FAILED').length}
          bg="bg-rose-100"
        />
        <StatCard
          icon={<PauseCircle className="h-4 w-4 text-amber-600" />}
          label="Attention"
          value={needsAttention.length}
          bg="bg-amber-100"
        />
      </div>

      <Card variant="standard" padding="lg" className="border-slate-200">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-[15px] font-semibold text-[#111827] flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-[#2B5FD9]" />
            Mission History
          </h2>
          <span className="text-[11px] text-[#64748B]" data-testid="mission-history-count">
            {missions.length} of {allMissions.length} mission{allMissions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* UX-04 — real state filters over the real list (no invented groups). */}
        <div
          className="flex flex-wrap items-center gap-1.5 mb-4"
          role="group"
          aria-label="Filter missions by state"
        >
          {FILTER_LABELS.map((option) => {
            const isActive = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                data-testid={`mission-filter-${option.id}`}
                onClick={() => {
                  setFilter(option.id);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                  isActive
                    ? 'border-[#2B5FD9] bg-[#2B5FD9] text-white'
                    : 'border-slate-200 bg-white text-[#64748B] hover:border-[#2B5FD9]/40 hover:text-[#2B5FD9]'
                }`}
              >
                {option.label}
                <span className={isActive ? 'text-white/80' : 'text-[#94A3B8]'}>
                  {filterCounts[option.id]}
                </span>
              </button>
            );
          })}
        </div>

        {allMissions.length === 0 ? (
          <EmptyState />
        ) : missions.length === 0 ? (
          <div className="py-6 text-center" data-testid="mission-filter-empty">
            <p className="text-[13px] text-[#64748B]">
              No missions in this filter. Choose another filter to see the rest.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {missions.map((mission) => (
              <MissionCard key={mission.missionId} mission={mission} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="border-slate-200">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        <div>
          <p className="text-[11px] text-[#64748B] font-medium">{label}</p>
          <p className="text-[20px] font-bold text-[#111827]">{value}</p>
        </div>
      </div>
    </Card>
  );
}
