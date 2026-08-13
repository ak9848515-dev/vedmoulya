// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Learning Intelligence: shared UI helpers
// EPIC-004 / EI-007 — Enterprise Learning Intelligence Platform
// Category palettes + formatting helpers shared by the six dashboard views.
// ─────────────────────────────────────────────────────────────────────────────

import type { LearningCategory } from '@vedmoulya/learning-intelligence';

/** Per-category accent colors used by badges, icons, and trend bars.
 *  Partial so lookups stay `string | undefined` and callers fall back to a
 *  neutral slate — `Object.entries()`/`as` casts can otherwise widen keys. */
export const CATEGORY_COLORS: Partial<Record<LearningCategory, string>> = {
  provider: '#2B5FD9',
  context: '#F59E0B',
  capability: '#7C3AED',
  prompt: '#EC4899',
  budget: '#22C55E',
  quality: '#0D9488',
  execution: '#F97316',
  business: '#8B5CF6',
  user_preference: '#06B6D4',
  failure: '#EF4444',
};

export const CATEGORY_LABELS: Partial<Record<LearningCategory, string>> = {
  provider: 'Provider',
  context: 'Context',
  capability: 'Capability',
  prompt: 'Prompt',
  budget: 'Budget',
  quality: 'Quality',
  execution: 'Execution',
  business: 'Business',
  user_preference: 'Preference',
  failure: 'Failure',
};

export const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-[#3B82F6] text-white',
  warning: 'bg-[#F59E0B] text-white',
  critical: 'bg-[#EF4444] text-white',
};

export const RECOMMENDATION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-[#F59E0B] text-white',
  approved: 'bg-[#22C55E] text-white',
  rejected: 'bg-[#94A3B8] text-white',
  rolled_back: 'bg-[#EF4444] text-white',
};

export function formatPct(value: number | undefined): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

/** Neutral fallback when a category key is not in the palette. */
export const FALLBACK_COLOR = '#64748B';

export function formatUsd(value: number | undefined): string {
  if ((value ?? 0) < 0.01) return `$${((value ?? 0) * 1000).toFixed(2)}m`;
  return `$${(value ?? 0).toFixed(3)}`;
}

export function formatMs(value: number | undefined): string {
  const ms = value ?? 0;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
