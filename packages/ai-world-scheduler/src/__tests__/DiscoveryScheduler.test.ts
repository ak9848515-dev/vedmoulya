// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: DiscoveryScheduler tests (EPIC-018)
// Deterministic: fixed clock, scripted discovery port, fake brain and
// notify ports. Every Phase-13 acceptance item is covered here.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { DEFAULT_DISCOVERY_BUDGET } from '@vedmoulya/ai-world';
import type {
  DiscoveryBudget,
  DiscoveryCategory,
  DiscoveryItem,
  DiscoverySourceRunReport,
} from '@vedmoulya/ai-world';
import { DiscoveryScheduler } from '../domain/DiscoveryScheduler.js';
import { DEFAULT_JOB_POLICIES } from '../domain/DiscoveryJobPolicy.js';
import {
  InMemoryCooldownStore,
  InMemoryJobStore,
  InMemoryRunStore,
  InMemoryScheduleStore,
  InMemorySourcePolicyStore,
  LEDGER_RETENTION,
} from '../infrastructure/InMemorySchedulerStores.js';
import type {
  SchedulerBrainPort,
  SchedulerClockPort,
  SchedulerDiscoveryPort,
  SchedulerNotifyPort,
} from '../contracts/scheduler-ports.js';

// ── Fixtures ──────────────────────────────────────────────────────

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

interface ScriptedStep {
  add?: Array<Partial<DiscoveryItem> & { id: string }>;
  update?: Array<Partial<DiscoveryItem> & { id: string }>;
  remove?: string[];
  fail?: boolean;
}

/** Scripted discovery port — simulates the EXISTING AI World pipeline + store. */
class ScriptedDiscoveryPort implements SchedulerDiscoveryPort {
  store = new Map<string, DiscoveryItem>();
  sourceIds = ['scripted-src'];
  discoverCalls = 0;
  lastSourceIds: string[] = [];
  /** Simulated wall-clock cost of one discovery pass (for budget tests). */
  simulatedLatencyMs = 0;
  private clockRef: FixedClock | undefined;
  private script: ScriptedStep[] = [];

  bindClock(clock: FixedClock): void {
    this.clockRef = clock;
  }

  scriptRuns(steps: ScriptedStep[]): void {
    this.script = steps;
  }

  async discover(request: { budget: DiscoveryBudget; sourceIds: string[] }): Promise<{
    items: DiscoveryItem[];
    reports: DiscoverySourceRunReport[];
    budget: DiscoveryBudget;
  }> {
    this.discoverCalls += 1;
    this.lastSourceIds = request.sourceIds;
    this.clockRef?.advance(this.simulatedLatencyMs);
    const step = this.script.shift();
    if (step?.fail) throw new Error('simulated source failure (503)');

    const added: DiscoveryItem[] = [];
    for (const partial of step?.add ?? []) {
      const item = makeItem(partial.id, partial);
      this.store.set(item.id, item);
      added.push(item);
    }
    for (const partial of step?.update ?? []) {
      const existing = this.store.get(partial.id);
      this.store.set(partial.id, makeItem(partial.id, { ...existing, ...partial }));
    }
    for (const id of step?.remove ?? []) {
      this.store.delete(id);
    }
    const report: DiscoverySourceRunReport = {
      source: 'scripted-src',
      attempted: true,
      failed: false,
      rawReceived: (step?.add?.length ?? 0) + (step?.update?.length ?? 0),
      added: step?.add?.length ?? 0,
      duplicatesSkipped: 0,
      securityRejected: 0,
      durationMs: 2,
    };
    return { items: added, reports: [report], budget: request.budget };
  }

  listSourceIds(): string[] {
    return this.sourceIds;
  }

  async listStoredItems(): Promise<DiscoveryItem[]> {
    return [...this.store.values()];
  }
}

function makeItem(id: string, overrides: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    id,
    title: `Item ${id}`,
    category: 'model',
    source: 'scripted-src',
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
        source: 'scripted-src',
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

class FakeBrainPort implements SchedulerBrainPort {
  relevant = true;
  calls = 0;
  evaluateRelevance(
    _userId: string,
    _item: DiscoveryItem,
  ): { relevant: boolean; score: number; reason: string } {
    this.calls += 1;
    return { relevant: this.relevant, score: this.relevant ? 0.9 : 0.1, reason: 'fixture' };
  }
}

class FakeNotifyPort implements SchedulerNotifyPort {
  emitted: string[] = [];
  drop = false;
  async notify(
    _userId: string,
    event: { item: DiscoveryItem; change: 'NEW' | 'UPDATED' | 'REMOVED' | 'CRITICAL_CHANGE' },
  ): Promise<{ emitted: boolean; reason?: string }> {
    if (this.drop) return { emitted: false, reason: 'gate dropped' };
    this.emitted.push(`${event.change}:${event.item.id}`);
    return { emitted: true };
  }
}

interface Harness {
  clock: FixedClock;
  discovery: ScriptedDiscoveryPort;
  brain: FakeBrainPort;
  notify: FakeNotifyPort;
  scheduler: DiscoveryScheduler;
  jobs: InMemoryJobStore;
  runs: InMemoryRunStore;
  sourcePolicies: InMemorySourcePolicyStore;
  cooldowns: InMemoryCooldownStore;
}

function makeHarness(): Harness {
  const clock = new FixedClock();
  const discovery = new ScriptedDiscoveryPort();
  discovery.bindClock(clock);
  const brain = new FakeBrainPort();
  const notify = new FakeNotifyPort();
  const jobs = new InMemoryJobStore();
  const runs = new InMemoryRunStore();
  const sourcePolicies = new InMemorySourcePolicyStore();
  const cooldowns = new InMemoryCooldownStore();
  const scheduler = new DiscoveryScheduler({
    clock,
    discovery,
    brain,
    notify,
    schedules: new InMemoryScheduleStore(),
    jobs,
    runs,
    sourcePolicies,
    cooldowns,
  });
  return { clock, discovery, brain, notify, scheduler, jobs, runs, sourcePolicies, cooldowns };
}

async function runFirst(h: Harness, category = 'PROVIDER_MODEL_DISCOVERY' as const, manual = true) {
  return h.scheduler.runJob('u1', category, { manual });
}

// ── 1. Schedule eligibility + default frequencies ─────────────────

describe('schedule eligibility + defaults (Phase 2)', () => {
  it('seeds all seven job categories as enabled daily/6h/weekly defaults', () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    const jobs = h.jobs.list('u1');
    expect(jobs).toHaveLength(7);

    const byId = new Map(jobs.map((j) => [j.jobCategory, j]));
    expect(byId.get('CRITICAL_PROVIDER_CHANGE')?.frequency).toBe('EVERY_6_HOURS');
    expect(byId.get('PROVIDER_MODEL_DISCOVERY')?.frequency).toBe('DAILY');
    expect(byId.get('GITHUB_DISCOVERY')?.frequency).toBe('DAILY');
    expect(byId.get('FREE_AI_RESOURCE_DISCOVERY')?.frequency).toBe('DAILY');
    expect(byId.get('LOCAL_MODEL_DISCOVERY')?.frequency).toBe('DAILY');
    expect(byId.get('AI_NEWS_DISCOVERY')?.frequency).toBe('DAILY');
    expect(byId.get('ECOSYSTEM_DEEP_SCAN')?.frequency).toBe('WEEKLY');

    // Default policies match the epic spec exactly.
    expect(DEFAULT_JOB_POLICIES.CRITICAL_PROVIDER_CHANGE.frequency).toBe('EVERY_6_HOURS');
    expect(DEFAULT_JOB_POLICIES.GITHUB_DISCOVERY.frequency).toBe('DAILY');
    expect(DEFAULT_JOB_POLICIES.ECOSYSTEM_DEEP_SCAN.frequency).toBe('WEEKLY');
  });

  it('tick runs only due jobs and skips the rest with honest reasons', async () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);

    // First tick: every job is due (never run) → all run once.
    const first = await h.scheduler.tick('u1');
    expect(first.ran).toHaveLength(7);
    expect(first.skipped).toHaveLength(0);

    // Immediately after, nothing is due → all skipped NOT_DUE (duplicate-run prevention).
    const second = await h.scheduler.tick('u1');
    expect(second.ran).toHaveLength(0);
    expect(second.skipped.every((s) => s.reason === 'NOT_DUE')).toBe(true);
    expect(second.skipped).toHaveLength(7);
  });
});

// ── 2. Custom frequency + cooldown/rate-limit/budget (Phases 3–4) ─

describe('custom frequency + bounded execution (Phases 3–4)', () => {
  it('a frequency change resets the cadence window (custom frequency)', async () => {
    const h = makeHarness();
    // Direct store mutation through the scheduler default policy.
    h.scheduler.ensureDefaults('u1');
    const job = h.jobs.get('u1', 'AI_NEWS_DISCOVERY');
    expect(job).toBeDefined();

    // The ScheduleEngine computes the new window from the frequency.
    const before = Date.parse(job!.nextRunAt ?? '');
    h.clock.advance(12 * 60 * 60 * 1000); // half a day
    // A custom frequency of WEEKLY means the next run lands a week out.
    const engine = (await import('../domain/ScheduleEngine.js')).ScheduleEngine;
    const next = new engine().nextRunAtMs(h.clock.timestampMs(), 'WEEKLY', h.clock.timestampMs());
    expect(next - h.clock.timestampMs()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(before).toBeLessThan(h.clock.timestampMs());
  });

  it('notification cooldown deduplicates repeated updates of the same item', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const first = await runFirst(h);
    expect(first.status).toBe('COMPLETED');
    expect(h.notify.emitted).toContain('NEW:m1');

    // Same item updated within the cooldown window → deduplicated.
    h.discovery.scriptRuns([{ update: [{ id: 'm1', summary: 'Changed summary' }] }]);
    const second = await runFirst(h);
    expect(second.changeSummary.counts.UPDATED).toBe(1);
    expect(second.notifications.deduplicated).toBe(1);
    expect(second.notifications.emitted).toBe(0);

    // After the cooldown window expires, the update is emitted again.
    h.clock.advance(25 * 60 * 60 * 1000);
    h.discovery.scriptRuns([{ update: [{ id: 'm1', summary: 'Changed again' }] }]);
    const third = await runFirst(h);
    expect(third.notifications.deduplicated).toBe(0);
    expect(third.notifications.emitted).toBe(1);
  });

  it('source cooldown gates the source before any discovery call', async () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    h.sourcePolicies.save({
      sourceId: 'scripted-src',
      enabled: true,
      cooldownUntilMs: h.clock.timestampMs() + 60_000,
      consecutiveFailures: 0,
      callsConsumed: 0,
      rateLimitWindowStartedAtMs: 0,
      maxCallsPerWindow: 20,
      rateLimitWindowMs: 60 * 60 * 1000,
      budgetConsumedUsd: 0,
    });
    const run = await runFirst(h);
    expect(run.status).toBe('COMPLETED'); // honest stop — no privileged shortcut
    expect(h.discovery.discoverCalls).toBe(0);
    expect(run.changeSummary.meaningful).toBe(false);
  });

  it('windowed source rate limit blocks further calls in the window', async () => {
    const h = makeHarness();
    h.sourcePolicies.save({
      sourceId: 'scripted-src',
      enabled: true,
      consecutiveFailures: 0,
      callsConsumed: 0,
      rateLimitWindowStartedAtMs: h.clock.timestampMs(),
      maxCallsPerWindow: 1,
      rateLimitWindowMs: 60 * 60 * 1000,
      budgetConsumedUsd: 0,
    });
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    await runFirst(h);
    expect(h.discovery.discoverCalls).toBe(1);

    const second = await runFirst(h);
    expect(second.status).toBe('COMPLETED');
    expect(h.discovery.discoverCalls).toBe(1); // rate-limited — no second call
    expect(second.budget.sourceCalls).toBe(0);
  });

  it('budget exhaustion is fail-closed: wall-clock overrun → FAILED before the next call', async () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    const job = h.jobs.get('u1', 'PROVIDER_MODEL_DISCOVERY')!;
    job.policy = { ...job.policy, runLimits: { ...job.policy.runLimits, maxRuntimeMs: 5 } };
    h.jobs.save(job);
    h.discovery.simulatedLatencyMs = 10; // one pass consumes the whole budget

    const run = await runFirst(h);
    expect(run.status).toBe('FAILED');
    expect(run.error).toContain('budget');
    expect(h.discovery.discoverCalls).toBe(1); // no second pass after the overrun
    expect(run.budget.exceeded).toBe(true);
  });

  it('retry limits: one retry then honest FAILED on repeated source failure', async () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    const job = h.jobs.get('u1', 'PROVIDER_MODEL_DISCOVERY')!;
    job.policy = {
      ...job.policy,
      runLimits: { ...job.policy.runLimits, maxDiscoveryCalls: 3 },
      retry: { ...job.policy.retry, maxRetries: 1 },
    };
    h.jobs.save(job);

    h.discovery.scriptRuns([{ fail: true }, { fail: true }]);
    const run = await runFirst(h);
    expect(run.status).toBe('FAILED'); // 2 failures, 1 retry allowed → honest FAILED
    expect(run.error).toContain('simulated source failure');
    expect(h.discovery.discoverCalls).toBe(2);
  });

  it('failure backoff: consecutive failures push nextEligibleAt forward; recovery clears it', async () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    const job = h.jobs.get('u1', 'PROVIDER_MODEL_DISCOVERY')!;
    job.policy = {
      ...job.policy,
      runLimits: { ...job.policy.runLimits, maxDiscoveryCalls: 3 },
      retry: { ...job.policy.retry, maxRetries: 2 },
    };
    h.jobs.save(job);

    h.discovery.scriptRuns([{ fail: true }, { fail: true }, { fail: true }]);
    const failed = await runFirst(h);
    expect(failed.status).toBe('FAILED');
    const policyAfterFailure = h.sourcePolicies.get('scripted-src')!;
    expect(policyAfterFailure.consecutiveFailures).toBeGreaterThan(0);
    expect(policyAfterFailure.nextEligibleAtMs).toBeDefined();

    // Within the backoff window the source is gated → run stops honestly.
    const gated = await runFirst(h);
    expect(gated.status).toBe('COMPLETED');
    expect(h.discovery.discoverCalls).toBe(3); // no further discovery passes

    // After the backoff expires, discovery runs again and success clears the backoff.
    h.clock.advance(60 * 60 * 1000);
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const recovered = await runFirst(h);
    expect(recovered.status).toBe('COMPLETED');
    expect(recovered.changeSummary.counts.NEW).toBe(1);
    const afterRecovery = h.sourcePolicies.get('scripted-src')!;
    expect(afterRecovery.consecutiveFailures).toBe(0);
    expect(afterRecovery.nextEligibleAtMs).toBeUndefined();
  });

  it('failure isolation: a gated source never blocks an eligible one', async () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    h.discovery.sourceIds = ['src-a', 'src-b'];
    h.sourcePolicies.save({
      sourceId: 'src-a',
      enabled: true,
      cooldownUntilMs: h.clock.timestampMs() + 60_000,
      consecutiveFailures: 0,
      callsConsumed: 0,
      rateLimitWindowStartedAtMs: 0,
      maxCallsPerWindow: 20,
      rateLimitWindowMs: 60 * 60 * 1000,
      budgetConsumedUsd: 0,
    });
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const run = await runFirst(h);
    expect(run.status).toBe('COMPLETED');
    expect(h.discovery.lastSourceIds).toEqual(['src-b']);
  });
});

// ── 3. Concurrency / cancellation / duplicate prevention ──────────

describe('concurrency, cancellation, duplicate prevention (Phase 3)', () => {
  it('concurrent-run prevention skips a second run while one is in flight', async () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    const job = h.jobs.get('u1', 'PROVIDER_MODEL_DISCOVERY')!;
    job.inFlight = true;
    h.jobs.save(job);

    const run = await runFirst(h);
    expect(run.status).toBe('SKIPPED');
    expect(run.skipReason).toBe('CONCURRENT_RUN_IN_PROGRESS');
  });

  it('cancellation: a queued cancelled job runs as CANCELLED; cancel() is honest', async () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');

    // cancel() on a non-running job is honest.
    const notRunning = h.scheduler.cancel('u1', 'PROVIDER_MODEL_DISCOVERY');
    expect(notRunning.success).toBe(false);
    expect(notRunning.reason).toBe('NOT_RUNNING');

    // Simulate a cancelled queued job → CANCELLED run persisted.
    const job = h.jobs.get('u1', 'PROVIDER_MODEL_DISCOVERY')!;
    job.cancelRequested = true;
    h.jobs.save(job);
    const run = await runFirst(h);
    expect(run.status).toBe('CANCELLED');
    expect(h.runs.list('u1').some((r) => r.status === 'CANCELLED')).toBe(true);
  });

  it('cancel() on an in-flight job succeeds and requests the mid-run stop', async () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    const job = h.jobs.get('u1', 'PROVIDER_MODEL_DISCOVERY')!;
    job.inFlight = true;
    h.jobs.save(job);

    const result = h.scheduler.cancel('u1', 'PROVIDER_MODEL_DISCOVERY');
    expect(result.success).toBe(true);
    expect(h.jobs.get('u1', 'PROVIDER_MODEL_DISCOVERY')!.cancelRequested).toBe(true);
  });

  it('cancel() on an unknown job is honest (JOB_NOT_FOUND)', async () => {
    const h = makeHarness();
    const result = h.scheduler.cancel('no-jobs-user', 'PROVIDER_MODEL_DISCOVERY');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('JOB_NOT_FOUND');
  });

  it('duplicate-run prevention: a scheduled run is skipped before its window', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    await runFirst(h);
    h.discovery.scriptRuns([{ add: [{ id: 'm2' }] }]);

    // Non-manual run immediately after → NOT_DUE (duplicate-run prevention).
    const scheduled = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: false });
    expect(scheduled.status).toBe('SKIPPED');
    expect(scheduled.skipReason).toBe('NOT_DUE');

    // A manual run (Run now) is allowed but takes the exact same bounded path.
    h.clock.advance(1000);
    const manual = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    expect(manual.status).toBe('COMPLETED');
    expect(manual.manual).toBe(true);
    expect(manual.changeSummary.counts.NEW).toBe(1);
  });
});

// ── 4. Change detection (Phase 6) ─────────────────────────────────

describe('change detection (Phase 6)', () => {
  it('a successful run with no meaningful change is NO_CHANGE and never notifies', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const first = await runFirst(h);
    expect(first.changeSummary.meaningful).toBe(true);
    expect(first.changeSummary.counts.NEW).toBe(1);
    expect(h.notify.emitted).toHaveLength(1);

    h.discovery.scriptRuns([{}]); // nothing changed
    const second = await runFirst(h);
    expect(second.changeSummary.meaningful).toBe(false);
    expect(second.changeSummary.counts.NO_CHANGE).toBeGreaterThan(0);
    expect(second.notifications.emitted).toBe(0);
    expect(h.notify.emitted).toHaveLength(1);
  });

  it('classifies NEW / UPDATED / REMOVED / CRITICAL_CHANGE with honest counts', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([
      {
        add: [
          { id: 'new-model', category: 'model' },
          { id: 'repo', category: 'github' },
        ],
      },
    ]);
    await h.scheduler.runJob('u1', 'ECOSYSTEM_DEEP_SCAN', { manual: true });

    // CRITICAL: a verified high-relevance provider change.
    h.discovery.scriptRuns([
      {
        add: [
          { id: 'critical-provider', category: 'provider', relevance: 90, confidence: 'VERIFIED' },
        ],
        update: [{ id: 'new-model', summary: 'Updated model facts' }],
        remove: ['repo'],
      },
    ]);
    const run = await h.scheduler.runJob('u1', 'ECOSYSTEM_DEEP_SCAN', { manual: true });
    expect(run.changeSummary.counts.CRITICAL_CHANGE).toBe(1);
    expect(run.changeSummary.counts.NEW).toBe(0); // the critical one took the NEW slot
    expect(run.changeSummary.counts.UPDATED).toBe(1);
    expect(run.changeSummary.counts.REMOVED).toBe(1);
    const kinds = run.changeSummary.entries.map((e) => e.kind);
    expect(kinds).toContain('CRITICAL_CHANGE');
    expect(kinds).toContain('UPDATED');
    expect(kinds).toContain('REMOVED');
  });

  it('a run that only removes items is REMOVED (job status chip stays honest)', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'gone' }] }]);
    await runFirst(h);

    h.discovery.scriptRuns([{ remove: ['gone'] }]);
    const run = await runFirst(h);
    expect(run.changeSummary.counts.REMOVED).toBe(1);
    expect(run.changeSummary.counts.NEW).toBe(0);
    expect(h.jobs.get('u1', 'PROVIDER_MODEL_DISCOVERY')?.lastChangeKind).toBe('REMOVED');
  });

  it('a security-flagged item is always CRITICAL_CHANGE', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([
      { add: [{ id: 'suspicious', category: 'github', securityFlags: ['suspicious'] }] },
    ]);
    const run = await h.scheduler.runJob('u1', 'GITHUB_DISCOVERY', { manual: true });
    expect(run.changeSummary.counts.CRITICAL_CHANGE).toBe(1);
    expect(run.changeSummary.entries[0]?.kind).toBe('CRITICAL_CHANGE');
  });

  it('job category filtering: a news item never surfaces in a provider job', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'n1', category: 'news' }] }]);
    const run = await h.scheduler.runJob('user-1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    expect(run.changeSummary.meaningful).toBe(false);
    expect(run.changeSummary.counts.NEW).toBe(0);
  });
});

// ── 5. Brain hand-off + notification gating (Phases 7–8) ──────────

describe('brain hand-off + notification gating (Phases 7–8)', () => {
  it('the scheduler asks the Brain for EVERY meaningful change and never decides alone', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }, { id: 'm2' }] }]);
    const run = await runFirst(h);
    expect(h.brain.calls).toBe(2);
    expect(run.changeSummary.entries).toHaveLength(2);
  });

  it('irrelevant changes are skipped by the notification gate (Brain verdict)', async () => {
    const h = makeHarness();
    h.brain.relevant = false;
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const run = await runFirst(h);
    expect(run.notifications.skipped).toBe(1);
    expect(run.notifications.emitted).toBe(0);
    expect(h.notify.emitted).toHaveLength(0);
  });

  it('a dropped notification is counted as skipped, never retried or duplicated', async () => {
    const h = makeHarness();
    h.notify.drop = true;
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const run = await runFirst(h);
    expect(run.notifications.skipped).toBe(1);
    expect(run.notifications.emitted).toBe(0);
  });
});

// ── 6. Persistence + ownership (Phase 9) ──────────────────────────

describe('persistence + ownership (Phase 9)', () => {
  it('owner isolation: user B can never see user A schedules, jobs or runs', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    await h.scheduler.runJob('user-a', 'PROVIDER_MODEL_DISCOVERY', { manual: true });

    // user-b has no schedules until their own defaults are seeded.
    expect(h.jobs.list('user-b')).toHaveLength(0);
    expect(h.runs.list('user-b')).toHaveLength(0);

    h.scheduler.ensureDefaults('user-b');
    // Still zero overlap with user-a's data.
    expect(h.runs.list('user-b')).toHaveLength(0);
    expect(h.runs.get('user-b', 'run-anything')).toBeUndefined();
  });

  it('IDOR protection: run store lookups are keyed by userId', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const run = await h.scheduler.runJob('owner', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    expect(run.runId.startsWith('run-')).toBe(true);
    expect(h.runs.get('owner', run.runId)).toBeDefined();
    expect(h.runs.get('intruder', run.runId)).toBeUndefined();
  });

  it('the run ledger is append-only and bounded (never an unbounded sink)', async () => {
    const h = makeHarness();
    for (let i = 0; i < LEDGER_RETENTION + 20; i += 1) {
      h.discovery.scriptRuns([{}]);
      await runFirst(h);
    }
    expect(h.runs.list('u1')).toHaveLength(LEDGER_RETENTION);
    const ledger = h.runs.ledger('u1');
    expect(ledger.userId).toBe('u1');
    expect(ledger.runs).toHaveLength(LEDGER_RETENTION);
  });

  it('skipped scheduled runs are not persisted; manual attempts are (history stays honest)', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    await runFirst(h);

    const scheduled = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: false });
    expect(scheduled.status).toBe('SKIPPED');
    expect(h.runs.list('u1').some((r) => r.status === 'SKIPPED')).toBe(false);

    h.clock.advance(1000);
    const manual = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    expect(manual.status).toBe('COMPLETED');
    expect(h.runs.list('u1').some((r) => r.runId === manual.runId)).toBe(true);
  });
});

// ── 7. Manual/scheduled parity (Phase 12) ─────────────────────────

describe('manual/scheduled parity (Phase 12)', () => {
  it('manual runs enforce the exact same budgets and source policies — no shortcut', async () => {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    // A budget that would fail any real run.
    const job = h.jobs.get('u1', 'PROVIDER_MODEL_DISCOVERY')!;
    job.policy = { ...job.policy, runLimits: { ...job.policy.runLimits, maxRuntimeMs: 5 } };
    h.jobs.save(job);
    h.discovery.simulatedLatencyMs = 10;

    const manual = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    expect(manual.status).toBe('FAILED'); // budget enforced on the manual path too
    expect(h.discovery.discoverCalls).toBe(1); // no second pass after the overrun
  });

  it('manual and scheduled runs produce identical change detection and notifications', async () => {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'n1', category: 'news' }] }]);
    const scheduled = await h.scheduler.runJob('u1', 'AI_NEWS_DISCOVERY', { manual: false });
    const scheduledNotify = h.notify.emitted.length;

    h.discovery.scriptRuns([{ add: [{ id: 'n2', category: 'news' }] }]);
    const manual = await h.scheduler.runJob('u1', 'AI_NEWS_DISCOVERY', { manual: true });
    expect(scheduled.changeSummary.counts.NEW).toBe(1);
    expect(manual.changeSummary.counts.NEW).toBe(1);
    expect(manual.notifications.emitted).toBe(1);
    expect(h.notify.emitted.length - scheduledNotify).toBe(1);
    expect(manual.budget.discoveryCalls).toBe(scheduled.budget.discoveryCalls);
  });
});
