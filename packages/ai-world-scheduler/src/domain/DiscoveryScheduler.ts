// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: DiscoveryScheduler
// EPIC-018 — the WHEN layer.
//
//   Scheduler → AI World Discovery → Evidence/Security/Relevance →
//   Brain (relevance) → Notification gate → user
//
// Architectural rule (preserved): Scheduler ≠ AI World ≠ Brain ≠
// Execution. The scheduler decides WHEN discovery may run; discovery
// stays in EPIC-012C; intelligence/relevance is delegated to the
// SchedulerBrainPort (the scheduler never makes user decisions);
// approval/activation stays in the existing EPIC-014/017 surfaces.
//
// Every run is BOUNDED (RunBudgetGuard over the frozen LoopBudget),
// rate-limited and cooldown-aware per source, retry-limited with
// failure backoff, concurrent-run and duplicate-run protected,
// cancellable, and failure-isolated (one failed source never breaks
// the run). Manual runs (Run now) take the EXACT same path.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type { DiscoverySourceRunReport } from '@vedmoulya/ai-world';
import type {
  ChangeKind,
  DiscoveryJob,
  DiscoveryRun,
  DiscoverySchedule,
  DiscoverySourcePolicy,
} from '../types/scheduler-types.js';
import type {
  CooldownStore,
  JobStore,
  RunStore,
  ScheduleStore,
  SchedulerBrainPort,
  SchedulerClockPort,
  SchedulerDiscoveryPort,
  SchedulerNotifyPort,
  SourcePolicyStore,
} from '../contracts/scheduler-ports.js';
import { DEFAULT_JOB_POLICIES } from './DiscoveryJobPolicy.js';
import { ScheduleEngine } from './ScheduleEngine.js';
import { RunBudgetGuard } from './RunBudgetGuard.js';
import { SourcePolicyEngine } from './SourcePolicyEngine.js';
import { CooldownManager } from './CooldownManager.js';
import { ChangeDetector } from './ChangeDetector.js';

export interface DiscoverySchedulerOptions {
  clock: SchedulerClockPort;
  discovery: SchedulerDiscoveryPort;
  brain: SchedulerBrainPort;
  notify: SchedulerNotifyPort;
  schedules: ScheduleStore;
  jobs: JobStore;
  runs: RunStore;
  sourcePolicies: SourcePolicyStore;
  cooldowns: CooldownStore;
}

export interface TickResult {
  ran: DiscoveryRun[];
  skipped: Array<{ jobCategory: string; reason: string }>;
}

export class DiscoveryScheduler {
  private readonly clock: SchedulerClockPort;
  private readonly discovery: SchedulerDiscoveryPort;
  private readonly brain: SchedulerBrainPort;
  private readonly notify: SchedulerNotifyPort;
  private readonly schedules: ScheduleStore;
  private readonly jobs: JobStore;
  private readonly runs: RunStore;
  private readonly sourcePolicies: SourcePolicyEngine;
  private readonly cooldowns: CooldownManager;
  private readonly scheduleEngine = new ScheduleEngine();
  private readonly changeDetector = new ChangeDetector();

  constructor(options: DiscoverySchedulerOptions) {
    this.clock = options.clock;
    this.discovery = options.discovery;
    this.brain = options.brain;
    this.notify = options.notify;
    this.schedules = options.schedules;
    this.jobs = options.jobs;
    this.runs = options.runs;
    this.sourcePolicies = new SourcePolicyEngine(options.sourcePolicies);
    this.cooldowns = new CooldownManager(options.cooldowns);
  }

  // ── Defaults (idempotent; per-user schedules/jobs) ──────────────

  ensureDefaults(userId: string): void {
    const nowIso = this.clock.now();
    const nowMs = this.clock.timestampMs();
    for (const [category, policy] of Object.entries(DEFAULT_JOB_POLICIES) as Array<
      [DiscoveryJob['jobCategory'], (typeof DEFAULT_JOB_POLICIES)[DiscoveryJob['jobCategory']]]
    >) {
      if (this.schedules.get(userId, category)) continue;
      const schedule: DiscoverySchedule = {
        userId,
        jobCategory: category,
        enabled: true,
        frequency: policy.frequency,
        updatedAt: nowIso,
      };
      const job: DiscoveryJob = {
        jobId: category,
        userId,
        jobCategory: category,
        policy,
        enabled: true,
        frequency: policy.frequency,
        nextRunAt: nowIso, // due immediately → bounded first scan
        inFlight: false,
        cancelRequested: false,
        consecutiveFailures: 0,
      };
      // Next run is due NOW only for the first scan; compute properly.
      job.nextRunAt = new Date(
        this.scheduleEngine.nextRunAtMs(undefined, policy.frequency, nowMs),
      ).toISOString();
      this.schedules.save(schedule);
      this.jobs.save(job);
    }
  }

  // ── Background tick (the cadence driver) ─────────────────────────

  async tick(userId: string): Promise<TickResult> {
    this.ensureDefaults(userId);
    const ran: DiscoveryRun[] = [];
    const skipped: Array<{ jobCategory: string; reason: string }> = [];

    for (const schedule of this.schedules.list(userId)) {
      const job = this.jobs.get(userId, schedule.jobCategory);
      if (!job) continue;
      if (job.inFlight) {
        skipped.push({ jobCategory: schedule.jobCategory, reason: 'CONCURRENT_RUN_IN_PROGRESS' });
        continue;
      }
      if (!this.scheduleEngine.isDue(job, this.clock.timestampMs())) {
        skipped.push({ jobCategory: schedule.jobCategory, reason: 'NOT_DUE' });
        continue;
      }
      const run = await this.runJob(userId, schedule.jobCategory, { manual: false });
      if (run.status === 'SKIPPED') {
        skipped.push({ jobCategory: schedule.jobCategory, reason: run.skipReason ?? 'SKIPPED' });
      } else {
        ran.push(run);
      }
    }
    return { ran, skipped };
  }

  // ── Run one job (manual = the same bounded path, no shortcut) ────

  async runJob(
    userId: string,
    jobCategory: DiscoveryJob['jobCategory'],
    opts: { manual?: boolean } = {},
  ): Promise<DiscoveryRun> {
    this.ensureDefaults(userId);
    const manual = opts.manual ?? false;
    const nowIso = this.clock.now();
    const nowMs = this.clock.timestampMs();
    const job =
      this.jobs.get(userId, jobCategory) ?? this.seedJob(userId, jobCategory, nowIso, nowMs);
    const policy = job.policy;

    const skipped = (reason: string): DiscoveryRun =>
      this.finishRun(
        job,
        {
          runId: `run-${generateId()}`,
          userId,
          jobCategory,
          manual,
          status: 'SKIPPED',
          startedAt: nowIso,
          skipReason: reason,
          changeSummary: {
            ranAt: nowIso,
            meaningful: false,
            counts: { NO_CHANGE: 0, NEW: 0, UPDATED: 0, REMOVED: 0, CRITICAL_CHANGE: 0 },
            entries: [],
          },
          notifications: { emitted: 0, deduplicated: 0, skipped: 0 },
          budget: {
            spentTokens: 0,
            spentCostUsd: 0,
            spentLatencyMs: 0,
            discoveryCalls: 0,
            sourceCalls: 0,
            exceeded: false,
          },
          sourceReports: [],
        },
        { persist: manual, nowIso, nowMs },
      );

    // Duplicate-run prevention: a non-manual run outside its window is skipped.
    if (!manual && job.nextRunAt !== undefined && Date.parse(job.nextRunAt) > nowMs) {
      return skipped('NOT_DUE');
    }
    // Explicit cancellation of a queued job (no run in flight yet).
    if (job.cancelRequested && !job.inFlight) {
      job.cancelRequested = false;
      this.jobs.save(job);
      return this.cancelledRun(job, userId, jobCategory, manual, nowIso, nowMs);
    }
    // Concurrent-run prevention (a cancellation request on an in-flight run is
    // observed inside the discovery loop via the store).
    if (job.inFlight) {
      return skipped('CONCURRENT_RUN_IN_PROGRESS');
    }

    job.inFlight = true;
    job.cancelRequested = false;
    this.jobs.save(job);

    const budget = new RunBudgetGuard(policy.runLimits, () => this.clock.timestampMs());
    const baseline = await this.discovery.listStoredItems();
    const sourceIds = this.discovery.listSourceIds();

    let status: DiscoveryRun['status'] = 'COMPLETED';
    let error: string | undefined;
    let sourceReports: DiscoverySourceRunReport[] = [];
    const maxAttempts = Math.max(1, policy.runLimits.maxDiscoveryCalls);

    // Per-source policy gates (enabled → cooldown → backoff → rate limit →
    // budget) are evaluated ONCE per run. Backoff/cooldown apply between RUNS;
    // retries WITHIN a run reuse the same eligibility (bounded by the budget).
    const eligible = sourceIds.filter((id) => {
      const gate = this.sourcePolicies.gate(id, {
        nowMs,
        runBudgetExceeded: false,
      });
      return gate.allowed;
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const canRun = budget.canDiscover();
      if (!canRun.ok) {
        status = 'FAILED';
        error = canRun.reason ?? 'budget exceeded';
        break;
      }
      budget.recordDiscoveryCall();

      // Mid-run cancellation is observed through the STORE (cancel() writes
      // there) so an in-flight run stops at the next boundary.
      if (this.jobs.get(userId, jobCategory)?.cancelRequested === true) {
        status = 'CANCELLED';
        break;
      }

      if (eligible.length === 0) break; // honest stop — every source cooling/disabled

      try {
        const result = await this.discovery.discover({
          budget: policy.discoveryBudget,
          sourceIds: eligible,
        });
        sourceReports = result.reports;
        for (const report of result.reports) {
          budget.recordSourceCall(report.durationMs);
          this.sourcePolicies.recordAttempt(report.source, {
            success: !report.failed,
            meaningful: report.added > 0,
            calls: 1,
            nowMs,
            nowIso,
            baseBackoffMs: policy.retry.baseBackoffMs,
            maxBackoffMs: policy.retry.maxBackoffMs,
          });
        }
        break; // one bounded pass completed
      } catch (err) {
        // Record the source failures so backoff + consecutive-failure tracking
        // are honest, then retry bounded — never infinite.
        for (const sourceId of eligible) {
          this.sourcePolicies.recordAttempt(sourceId, {
            success: false,
            meaningful: false,
            calls: 1,
            nowMs,
            nowIso,
            baseBackoffMs: policy.retry.baseBackoffMs,
            maxBackoffMs: policy.retry.maxBackoffMs,
          });
        }
        if (attempt < maxAttempts && attempt <= policy.retry.maxRetries) {
          continue;
        }
        status = 'FAILED';
        error = err instanceof Error ? err.message : String(err);
        break;
      }
    }

    let budgetSnapshot = budget.snapshot();
    // Fail-closed wall-clock enforcement — catches overruns even when a single
    // bounded pass completed (the budget is checked before AND after the run).
    if (status === 'COMPLETED' && budget.elapsedMs() > policy.runLimits.maxRuntimeMs) {
      status = 'FAILED';
      error = `TIMEOUT: wall-clock budget exceeded (${String(budget.elapsedMs())}ms > ${String(policy.runLimits.maxRuntimeMs)}ms)`;
      budgetSnapshot = { ...budgetSnapshot, exceeded: true, failureReason: error };
    } else if (status === 'COMPLETED' && budgetSnapshot.exceeded && sourceReports.length === 0) {
      status = 'FAILED';
      error = budgetSnapshot.failureReason ?? 'budget exceeded';
    }

    // Change detection (Phase 6).
    const after = await this.discovery.listStoredItems();
    const changeSummary = this.changeDetector.detect(baseline, after, {
      itemCategories: policy.itemCategories,
      criticalMinRelevance: policy.criticalMinRelevance,
      nowIso,
    });

    // Relevance (Phase 7) + notification gate (Phase 8).
    const notifications = { emitted: 0, deduplicated: 0, skipped: 0 };
    if (status !== 'CANCELLED' && status !== 'FAILED') {
      for (const entry of changeSummary.entries) {
        const verdict = this.brain.evaluateRelevance(userId, entry.item);
        if (!verdict.relevant) {
          notifications.skipped += 1;
          continue;
        }
        const key = entry.item.id;
        if (!this.cooldowns.isEligible(userId, key, policy.notificationCooldownMs, nowMs)) {
          notifications.deduplicated += 1;
          continue;
        }
        const result = await this.notify.notify(userId, {
          item: entry.item,
          change: entry.kind,
        });
        if (result.emitted) {
          notifications.emitted += 1;
          this.cooldowns.record(userId, key, nowIso, nowMs, policy.notificationCooldownMs);
        } else {
          notifications.skipped += 1;
        }
      }
    }

    return this.finishRun(
      job,
      {
        runId: `run-${generateId()}`,
        userId,
        jobCategory,
        manual,
        status,
        startedAt: nowIso,
        finishedAt: this.clock.now(),
        error,
        changeSummary,
        notifications,
        budget: budgetSnapshot,
        sourceReports,
      },
      { persist: true, nowIso, nowMs },
    );
  }

  /** Request cancellation of an in-flight (or queued) job. */
  cancel(
    userId: string,
    jobCategory: DiscoveryJob['jobCategory'],
  ): { success: boolean; reason?: string } {
    const job = this.jobs.get(userId, jobCategory);
    if (!job) return { success: false, reason: 'JOB_NOT_FOUND' };
    if (!job.inFlight) return { success: false, reason: 'NOT_RUNNING' };
    job.cancelRequested = true;
    this.jobs.save(job);
    return { success: true };
  }

  /** Source policy read view (platform-wide infrastructure state). */
  listSourcePolicies(): DiscoverySourcePolicy[] {
    return this.sourcePolicies.list();
  }

  getJob(userId: string, jobCategory: DiscoveryJob['jobCategory']): DiscoveryJob | undefined {
    return this.jobs.get(userId, jobCategory);
  }

  // ── Internals ────────────────────────────────────────────────────

  private cancelledRun(
    job: DiscoveryJob,
    userId: string,
    jobCategory: DiscoveryJob['jobCategory'],
    manual: boolean,
    nowIso: string,
    nowMs: number,
  ): DiscoveryRun {
    return this.finishRun(
      job,
      {
        runId: `run-${generateId()}`,
        userId,
        jobCategory,
        manual,
        status: 'CANCELLED',
        startedAt: nowIso,
        finishedAt: nowIso,
        changeSummary: {
          ranAt: nowIso,
          meaningful: false,
          counts: { NO_CHANGE: 0, NEW: 0, UPDATED: 0, REMOVED: 0, CRITICAL_CHANGE: 0 },
          entries: [],
        },
        notifications: { emitted: 0, deduplicated: 0, skipped: 0 },
        budget: {
          spentTokens: 0,
          spentCostUsd: 0,
          spentLatencyMs: 0,
          discoveryCalls: 0,
          sourceCalls: 0,
          exceeded: false,
        },
        sourceReports: [],
      },
      { persist: true, nowIso, nowMs },
    );
  }

  private seedJob(
    userId: string,
    jobCategory: DiscoveryJob['jobCategory'],
    nowIso: string,
    nowMs: number,
  ): DiscoveryJob {
    const policy = DEFAULT_JOB_POLICIES[jobCategory];
    const job: DiscoveryJob = {
      jobId: jobCategory,
      userId,
      jobCategory,
      policy,
      enabled: true,
      frequency: policy.frequency,
      nextRunAt: new Date(
        this.scheduleEngine.nextRunAtMs(undefined, policy.frequency, nowMs),
      ).toISOString(),
      inFlight: false,
      cancelRequested: false,
      consecutiveFailures: 0,
    };
    this.jobs.save(job);
    return job;
  }

  private finishRun(
    job: DiscoveryJob,
    run: DiscoveryRun,
    opts: { persist: boolean; nowIso: string; nowMs: number },
  ): DiscoveryRun {
    if (opts.persist) {
      // Bounded ledger retention (FIFO) is enforced by the run store.
      this.runs.save(run);
    }
    job.inFlight = false;
    job.cancelRequested = false;
    job.lastRunAt = opts.nowIso;
    job.nextRunAt = new Date(
      this.scheduleEngine.nextRunAtMs(opts.nowMs, job.frequency, opts.nowMs),
    ).toISOString();
    if (run.status === 'COMPLETED') {
      job.consecutiveFailures = 0;
      job.lastChangeKind = dominantChangeKind(run.changeSummary.counts);
    } else if (run.status === 'FAILED') {
      job.consecutiveFailures += 1;
    }
    this.jobs.save(job);
    return run;
  }
}

/** The most significant change kind for the job status chip. */
function dominantChangeKind(
  counts: DiscoveryRun['changeSummary']['counts'],
): ChangeKind | undefined {
  if (counts.CRITICAL_CHANGE > 0) return 'CRITICAL_CHANGE';
  if (counts.NEW > 0) return 'NEW';
  if (counts.UPDATED > 0) return 'UPDATED';
  if (counts.REMOVED > 0) return 'REMOVED';
  return undefined;
}
