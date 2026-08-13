// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ai-world-scheduler
// AI World Scheduler & Discovery Engine
// EPIC-018
//
// The controlled, bounded, security-first scheduling layer that makes
// VedMoulya AI World continuously evolve through scheduled discovery.
// The scheduler decides WHEN discovery may run — discovery (WHAT)
// stays in EPIC-012C AI World, intelligence/relevance in EPIC-015/016,
// notifications on the existing surface, and approval in the existing
// EPIC-014/017 infrastructure. Nothing is rebuilt; every engine is
// reached through the narrow ports in ./contracts.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  DiscoveryJobCategory,
  ScheduleFrequency,
  DiscoverySchedule,
  SchedulerRunLimits,
  DiscoveryJobRetryPolicy,
  DiscoveryJobPolicy,
  DiscoveryJob,
  DiscoveryRunStatus,
  DiscoveryRun,
  DiscoveryRunLedger,
  ChangeKind,
  ChangeEntry,
  ChangeSummary,
  SchedulerBudgetSnapshot,
  DiscoverySourcePolicy,
  SourcePolicyGateReason,
  SourcePolicyGateResult,
  DiscoveryCooldown,
  SchedulerRelevanceVerdict,
  SchedulerJobStatusView,
  SchedulerStatusView,
  DiscoveryResult,
} from './types/scheduler-types.js';
export {
  DISCOVERY_JOB_CATEGORIES,
  DISCOVERY_JOB_LABELS,
  SCHEDULE_FREQUENCIES,
} from './types/scheduler-types.js';

// ── Contracts (narrow seams — the ONLY external reach) ───────────
export type {
  SchedulerClockPort,
  SchedulerDiscoveryPort,
  SchedulerBrainPort,
  SchedulerNotifyPort,
  ScheduleStore,
  JobStore,
  RunStore,
  SourcePolicyStore,
  CooldownStore,
} from './contracts/scheduler-ports.js';

// ── Domain engines ───────────────────────────────────────────────
export { ScheduleEngine, FREQUENCY_MS } from './domain/ScheduleEngine.js';
export { DEFAULT_JOB_POLICIES } from './domain/DiscoveryJobPolicy.js';
export { RunBudgetGuard } from './domain/RunBudgetGuard.js';
export { SourcePolicyEngine } from './domain/SourcePolicyEngine.js';
export type { SourcePolicyEngineOptions } from './domain/SourcePolicyEngine.js';
export { CooldownManager } from './domain/CooldownManager.js';
export { ChangeDetector } from './domain/ChangeDetector.js';
export type { ChangeDetectorOptions } from './domain/ChangeDetector.js';
export { DiscoveryScheduler } from './domain/DiscoveryScheduler.js';
export type { DiscoverySchedulerOptions, TickResult } from './domain/DiscoveryScheduler.js';

// ── Infrastructure (dev/test in-memory convention) ───────────────
export {
  InMemoryScheduleStore,
  InMemoryJobStore,
  InMemoryRunStore,
  InMemorySourcePolicyStore,
  InMemoryCooldownStore,
  LEDGER_RETENTION,
} from './infrastructure/InMemorySchedulerStores.js';

// ── Infrastructure (SPRINT-022 — production Postgres persistence) ─
// Same synchronous store ports, write-through to Postgres (mirror +
// async idempotent upserts + boot hydration + shutdown flush).
export {
  PostgresScheduleStore,
  PostgresJobStore,
  PostgresRunStore,
  PostgresSourcePolicyStore,
  PostgresCooldownStore,
  LEDGER_RETENTION as POSTGRES_LEDGER_RETENTION,
} from './infrastructure/PostgresSchedulerStores.js';

// ── Application service (aiWorldScheduler.* contract) ────────────
export { SchedulerApplicationService } from './application/SchedulerApplicationService.js';
export type {
  SchedulerApplicationServiceOptions,
  SchedulerServiceResult,
} from './application/SchedulerApplicationService.js';
