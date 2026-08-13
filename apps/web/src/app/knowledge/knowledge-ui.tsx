// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: shared UI helpers
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// Per-category / lifecycle / validation / relationship palettes + formatting
// helpers shared by the knowledge dashboard views.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  KnowledgeCategory,
  KnowledgeLifecycleStatus,
  KnowledgeRelationshipType,
  KnowledgeSourceType,
  KnowledgeValidationStatus,
} from '@vedmoulya/knowledge-intelligence';
import { KNOWLEDGE_CATEGORY_LABELS } from '@vedmoulya/knowledge-intelligence';

/** Per-category accent colors (14 knowledge domains). */
export const CATEGORY_COLORS: Partial<Record<KnowledgeCategory, string>> = {
  business: '#2B5FD9',
  technical: '#06B6D4',
  user: '#7C3AED',
  project: '#F97316',
  ai: '#8B5CF6',
  sap: '#F59E0B',
  client: '#22C55E',
  domain: '#0D9488',
  policy: '#EC4899',
  document: '#3B82F6',
  api: '#14B8A6',
  architecture: '#EF4444',
  learning: '#84CC16',
  execution: '#64748B',
};

export const CATEGORY_LABELS: Partial<Record<KnowledgeCategory, string>> =
  KNOWLEDGE_CATEGORY_LABELS;

/** Source-type palette (provenance badges). */
export const SOURCE_COLORS: Partial<Record<KnowledgeSourceType, string>> = {
  repository: 'bg-[#2B5FD9] text-white',
  architecture: 'bg-[#7C3AED] text-white',
  api: 'bg-[#06B6D4] text-white',
  database: 'bg-[#0D9488] text-white',
  report: 'bg-[#F97316] text-white',
  system: 'bg-[#64748B] text-white',
  document: 'bg-[#3B82F6] text-white',
  export: 'bg-[#14B8A6] text-white',
  observation: 'bg-[#84CC16] text-white',
  generated: 'bg-[#EC4899] text-white',
  conversation: 'bg-[#F59E0B] text-white',
  manual: 'bg-[#94A3B8] text-white',
};

/** Lifecycle badge palette (draft → review → active → deprecated → archived). */
export const LIFECYCLE_COLORS: Partial<Record<KnowledgeLifecycleStatus, string>> = {
  draft: 'bg-[#94A3B8] text-white',
  review: 'bg-[#F59E0B] text-white',
  active: 'bg-[#22C55E] text-white',
  deprecated: 'bg-[#64748B] text-white',
  archived: 'bg-[#64748B] text-white',
};

/** Validation badge palette. */
export const VALIDATION_COLORS: Partial<Record<KnowledgeValidationStatus, string>> = {
  unvalidated: 'bg-[#94A3B8] text-white',
  pending: 'bg-[#F59E0B] text-white',
  validated: 'bg-[#22C55E] text-white',
  failed: 'bg-[#EF4444] text-white',
};

/** Relationship edge-type palette (10 edge kinds). */
export const RELATIONSHIP_COLORS: Partial<Record<KnowledgeRelationshipType, string>> = {
  parent: 'bg-[#2B5FD9] text-white',
  child: 'bg-[#3B82F6] text-white',
  depends_on: 'bg-[#EF4444] text-white',
  related_to: 'bg-[#8B5CF6] text-white',
  implements: 'bg-[#06B6D4] text-white',
  consumes: 'bg-[#F97316] text-white',
  produces: 'bg-[#22C55E] text-white',
  supersedes: 'bg-[#64748B] text-white',
  uses: 'bg-[#14B8A6] text-white',
  owned_by: 'bg-[#F59E0B] text-white',
};

/** Trust-band palette. */
export const TRUST_BAND_COLORS: Record<string, string> = {
  '0–0.4': '#EF4444',
  '0.4–0.6': '#F59E0B',
  '0.6–0.8': '#F97316',
  '0.8–1.0': '#22C55E',
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

export function trustLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

export const TRUST_LEVEL_COLORS: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-[#EF4444] text-white',
  medium: 'bg-[#F59E0B] text-white',
  high: 'bg-[#22C55E] text-white',
};

/** Truncate a long string for list rows. */
export function truncate(value: string, max = 90): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
