// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ai-world-scheduler — Types
// EPIC-018 — AI World Scheduler & Discovery Engine
//
// The scheduler decides WHEN discovery may run. It does NOT decide
// WHAT discovery means (that stays in EPIC-012C AI World) and it does
// NOT decide user relevance/authority (that stays in the intelligence
// and policy layers). Every per-user record is owner-scoped by
// construction (keyed `(userId, …)`) — IDOR-safe.
//
// Budgets: the scheduler does NOT create a second budget engine. Run
// limits map 1:1 onto the frozen LoopBudget (maxDiscoveryCalls →
// maxIterations, maxSourceCalls → maxProviderCalls, tokens/cost/
// latency shared) — see RunBudgetGuard.
// ──────────────────────────────────────────────────────────────────

import type {
  DiscoveryBudget,
  DiscoveryCategory,
  DiscoveryItem,
  DiscoverySourceRunReport,
} from '@vedmoulya/ai-world';

// ── Job categories (Phase 2) ───────────────────────────────────────

export type DiscoveryJobCategory =
  | 'CRITICAL_PROVIDER_CHANGE'
  | 'PROVIDER_MODEL_DISCOVERY'
  | 'GITHUB_DISCOVERY'
  | 'FREE_AI_RESOURCE_DISCOVERY'
  | 'LOCAL_MODEL_DISCOVERY'
  | 'AI_NEWS_DISCOVERY'
  | 'ECOSYSTEM_DEEP_SCAN';

export const DISCOVERY_JOB_CATEGORIES: readonly DiscoveryJobCategory[] = [
  'CRITICAL_PROVIDER_CHANGE',
  'PROVIDER_MODEL_DISCOVERY',
  'GITHUB_DISCOVERY',
  'FREE_AI_RESOURCE_DISCOVERY',
  'LOCAL_MODEL_DISCOVERY',
  'AI_NEWS_DISCOVERY',
  'ECOSYSTEM_DEEP_SCAN',
];

/** User-friendly label per job (the /ai-world schedule rows). */
export const DISCOVERY_JOB_LABELS: Record<DiscoveryJobCategory, string> = {
  CRITICAL_PROVIDER_CHANGE: 'Critical changes',
  PROVIDER_MODEL_DISCOVERY: 'Providers',
  GITHUB_DISCOVERY: 'GitHub',
  FREE_AI_RESOURCE_DISCOVERY: 'Free AI',
  LOCAL_MODEL_DISCOVERY: 'Local Models',
  AI_NEWS_DISCOVERY: 'AI News',
  ECOSYSTEM_DEEP_SCAN: 'Deep Scan',
};

// ── Frequencies (Phase 2 — DEFAULTS, never immutable hardcodes) ────

export type ScheduleFrequency = 'EVERY_6_HOURS' | 'DAILY' | 'WEEKLY';

export const SCHEDULE_FREQUENCIES: readonly ScheduleFrequency[] = [
  'EVERY_6_HOURS',
  'DAILY',
  'WEEKLY',
];

// ── Schedules (per-user settings; what the UI edits) ───────────────

export interface DiscoverySchedule {
  userId: string;
  jobCategory: DiscoveryJobCategory;
  enabled: boolean;
  frequency: ScheduleFrequency;
  updatedAt: string;
}

// ── Run limits — mapped 1:1 onto LoopBudget (no second budget engine)

export interface SchedulerRunLimits {
  /** Hard wall-clock bound for one run (LoopBudget maxLatencyMs). */
  maxRuntimeMs: number;
  /** Max discovery calls per run (LoopBudget maxIterations). */
  maxDiscoveryCalls: number;
  /** Max source calls per run (LoopBudget maxProviderCalls). */
  maxSourceCalls: number;
  /** Token bound (LoopBudget maxTokens). */
  maxTokens: number;
  /** Cost bound USD (LoopBudget maxCostUsd). */
  maxCostUsd: number;
}

// ── Job policies (per-category defaults — configurable later) ──────

export interface DiscoveryJobRetryPolicy {
  maxRetries: number;
  baseBackoffMs: number;
  /** Exponential backoff cap (failure isolation — never infinite retries). */
  maxBackoffMs: number;
}

export interface DiscoveryJobPolicy {
  jobCategory: DiscoveryJobCategory;
  /** Which discovery item categories this job cares about. */
  itemCategories: DiscoveryCategory[];
  frequency: ScheduleFrequency;
  /** The SAME DiscoveryBudget shape EPIC-012C already enforces. */
  discoveryBudget: DiscoveryBudget;
  runLimits: SchedulerRunLimits;
  retry: DiscoveryJobRetryPolicy;
  /** Re-notification cooldown per item (deduplication). */
  notificationCooldownMs: number;
  /** CRITICAL_CHANGE threshold (provider/model + high relevance + strong evidence). */
  criticalMinRelevance: number;
}

// ── Jobs (executable per-user state) ───────────────────────────────

export interface DiscoveryJob {
  jobId: string; // == jobCategory
  userId: string;
  jobCategory: DiscoveryJobCategory;
  policy: DiscoveryJobPolicy;
  enabled: boolean;
  frequency: ScheduleFrequency;
  lastRunAt?: string;
  nextRunAt?: string;
  inFlight: boolean;
  cancelRequested: boolean;
  consecutiveFailures: number;
  lastChangeKind?: ChangeKind;
}

// ── Runs + ledger ──────────────────────────────────────────────────

export type DiscoveryRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'SKIPPED';

export interface DiscoveryRun {
  runId: string;
  userId: string;
  jobCategory: DiscoveryJobCategory;
  /** Manual runs (Run now) take the EXACT same bounded path — no shortcut. */
  manual: boolean;
  status: DiscoveryRunStatus;
  startedAt: string;
  finishedAt?: string;
  skipReason?: string;
  error?: string;
  changeSummary: ChangeSummary;
  notifications: { emitted: number; deduplicated: number; skipped: number };
  budget: SchedulerBudgetSnapshot;
  sourceReports: DiscoverySourceRunReport[];
}

export interface DiscoveryRunLedger {
  userId: string;
  runs: DiscoveryRun[];
}

// ── Change detection (Phase 6) ─────────────────────────────────────

export type ChangeKind = 'NO_CHANGE' | 'NEW' | 'UPDATED' | 'REMOVED' | 'CRITICAL_CHANGE';

export interface ChangeEntry {
  item: DiscoveryItem;
  kind: Exclude<ChangeKind, 'NO_CHANGE'>;
  /** Fields that actually changed (UPDATED) or why it is critical. */
  changedFields?: string[];
  reason?: string;
}

export interface ChangeSummary {
  ranAt: string;
  /** False ⇔ NO_CHANGE — a successful run with no meaningful change must NOT notify. */
  meaningful: boolean;
  counts: Record<ChangeKind, number>;
  entries: ChangeEntry[];
}

// ── Budget snapshot (measured, fail-closed) ────────────────────────

export interface SchedulerBudgetSnapshot {
  spentTokens: number;
  spentCostUsd: number;
  spentLatencyMs: number;
  discoveryCalls: number;
  sourceCalls: number;
  exceeded: boolean;
  failureReason?: string;
}

// ── Source policy (Phase 4 — failure isolation) ────────────────────
// Source policies are PLATFORM-WIDE infrastructure state (like the
// discovery store) — never user data. User-specific state (schedules,
// jobs, runs, cooldowns) is owner-scoped.

export interface DiscoverySourcePolicy {
  sourceId: string;
  enabled: boolean;
  /** Manual/automatic cooldown until this epoch ms. */
  cooldownUntilMs?: number;
  lastAttemptedAt?: string;
  lastSuccessfulAt?: string;
  lastMeaningfulResultAt?: string;
  consecutiveFailures: number;
  /** Windowed source rate limit (calls consumed in the current window). */
  callsConsumed: number;
  rateLimitWindowStartedAtMs: number;
  maxCallsPerWindow: number;
  rateLimitWindowMs: number;
  /** Cumulative cost consumed by this source (budget dimension). */
  budgetConsumedUsd: number;
  /** Backoff-driven eligibility (exponential, capped). */
  nextEligibleAtMs?: number;
}

export type SourcePolicyGateReason =
  'disabled' | 'cooldown' | 'rate_limited' | 'budget_exhausted' | 'backoff';

export interface SourcePolicyGateResult {
  allowed: boolean;
  reason?: SourcePolicyGateReason;
}

// ── Notification cooldowns (Phase 8 — deduplicated, cooldown-aware) ─

export interface DiscoveryCooldown {
  userId: string;
  /** Item id (or `${category}:${id}` for category-wide keys). */
  key: string;
  lastNotifiedAt: string;
  nextEligibleAtMs: number;
}

// ── Relevance verdict (Phase 7 — the scheduler never decides alone) ─

export interface SchedulerRelevanceVerdict {
  relevant: boolean;
  score: number;
  reason: string;
}

// ── Status view (Phase 11 — the /ai-world Discovery Activity UI) ───

export interface SchedulerJobStatusView {
  jobCategory: DiscoveryJobCategory;
  label: string;
  enabled: boolean;
  frequency: ScheduleFrequency;
  lastRunAt?: string;
  nextRunAt?: string;
  lastChangeKind?: ChangeKind;
  status: 'running' | 'due' | 'scheduled' | 'disabled';
}

export interface SchedulerStatusView {
  generatedAt: string;
  /** Earliest next run across enabled jobs. */
  nextDiscoveryAt?: string;
  /** Most recent completed scan (any job). */
  lastScanAt?: string;
  /** Meaningful updates from the most recent completed scans. */
  meaningfulUpdates: number;
  jobs: SchedulerJobStatusView[];
}

// ── Discovery result (what the discovery port returns) ─────────────

export interface DiscoveryResult {
  items: DiscoveryItem[];
  reports: DiscoverySourceRunReport[];
  budget: DiscoveryBudget;
}
