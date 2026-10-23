// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LEASE-03 · conditional whole-document writes
//
// The LEASE-02 release gate found that a few legitimate whole-document writes
// (the objective-start barrier, best-effort commands, checkpoint restoration and
// discovery insertion) still replayed a snapshot read BEFORE an `await`. A
// renewal, a re-acquisition, a verification or an operator cancellation that
// landed in between could therefore be reverted by the older copy.
//
// The fix is a CONDITIONAL replacement: the store compares the ownership-
// relevant facts of the authoritative row against the snapshot the caller read
// (state, history/activity lengths, update instant, every objective's state and
// lease identity) INSIDE the same transaction as the write. A stale copy is
// refused and the authoritative record is adopted.
//
// These tests drive the real interleavings and assert the AUTHORITATIVE final
// state (mission state, objective state, lease token/expiry, activity) — never
// merely that a method was called.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { MissionControllerService, DEFAULT_LEASE_TTL_MS, missionCasSnapshot } from '../index.js';
import type {
  Mission,
  MissionCheckpoint,
  MissionObjective,
  MissionObjectiveLease,
} from '../index.js';
import type { MissionStore, ObjectiveSelectionPort } from '../contracts/mission-ports.js';
import { DeterministicObjectiveSelector } from '../domain/objective-selector.js';
import { SimpleGoalUnderstanding } from '../domain/goal-understanding.js';
import { classifyFailure } from '../domain/mission-failure-classifier.js';
import { createIdGenerator } from '../infrastructure/IdGenerator.js';
import { InMemoryCheckpointStore } from '../infrastructure/InMemoryCheckpointStore.js';
import { InMemoryMissionStore } from '../infrastructure/InMemoryMissionStore.js';
import { createTestMission } from './fixtures.js';

const START_MS = 1_700_000_000_000;
const NOW = new Date(START_MS).toISOString();

function leaseOf(token: string, expiresMs = START_MS + DEFAULT_LEASE_TTL_MS) {
  return {
    owner: 'mission-runtime',
    token,
    acquiredAt: NOW,
    expiresAt: new Date(expiresMs).toISOString(),
  };
}

function objectiveOf(
  objectiveId: string,
  state: MissionObjective['state'],
  lease?: MissionObjectiveLease,
): MissionObjective {
  return {
    objectiveId,
    missionId: 'mission_lease03',
    title: 'Lease 03 objective',
    objective: 'Lease 03 objective',
    description: '',
    reason: 'LEASE-03 evidence',
    evidence: [],
    priority: 0,
    dependencies: [],
    estimatedComplexity: 'MEDIUM',
    estimatedCost: 0.01,
    state,
    stateHistory: [state],
    retryCount: 0,
    maxRetries: 3,
    createdAt: NOW,
    updatedAt: NOW,
    ...(lease ? { lease } : {}),
  };
}

function missionWith(
  objectives: MissionObjective[],
  state: Mission['state'] = 'RUNNING',
  updatedAt: string = new Date(START_MS - 600_000).toISOString(),
): Mission {
  return createTestMission({
    missionId: 'mission_lease03',
    state,
    stateHistory: ['CREATED', 'RUNNING'],
    objectives,
    updatedAt,
  });
}

/** Controller over a given store, with hooks for the exact interleaving. */
function makeService(options: {
  store: MissionStore;
  nowMs?: () => number;
  onExecute?: () => void | Promise<void>;
  objectiveSelector?: ObjectiveSelectionPort;
  providerAvailable?: boolean;
}): MissionControllerService {
  let calls = 0;
  return new MissionControllerService({
    store: options.store,
    checkpointStore: new InMemoryCheckpointStore(),
    objectiveSelector: options.objectiveSelector ?? new DeterministicObjectiveSelector(),
    providerAvailability: {
      getProviderStatus: async () => ({
        available: options.providerAvailable ?? true,
        capableProviders: [{ providerId: 'mock', modelId: 'm', capabilities: [], healthy: true }],
        unhealthyProviders: [],
      }),
    },
    goalUnderstanding: new SimpleGoalUnderstanding(),
    planner: {
      createPlan: async (goal: string) => ({
        planId: 'plan_lease03_1',
        goalId: 'goal_lease03_1',
        objective: goal,
        steps: [],
        finalVerification: {
          kind: 'command' as const,
          description: 'checks pass',
          command: { toolName: 'test', arguments: {}, expect: 'ok' as const },
        },
        completionCriteria: [],
      }),
    },
    executor: {
      executePlan: async () => {
        calls += 1;
        await options.onExecute?.();
        return {
          runId: `run_${String(calls)}`,
          success: true,
          verified: true,
          output: 'ok',
          usage: { tokens: 1, costUsd: 0.001, latencyMs: 1, toolCalls: 1 },
        };
      },
    },
    verifier: {
      verifyObjective: async () => ({
        verified: true,
        evidence: ['checks passed'],
        method: 'test',
      }),
    },
    executionMemory: { recordVerifiedOutcome: async () => undefined },
    experienceOptimization: {
      getAdvisorySignal: async () => ({ confidence: 0.5, evidenceCount: 0 }),
    },
    failureClassifier: {
      classify: async (error, result, status) => classifyFailure(error, result, status),
    },
    clock: {
      now: () => new Date(options.nowMs?.() ?? START_MS).toISOString(),
      timestampMs: () => options.nowMs?.() ?? START_MS,
    },
    idGenerator: createIdGenerator(),
    leaseTtlMs: DEFAULT_LEASE_TTL_MS,
    leaseRenewalScheduler: { schedule: () => undefined, cancel: () => undefined },
  });
}

function objectiveIn(mission: Mission | undefined, objectiveId: string) {
  return mission?.objectives.find((objective) => objective.objectiveId === objectiveId);
}

// ─────────────────────────────────────────────────────────────────────
// R1 · the objective-start barrier cannot resurrect a terminal decision
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-03 · R1 objective-start barrier is conditional', () => {
  it('a cancellation committed before the barrier is never overwritten and nothing executes', async () => {
    class CancelBeforeBarrierStore extends InMemoryMissionStore {
      private armed = false;
      constructor(private readonly onBarrier: () => Promise<void>) {
        super();
      }
      arm(): void {
        this.armed = true;
      }
      override async replaceMissionIfUnchanged(
        missionId: string,
        next: Mission,
        expected: ReturnType<typeof missionCasSnapshot>,
      ) {
        if (this.armed) {
          this.armed = false;
          await this.onBarrier();
        }
        return super.replaceMissionIfUnchanged(missionId, next, expected);
      }
    }

    let executions = 0;
    let missionId = '';
    const store = new CancelBeforeBarrierStore(async () => {
      // The operator cancels DURABLY after A acquired the objective and before
      // A writes its start barrier.
      await store.patchMission(missionId, {
        expectedState: 'RUNNING',
        state: 'CANCELLED',
        stateHistoryEntry: 'CANCELLED',
        outcome: 'CANCELLED',
        activity: [
          {
            id: 'act_cancel',
            at: new Date(START_MS).toISOString(),
            kind: 'MISSION_CANCELLED',
            message: 'RUNNING → CANCELLED',
          },
        ],
        at: new Date(START_MS).toISOString(),
      });
    });
    const service = makeService({
      store,
      onExecute: () => {
        executions += 1;
      },
    });

    const created = await service.createMission({
      userId: 'u1',
      title: 'Lease 03 barrier',
      objective: 'Lease 03 barrier',
      initialObjectives: ['Do the work'],
    });
    missionId = created.missionId;
    await service.startMission(missionId);
    store.arm();

    const result = await service.runNextObjective(missionId);

    expect(executions).toBe(0);
    expect(result.state).toBe('CANCELLED');
    const stored = (await store.get(missionId))!;
    expect(stored.state).toBe('CANCELLED');
    expect(stored.stateHistory.at(-1)).toBe('CANCELLED');
    // The cancellation trail and the lease decision are intact.
    expect(stored.activity?.some((event) => event.kind === 'MISSION_CANCELLED')).toBe(true);
    expect(stored.objectives[0]?.state).toBe('RUNNING'); // acquired, never executed
    expect(stored.objectives[0]?.verifiedOutcome).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// R2 · commands / watchdog / provider recovery never write stale snapshots
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-03 · R2 conditional commands', () => {
  it('pause adopts the authoritative record and never reverts a renewal that landed after its read', async () => {
    class RenewAfterReadStore extends InMemoryMissionStore {
      renewOnRead: { objectiveId: string; expiresAt: string; nowMs: number } | undefined;
      override async get(missionId: string) {
        const snapshot = await super.get(missionId);
        const renewal = this.renewOnRead;
        this.renewOnRead = undefined;
        if (renewal) {
          await this.renewObjectiveLease(missionId, renewal.objectiveId, {
            owner: 'mission-runtime',
            token: 'lease_1',
            nowMs: renewal.nowMs,
            expiresAt: renewal.expiresAt,
          });
        }
        return snapshot;
      }
    }

    const nowMs = START_MS + 10_000;
    const store = new RenewAfterReadStore();
    await store.saveRequired(
      missionWith([objectiveOf('obj_1', 'RUNNING', leaseOf('lease_1', START_MS + 60_000))]),
    );
    const service = makeService({ store, nowMs: () => nowMs });

    // A heartbeat renews AFTER pauseMission read the mission, BEFORE its write.
    store.renewOnRead = {
      objectiveId: 'obj_1',
      nowMs,
      expiresAt: new Date(START_MS + 120_000).toISOString(),
    };

    const paused = await service.pauseMission('mission_lease03');

    expect(paused.state).toBe('PAUSED');
    const stored = (await store.get('mission_lease03'))!;
    expect(stored.state).toBe('PAUSED');
    // The retry re-derived the command on the authoritative record…
    expect(stored.stateHistory.filter((state) => state === 'PAUSED')).toHaveLength(1);
    // …and the RENEWED expiration survived it.
    expect(objectiveIn(stored, 'obj_1')?.lease?.expiresAt).toBe(
      new Date(START_MS + 120_000).toISOString(),
    );
    expect(objectiveIn(stored, 'obj_1')?.state).toBe('RUNNING');
  });

  it('a watchdog BLOCK cannot overwrite a cancellation that landed after its read', async () => {
    class CancelAfterReadStore extends InMemoryMissionStore {
      cancelOnRead = false;
      override async get(missionId: string) {
        const snapshot = await super.get(missionId);
        if (this.cancelOnRead) {
          this.cancelOnRead = false;
          await this.patchMission(missionId, {
            expectedState: 'RUNNING',
            state: 'CANCELLED',
            stateHistoryEntry: 'CANCELLED',
            outcome: 'CANCELLED',
            activity: [
              {
                id: 'act_cancel',
                at: new Date(START_MS).toISOString(),
                kind: 'MISSION_CANCELLED',
                message: 'RUNNING → CANCELLED',
              },
            ],
            at: new Date(START_MS).toISOString(),
          });
        }
        return snapshot;
      }
    }

    const store = new CancelAfterReadStore();
    // RUNNING, no live lease, stale update instant: the watchdog's trigger.
    await store.saveRequired(
      missionWith([objectiveOf('obj_1', 'RUNNING', leaseOf('lease_1', START_MS - 10_000))]),
    );
    const service = makeService({ store, nowMs: () => START_MS });

    store.cancelOnRead = true;
    const result = await service.detectStuckMission('mission_lease03', 1_000);

    expect(result?.state).toBe('CANCELLED');
    const stored = (await store.get('mission_lease03'))!;
    expect(stored.state).toBe('CANCELLED');
    expect(stored.activity?.some((event) => event.kind === 'MISSION_BLOCKED')).toBe(false);
    expect(stored.activity?.some((event) => event.kind === 'MISSION_CANCELLED')).toBe(true);
  });

  it('a watchdog BLOCK cannot block a mission whose lease was RENEWED after its read', async () => {
    class RenewBeforeBarrierStore extends InMemoryMissionStore {
      private armed = false;
      arm(): void {
        this.armed = true;
      }
      override async replaceMissionIfUnchanged(
        missionId: string,
        next: Mission,
        expected: ReturnType<typeof missionCasSnapshot>,
      ) {
        if (this.armed) {
          this.armed = false;
          // A heartbeat renews the lease just before the watchdog's write. Its
          // own clock is STILL INSIDE the old expiration, so the renewal is
          // legitimate — while the watchdog (whose read predates it) still sees
          // an abandoned objective.
          await this.renewObjectiveLease(missionId, 'obj_1', {
            owner: 'mission-runtime',
            token: 'lease_1',
            nowMs: START_MS - 2_000,
            expiresAt: new Date(START_MS + 120_000).toISOString(),
          });
        }
        return super.replaceMissionIfUnchanged(missionId, next, expected);
      }
    }

    const store = new RenewBeforeBarrierStore();
    // Expired at the watchdog's instant, stale update instant: the trigger.
    await store.saveRequired(
      missionWith([objectiveOf('obj_1', 'RUNNING', leaseOf('lease_1', START_MS - 1_000))]),
    );
    const service = makeService({ store, nowMs: () => START_MS });

    store.arm();
    const result = await service.detectStuckMission('mission_lease03', 1_000);

    // The watchdog honestly reports that it did NOT transition the mission.
    expect(result).toBeUndefined();
    const stored = (await store.get('mission_lease03'))!;
    expect(stored.state).toBe('RUNNING');
    expect(stored.stateHistory.at(-1)).toBe('RUNNING');
    // The RENEWED expiration survives (a re-derived BLOCK would have blocked a
    // mission a real owner is executing).
    expect(objectiveIn(stored, 'obj_1')?.state).toBe('RUNNING');
    expect(objectiveIn(stored, 'obj_1')?.lease?.expiresAt).toBe(
      new Date(START_MS + 120_000).toISOString(),
    );
    expect((stored.activity ?? []).some((event) => event.kind === 'MISSION_BLOCKED')).toBe(false);
  });

  it('a blocked-dependency BLOCK cannot block an objective another worker just acquired', async () => {
    class AcquireBeforeBlockStore extends InMemoryMissionStore {
      private armed = false;
      arm(): void {
        this.armed = true;
      }
      override async replaceMissionIfUnchanged(
        missionId: string,
        next: Mission,
        expected: ReturnType<typeof missionCasSnapshot>,
      ) {
        if (this.armed) {
          this.armed = false;
          // Another worker acquires an objective while this pass decides there
          // is nothing selectable.
          await this.acquireObjectiveLease(missionId, 'obj_2', {
            owner: 'mission-runtime',
            token: 'lease_other',
            acquiredAt: NOW,
            expiresAt: new Date(START_MS + DEFAULT_LEASE_TTL_MS).toISOString(),
          });
        }
        return super.replaceMissionIfUnchanged(missionId, next, expected);
      }
    }

    const blockedA = objectiveOf('obj_1', 'PENDING');
    blockedA.dependencies = ['obj_missing'];
    const blockedB = objectiveOf('obj_2', 'PENDING');
    blockedB.dependencies = ['obj_missing'];
    // Both objectives are blocked, so the selector selects nothing…
    const store = new AcquireBeforeBlockStore();
    await store.saveRequired(missionWith([blockedA, blockedB]));
    const service = makeService({ store, nowMs: () => START_MS });

    store.arm();
    const result = await service.runNextObjective('mission_lease03');

    // …but the mission is NOT blocked underneath the new owner.
    expect(result.state).toBe('RUNNING');
    const stored = (await store.get('mission_lease03'))!;
    expect(stored.state).toBe('RUNNING');
    expect(objectiveIn(stored, 'obj_2')?.state).toBe('RUNNING');
    expect(objectiveIn(stored, 'obj_2')?.lease?.token).toBe('lease_other');
    expect((stored.activity ?? []).some((event) => event.kind === 'MISSION_BLOCKED')).toBe(false);
  });

  it('a budget-exhausted FAIL cannot fail a mission another worker just acquired', async () => {
    class AcquireBeforeFailStore extends InMemoryMissionStore {
      private armed = false;
      arm(): void {
        this.armed = true;
      }
      override async patchMission(
        missionId: string,
        patch: Parameters<InMemoryMissionStore['patchMission']>[1],
      ) {
        if (this.armed) {
          this.armed = false;
          await this.acquireObjectiveLease(missionId, 'obj_1', {
            owner: 'mission-runtime',
            token: 'lease_other',
            acquiredAt: NOW,
            expiresAt: new Date(START_MS + DEFAULT_LEASE_TTL_MS).toISOString(),
          });
        }
        return super.patchMission(missionId, patch);
      }
    }

    const store = new AcquireBeforeFailStore();
    const mission = missionWith([objectiveOf('obj_1', 'PENDING')]);
    // The budget ceiling is already reached: the next pass would FAIL.
    mission.budgetUsage.actionsExecuted = mission.budget.maxActions;
    await store.saveRequired(mission);
    const service = makeService({ store, nowMs: () => START_MS });

    store.arm();
    const result = await service.runNextObjective('mission_lease03');

    expect(result.state).toBe('RUNNING');
    const stored = (await store.get('mission_lease03'))!;
    expect(stored.state).toBe('RUNNING');
    expect(stored.outcome).toBeUndefined();
    expect(objectiveIn(stored, 'obj_1')?.state).toBe('RUNNING');
    expect(objectiveIn(stored, 'obj_1')?.lease?.token).toBe('lease_other');
    expect((stored.activity ?? []).some((event) => event.kind === 'MISSION_FAILED')).toBe(false);
  });

  it('provider recovery cannot resurrect a mission cancelled while it checked availability', async () => {
    class CancelAfterReadStore extends InMemoryMissionStore {
      cancelOnRead = false;
      override async get(missionId: string) {
        const snapshot = await super.get(missionId);
        if (this.cancelOnRead) {
          this.cancelOnRead = false;
          await this.patchMission(missionId, {
            expectedState: 'WAITING_FOR_PROVIDER',
            state: 'CANCELLED',
            stateHistoryEntry: 'CANCELLED',
            outcome: 'CANCELLED',
            activity: [
              {
                id: 'act_cancel_provider',
                at: new Date(START_MS).toISOString(),
                kind: 'MISSION_CANCELLED',
                message: 'WAITING_FOR_PROVIDER → CANCELLED',
              },
            ],
            at: new Date(START_MS).toISOString(),
          });
        }
        return snapshot;
      }
    }

    const store = new CancelAfterReadStore();
    await store.saveRequired(
      missionWith([objectiveOf('obj_1', 'PENDING')], 'WAITING_FOR_PROVIDER'),
    );
    const service = makeService({ store, nowMs: () => START_MS, providerAvailable: true });

    store.cancelOnRead = true;
    const recovered = await service.recoverMission('mission_lease03');

    // R7 — the authoritative record is returned, not the stale snapshot.
    expect(recovered.state).toBe('CANCELLED');
    const stored = (await store.get('mission_lease03'))!;
    expect(stored.state).toBe('CANCELLED');
    expect(stored.stateHistory.at(-1)).toBe('CANCELLED');
  });

  it('a pause committed during execution survives the objective result', async () => {
    const store = new InMemoryMissionStore();
    let missionId = '';
    const service = makeService({
      store,
      onExecute: async () => {
        await service.pauseMission(missionId);
      },
    });

    const created = await service.createMission({
      userId: 'u1',
      title: 'Pause race',
      objective: 'Pause race',
      initialObjectives: ['Do the work'],
    });
    missionId = created.missionId;
    await service.startMission(missionId);

    const result = await service.runNextObjective(missionId);

    const stored = (await store.get(missionId))!;
    expect(stored.state).toBe('PAUSED'); // never reopened by the late result
    expect(stored.objectives[0]?.state).toBe('VERIFIED');
    expect(stored.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    expect(result.state).toBe('PAUSED');
  });

  it('a refused command is reported as NOT applied (never a fabricated success)', async () => {
    class RacingStore extends InMemoryMissionStore {
      override async replaceMissionIfUnchanged(
        missionId: string,
        next: Mission,
        expected: ReturnType<typeof missionCasSnapshot>,
      ) {
        // Simulate an unrelated commit by another process before every attempt.
        await this.patchMission(missionId, {
          expectedState: expected.state,
          state: expected.state,
          activity: [
            {
              id: `act_race_${String(expected.activityLength)}`,
              at: new Date(START_MS).toISOString(),
              kind: 'OTHER_WORKER',
              message: 'moved on',
            },
          ],
          at: new Date(START_MS).toISOString(),
        });
        return super.replaceMissionIfUnchanged(missionId, next, expected);
      }
    }
    const store = new RacingStore();
    await store.saveRequired(missionWith([objectiveOf('obj_1', 'PENDING')]));
    const service = makeService({ store, nowMs: () => START_MS });

    const paused = await service.pauseMission('mission_lease03');
    // Both attempts were refused, so the command is NOT claimed as applied.
    expect(paused.state).toBe('RUNNING');
    expect(paused.stateHistory).not.toContain('PAUSED');
  });
});

// ─────────────────────────────────────────────────────────────────────
// R3 · checkpoint restoration is conditional
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-03 · R3 conditional checkpoint restore', () => {
  it('a renewal of ANOTHER objective that lands after the snapshot survives (restore refused)', async () => {
    class RenewAfterReadStore extends InMemoryMissionStore {
      renewOnRead = false;
      override async get(missionId: string) {
        const snapshot = await super.get(missionId);
        if (this.renewOnRead) {
          this.renewOnRead = false;
          await this.renewObjectiveLease(missionId, 'obj_live', {
            owner: 'mission-runtime',
            token: 'lease_live',
            nowMs: START_MS + 1_000,
            expiresAt: new Date(START_MS + 200_000).toISOString(),
          });
        }
        return snapshot;
      }
    }

    const store = new RenewAfterReadStore();
    const checkpointStore = new InMemoryCheckpointStore();
    await store.saveRequired(
      missionWith([
        objectiveOf('obj_done', 'PENDING'),
        objectiveOf('obj_live', 'RUNNING', leaseOf('lease_live', START_MS + 60_000)),
      ]),
    );
    const checkpoint: MissionCheckpoint = {
      checkpointId: 'checkpoint_lease03',
      missionId: 'mission_lease03',
      objectiveId: 'obj_done',
      state: 'VERIFIED',
      verifiedOutcome: {
        achieved: true,
        evidence: ['done'],
        verifiedAt: NOW,
      },
      completedWork: ['done'],
      remainingWork: [],
      failures: [],
      recoveryHistory: [],
      learningReferences: [],
      experienceReferences: [],
      budgetRemaining: { objectives: 1, actions: 10, runtimeMs: 1_000, tokens: 1_000, costUsd: 1 },
      timestamp: NOW,
    };
    await checkpointStore.save(checkpoint);

    const service = new MissionControllerService({
      store,
      checkpointStore,
      objectiveSelector: new DeterministicObjectiveSelector(),
      providerAvailability: {
        getProviderStatus: async () => ({
          available: true,
          capableProviders: [],
          unhealthyProviders: [],
        }),
      },
      goalUnderstanding: new SimpleGoalUnderstanding(),
      planner: {
        createPlan: async (goal: string) => ({
          planId: 'plan_lease03_restore',
          goalId: 'goal_lease03_restore',
          objective: goal,
          steps: [],
          finalVerification: {
            kind: 'command' as const,
            description: 'noop',
            command: { toolName: 'test', arguments: {}, expect: 'ok' as const },
          },
          completionCriteria: [],
        }),
      },
      executor: {
        executePlan: async () => ({
          runId: 'run_restore',
          success: true,
          verified: true,
          output: 'ok',
          usage: { tokens: 1, costUsd: 0.001, latencyMs: 1, toolCalls: 1 },
        }),
      },
      verifier: {
        verifyObjective: async () => ({ verified: true, evidence: ['ok'], method: 'test' }),
      },
      executionMemory: { recordVerifiedOutcome: async () => undefined },
      experienceOptimization: {
        getAdvisorySignal: async () => ({ confidence: 0.5, evidenceCount: 0 }),
      },
      failureClassifier: {
        classify: async (error, result, status) => classifyFailure(error, result, status),
      },
      clock: { now: () => new Date(START_MS).toISOString(), timestampMs: () => START_MS },
      idGenerator: createIdGenerator(),
      leaseTtlMs: DEFAULT_LEASE_TTL_MS,
      leaseRenewalScheduler: { schedule: () => undefined, cancel: () => undefined },
    });

    store.renewOnRead = true;
    const resumed = await service.resumeFromCheckpoint('mission_lease03');

    const stored = (await store.get('mission_lease03'))!;
    // The restoration was refused — no false verified result was promoted…
    expect(objectiveIn(stored, 'obj_done')?.state).toBe('PENDING');
    expect(stored.activity?.some((event) => event.kind === 'CHECKPOINT_RESTORED')).toBeUndefined();
    expect(stored.budgetUsage.objectivesCompleted).toBe(0);
    // …and the other objective's RENEWAL survived.
    expect(objectiveIn(stored, 'obj_live')?.lease?.expiresAt).toBe(
      new Date(START_MS + 200_000).toISOString(),
    );
    expect(objectiveIn(stored, 'obj_live')?.state).toBe('RUNNING');
    // The mission was not falsely completed either.
    expect(resumed.state).not.toBe('COMPLETED');
  });
});

// ─────────────────────────────────────────────────────────────────────
// R4 · discovery insertion is conditional and idempotent
// ─────────────────────────────────────────────────────────────────────

const DISCOVERED = {
  selected: true as const,
  discoveredObjective: { title: 'Discovered work', objective: 'Discovered work' },
  reason: 'discovered',
  evidence: [],
  priority: 0,
};

function alwaysDiscoveringSelector(): ObjectiveSelectionPort {
  // A FRESH result per call: the controller annotates `selectionResult` with
  // the id it created, so a shared object would leak that id into the next run.
  return {
    selectNextObjective: async () => ({
      selected: true as const,
      discoveredObjective: {
        title: DISCOVERED.discoveredObjective.title,
        objective: DISCOVERED.discoveredObjective.objective,
      },
      reason: DISCOVERED.reason,
      evidence: [],
      priority: 0,
    }),
  };
}

describe('LEASE-03 · R4 conditional discovery', () => {
  it('a cancellation committed while discovery runs is not overwritten (nothing is inserted or executed)', async () => {
    class CancelAfterReadStore extends InMemoryMissionStore {
      cancelOnRead = false;
      override async get(missionId: string) {
        const snapshot = await super.get(missionId);
        if (this.cancelOnRead) {
          this.cancelOnRead = false;
          await this.patchMission(missionId, {
            expectedState: 'RUNNING',
            state: 'CANCELLED',
            outcome: 'CANCELLED',
            at: new Date(START_MS).toISOString(),
          });
        }
        return snapshot;
      }
    }

    let executions = 0;
    const store = new CancelAfterReadStore();
    const service = makeService({
      store,
      nowMs: () => START_MS,
      objectiveSelector: alwaysDiscoveringSelector(),
      onExecute: () => {
        executions += 1;
      },
    });
    const created = await service.createMission({
      userId: 'u1',
      title: 'Discovery race',
      objective: 'Discovery race',
      initialObjectives: ['Seed objective'],
    });
    await service.startMission(created.missionId);

    store.cancelOnRead = true;
    const result = await service.runNextObjective(created.missionId);

    expect(result.state).toBe('CANCELLED');
    const stored = (await store.get(created.missionId))!;
    expect(stored.state).toBe('CANCELLED');
    expect(
      stored.objectives.filter((objective) => objective.title === 'Discovered work'),
    ).toHaveLength(0);
    expect(executions).toBe(0);
  });

  it('the same discovered work is inserted ONCE across repeated attempts', async () => {
    const store = new InMemoryMissionStore();
    const service = makeService({
      store,
      nowMs: () => START_MS,
      objectiveSelector: alwaysDiscoveringSelector(),
    });
    const created = await service.createMission({
      userId: 'u1',
      title: 'Discovery dedupe',
      objective: 'Discovery dedupe',
      initialObjectives: ['Seed objective'],
    });
    await service.startMission(created.missionId);

    await service.runNextObjective(created.missionId);
    await service.runNextObjective(created.missionId);

    const stored = (await store.get(created.missionId))!;
    expect(
      stored.objectives.filter((objective) => objective.title === 'Discovered work'),
    ).toHaveLength(1);
  });

  it('a refused lease acquisition leaves the mission authoritative and executes nothing', async () => {
    class RefusingAcquireStore extends InMemoryMissionStore {
      override async acquireObjectiveLease(): Promise<Mission | undefined> {
        return undefined;
      }
    }
    let executions = 0;
    const store = new RefusingAcquireStore();
    const service = makeService({
      store,
      nowMs: () => START_MS,
      onExecute: () => {
        executions += 1;
      },
    });
    const created = await service.createMission({
      userId: 'u1',
      title: 'Acquire refusal',
      objective: 'Acquire refusal',
      initialObjectives: ['Do the work'],
    });
    await service.startMission(created.missionId);

    const result = await service.runNextObjective(created.missionId);

    expect(executions).toBe(0);
    const stored = (await store.get(created.missionId))!;
    expect(stored.objectives[0]?.state).toBe('PENDING');
    expect(stored.objectives[0]?.lease).toBeUndefined();
    expect(result.state).toBe('RUNNING');
  });
});

// ─────────────────────────────────────────────────────────────────────
// R6 · terminal missions are never mutated by recovery, at the store level
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-03 · R6 terminal protection is inside the atomic operation', () => {
  it('healing, recovery changes and acquisition all refuse a terminal mission', async () => {
    const store = new InMemoryMissionStore();
    const expired = leaseOf('lease_dead', START_MS - 1_000);
    await store.saveRequired(
      missionWith(
        [objectiveOf('obj_running', 'RUNNING', expired), objectiveOf('obj_pending', 'PENDING')],
        'CANCELLED',
      ),
    );

    expect(
      await store.releaseExpiredObjectiveLease('mission_lease03', 'obj_running', {
        nowMs: START_MS,
        failureReason: 'expired',
      }),
    ).toBeUndefined();

    const changes = await store.applyRecoveryChanges(
      'mission_lease03',
      [
        {
          objectiveId: 'obj_running',
          expected: {
            state: 'RUNNING',
            leaseToken: 'lease_dead',
            leaseExpiresAt: expired.expiresAt,
          },
          state: 'READY',
          failureReason: 'healed',
        },
      ],
      { nowMs: START_MS },
    );
    expect(changes?.applied).toEqual([]);
    expect(changes?.skipped).toEqual(['obj_running']);

    expect(
      await store.acquireObjectiveLease(
        'mission_lease03',
        'obj_pending',
        leaseOf('lease_new') as NonNullable<MissionObjectiveLease>,
      ),
    ).toBeUndefined();

    const stored = (await store.get('mission_lease03'))!;
    expect(stored.state).toBe('CANCELLED');
    expect(objectiveIn(stored, 'obj_running')?.state).toBe('RUNNING');
    expect(objectiveIn(stored, 'obj_running')?.lease?.token).toBe('lease_dead');
    expect(objectiveIn(stored, 'obj_pending')?.state).toBe('PENDING');
    expect(stored.activity ?? []).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Store primitive · conditional replacement
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-03 · replaceMissionIfUnchanged', () => {
  it('refuses a stale snapshot, returns the authority, and applies against a fresh one', async () => {
    const store = new InMemoryMissionStore();
    await store.saveRequired(
      missionWith([objectiveOf('obj_1', 'RUNNING', leaseOf('lease_1', START_MS + 60_000))]),
    );
    const snapshot = (await store.get('mission_lease03'))!;
    const baseline = missionCasSnapshot(snapshot);

    // A renewal lands after the snapshot was taken.
    await store.renewObjectiveLease('mission_lease03', 'obj_1', {
      owner: 'mission-runtime',
      token: 'lease_1',
      nowMs: START_MS + 1_000,
      expiresAt: new Date(START_MS + 120_000).toISOString(),
    });

    const stale = await store.replaceMissionIfUnchanged(
      'mission_lease03',
      {
        ...snapshot,
        state: 'PAUSED',
      },
      baseline,
    );
    expect(stale?.applied).toBe(false);
    expect(objectiveIn(stale?.mission, 'obj_1')?.lease?.expiresAt).toBe(
      new Date(START_MS + 120_000).toISOString(),
    );
    expect((await store.get('mission_lease03'))?.state).toBe('RUNNING');

    const fresh = (await store.get('mission_lease03'))!;
    const applied = await store.replaceMissionIfUnchanged(
      'mission_lease03',
      {
        ...fresh,
        state: 'PAUSED',
        stateHistory: [...fresh.stateHistory, 'PAUSED'],
      },
      missionCasSnapshot(fresh),
    );
    expect(applied?.applied).toBe(true);
    expect((await store.get('mission_lease03'))?.state).toBe('PAUSED');
    // The renewal survived the legitimate replacement too.
    expect(objectiveIn(applied?.mission, 'obj_1')?.lease?.expiresAt).toBe(
      new Date(START_MS + 120_000).toISOString(),
    );
  });
});
