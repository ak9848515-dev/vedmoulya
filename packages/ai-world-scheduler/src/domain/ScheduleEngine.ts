// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: ScheduleEngine
// EPIC-018 — decides WHEN a discovery job may run.
// Pure time math over the default frequencies. The defaults are
// DEFAULTS — schedules are per-user settings the UI can change, and
// nothing here is an immutable hardcode.
// ──────────────────────────────────────────────────────────────────

import type { DiscoveryJob, ScheduleFrequency } from '../types/scheduler-types.js';

export const FREQUENCY_MS: Record<ScheduleFrequency, number> = {
  EVERY_6_HOURS: 6 * 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
};

export class ScheduleEngine {
  frequencyMs(frequency: ScheduleFrequency): number {
    return FREQUENCY_MS[frequency];
  }

  /**
   * Next eligible run. A job that has never run is due immediately
   * (bounded first scan); afterwards it repeats on the frequency window.
   */
  nextRunAtMs(
    lastRunAtMs: number | undefined,
    frequency: ScheduleFrequency,
    nowMs: number,
  ): number {
    if (lastRunAtMs === undefined) return nowMs;
    return lastRunAtMs + this.frequencyMs(frequency);
  }

  /** Whether a job is eligible to start now (duplicate-run prevention built in). */
  isDue(job: DiscoveryJob, nowMs: number): boolean {
    if (!job.enabled) return false;
    if (job.inFlight) return false;
    if (job.nextRunAt === undefined) return true;
    return Date.parse(job.nextRunAt) <= nowMs;
  }
}
