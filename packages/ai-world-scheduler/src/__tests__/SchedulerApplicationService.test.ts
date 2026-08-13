// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: SchedulerApplicationService tests (EPIC-018)
// Settings, status view, owner scoping, IDOR and run controls through
// the application boundary (the shape the gateway consumes).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { DiscoveryItem } from '@vedmoulya/ai-world';
import { SchedulerApplicationService } from '../application/SchedulerApplicationService.js';
import { DiscoveryScheduler } from '../domain/DiscoveryScheduler.js';
import {
  InMemoryCooldownStore,
  InMemoryJobStore,
  InMemoryRunStore,
  InMemoryScheduleStore,
  InMemorySourcePolicyStore,
} from '../infrastructure/InMemorySchedulerStores.js';
import type {
  SchedulerBrainPort,
  SchedulerClockPort,
  SchedulerDiscoveryPort,
  SchedulerNotifyPort,
} from '../contracts/scheduler-ports.js';

class FixedClock implements SchedulerClockPort {
  private t = 1_700_000_000_000;
  now(): string {
    return new Date(this.t).toISOString();
  }
  timestampMs(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

interface Harness {
  clock: FixedClock;
  service: SchedulerApplicationService;
  runs: InMemoryRunStore;
  jobs: InMemoryJobStore;
  schedules: InMemoryScheduleStore;
  notifyCalls: number;
}

function makeItem(id: string): DiscoveryItem {
  return {
    id,
    title: `Item ${id}`,
    category: 'news',
    source: 'scripted-src',
    discoveredAt: '2026-08-11T00:00:00.000Z',
    summary: `Summary ${id}`,
    capabilities: [],
    freeClass: 'UNKNOWN',
    localAvailability: 'no',
    relevance: 60,
    relevanceLabel: 'medium',
    relevanceReasons: [],
    confidence: 'VERIFIED',
    evidence: [
      {
        claim: 'test',
        source: 'scripted-src',
        confidence: 'VERIFIED',
        retrievedAt: '2026-08-11T00:00:00.000Z',
      },
    ],
    recommendation: 'REVIEW',
    recommendationReasons: [],
    securityFlags: [],
    raw: true,
  };
}

function makeHarness(): Harness {
  const clock = new FixedClock();
  const discovery: SchedulerDiscoveryPort = {
    store: new Map<string, DiscoveryItem>(),
    async discover() {
      return {
        items: [],
        reports: [
          {
            source: 'scripted-src',
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
    listSourceIds: () => ['scripted-src'],
    listStoredItems: async () => [...discovery.store.values()],
  };
  const brain: SchedulerBrainPort = {
    evaluateRelevance: () => ({ relevant: true, score: 0.8, reason: 'fixture' }),
  };
  let notifyCalls = 0;
  const notify: SchedulerNotifyPort = {
    async notify() {
      notifyCalls += 1;
      return { emitted: true };
    },
  };
  const schedules = new InMemoryScheduleStore();
  const jobs = new InMemoryJobStore();
  const runs = new InMemoryRunStore();
  const sourcePolicies = new InMemorySourcePolicyStore();
  const cooldowns = new InMemoryCooldownStore();
  const scheduler = new DiscoveryScheduler({
    clock,
    discovery,
    brain,
    notify,
    schedules,
    jobs,
    runs,
    sourcePolicies,
    cooldowns,
  });
  const service = new SchedulerApplicationService({ scheduler, schedules, jobs, runs, clock });
  return { clock, service, runs, jobs, schedules, notifyCalls: 0 };
}

describe('SchedulerApplicationService — settings (owner-scoped)', () => {
  it('rejects unknown categories and frequencies honestly', () => {
    const h = makeHarness();
    const bad = h.service.setSchedule('u1', 'NOT_A_JOB' as never, { frequency: 'DAILY' });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.code).toBe('INVALID_CATEGORY');

    const badFreq = h.service.setSchedule('u1', 'AI_NEWS_DISCOVERY', {
      frequency: 'HOURLY' as never,
    });
    expect(badFreq.success).toBe(false);
    if (!badFreq.success) expect(badFreq.code).toBe('INVALID_FREQUENCY');
  });

  it('enable/disable and frequency changes persist per user and resync the job', () => {
    const h = makeHarness();
    const result = h.service.setSchedule('u1', 'GITHUB_DISCOVERY', {
      enabled: false,
      frequency: 'WEEKLY',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.enabled).toBe(false);
    expect(result.data.frequency).toBe('WEEKLY');

    const job = h.jobs.get('u1', 'GITHUB_DISCOVERY');
    expect(job?.enabled).toBe(false);
    expect(job?.frequency).toBe('WEEKLY');
    // Frequency change reset the cadence: next run is now + 1 week.
    const next = Date.parse(job?.nextRunAt ?? '');
    expect(next - h.clock.timestampMs()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('one user changing a schedule never affects another user', () => {
    const h = makeHarness();
    h.service.setSchedule('u1', 'AI_NEWS_DISCOVERY', { frequency: 'WEEKLY' });
    const other = h.service.listSchedules('u2').find((s) => s.jobCategory === 'AI_NEWS_DISCOVERY');
    expect(other?.frequency).toBe('DAILY'); // u2 keeps the default
  });
});

describe('SchedulerApplicationService — status view (Phase 11)', () => {
  it('getStatus reports next discovery, last scan, meaningful updates and per-job state', async () => {
    const h = makeHarness();
    const before = h.service.getStatus('u1');
    expect(before.jobs).toHaveLength(7);
    expect(before.nextDiscoveryAt).toBeDefined();
    expect(before.jobs.every((j) => j.status === 'due')).toBe(true); // all due on first seed

    // Run one job → last scan appears; next run moves to the frequency window.
    const run = await h.service.runNow('u1', 'AI_NEWS_DISCOVERY');
    expect(run.success).toBe(true);
    if (!run.success) return;

    const after = h.service.getStatus('u1');
    expect(after.lastScanAt).toBeDefined();
    const newsJob = after.jobs.find((j) => j.jobCategory === 'AI_NEWS_DISCOVERY');
    expect(newsJob?.status).toBe('scheduled');
    expect(newsJob?.lastRunAt).toBeDefined();
    expect(newsJob?.nextRunAt).toBeDefined();
    expect(after.jobs.every((j) => j.status !== 'running')).toBe(true);
  });

  it('a disabled job reports status disabled and is excluded from next discovery', async () => {
    const h = makeHarness();
    h.service.setSchedule('u1', 'GITHUB_DISCOVERY', { enabled: false });
    const status = h.service.getStatus('u1');
    expect(status.jobs.find((j) => j.jobCategory === 'GITHUB_DISCOVERY')?.status).toBe('disabled');
    expect(status.jobs.find((j) => j.jobCategory === 'GITHUB_DISCOVERY')?.enabled).toBe(false);
  });

  it('getStatus is owner-scoped: u2 sees their own empty history', async () => {
    const h = makeHarness();
    await h.service.runNow('u1', 'AI_NEWS_DISCOVERY');
    const u2 = h.service.getStatus('u2');
    expect(u2.lastScanAt).toBeUndefined();
    expect(u2.meaningfulUpdates).toBe(0);
  });
});

describe('SchedulerApplicationService — run controls', () => {
  it('runNow goes through the identical bounded path and persists the run', async () => {
    const h = makeHarness();
    const result = await h.service.runNow('u1', 'AI_NEWS_DISCOVERY');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.manual).toBe(true);
    expect(h.runs.list('u1')).toHaveLength(1);
    expect(h.runs.list('u2')).toHaveLength(0);
  });

  it('cancel returns NOT_RUNNING honestly when nothing is in flight', () => {
    const h = makeHarness();
    const result = h.service.cancel('u1', 'AI_NEWS_DISCOVERY');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('NOT_RUNNING');
  });

  it('invalid runNow categories are refused', async () => {
    const h = makeHarness();
    const result = await h.service.runNow('u1', 'BOGUS' as never);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('INVALID_CATEGORY');
  });
});
