// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: AI World Scheduler Cadence Driver Tests
// EPIC-018 — RUNTIME CLOSURE.
// Hermetic: fake timers + injected scheduler/user-source/logger — no network,
// no sleeps, no real services. Proves the driver is only a HEARTBEAT: it never
// implements scheduling policy (due-ness stays in DiscoveryScheduler), never
// overlaps ticks, never crashes on failures, and logs no user data.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { SchedulerApplicationService } from '@vedmoulya/ai-world-scheduler';
import type { DiscoveryRun } from '@vedmoulya/ai-world-scheduler';
import {
  startSchedulerCadenceDriver,
  stopSchedulerCadenceDriver,
  getSchedulerCadenceDriver,
  createBrainIntelligenceRefresh,
} from '../observability/scheduler-cadence.js';
import type {
  BrainIntelligenceRefreshDeps,
  SchedulerCadenceLogger,
  SchedulerCadenceUserSource,
  SchedulerIntelligenceRefreshPort,
} from '../observability/scheduler-cadence.js';

/** A fake run record (the driver only counts — shape fidelity is irrelevant). */
function run(overrides: Partial<DiscoveryRun> = {}): DiscoveryRun {
  return {
    runId: 'run-1',
    userId: 'u',
    jobCategory: 'AI_NEWS_DISCOVERY',
    manual: false,
    status: 'COMPLETED',
    startedAt: '2026-08-12T00:00:00.000Z',
    changeSummary: {
      ranAt: '2026-08-12T00:00:00.000Z',
      meaningful: false,
      counts: { NO_CHANGE: 1, NEW: 0, UPDATED: 0, REMOVED: 0, CRITICAL_CHANGE: 0 },
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
    ...overrides,
  };
}

interface Harness {
  scheduler: { tick: ReturnType<typeof vi.fn> };
  refresh: ReturnType<typeof vi.fn>;
  refreshIntelligence: SchedulerIntelligenceRefreshPort;
  users: SchedulerCadenceUserSource;
  log: SchedulerCadenceLogger & {
    infos: Array<{ message: string; fields?: Record<string, unknown> }>;
    warns: Array<{ message: string; fields?: Record<string, unknown> }>;
  };
  makeScheduler: () => SchedulerApplicationService;
}

function makeHarness(options?: { userIds?: string[]; directoryError?: boolean }): Harness {
  const userIds = options?.userIds ?? ['user-a', 'user-b'];
  const tick = vi.fn().mockResolvedValue({ ran: [run()], skipped: [] });
  const refresh = vi.fn().mockResolvedValue({ newOpportunities: 0, notificationsEmitted: 0 });
  const infos: Harness['log']['infos'] = [];
  const warns: Harness['log']['warns'] = [];
  const log: Harness['log'] = {
    infos,
    warns,
    info: (message, fields) => {
      infos.push({ message, fields });
    },
    warn: (message, fields) => {
      warns.push({ message, fields });
    },
    error: () => undefined,
  };
  return {
    scheduler: { tick },
    refresh,
    refreshIntelligence: { refresh },
    users: {
      async listUserIds() {
        if (options?.directoryError) throw new Error('database unavailable');
        return userIds;
      },
    },
    log,
    makeScheduler: () => ({ tick }) as unknown as SchedulerApplicationService,
  };
}

describe('startSchedulerCadenceDriver (EPIC-018 runtime closure)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopSchedulerCadenceDriver();
    // Hermetic against a host-inherited environment: the cadence family flags
    // are controlled by the tests themselves, never by whatever exported them
    // (e.g. a shell `AI_WORLD_CADENCE_ENABLED=false` — the D2 config trap —
    // must not silently disable the driver under test).
    delete process.env.AI_WORLD_CADENCE_ENABLED;
    delete process.env.AI_WORLD_CADENCE_REFRESH_INTELLIGENCE;
    delete process.env.AI_WORLD_CADENCE_PROACTIVE;
  });

  afterEach(() => {
    stopSchedulerCadenceDriver();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs an immediate tick on start and records the result', async () => {
    const h = makeHarness();
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(h.scheduler.tick).toHaveBeenCalledTimes(2); // both users
    expect(h.scheduler.tick).toHaveBeenCalledWith('user-a');
    expect(h.scheduler.tick).toHaveBeenCalledWith('user-b');
    expect(getSchedulerCadenceDriver()?.lastTick).toMatchObject({
      usersProcessed: 2,
      runsStarted: 2,
      runsSkipped: 0,
      opportunitiesFound: 0,
      notificationsEmitted: 0,
      errors: 0,
      truncated: false,
    });
    // EPIC-021 — the Brain bridge rides the same heartbeat (once per user).
    expect(h.refresh).toHaveBeenCalledTimes(2);
    expect(getSchedulerCadenceDriver()?.status().refreshIntelligenceEnabled).toBe(true);
  });

  it('calls tick on every interval cadence', async () => {
    const h = makeHarness();
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 30_000,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.scheduler.tick).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.scheduler.tick).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.scheduler.tick).toHaveBeenCalledTimes(6);
  });

  it('never overlaps ticks when a tick is still running', async () => {
    const h = makeHarness();
    let resolveUserA: ((v: unknown) => void) | undefined;
    h.scheduler.tick
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveUserA = resolve as (v: unknown) => void;
          }),
      )
      .mockResolvedValue({ ran: [], skipped: [] });
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 1_000,
      runImmediately: false,
    });

    await vi.advanceTimersByTimeAsync(1_000); // first tick starts (pending)
    await vi.advanceTimersByTimeAsync(5_000); // interval fires while pending
    expect(h.scheduler.tick).toHaveBeenCalledTimes(1);

    resolveUserA?.({ ran: [], skipped: [] });
    await vi.advanceTimersByTimeAsync(0); // current tick finishes (user-b)
    expect(h.scheduler.tick).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1_000); // next interval after completion
    expect(h.scheduler.tick).toHaveBeenCalledTimes(4); // both users again
  });

  it('isolates a per-user failure and continues with the remaining users', async () => {
    const h = makeHarness();
    h.scheduler.tick
      .mockImplementationOnce(async () => {
        throw new Error('source outage for user-a');
      })
      .mockResolvedValue({ ran: [run()], skipped: [] });
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(h.scheduler.tick).toHaveBeenCalledTimes(2); // user-b still ticked
    expect(getSchedulerCadenceDriver()?.lastTick).toMatchObject({
      usersProcessed: 2,
      runsStarted: 1,
      errors: 1,
    });
  });

  it('EPIC-021 — surfaces new opportunities + notifications per user', async () => {
    const h = makeHarness();
    h.refresh.mockResolvedValue({ newOpportunities: 2, notificationsEmitted: 1 });
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(h.refresh).toHaveBeenCalledTimes(2); // both users
    expect(h.refresh).toHaveBeenCalledWith('user-a');
    expect(h.refresh).toHaveBeenCalledWith('user-b');
    expect(getSchedulerCadenceDriver()?.lastTick).toMatchObject({
      opportunitiesFound: 4, // 2 new per user
      notificationsEmitted: 2, // 1 per user
    });
  });

  it('EPIC-021 — isolates an intelligence refresh failure per user', async () => {
    const h = makeHarness();
    h.refresh
      .mockImplementationOnce(async () => {
        throw new Error('brain bridge outage for user-a');
      })
      .mockResolvedValue({ newOpportunities: 1, notificationsEmitted: 1 });
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(0);

    // The scheduler tick still ran for both users; the refresh failure is
    // recorded but never breaks the pass — user-b still refreshed.
    expect(h.scheduler.tick).toHaveBeenCalledTimes(2);
    expect(h.refresh).toHaveBeenCalledTimes(2);
    expect(getSchedulerCadenceDriver()?.lastTick).toMatchObject({
      usersProcessed: 2,
      opportunitiesFound: 1,
      notificationsEmitted: 1,
      errors: 1,
    });
  });

  it('EPIC-021 — refreshIntelligenceEnabled=false skips the Brain bridge', async () => {
    const h = makeHarness();
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      refreshIntelligenceEnabled: false,
      intervalMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(h.scheduler.tick).toHaveBeenCalledTimes(2); // scheduler unchanged
    expect(h.refresh).not.toHaveBeenCalled();
    expect(getSchedulerCadenceDriver()?.status().refreshIntelligenceEnabled).toBe(false);
    expect(getSchedulerCadenceDriver()?.lastTick).toMatchObject({
      opportunitiesFound: 0,
      notificationsEmitted: 0,
    });
  });

  it('aborts the tick HONESTLY when the user directory is unavailable', async () => {
    const h = makeHarness({ directoryError: true });
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(h.scheduler.tick).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
    expect(getSchedulerCadenceDriver()?.lastTick?.userDirectoryError).toBe('database unavailable');
    expect(getSchedulerCadenceDriver()?.lastTick?.usersProcessed).toBe(0);
    expect(h.log.warns.some((w) => w.message.includes('user directory unavailable'))).toBe(true);
  });

  it('respects the scheduler NOT_DUE authority (driver never decides policy)', async () => {
    const h = makeHarness();
    h.scheduler.tick.mockResolvedValue({
      ran: [],
      skipped: [{ jobCategory: 'AI_NEWS_DISCOVERY', reason: 'NOT_DUE' }],
    });
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(getSchedulerCadenceDriver()?.lastTick).toMatchObject({
      runsStarted: 0,
      runsSkipped: 2,
      usersProcessed: 2,
    });
    // The driver passes the user id through untouched — it makes no due decision.
    expect(h.scheduler.tick).toHaveBeenNthCalledWith(1, 'user-a');
  });

  it('caps users per tick (bounded crawl, never unbounded)', async () => {
    const h = makeHarness({ userIds: ['u1', 'u2', 'u3', 'u4', 'u5'] });
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
      maxUsersPerTick: 2,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(h.scheduler.tick).toHaveBeenCalledTimes(2);
    expect(getSchedulerCadenceDriver()?.lastTick?.usersProcessed).toBe(2);
    expect(getSchedulerCadenceDriver()?.status().maxUsersPerTick).toBe(2);
  });

  it('stops early and reports truncated when the wall-clock bound is hit', async () => {
    const h = makeHarness({ userIds: ['u1', 'u2', 'u3'] });
    let clock = 0;
    h.scheduler.tick.mockImplementation(async () => {
      // Each user tick consumes 10s of wall-clock time.
      clock += 10_000;
      return { ran: [], skipped: [] };
    });
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
      maxTickDurationMs: 15_000,
      now: () => clock,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(getSchedulerCadenceDriver()?.lastTick?.truncated).toBe(true);
    expect(getSchedulerCadenceDriver()?.lastTick?.usersProcessed).toBe(2);
    expect(h.log.warns.some((w) => w.message.includes('truncated'))).toBe(true);
  });

  it('stop clears the timer and no tick runs after shutdown', async () => {
    const h = makeHarness();
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 30_000,
      runImmediately: false,
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.scheduler.tick).toHaveBeenCalledTimes(2);

    stopSchedulerCadenceDriver();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.scheduler.tick).toHaveBeenCalledTimes(2);
    expect(getSchedulerCadenceDriver()).toBeUndefined();
  });

  it('is idempotent — one driver instance per process', async () => {
    const h = makeHarness();
    const first = startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
    });
    const second = startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
    });
    expect(second).toBe(first);
  });

  it('returns a no-op driver when disabled and never starts a timer', async () => {
    const h = makeHarness();
    const driver = startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 30_000,
      enabled: false,
    });
    await vi.advanceTimersByTimeAsync(120_000);

    expect(h.scheduler.tick).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
    expect(getSchedulerCadenceDriver()).toBeUndefined();
    expect(driver.status()).toMatchObject({
      active: false,
      reason: 'disabled',
      refreshIntelligenceEnabled: false,
    });
    expect(() => driver.stop()).not.toThrow();
  });

  it('honours AI_WORLD_CADENCE_ENABLED=0 and AI_WORLD_CADENCE_INTERVAL_MS env', async () => {
    const h = makeHarness();
    const originalEnabled = process.env.AI_WORLD_CADENCE_ENABLED;
    const originalInterval = process.env.AI_WORLD_CADENCE_INTERVAL_MS;
    try {
      process.env.AI_WORLD_CADENCE_ENABLED = '0';
      startSchedulerCadenceDriver({
        getScheduler: h.makeScheduler,
        userSource: h.users,
        log: h.log,
        refreshIntelligence: h.refreshIntelligence,
      });
      await vi.advanceTimersByTimeAsync(120_000);
      expect(h.scheduler.tick).not.toHaveBeenCalled();

      process.env.AI_WORLD_CADENCE_ENABLED = '1';
      process.env.AI_WORLD_CADENCE_INTERVAL_MS = '15000';
      startSchedulerCadenceDriver({
        getScheduler: h.makeScheduler,
        userSource: h.users,
        log: h.log,
        refreshIntelligence: h.refreshIntelligence,
        runImmediately: false,
      });
      await vi.advanceTimersByTimeAsync(15_000);
      expect(h.scheduler.tick).toHaveBeenCalledTimes(2);
    } finally {
      if (originalEnabled === undefined) delete process.env.AI_WORLD_CADENCE_ENABLED;
      else process.env.AI_WORLD_CADENCE_ENABLED = originalEnabled;
      if (originalInterval === undefined) delete process.env.AI_WORLD_CADENCE_INTERVAL_MS;
      else process.env.AI_WORLD_CADENCE_INTERVAL_MS = originalInterval;
    }
  });

  it('D2 — AI_WORLD_CADENCE_ENABLED=false (and other false-y spellings) disables the cadence', async () => {
    const original = process.env.AI_WORLD_CADENCE_ENABLED;
    try {
      for (const value of ['false', 'FALSE', 'no', 'off', '0']) {
        stopSchedulerCadenceDriver();
        const h = makeHarness();
        process.env.AI_WORLD_CADENCE_ENABLED = value;
        const driver = startSchedulerCadenceDriver({
          getScheduler: h.makeScheduler,
          userSource: h.users,
          log: h.log,
          refreshIntelligence: h.refreshIntelligence,
        });
        await vi.advanceTimersByTimeAsync(120_000);
        expect(h.scheduler.tick).not.toHaveBeenCalled();
        expect(h.refresh).not.toHaveBeenCalled();
        expect(getSchedulerCadenceDriver()).toBeUndefined();
        expect(driver.status()).toMatchObject({ active: false, reason: 'disabled' });
      }
    } finally {
      if (original === undefined) delete process.env.AI_WORLD_CADENCE_ENABLED;
      else process.env.AI_WORLD_CADENCE_ENABLED = original;
    }
  });

  it('EPIC-021 — default bridge maps uncertainty to relevance and counts only emitted notifications', async () => {
    const notified: Array<{ title: string; relevance: number }> = [];
    const deps: BrainIntelligenceRefreshDeps = {
      brain: {
        discoverIntelligence: vi.fn().mockResolvedValue({
          success: true,
          data: {
            opportunities: [
              { id: 'o1', title: 'Confident opportunity', description: 'a', uncertainty: 0.2 },
              { id: 'o2', title: 'Speculative opportunity', description: 'b', uncertainty: 0.9 },
              { id: 'o3', title: 'Mid opportunity', description: 'c', uncertainty: 0.4 },
            ],
          },
        }),
      },
      ecosystemIntelligence: {
        notify: (_userId, opts) => {
          // Mirror the EPIC-015 gate: only relevance >= 60 surfaces.
          if (opts.relevance < 60) return { dropped: true as const, reason: 'below threshold' };
          notified.push({ title: opts.title, relevance: opts.relevance });
          return { id: `ntf-${notified.length}` };
        },
      },
    };
    const port = createBrainIntelligenceRefresh(deps);

    const result = await port.refresh('user-x');

    // uncertainty 0.2 → 80 · 0.4 → 60 · 0.9 → 10 (dropped). Exact counts,
    // and only the gate-passing opportunities ever surface.
    expect(result).toEqual({ newOpportunities: 3, notificationsEmitted: 2 });
    expect(notified.map((n) => n.title)).toEqual(['Confident opportunity', 'Mid opportunity']);
    expect(notified[0]?.relevance).toBe(80);
  });

  it('EPIC-021 — default bridge returns zeroes when discovery fails or is unconfigured', async () => {
    const failing: BrainIntelligenceRefreshDeps = {
      brain: {
        discoverIntelligence: vi
          .fn()
          .mockResolvedValue({ success: false, error: 'DISCOVERY_FAILED' }),
      },
      ecosystemIntelligence: { notify: vi.fn() },
    };
    expect(await createBrainIntelligenceRefresh(failing).refresh('user-x')).toEqual({
      newOpportunities: 0,
      notificationsEmitted: 0,
    });
    expect(failing.ecosystemIntelligence.notify).not.toHaveBeenCalled();
  });

  it('EPIC-021 — honours AI_WORLD_CADENCE_REFRESH_INTELLIGENCE=0 and false-y spellings', async () => {
    for (const value of ['0', 'false', 'FALSE', 'no', 'off']) {
      stopSchedulerCadenceDriver();
      const h = makeHarness();
      const original = process.env.AI_WORLD_CADENCE_REFRESH_INTELLIGENCE;
      try {
        process.env.AI_WORLD_CADENCE_REFRESH_INTELLIGENCE = value;
        startSchedulerCadenceDriver({
          getScheduler: h.makeScheduler,
          userSource: h.users,
          log: h.log,
          refreshIntelligence: h.refreshIntelligence,
          intervalMs: 60_000,
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(h.scheduler.tick).toHaveBeenCalledTimes(2); // scheduler runs
        expect(h.refresh).not.toHaveBeenCalled(); // bridge disabled
        expect(getSchedulerCadenceDriver()?.status().refreshIntelligenceEnabled).toBe(false);
      } finally {
        if (original === undefined) delete process.env.AI_WORLD_CADENCE_REFRESH_INTELLIGENCE;
        else process.env.AI_WORLD_CADENCE_REFRESH_INTELLIGENCE = original;
      }
    }
  });

  it('logs aggregate numbers only — never user ids or secret-shaped values', async () => {
    const h = makeHarness();
    h.scheduler.tick.mockImplementation(async (userId: string) => {
      if (userId === 'user-a') throw new Error('boom for user-a');
      return { ran: [run()], skipped: [] };
    });
    startSchedulerCadenceDriver({
      getScheduler: h.makeScheduler,
      userSource: h.users,
      log: h.log,
      refreshIntelligence: h.refreshIntelligence,
      intervalMs: 60_000,
    });
    await vi.advanceTimersByTimeAsync(0);

    const allLines = [...h.log.infos, ...h.log.warns].map(
      (e) => `${e.message} ${JSON.stringify(e.fields ?? {})}`,
    );
    expect(allLines.length).toBeGreaterThan(0);
    for (const line of allLines) {
      // No user ids, no raw error text, no key-shaped values — aggregates only.
      expect(line).not.toMatch(/user-[ab]/);
      expect(line).not.toMatch(/boom for/);
      expect(line).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
      expect(line).not.toMatch(/AI[A-Z0-9_]{8,}/);
    }
    // The error count is exact while the sample is bounded to 5.
    expect(getSchedulerCadenceDriver()?.lastTick?.errors).toBe(1);
    expect(getSchedulerCadenceDriver()?.lastTick?.errorSample).toEqual(['boom for user-a']);
    expect(getSchedulerCadenceDriver()?.lastTick?.errorSample.length).toBeLessThanOrEqual(5);
  });
});
