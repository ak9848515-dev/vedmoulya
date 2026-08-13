// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: OS Health Scheduler Tests
// Verifies the scheduled OS health-pass cadence (continuous monitoring feed).
// OS-003 — Version 1.0 Freeze (operational cadence).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { OSApplicationService } from '@vedmoulya/os-intelligence';
import {
  startOSHealthScheduler,
  stopOSHealthScheduler,
  getOSHealthScheduler,
} from '../observability/os-health-scheduler.js';

/** Build a fake OS service whose dashboard resolves with a healthy pass. */
function fakeOS(overrides?: { dashboard?: ReturnType<typeof vi.fn> }): {
  dashboard: ReturnType<typeof vi.fn>;
  svc: OSApplicationService;
} {
  const dashboard =
    overrides?.dashboard ??
    vi.fn().mockResolvedValue({
      success: true,
      data: {
        health: { overallScore: 92, status: 'healthy' },
        snapshotHistory: [],
      },
      latency: 12,
    });
  return { dashboard, svc: { dashboard } as unknown as OSApplicationService };
}

describe('startOSHealthScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopOSHealthScheduler();
  });

  afterEach(() => {
    stopOSHealthScheduler();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs an immediate pass on start and records the result', async () => {
    const { dashboard, svc } = fakeOS();
    startOSHealthScheduler({ getOS: () => svc, intervalMs: 60_000 });
    await vi.advanceTimersByTimeAsync(0);

    expect(dashboard).toHaveBeenCalledTimes(1);
    expect(getOSHealthScheduler()?.lastRun).toMatchObject({
      success: true,
      overallScore: 92,
      status: 'healthy',
      latencyMs: 12,
    });
  });

  it('runs a pass on every interval tick', async () => {
    const { dashboard, svc } = fakeOS();
    startOSHealthScheduler({ getOS: () => svc, intervalMs: 30_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(dashboard).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(dashboard).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(dashboard).toHaveBeenCalledTimes(3);
  });

  it('skips the immediate run when runImmediately is false', async () => {
    const { dashboard, svc } = fakeOS();
    startOSHealthScheduler({ getOS: () => svc, intervalMs: 30_000, runImmediately: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(dashboard).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(dashboard).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — returns the same singleton scheduler', () => {
    const { svc } = fakeOS();
    const first = startOSHealthScheduler({ getOS: () => svc, intervalMs: 60_000 });
    const second = startOSHealthScheduler({ getOS: () => svc, intervalMs: 60_000 });
    expect(second).toBe(first);
  });

  it('never overlaps passes when a pass is still running', async () => {
    let resolvePass: ((value: unknown) => void) | undefined;
    const dashboard = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => (resolvePass = resolve as (value: unknown) => void)),
      );
    const { svc } = fakeOS({ dashboard });
    startOSHealthScheduler({ getOS: () => svc, intervalMs: 1_000, runImmediately: false });

    await vi.advanceTimersByTimeAsync(1_000); // first pass starts (pending)
    await vi.advanceTimersByTimeAsync(3_000); // interval fires while pending
    expect(dashboard).toHaveBeenCalledTimes(1);

    resolvePass?.({ success: true });
    await vi.advanceTimersByTimeAsync(1_000); // next tick after completion
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it('records a failed pass without throwing and continues the cadence', async () => {
    const dashboard = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: 'probe failed' })
      .mockResolvedValueOnce({
        success: true,
        data: { health: { overallScore: 88, status: 'degraded' }, snapshotHistory: [] },
        latency: 9,
      });
    const { svc } = fakeOS({ dashboard });
    startOSHealthScheduler({ getOS: () => svc, intervalMs: 30_000 });
    await vi.advanceTimersByTimeAsync(0);

    expect(getOSHealthScheduler()?.lastRun).toMatchObject({
      success: false,
      error: 'probe failed',
    });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(getOSHealthScheduler()?.lastRun).toMatchObject({ success: true, status: 'degraded' });
  });

  it('records a thrown error from the pass without propagating it', async () => {
    const dashboard = vi.fn().mockRejectedValue(new Error('boom'));
    const { svc } = fakeOS({ dashboard });
    startOSHealthScheduler({ getOS: () => svc, intervalMs: 60_000 });
    await vi.advanceTimersByTimeAsync(0);

    expect(getOSHealthScheduler()?.lastRun).toMatchObject({ success: false, error: 'boom' });
  });

  it('returns a no-op scheduler when disabled', async () => {
    const { dashboard, svc } = fakeOS();
    const sched = startOSHealthScheduler({ getOS: () => svc, intervalMs: 30_000, enabled: false });
    await vi.advanceTimersByTimeAsync(120_000);

    expect(dashboard).not.toHaveBeenCalled();
    expect(getOSHealthScheduler()).toBeUndefined();
    expect(sched.lastRun).toBeUndefined();
    expect(() => sched.stop()).not.toThrow();
  });

  it('stop clears the timer and resets the singleton', async () => {
    const { dashboard, svc } = fakeOS();
    startOSHealthScheduler({ getOS: () => svc, intervalMs: 30_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(dashboard).toHaveBeenCalledTimes(1);

    stopOSHealthScheduler();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(dashboard).toHaveBeenCalledTimes(1);
    expect(getOSHealthScheduler()).toBeUndefined();
  });

  it('falls back to the env var / default interval when intervalMs is omitted', async () => {
    const original = process.env.OS_HEALTH_INTERVAL_MS;
    try {
      process.env.OS_HEALTH_INTERVAL_MS = '15000';
      const { dashboard, svc } = fakeOS();
      const sched = startOSHealthScheduler({ getOS: () => svc, runImmediately: false });
      await vi.advanceTimersByTimeAsync(0);
      expect(dashboard).not.toHaveBeenCalled();

      // The env-derived interval (15s) drives the cadence.
      await vi.advanceTimersByTimeAsync(15_000);
      expect(dashboard).toHaveBeenCalledTimes(1);

      // stop() on the returned handle clears the timer too.
      sched.stop();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(dashboard).toHaveBeenCalledTimes(1);
    } finally {
      if (original === undefined) {
        delete process.env.OS_HEALTH_INTERVAL_MS;
      } else {
        process.env.OS_HEALTH_INTERVAL_MS = original;
      }
    }
  });
});
