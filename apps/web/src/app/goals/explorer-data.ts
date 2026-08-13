// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Goal Explorer: Shared Data
// EPIC-004 / EI-006 — Enterprise Goal & Task Intelligence Engine
// Label maps, badge variants, and helpers shared by the explorer screens.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GoalCategory,
  GoalPriority,
  GoalStatus,
  ComplexityLevel,
  RiskLevel,
} from '@vedmoulya/goals';

// ── Label maps ──────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<GoalCategory, string> = {
  business: 'Business',
  personal: 'Personal',
  learning: 'Learning',
  career: 'Career',
  revenue: 'Revenue',
  project: 'Project',
  health: 'Health',
  custom: 'Custom',
};

export const STATUS_LABELS: Record<GoalStatus, string> = {
  proposed: 'Proposed',
  scored: 'Scored',
  accepted: 'Accepted',
  active: 'Active',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

export const PRIORITY_LABELS: Record<GoalPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  background: 'Background',
};

export const COMPLEXITY_LABELS: Record<ComplexityLevel, string> = {
  simple: 'Simple',
  moderate: 'Moderate',
  complex: 'Complex',
  very_complex: 'Very Complex',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  very_low: 'Very Low',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// ── Badge variants (matches @vedmoulya/ui Badge variants) ───────────────────

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'ai';

export const STATUS_BADGE: Record<GoalStatus, { label: string; variant: BadgeVariant }> = {
  proposed: { label: 'Proposed', variant: 'default' },
  scored: { label: 'Scored', variant: 'info' },
  accepted: { label: 'Accepted', variant: 'info' },
  active: { label: 'Active', variant: 'success' },
  blocked: { label: 'Blocked', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  archived: { label: 'Archived', variant: 'default' },
};

export const PRIORITY_BADGE: Record<GoalPriority, { label: string; variant: BadgeVariant }> = {
  critical: { label: 'Critical', variant: 'danger' },
  high: { label: 'High', variant: 'warning' },
  medium: { label: 'Medium', variant: 'info' },
  low: { label: 'Low', variant: 'default' },
  background: { label: 'Background', variant: 'default' },
};

export const RISK_BADGE: Record<RiskLevel, { label: string; variant: BadgeVariant }> = {
  very_low: { label: 'Very Low', variant: 'success' },
  low: { label: 'Low', variant: 'success' },
  medium: { label: 'Medium', variant: 'warning' },
  high: { label: 'High', variant: 'warning' },
  critical: { label: 'Critical', variant: 'danger' },
};

export const CAPABILITY_LABELS: Record<string, string> = {
  reasoning: 'Reasoning',
  coding: 'Coding',
  vision: 'Vision',
  embeddings: 'Embeddings',
  summarization: 'Summarization',
  classification: 'Classification',
  translation: 'Translation',
  speech: 'Speech',
  image_understanding: 'Image Understanding',
  general_conversation: 'Conversation',
  content_generation: 'Content Generation',
};

export const TASK_FLOW_LABELS: Record<string, string> = {
  sequential: 'Sequential',
  parallel: 'Parallel',
  conditional: 'Conditional',
  optional: 'Optional',
};

// ── Lifecycle flow (state machine visual) ───────────────────────────────────

export const LIFECYCLE_FLOW = [
  'proposed',
  'scored',
  'accepted',
  'active',
  'completed',
  'archived',
] as const;

// ── Understanding pipeline (overview visual) ────────────────────────────────

export const UNDERSTANDING_PIPELINE = [
  {
    label: 'Understand the Goal',
    detail: 'category, domain, capability & context hints (deterministic)',
  },
  {
    label: 'Classify',
    detail: 'business domain, required capabilities, risk, complexity, budget ranges',
  },
  {
    label: 'Break into Tasks',
    detail: 'per-category templates — sequential / parallel / conditional / optional / nested',
  },
  {
    label: 'Prioritize',
    detail: 'business value, urgency, importance, dependencies, risk, confidence (0–100)',
  },
  {
    label: 'Build Dependencies',
    detail: 'task DAG, critical path, slack, parallel groups, milestones',
  },
  { label: 'Send to EI-004', detail: 'strategy handoff — capability plan steps, mode, budgets' },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Format ms into a readable duration. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${String(hours)}h ${String(rest)}m` : `${String(hours)}h`;
}

/** Percent bar colour by value band. */
export function percentColor(value: number): string {
  if (value >= 0.75) return 'bg-[#22C55E]';
  if (value >= 0.5) return 'bg-[#2B5FD9]';
  if (value >= 0.3) return 'bg-[#F59E0B]';
  return 'bg-[#EF4444]';
}

/** Extract the goalId from a seed/created goal id (for display). */
export function shortId(id: string): string {
  return id.length > 26 ? `${id.slice(0, 13)}…${id.slice(-6)}` : id;
}
