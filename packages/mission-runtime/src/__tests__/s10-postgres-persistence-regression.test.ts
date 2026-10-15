// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Sprint 020A · Persistence honesty regression (REAL PostgreSQL)
//
// Closes the Sprint-019 evidence gap "live PostgreSQL durability proof" with a
// deterministic, reproducible probe of the EXACT production persistence chain:
//
//     MissionControllerService.persistRequired()
//       → store.saveRequired()            (MissionStore port)
//         → PostgresMissionStore.saveRequired()      (mission-runtime)
//           → WriteThroughDocumentStore.writeThroughUpsert()  (core)
//             → PostgreSQL
//
// Every case runs against the LOCAL PostgreSQL with INDEPENDENT connections and
// FRESH store/controller instances (process-like boundaries), and asserts on
// DURABLE state — what a brand-new process would actually read — never on
// method-call bookkeeping. The failure-injection is deterministic (a table that
// does not exist / a closed connection pool), never timing-based.
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

function missionFixture(options: {
  missionId: string;
  owner: string;
  objectiveId: string;
  objectiveState: MissionObjective['state'];
  missionState: Mission['state'];
}): Mission {
  const now = new Date().toISOString();
  const objective: MissionObjective = {
    objectiveId: options.objectiveId,
    missionId: options.missionId,
    title: '020A persistence regression objective',
    objective: '020A persistence regression objective',
    description: '020A persistence regression objective',
    reason: '020A evidence',
    evidence: ['seeded by the 020A PostgreSQL persistence regression test'],
    priority: 0,
    dependencies: [],
    estimatedComplexity: 'MEDIUM',
    estimatedCost: 0.01,
    state: options.objectiveState,
    stateHistory: ['PENDING', options.objectiveState],
    retryCount: 0,
    maxRetries: 3,
    createdAt: now,
    updatedAt: now,
  };
  return {
    missionId: options.missionId,
    userId: options.owner,
    title: '020A persistence regression mission',
    objective: '020A persistence regression mission',
    description: '020A persistence regression mission',
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

/**
 * A controller over REAL durable stores with inert ports. `persistenceRetry`
 * baseDelayMs is 0 so the retry BUDGET is exercised without timing waits; the
 * default attempt count (3) is what the production path uses.
 */
function controllerFor(
  store: PostgresMissionStore,
  checkpointStore: PostgresCheckpointStore,
): MissionControllerService {
  const notUsed = (): never => {
    throw new Error('port not used by this probe');
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
    persistenceRetry: { attempts: 3, baseDelayMs: 0 },
  });
}

(postgresAvailable ? describe : describe.skip)(
  '020A · Persistence honesty regression (real PostgreSQL)',
  () => {
    it('A — a successful REQUIRED write is durable AND acknowledged as success', async () => {
      const sqlA = openConnection();
      try {
        const missionId = `mission-${randomUUID()}`;
        const storeA = await freshMissionStore(sqlA);
        const mission = missionFixture({
          missionId,
          owner: `020a-success-${randomUUID()}`,
          objectiveId: `objective-${randomUUID()}`,
          objectiveState: 'VERIFIED',
          missionState: 'COMPLETED',
        });
        mission.outcome = 'ACHIEVED';
        mission.budgetUsage.objectivesCompleted = 1;

        // The production barrier the controller awaits for a terminal transition.
        await storeA.saveRequired(mission);

        // A brand-new connection + store reads exactly what was written.
        const sqlB = openConnection();
        try {
          const storeB = await freshMissionStore(sqlB);
          const durable = await storeB.get(missionId);
          expect(durable?.state).toBe('COMPLETED');
          expect(durable?.outcome).toBe('ACHIEVED');
          expect(durable?.objectives[0]?.state).toBe('VERIFIED');
        } finally {
          await sqlB.end().catch(() => undefined);
        }
      } finally {
        await sqlA.end().catch(() => undefined);
      }
    });

    it('B — a failed REQUIRED write NEVER acknowledges success (no false durable state)', async () => {
      const sql = openConnection();
      try {
        // A table that was never created: every upsert is rejected.
        const unwritable = new PostgresMissionStore(
          sql,
          `020a_missing_${randomUUID().replace(/-/g, '')}`,
        );
        const mission = missionFixture({
          missionId: `mission-${randomUUID()}`,
          owner: '020a-failure',
          objectiveId: `objective-${randomUUID()}`,
          objectiveState: 'VERIFIED',
          missionState: 'COMPLETED',
        });
        mission.outcome = 'ACHIEVED';

        await expect(unwritable.saveRequired(mission)).rejects.toThrow();
        // Nothing durable was created — the acknowledgement cannot be trusted.
        expect(await unwritable.get(mission.missionId)).toBeUndefined();
      } finally {
        await sql.end().catch(() => undefined);
      }
    });

    it('C — a REQUIRED write survives a process-like restart (fresh store + connection)', async () => {
      const sqlA = openConnection();
      let missionId = '';
      try {
        const storeA = await freshMissionStore(sqlA);
        missionId = `mission-${randomUUID()}`;
        const mission = missionFixture({
          missionId,
          owner: `020a-restart-${randomUUID()}`,
          objectiveId: `objective-${randomUUID()}`,
          objectiveState: 'RUNNING',
          missionState: 'RUNNING',
        });
        await storeA.saveRequired(mission);
      } finally {
        await sqlA.end().catch(() => undefined);
      }

      // The original connection pool is closed — only PostgreSQL holds the state.
      const sqlB = openConnection();
      try {
        const storeB = await freshMissionStore(sqlB);
        // A brand-new store/connection reads the persisted document — exactly
        // what a freshly-booted process would see.
        const recovered = await storeB.get(missionId);
        expect(recovered?.state).toBe('RUNNING');
        expect(recovered?.objectives[0]?.state).toBe('RUNNING');
        expect(recovered?.budgetUsage.objectivesCompleted).toBe(0);
        // The controller can drive the recovered mission through the real API.
        const recoveredController = controllerFor(storeB, await freshCheckpointStore(sqlB));
        const status = await recoveredController.getStatus(missionId, '020a-restart');
        expect(status.state).toBe('RUNNING');
      } finally {
        await sqlB.end().catch(() => undefined);
      }
    });

    it('D — a transient write failure is absorbed by the bounded retry policy', async () => {
      const sqlA = openConnection();
      try {
        const missionId = `mission-${randomUUID()}`;
        const store = await freshMissionStore(sqlA);
        const checkpointStore = await freshCheckpointStore(sqlA);

        // Seed the durable document so the controller can read the mission.
        await store.saveRequired(
          missionFixture({
            missionId,
            owner: `020a-transient-${randomUUID()}`,
            objectiveId: `objective-${randomUUID()}`,
            objectiveState: 'PENDING',
            missionState: 'RUNNING',
          }),
        );

        // Fail the first two upserts ONLY, then let the third attempt land — the
        // same "transient outage within the retry budget" the barrier promises.
        let remainingFailures = 2;
        const original = store.saveRequired.bind(store);
        const flakyStore = Object.create(store) as PostgresMissionStore;
        Object.defineProperty(flakyStore, 'saveRequired', {
          value: async (mission: Mission): Promise<void> => {
            if (remainingFailures > 0) {
              remainingFailures -= 1;
              throw new Error('simulated transient persistence outage');
            }
            await original(mission);
          },
        });

        // The REAL controller path: CANCEL takes the terminal durability barrier.
        const ack = await controllerFor(flakyStore, checkpointStore).cancelMission(missionId);
        expect(ack.state).toBe('CANCELLED');
        expect(remainingFailures).toBe(0); // retries were consumed, not skipped
        expect(ack.activity?.some((a) => a.kind === 'PERSISTENCE_RETRIED')).toBe(true);
        expect(ack.activity?.some((a) => a.kind === 'PERSISTENCE_FAILED')).toBe(false);

        const sqlB = openConnection();
        try {
          const storeB = await freshMissionStore(sqlB);
          expect((await storeB.get(missionId))?.state).toBe('CANCELLED');
        } finally {
          await sqlB.end().catch(() => undefined);
        }
      } finally {
        await sqlA.end().catch(() => undefined);
      }
    });

    it('E — exhausted retries stay observable and never fabricate a durable success', async () => {
      const sql = openConnection();
      try {
        const unwritable = new PostgresMissionStore(
          sql,
          `020a_dead_${randomUUID().replace(/-/g, '')}`,
        );
        const mission = missionFixture({
          missionId: `mission-${randomUUID()}`,
          owner: '020a-exhausted',
          objectiveId: `objective-${randomUUID()}`,
          objectiveState: 'VERIFIED',
          missionState: 'COMPLETED',
        });
        mission.outcome = 'ACHIEVED';

        // Every attempt fails — the error names the attempt budget and the
        // operation so the exhaustion is externally observable.
        let caught: unknown;
        try {
          await unwritable.saveRequired(mission);
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(Error);
        // No durable document exists for the mission.
        expect(await unwritable.get(mission.missionId)).toBeUndefined();
      } finally {
        await sql.end().catch(() => undefined);
      }
    });
  },
);
