// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: InMemorySchedulerStores
// EPIC-018 — development/test persistence (repository convention).
// Every user-scoped store is keyed `(userId, …)` — IDOR-safe by
// construction; records are deep-cloned on read so callers can never
// mutate stored state through a reference. Postgres persistence is a
// documented production operator step (same convention as every other
// EPIC workspace). The run ledger is append-only and bounded (FIFO) —
// never an unbounded sink.
// ──────────────────────────────────────────────────────────────────

import type {
  DiscoveryCooldown,
  DiscoveryRun,
  DiscoveryRunLedger,
  DiscoverySchedule,
  DiscoverySourcePolicy,
} from '../types/scheduler-types.js';
import type { DiscoveryJob } from '../types/scheduler-types.js';
import type {
  CooldownStore,
  JobStore,
  RunStore,
  ScheduleStore,
  SourcePolicyStore,
} from '../contracts/scheduler-ports.js';

/** Ledger retention: the last N runs per user are kept. */
export const LEDGER_RETENTION = 50;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryScheduleStore implements ScheduleStore {
  private readonly byKey = new Map<string, DiscoverySchedule>();

  save(schedule: DiscoverySchedule): void {
    this.byKey.set(`${schedule.userId}:${schedule.jobCategory}`, clone(schedule));
  }

  get(userId: string, jobCategory: string): DiscoverySchedule | undefined {
    const found = this.byKey.get(`${userId}:${jobCategory}`);
    return found ? clone(found) : undefined;
  }

  list(userId: string): DiscoverySchedule[] {
    return [...this.byKey.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => a.jobCategory.localeCompare(b.jobCategory))
      .map(clone);
  }
}

export class InMemoryJobStore implements JobStore {
  private readonly byKey = new Map<string, DiscoveryJob>();

  save(job: DiscoveryJob): void {
    this.byKey.set(`${job.userId}:${job.jobCategory}`, clone(job));
  }

  get(userId: string, jobCategory: string): DiscoveryJob | undefined {
    const found = this.byKey.get(`${userId}:${jobCategory}`);
    return found ? clone(found) : undefined;
  }

  list(userId: string): DiscoveryJob[] {
    return [...this.byKey.values()]
      .filter((j) => j.userId === userId)
      .sort((a, b) => a.jobCategory.localeCompare(b.jobCategory))
      .map(clone);
  }
}

export class InMemoryRunStore implements RunStore {
  private readonly runsByUser = new Map<string, DiscoveryRun[]>();

  save(run: DiscoveryRun): void {
    const runs = this.runsByUser.get(run.userId) ?? [];
    runs.push(clone(run));
    // Bounded FIFO — the ledger can never grow unbounded.
    while (runs.length > LEDGER_RETENTION) runs.shift();
    this.runsByUser.set(run.userId, runs);
  }

  get(userId: string, runId: string): DiscoveryRun | undefined {
    const found = this.runsByUser.get(userId)?.find((r) => r.runId === runId);
    return found ? clone(found) : undefined;
  }

  list(userId: string): DiscoveryRun[] {
    return (this.runsByUser.get(userId) ?? []).map(clone);
  }

  ledger(userId: string): DiscoveryRunLedger {
    return { userId, runs: this.list(userId) };
  }
}

export class InMemorySourcePolicyStore implements SourcePolicyStore {
  private readonly byId = new Map<string, DiscoverySourcePolicy>();

  get(sourceId: string): DiscoverySourcePolicy | undefined {
    const found = this.byId.get(sourceId);
    return found ? clone(found) : undefined;
  }

  save(policy: DiscoverySourcePolicy): void {
    this.byId.set(policy.sourceId, clone(policy));
  }

  list(): DiscoverySourcePolicy[] {
    return [...this.byId.values()].map(clone);
  }
}

export class InMemoryCooldownStore implements CooldownStore {
  private readonly byKey = new Map<string, DiscoveryCooldown>();

  get(userId: string, key: string): DiscoveryCooldown | undefined {
    const found = this.byKey.get(`${userId}:${key}`);
    return found ? clone(found) : undefined;
  }

  save(cooldown: DiscoveryCooldown): void {
    this.byKey.set(`${cooldown.userId}:${cooldown.key}`, clone(cooldown));
  }
}
