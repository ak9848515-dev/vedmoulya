// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: PostgresSchedulerStores
// SPRINT-022 — Persistent Intelligence Foundation
//
// Production persistence for the EPIC-018 scheduler stores, implementing
// the SAME synchronous ports as the in-memory stores (save(): void — the
// frozen contract is unchanged). Write-through Postgres via the shared
// @vedmoulya/core WriteThroughDocumentStore base:
//   • schedules/jobs/runs/cooldowns — owner-scoped (userId key prefix);
//   • source policies — PLATFORM-WIDE infrastructure state (owner ''),
//     exactly like the in-memory convention;
//   • the run ledger stays append-ordered + bounded (FIFO 50 per user —
//     LEDGER_RETENTION, same constant as the in-memory store);
//   • every record survives process restart (hydrate at boot, idempotent
//     upserts, flush at shutdown).
// IDOR: every query keys on (owner, key) — a foreign userId can never
// address another user's records.
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';
import type {
  DiscoveryCooldown,
  DiscoveryJob,
  DiscoveryRun,
  DiscoveryRunLedger,
  DiscoverySchedule,
  DiscoverySourcePolicy,
} from '../types/scheduler-types.js';
import type {
  CooldownStore,
  JobStore,
  RunStore,
  ScheduleStore,
  SourcePolicyStore,
} from '../contracts/scheduler-ports.js';

/** Ledger retention: the last N runs per user are kept (matches in-memory). */
export const LEDGER_RETENTION = 50;

function byStartedAt(a: DiscoveryRun, b: DiscoveryRun): number {
  return Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.runId.localeCompare(b.runId);
}

/** Owner-scoped schedule store — keyed (userId, jobCategory). */
export class PostgresScheduleStore
  extends WriteThroughDocumentStore<DiscoverySchedule>
  implements ScheduleStore
{
  constructor(sql: postgres.Sql, table = 'ai_world_schedules') {
    super(sql, table);
  }

  save(schedule: DiscoverySchedule): void {
    this.write(schedule.userId, schedule.jobCategory, schedule);
  }

  get(userId: string, jobCategory: string): DiscoverySchedule | undefined {
    return this.read(userId, jobCategory);
  }

  list(userId: string): DiscoverySchedule[] {
    return this.all(userId).sort((a, b) => a.jobCategory.localeCompare(b.jobCategory));
  }
}

/** Owner-scoped job store — keyed (userId, jobCategory). */
export class PostgresJobStore extends WriteThroughDocumentStore<DiscoveryJob> implements JobStore {
  constructor(sql: postgres.Sql, table = 'ai_world_jobs') {
    super(sql, table);
  }

  save(job: DiscoveryJob): void {
    this.write(job.userId, job.jobCategory, job);
  }

  get(userId: string, jobCategory: string): DiscoveryJob | undefined {
    return this.read(userId, jobCategory);
  }

  list(userId: string): DiscoveryJob[] {
    return this.all(userId).sort((a, b) => a.jobCategory.localeCompare(b.jobCategory));
  }
}

/**
 * Owner-scoped run store. Each run is persisted under its stable runId
 * (idempotent upsert — re-running never duplicates records), and the
 * per-user ledger is bounded FIFO (LEDGER_RETENTION), pruned in the
 * mirror AND the database. list() is deterministically chronological.
 */
export class PostgresRunStore extends WriteThroughDocumentStore<DiscoveryRun> implements RunStore {
  constructor(sql: postgres.Sql, table = 'ai_world_runs') {
    super(sql, table);
  }

  save(run: DiscoveryRun): void {
    this.write(run.userId, run.runId, run);
    this.prune(
      run.userId,
      LEDGER_RETENTION,
      (r) => r.startedAt,
      (r) => r.runId,
    );
  }

  get(userId: string, runId: string): DiscoveryRun | undefined {
    return this.read(userId, runId);
  }

  list(userId: string): DiscoveryRun[] {
    return this.all(userId).sort(byStartedAt);
  }

  ledger(userId: string): DiscoveryRunLedger {
    return { userId, runs: this.list(userId) };
  }
}

/** Platform-wide source policy store (owner '' — infrastructure state). */
export class PostgresSourcePolicyStore
  extends WriteThroughDocumentStore<DiscoverySourcePolicy>
  implements SourcePolicyStore
{
  constructor(sql: postgres.Sql, table = 'ai_world_source_policies') {
    super(sql, table);
  }

  get(sourceId: string): DiscoverySourcePolicy | undefined {
    return this.read('', sourceId);
  }

  save(policy: DiscoverySourcePolicy): void {
    this.write('', policy.sourceId, policy);
  }

  list(): DiscoverySourcePolicy[] {
    return this.all('');
  }
}

/** Owner-scoped notification-cooldown store — keyed (userId, cooldown key). */
export class PostgresCooldownStore
  extends WriteThroughDocumentStore<DiscoveryCooldown>
  implements CooldownStore
{
  constructor(sql: postgres.Sql, table = 'ai_world_cooldowns') {
    super(sql, table);
  }

  get(userId: string, key: string): DiscoveryCooldown | undefined {
    return this.read(userId, key);
  }

  save(cooldown: DiscoveryCooldown): void {
    this.write(cooldown.userId, cooldown.key, cooldown);
  }
}
