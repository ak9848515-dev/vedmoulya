// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem Intelligence: shared UI helpers
// EPIC-015 — VedMoulya Intelligence (discovery + evidence + security +
// license + freshness — never a static directory).
// Per-state palettes + formatting helpers shared by the /ecosystem-intelligence
// page. Every lookup falls back to a neutral slate for unknown values (same
// convention as the Brain brain-ui.ts maps).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AcquisitionState,
  BestOptionKind,
  GitHubConnectionState,
  GitHubPermissionScope,
  IntelligenceLifecycleState,
  IntelligenceNotificationKind,
  RecommendationKind,
  SecurityClassification,
} from '@vedmoulya/ecosystem-intelligence';

// ── GitHub connection state badges ────────────────────────────────────────────

export const GITHUB_STATE_COLORS: Partial<Record<GitHubConnectionState, string>> = {
  DISCONNECTED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  AUTHORIZING: 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]',
  CONNECTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  REVOKED: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  EXPIRED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

// ── GitHub permission scope labels (human-readable) ───────────────────────────

export const SCOPE_LABELS: Partial<Record<GitHubPermissionScope, string>> = {
  public_metadata: 'Public metadata',
  public_repos_read: 'Public repositories (read)',
  private_repos_read: 'Private repositories (read)',
  repos_write: 'Repositories (write)',
  orgs_read: 'Organizations (read)',
};

// ── Security classification badges ────────────────────────────────────────────

export const SECURITY_COLORS: Partial<Record<SecurityClassification, string>> = {
  TRUSTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  TRUSTED_WITH_REVIEW: 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]',
  SECURITY_REVIEW_REQUIRED: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  SUSPICIOUS: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  BLOCKED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  UNKNOWN: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

// ── Lifecycle state badges ────────────────────────────────────────────────────

export const LIFECYCLE_COLORS: Partial<Record<IntelligenceLifecycleState, string>> = {
  DISCOVERED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  VERIFIED: 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]',
  SECURITY_REVIEWED: 'bg-[#F5F3FF] text-[#7C3AED] dark:bg-[#4C1D95]/40 dark:text-[#A78BFA]',
  RECOMMENDED: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  USER_APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  CONFIGURED: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  VALIDATED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  STALE: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  DEPRECATED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  BLOCKED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

// ── Acquisition state badges ──────────────────────────────────────────────────

export const ACQUISITION_COLORS: Partial<Record<AcquisitionState, string>> = {
  DISCOVERED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  SECURITY_REVIEW: 'bg-[#F5F3FF] text-[#7C3AED] dark:bg-[#4C1D95]/40 dark:text-[#A78BFA]',
  RELEVANCE: 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]',
  APPROVAL_REQUIRED: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ACQUIRED: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  SANDBOXED: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  ANALYZED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  STORED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  CONFIGURED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  BLOCKED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

// ── Recommendation kind labels ────────────────────────────────────────────────

export const RECOMMENDATION_LABELS: Partial<Record<RecommendationKind, string>> = {
  BETTER_CAPABILITY_FOUND: 'Better capability found',
  USEFUL_OPEN_SOURCE_FOUND: 'Useful open-source capability found',
  FREE_LOCAL_MODEL_AVAILABLE: 'Free local model available',
};

// ── Best-option kind labels ───────────────────────────────────────────────────

export const OPTION_LABELS: Partial<Record<BestOptionKind, string>> = {
  BEST_AVAILABLE_NOW: 'Best available now',
  BEST_FREE: 'Best free',
  BEST_LOCAL: 'Best local',
  BEST_LOW_COST: 'Best low-cost',
  BEST_PAID: 'Best paid',
  BEST_CONFIGURED: 'Currently configured',
};

// ── Notification kind labels ──────────────────────────────────────────────────

export const NOTIFICATION_LABELS: Partial<Record<IntelligenceNotificationKind, string>> = {
  BETTER_PROVIDER_DISCOVERED: 'Better provider discovered',
  NEW_FREE_MODEL: 'New free model',
  FREE_QUOTA_INCREASED: 'Free quota increased',
  PROVIDER_UNAVAILABLE: 'Provider unavailable',
  PROVIDER_RETIRED: 'Provider retired',
  USEFUL_GITHUB_PROJECT: 'Useful GitHub project',
  SECURITY_WARNING: 'Security warning',
  LICENSE_CONCERN: 'License concern',
  LOCAL_MODEL_SUITABLE: 'Local model suitable',
  PAID_TOOL_MATERIALLY_BETTER: 'Paid tool materially better',
  CONFIGURED_PROVIDER_CHANGED: 'Configured provider changed',
  NEW_OPPORTUNITY: 'New opportunity',
};

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatUsd(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value < 0.01) return `$${(value * 1000).toFixed(2)}m`;
  return `$${value.toFixed(4)}`;
}

/** A quality bar like `████████░░ 82` (green / amber / red). */
export function qualityBar(value: number | undefined): string {
  const v = value ?? 0;
  const filled = Math.max(0, Math.min(10, Math.round(v / 10)));
  const empty = 10 - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${String(v)}`;
}

export function qualityBarColor(value: number | undefined): string {
  const v = value ?? 0;
  if (v >= 80) return '#22C55E';
  if (v >= 60) return '#F59E0B';
  return '#EF4444';
}

export function formatHuman(enumValue: string): string {
  return enumValue.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
