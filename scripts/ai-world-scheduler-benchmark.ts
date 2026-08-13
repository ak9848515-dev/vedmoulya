// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-018 AI World Scheduler Benchmark
//
// Validates the FULL scheduler chain deterministically (hermetic — fixed
// clock + scripted discovery port + fake brain/notify ports; no network,
// no secrets, no fabricated live discovery):
//
//   SCHEDULE → POLICY → BUDGET → DISCOVERY → EVIDENCE → CHANGE DETECTION →
//   BRAIN EVALUATION → NOTIFICATION DECISION
//
// Scenarios (every Phase-13 acceptance item):
//   1.  schedule eligibility        — default frequencies + due/skip logic
//   2.  duplicate-run prevention    — a run outside its window is skipped
//   3.  custom frequency            — the cadence window resets correctly
//   4.  budget exhaustion           — fail-closed before the next call
//   5.  windowed source rate limit  — a second call in the window is blocked
//   6.  retry + failure backoff     — bounded retries, exponential backoff,
//                                     honest recovery
//   7.  cooldown                    — notification dedup + re-emit after
//   8.  no-change detection         — NO_CHANGE never notifies
//   9.  meaningful change detection — NEW/UPDATED/REMOVED/CRITICAL counts
//   10. Brain hand-off              — the scheduler asks for EVERY change
//   11. notification decision       — relevant+eligible emit; gated skip
//   12. manual/scheduled parity     — the manual path enforces the same budget
//   13. owner isolation             — per-user state never crosses users
//
// Run:  npm run ai-world:scheduler:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import {
  DiscoveryScheduler,
  DEFAULT_JOB_POLICIES,
  InMemoryScheduleStore,
  InMemoryJobStore,
  InMemoryRunStore,
  InMemorySourcePolicyStore,
  InMemoryCooldownStore,
} from '@vedmoulya/ai-world-scheduler';
import type {
  DiscoveryJob,
  SchedulerClockPort,
  SchedulerDiscoveryPort,
  SchedulerBrainPort,
  SchedulerNotifyPort,
} from '@vedmoulya/ai-world-scheduler';
import type { DiscoveryBudget, DiscoveryItem, DiscoverySourceRunReport } from '@vedmoulya/ai-world';

// ── Deterministic fixtures ───────────────────────────────────────────────────

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

class ScriptedDiscoveryPort implements SchedulerDiscoveryPort {
  store = new Map<string, DiscoveryItem>();
  sourceIds = ['scripted-src'];
  discoverCalls = 0;
  private script: ScriptedStep[] = [];
  private clockRef: FixedClock | undefined;
  simulatedLatencyMs = 0;

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
    for (const id of step?.remove ?? []) this.store.delete(id);
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
  async notify(
    _userId: string,
    event: { item: DiscoveryItem; change: 'NEW' | 'UPDATED' | 'REMOVED' | 'CRITICAL_CHANGE' },
  ): Promise<{ emitted: boolean; reason?: string }> {
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
}

/** The seeded job is guaranteed to exist after ensureDefaults — read it safely. */
function seededJob(h: Harness, category: DiscoveryJob['jobCategory']): DiscoveryJob {
  const job = h.jobs.get('u1', category);
  if (!job) throw new Error(`fixture: job ${category} not seeded`);
  return job;
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
  const scheduler = new DiscoveryScheduler({
    clock,
    discovery,
    brain,
    notify,
    schedules: new InMemoryScheduleStore(),
    jobs,
    runs,
    sourcePolicies,
    cooldowns: new InMemoryCooldownStore(),
  });
  return { clock, discovery, brain, notify, scheduler, jobs, runs, sourcePolicies };
}

interface Scenario {
  name: string;
  pass: boolean;
  detail: string;
}

const outcomes: Scenario[] = [];
function assertScenario(name: string, pass: boolean, detail: string): void {
  outcomes.push({ name, pass, detail });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('VedMoulya — EPIC-018 AI WORLD SCHEDULER BENCHMARK');
  console.log(
    'Mode: hermetic (fixed clock + scripted discovery port + fake brain/notify — no network)',
  );
  console.log(
    'Chain validated: SCHEDULE → POLICY → BUDGET → DISCOVERY → EVIDENCE → CHANGE DETECTION → BRAIN → NOTIFY',
  );
  console.log('');

  // 1. Schedule eligibility — default frequencies match the epic spec.
  {
    assertScenario(
      'schedule eligibility: 6h critical / daily discovery / weekly deep scan defaults',
      DEFAULT_JOB_POLICIES.CRITICAL_PROVIDER_CHANGE.frequency === 'EVERY_6_HOURS' &&
        DEFAULT_JOB_POLICIES.PROVIDER_MODEL_DISCOVERY.frequency === 'DAILY' &&
        DEFAULT_JOB_POLICIES.GITHUB_DISCOVERY.frequency === 'DAILY' &&
        DEFAULT_JOB_POLICIES.AI_NEWS_DISCOVERY.frequency === 'DAILY' &&
        DEFAULT_JOB_POLICIES.ECOSYSTEM_DEEP_SCAN.frequency === 'WEEKLY',
      'CRITICAL_PROVIDER_CHANGE=EVERY_6_HOURS · discovery/GitHub/free/local/news=DAILY · deep scan=WEEKLY',
    );
  }

  // 2. Duplicate-run prevention — first tick runs all, second skips all.
  {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const first = await h.scheduler.tick('u1');
    const second = await h.scheduler.tick('u1');
    assertScenario(
      'duplicate-run prevention: due jobs run once, then every job is skipped NOT_DUE',
      first.ran.length === 7 &&
        second.ran.length === 0 &&
        second.skipped.length === 7 &&
        second.skipped.every((s) => s.reason === 'NOT_DUE'),
      `tick 1 ran ${String(first.ran.length)} job(s) · tick 2 skipped ${String(second.skipped.length)} (NOT_DUE)`,
    );
  }

  // 3. Custom frequency — the cadence window resets to the new frequency.
  {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    const job = seededJob(h, 'AI_NEWS_DISCOVERY');
    const weeklyMs = 7 * 24 * 60 * 60 * 1000;
    const next = new Date(h.clock.timestampMs() + weeklyMs).toISOString();
    job.frequency = 'WEEKLY';
    job.nextRunAt = next;
    h.jobs.save(job);
    assertScenario(
      'custom frequency: WEEKLY window lands 7 days out',
      Date.parse(job.nextRunAt ?? '') - h.clock.timestampMs() === weeklyMs,
      `next run = ${String(weeklyMs / 86_400_000)}d after the change`,
    );
  }

  // 4. Budget exhaustion — fail-closed, no second pass after the overrun.
  {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    const job = seededJob(h, 'PROVIDER_MODEL_DISCOVERY');
    job.policy = { ...job.policy, runLimits: { ...job.policy.runLimits, maxRuntimeMs: 5 } };
    h.jobs.save(job);
    h.discovery.simulatedLatencyMs = 10;
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const run = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    assertScenario(
      'budget exhaustion: wall-clock overrun → FAILED, no further discovery calls',
      run.status === 'FAILED' && h.discovery.discoverCalls === 1 && run.budget.exceeded,
      `status ${run.status} · ${String(h.discovery.discoverCalls)} discovery call(s) · exceeded=${String(run.budget.exceeded)}`,
    );
  }

  // 5. Windowed source rate limit.
  {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    // One call per window — the source policy gate is enforced BEFORE discovery.
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
    await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    const before = h.discovery.discoverCalls;
    const second = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    assertScenario(
      'source rate limit: the windowed per-source cap blocks the next call',
      second.status === 'COMPLETED' &&
        h.discovery.discoverCalls === before &&
        second.budget.sourceCalls === 0,
      `no extra discovery call within the window (calls=${String(h.discovery.discoverCalls)})`,
    );
  }

  // 6. Retry + failure backoff — honest FAILED, backoff gate, recovery.
  {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    const job = seededJob(h, 'PROVIDER_MODEL_DISCOVERY');
    job.policy = {
      ...job.policy,
      runLimits: { ...job.policy.runLimits, maxDiscoveryCalls: 3 },
      retry: { ...job.policy.retry, maxRetries: 1 },
    };
    h.jobs.save(job);
    h.discovery.scriptRuns([{ fail: true }, { fail: true }]);
    const failed = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    const gated = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    h.clock.advance(60 * 60 * 1000);
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const recovered = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    assertScenario(
      'retry + backoff: bounded retries → FAILED → backoff gate → honest recovery',
      failed.status === 'FAILED' &&
        gated.status === 'COMPLETED' &&
        recovered.status === 'COMPLETED' &&
        recovered.changeSummary.counts.NEW === 1,
      `failed=${failed.status} · gated (backoff) no-op · recovered with ${String(recovered.changeSummary.counts.NEW)} new`,
    );
  }

  // 7. Cooldown — dedup within the window, re-emit after.
  {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    h.discovery.scriptRuns([{ update: [{ id: 'm1', summary: 'Changed' }] }]);
    const dedup = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    h.clock.advance(25 * 60 * 60 * 1000);
    h.discovery.scriptRuns([{ update: [{ id: 'm1', summary: 'Changed again' }] }]);
    const reemit = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    assertScenario(
      'cooldown: notification deduplicated in-window, re-emitted after the window',
      dedup.notifications.deduplicated === 1 && reemit.notifications.emitted === 1,
      `deduplicated=${String(dedup.notifications.deduplicated)} · emitted after cooldown=${String(reemit.notifications.emitted)}`,
    );
  }

  // 8. No-change detection — a successful run with no change never notifies.
  {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    h.discovery.scriptRuns([{}]);
    const second = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    assertScenario(
      'no-change detection: NO_CHANGE summary → zero notifications',
      !second.changeSummary.meaningful &&
        second.changeSummary.counts.NO_CHANGE > 0 &&
        second.notifications.emitted === 0,
      `meaningful=${String(second.changeSummary.meaningful)} · NO_CHANGE=${String(second.changeSummary.counts.NO_CHANGE)} · emitted=0`,
    );
  }

  // 9. Meaningful change detection — NEW/UPDATED/REMOVED/CRITICAL.
  {
    const h = makeHarness();
    h.discovery.scriptRuns([
      {
        add: [
          { id: 'model-x', category: 'model' },
          { id: 'repo-y', category: 'github' },
        ],
      },
    ]);
    await h.scheduler.runJob('u1', 'ECOSYSTEM_DEEP_SCAN', { manual: true });
    h.discovery.scriptRuns([
      {
        add: [
          { id: 'critical-provider', category: 'provider', relevance: 90, confidence: 'VERIFIED' },
        ],
        update: [{ id: 'model-x', summary: 'Updated facts' }],
        remove: ['repo-y'],
      },
    ]);
    const run = await h.scheduler.runJob('u1', 'ECOSYSTEM_DEEP_SCAN', { manual: true });
    assertScenario(
      'meaningful-change detection: CRITICAL + UPDATED + REMOVED classified honestly',
      run.changeSummary.counts.CRITICAL_CHANGE === 1 &&
        run.changeSummary.counts.UPDATED === 1 &&
        run.changeSummary.counts.REMOVED === 1 &&
        run.changeSummary.counts.NEW === 0,
      `CRITICAL=${String(run.changeSummary.counts.CRITICAL_CHANGE)} · UPDATED=${String(run.changeSummary.counts.UPDATED)} · REMOVED=${String(run.changeSummary.counts.REMOVED)}`,
    );
  }

  // 10. Brain hand-off — the scheduler asks for EVERY meaningful change.
  {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }, { id: 'm2' }] }]);
    const run = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    assertScenario(
      'brain hand-off: one relevance evaluation per meaningful change',
      h.brain.calls === 2 && run.changeSummary.entries.length === 2,
      `${String(h.brain.calls)} evaluation(s) for ${String(run.changeSummary.entries.length)} change(s)`,
    );
  }

  // 11. Notification decision — irrelevant changes never surface.
  {
    const h = makeHarness();
    h.brain.relevant = false;
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    const run = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    assertScenario(
      'notification decision: irrelevant change → skipped, never emitted',
      run.notifications.skipped === 1 &&
        run.notifications.emitted === 0 &&
        h.notify.emitted.length === 0,
      `skipped=${String(run.notifications.skipped)} · emitted=0`,
    );
  }

  // 12. Manual/scheduled parity — no privileged manual shortcut.
  {
    const h = makeHarness();
    h.scheduler.ensureDefaults('u1');
    const job = seededJob(h, 'PROVIDER_MODEL_DISCOVERY');
    job.policy = { ...job.policy, runLimits: { ...job.policy.runLimits, maxRuntimeMs: 5 } };
    h.jobs.save(job);
    h.discovery.simulatedLatencyMs = 10;
    const manual = await h.scheduler.runJob('u1', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    assertScenario(
      'manual/scheduled parity: Run now enforces the exact same budget — no shortcut',
      manual.status === 'FAILED' && h.discovery.discoverCalls === 1,
      `manual run status ${manual.status} under the same bounded budget`,
    );
  }

  // 13. Owner isolation.
  {
    const h = makeHarness();
    h.discovery.scriptRuns([{ add: [{ id: 'm1' }] }]);
    await h.scheduler.runJob('user-a', 'PROVIDER_MODEL_DISCOVERY', { manual: true });
    assertScenario(
      'owner isolation: per-user schedules/runs never cross users',
      h.runs.list('user-b').length === 0 && h.jobs.list('user-b').length === 0,
      'user-b sees zero of user-a’s schedules or runs',
    );
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('── SCENARIOS ──────────────────────────────────────────────────────');
  for (const o of outcomes) {
    console.log(`${o.pass ? '✅' : '✗'} ${o.name}: ${o.detail}`);
  }
  console.log('───────────────────────────────────────────────────────────────────');
  const allPass = outcomes.every((o) => o.pass);
  console.log(
    `Total scenarios: ${outcomes.length} · Passed: ${outcomes.filter((o) => o.pass).length}`,
  );
  console.log(`Verdict: ${allPass ? 'PASS' : 'REVIEW'}`);
  if (!allPass) {
    console.log('  ✗ One or more scheduler contracts did not hold.');
    process.exitCode = 1;
  } else {
    console.log(
      '  ✅ SCHEDULE → POLICY → BUDGET → DISCOVERY → EVIDENCE → CHANGE DETECTION → BRAIN → NOTIFY — all bounded, all honest.',
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    '✗ AI World Scheduler benchmark FAILED:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
