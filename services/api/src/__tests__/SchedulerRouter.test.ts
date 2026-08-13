// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler Router tests (EPIC-018)
// The aiWorldScheduler.* procedures through the REAL tRPC pipeline
// (createAppRouter + auth + rate-limit middleware). Deterministic fake
// ports; the scheduler domain is already covered by the package suite —
// this suite proves the gateway wiring (namespace, schemas, owner scoping,
// IDOR refusal).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import type { DiscoveryItem } from '@vedmoulya/ai-world';
import {
  SchedulerApplicationService,
  DiscoveryScheduler,
  InMemoryScheduleStore,
  InMemoryJobStore,
  InMemoryRunStore,
  InMemorySourcePolicyStore,
  InMemoryCooldownStore,
} from '@vedmoulya/ai-world-scheduler';
import type {
  SchedulerBrainPort,
  SchedulerClockPort,
  SchedulerDiscoveryPort,
  SchedulerNotifyPort,
} from '@vedmoulya/ai-world-scheduler';
import { SystemClock } from '@vedmoulya/loop-engine';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

// ── Deterministic fixtures ───────────────────────────────────────────────────

function makeItem(id: string, overrides: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    id,
    title: `Item ${id}`,
    category: 'model',
    source: 'catalog',
    discoveredAt: '2026-08-11T00:00:00.000Z',
    summary: `Summary ${id}`,
    capabilities: ['reasoning'],
    freeClass: 'FREE_WITH_QUOTA',
    localAvailability: 'no',
    relevance: 60,
    relevanceLabel: 'medium',
    relevanceReasons: [],
    confidence: 'VERIFIED',
    evidence: [
      {
        claim: 'test',
        source: 'catalog',
        confidence: 'VERIFIED',
        retrievedAt: '2026-08-11T00:00:00.000Z',
      },
    ],
    recommendation: 'REVIEW',
    recommendationReasons: [],
    securityFlags: [],
    raw: true,
    ...overrides,
  };
}

function makeSchedulerService(): SchedulerApplicationService {
  const clock: SchedulerClockPort = new SystemClock();
  const store = new Map<string, DiscoveryItem>();
  const discovery: SchedulerDiscoveryPort = {
    async discover() {
      return {
        items: [],
        reports: [
          {
            source: 'catalog',
            attempted: true,
            failed: false,
            rawReceived: 0,
            added: 0,
            duplicatesSkipped: 0,
            securityRejected: 0,
            durationMs: 1,
          },
        ],
        budget: {
          maxItemsPerSource: 25,
          maxItemsPerRun: 60,
          maxSourcesPerRun: 8,
          maxStoredItems: 300,
          minRefreshIntervalMs: 6 * 60 * 60 * 1000,
        },
      };
    },
    listSourceIds: () => ['catalog'],
    listStoredItems: async () => [...store.values()],
  };
  const brain: SchedulerBrainPort = {
    evaluateRelevance: () => ({ relevant: true, score: 0.8, reason: 'fixture' }),
  };
  const notify: SchedulerNotifyPort = {
    async notify() {
      return { emitted: true };
    },
  };
  const schedules = new InMemoryScheduleStore();
  const jobs = new InMemoryJobStore();
  const runs = new InMemoryRunStore();
  const scheduler = new DiscoveryScheduler({
    clock,
    discovery,
    brain,
    notify,
    schedules,
    jobs,
    runs,
    sourcePolicies: new InMemorySourcePolicyStore(),
    cooldowns: new InMemoryCooldownStore(),
  });
  return new SchedulerApplicationService({ scheduler, schedules, jobs, runs, clock });
}

const services = {
  aiWorldScheduler: makeSchedulerService(),
  // Mirrors the real ApiApplicationService: the runtime-status accessor is
  // ALWAYS present and reports the honest inactive state before the cadence
  // driver binds (the UI never claims automatic discovery when it is off).
  schedulerRuntimeStatus: () => ({
    active: false,
    reason: 'not_started' as const,
    maxUsersPerTick: 0,
    refreshIntelligenceEnabled: false,
  }),
} as unknown as ApiApplicationService;

const router = createAppRouter(services);
const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

// ── Tests ────────────────────────────────────────────────────────────────────

describe('aiWorldScheduler namespace (EPIC-018)', () => {
  it('getStatus returns the Discovery Activity view with 7 job schedules', async () => {
    const caller = router.createCaller(ctx('s1'));
    const result = await caller.aiWorldScheduler.getStatus({ userId: 's1' });
    expect(result.success).toBe(true);
    const data = result.data as {
      jobs: Array<{ jobCategory: string; enabled: boolean; status: string; frequency: string }>;
      nextDiscoveryAt?: string;
    };
    expect(data.jobs).toHaveLength(7);
    expect(data.jobs.every((j) => j.enabled)).toBe(true);
    expect(data.jobs.map((j) => j.jobCategory)).toEqual([
      'CRITICAL_PROVIDER_CHANGE',
      'PROVIDER_MODEL_DISCOVERY',
      'GITHUB_DISCOVERY',
      'FREE_AI_RESOURCE_DISCOVERY',
      'LOCAL_MODEL_DISCOVERY',
      'AI_NEWS_DISCOVERY',
      'ECOSYSTEM_DEEP_SCAN',
    ]);
    expect(data.nextDiscoveryAt).toBeDefined();
  });

  it('listSchedules seeds the 7 default schedules owner-scoped', async () => {
    const caller = router.createCaller(ctx('s2'));
    const result = await caller.aiWorldScheduler.listSchedules({ userId: 's2' });
    expect(result.success).toBe(true);
    const data = result.data as Array<{ jobCategory: string; frequency: string }>;
    expect(data).toHaveLength(7);
    const critical = data.find((s) => s.jobCategory === 'CRITICAL_PROVIDER_CHANGE');
    expect(critical?.frequency).toBe('EVERY_6_HOURS');
  });

  it('setSchedule persists enable/disable + frequency and the job resyncs', async () => {
    const caller = router.createCaller(ctx('s3'));
    const set = await caller.aiWorldScheduler.setSchedule({
      userId: 's3',
      jobCategory: 'GITHUB_DISCOVERY',
      enabled: false,
      frequency: 'WEEKLY',
    });
    expect(set.success).toBe(true);
    const data = set.data as { enabled: boolean; frequency: string };
    expect(data.enabled).toBe(false);
    expect(data.frequency).toBe('WEEKLY');

    const status = await caller.aiWorldScheduler.getStatus({ userId: 's3' });
    const jobs = (
      status.data as { jobs: Array<{ jobCategory: string; enabled: boolean; status: string }> }
    ).jobs;
    const github = jobs.find((j) => j.jobCategory === 'GITHUB_DISCOVERY');
    expect(github?.enabled).toBe(false);
    expect(github?.status).toBe('disabled');
  });

  it('setSchedule refuses unknown categories/frequencies at the zod boundary', async () => {
    const caller = router.createCaller(ctx('s4'));
    await expect(
      caller.aiWorldScheduler.setSchedule({
        userId: 's4',
        jobCategory: 'NOT_A_JOB' as never,
        frequency: 'DAILY',
      }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      caller.aiWorldScheduler.setSchedule({
        userId: 's4',
        jobCategory: 'AI_NEWS_DISCOVERY',
        frequency: 'HOURLY' as never,
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('runNow executes the bounded path and persists a run in the ledger', async () => {
    const caller = router.createCaller(ctx('s5'));
    const run = await caller.aiWorldScheduler.runNow({
      userId: 's5',
      jobCategory: 'AI_NEWS_DISCOVERY',
    });
    expect(run.success).toBe(true);
    const data = run.data as {
      runId: string;
      status: string;
      manual: boolean;
      jobCategory: string;
    };
    expect(data.status).toBe('COMPLETED');
    expect(data.manual).toBe(true);
    expect(data.jobCategory).toBe('AI_NEWS_DISCOVERY');

    const ledger = await caller.aiWorldScheduler.getLedger({ userId: 's5' });
    const ledgerData = ledger.data as { runs: Array<{ runId: string }> };
    expect(ledgerData.runs.some((r) => r.runId === data.runId)).toBe(true);

    const runs = await caller.aiWorldScheduler.listRuns({ userId: 's5' });
    expect((runs.data as unknown[]).length).toBe(1);
  });

  it('runNow refuses an invalid category at the zod boundary', async () => {
    const caller = router.createCaller(ctx('s6'));
    await expect(
      caller.aiWorldScheduler.runNow({ userId: 's6', jobCategory: 'BOGUS' as never }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('cancelRun reports NOT_RUNNING honestly when nothing is in flight', async () => {
    const caller = router.createCaller(ctx('s7'));
    const cancel = await caller.aiWorldScheduler.cancelRun({
      userId: 's7',
      jobCategory: 'AI_NEWS_DISCOVERY',
    });
    expect(cancel.success).toBe(false);
    expect((cancel.error as { message?: string } | undefined)?.message).toBe('NOT_RUNNING');
  });

  it('listSourcePolicies is available behind auth (platform-wide state)', async () => {
    const caller = router.createCaller(ctx('s8'));
    const result = await caller.aiWorldScheduler.listSourcePolicies({ userId: 's8' });
    expect(result.success).toBe(true);
  });

  it('IDOR: a caller can never read another user by passing a foreign userId', async () => {
    const caller = router.createCaller(ctx('owner'));
    // Seed a run for 'owner'.
    await caller.aiWorldScheduler.runNow({ userId: 'owner', jobCategory: 'AI_NEWS_DISCOVERY' });
    await caller.aiWorldScheduler.getLedger({ userId: 'owner' });

    // A foreign userId on the same session is refused by the auth middleware.
    await expect(caller.aiWorldScheduler.getStatus({ userId: 'intruder' })).rejects.toBeInstanceOf(
      TRPCError,
    );
    await expect(
      caller.aiWorldScheduler.runNow({ userId: 'intruder', jobCategory: 'AI_NEWS_DISCOVERY' }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      caller.aiWorldScheduler.setSchedule({
        userId: 'intruder',
        jobCategory: 'GITHUB_DISCOVERY',
        enabled: false,
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('getRuntimeStatus reports the honest inactive state when no driver is bound', async () => {
    const caller = router.createCaller(ctx('s9'));
    const result = await caller.aiWorldScheduler.getRuntimeStatus({ userId: 's9' });
    expect(result.success).toBe(true);
    const data = result.data as { active: boolean; reason: string };
    expect(data.active).toBe(false);
    expect(data.reason).toBe('not_started');
  });

  it('getRuntimeStatus reflects the bound cadence driver status', async () => {
    const boundServices = {
      ...services,
      schedulerRuntimeStatus: () => ({
        active: true,
        reason: 'enabled' as const,
        intervalMs: 600_000,
        maxUsersPerTick: 200,
        refreshIntelligenceEnabled: true,
        startedAt: 1_700_000_000_000,
      }),
    } as unknown as ApiApplicationService;
    const boundRouter = createAppRouter(boundServices);
    const caller = boundRouter.createCaller(ctx('s10'));
    const result = await caller.aiWorldScheduler.getRuntimeStatus({ userId: 's10' });
    expect(result.success).toBe(true);
    const data = result.data as { active: boolean; reason: string; intervalMs: number };
    expect(data.active).toBe(true);
    expect(data.reason).toBe('enabled');
    expect(data.intervalMs).toBe(600_000);
  });

  it('owner isolation: schedules and runs are scoped per user', async () => {
    const a = router.createCaller(ctx('user-a'));
    const b = router.createCaller(ctx('user-b'));

    await a.aiWorldScheduler.setSchedule({
      userId: 'user-a',
      jobCategory: 'AI_NEWS_DISCOVERY',
      frequency: 'WEEKLY',
    });
    await a.aiWorldScheduler.runNow({ userId: 'user-a', jobCategory: 'AI_NEWS_DISCOVERY' });

    const bSchedules = await b.aiWorldScheduler.listSchedules({ userId: 'user-b' });
    const bNews = (bSchedules.data as Array<{ jobCategory: string; frequency: string }>).find(
      (s) => s.jobCategory === 'AI_NEWS_DISCOVERY',
    );
    expect(bNews?.frequency).toBe('DAILY'); // user-b untouched

    const bRuns = await b.aiWorldScheduler.listRuns({ userId: 'user-b' });
    expect(bRuns.data as unknown[]).toHaveLength(0);
  });
});
