// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S10 · PostgreSQL durability evidence
//
// In-memory tests cannot establish CROSS-PROCESS durability, so the S10 claims
// about durable leases, durable transitions and durable recovery are verified
// here against the real local PostgreSQL using INDEPENDENT CONNECTIONS and
// FRESH store/controller instances — i.e. across process-like boundaries.
//
// Skipped (never failed) when no authorized local PostgreSQL is reachable; the
// sprint report records which of the two happened.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import type { Mission, MissionObjective } from '@vedmoulya/mission-controller';
import { MissionControllerService } from '@vedmoulya/mission-controller';
import {
  PostgresCheckpointStore,
  PostgresMissionStore,
} from '../persistence/PostgresMissionStores.js';

const databaseUrl =
  process.env.POSTGRES_TEST_URL ?? 'postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya';

const probe = postgres(databaseUrl, { max: 1, connect_timeout: 3 });
let postgresAvailable = false;
try {
  await probe`SELECT 1`;
  postgresAvailable = true;
} catch {
  postgresAvailable = false;
} finally {
  await probe.end().catch(() => undefined);
}

/** An INDEPENDENT database connection (a separate "process" for our purposes). */
function openConnection(): postgres.Sql {
  return postgres(databaseUrl, { max: 2 });
}

async function freshMissionStore(sql: postgres.Sql): Promise<PostgresMissionStore> {
  const store = new PostgresMissionStore(sql);
  await store.ensureTable();
  await store.hydrate();
  return store;
}

async function freshCheckpointStore(sql: postgres.Sql): Promise<PostgresCheckpointStore> {
  const store = new PostgresCheckpointStore(sql);
  await store.ensureTable();
  await store.hydrate();
  return store;
}

function objectiveState(state: MissionObjective['state']): MissionObjective['state'] {
  return state;
}

function missionFixture(options: {
  missionId: string;
  owner: string;
  objectiveId: string;
  objectiveState: MissionObjective['state'];
  missionState: Mission['state'];
  lease?: MissionObjective['lease'];
}): Mission {
  const now = new Date().toISOString();
  const objective: MissionObjective = {
    objectiveId: options.objectiveId,
    missionId: options.missionId,
    title: 'S10 durable objective',
    objective: 'S10 durable objective',
    description: 'S10 durable objective',
    reason: 'S10 evidence',
    evidence: ['seeded by the S10 PostgreSQL durability test'],
    priority: 0,
    dependencies: [],
    estimatedComplexity: 'MEDIUM',
    estimatedCost: 0.01,
    state: objectiveState(options.objectiveState),
    stateHistory: ['PENDING', options.objectiveState],
    retryCount: 0,
    maxRetries: 3,
    createdAt: now,
    updatedAt: now,
    ...(options.lease ? { lease: options.lease } : {}),
  };
  return {
    missionId: options.missionId,
    userId: options.owner,
    title: 'S10 durable mission',
    objective: 'S10 durable mission',
    description: 'S10 durable mission',
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
    budget: {
      maxObjectives: 5,
      maxActions: 50,
      maxToolCalls: 100,
      maxRetries: 3,
      maxReplans: 2,
      maxRuntimeMs: 3_600_000,
      maxTokens: 100_000,
      maxCostUsd: 5,
    },
    budgetUsage: {
      objectivesCompleted: 0,
      objectivesFailed: 0,
      actionsExecuted: 0,
      toolCallsExecuted: 0,
      retriesConsumed: 0,
      replansConsumed: 0,
      runtimeMs: 0,
      tokensConsumed: 0,
      costUsd: 0,
    },
    constraints: {},
    state: options.missionState,
    stateHistory: ['CREATED', options.missionState],
    objectives: [objective],
    checkpoints: [],
    decisions: [],
    successCriteria: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** A controller over REAL durable stores with inert ports (recovery only). */
function controllerFor(store: PostgresMissionStore, checkpointStore: PostgresCheckpointStore) {
  const notUsed = (): never => {
    throw new Error('port not used by recovery');
  };
  return new MissionControllerService({
    store,
    checkpointStore,
    objectiveSelector: { selectNextObjective: notUsed },
    providerAvailability: {
      getProviderStatus: () =>
        Promise.resolve({ available: true, capableProviders: [], unhealthyProviders: [] }),
    },
    goalUnderstanding: { understandGoal: notUsed },
    planner: { createPlan: notUsed },
    executor: { executePlan: notUsed },
    verifier: { verifyObjective: notUsed },
    executionMemory: { recordVerifiedOutcome: () => Promise.resolve() },
    experienceOptimization: { getAdvisorySignal: notUsed },
    failureClassifier: { classify: notUsed },
    clock: { now: () => new Date().toISOString(), timestampMs: () => Date.now() },
    idGenerator: { generateId: (prefix: string) => `${prefix}-${randomUUID()}` },
  });
}

(postgresAvailable ? describe : describe.skip)('S10 · PostgreSQL durability evidence', () => {
  it('a durable LEASE CAS admits exactly one winner across independent connections', async () => {
    const sqlA = openConnection();
    const sqlB = openConnection();
    try {
      const owner = `s10-lease-${randomUUID()}`;
      const missionId = `mission-${randomUUID()}`;
      const objectiveId = `objective-${randomUUID()}`;
      const storeA = await freshMissionStore(sqlA);
      await storeA.saveRequired(
        missionFixture({
          missionId,
          owner,
          objectiveId,
          objectiveState: 'READY',
          missionState: 'RUNNING',
        }),
      );

      // A SECOND process/store, hydrated from the same PostgreSQL.
      const storeB = await freshMissionStore(sqlB);
      expect((await storeB.get(missionId))?.objectives[0]?.state).toBe('READY');

      const leaseA = {
        owner: 'worker-a',
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      const leaseB = {
        owner: 'worker-b',
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      const [wonA, wonB] = await Promise.all([
        storeA.acquireObjectiveLease(missionId, objectiveId, leaseA),
        storeB.acquireObjectiveLease(missionId, objectiveId, leaseB),
      ]);

      // Exactly one worker may own the objective.
      const winners = [wonA, wonB].filter((w) => w !== undefined);
      expect(winners).toHaveLength(1);
      // And the durable row records the winner's lease.
      const storeC = await freshMissionStore(openConnection());
      const durable = (await storeC.get(missionId))?.objectives[0];
      expect(durable?.state).toBe('RUNNING');
      expect(['worker-a', 'worker-b']).toContain(durable?.lease?.owner);
    } finally {
      await sqlA.end().catch(() => undefined);
      await sqlB.end().catch(() => undefined);
    }
  });

  it('a REQUIRED write is durable for a fresh connection (verified state survives)', async () => {
    const sqlA = openConnection();
    try {
      const owner = `s10-required-${randomUUID()}`;
      const missionId = `mission-${randomUUID()}`;
      const objectiveId = `objective-${randomUUID()}`;
      const storeA = await freshMissionStore(sqlA);
      const mission = missionFixture({
        missionId,
        owner,
        objectiveId,
        objectiveState: 'VERIFIED',
        missionState: 'COMPLETED',
      });
      mission.objectives[0]!.verifiedOutcome = {
        achieved: true,
        evidence: ['verified by the S10 evidence test'],
        method: 's10_test',
        verifiedAt: new Date().toISOString(),
      };
      mission.outcome = 'ACHIEVED';
      mission.budgetUsage.objectivesCompleted = 1;

      // The durability barrier (what the controller now awaits) …
      await storeA.saveRequired(mission);

      // … is visible to a COMPLETELY fresh process.
      const sqlB = openConnection();
      try {
        const storeB = await freshMissionStore(sqlB);
        const durable = await storeB.get(missionId);
        expect(durable?.state).toBe('COMPLETED');
        expect(durable?.outcome).toBe('ACHIEVED');
        expect(durable?.objectives[0]?.state).toBe('VERIFIED');
        expect(durable?.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
      } finally {
        await sqlB.end().catch(() => undefined);
      }
    } finally {
      await sqlA.end().catch(() => undefined);
    }
  });

  it('a checkpoint written through the barrier is durable for a fresh connection', async () => {
    const sqlA = openConnection();
    const sqlB = openConnection();
    try {
      const missionId = `mission-${randomUUID()}`;
      const checkpoints = await freshCheckpointStore(sqlA);
      const checkpoint = {
        checkpointId: `checkpoint-${randomUUID()}`,
        missionId,
        objectiveId: `objective-${randomUUID()}`,
        state: 'VERIFIED' as const,
        verifiedOutcome: {
          achieved: true,
          evidence: ['verified'],
          method: 's10_test',
          verifiedAt: new Date().toISOString(),
        },
        completedWork: ['verified'],
        remainingWork: [],
        failures: [],
        recoveryHistory: [],
        learningReferences: [],
        experienceReferences: [],
        budgetRemaining: { objectives: 1, actions: 1, runtimeMs: 1, tokens: 1, costUsd: 1 },
        timestamp: new Date().toISOString(),
      };
      await checkpoints.saveRequired(checkpoint);

      const fresh = await freshCheckpointStore(sqlB);
      const latest = await fresh.getLatestForMission(missionId);
      expect(latest?.checkpointId).toBe(checkpoint.checkpointId);
      expect(latest?.state).toBe('VERIFIED');
      expect(latest?.verifiedOutcome?.achieved).toBe(true);
    } finally {
      await sqlA.end().catch(() => undefined);
      await sqlB.end().catch(() => undefined);
    }
  });

  it('a FAILED required write throws and creates no durable state', async () => {
    const sql = openConnection();
    try {
      // A table that was never created: the write cannot land.
      const unwritable = new PostgresMissionStore(
        sql,
        `s10_missing_${randomUUID().replace(/-/g, '')}`,
      );
      const mission = missionFixture({
        missionId: `mission-${randomUUID()}`,
        owner: 's10-failure',
        objectiveId: `objective-${randomUUID()}`,
        objectiveState: 'VERIFIED',
        missionState: 'COMPLETED',
      });

      // The barrier must SURFACE the failure — never a silent success.
      await expect(unwritable.saveRequired(mission)).rejects.toThrow();
      expect(await unwritable.get(mission.missionId)).toBeUndefined();
    } finally {
      await sql.end().catch(() => undefined);
    }
  });

  it('recovery heals an ABANDONED objective across process-like boundaries', async () => {
    const sqlA = openConnection();
    try {
      const owner = `s10-recovery-${randomUUID()}`;
      const missionId = `mission-${randomUUID()}`;
      const objectiveId = `objective-${randomUUID()}`;
      const storeA = await freshMissionStore(sqlA);
      const checkpointStoreA = await freshCheckpointStore(sqlA);
      const crashed = missionFixture({
        missionId,
        owner,
        objectiveId,
        objectiveState: 'RUNNING',
        missionState: 'RUNNING',
        lease: {
          owner: 'crashed-worker',
          acquiredAt: '2020-01-01T00:00:00.000Z',
          expiresAt: '2020-01-01T00:01:00.000Z', // long expired
        },
      });
      await storeA.saveRequired(crashed);

      // A FRESH process (new connection, new stores, new controller) recovers.
      const sqlB = openConnection();
      try {
        const storeB = await freshMissionStore(sqlB);
        const checkpointStoreB = await freshCheckpointStore(sqlB);
        const recovered = await controllerFor(storeB, checkpointStoreB).recoverMission(missionId);

        const objective = recovered.objectives[0];
        expect(objective?.state).toBe('READY');
        expect(objective?.lease).toBeUndefined();
        expect(recovered.state).toBe('RUNNING');
        expect(recovered.activity?.some((a) => a.kind === 'RECOVERY_LEASE_EXPIRED')).toBe(true);

        // The healing itself is durable for yet another fresh process.
        const sqlC = openConnection();
        try {
          const storeC = await freshMissionStore(sqlC);
          const durable = await storeC.get(missionId);
          expect(durable?.objectives[0]?.state).toBe('READY');
          expect(durable?.objectives[0]?.lease).toBeUndefined();
        } finally {
          await sqlC.end().catch(() => undefined);
        }
      } finally {
        await sqlB.end().catch(() => undefined);
      }
    } finally {
      await sqlA.end().catch(() => undefined);
    }
  });

  it('documents the boundary: a LIVE lease is never stolen across connections', async () => {
    const sqlA = openConnection();
    try {
      const owner = `s10-live-${randomUUID()}`;
      const missionId = `mission-${randomUUID()}`;
      const objectiveId = `objective-${randomUUID()}`;
      const storeA = await freshMissionStore(sqlA);
      await storeA.saveRequired(
        missionFixture({
          missionId,
          owner,
          objectiveId,
          objectiveState: 'RUNNING',
          missionState: 'RUNNING',
          lease: {
            owner: 'live-worker',
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(), // live
          },
        }),
      );

      const sqlB = openConnection();
      try {
        const storeB = await freshMissionStore(sqlB);
        const checkpointStoreB = await freshCheckpointStore(sqlB);
        const untouched = await controllerFor(storeB, checkpointStoreB).recoverMission(missionId);
        const objective = untouched.objectives[0];
        expect(objective?.state).toBe('RUNNING');
        expect(objective?.lease?.owner).toBe('live-worker');
        // Documented boundary: this same rule is why an execution that OUTLIVES
        // its TTL can be treated as abandoned — leaseTtlMs must exceed the
        // longest attempt.
        expect(untouched.state).toBe('RUNNING');
      } finally {
        await sqlB.end().catch(() => undefined);
      }
    } finally {
      await sqlA.end().catch(() => undefined);
    }
  });
});
