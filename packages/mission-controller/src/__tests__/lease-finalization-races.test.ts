// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LEASE-02 · atomic finalization & recovery publication races
//
// The LEASE-01 audit found two P1 races that a renewable lease ALONE does not
// close:
//
//   P1-1  finalization was CHECK-THEN-WRITE. A worker passed the ownership
//         check, then awaited its checkpoint/evidence writes; in that window
//         recovery healed its lease and another execution acquired the
//         objective. The worker's later whole-document write silently replaced
//         the new owner's lease and state.
//   P1-2  recovery healed a lease and then saved the WHOLE document it had read
//         at the start, reverting a renewal or a fresh acquisition that landed
//         in between.
//
// The fix is one store operation per concern (`finalizeObjectiveIfLeaseOwner`,
// `applyRecoveryChanges`) that validates ownership IN THE SAME atomic step that
// writes. These tests drive the real interleavings and assert the AUTHORITATIVE
// final state and token ownership — never merely that a method was called.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  MissionControllerService,
  DEFAULT_LEASE_TTL_MS,
} from '../application/MissionControllerService.js';
import { ObjectiveLeaseHeartbeat } from '../domain/objective-lease-heartbeat.js';
import { InMemoryMissionStore } from '../infrastructure/InMemoryMissionStore.js';
import { InMemoryCheckpointStore } from '../infrastructure/InMemoryCheckpointStore.js';
import { createIdGenerator } from '../infrastructure/IdGenerator.js';
import { DeterministicObjectiveSelector } from '../domain/objective-selector.js';
import { SimpleGoalUnderstanding } from '../domain/goal-understanding.js';
import { classifyFailure } from '../domain/mission-failure-classifier.js';
import { createTestMission } from './fixtures.js';
import type { ClockPort, MissionStore } from '../contracts/mission-ports.js';
import type {
  Mission,
  MissionCheckpoint,
  MissionObjective,
  MissionObjectiveLease,
} from '../types/mission-types.js';

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
    missionId: 'mission_race',
    title: 'Race objective',
    objective: 'Race objective',
    description: '',
    reason: 'LEASE-02 evidence',
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

function missionWith(objectives: MissionObjective[]): Mission {
  return createTestMission({
    missionId: 'mission_race',
    state: 'RUNNING',
    stateHistory: ['CREATED', 'RUNNING'],
    objectives,
  });
}

// ─────────────────────────────────────────────────────────────────────
// A · worker A passes the check, B heals + re-acquires, A finalizes
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-02 · P1-1 atomic objective finalization', () => {
  it('A: a superseded execution cannot publish over the new owner (store level)', async () => {
    const store = new InMemoryMissionStore();
    await store.saveRequired(missionWith([objectiveOf('obj_1', 'READY')]));

    await store.acquireObjectiveLease(
      'mission_race',
      'obj_1',
      leaseOf('lease_A', START_MS + 1_000),
    );
    // A's lease expires while A is still working; recovery heals it and B wins
    // the objective under a NEW fencing token.
    const healed = await store.releaseExpiredObjectiveLease('mission_race', 'obj_1', {
      nowMs: START_MS + 61_000,
      failureReason: 'expired',
    });
    expect(healed?.objectives[0]?.state).toBe('READY');
    await store.acquireObjectiveLease(
      'mission_race',
      'obj_1',
      leaseOf('lease_B', START_MS + 120_000),
    );

    // A now tries to acknowledge its finished work with its stale token.
    const intended: MissionObjective = {
      ...objectiveOf('obj_1', 'VERIFIED'),
      verifiedOutcome: {
        achieved: true,
        evidence: ['A: checks passed'],
        verifiedAt: new Date(START_MS + 62_000).toISOString(),
      },
      executionRunId: 'run_A',
    };
    const refused = await store.finalizeObjectiveIfLeaseOwner(
      'mission_race',
      'obj_1',
      { owner: 'mission-runtime', token: 'lease_A' },
      { objective: intended, leaseToken: 'lease_A', at: new Date(START_MS + 62_000).toISOString() },
    );

    expect(refused?.applied).toBe(false);
    const stored = (await store.get('mission_race'))!;
    // B's OWNERSHIP and state are untouched; A's evidence never landed.
    expect(stored.objectives[0]?.state).toBe('RUNNING');
    expect(stored.objectives[0]?.lease?.token).toBe('lease_B');
    expect(stored.objectives[0]?.verifiedOutcome).toBeUndefined();
    expect(stored.objectives[0]?.finalizedByLeaseToken).toBeUndefined();
    // The refusal returns the AUTHORITATIVE record, not A's snapshot.
    expect(refused?.mission.objectives[0]?.lease?.token).toBe('lease_B');
  });

  it('A: a worker whose lease is replaced between verification and the result write cannot finalize (controller)', async () => {
    const store = new InMemoryMissionStore();
    const checkpointStore = new InMemoryCheckpointStore();
    let nowMs = START_MS;
    const clock: ClockPort = {
      now: () => new Date(nowMs).toISOString(),
      timestampMs: () => nowMs,
    };
    let missionId = '';
    let objectiveId = '';

    const service = new MissionControllerService({
      store,
      checkpointStore,
      objectiveSelector: new DeterministicObjectiveSelector(),
      providerAvailability: {
        getProviderStatus: async () => ({
          available: true,
          capableProviders: [{ providerId: 'mock', modelId: 'm', capabilities: [], healthy: true }],
          unhealthyProviders: [],
        }),
      },
      goalUnderstanding: new SimpleGoalUnderstanding(),
      planner: {
        createPlan: async (goal: string) => ({
          planId: 'plan_race_1',
          goalId: 'goal_race_1',
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
        executePlan: async () => ({
          runId: 'run_worker_A',
          success: true,
          verified: true,
          output: 'ok',
          usage: { tokens: 1, costUsd: 0.001, latencyMs: 1, toolCalls: 1 },
        }),
      },
      verifier: {
        verifyObjective: async () => {
          // The exact P1-1 window: ownership was validated BEFORE verification
          // and B replaces the lease while the evidence writes are pending.
          const current = (await store.get(missionId))!;
          current.objectives[0]!.lease!.expiresAt = new Date(nowMs - 1).toISOString();
          await store.save(current);
          await store.releaseExpiredObjectiveLease(missionId, objectiveId, {
            nowMs,
            failureReason: 'expired',
          });
          await store.acquireObjectiveLease(missionId, objectiveId, {
            owner: 'mission-runtime',
            token: 'lease_B',
            acquiredAt: new Date(nowMs).toISOString(),
            expiresAt: new Date(nowMs + DEFAULT_LEASE_TTL_MS).toISOString(),
          });
          return { verified: true, evidence: ['A: checks passed'], method: 'test' };
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
      leaseRenewalScheduler: { schedule: () => undefined, cancel: () => undefined },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Race mission',
      objective: 'Race',
      initialObjectives: ['Do the work'],
    });
    missionId = mission.missionId;
    objectiveId = (await store.get(missionId))!.objectives[0]!.objectiveId;
    await service.startMission(missionId);

    const result = await service.runNextObjective(missionId);

    const stored = (await store.get(missionId))!;
    // A never acknowledged anything: B still owns the objective.
    expect(stored.objectives[0]?.state).toBe('RUNNING');
    expect(stored.objectives[0]?.lease?.token).toBe('lease_B');
    expect(stored.objectives[0]?.verifiedOutcome).toBeUndefined();
    // The loss is reported, never fabricated into success.
    expect(result.objectives[0]?.verifiedOutcome).toBeUndefined();
    expect(stored.activity?.some((event) => event.kind === 'OBJECTIVE_LEASE_LOST')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B · recovery heals, another worker re-acquires before publication
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-02 · P1-2 atomic recovery publication', () => {
  it('B: a re-acquisition that lands after healing survives the recovery publication', async () => {
    class ReacquiringStore extends InMemoryMissionStore {
      reacquired = false;

      override async releaseExpiredObjectiveLease(
        missionId: string,
        objectiveId: string,
        options: { nowMs: number; failureReason: string },
      ): Promise<Mission | undefined> {
        const healed = await super.releaseExpiredObjectiveLease(missionId, objectiveId, options);
        if (healed && !this.reacquired) {
          this.reacquired = true;
          // Another worker acquires the healed objective while the recovery
          // pass is still holding the snapshot it read at the start.
          await this.acquireObjectiveLease(missionId, objectiveId, {
            owner: 'mission-runtime',
            token: 'lease_reacquired',
            acquiredAt: new Date(options.nowMs).toISOString(),
            expiresAt: new Date(options.nowMs + DEFAULT_LEASE_TTL_MS).toISOString(),
          });
        }
        return healed;
      }
    }

    const store = new ReacquiringStore();
    let nowMs = START_MS;
    const service = baseService({ store, clock: () => nowMs });

    const mission = missionWith([
      objectiveOf('obj_1', 'RUNNING', leaseOf('lease_dead', START_MS + 1_000)),
    ]);
    await store.saveRequired(mission);
    nowMs = START_MS + 61_000;

    const recovered = await service.recoverMission(mission.missionId);
    expect(store.reacquired).toBe(true);

    const stored = (await store.get(mission.missionId))!;
    // The new acquisition is the authoritative owner; recovery did not revert it.
    expect(stored.objectives[0]?.state).toBe('RUNNING');
    expect(stored.objectives[0]?.lease?.token).toBe('lease_reacquired');
    expect(recovered.objectives[0]?.lease?.token).toBe('lease_reacquired');
  });

  it('B: a cancelled mission is never resurrected by a late worker result', async () => {
    const store = new InMemoryMissionStore();
    const checkpointStore = new InMemoryCheckpointStore();
    const nowMs = START_MS;
    let missionId = '';

    const service = baseService({
      store,
      checkpointStore,
      clock: () => nowMs,
      onExecute: async () => {
        // The operator cancels DURABLY while the objective is executing.
        await service.cancelMission(missionId);
      },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Cancel race',
      objective: 'Cancel race',
      initialObjectives: ['Do the work'],
    });
    missionId = mission.missionId;
    await service.startMission(missionId);

    const result = await service.runNextObjective(missionId);

    const stored = (await store.get(missionId))!;
    expect(stored.state).toBe('CANCELLED');
    expect(stored.outcome).toBe('CANCELLED');
    expect(stored.objectives[0]?.state).not.toBe('VERIFIED');
    expect(stored.objectives[0]?.verifiedOutcome).toBeUndefined();
    expect(result.state).toBe('CANCELLED');
  });

  it('C: a renewal that lands after recovery read its snapshot is not reverted', async () => {
    class StaleSnapshotStore extends InMemoryMissionStore {
      private firstRead = true;

      override async get(missionId: string): Promise<Mission | undefined> {
        const snapshot = await super.get(missionId);
        if (this.firstRead) {
          this.firstRead = false;
          // A concurrent owner renews AFTER recovery's read but BEFORE the
          // recovery publication (which also carries unrelated activity).
          await this.renewObjectiveLease(missionId, 'obj_live', {
            owner: 'mission-runtime',
            token: 'lease_live',
            nowMs: START_MS + 40_000,
            expiresAt: new Date(START_MS + 100_000).toISOString(),
          });
        }
        return snapshot;
      }
    }

    const store = new StaleSnapshotStore();
    const nowMs = START_MS + 40_000;
    const service = baseService({
      store,
      clock: () => nowMs,
      repositoryInspector: {
        inspectRepository: async () => ({
          failingTests: [],
          incompletePackages: [],
          missingIntegrations: [],
          gaps: [],
          summary: 'nothing missing',
        }),
      },
    });

    const stale = {
      ...objectiveOf('obj_stale', 'PENDING'),
      title: 'fix failing test: alpha',
    };
    await store.saveRequired(
      missionWith([objectiveOf('obj_live', 'RUNNING', leaseOf('lease_live')), stale]),
    );

    const recovered = await service.recoverMission('mission_race');
    expect(recovered.objectives.find((o) => o.objectiveId === 'obj_stale')?.state).toBe('SKIPPED');

    const stored = (await store.get('mission_race'))!;
    // The unrelated recovery change landed…
    expect(stored.objectives.find((o) => o.objectiveId === 'obj_stale')?.state).toBe('SKIPPED');
    // …and the RENEWED expiration survived it (the old snapshot had 60 000 ms).
    expect(stored.objectives.find((o) => o.objectiveId === 'obj_live')?.lease?.expiresAt).toBe(
      new Date(START_MS + 100_000).toISOString(),
    );
    expect(stored.objectives.find((o) => o.objectiveId === 'obj_live')?.state).toBe('RUNNING');
  });
});

// ─────────────────────────────────────────────────────────────────────
// E · checkpoint resume never completes over a live lease
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-02 · terminal-state guards', () => {
  it('E: resumeFromCheckpoint cannot COMPLETE while an objective holds a live lease', async () => {
    const store = new InMemoryMissionStore();
    const checkpointStore = new InMemoryCheckpointStore();
    const nowMs = START_MS;
    const service = baseService({ store, checkpointStore, clock: () => nowMs });

    const mission = missionWith([
      objectiveOf('obj_live', 'RUNNING', leaseOf('lease_live')),
      {
        ...objectiveOf('obj_verified', 'VERIFIED'),
        verifiedOutcome: {
          achieved: true,
          evidence: ['done'],
          verifiedAt: NOW,
        },
      },
    ]);
    await store.saveRequired(mission);
    // A checkpoint exists, so resume has something to act on.
    const checkpoint: MissionCheckpoint = {
      checkpointId: 'checkpoint_1',
      missionId: mission.missionId,
      objectiveId: 'obj_verified',
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
      budgetRemaining: {
        objectives: 1,
        actions: 10,
        runtimeMs: 1_000,
        tokens: 1_000,
        costUsd: 1,
      },
      timestamp: NOW,
    };
    await checkpointStore.save(checkpoint);

    const resumed = await service.resumeFromCheckpoint(mission.missionId);

    expect(resumed.state).toBe('RUNNING');
    const stored = (await store.get(mission.missionId))!;
    expect(stored.state).toBe('RUNNING');
    expect(stored.stateHistory).not.toContain('COMPLETED');
    expect(stored.objectives.find((o) => o.objectiveId === 'obj_live')?.state).toBe('RUNNING');
    expect(stored.objectives.find((o) => o.objectiveId === 'obj_live')?.lease?.token).toBe(
      'lease_live',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// F · bounded heartbeat shutdown with a never-settling renewal
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-02 · bounded heartbeat shutdown', () => {
  it('F: a renewal that never settles cannot block cleanup and never proves ownership', async () => {
    let renewalStarted = false;
    const store: MissionStore = {
      save: async () => undefined,
      get: async () => undefined,
      listByUserId: async () => [],
      listActive: async () => [],
      renewObjectiveLease: () => {
        renewalStarted = true;
        return new Promise(() => undefined); // never settles
      },
      holdsObjectiveLease: async () => false,
    };
    const heartbeat = new ObjectiveLeaseHeartbeat({
      store,
      clock: { now: () => NOW, timestampMs: () => START_MS },
      missionId: 'mission_race',
      objectiveId: 'obj_live',
      lease: {
        owner: 'mission-runtime',
        token: 'lease_live',
        acquiredAt: NOW,
        expiresAt: new Date(START_MS + 60_000).toISOString(),
      },
      ttlMs: 60_000,
      scheduler: { schedule: () => undefined, cancel: () => undefined },
      renewalTimeoutMs: 10,
    });

    expect(await heartbeat.renewNow()).toBe(false);
    expect(renewalStarted).toBe(true);
    // The heartbeat NEVER treats an unconfirmed renewal as ownership.
    expect(heartbeat.renewalFailureReason).toBeDefined();
    expect(await heartbeat.stillOwnsObjective()).toBe(false);

    const startedAt = Date.now();
    await heartbeat.stop();
    // Bounded: shutdown does not wait for the renewal that never settles.
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });
});

/**
 * A controller over the given store with the minimal real ports. Hooks let a
 * test drive the exact interleaving (cancel, verification, planning).
 */
function baseService(options: {
  store: InMemoryMissionStore;
  checkpointStore?: InMemoryCheckpointStore;
  clock: () => number;
  onExecute?: () => Promise<void> | void;
  repositoryInspector?: {
    inspectRepository: (workspace?: string) => Promise<{
      failingTests: string[];
      incompletePackages: string[];
      missingIntegrations: string[];
      gaps: string[];
      summary: string;
    }>;
  };
}): MissionControllerService {
  const checkpointStore = options.checkpointStore ?? new InMemoryCheckpointStore();
  return new MissionControllerService({
    store: options.store,
    checkpointStore,
    objectiveSelector: new DeterministicObjectiveSelector(),
    providerAvailability: {
      getProviderStatus: async () => ({
        available: true,
        capableProviders: [{ providerId: 'mock', modelId: 'm', capabilities: [], healthy: true }],
        unhealthyProviders: [],
      }),
    },
    goalUnderstanding: new SimpleGoalUnderstanding(),
    planner: {
      createPlan: async (goal: string) => ({
        planId: 'plan_race_1',
        goalId: 'goal_race_1',
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
        await options.onExecute?.();
        return {
          runId: 'run_race_1',
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
      now: () => new Date(options.clock()).toISOString(),
      timestampMs: () => options.clock(),
    },
    idGenerator: createIdGenerator(),
    leaseTtlMs: DEFAULT_LEASE_TTL_MS,
    leaseRenewalScheduler: { schedule: () => undefined, cancel: () => undefined },
    ...(options.repositoryInspector !== undefined
      ? { repositoryInspector: options.repositoryInspector }
      : {}),
  });
}
