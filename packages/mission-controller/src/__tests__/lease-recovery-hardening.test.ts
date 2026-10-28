// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LOCAL RELIABILITY SPRINT · Priority 1
// Lease recovery hardening: transient-renewal retries, the ownership
// initiation gate, and cross-attempt workspace exclusion.
//
// ROOT CAUSES THIS SUITE LOCKS DOWN
// ---------------------------------
// R1. A SINGLE transient renewal failure (a 5 s timeout or a driver error)
//     stopped the heartbeat PERMANENTLY while the attempt kept working. The
//     lease then expired, recovery healed the objective to READY, and a second
//     execution started — the reported `RECOVERY_LEASE_EXPIRED`.
// R2. The controller refused to PERSIST a result it no longer owned, but it
//     still STARTED work: `executePlan` (real tools, real commands) and
//     `verifyObjective` (command verification) ran after ownership was gone.
// R3. Two different MISSIONS pointing at the SAME authorized workspace could
//     execute concurrently; nothing serialised the workspace itself.
//
// Every test is deterministic: injected clock, injected sleep (no real delays),
// manual renewal scheduler, fake executor/verifier.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEASE_TTL_MS,
  MissionControllerService,
} from '../application/MissionControllerService.js';
import { InMemoryMissionStore } from '../infrastructure/InMemoryMissionStore.js';
import { InMemoryCheckpointStore } from '../infrastructure/InMemoryCheckpointStore.js';
import { createIdGenerator } from '../infrastructure/IdGenerator.js';
import { DeterministicObjectiveSelector } from '../domain/objective-selector.js';
import { SimpleGoalUnderstanding } from '../domain/goal-understanding.js';
import { classifyFailure } from '../domain/mission-failure-classifier.js';
import { ObjectiveLeaseHeartbeat } from '../domain/objective-lease-heartbeat.js';
import { InMemoryWorkspaceLeaseStore } from '../domain/workspace-execution-lease.js';
import type { ClockPort, MissionStore } from '../contracts/mission-ports.js';
import type {
  Mission,
  MissionObjectiveLease,
  ObjectiveLeaseRenewal,
} from '../types/mission-types.js';

const START_MS = 1_700_000_000_000;
const WORKSPACE = '/authorized/workspace';

/** A MANUAL scheduler: ticks only when a test fires them (no real timers). */
function createManualScheduler() {
  let pendingTick: (() => Promise<void>) | undefined;
  let cancelledCount = 0;
  let handleCount = 0;
  return {
    scheduler: {
      schedule(tick: () => Promise<void>, _delayMs: number) {
        pendingTick = tick;
        handleCount += 1;
        return { handle: handleCount };
      },
      cancel() {
        cancelledCount += 1;
        pendingTick = undefined;
      },
    },
    async fire() {
      const tick = pendingTick;
      pendingTick = undefined;
      if (tick) await tick();
    },
    pending: () => (pendingTick === undefined ? 0 : 1),
    cancelled: () => cancelledCount,
  };
}

/** Deterministic sleep: records the delay, never waits. */
function createFakeSleep() {
  const delays: number[] = [];
  return {
    sleep: async (ms: number): Promise<void> => {
      delays.push(ms);
    },
    delays,
  };
}

function objectiveOf(mission: Mission | undefined, objectiveId: string) {
  return mission?.objectives.find((objective) => objective.objectiveId === objectiveId);
}

function leaseAt(owner: string, token: string, expiresAtMs: number): MissionObjectiveLease {
  return {
    owner,
    token,
    acquiredAt: new Date(START_MS).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// A · transient renewal retries (unit level, the heartbeat itself)
// ─────────────────────────────────────────────────────────────────────

interface ScriptedLeaseStore extends MissionStore {
  renewCalls: number;
  ownershipChecks: number;
}

/**
 * A store whose renewal outcome and ownership answer are SCRIPTED per call, so
 * the retry decision is exercised exactly (no timing, no real I/O).
 */
function scriptedLeaseStore(options: {
  renew: (attempt: number) => MissionObjectiveLease | undefined;
  owns?: (attempt: number) => boolean;
}): ScriptedLeaseStore {
  let renewAttempts = 0;
  let ownershipCalls = 0;
  return {
    renewCalls: 0,
    ownershipChecks: 0,
    save: async () => undefined,
    get: async () => undefined,
    listByUserId: async () => [],
    listActive: async () => [],
    async renewObjectiveLease(
      _missionId: string,
      _objectiveId: string,
      _renewal: ObjectiveLeaseRenewal,
    ): Promise<MissionObjectiveLease | undefined> {
      renewAttempts += 1;
      this.renewCalls += 1;
      return options.renew(renewAttempts);
    },
    async holdsObjectiveLease(): Promise<boolean> {
      ownershipCalls += 1;
      this.ownershipChecks += 1;
      return options.owns ? options.owns(ownershipCalls) : true;
    },
  } as ScriptedLeaseStore;
}

function unitHeartbeat(
  store: MissionStore,
  overrides: {
    scheduler?: ReturnType<typeof createManualScheduler>['scheduler'];
    sleep?: (ms: number) => Promise<void>;
    nowMs?: number;
    ttlMs?: number;
    retry?: { maxAttempts?: number; retryDelayMs?: number };
  } = {},
): ObjectiveLeaseHeartbeat {
  const nowMs = overrides.nowMs ?? START_MS;
  const ttlMs = overrides.ttlMs ?? 60_000;
  return new ObjectiveLeaseHeartbeat({
    store,
    clock: { now: () => new Date(nowMs).toISOString(), timestampMs: () => nowMs },
    missionId: 'mission_unit',
    objectiveId: 'objective_unit',
    lease: leaseAt('mission-runtime', 'lease_unit', START_MS + ttlMs),
    ttlMs,
    scheduler: overrides.scheduler ?? createManualScheduler().scheduler,
    ...(overrides.sleep ? { sleep: overrides.sleep } : {}),
    ...(overrides.retry ? { retry: overrides.retry } : {}),
  });
}

describe('RETRY-01 · transient renewal failures are retried while ownership and expiry hold', () => {
  it('recovers from a transient failure and keeps renewing', async () => {
    const store = scriptedLeaseStore({
      renew: (attempt) => {
        if (attempt === 1) throw new Error('read ECONNRESET');
        return leaseAt('mission-runtime', 'lease_unit', START_MS + 60_000);
      },
    });
    const fake = createFakeSleep();
    const heartbeat = unitHeartbeat(store, { sleep: fake.sleep });

    expect(await heartbeat.renewNow()).toBe(true);
    expect(store.renewCalls).toBe(2); // failed once, retried once, confirmed
    expect(heartbeat.renewals).toBe(1);
    expect(heartbeat.renewalFailureReason).toBeUndefined();
    expect(fake.delays).toEqual([25]); // one bounded retry pause
    await heartbeat.stop();
  });

  it('gives up after the attempt limit and records the honest reason', async () => {
    const store = scriptedLeaseStore({
      renew: () => {
        throw new Error('lease store unavailable');
      },
    });
    const heartbeat = unitHeartbeat(store, {
      sleep: createFakeSleep().sleep,
      retry: { maxAttempts: 3, retryDelayMs: 10 },
    });

    expect(await heartbeat.renewNow()).toBe(false);
    expect(store.renewCalls).toBe(3);
    expect(heartbeat.renewals).toBe(0);
    expect(heartbeat.renewalFailureReason).toContain('gave up after 3 attempt(s)');
    await heartbeat.stop();
  });

  it('never retries a REFUSAL — the store already answered', async () => {
    const store = scriptedLeaseStore({ renew: () => undefined });
    const heartbeat = unitHeartbeat(store, { sleep: createFakeSleep().sleep });

    expect(await heartbeat.renewNow()).toBe(false);
    expect(store.renewCalls).toBe(1);
    expect(heartbeat.renewalFailureReason).toBe('lease renewal was refused by the store');
    await heartbeat.stop();
  });

  it('does not retry once the lease it knows about has expired', async () => {
    const store = scriptedLeaseStore({
      renew: () => {
        throw new Error('timeout');
      },
    });
    // Constructed with an ALREADY expired lease: the first transient failure
    // has nowhere to retry to, and a late renewal must never reclaim authority.
    const heartbeat = unitHeartbeat(store, {
      nowMs: START_MS + 60_000,
      sleep: createFakeSleep().sleep,
    });

    expect(await heartbeat.renewNow()).toBe(false);
    expect(store.renewCalls).toBe(1);
    expect(heartbeat.renewalFailureReason).toContain('not retried');
    expect(heartbeat.renewalFailureReason).toContain('expired');
    await heartbeat.stop();
  });

  it('stops retrying when ownership is gone (a stale attempt never argues)', async () => {
    const store = scriptedLeaseStore({
      renew: () => {
        throw new Error('timeout');
      },
      owns: () => false,
    });
    const heartbeat = unitHeartbeat(store, { sleep: createFakeSleep().sleep });

    expect(await heartbeat.renewNow()).toBe(false);
    expect(store.renewCalls).toBe(1);
    expect(store.ownershipChecks).toBe(1);
    expect(heartbeat.renewalFailureReason).toContain('ownership was lost');
    await heartbeat.stop();
  });

  it('a confirmed renewal moves the expiry the retry decision and the gate use', async () => {
    let nowMs = START_MS;
    const store = scriptedLeaseStore({
      renew: () => leaseAt('mission-runtime', 'lease_unit', nowMs + 60_000),
    });
    const heartbeat = new ObjectiveLeaseHeartbeat({
      store,
      clock: { now: () => new Date(nowMs).toISOString(), timestampMs: () => nowMs },
      missionId: 'mission_unit',
      objectiveId: 'objective_unit',
      lease: leaseAt('mission-runtime', 'lease_unit', START_MS + 1_000),
      ttlMs: 60_000,
      scheduler: createManualScheduler().scheduler,
      sleep: createFakeSleep().sleep,
    });
    expect(heartbeat.knownExpiresAtMs).toBe(START_MS + 1_000);

    nowMs = START_MS + 500;
    expect(await heartbeat.renewNow()).toBe(true);
    expect(heartbeat.knownExpiresAtMs).toBe(START_MS + 500 + 60_000);
    // The initiation gate still allows work: unexpired and still owned.
    expect(await heartbeat.ownershipRefusal('execute_plan')).toBeUndefined();
    await heartbeat.stop();
  });

  it('the initiation gate denies when the store no longer records this acquisition', async () => {
    const store = scriptedLeaseStore({
      renew: () => leaseAt('mission-runtime', 'lease_unit', START_MS + 60_000),
      owns: () => false, // healed, released or replaced by another attempt
    });
    const heartbeat = unitHeartbeat(store);

    const refusal = await heartbeat.ownershipRefusal('run_command');
    expect(refusal).toContain('no longer owns objective');
    expect(refusal).toContain('run_command was not initiated');
    expect(store.ownershipChecks).toBe(1); // an authoritative read, not a guess
    await heartbeat.stop();
  });

  it('the initiation gate ALLOWS work on an expired lease that nobody took (frozen LEASE-01 semantics)', async () => {
    // An expired-but-unreplaced lease still belongs to this execution, so its
    // own verification may finish; recovery is what ends an abandoned attempt.
    const store = scriptedLeaseStore({
      renew: () => undefined,
      owns: () => true,
    });
    const heartbeat = unitHeartbeat(store, { nowMs: START_MS + 600_000 });
    expect(await heartbeat.ownershipRefusal('verify_objective')).toBeUndefined();
    await heartbeat.stop();
  });
});

// ─────────────────────────────────────────────────────────────────────
// B · the controller harness
// ─────────────────────────────────────────────────────────────────────

interface HarnessOptions {
  store?: InMemoryMissionStore;
  workspaceLeases?: InMemoryWorkspaceLeaseStore;
  onPlan?: (h: Harness) => Promise<void> | void;
  onExecute?: (h: Harness) => Promise<void> | void;
  onVerify?: (h: Harness) => Promise<void> | void;
}

interface Harness {
  service: MissionControllerService;
  store: InMemoryMissionStore;
  clock: ClockPort;
  nowMs(): number;
  advance(ms: number): void;
  ticks: ReturnType<typeof createManualScheduler>;
  executions: string[];
  verifications: number;
  run(missionId: string): Promise<Mission>;
}

function harness(options: HarnessOptions = {}): Harness {
  let nowMs = START_MS;
  const store = options.store ?? new InMemoryMissionStore();
  const checkpointStore = new InMemoryCheckpointStore();
  const ticks = createManualScheduler();
  const executions: string[] = [];

  const clock: ClockPort = {
    now: () => new Date(nowMs).toISOString(),
    timestampMs: () => nowMs,
  };

  const h: Harness = {
    service: undefined as unknown as MissionControllerService,
    store,
    clock,
    nowMs: () => nowMs,
    advance: (ms: number) => {
      nowMs += ms;
    },
    ticks,
    executions,
    verifications: 0,
    run: (missionId: string) => h.service.runNextObjective(missionId),
  };

  h.service = new MissionControllerService({
    store,
    checkpointStore,
    objectiveSelector: new DeterministicObjectiveSelector(),
    providerAvailability: {
      getProviderStatus: async () => ({
        available: true,
        capableProviders: [
          { providerId: 'mock', modelId: 'mock-1', capabilities: [], healthy: true },
        ],
        unhealthyProviders: [],
      }),
    },
    goalUnderstanding: new SimpleGoalUnderstanding(),
    planner: {
      createPlan: async (goal: string) => {
        await options.onPlan?.(h);
        return {
          planId: 'plan_hardening_1',
          goalId: 'goal_hardening_1',
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
        await options.onExecute?.(h);
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
        h.verifications += 1;
        await options.onVerify?.(h);
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
    leaseTtlMs: DEFAULT_LEASE_TTL_MS,
    leaseRenewalScheduler: ticks.scheduler,
    leaseRenewalSleep: async () => undefined,
    ...(options.workspaceLeases ? { workspaceLeases: options.workspaceLeases } : {}),
  });
  return h;
}

async function createRunningMission(
  h: Harness,
  options: { objective?: string; workspace?: string } = {},
): Promise<Mission> {
  const mission = await h.service.createMission({
    userId: 'u1',
    title: 'Hardening mission',
    objective: 'Keep the lease and the workspace safe',
    initialObjectives: [options.objective ?? 'Do the work'],
    ...(options.workspace !== undefined ? { workspace: options.workspace } : {}),
  });
  await h.service.startMission(mission.missionId);
  return mission;
}

/** Replace the recorded lease: the objective is now owned by a NEW attempt. */
function replaceOwnership(mission: Mission, objectiveId: string): void {
  const objective = objectiveOf(mission, objectiveId);
  if (!objective) throw new Error('objective missing');
  objective.lease = leaseAt('mission-runtime', 'lease_replacement', START_MS + 600_000);
  objective.state = 'RUNNING';
  mission.updatedAt = new Date(START_MS).toISOString();
}

// ─────────────────────────────────────────────────────────────────────
// B · the ownership initiation gate
// ─────────────────────────────────────────────────────────────────────

describe('OWNERSHIP-01 · no workspace work is initiated without ownership', () => {
  it('refuses to START execution when ownership was taken during planning', async () => {
    const store = new InMemoryMissionStore();
    let missionId = '';
    let objectiveId = '';
    const h = harness({
      store,
      onPlan: () => {
        const current = store.getSync(missionId);
        if (current) {
          replaceOwnership(current, objectiveId);
          void store.save(current);
        }
      },
    });
    const mission = await createRunningMission(h);
    missionId = mission.missionId;
    objectiveId = (await store.get(mission.missionId))!.objectives[0]!.objectiveId;

    const result = await h.run(mission.missionId);

    expect(h.executions).toHaveLength(0); // nothing was started
    expect(objectiveOf(result, objectiveId)?.state).toBe('RUNNING'); // replacement's record
    expect(objectiveOf(result, objectiveId)?.lease?.token).toBe('lease_replacement');
    const lost = result.activity?.find((event) => event.kind === 'OBJECTIVE_LEASE_LOST');
    expect(lost).toBeDefined();
    expect(lost?.message).toContain('execute_plan was not initiated');
  });

  it('refuses to START verification (which may run commands) once ownership is lost', async () => {
    const store = new InMemoryMissionStore();
    let missionId = '';
    let objectiveId = '';
    const h = harness({
      store,
      onExecute: () => {
        const current = store.getSync(missionId);
        if (current) {
          replaceOwnership(current, objectiveId);
          void store.save(current);
        }
      },
    });
    const mission = await createRunningMission(h);
    missionId = mission.missionId;
    objectiveId = (await store.get(mission.missionId))!.objectives[0]!.objectiveId;

    const result = await h.run(missionId);

    expect(h.executions).toHaveLength(1); // execution was owned when it started
    expect(h.verifications).toBe(0); // verification never ran
    expect(objectiveOf(result, objectiveId)?.verifiedOutcome).toBeUndefined();
    const lost = result.activity?.find((event) => event.kind === 'OBJECTIVE_LEASE_LOST');
    expect(lost).toBeDefined();
    expect(lost?.message).toContain('verify_objective was not initiated');

    // The replacement owner's record is untouched.
    const stored = (await store.get(missionId))!;
    expect(objectiveOf(stored, objectiveId)?.state).toBe('RUNNING');
    expect(objectiveOf(stored, objectiveId)?.lease?.token).toBe('lease_replacement');
  });

  it('a stale worker cannot initiate after recovery healed and re-acquired the objective', async () => {
    const store = new InMemoryMissionStore();
    let missionId = '';
    let objectiveId = '';
    const h = harness({
      store,
      onPlan: async () => {
        const current = store.getSync(missionId);
        if (!current) return;
        objectiveOf(current, objectiveId)!.lease!.expiresAt = new Date(h.nowMs() - 1).toISOString();
        void store.save(current);
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

    const result = await h.run(missionId);

    expect(h.executions).toHaveLength(0);
    expect(objectiveOf(result, objectiveId)?.lease?.token).toBe('lease_replacement');
  });
});

// ─────────────────────────────────────────────────────────────────────
// C · cross-attempt workspace exclusion
// ─────────────────────────────────────────────────────────────────────

describe('WORKSPACE-01 · one live attempt per authorized workspace', () => {
  it('a second mission on the SAME workspace never executes concurrently', async () => {
    const store = new InMemoryMissionStore();
    const workspaceLeases = new InMemoryWorkspaceLeaseStore();
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let enteredResolve: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => {
      enteredResolve = resolve;
    });

    const first = harness({
      store,
      workspaceLeases,
      onExecute: async () => {
        enteredResolve?.();
        await firstGate;
      },
    });
    const second = harness({ store, workspaceLeases });

    const missionA = await createRunningMission(first, { objective: 'A', workspace: WORKSPACE });
    const attemptA = first.run(missionA.missionId);
    await entered; // A is inside the executor, holding the workspace lease

    const missionB = await createRunningMission(second, { objective: 'B', workspace: WORKSPACE });
    const resultB = await second.run(missionB.missionId);

    expect(second.executions).toHaveLength(0);
    expect(
      resultB.activity?.some(
        (event) =>
          event.kind === 'WORKSPACE_BUSY' && event.message.includes('never mutated concurrently'),
      ),
    ).toBe(true);
    // B never spent an objective lease: its objective is still startable.
    const storedB = (await store.get(missionB.missionId))!;
    expect(storedB.objectives[0]!.state).toBe('PENDING');

    releaseFirst?.();
    const finishedA = await attemptA;
    expect(objectiveOf(finishedA, finishedA.objectives[0]!.objectiveId)?.state).toBe('VERIFIED');

    // Once A released the workspace, B executes normally.
    await second.run(missionB.missionId);
    expect(second.executions).toHaveLength(1);
    expect((await store.get(missionB.missionId))!.objectives[0]!.state).toBe('VERIFIED');
  });

  it('missions on DIFFERENT workspaces are independent', async () => {
    const store = new InMemoryMissionStore();
    const workspaceLeases = new InMemoryWorkspaceLeaseStore();
    const first = harness({ store, workspaceLeases });
    const second = harness({ store, workspaceLeases });

    const missionA = await createRunningMission(first, { objective: 'A', workspace: '/ws/a' });
    const missionB = await createRunningMission(second, { objective: 'B', workspace: '/ws/b' });

    await first.run(missionA.missionId);
    await second.run(missionB.missionId);

    expect(first.executions).toHaveLength(1);
    expect(second.executions).toHaveLength(1);
  });

  it('normalizes the workspace key so equivalent paths are the SAME workspace', async () => {
    const store = new InMemoryMissionStore();
    const workspaceLeases = new InMemoryWorkspaceLeaseStore();
    let releaseFirst: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let enteredResolve: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => {
      enteredResolve = resolve;
    });
    const first = harness({
      store,
      workspaceLeases,
      onExecute: async () => {
        enteredResolve?.();
        await gate;
      },
    });
    const second = harness({ store, workspaceLeases });

    const missionA = await createRunningMission(first, {
      objective: 'A',
      workspace: '/authorized/workspace/',
    });
    const running = first.run(missionA.missionId);
    await entered;

    const missionB = await createRunningMission(second, {
      objective: 'B',
      workspace: '\\authorized\\workspace',
    });
    await second.run(missionB.missionId);
    expect(second.executions).toHaveLength(0);

    releaseFirst?.();
    await running;
    // Released: nothing keeps the workspace claimed after the attempt.
    expect(workspaceLeases.holderOf('/authorized/workspace')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// D · recovery after an ownership loss still heals honestly
// ─────────────────────────────────────────────────────────────────────

describe('RECOVERY · a stopped attempt leaves nothing stuck and claims nothing', () => {
  it('recovers the abandoned objective and a later attempt verifies it exactly once', async () => {
    const store = new InMemoryMissionStore();
    let missionId = '';
    let objectiveId = '';
    let replaced = false;
    const h = harness({
      store,
      onPlan: () => {
        if (replaced) return; // only the FIRST attempt loses ownership
        const current = store.getSync(missionId);
        if (!current) return;
        replaced = true;
        replaceOwnership(current, objectiveId);
        void store.save(current);
      },
    });
    const mission = await createRunningMission(h);
    missionId = mission.missionId;
    objectiveId = (await store.get(mission.missionId))!.objectives[0]!.objectiveId;

    const stopped = await h.run(missionId);
    expect(h.executions).toHaveLength(0);
    expect(stopped.activity?.some((event) => event.kind === 'OBJECTIVE_LEASE_LOST')).toBe(true);

    // The replacement owner's lease eventually expires; recovery heals it.
    const current = (await store.get(missionId))!;
    objectiveOf(current, objectiveId)!.lease!.expiresAt = new Date(h.nowMs() - 1).toISOString();
    void store.save(current);
    const healed = await h.service.recoverMission(missionId);
    expect(objectiveOf(healed, objectiveId)?.state).toBe('READY');
    expect(healed.activity?.some((event) => event.kind === 'RECOVERY_LEASE_EXPIRED')).toBe(true);

    // A fresh attempt now runs and verifies — exactly once.
    const verified = await h.run(missionId);
    expect(h.executions).toHaveLength(1);
    expect(h.verifications).toBe(1);
    expect(objectiveOf(verified, objectiveId)?.state).toBe('VERIFIED');
  });
});
