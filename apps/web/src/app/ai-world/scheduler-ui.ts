// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI World · Discovery Activity UI helpers (EPIC-018)
// Pure formatting helpers for the schedule section — no technical scheduler
// terminology unless needed, premium + minimal, consistent with the existing
// design tokens. Kept pure so the web suite can unit-test them.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ChangeKind,
  DiscoveryJobCategory,
  ScheduleFrequency,
} from '@vedmoulya/ai-world-scheduler';
import type { SchedulerRuntimeStatusViewDTO } from '../../lib/api-client.js';

/**
 * Plain per-job labels (the /ai-world schedule rows). Defined HERE (not
 * imported as a value from the package) so the client bundle never pulls
 * the scheduler package's server-only graph into the browser — only the
 * erased type import crosses the boundary.
 */
export const DISCOVERY_JOB_LABELS: Record<DiscoveryJobCategory, string> = {
  CRITICAL_PROVIDER_CHANGE: 'Critical changes',
  PROVIDER_MODEL_DISCOVERY: 'Providers',
  GITHUB_DISCOVERY: 'GitHub',
  FREE_AI_RESOURCE_DISCOVERY: 'Free AI',
  LOCAL_MODEL_DISCOVERY: 'Local Models',
  AI_NEWS_DISCOVERY: 'AI News',
  ECOSYSTEM_DEEP_SCAN: 'Deep Scan',
};

/** 'EVERY_6_HOURS' → 'Every 6 hours' (default cadence labels). */
export function frequencyLabel(frequency: ScheduleFrequency): string {
  switch (frequency) {
    case 'EVERY_6_HOURS':
      return 'Every 6 hours';
    case 'DAILY':
      return 'Daily';
    case 'WEEKLY':
      return 'Weekly';
    default:
      return 'Daily';
  }
}

/** Last-scan change summary in one human phrase. */
export function changeLabel(kind: ChangeKind | undefined): string {
  switch (kind) {
    case 'CRITICAL_CHANGE':
      return 'Critical change';
    case 'NEW':
      return 'New items';
    case 'UPDATED':
      return 'Updates';
    case 'REMOVED':
      return 'Removals';
    case 'NO_CHANGE':
      return 'No changes';
    default:
      return 'No changes';
  }
}

export type SchedulerJobStatus = 'running' | 'due' | 'scheduled' | 'disabled';

/** Status chip text — plain words, not scheduler jargon. */
export function statusLabel(status: SchedulerJobStatus): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'due':
      return 'Due now';
    case 'scheduled':
      return 'Scheduled';
    case 'disabled':
      return 'Off';
    default:
      return 'Scheduled';
  }
}

/** Status chip color (design-token classes). */
export function statusColor(status: SchedulerJobStatus): string {
  switch (status) {
    case 'running':
      return 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]';
    case 'due':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
    case 'scheduled':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
    case 'disabled':
      return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    default:
      return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  }
}

/** '2026-08-11T18:00:00Z' → '2h ago' (honest relative time). */
export function relativeTime(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '—';
  const diffMs = Math.max(0, now.getTime() - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${String(days)}d ago`;
  return new Date(then).toLocaleDateString();
}

/** '2026-08-11T18:00:00Z' → 'Today · 6:00 PM' (the epic's next-discovery line). */
export function nextDiscoveryLabel(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return 'Not scheduled';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'Not scheduled';
  const day = new Date(then);
  const today = new Date(now);
  const sameDay =
    day.getFullYear() === today.getFullYear() &&
    day.getMonth() === today.getMonth() &&
    day.getDate() === today.getDate();
  const time = day.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow =
    day.getFullYear() === tomorrow.getFullYear() &&
    day.getMonth() === tomorrow.getMonth() &&
    day.getDate() === tomorrow.getDate();
  if (isTomorrow) return `Tomorrow · ${time}`;
  return `${day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}

/** Frequency selector options with labels. */
export const FREQUENCY_OPTIONS: Array<{ value: ScheduleFrequency; label: string }> = [
  { value: 'EVERY_6_HOURS', label: 'Every 6 hours' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
];

// ── EPIC-018 runtime closure — automatic discovery indicator ────────────────
// Honest wording: the UI only ever says discovery runs automatically when the
// runtime cadence driver is actually active (reported by the gateway).

/** 'Automatic discovery active · every 10 min' (plain words, no jargon). */
export function runtimeStateLabel(runtime: SchedulerRuntimeStatusViewDTO | undefined): string {
  if (!runtime) return 'Automatic discovery — checking…';
  // Degraded: the driver runs, but its last pass could not reach the identity
  // directory — honest wording, never a false "fully healthy" claim.
  if (runtime.active && runtime.reason === 'enabled') {
    return runtime.lastTick?.userDirectoryError
      ? 'Automatic discovery active — waiting for identity directory'
      : 'Automatic discovery active';
  }
  if (runtime.reason === 'disabled') return 'Automatic discovery off (operator)';
  return 'Automatic discovery not started';
}

/** Cadence detail line — only when the driver is genuinely active. */
export function runtimeDetailLabel(runtime: SchedulerRuntimeStatusViewDTO | undefined): string {
  if (!runtime?.active || !runtime.intervalMs) return 'Discovery runs when you press Run';
  const minutes = Math.round(runtime.intervalMs / 60_000);
  // EPIC-021 — the same heartbeat also refreshes Brain opportunities; only
  // claim it when the driver genuinely reports it enabled.
  return runtime.refreshIntelligenceEnabled
    ? `every ${minutes} min · opportunity refresh on`
    : `every ${minutes} min`;
}

/** Indicator chip color (design-token classes). */
export function runtimeColor(runtime: SchedulerRuntimeStatusViewDTO | undefined): string {
  if (runtime?.active && runtime.reason === 'enabled' && !runtime.lastTick?.userDirectoryError) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
  }
  return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
}
