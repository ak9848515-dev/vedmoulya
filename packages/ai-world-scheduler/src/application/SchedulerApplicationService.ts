// ──────────────────────────────────────────────────────────────────
// VedMoulya — SchedulerApplicationService
// EPIC-018 — the aiWorldScheduler.* contract implementation.
//
// Owner-scoped at the service: every per-user read/write resolves
// through the caller's own userId (never an arbitrary owner param) —
// the gateway IDOR guard and this service's own scoping both apply.
// Manual runs (runNow) go through the EXACT same bounded safety path
// as scheduled runs — there is no privileged shortcut.
// ──────────────────────────────────────────────────────────────────

import type {
  DiscoveryRun,
  DiscoveryRunLedger,
  DiscoverySchedule,
  DiscoverySourcePolicy,
  SchedulerJobStatusView,
  SchedulerStatusView,
  ScheduleFrequency,
} from '../types/scheduler-types.js';
import type { DiscoveryJobCategory } from '../types/scheduler-types.js';
import { DISCOVERY_JOB_CATEGORIES, DISCOVERY_JOB_LABELS } from '../types/scheduler-types.js';
import type {
  JobStore,
  RunStore,
  ScheduleStore,
  SchedulerClockPort,
} from '../contracts/scheduler-ports.js';
import { DiscoveryScheduler } from '../domain/DiscoveryScheduler.js';
import { ScheduleEngine } from '../domain/ScheduleEngine.js';

export type SchedulerServiceResult<T> =
  { success: true; data: T } | { success: false; error: string; code?: string };

export interface SchedulerApplicationServiceOptions {
  scheduler: DiscoveryScheduler;
  schedules: ScheduleStore;
  jobs: JobStore;
  runs: RunStore;
  clock: SchedulerClockPort;
}

export class SchedulerApplicationService {
  private readonly scheduler: DiscoveryScheduler;
  private readonly schedules: ScheduleStore;
  private readonly jobs: JobStore;
  private readonly runs: RunStore;
  private readonly clock: SchedulerClockPort;
  private readonly scheduleEngine = new ScheduleEngine();

  constructor(options: SchedulerApplicationServiceOptions) {
    this.scheduler = options.scheduler;
    this.schedules = options.schedules;
    this.jobs = options.jobs;
    this.runs = options.runs;
    this.clock = options.clock;
  }

  // ── Status (Phase 11 — the /ai-world Discovery Activity section) ─

  getStatus(userId: string): SchedulerStatusView {
    this.scheduler.ensureDefaults(userId);
    const nowMs = this.clock.timestampMs();
    const jobs = this.jobs.list(userId);
    const runs = this.runs.list(userId);

    const latestRunByCategory = new Map<string, DiscoveryRun>();
    for (const run of runs) {
      const existing = latestRunByCategory.get(run.jobCategory);
      if (!existing || run.startedAt > existing.startedAt) {
        latestRunByCategory.set(run.jobCategory, run);
      }
    }

    let nextDiscoveryAt: string | undefined;
    let lastScanAt: string | undefined;
    let meaningfulUpdates = 0;

    const jobViews: SchedulerJobStatusView[] = [];
    for (const category of DISCOVERY_JOB_CATEGORIES) {
      const job = jobs.find((j) => j.jobCategory === category);
      const latest = latestRunByCategory.get(category);
      const isEnabled = job?.enabled ?? false;

      if (isEnabled && job?.nextRunAt) {
        if (!nextDiscoveryAt || job.nextRunAt < nextDiscoveryAt) nextDiscoveryAt = job.nextRunAt;
      }
      if (latest?.finishedAt && (!lastScanAt || latest.finishedAt > lastScanAt)) {
        lastScanAt = latest.finishedAt;
        if (latest.changeSummary.meaningful) {
          meaningfulUpdates += latest.changeSummary.entries.length;
        }
      }

      const running = job?.inFlight === true;
      const due = isEnabled && job?.nextRunAt !== undefined && Date.parse(job.nextRunAt) <= nowMs;
      jobViews.push({
        jobCategory: category,
        label: DISCOVERY_JOB_LABELS[category],
        enabled: isEnabled,
        frequency: job?.frequency ?? 'DAILY',
        lastRunAt: latest?.finishedAt,
        nextRunAt: job?.nextRunAt,
        lastChangeKind: job?.lastChangeKind ?? latest?.changeSummary.entries[0]?.kind,
        status: running ? 'running' : due ? 'due' : isEnabled ? 'scheduled' : 'disabled',
      });
    }

    return {
      generatedAt: this.clock.now(),
      nextDiscoveryAt,
      lastScanAt,
      meaningfulUpdates,
      jobs: jobViews,
    };
  }

  // ── Reads ────────────────────────────────────────────────────────

  listSchedules(userId: string): DiscoverySchedule[] {
    this.scheduler.ensureDefaults(userId);
    return this.schedules.list(userId);
  }

  listRuns(userId: string): DiscoveryRun[] {
    return this.runs.list(userId);
  }

  getLedger(userId: string): DiscoveryRunLedger {
    return this.runs.ledger(userId);
  }

  listSourcePolicies(): DiscoverySourcePolicy[] {
    return this.scheduler.listSourcePolicies();
  }

  // ── Settings (owner-scoped) ──────────────────────────────────────

  setSchedule(
    userId: string,
    jobCategory: DiscoveryJobCategory,
    patch: { enabled?: boolean; frequency?: ScheduleFrequency },
  ): SchedulerServiceResult<DiscoverySchedule> {
    if (!DISCOVERY_JOB_CATEGORIES.includes(jobCategory)) {
      return {
        success: false,
        error: `Unknown job category: ${jobCategory}`,
        code: 'INVALID_CATEGORY',
      };
    }
    this.scheduler.ensureDefaults(userId);
    const existing = this.schedules.get(userId, jobCategory);
    if (!existing) {
      return { success: false, error: 'Schedule not found', code: 'NOT_FOUND' };
    }
    if (
      patch.frequency !== undefined &&
      !['EVERY_6_HOURS', 'DAILY', 'WEEKLY'].includes(patch.frequency)
    ) {
      return {
        success: false,
        error: `Unknown frequency: ${patch.frequency}`,
        code: 'INVALID_FREQUENCY',
      };
    }

    const frequency = patch.frequency ?? existing.frequency;
    const enabled = patch.enabled ?? existing.enabled;
    const updated: DiscoverySchedule = {
      ...existing,
      enabled,
      frequency,
      updatedAt: this.clock.now(),
    };
    this.schedules.save(updated);

    // Keep the job in sync; a frequency change resets the cadence window.
    const job = this.jobs.get(userId, jobCategory);
    if (job) {
      job.enabled = enabled;
      job.frequency = frequency;
      job.nextRunAt = new Date(
        this.scheduleEngine.nextRunAtMs(
          this.clock.timestampMs(),
          frequency,
          this.clock.timestampMs(),
        ),
      ).toISOString();
      this.jobs.save(job);
    }
    return { success: true, data: updated };
  }

  // ── Run controls (manual runs share the exact scheduled path) ────

  async runNow(
    userId: string,
    jobCategory: DiscoveryJobCategory,
  ): Promise<SchedulerServiceResult<DiscoveryRun>> {
    if (!DISCOVERY_JOB_CATEGORIES.includes(jobCategory)) {
      return {
        success: false,
        error: `Unknown job category: ${jobCategory}`,
        code: 'INVALID_CATEGORY',
      };
    }
    this.scheduler.ensureDefaults(userId);
    const run = await this.scheduler.runJob(userId, jobCategory, { manual: true });
    return { success: true, data: run };
  }

  async tick(
    userId: string,
  ): Promise<{ ran: DiscoveryRun[]; skipped: Array<{ jobCategory: string; reason: string }> }> {
    return this.scheduler.tick(userId);
  }

  cancel(
    userId: string,
    jobCategory: DiscoveryJobCategory,
  ): SchedulerServiceResult<{ jobCategory: DiscoveryJobCategory }> {
    if (!DISCOVERY_JOB_CATEGORIES.includes(jobCategory)) {
      return {
        success: false,
        error: `Unknown job category: ${jobCategory}`,
        code: 'INVALID_CATEGORY',
      };
    }
    this.scheduler.ensureDefaults(userId);
    const result = this.scheduler.cancel(userId, jobCategory);
    if (!result.success)
      return { success: false, error: result.reason ?? 'CANCEL_FAILED', code: result.reason };
    return { success: true, data: { jobCategory } };
  }
}
