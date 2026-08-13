// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — VedMoulya Brain: shared UI helpers
// EPIC-016 — The VedMoulya Brain (central intelligence & orchestration)
// Per-status palettes + formatting helpers shared by the /brain page.
// Every lookup falls back to a neutral slate for unknown values (same
// convention as the Enterprise Brain brain-ui.ts maps).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BrainMode,
  BrainStage,
  BrainStageStatus,
  BrainTask,
  BrainTaskStatus,
  ProviderRole,
  QualityTarget,
} from '@vedmoulya/brain';

/** The user-visible pipeline order (CANCELLED / FAILED render separately). */
export const PIPELINE_STAGES: readonly BrainStage[] = [
  'UNDERSTANDING',
  'PLAN',
  'INTELLIGENCE',
  'EXECUTION',
  'VERIFICATION',
  'RESULT',
] as const;

/** Human labels for every stage. */
export const STAGE_LABELS: Partial<Record<BrainStage, string>> = {
  UNDERSTANDING: 'Understand',
  PLAN: 'Plan',
  INTELLIGENCE: 'Intelligence',
  EXECUTION: 'Execute',
  VERIFICATION: 'Verify',
  RESULT: 'Result',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

/** Stage status badge palette (pending → running → completed / failed / blocked). */
export const STAGE_STATUS_COLORS: Partial<Record<BrainStageStatus, string>> = {
  pending: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  running: 'bg-[#2B5FD9] text-white',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  blocked: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

/** Task status badge palette. */
export const TASK_STATUS_COLORS: Partial<Record<BrainTaskStatus, string>> = {
  NEW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  UNDERSTANDING: 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]',
  PLANNED: 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40 dark:text-[#6B8FEF]',
  AWAITING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  RUNNING: 'bg-[#2B5FD9] text-white',
  VERIFYING: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  PARTIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

/** Brain mode labels. */
export const MODE_LABELS: Partial<Record<BrainMode, string>> = {
  FAST: 'Fast',
  BALANCED: 'Balanced',
  QUALITY: 'Quality-first',
  DEEP_RESEARCH: 'Deep research',
  COST_SENSITIVE: 'Cost-sensitive',
  PRIVATE_LOCAL: 'Private · local',
};

/** Provider role labels (human-readable). */
export const ROLE_LABELS: Partial<Record<ProviderRole, string>> = {
  PRIMARY_REASONER: 'Primary reasoner',
  RESEARCHER: 'Researcher',
  CODER: 'Coder',
  ANALYST: 'Analyst',
  FACT_CHECKER: 'Fact checker',
  CRITIC: 'Critic',
  SECURITY_REVIEWER: 'Security reviewer',
  VISION_ANALYZER: 'Vision analyzer',
  WRITER: 'Writer',
  PLANNER: 'Planner',
  SYNTHESIZER: 'Synthesizer',
  VERIFIER: 'Verifier',
  SPECIALIST: 'Specialist',
};

/** Quality target labels. */
export const QUALITY_LABELS: Partial<Record<QualityTarget, string>> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

/** Confidence → bar color (green / amber / red). */
export function confidenceBarColor(score: number): string {
  if (score >= 0.8) return '#22C55E';
  if (score >= 0.5) return '#F59E0B';
  return '#EF4444';
}

/** Confidence → badge class. */
export function confidenceBadge(score: number): string {
  if (score >= 0.8)
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
  if (score >= 0.5) return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
  return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300';
}

export function formatStageStatus(status: BrainStageStatus | undefined): string {
  return (status ?? 'pending').replace('_', ' ');
}

export function formatMode(mode: BrainMode | undefined): string {
  return MODE_LABELS[mode ?? 'BALANCED'] ?? 'Balanced';
}

export function formatRole(role: ProviderRole | undefined): string {
  return ROLE_LABELS[role ?? 'SPECIALIST'] ?? 'Specialist';
}

export function formatStage(stage: BrainStage | undefined): string {
  return STAGE_LABELS[stage ?? 'UNDERSTANDING'] ?? 'Understand';
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
  if (value === undefined) return '—';
  if (value < 0.01) return `$${(value * 1000).toFixed(2)}m`;
  return `$${value.toFixed(4)}`;
}

/** Sensitive actions the Brain policy engine may pause for approval. */
export const SENSITIVE_ACTION_LABELS: Record<string, string> = {
  publish: 'Publish',
  send: 'Send',
  deploy: 'Deploy',
  purchase: 'Purchase',
  subscribe: 'Subscribe',
  delete: 'Delete',
  share: 'Share',
  install: 'Install',
  connect_account: 'Connect account',
};

// ── Pipeline step mapping (pure — shared by the page and its tests) ─────────

export type PipelineStep = 'plan' | 'selectResources' | 'execute' | 'verify';

/** The next pipeline action for a task in its current stage. */
export function nextStepOf(task: BrainTask): PipelineStep | null {
  if (task.status === 'CANCELLED' || task.status === 'FAILED') return null;
  if (task.stage === 'UNDERSTANDING') return 'plan';
  if (task.stage === 'PLAN') return 'selectResources';
  if (task.stage === 'INTELLIGENCE') return 'execute';
  if (task.stage === 'EXECUTION' || task.stage === 'VERIFICATION') return 'verify';
  return null;
}

/** Human label for the next pipeline action. */
export function nextStepLabel(step: PipelineStep | null): string | null {
  if (!step) return null;
  switch (step) {
    case 'plan':
      return 'Plan capabilities';
    case 'selectResources':
      return 'Select providers';
    case 'execute':
      return 'Execute';
    case 'verify':
      return 'Verify & finalize';
  }
}
