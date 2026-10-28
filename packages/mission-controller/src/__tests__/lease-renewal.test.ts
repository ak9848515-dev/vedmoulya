// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LEASE-01 · Objective lease renewal & autonomous recovery
//
// ROOT CAUSE THIS SUITE LOCKS DOWN
// --------------------------------
// An objective's durable ownership lease was written ONCE (at acquisition) and
// never renewed. Any objective that legitimately took longer than the lease TTL
// (default 60 000 ms) therefore LOOKED abandoned: a recovery pass healed it back
// to READY, and the still-working owner later wrote its own stale snapshot over
// the record — the interrupted objective and the lost `Last Verification`
// result.
//
// Every test here is deterministic: the clock is injected and the lease-renewal
// scheduler is a MANUAL scheduler, so renewal happens exactly when a test says
// so — never after a real-time sleep.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  MissionControllerService,
  DEFAULT_LEASE_TTL_MS,
} from '../application/MissionControllerService.js';
import { InMemoryMissionStore } from '../infrastructure/InMemoryMissionStore.js';
import { InMemoryCheckpointStore } from '../infrastructure/InMemoryCheckpointStore.js';
import { createIdGenerator } from '../infrastructure/IdGenerator.js';
import { DeterministicObjectiveSelector } from '../domain/objective-selector.js';
import { SimpleGoalUnderstanding } from '../domain/goal-understanding.js';
import { classifyFailure } from '../domain/mission-failure-classifier.js';
import { ObjectiveLeaseHeartbeat } from '../domain/objective-lease-heartbeat.js';
import type { ClockPort, MissionStore } from '../contracts/mission-ports.js';
import type {
  Mission,
  MissionObjectiveLease,
  ObjectiveLeaseRenewal,
} from '../types/mission-types.js';

const START_MS = 1_700_000_000_000;

/** A MANUAL scheduler: ticks only when a test fires them (no real timers). */
function createManualScheduler(): {
  scheduler: {
    schedule(tick: () => Promise<void>, delayMs: number): unknown;
    cancel(handle: unknown): void;
  };
  delays: number[];
  fire(): Promise<void>;
  pending(): number;
  cancelled(): number;
} {
  let pendingTick: (() => Promise<void>) | undefined;
  const delays: number[] = [];
  let cancelledCount = 0;
  let handleCount = 0;
  return {
    scheduler: {
      schedule(tick, delayMs) {
        pendingTick = tick;
        delays.push(delayMs);
        handleCount += 1;
        return { handle: handleCount };
      },
      cancel() {
        cancelledCount += 1;
        pendingTick = undefined;
      },
    },
    delays,
    async fire() {
      const tick = pendingTick;
      pendingTick = undefined;
      if (tick) await tick();
    },
    pending: () => (pendingTick === undefined ? 0 : 1),
    cancelled: () => cancelledCount,
  };
}

/** In-memory store that counts ownership-checked renewals (evidence only). */
class TrackingMissionStore extends InMemoryMissionStore {
  renewCalls = 0;

  override async renewObjectiveLease(
    missionId: string,
    objectiveId: string,
    renewal: ObjectiveLeaseRenewal,
  ): Promise<MissionObjectiveLease | undefined> {
    this.renewCalls += 1;
    return super.renewObjectiveLease(missionId, objectiveId, renewal);
  }
}

interface HarnessOptions {
  store?: InMemoryMissionStore;
  ttlMs?: number;
  /** Runs during planning (may advance the clock / fire a renewal tick). */
  onPlan?: (h: Harness) => Promise<void> | void;
  /** Runs during execution. Return `false` to simulate an executor throw. */
  onExecute?: (h: Harness) => Promise<boolean | void> | boolean | void;
  /** Runs during verification. Return `false` to simulate a verification refusal. */
  onVerify?: (h: Harness) => Promise<boolean | void> | boolean | void;
}

interface Harness {
  service: MissionControllerService;
  store: TrackingMissionStore;
  checkpointStore: InMemoryCheckpointStore;
  clock: ClockPort;
  advance(ms: number): void;
  nowMs(): number;
  ticks: ReturnType<typeof createManualScheduler>;
  executions: string[];
  verifications(): number;
  run(missionId: string): Promise<Mission>;
}

function harness(options: HarnessOptions = {}): Harness {
  let nowMs = START_MS;
  const store = (options.store as TrackingMissionStore | undefined) ?? new TrackingMissionStore();
  const checkpointStore = new InMemoryCheckpointStore();
  const ticks = createManualScheduler();
  const executions: string[] = [];
  let verificationCount = 0;

  const clock: ClockPort = {
    now: () => new Date(nowMs).toISOString(),
    timestampMs: () => nowMs,
  };

  const h: Harness = {
    service: undefined as unknown as MissionControllerService,
    store,
    checkpointStore,
    clock,
    advance: (ms: number) => {
      nowMs += ms;
    },
    nowMs: () => nowMs,
    ticks,
    executions,
    verifications: () => verificationCount,
    run: (missionId: string) => h.service.runNextObjective(missionId),
  };

  const providerStatus = {
    available: true,
    capableProviders: [{ providerId: 'mock', modelId: 'mock-1', capabilities: [], healthy: true }],
    unhealthyProviders: [],
  };

  h.service = new MissionControllerService({
    store,
    checkpointStore,
    objectiveSelector: new DeterministicObjectiveSelector(),
    providerAvailability: { getProviderStatus: async () => providerStatus },
    goalUnderstanding: new SimpleGoalUnderstanding(),
    planner: {
      createPlan: async (goal: string) => {
        await options.onPlan?.(h);
        return {
          planId: 'plan_lease_1',
          goalId: 'goal_lease_1',
          objective: goal,
          steps: [],
          finalVerification: {
            kind: 'command' as const,
            description: 'checks pass',
            command: { toolName: 'test', arguments: {}, expect: 'ok' as const },
          },
          completionCriteria: [],
        };
      },
    },
    executor: {
      executePlan: async () => {
        executions.push('execute');
        const outcome = await options.onExecute?.(h);
        if (outcome === false) throw new Error('executor failed');
        return {
          runId: `run_${String(executions.length)}`,
          success: true,
          verified: true,
          output: 'ok',
          usage: { tokens: 10, costUsd: 0.001, latencyMs: 5, toolCalls: 1 },
        };
      },
    },
    verifier: {
      verifyObjective: async () => {
        verificationCount += 1;
        const outcome = await options.onVerify?.(h);
        if (outcome === false) return { verified: false, evidence: [], method: 'test' };
        return { verified: true, evidence: ['checks passed'], method: 'test_verification' };
      },
    },
    executionMemory: { recordVerifiedOutcome: async () => undefined },
    experienceOptimization: {
      getAdvisorySignal: async () => ({ confidence: 0.5, evidenceCount: 0 }),
    },
    failureClassifier: {
      classify: async (error, result, status) => classifyFailure(error, result, status),
    },
    clock,
    idGenerator: createIdGenerator(),
    leaseTtlMs: options.ttlMs ?? DEFAULT_LEASE_TTL_MS,
    leaseRenewalScheduler: ticks.scheduler,
  });
  return h;
}

async function createRunningMission(h: Harness, objectives: string[] = ['Do the work']) {
  const mission = await h.service.createMission({
    userId: 'u1',
    title: 'Lease mission',
    objective: 'Keep the lease alive',
    initialObjectives: objectives,
  });
  await h.service.startMission(mission.missionId);
  return mission;
}

function objectiveOf(mission: Mission | undefined, objectiveId: string) {
  return mission?.objectives.find((objective) => objective.objectiveId === objectiveId);
}

/** The minimal store surface the heartbeat itself uses (unit-level tests). */
function leaseOnlyStore(
  renew: (renewal: ObjectiveLeaseRenewal) => Promise<MissionObjectiveLease | undefined>,
): MissionStore {
  return {
    save: async () => undefined,
    get: async () => undefined,
    listByUserId: async () => [],
    listActive: async () => [],
    renewObjectiveLease: async (_missionId, _objectiveId, renewal) => renew(renewal),
  };
}

function unitHeartbeat(
  store: MissionStore,
  scheduler: ReturnType<typeof createManualScheduler>['scheduler'],
  nowMs = START_MS,
): ObjectiveLeaseHeartbeat {
  return new ObjectiveLeaseHeartbeat({
    store,
    clock: { now: () => new Date(nowMs).toISOString(), timestampMs: () => nowMs },
    missionId: 'mission_unit',
    objectiveId: 'objective_unit',
    lease: {
      owner: 'mission-runtime',
      token: 'lease_unit',
      acquiredAt: new Date(START_MS).toISOString(),
      expiresAt: new Date(START_MS + 60_000).toISOString(),
    },
    ttlMs: 60_000,
    scheduler,
  });
}

// ─────────────────────────────────────────────────────────────────────
// 1–4 · long phases stay RUNNING (the reported interruption)
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-01 · an objective that outlives the lease TTL is renewed, never interrupted', () => {
  it('runs longer than 60s, keeps its lease live, and is NOT reset to READY by recovery', async () => {
    let observedDuringRecovery = '';
    let missionId = '';
    let objectiveId = '';
    const h = harness({
      onExecute: async (hh) => {
        // 45s of work, a heartbeat renewal, then another 45s: at that point the
        // ORIGINAL 60s lease has expired and, without renewal, recovery would
        // heal the objective back to READY.
        hh.advance(45_000);
        await hh.ticks.fire(); // renewal #1 (45s < 60s TTL)
        hh.advance(45_000); // 90s of work: the ORIGINAL lease is long expired
        const recovered = await hh.service.recoverMission(missionId);
        observedDuringRecovery = objectiveOf(recovered, objectiveId)?.state ?? 'MISSING';
        await hh.ticks.fire(); // renewal #2, still before the renewed expiry
        hh.advance(30_000);
      },
    });
    const mission = await createRunningMission(h);
    missionId = mission.missionId;
    objectiveId = (await h.store.get(missionId))!.objectives[0]!.objectiveId;

    const result = await h.run(missionId);

    // The recovery pass that ran mid-execution saw a LIVE lease.
    expect(observedDuringRecovery).toBe('RUNNING');
    // The attempt finished on its own evidence…
    expect(objectiveOf(result, objectiveId)?.state).toBe('VERIFIED');
    expect(objectiveOf(result, objectiveId)?.verifiedOutcome?.achieved).toBe(true);
    // …the lease was genuinely renewed (not merely spared)…
    expect(h.store.renewCalls).toBeGreaterThanOrEqual(2);
    // …and `Last Verification` survived in the durable record.
    expect(objectiveOf(await h.store.get(missionId), objectiveId)?.verifiedOutcome?.achieved).toBe(
      true,
    );
    // Nothing keeps renewing after the attempt ended.
    expect(h.ticks.pending()).toBe(0);
  });

  it('slow PLANNING does not cause premature recovery', async () => {
    let planningSaw = '';
    let missionId = '';
    let objectiveId = '';
    const h = harness({
      onPlan: async (hh) => {
        hh.advance(40_000);
        await hh.ticks.fire(); // renewal, comfortably before the 60s TTL
        hh.advance(30_000); // 70s of planning in total
        const recovered = await hh.service.recoverMission(missionId);
        planningSaw = objectiveOf(recovered, objectiveId)?.state ?? 'MISSING';
      },
    });
    const mission = await createRunningMission(h);
    missionId = mission.missionId;
    objectiveId = (await h.store.get(missionId))!.objectives[0]!.objectiveId;

    const result = await h.run(missionId);

    expect(planningSaw).toBe('RUNNING');
    expect(objectiveOf(result, objectiveId)?.state).toBe('VERIFIED');
    expect(h.store.renewCalls).toBeGreaterThanOrEqual(1);
  });

  it('slow EXECUTION does not cause premature recovery', async () => {
    let executionSaw = '';
    let missionId = '';
    let objectiveId = '';
    const h = harness({
      onExecute: async (hh) => {
        hh.advance(40_000);
        await hh.ticks.fire();
        hh.advance(21_000); // 61s of execution in total
        const recovered = await hh.service.recoverMission(missionId);
        executionSaw = objectiveOf(recovered, objectiveId)?.state ?? 'MISSING';
      },
    });
    const mission = await createRunningMission(h);
    missionId = mission.missionId;
    objectiveId = (await h.store.get(missionId))!.objectives[0]!.objectiveId;

    const result = await h.run(missionId);

    expect(executionSaw).toBe('RUNNING');
    expect(objectiveOf(result, objectiveId)?.state).toBe('VERIFIED');
  });

  it('slow VERIFICATION does not cause premature recovery', async () => {
    let verificationSaw = '';
    let missionId = '';
    let objectiveId = '';
    const h = harness({
      onVerify: async (hh) => {
        hh.advance(40_000);
        await hh.ticks.fire();
        hh.advance(21_000); // 61s of verification in total
        const recovered = await hh.service.recoverMission(missionId);
        verificationSaw = objectiveOf(recovered, objectiveId)?.state ?? 'MISSING';
      },
    });
    const mission = await createRunningMission(h);
    missionId = mission.missionId;
    objectiveId = (await h.store.get(missionId))!.objectives[0]!.objectiveId;

    const result = await h.run(missionId);

    expect(verificationSaw).toBe('RUNNING');
    expect(objectiveOf(result, objectiveId)?.state).toBe('VERIFIED');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5–7 · crash recovery still works exactly as before
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-01 · crash recovery semantics are preserved', () => {
  it('a CRASHED owner (no further renewal) is still recoverable once its lease expires', async () => {
    const h = harness();
    const mission = await createRunningMission(h);
    const objectiveId = (await h.store.get(mission.missionId))!.objectives[0]!.objectiveId;

    // The owner dies right after acquiring the lease (nothing renews it).
    await h.store.acquireObjectiveLease(mission.missionId, objectiveId, {
      owner: 'mission-runtime',
      token: 'lease_crashed',
      acquiredAt: new Date(h.nowMs()).toISOString(),
      expiresAt: new Date(h.nowMs() + DEFAULT_LEASE_TTL_MS).toISOString(),
    });

    // Still inside the TTL: recovery must NOT touch a possibly-live owner.
    const untouched = await h.service.recoverMission(mission.missionId);
    expect(objectiveOf(untouched, objectiveId)?.state).toBe('RUNNING');

    // Past the TTL: the lease is genuinely dead and the objective recovers.
    h.advance(DEFAULT_LEASE_TTL_MS + 1_000);
    const healed = await h.service.recoverMission(mission.missionId);
    const objective = objectiveOf(healed, objectiveId);
    expect(objective?.state).toBe('READY');
    expect(objective?.lease).toBeUndefined();
    expect(objective?.failureReason).toContain('durable lease expired');
    expect(healed.activity?.some((event) => event.kind === 'RECOVERY_LEASE_EXPIRED')).toBe(true);

    // …and the SAME loop continues it through the normal chain.
    const done = await h.service.runAutonomousLoop(mission.missionId);
    expect(objectiveOf(done, objectiveId)?.state).toBe('VERIFIED');
  });

  it('a LIVE lease is never reset by recovery (same owner AND same fencing token)', async () => {
    const h = harness();
    const mission = await createRunningMission(h);
    const objectiveId = (await h.store.get(mission.missionId))!.objectives[0]!.objectiveId;
    expect(
      await h.store.acquireObjectiveLease(mission.missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_live',
        acquiredAt: new Date(h.nowMs()).toISOString(),
        expiresAt: new Date(h.nowMs() + 1_000).toISOString(),
      }),
    ).toBeDefined();

    // A renewal (what the heartbeat does) extends it past the original horizon.
    expect(
      await h.store.renewObjectiveLease(mission.missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_live',
        nowMs: h.nowMs() + 500,
        expiresAt: new Date(h.nowMs() + DEFAULT_LEASE_TTL_MS).toISOString(),
      }),
    ).toBeDefined();

    // The clock passes the ORIGINAL expiry: the renewed lease is still live.
    h.advance(2_000);
    const recovered = await h.service.recoverMission(mission.missionId);
    const objective = objectiveOf(recovered, objectiveId);
    expect(objective?.state).toBe('RUNNING');
    expect(objective?.lease?.owner).toBe('mission-runtime');
    expect(objective?.lease?.token).toBe('lease_live');
  });

  it('a worker whose lease was healed and re-acquired cannot finalize or overwrite the new owner', async () => {
    const store = new TrackingMissionStore();
    const ticks = createManualScheduler();
    let missionId = '';
    let objectiveId = '';
    let workerB: Harness | undefined;

    const h = harness({
      store,
      onVerify: async () => {
        // A's lease expires while A is still verifying…
        const current = await store.get(missionId);
        objectiveOf(current, objectiveId)!.lease!.expiresAt = new Date(h.nowMs() - 1).toISOString();
        await store.save(current!);

        // …recovery (another process) heals it, and worker B acquires it.
        const workerBService = harness({ store, onExecute: async () => undefined });
        workerB = workerBService;
        const healed = await workerBService.service.recoverMission(missionId);
        expect(objectiveOf(healed, objectiveId)?.state).toBe('READY');
        const done = await workerBService.run(missionId);
        expect(objectiveOf(done, objectiveId)?.verifiedOutcome?.achieved).toBe(true);
      },
    });
    const mission = await createRunningMission(h);
    missionId = mission.missionId;
    objectiveId = (await store.get(missionId))!.objectives[0]!.objectiveId;

    const aResult = await h.run(missionId);

    // Exactly ONE finalization happened (B's); A never overwrote it.
    const stored = await store.get(missionId);
    expect(stored!.objectives.filter((objective) => objective.state === 'VERIFIED')).toHaveLength(
      1,
    );
    expect(objectiveOf(stored, objectiveId)?.verifiedOutcome?.achieved).toBe(true);
    expect(objectiveOf(stored, objectiveId)?.lease).toBeUndefined();
    // A's returned view is the CURRENT owner's record, and the loss is recorded
    // honestly — never a fabricated success.
    expect(objectiveOf(aResult, objectiveId)?.state).toBe('VERIFIED');
    expect(stored!.activity?.some((event) => event.kind === 'OBJECTIVE_LEASE_LOST')).toBe(true);
    // No heartbeat from either worker is left running.
    expect(ticks.pending()).toBe(0);
    expect(workerB?.ticks.pending()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 8 · stale / replaced / expired acquisitions can never renew
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-01 · ownership-checked renewal refuses stale acquisitions', () => {
  it('refuses expired, replaced, foreign-owner and token-less leases', async () => {
    const store = new TrackingMissionStore();
    const h = harness({ store });
    const mission = await createRunningMission(h);
    const objectiveId = (await store.get(mission.missionId))!.objectives[0]!.objectiveId;
    const now = h.nowMs();
    const renewal = (token: string, owner = 'mission-runtime'): ObjectiveLeaseRenewal => ({
      owner,
      token,
      nowMs: now + 500,
      expiresAt: new Date(now + 60_000).toISOString(),
    });

    await store.acquireObjectiveLease(mission.missionId, objectiveId, {
      owner: 'mission-runtime',
      token: 'lease_first',
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 1_000).toISOString(),
    });

    // (a) an unexpired, correctly-owned lease renews.
    expect(
      await store.renewObjectiveLease(mission.missionId, objectiveId, renewal('lease_first')),
    ).toBeDefined();

    // (b) a foreign owner / wrong token never renews.
    expect(
      await store.renewObjectiveLease(
        mission.missionId,
        objectiveId,
        renewal('lease_first', 'other-worker'),
      ),
    ).toBeUndefined();
    expect(
      await store.renewObjectiveLease(mission.missionId, objectiveId, renewal('lease_other')),
    ).toBeUndefined();

    // (c) an EXPIRED lease is not renewable — a late renewal never reclaims it.
    expect(
      await store.renewObjectiveLease(mission.missionId, objectiveId, {
        ...renewal('lease_first'),
        nowMs: now + 61_000,
      }),
    ).toBeUndefined();

    // (d) recovery heals it; the old acquisition can NEVER renew again.
    expect(
      await store.releaseExpiredObjectiveLease(mission.missionId, objectiveId, {
        nowMs: now + 62_000,
        failureReason: 'expired',
      }),
    ).toBeDefined();
    expect(
      await store.renewObjectiveLease(mission.missionId, objectiveId, {
        ...renewal('lease_first'),
        nowMs: now + 62_000,
      }),
    ).toBeUndefined();

    // (e) a NEW acquisition owns it; the previous token stays refused.
    await store.acquireObjectiveLease(mission.missionId, objectiveId, {
      owner: 'mission-runtime',
      token: 'lease_second',
      acquiredAt: new Date(now + 63_000).toISOString(),
      expiresAt: new Date(now + 123_000).toISOString(),
    });
    expect(
      await store.renewObjectiveLease(mission.missionId, objectiveId, {
        ...renewal('lease_first'),
        nowMs: now + 64_000,
      }),
    ).toBeUndefined();
    expect(
      await store.renewObjectiveLease(mission.missionId, objectiveId, {
        ...renewal('lease_second'),
        nowMs: now + 64_000,
      }),
    ).toBeDefined();

    // (f) a legacy lease WITHOUT a fencing token is never renewable — and its
    // ownership cannot be proven either (treated as stale, safely).
    const legacy = (await store.get(mission.missionId))!;
    legacy.objectives[0]!.lease = {
      owner: 'mission-runtime',
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 600_000).toISOString(),
    };
    await store.save(legacy);
    expect(
      await store.renewObjectiveLease(mission.missionId, objectiveId, {
        ...renewal('lease_second'),
        nowMs: now + 64_000,
      }),
    ).toBeUndefined();
    expect(
      await store.holdsObjectiveLease(mission.missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_second',
      }),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 10–11 · renewal failures, exceptions and cleanup
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-01 · renewal failures are handled safely', () => {
  it('a renewal outage that also loses ownership persists NOTHING and claims nothing', async () => {
    class OutageStore extends TrackingMissionStore {
      override async renewObjectiveLease(): Promise<MissionObjectiveLease | undefined> {
        throw new Error('lease store unavailable');
      }
    }
    const store = new OutageStore();
    let missionId = '';
    let objectiveId = '';
    const h = harness({
      store,
      onVerify: async () => {
        // Ownership is GENUINELY taken away during the attempt: the lease is
        // healed by recovery and the objective re-acquired under a NEW token.
        // (A renewal outage alone is not a loss — the fencing token still
        // proves ownership, which is exactly what the next test covers.)
        const current = (await store.get(missionId))!;
        objectiveOf(current, objectiveId)!.lease!.expiresAt = new Date(h.nowMs() - 1).toISOString();
        await store.save(current);
        await store.releaseExpiredObjectiveLease(missionId, objectiveId, {
          nowMs: h.nowMs(),
          failureReason: 'expired',
        });
        await store.acquireObjectiveLease(missionId, objectiveId, {
          owner: 'mission-runtime',
          token: 'lease_replacement',
          acquiredAt: new Date(h.nowMs()).toISOString(),
          expiresAt: new Date(h.nowMs() + DEFAULT_LEASE_TTL_MS).toISOString(),
        });
      },
    });
    const mission = await createRunningMission(h);
    missionId = mission.missionId;
    objectiveId = (await store.get(mission.missionId))!.objectives[0]!.objectiveId;

    const result = await h.run(mission.missionId);

    // The work ran, but no result was acknowledged over an unowned objective.
    expect(h.executions).toHaveLength(1);
    const stored = await store.get(mission.missionId);
    // The REPLACEMENT owner's record survives untouched (RUNNING + its token).
    expect(objectiveOf(stored, objectiveId)?.state).toBe('RUNNING');
    expect(objectiveOf(stored, objectiveId)?.lease?.token).toBe('lease_replacement');
    expect(objectiveOf(stored, objectiveId)?.verifiedOutcome).toBeUndefined();
    expect(objectiveOf(result, objectiveId)?.verifiedOutcome).toBeUndefined();
    expect(stored?.activity?.some((event) => event.kind === 'OBJECTIVE_LEASE_LOST')).toBe(true);
    // The heartbeat stopped: nothing keeps renewing a lease that is gone.
    expect(h.ticks.pending()).toBe(0);
    expect(h.ticks.cancelled()).toBeGreaterThanOrEqual(1);

    // A subsequent recovery still heals it honestly (nothing is stuck).
    h.advance(DEFAULT_LEASE_TTL_MS + 1_000);
    const healed = await h.service.recoverMission(mission.missionId);
    expect(objectiveOf(healed, objectiveId)?.state).toBe('READY');
  });

  it('a renewal outage where ownership still holds acknowledges the finished work (no duplicate run)', async () => {
    class RenewalOutageStore extends TrackingMissionStore {
      override async renewObjectiveLease(): Promise<MissionObjectiveLease | undefined> {
        throw new Error('lease store unavailable');
      }
    }
    const store = new RenewalOutageStore();
    // The outage only exists once a renewal is actually ATTEMPTED: the manual
    // scheduler fires one tick during execution, which throws.
    const h = harness({ store, onExecute: async (hh) => hh.ticks.fire() });
    const mission = await createRunningMission(h);
    const objectiveId = (await store.get(mission.missionId))!.objectives[0]!.objectiveId;

    const result = await h.run(mission.missionId);

    expect(h.executions).toHaveLength(1);
    expect(objectiveOf(result, objectiveId)?.state).toBe('VERIFIED');
    const stored = await store.get(mission.missionId);
    expect(objectiveOf(stored, objectiveId)?.verifiedOutcome?.achieved).toBe(true);
    // The degraded renewal is recorded, never silent.
    expect(stored?.activity?.some((event) => event.kind === 'OBJECTIVE_LEASE_NOT_RENEWED')).toBe(
      true,
    );
  });

  it('exceptions and cancellation paths stop the heartbeat (no timer survives)', async () => {
    // (a) an executor throw
    const executorThrow = harness({ onExecute: async () => false });
    const missionA = await createRunningMission(executorThrow);
    await executorThrow.run(missionA.missionId);
    expect(executorThrow.ticks.pending()).toBe(0);

    // (b) a verifier throw
    const verifierThrow = harness({
      onVerify: async () => {
        throw new Error('verification exploded');
      },
    });
    const missionB = await createRunningMission(verifierThrow);
    await verifierThrow.run(missionB.missionId);
    expect(verifierThrow.ticks.pending()).toBe(0);

    // (c) explicit stop cancels the scheduled renewal and blocks any further one
    const ticks = createManualScheduler();
    let renewals = 0;
    const heartbeat = unitHeartbeat(
      leaseOnlyStore(async () => {
        renewals += 1;
        return {
          owner: 'mission-runtime',
          token: 'lease_unit',
          acquiredAt: new Date(START_MS).toISOString(),
          expiresAt: new Date(START_MS + 60_000).toISOString(),
        };
      }),
      ticks.scheduler,
    );
    heartbeat.start();
    await ticks.fire();
    expect(renewals).toBe(1);
    await heartbeat.stop();
    expect(ticks.pending()).toBe(0);
    const afterStop = renewals;
    await ticks.fire(); // nothing is scheduled any more
    expect(renewals).toBe(afterStop);
  });

  it('overlapping renewal requests are never issued concurrently', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const heartbeat = unitHeartbeat(
      leaseOnlyStore(async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await gate;
        concurrent -= 1;
        return {
          owner: 'mission-runtime',
          token: 'lease_unit',
          acquiredAt: new Date(START_MS).toISOString(),
          expiresAt: new Date(START_MS + 60_000).toISOString(),
        };
      }),
      createManualScheduler().scheduler,
    );

    const first = heartbeat.renewNow();
    const second = heartbeat.renewNow();
    release?.();
    const results = await Promise.all([first, second]);

    expect(results).toEqual([true, true]);
    expect(maxConcurrent).toBe(1);
    await heartbeat.stop();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 12–15 · LEASE-DEADLINE — the >5 s renewal incident
//
// The production log: `renewal did not settle within 5000 ms` →
// OBJECTIVE_LEASE_LOST → reconciliation → the objective restarted. The cause
// was measured in mission-runtime (the renewal waited on the store's shared
// write queue), and these tests lock down the HEARTBEAT half of the contract:
// a budget-exceeding renewal never revives authority, never overlaps another
// attempt, and never leaves an unobserved promise behind.
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-DEADLINE · a renewal that misses its deadline never reclaims authority', () => {
  const budget = 50;

  function deadlineHeartbeat(
    renew: () => Promise<MissionObjectiveLease | undefined>,
    scheduler = createManualScheduler().scheduler,
  ): ObjectiveLeaseHeartbeat {
    return new ObjectiveLeaseHeartbeat({
      store: leaseOnlyStore(renew),
      clock: { now: () => new Date(START_MS).toISOString(), timestampMs: () => START_MS },
      missionId: 'mission_deadline',
      objectiveId: 'objective_deadline',
      lease: {
        owner: 'mission-runtime',
        token: 'lease_deadline',
        acquiredAt: new Date(START_MS).toISOString(),
        expiresAt: new Date(START_MS + 60_000).toISOString(),
      },
      ttlMs: 60_000,
      renewalTimeoutMs: budget,
      // One attempt only: this suite is about the BUDGET, not the retry policy.
      retry: { maxAttempts: 1, retryDelayMs: 0 },
      scheduler,
    });
  }

  it('times out, records the reason, and a LATE success cannot mark it confirmed', async () => {
    let releaseLate: ((lease: MissionObjectiveLease | undefined) => void) | undefined;
    const heartbeat = deadlineHeartbeat(
      () =>
        new Promise<MissionObjectiveLease | undefined>((resolve) => {
          releaseLate = resolve;
        }),
    );

    const settled = await heartbeat.renewNow();
    expect(settled).toBe(false);
    expect(heartbeat.renewalFailureReason).toContain('did not settle within');
    expect(heartbeat.renewals).toBe(0);

    // The abandoned attempt finally resolves — with a lease. Ownership is NOT
    // restored: the outcome was already classified, the timer is gone, and the
    // heartbeat stays stopped.
    releaseLate?.({
      owner: 'mission-runtime',
      token: 'lease_deadline',
      acquiredAt: new Date(START_MS).toISOString(),
      expiresAt: new Date(START_MS + 120_000).toISOString(),
    });
    await Promise.resolve();

    expect(heartbeat.renewals).toBe(0);
    expect(await heartbeat.renewNow()).toBe(false);
    expect(heartbeat.knownExpiresAtMs).toBe(START_MS + 60_000);
  });

  it('a LATE REJECTION is observed, never an unhandled promise', async () => {
    let rejectLate: ((error: Error) => void) | undefined;
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const heartbeat = deadlineHeartbeat(
        () =>
          new Promise<MissionObjectiveLease | undefined>((_resolve, reject) => {
            rejectLate = reject;
          }),
      );

      expect(await heartbeat.renewNow()).toBe(false);
      // The database connection fails AFTER the budget expired.
      rejectLate?.(Object.assign(new Error('write CONNECTION_CLOSED'), { code: 'ECONNRESET' }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(unhandled).toEqual([]);
      expect(heartbeat.renewalFailureReason).toContain('did not settle within');
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('never runs two renewal attempts at once, even across ticks', async () => {
    const ticks = createManualScheduler();
    let concurrent = 0;
    let maxConcurrent = 0;
    let release: ((lease: MissionObjectiveLease | undefined) => void) | undefined;
    const heartbeat = deadlineHeartbeat(() => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      return new Promise<MissionObjectiveLease | undefined>((resolve) => {
        release = (lease) => {
          concurrent -= 1;
          resolve(lease);
        };
      });
    }, ticks.scheduler);

    heartbeat.start();
    const firstTick = ticks.fire(); // in flight, hung
    const joined = heartbeat.renewNow(); // must JOIN, not start a second
    release?.({
      owner: 'mission-runtime',
      token: 'lease_deadline',
      acquiredAt: new Date(START_MS).toISOString(),
      expiresAt: new Date(START_MS + 60_000).toISOString(),
    });
    await firstTick;
    expect(await joined).toBe(true);

    // Exactly one attempt was ever in flight.
    expect(maxConcurrent).toBe(1);
    await heartbeat.stop();
  });

  it('a renewal refused because recovery already healed the objective stops the heartbeat for good', async () => {
    const ticks = createManualScheduler();
    let calls = 0;
    const heartbeat = deadlineHeartbeat(() => {
      calls += 1;
      return Promise.resolve(undefined); // the store answered: not the owner
    }, ticks.scheduler);

    heartbeat.start();
    await ticks.fire();

    expect(calls).toBe(1);
    expect(heartbeat.renewalFailureReason).toContain('refused');
    // No further ticks are scheduled: a refusal is an authoritative answer.
    expect(ticks.pending()).toBe(0);
    expect(ticks.delays).toHaveLength(1);
  });
});
