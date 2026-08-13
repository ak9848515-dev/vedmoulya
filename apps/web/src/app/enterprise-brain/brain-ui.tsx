// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: shared UI helpers
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// Per-type palettes + formatting helpers shared by the dashboard views.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BrainConfidenceLevel,
  BrainDecisionAction,
  BrainDecisionStatus,
  BrainDecisionType,
} from '@vedmoulya/enterprise-brain';
import { BRAIN_DECISION_TYPE_LABELS } from '@vedmoulya/enterprise-brain';

/** Per-decision-type accent colors used by badges, icons, and bars. */
export const TYPE_COLORS: Partial<Record<BrainDecisionType, string>> = {
  goal_priority: '#2B5FD9',
  task_priority: '#3B82F6',
  execution_order: '#06B6D4',
  capability_selection: '#7C3AED',
  provider_selection: '#22C55E',
  context_strategy: '#F59E0B',
  execution_strategy: '#F97316',
  budget_strategy: '#0D9488',
  quality_threshold: '#EC4899',
  risk_assessment: '#EF4444',
  retry_policy: '#8B5CF6',
  fallback_policy: '#64748B',
  learning_feedback: '#14B8A6',
  business_objectives: '#84CC16',
};

/** Decision-type labels with a neutral fallback (Partial so lookups stay
 *  `string | undefined` and callers fall back to the raw key — same convention
 *  as the Learning Intelligence learning-ui.js maps). */
export const TYPE_LABELS: Partial<Record<BrainDecisionType, string>> = BRAIN_DECISION_TYPE_LABELS;

/** Status badge palette (proposed → approved → handed off → …).
 *  Partial so callers can fall back to a neutral slate for unknown statuses. */
export const STATUS_COLORS: Partial<Record<BrainDecisionStatus, string>> = {
  proposed: 'bg-[#F59E0B] text-white',
  approved: 'bg-[#22C55E] text-white',
  rejected: 'bg-[#94A3B8] text-white',
  handed_off: 'bg-[#06B6D4] text-white',
  superseded: 'bg-[#64748B] text-white',
};

/** History action badge palette (audit-trail rows). */
export const ACTION_COLORS: Partial<Record<BrainDecisionAction, string>> = {
  created: 'bg-[#2B5FD9] text-white',
  approved: 'bg-[#22C55E] text-white',
  rejected: 'bg-[#94A3B8] text-white',
  handed_off: 'bg-[#06B6D4] text-white',
  superseded: 'bg-[#64748B] text-white',
};

/** Confidence level palette. */
export const CONFIDENCE_COLORS: Partial<Record<BrainConfidenceLevel, string>> = {
  high: 'bg-[#22C55E] text-white',
  medium: 'bg-[#F59E0B] text-white',
  low: 'bg-[#EF4444] text-white',
};

export const CONFIDENCE_BAR_COLORS: Partial<Record<BrainConfidenceLevel, string>> = {
  high: '#22C55E',
  medium: '#F59E0B',
  low: '#EF4444',
};

export const FALLBACK_COLOR = '#64748B';

export function formatPct(value: number | undefined): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
  if ((value ?? 0) < 0.01) return `$${((value ?? 0) * 1000).toFixed(2)}m`;
  return `$${(value ?? 0).toFixed(2)}`;
}

export function confidenceLevel(score: number): BrainConfidenceLevel {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}
