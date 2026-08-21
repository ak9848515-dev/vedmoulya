// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: ScheduleEngine tests
// EPIC-018 — WHEN a discovery job may run. Pure time math over the
// default frequencies; every branch is deterministic.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { FREQUENCY_MS, ScheduleEngine } from '../domain/ScheduleEngine.js';
import type { DiscoveryJob } from '../types/scheduler-types.js';

const engine = new ScheduleEngine();

function job(overrides: Partial<DiscoveryJob> = {}): DiscoveryJob {
  return {
    jobId: 'PROVIDER_MODEL_DISCOVERY',
    userId: 'u1',
    jobCategory: 'PROVIDER_MODEL_DISCOVERY',
    policy: {} as DiscoveryJob['policy'],
    enabled: true,
    frequency: 'DAILY',
    inFlight: false,
    cancelRequested: false,
    consecutiveFailures: 0,
    ...overrides,
  };
}

describe('ScheduleEngine — frequency windows', () => {
  it('exposes the three default frequencies in milliseconds', () => {
    expect(FREQUENCY_MS.EVERY_6_HOURS).toBe(6 * 60 * 60 * 1000);
    expect(FREQUENCY_MS.DAILY).toBe(24 * 60 * 60 * 1000);
    expect(FREQUENCY_MS.WEEKLY).toBe(7 * 24 * 60 * 60 * 1000);
    expect(engine.frequencyMs('EVERY_6_HOURS')).toBe(FREQUENCY_MS.EVERY_6_HOURS);
    expect(engine.frequencyMs('DAILY')).toBe(FREQUENCY_MS.DAILY);
    expect(engine.frequencyMs('WEEKLY')).toBe(FREQUENCY_MS.WEEKLY);
  });
});

describe('ScheduleEngine — next eligible run', () => {
  it('a job that has never run is due immediately', () => {
    expect(engine.nextRunAtMs(undefined, 'DAILY', 1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('a job that has run repeats on the frequency window', () => {
    const last = 1_700_000_000_000;
    expect(engine.nextRunAtMs(last, 'WEEKLY', last)).toBe(last + 7 * 24 * 60 * 60 * 1000);
    expect(engine.nextRunAtMs(last, 'EVERY_6_HOURS', last)).toBe(last + 6 * 60 * 60 * 1000);
  });
});

describe('ScheduleEngine — isDue eligibility', () => {
  it('a disabled job is never due', () => {
    expect(engine.isDue(job({ enabled: false }), 1_700_000_000_000)).toBe(false);
  });

  it('an in-flight job is never due (duplicate-run prevention)', () => {
    expect(engine.isDue(job({ inFlight: true }), 1_700_000_000_000)).toBe(false);
  });

  it('a job with no next run is due now', () => {
    expect(engine.isDue(job({ nextRunAt: undefined }), 1_700_000_000_000)).toBe(true);
  });

  it('a job whose window has not arrived is not due', () => {
    const next = new Date(1_700_000_000_000).toISOString();
    expect(engine.isDue(job({ nextRunAt: next }), 1_699_000_000_000)).toBe(false);
  });

  it('a job whose window has arrived is due', () => {
    const next = new Date(1_700_000_000_000).toISOString();
    expect(engine.isDue(job({ nextRunAt: next }), 1_700_000_000_001)).toBe(true);
  });
});
