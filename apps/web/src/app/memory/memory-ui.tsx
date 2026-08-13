// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: shared UI helpers
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// Per-type / lifecycle / compression / retention / relationship palettes +
// formatting helpers shared by the memory dashboard views.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  MemoryCompressionState,
  MemoryLifecycleStatus,
  MemoryRelationshipType,
  MemoryRetentionPolicy,
  MemorySourceType,
  MemoryType,
} from '@vedmoulya/memory-intelligence';
import { MEMORY_TYPE_LABELS } from '@vedmoulya/memory-intelligence';

/** Per-type accent colors (14 memory classes). */
export const TYPE_COLORS: Partial<Record<MemoryType, string>> = {
  working: '#2B5FD9',
  session: '#06B6D4',
  project: '#F97316',
  business: '#7C3AED',
  capability: '#8B5CF6',
  provider: '#F59E0B',
  execution: '#22C55E',
  decision: '#0D9488',
  learning: '#84CC16',
  context: '#3B82F6',
  user_preference: '#EC4899',
  failure: '#EF4444',
  success: '#22C55E',
  long_term: '#64748B',
};

export const TYPE_LABELS: Partial<Record<MemoryType, string>> = MEMORY_TYPE_LABELS;

/** Source-type palette (provenance badges). */
export const SOURCE_COLORS: Partial<Record<MemorySourceType, string>> = {
  event: 'bg-[#06B6D4] text-white',
  goal: 'bg-[#2B5FD9] text-white',
  task: 'bg-[#3B82F6] text-white',
  capability: 'bg-[#8B5CF6] text-white',
  provider: 'bg-[#F59E0B] text-white',
  project: 'bg-[#F97316] text-white',
  user: 'bg-[#EC4899] text-white',
  decision: 'bg-[#0D9488] text-white',
  execution: 'bg-[#22C55E] text-white',
  learning: 'bg-[#84CC16] text-white',
  context: 'bg-[#14B8A6] text-white',
  business: 'bg-[#7C3AED] text-white',
  system: 'bg-[#64748B] text-white',
  manual: 'bg-[#94A3B8] text-white',
  observation: 'bg-[#F97316] text-white',
};

/** Lifecycle badge palette (captured → … → active → archived → expired). */
export const LIFECYCLE_COLORS: Partial<Record<MemoryLifecycleStatus, string>> = {
  captured: 'bg-[#94A3B8] text-white',
  validated: 'bg-[#3B82F6] text-white',
  consolidated: 'bg-[#8B5CF6] text-white',
  ranked: 'bg-[#F59E0B] text-white',
  compressed: 'bg-[#0D9488] text-white',
  active: 'bg-[#22C55E] text-white',
  archived: 'bg-[#64748B] text-white',
  expired: 'bg-[#EF4444] text-white',
};

/** Compression-state badge palette. */
export const COMPRESSION_COLORS: Partial<Record<MemoryCompressionState, string>> = {
  raw: 'bg-[#94A3B8] text-white',
  compressed: 'bg-[#06B6D4] text-white',
  summarized: 'bg-[#8B5CF6] text-white',
  collapsed: 'bg-[#64748B] text-white',
};

/** Retention policy palette. */
export const RETENTION_COLORS: Partial<Record<MemoryRetentionPolicy, string>> = {
  ephemeral: 'bg-[#EF4444] text-white',
  short_term: 'bg-[#F97316] text-white',
  medium_term: 'bg-[#F59E0B] text-white',
  long_term: 'bg-[#2B5FD9] text-white',
  permanent: 'bg-[#22C55E] text-white',
};

/** Relationship edge-type palette (10 memory edge kinds). */
export const RELATIONSHIP_COLORS: Partial<Record<MemoryRelationshipType, string>> = {
  recalls: 'bg-[#2B5FD9] text-white',
  follows: 'bg-[#3B82F6] text-white',
  precedes: 'bg-[#06B6D4] text-white',
  supports: 'bg-[#22C55E] text-white',
  contradicts: 'bg-[#EF4444] text-white',
  supersedes: 'bg-[#64748B] text-white',
  depends_on: 'bg-[#F97316] text-white',
  similar_to: 'bg-[#8B5CF6] text-white',
  refines: 'bg-[#0D9488] text-white',
  produced_by: 'bg-[#F59E0B] text-white',
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

/** Level chip color from an importance/confidence level. */
export const LEVEL_COLORS: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-[#EF4444] text-white',
  medium: 'bg-[#F59E0B] text-white',
  high: 'bg-[#22C55E] text-white',
};

/** Truncate a long string for list rows. */
export function truncate(value: string, max = 90): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
