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
import { MissionControllerService, missionCasSnapshot } from '@vedmoulya/mission-controller';
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

  it('LEASE-01: renewal is ownership-checked across independent connections', async () => {
    const sqlA = openConnection();
    const sqlB = openConnection();
    try {
      const owner = `lease01-${randomUUID()}`;
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
      const now = Date.now();
      await storeA.acquireObjectiveLease(missionId, objectiveId, {
        owner: 'worker-a',
        token: 'lease_a',
        acquiredAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 1_000).toISOString(),
      });

      // A SECOND connection renews the SAME acquisition (a heartbeat).
      const storeB = await freshMissionStore(sqlB);
      const renewed = await storeB.renewObjectiveLease(missionId, objectiveId, {
        owner: 'worker-a',
        token: 'lease_a',
        nowMs: now + 500,
        expiresAt: new Date(now + 60_000).toISOString(),
      });
      expect(renewed?.expiresAt).toBe(new Date(now + 60_000).toISOString());

      // The extension is durable for a yet another fresh process.
      const sqlC = openConnection();
      try {
        const storeC = await freshMissionStore(sqlC);
        expect((await storeC.get(missionId))?.objectives[0]?.lease?.expiresAt).toBe(
          new Date(now + 60_000).toISOString(),
        );
      } finally {
        await sqlC.end().catch(() => undefined);
      }

      // A stale/foreign acquisition never renews, on ANY connection.
      expect(
        await storeB.renewObjectiveLease(missionId, objectiveId, {
          owner: 'worker-a',
          token: 'lease_stale',
          nowMs: now + 600,
          expiresAt: new Date(now + 60_500).toISOString(),
        }),
      ).toBeUndefined();
      expect(
        await storeA.renewObjectiveLease(missionId, objectiveId, {
          owner: 'worker-b',
          token: 'lease_a',
          nowMs: now + 600,
          expiresAt: new Date(now + 60_500).toISOString(),
        }),
      ).toBeUndefined();

      // An already-expired lease can never be reclaimed by a late renewal.
      const expiredMissionId = `mission-${randomUUID()}`;
      const expiredObjectiveId = `objective-${randomUUID()}`;
      await storeA.saveRequired(
        missionFixture({
          missionId: expiredMissionId,
          owner,
          objectiveId: expiredObjectiveId,
          objectiveState: 'RUNNING',
          missionState: 'RUNNING',
          lease: {
            owner: 'worker-a',
            token: 'lease_expired',
            acquiredAt: '2020-01-01T00:00:00.000Z',
            expiresAt: '2020-01-01T00:01:00.000Z',
          },
        }),
      );
      expect(
        await storeB.renewObjectiveLease(expiredMissionId, expiredObjectiveId, {
          owner: 'worker-a',
          token: 'lease_expired',
          nowMs: now,
          expiresAt: new Date(now + 60_000).toISOString(),
        }),
      ).toBeUndefined();
    } finally {
      await sqlA.end().catch(() => undefined);
      await sqlB.end().catch(() => undefined);
    }
  });

  it('LEASE-01: atomic recovery healing never resets a LIVE lease across connections', async () => {
    const sqlA = openConnection();
    const sqlB = openConnection();
    try {
      const owner = `lease01-heal-${randomUUID()}`;
      const liveMissionId = `mission-${randomUUID()}`;
      const liveObjectiveId = `objective-${randomUUID()}`;
      const storeA = await freshMissionStore(sqlA);
      await storeA.saveRequired(
        missionFixture({
          missionId: liveMissionId,
          owner,
          objectiveId: liveObjectiveId,
          objectiveState: 'RUNNING',
          missionState: 'RUNNING',
          lease: {
            owner: 'live-worker',
            token: 'lease_live',
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        }),
      );

      const storeB = await freshMissionStore(sqlB);
      // A LIVE lease: recovery's atomic heal refuses (nothing is written).
      expect(
        await storeB.releaseExpiredObjectiveLease(liveMissionId, liveObjectiveId, {
          nowMs: Date.now(),
          failureReason: 'expired',
        }),
      ).toBeUndefined();
      expect(
        await storeB.holdsObjectiveLease(liveMissionId, liveObjectiveId, {
          owner: 'live-worker',
          token: 'lease_live',
        }),
      ).toBe(true);

      const expiredMissionId = `mission-${randomUUID()}`;
      const expiredObjectiveId = `objective-${randomUUID()}`;
      await storeA.saveRequired(
        missionFixture({
          missionId: expiredMissionId,
          owner,
          objectiveId: expiredObjectiveId,
          objectiveState: 'RUNNING',
          missionState: 'RUNNING',
          lease: {
            owner: 'dead-worker',
            token: 'lease_dead',
            acquiredAt: '2020-01-01T00:00:00.000Z',
            expiresAt: '2020-01-01T00:01:00.000Z',
          },
        }),
      );
      const healed = await storeB.releaseExpiredObjectiveLease(
        expiredMissionId,
        expiredObjectiveId,
        { nowMs: Date.now(), failureReason: 'Recovered after process interruption' },
      );
      expect(healed?.objectives[0]?.state).toBe('READY');
      expect(healed?.objectives[0]?.lease).toBeUndefined();
      expect(
        await storeB.holdsObjectiveLease(expiredMissionId, expiredObjectiveId, {
          owner: 'dead-worker',
          token: 'lease_dead',
        }),
      ).toBe(false);
    } finally {
      await sqlA.end().catch(() => undefined);
      await sqlB.end().catch(() => undefined);
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
        // LEASE-01 — this rule is exactly why a running objective must RENEW its
        // lease (see the renewal evidence below): an execution that outlives a
        // lease nobody renews looks abandoned.
        expect(untouched.state).toBe('RUNNING');
      } finally {
        await sqlB.end().catch(() => undefined);
      }
    } finally {
      await sqlA.end().catch(() => undefined);
    }
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// LEASE-03 · conditional store operations under real row locks
//
// Every `openConnection()` below is an INDEPENDENT database connection — a
// separate "process" for our purposes. These cases exercise the operations that
// replaced the stale whole-document writes:
//   • finalizeObjectiveIfLeaseOwner (ownership-checked result publication)
//   • applyRecoveryChanges          (conditional recovery publication)
//   • patchMission                  (mission-level conditional patch)
//   • acquisition versus renewal
//   • rollback of a conditional mutation that failed inside its transaction
//
// They are SKIPPED (never silently passed) when no authorized local PostgreSQL
// is reachable. The file-backed SQL driver is NOT accepted as evidence here: it
// cannot prove row-lock contention or transactional rollback.
// ─────────────────────────────────────────────────────────────────────────────

const LEASE_T0 = Date.parse('2026-10-22T10:00:00.000Z');
const leaseMsIso = (offsetMs: number): string => new Date(LEASE_T0 + offsetMs).toISOString();

function leaseAt(
  owner: string,
  token: string,
  expiresMs: number,
): NonNullable<MissionObjective['lease']> {
  return {
    owner,
    token,
    acquiredAt: leaseMsIso(0),
    expiresAt: new Date(expiresMs).toISOString(),
  };
}

/** Push a second objective onto a fixture mission (LEASE-03 races need two). */
function withObjective(
  mission: Mission,
  objectiveId: string,
  state: MissionObjective['state'],
  lease?: MissionObjective['lease'],
): Mission {
  const now = leaseMsIso(0);
  mission.objectives.push({
    objectiveId,
    missionId: mission.missionId,
    title: `LEASE-03 objective ${objectiveId}`,
    objective: `LEASE-03 objective ${objectiveId}`,
    description: '',
    reason: 'LEASE-03 evidence',
    evidence: [],
    priority: mission.objectives.length,
    dependencies: [],
    estimatedComplexity: 'MEDIUM',
    estimatedCost: 0.01,
    state,
    stateHistory: ['PENDING', state],
    retryCount: 0,
    maxRetries: 3,
    createdAt: now,
    updatedAt: now,
    ...(lease ? { lease } : {}),
  });
  return mission;
}

(postgresAvailable ? describe : describe.skip)(
  'LEASE-03 · conditional writes under real PostgreSQL row locks',
  () => {
    it('finalizeObjectiveIfLeaseOwner commits for the current fencing token only', async () => {
      const sqlA = openConnection();
      const sqlB = openConnection();
      try {
        const owner = `lease03-finalize-${randomUUID()}`;
        const missionId = `mission-${randomUUID()}`;
        const objectiveId = `objective-${randomUUID()}`;
        const storeA = await freshMissionStore(sqlA);
        const seeded = missionFixture({
          missionId,
          owner,
          objectiveId,
          objectiveState: 'RUNNING',
          missionState: 'RUNNING',
          lease: leaseAt('worker-a', 'lease_a', LEASE_T0 + 60_000),
        });
        await storeA.saveRequired(seeded);

        const base = seeded.objectives[0]!;
        const intended = (evidence: string): MissionObjective => ({
          ...base,
          state: 'VERIFIED',
          stateHistory: [...base.stateHistory, 'VERIFIED'],
          lease: undefined,
          verifiedOutcome: {
            achieved: true,
            evidence: [evidence],
            method: 'lease03_postgres',
            verifiedAt: leaseMsIso(1_000),
          },
        });

        const storeB = await freshMissionStore(sqlB);

        // A STALE execution (its token was replaced) is refused and told why.
        const refused = await storeB.finalizeObjectiveIfLeaseOwner(
          missionId,
          objectiveId,
          { owner: 'worker-a', token: 'lease_stale' },
          {
            objective: intended('stale evidence'),
            leaseToken: 'lease_stale',
            at: leaseMsIso(1_000),
          },
        );
        expect(refused?.applied).toBe(false);
        expect(refused?.mission.objectives[0]?.lease?.token).toBe('lease_a');
        expect(refused?.mission.objectives[0]?.verifiedOutcome).toBeUndefined();

        // The CURRENT owner commits.
        const applied = await storeB.finalizeObjectiveIfLeaseOwner(
          missionId,
          objectiveId,
          { owner: 'worker-a', token: 'lease_a' },
          {
            objective: intended('owner evidence'),
            leaseToken: 'lease_a',
            at: leaseMsIso(2_000),
          },
        );
        expect(applied?.applied).toBe(true);

        // …and it is durable for yet another independent connection.
        const sqlC = openConnection();
        try {
          const storeC = await freshMissionStore(sqlC);
          const durable = (await storeC.get(missionId))?.objectives[0];
          expect(durable?.state).toBe('VERIFIED');
          expect(durable?.verifiedOutcome?.evidence).toEqual(['owner evidence']);
          expect(durable?.finalizedByLeaseToken).toBe('lease_a');
          expect(durable?.lease).toBeUndefined();
        } finally {
          await sqlC.end().catch(() => undefined);
        }
      } finally {
        await sqlA.end().catch(() => undefined);
        await sqlB.end().catch(() => undefined);
      }
    });

    it('applyRecoveryChanges never reverts a renewal committed after its snapshot', async () => {
      const sqlA = openConnection();
      const sqlB = openConnection();
      try {
        const missionId = `mission-${randomUUID()}`;
        const liveObjectiveId = `objective-${randomUUID()}`;
        const staleObjectiveId = `objective-${randomUUID()}`;
        const storeA = await freshMissionStore(sqlA);
        await storeA.saveRequired(
          withObjective(
            missionFixture({
              missionId,
              owner: `lease03-recovery-${randomUUID()}`,
              objectiveId: liveObjectiveId,
              objectiveState: 'RUNNING',
              missionState: 'RUNNING',
              lease: leaseAt('worker-a', 'lease_1', LEASE_T0 + 60_000),
            }),
            staleObjectiveId,
            'PENDING',
          ),
        );
        const observed = (await storeA.get(missionId))!;

        // A SECOND connection RENEWS the live lease after that snapshot.
        const storeB = await freshMissionStore(sqlB);
        expect(
          await storeB.renewObjectiveLease(missionId, liveObjectiveId, {
            owner: 'worker-a',
            token: 'lease_1',
            nowMs: LEASE_T0 + 1_000,
            expiresAt: leaseMsIso(180_000),
          }),
        ).toBeDefined();

        const published = await storeA.applyRecoveryChanges(
          missionId,
          [
            {
              objectiveId: liveObjectiveId,
              expected: {
                state: 'RUNNING',
                leaseToken: 'lease_1',
                leaseExpiresAt: observed.objectives[0]!.lease!.expiresAt,
              },
              state: 'READY',
              failureReason: 'healed',
            },
            {
              objectiveId: staleObjectiveId,
              expected: { state: 'PENDING' },
              state: 'SKIPPED',
              failureReason: 'stale objective',
            },
          ],
          {
            nowMs: LEASE_T0 + 1_000,
            activity: [
              {
                id: `act-${randomUUID()}`,
                at: leaseMsIso(1_000),
                kind: 'RECOVERY_LEASE_EXPIRED',
                message: 'healed',
              },
            ],
          },
        );

        // The change whose owner moved is refused; the unrelated one still lands.
        expect(published?.applied).toEqual([staleObjectiveId]);
        expect(published?.skipped).toEqual([liveObjectiveId]);

        const sqlC = openConnection();
        try {
          const storeC = await freshMissionStore(sqlC);
          const durable = (await storeC.get(missionId))!;
          const live = durable.objectives.find((o) => o.objectiveId === liveObjectiveId);
          const stale = durable.objectives.find((o) => o.objectiveId === staleObjectiveId);
          expect(live?.state).toBe('RUNNING');
          expect(live?.lease?.token).toBe('lease_1');
          expect(live?.lease?.expiresAt).toBe(leaseMsIso(180_000));
          expect(stale?.state).toBe('SKIPPED');
          expect(durable.activity?.some((e) => e.kind === 'RECOVERY_LEASE_EXPIRED')).toBe(true);
        } finally {
          await sqlC.end().catch(() => undefined);
        }
      } finally {
        await sqlA.end().catch(() => undefined);
        await sqlB.end().catch(() => undefined);
      }
    });

    it('patchMission refuses a stale state, a busy mission and a live lease — and never rewrites objectives', async () => {
      const sqlA = openConnection();
      const sqlB = openConnection();
      try {
        const missionId = `mission-${randomUUID()}`;
        const objectiveId = `objective-${randomUUID()}`;
        const storeA = await freshMissionStore(sqlA);
        await storeA.saveRequired(
          missionFixture({
            missionId,
            owner: `lease03-patch-${randomUUID()}`,
            objectiveId,
            objectiveState: 'RUNNING',
            missionState: 'RUNNING',
            lease: leaseAt('worker-a', 'lease_live', LEASE_T0 + 60_000),
          }),
        );
        const storeB = await freshMissionStore(sqlB);

        // (a) the persisted state is not the one the caller observed.
        const stale = await storeB.patchMission(missionId, {
          expectedState: 'PAUSED',
          state: 'PAUSED',
          at: leaseMsIso(1_000),
        });
        expect(stale?.applied).toBe(false);

        // (b) never finish while an execution still owns an objective.
        const busy = await storeB.patchMission(missionId, {
          expectedState: 'RUNNING',
          state: 'COMPLETED',
          requireIdle: true,
          at: leaseMsIso(1_000),
        });
        expect(busy?.applied).toBe(false);

        // (c) never hold a mission while a lease is still LIVE…
        const live = await storeB.patchMission(missionId, {
          expectedState: 'RUNNING',
          state: 'PAUSED',
          requireNoLiveLease: { nowMs: LEASE_T0 + 1_000 },
          at: leaseMsIso(1_000),
        });
        expect(live?.applied).toBe(false);

        // …but an EXPIRED lease no longer blocks the decision.
        const applied = await storeB.patchMission(missionId, {
          expectedState: 'RUNNING',
          state: 'PAUSED',
          requireNoLiveLease: { nowMs: LEASE_T0 + 120_000 },
          at: leaseMsIso(120_000),
        });
        expect(applied?.applied).toBe(true);

        const sqlC = openConnection();
        try {
          const durable = (await (await freshMissionStore(sqlC)).get(missionId))!;
          expect(durable.state).toBe('PAUSED');
          // A mission-level patch never rewrites the objective or its lease.
          expect(durable.objectives[0]?.state).toBe('RUNNING');
          expect(durable.objectives[0]?.lease?.token).toBe('lease_live');
        } finally {
          await sqlC.end().catch(() => undefined);
        }
      } finally {
        await sqlA.end().catch(() => undefined);
        await sqlB.end().catch(() => undefined);
      }
    });

    it('a renewed acquisition is never reverted by a stale snapshot or a second acquisition', async () => {
      const sqlA = openConnection();
      const sqlB = openConnection();
      const sqlC = openConnection();
      try {
        const missionId = `mission-${randomUUID()}`;
        const objectiveId = `objective-${randomUUID()}`;
        const storeA = await freshMissionStore(sqlA);
        await storeA.saveRequired(
          missionFixture({
            missionId,
            owner: `lease03-acquire-${randomUUID()}`,
            objectiveId,
            objectiveState: 'READY',
            missionState: 'RUNNING',
          }),
        );
        // A acquires the objective.
        expect(
          await storeA.acquireObjectiveLease(
            missionId,
            objectiveId,
            leaseAt('worker-a', 'lease_1', LEASE_T0 + 5_000),
          ),
        ).toBeDefined();
        const staleSnapshot = (await storeA.get(missionId))!;

        // B renews the SAME acquisition on its own connection.
        const storeB = await freshMissionStore(sqlB);
        expect(
          await storeB.renewObjectiveLease(missionId, objectiveId, {
            owner: 'worker-a',
            token: 'lease_1',
            nowMs: LEASE_T0 + 1_000,
            expiresAt: leaseMsIso(180_000),
          }),
        ).toBeDefined();

        // A snapshot captured BEFORE the renewal is refused (never overwrites it).
        const replaced = await storeA.replaceMissionIfUnchanged(
          missionId,
          {
            ...staleSnapshot,
            state: 'PAUSED',
            stateHistory: [...staleSnapshot.stateHistory, 'PAUSED'],
            updatedAt: leaseMsIso(1_500),
          },
          missionCasSnapshot(staleSnapshot),
        );
        expect(replaced?.applied).toBe(false);

        // A SECOND acquisition cannot steal an objective that is RUNNING.
        const storeC = await freshMissionStore(sqlC);
        expect(
          await storeC.acquireObjectiveLease(
            missionId,
            objectiveId,
            leaseAt('worker-b', 'lease_2', LEASE_T0 + 300_000),
          ),
        ).toBeUndefined();

        const durable = (await (await freshMissionStore(sqlC)).get(missionId))!.objectives[0];
        expect(durable?.state).toBe('RUNNING');
        expect(durable?.lease?.token).toBe('lease_1');
        expect(durable?.lease?.expiresAt).toBe(leaseMsIso(180_000));
      } finally {
        await sqlA.end().catch(() => undefined);
        await sqlB.end().catch(() => undefined);
        await sqlC.end().catch(() => undefined);
      }
    });

    it('a conditional mutation that fails inside its transaction rolls back completely', async () => {
      const sqlA = openConnection();
      try {
        const missionId = `mission-${randomUUID()}`;
        const objectiveId = `objective-${randomUUID()}`;
        const deadLease = {
          owner: 'crashed-worker',
          token: 'lease_dead',
          acquiredAt: new Date(LEASE_T0 - 600_000).toISOString(),
          expiresAt: new Date(LEASE_T0 - 300_000).toISOString(),
        };
        const storeA = await freshMissionStore(sqlA);
        await storeA.saveRequired(
          missionFixture({
            missionId,
            owner: `lease03-rollback-${randomUUID()}`,
            objectiveId,
            objectiveState: 'RUNNING',
            missionState: 'RUNNING',
            lease: deadLease,
          }),
        );

        // The change WOULD apply (the observed state matches exactly); the
        // transaction then fails while computing the write timestamp.
        await expect(
          storeA.applyRecoveryChanges(
            missionId,
            [
              {
                objectiveId,
                expected: {
                  state: 'RUNNING',
                  leaseToken: 'lease_dead',
                  leaseExpiresAt: deadLease.expiresAt,
                },
                state: 'READY',
                failureReason: 'healed',
              },
            ],
            {
              nowMs: Number.NaN,
              activity: [
                {
                  id: `act-${randomUUID()}`,
                  at: leaseMsIso(0),
                  kind: 'RECOVERY_LEASE_EXPIRED',
                  message: 'healed',
                },
              ],
            },
          ),
        ).rejects.toThrow();

        // NOTHING of the failed transaction is durable.
        const sqlB = openConnection();
        try {
          const durable = (await (await freshMissionStore(sqlB)).get(missionId))!;
          expect(durable.objectives[0]?.state).toBe('RUNNING');
          expect(durable.objectives[0]?.lease?.token).toBe('lease_dead');
          expect(durable.activity ?? []).toHaveLength(0);
        } finally {
          await sqlB.end().catch(() => undefined);
        }
      } finally {
        await sqlA.end().catch(() => undefined);
      }
    });

    it('two independent connections competing to finalize: row locks ensure exactly one winner', async () => {
      const sqlA = openConnection();
      const sqlB = openConnection();
      try {
        const owner = `lease03-race-finalize-${randomUUID()}`;
        const missionId = `mission-${randomUUID()}`;
        const objectiveId = `objective-${randomUUID()}`;
        const storeA = await freshMissionStore(sqlA);
        const seeded = missionFixture({
          missionId,
          owner,
          objectiveId,
          objectiveState: 'RUNNING',
          missionState: 'RUNNING',
          lease: leaseAt('worker-race', 'lease_race_1', LEASE_T0 + 60_000),
        });
        await storeA.saveRequired(seeded);

        const storeB = await freshMissionStore(sqlB);

        const base = seeded.objectives[0]!;
        const intendedA: MissionObjective = {
          ...base,
          state: 'VERIFIED',
          stateHistory: [...base.stateHistory, 'VERIFIED'],
          lease: undefined,
          verifiedOutcome: {
            achieved: true,
            evidence: ['evidence from connection A'],
            method: 'race_test_a',
            verifiedAt: leaseMsIso(1_000),
          },
        };
        const intendedB: MissionObjective = {
          ...base,
          state: 'VERIFIED',
          stateHistory: [...base.stateHistory, 'VERIFIED'],
          lease: undefined,
          verifiedOutcome: {
            achieved: true,
            evidence: ['evidence from connection B'],
            method: 'race_test_b',
            verifiedAt: leaseMsIso(1_000),
          },
        };

        // Two connections race to finalize simultaneously under real PostgreSQL row locks.
        const [resA, resB] = await Promise.all([
          storeA.finalizeObjectiveIfLeaseOwner(
            missionId,
            objectiveId,
            { owner: 'worker-race', token: 'lease_race_1' },
            {
              objective: intendedA,
              leaseToken: 'lease_race_1',
              at: leaseMsIso(1_000),
            },
          ),
          storeB.finalizeObjectiveIfLeaseOwner(
            missionId,
            objectiveId,
            { owner: 'worker-race', token: 'lease_race_1' },
            {
              objective: intendedB,
              leaseToken: 'lease_race_1',
              at: leaseMsIso(1_000),
            },
          ),
        ]);

        // Row locks guarantee mutual exclusion: exactly one must apply, exactly one must be refused.
        const results = [resA?.applied, resB?.applied];
        expect(results.filter((a) => a === true)).toHaveLength(1);
        expect(results.filter((a) => a === false)).toHaveLength(1);

        // Verification on a third independent connection confirms durable winner consistency.
        const sqlC = openConnection();
        try {
          const storeC = await freshMissionStore(sqlC);
          const durable = (await storeC.get(missionId))?.objectives[0];
          expect(durable?.state).toBe('VERIFIED');
          expect(durable?.lease).toBeUndefined();
          expect(durable?.finalizedByLeaseToken).toBe('lease_race_1');
          const winningEvidence =
            resA?.applied === true ? 'evidence from connection A' : 'evidence from connection B';
          expect(durable?.verifiedOutcome?.evidence).toEqual([winningEvidence]);
        } finally {
          await sqlC.end().catch(() => undefined);
        }
      } finally {
        await sqlA.end().catch(() => undefined);
        await sqlB.end().catch(() => undefined);
      }
    });

    it('recovery racing re-acquisition: row locks serialize recovery heal and new lease acquisition', async () => {
      const sqlA = openConnection();
      const sqlB = openConnection();
      try {
        const owner = `lease03-race-recovery-${randomUUID()}`;
        const missionId = `mission-${randomUUID()}`;
        const objectiveId = `objective-${randomUUID()}`;
        const storeA = await freshMissionStore(sqlA);
        const expiredLease = {
          owner: 'crashed-worker',
          token: 'lease_expired',
          acquiredAt: new Date(LEASE_T0 - 60_000).toISOString(),
          expiresAt: new Date(LEASE_T0 - 10_000).toISOString(),
        };
        await storeA.saveRequired(
          missionFixture({
            missionId,
            owner,
            objectiveId,
            objectiveState: 'RUNNING',
            missionState: 'RUNNING',
            lease: expiredLease,
          }),
        );

        const storeB = await freshMissionStore(sqlB);

        // Connection A recovers the expired lease (healing it to READY).
        // Connection B attempts to acquire it as worker-b.
        // Both execute concurrently against PostgreSQL under row locks.
        const [healed, acquired] = await Promise.all([
          storeA.releaseExpiredObjectiveLease(missionId, objectiveId, {
            nowMs: LEASE_T0,
            failureReason: 'lease expired, recovery healing to READY',
          }),
          storeB.acquireObjectiveLease(
            missionId,
            objectiveId,
            leaseAt('worker-b', 'lease_b', LEASE_T0 + 120_000),
          ),
        ]);

        // Under row locking:
        // Recovery must heal the expired lease (healed is defined).
        expect(healed).toBeDefined();

        const sqlC = openConnection();
        try {
          const storeC = await freshMissionStore(sqlC);
          const durable = (await storeC.get(missionId))?.objectives[0];
          if (acquired !== undefined) {
            expect(durable?.state).toBe('RUNNING');
            expect(durable?.lease?.owner).toBe('worker-b');
            expect(durable?.lease?.token).toBe('lease_b');
          } else {
            expect(durable?.state).toBe('READY');
            expect(durable?.lease).toBeUndefined();
          }
        } finally {
          await sqlC.end().catch(() => undefined);
        }
      } finally {
        await sqlA.end().catch(() => undefined);
        await sqlB.end().catch(() => undefined);
      }
    });
  },
);
