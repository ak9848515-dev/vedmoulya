// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LEASE-01 · PostgresMissionStore lease renewal (hermetic)
//
// `PostgresMissionStore` is exercised UNCHANGED over the FINAL-04 file-backed SQL
// driver: the same statement shapes postgres.js receives (tagged template,
// `sql('table')` fragments, `sql.json`, `begin`) become durable file contents.
// That gives this suite two properties a real database would give it —
//   • a transaction/locking code path that really runs, and
//   • state that is only visible after a COMMIT (a fresh store re-hydrates it),
// without requiring a live PostgreSQL to be reachable.
//
// Real-PostgreSQL cross-connection evidence lives in s10-postgres-durability.test.ts
// and is SKIPPED (never silently passed) when no local database is reachable.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Mission, MissionObjective } from '@vedmoulya/mission-controller';
import { MissionControllerService, DEFAULT_LEASE_TTL_MS } from '@vedmoulya/mission-controller';
import {
  PostgresCheckpointStore,
  PostgresMissionStore,
} from '../persistence/PostgresMissionStores.js';
import { createFileBackedSql } from './file-backed-sql-driver.js';

const tempFiles: string[] = [];

afterEach(() => {
  while (tempFiles.length > 0) {
    const file = tempFiles.pop();
    if (file) {
      try {
        fs.rmSync(file, { force: true });
      } catch {
        // best effort temp cleanup
      }
    }
  }
});

function tempDbPath(): string {
  const file = path.join(os.tmpdir(), `vedmoulya-lease-${randomUUID()}.json`);
  tempFiles.push(file);
  return file;
}

/** A store over a SPECIFIC durable file (an independent "process" view). */
async function storeOver(filePath: string): Promise<PostgresMissionStore> {
  const store = new PostgresMissionStore(createFileBackedSql(filePath).sql);
  await store.ensureTable();
  await store.hydrate();
  return store;
}

function objectiveFixture(
  missionId: string,
  objectiveId: string,
  state: MissionObjective['state'],
  lease?: MissionObjective['lease'],
): MissionObjective {
  const now = new Date().toISOString();
  return {
    objectiveId,
    missionId,
    title: 'Lease objective',
    objective: 'Lease objective',
    description: 'Lease objective',
    reason: 'LEASE-01 evidence',
    evidence: [],
    priority: 0,
    dependencies: [],
    estimatedComplexity: 'MEDIUM',
    estimatedCost: 0.01,
    state,
    stateHistory: [state],
    retryCount: 0,
    maxRetries: 3,
    createdAt: now,
    updatedAt: now,
    ...(lease ? { lease } : {}),
  };
}

function missionFixture(
  missionId: string,
  objectiveId: string,
  state: MissionObjective['state'],
  lease?: MissionObjective['lease'],
): Mission {
  const now = new Date().toISOString();
  return {
    missionId,
    userId: 'user-lease',
    title: 'Lease mission',
    objective: 'Lease mission',
    description: 'Lease mission',
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
      costUsdConsumed: 0,
    },
    constraints: {},
    state: 'RUNNING',
    stateHistory: ['CREATED', 'RUNNING'],
    objectives: [objectiveFixture(missionId, objectiveId, state, lease)],
    checkpoints: [],
    decisions: [],
    successCriteria: [],
    createdAt: now,
    updatedAt: now,
  };
}

const T0 = Date.parse('2026-10-22T10:00:00.000Z');

function leaseAt(owner: string, token: string, expiresMs: number): MissionObjective['lease'] {
  return {
    owner,
    token,
    acquiredAt: new Date(T0).toISOString(),
    expiresAt: new Date(expiresMs).toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Store-level behavior
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-01 · PostgresMissionStore renewal (durable, ownership-checked)', () => {
  it('extends the lease durably: a fresh store sees the renewed expiration', async () => {
    const file = tempDbPath();
    const missionId = `mission_${randomUUID()}`;
    const objectiveId = `objective_${randomUUID()}`;
    const writer = await storeOver(file);
    await writer.saveRequired(missionFixture(missionId, objectiveId, 'READY'));

    const acquired = await writer.acquireObjectiveLease(
      missionId,
      objectiveId,
      leaseAt('mission-runtime', 'lease_t1', T0 + 1_000) as NonNullable<MissionObjective['lease']>,
    );
    expect(acquired?.objectives[0]?.state).toBe('RUNNING');

    const renewed = await writer.renewObjectiveLease(missionId, objectiveId, {
      owner: 'mission-runtime',
      token: 'lease_t1',
      nowMs: T0 + 500,
      expiresAt: new Date(T0 + DEFAULT_LEASE_TTL_MS).toISOString(),
    });
    expect(renewed?.expiresAt).toBe(new Date(T0 + DEFAULT_LEASE_TTL_MS).toISOString());
    // The acquisition instant is NOT rewritten by a renewal.
    expect(renewed?.acquiredAt).toBe(new Date(T0).toISOString());

    // A completely fresh store (new driver, fresh mirror) reads the committed
    // renewal from disk — the write was durable BEFORE success was reported.
    const reader = await storeOver(file);
    const durable = (await reader.get(missionId))?.objectives[0];
    expect(durable?.state).toBe('RUNNING');
    expect(durable?.lease?.token).toBe('lease_t1');
    expect(durable?.lease?.expiresAt).toBe(new Date(T0 + DEFAULT_LEASE_TTL_MS).toISOString());
  });

  it('refuses expired, replaced, foreign-owner and token-less acquisitions', async () => {
    const file = tempDbPath();
    const missionId = `mission_${randomUUID()}`;
    const objectiveId = `objective_${randomUUID()}`;
    const store = await storeOver(file);
    await store.saveRequired(missionFixture(missionId, objectiveId, 'READY'));
    await store.acquireObjectiveLease(
      missionId,
      objectiveId,
      leaseAt('mission-runtime', 'lease_first', T0 + 1_000) as NonNullable<
        MissionObjective['lease']
      >,
    );

    // (a) the real owner renews before expiry.
    expect(
      await store.renewObjectiveLease(missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_first',
        nowMs: T0 + 500,
        expiresAt: new Date(T0 + 60_000).toISOString(),
      }),
    ).toBeDefined();

    // (b) wrong token / wrong owner: never.
    expect(
      await store.renewObjectiveLease(missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_other',
        nowMs: T0 + 500,
        expiresAt: new Date(T0 + 60_000).toISOString(),
      }),
    ).toBeUndefined();
    expect(
      await store.renewObjectiveLease(missionId, objectiveId, {
        owner: 'other-worker',
        token: 'lease_first',
        nowMs: T0 + 500,
        expiresAt: new Date(T0 + 60_000).toISOString(),
      }),
    ).toBeUndefined();

    // (c) an EXPIRED lease can no longer be extended.
    expect(
      await store.renewObjectiveLease(missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_first',
        nowMs: T0 + 61_000,
        expiresAt: new Date(T0 + 121_000).toISOString(),
      }),
    ).toBeUndefined();

    // (d) recovery heals it atomically; the old acquisition is dead forever.
    const healed = await store.releaseExpiredObjectiveLease(missionId, objectiveId, {
      nowMs: T0 + 62_000,
      failureReason: 'Recovered after process interruption (durable lease expired)',
    });
    expect(healed?.objectives[0]?.state).toBe('READY');
    expect(healed?.objectives[0]?.lease).toBeUndefined();
    expect(
      await store.renewObjectiveLease(missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_first',
        nowMs: T0 + 62_000,
        expiresAt: new Date(T0 + 122_000).toISOString(),
      }),
    ).toBeUndefined();

    // (e) a NEW acquisition owns it; the old token stays refused.
    await store.acquireObjectiveLease(
      missionId,
      objectiveId,
      leaseAt('mission-runtime', 'lease_second', T0 + 200_000) as NonNullable<
        MissionObjective['lease']
      >,
    );
    expect(
      await store.renewObjectiveLease(missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_first',
        nowMs: T0 + 64_000,
        expiresAt: new Date(T0 + 124_000).toISOString(),
      }),
    ).toBeUndefined();
    expect(
      await store.renewObjectiveLease(missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_second',
        nowMs: T0 + 64_000,
        expiresAt: new Date(T0 + 124_000).toISOString(),
      }),
    ).toBeDefined();

    // (f) a legacy lease WITHOUT a token is not renewable nor provable.
    const legacy = (await store.get(missionId))!;
    legacy.objectives[0]!.lease = {
      owner: 'mission-runtime',
      acquiredAt: new Date(T0).toISOString(),
      expiresAt: new Date(T0 + 600_000).toISOString(),
    };
    await store.saveRequired(legacy);
    expect(
      await store.renewObjectiveLease(missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_second',
        nowMs: T0 + 64_000,
        expiresAt: new Date(T0 + 124_000).toISOString(),
      }),
    ).toBeUndefined();
    expect(
      await store.holdsObjectiveLease(missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_second',
      }),
    ).toBe(false);
  });

  it('heals only EXPIRED leases: a live lease is never stolen by recovery', async () => {
    const file = tempDbPath();
    const missionId = `mission_${randomUUID()}`;
    const objectiveId = `objective_${randomUUID()}`;
    const store = await storeOver(file);
    await store.saveRequired(
      missionFixture(
        missionId,
        objectiveId,
        'RUNNING',
        leaseAt('live-worker', 'lease_live', T0 + 60_000),
      ),
    );

    // A live lease: the atomic heal refuses, and nothing is written.
    expect(
      await store.releaseExpiredObjectiveLease(missionId, objectiveId, {
        nowMs: T0 + 1_000,
        failureReason: 'expired',
      }),
    ).toBeUndefined();
    // Ownership is still visible (an expired lease included — that is the
    // difference between "cannot renew" and "no longer the owner").
    expect(
      await store.holdsObjectiveLease(missionId, objectiveId, {
        owner: 'live-worker',
        token: 'lease_live',
      }),
    ).toBe(true);
    expect(
      await store.holdsObjectiveLease(missionId, objectiveId, {
        owner: 'live-worker',
        token: 'lease_other',
      }),
    ).toBe(false);
    const untouched = (await (await storeOver(file)).get(missionId))?.objectives[0];
    expect(untouched?.state).toBe('RUNNING');
    expect(untouched?.lease?.token).toBe('lease_live');

    // Past the expiry: the SAME atomic operation heals it, durably.
    const healed = await store.releaseExpiredObjectiveLease(missionId, objectiveId, {
      nowMs: T0 + 61_000,
      failureReason: 'Recovered after process interruption (durable lease expired)',
    });
    expect(healed?.objectives[0]?.state).toBe('READY');
    const durable = (await (await storeOver(file)).get(missionId))?.objectives[0];
    expect(durable?.state).toBe('READY');
    expect(durable?.lease).toBeUndefined();
    expect(
      await store.holdsObjectiveLease(missionId, objectiveId, {
        owner: 'live-worker',
        token: 'lease_live',
      }),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Controller integration over the durable store
// ─────────────────────────────────────────────────────────────────────

interface ManualSchedule {
  scheduler: {
    schedule(tick: () => Promise<void>, delayMs: number): unknown;
    cancel(handle: unknown): void;
  };
  fire(): Promise<void>;
  pending(): number;
}

function manualScheduler(): ManualSchedule {
  let pendingTick: (() => Promise<void>) | undefined;
  return {
    scheduler: {
      schedule(tick) {
        pendingTick = tick;
        return { tick };
      },
      cancel() {
        pendingTick = undefined;
      },
    },
    async fire() {
      const tick = pendingTick;
      pendingTick = undefined;
      if (tick) await tick();
    },
    pending: () => (pendingTick === undefined ? 0 : 1),
  };
}

function controllerOver(
  store: PostgresMissionStore,
  file: string,
  options: {
    clock(): number;
    ticks: ManualSchedule;
    ttlMs?: number;
    onExecute?: () => Promise<void> | void;
    onVerify?: () => Promise<void> | void;
    executions?: string[];
  },
): MissionControllerService {
  const providerStatus = {
    available: true,
    capableProviders: [{ providerId: 'mock', modelId: 'mock-1', capabilities: [], healthy: true }],
    unhealthyProviders: [],
  };
  return new MissionControllerService({
    store,
    checkpointStore: new PostgresCheckpointStore(createFileBackedSql(file).sql),
    objectiveSelector: {
      selectNextObjective: async (mission) => {
        const next = mission.objectives.find(
          (objective) => objective.state === 'PENDING' || objective.state === 'READY',
        );
        return next
          ? {
              selected: true,
              objectiveId: next.objectiveId,
              reason: 'next',
              evidence: [],
              priority: 0,
            }
          : { selected: false, reason: 'none', evidence: [], priority: 0 };
      },
    },
    providerAvailability: { getProviderStatus: async () => providerStatus },
    goalUnderstanding: {
      understandGoal: async (objective: string) => ({
        goal: objective,
        requiredCapabilities: [],
        constraints: [],
        estimatedComplexity: 'LOW' as const,
      }),
    },
    planner: {
      createPlan: async (goal: string) => ({
        planId: `plan_${randomUUID()}`,
        goalId: `goal_${randomUUID()}`,
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
        options.executions?.push('execute');
        await options.onExecute?.();
        return {
          runId: `run_${randomUUID()}`,
          success: true,
          verified: true,
          output: 'ok',
          usage: { tokens: 5, costUsd: 0.001, latencyMs: 5, toolCalls: 1 },
        };
      },
    },
    verifier: {
      verifyObjective: async () => {
        await options.onVerify?.();
        return { verified: true, evidence: ['checks passed'], method: 'test_verification' };
      },
    },
    executionMemory: { recordVerifiedOutcome: async () => undefined },
    experienceOptimization: {
      getAdvisorySignal: async () => ({ confidence: 0.5, evidenceCount: 0 }),
    },
    failureClassifier: {
      classify: async () => ({
        failureClass: 'UNKNOWN' as const,
        recoverable: false,
        reason: 'not used',
        suggestedAction: 'FAIL' as const,
        evidence: [],
      }),
    },
    clock: {
      now: () => new Date(options.clock()).toISOString(),
      timestampMs: () => options.clock(),
    },
    idGenerator: { generateId: (prefix: string) => `${prefix}_${randomUUID()}` },
    leaseTtlMs: options.ttlMs ?? DEFAULT_LEASE_TTL_MS,
    leaseRenewalScheduler: options.ticks.scheduler,
  });
}

describe('LEASE-01 · controller over PostgresMissionStore', () => {
  it('a longer-than-TTL objective keeps a live lease and finalizes with verification', async () => {
    const file = tempDbPath();
    const missionId = `mission_${randomUUID()}`;
    const objectiveId = `objective_${randomUUID()}`;
    const writer = await storeOver(file);
    await writer.saveRequired(missionFixture(missionId, objectiveId, 'READY'));

    let nowMs = T0 + 1_000;
    const ticks = manualScheduler();
    let observedDuringRecovery = '';
    const service = controllerOver(writer, file, {
      clock: () => nowMs,
      ticks,
      onExecute: async () => {
        nowMs += 45_000;
        await ticks.fire(); // renewal, before the 60s TTL
        nowMs += 45_000; // the ORIGINAL lease is long expired here
        const recovered = await service.recoverMission(missionId);
        observedDuringRecovery = recovered.objectives[0]?.state ?? 'MISSING';
        await ticks.fire(); // renew again (still inside the renewed window)
        nowMs += 30_000;
      },
    });

    const result = await service.runNextObjective(missionId);

    expect(observedDuringRecovery).toBe('RUNNING');
    expect(result.objectives[0]?.state).toBe('VERIFIED');
    expect(result.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    expect(ticks.pending()).toBe(0);

    // Durable evidence for a completely fresh process (fresh driver + mirror).
    const durable = (await (await storeOver(file)).get(missionId))?.objectives[0];
    expect(durable?.state).toBe('VERIFIED');
    expect(durable?.verifiedOutcome?.achieved).toBe(true);
    expect(durable?.lease).toBeUndefined();
  });

  it('a worker whose lease was healed and re-acquired never overwrites the new owner', async () => {
    const file = tempDbPath();
    const missionId = `mission_${randomUUID()}`;
    const objectiveId = `objective_${randomUUID()}`;
    const storeA = await storeOver(file);
    await storeA.saveRequired(missionFixture(missionId, objectiveId, 'READY'));

    let nowMs = T0 + 1_000;
    const ticksA = manualScheduler();
    let workerB:
      | { store: PostgresMissionStore; service: MissionControllerService; ticks: ManualSchedule }
      | undefined;

    const serviceA = controllerOver(storeA, file, {
      clock: () => nowMs,
      ticks: ticksA,
      onVerify: async () => {
        // A's lease expires while A is still verifying…
        const current = await storeA.get(missionId);
        current!.objectives[0]!.lease!.expiresAt = new Date(nowMs - 1).toISOString();
        await storeA.saveRequired(current!);

        // …and another PROCESS (fresh driver + harness) heals and re-acquires it.
        const storeB = await storeOver(file);
        const ticksB = manualScheduler();
        const serviceB = controllerOver(storeB, file, { clock: () => nowMs, ticks: ticksB });
        workerB = { store: storeB, service: serviceB, ticks: ticksB };
        const healed = await serviceB.recoverMission(missionId);
        expect(healed.objectives[0]?.state).toBe('READY');
        const done = await serviceB.runNextObjective(missionId);
        expect(done.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
      },
    });

    await serviceA.runNextObjective(missionId);

    // A did NOT persist its own snapshot over B's verified result.
    const durable = (await (await storeOver(file)).get(missionId))?.objectives[0];
    expect(durable?.state).toBe('VERIFIED');
    expect(durable?.verifiedOutcome?.achieved).toBe(true);
    expect(durable?.lease).toBeUndefined();
    expect(ticksA.pending()).toBe(0);
    expect(workerB?.ticks.pending()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// LEASE-02 — atomic finalization & recovery publication (two stores)
//
// Each `storeOver(file)` is an INDEPENDENT process view (its own driver and
// mirror), so a write is only visible to the other store after it COMMITTED.
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-02 · PostgresMissionStore atomic finalization', () => {
  it('G: two independent stores race to finalize — only the current token commits', async () => {
    const file = tempDbPath();
    const missionId = `mission_${randomUUID()}`;
    const objectiveId = `objective_${randomUUID()}`;
    const storeA = await storeOver(file);
    await storeA.saveRequired(missionFixture(missionId, objectiveId, 'READY'));
    await storeA.acquireObjectiveLease(
      missionId,
      objectiveId,
      leaseAt('mission-runtime', 'lease_A', T0 + 1_000) as NonNullable<MissionObjective['lease']>,
    );

    // A's lease expires; a second process heals it and wins the objective.
    const storeB = await storeOver(file);
    expect(
      await storeB.releaseExpiredObjectiveLease(missionId, objectiveId, {
        nowMs: T0 + 2_000,
        failureReason: 'expired',
      }),
    ).toBeDefined();
    expect(
      await storeB.acquireObjectiveLease(
        missionId,
        objectiveId,
        leaseAt('mission-runtime', 'lease_B', T0 + 120_000) as NonNullable<
          MissionObjective['lease']
        >,
      ),
    ).toBeDefined();

    const intended = (evidence: string, runId: string): MissionObjective => ({
      ...objectiveFixture(missionId, objectiveId, 'VERIFIED'),
      stateHistory: ['PENDING', 'RUNNING', 'VERIFIED'],
      verifiedOutcome: {
        achieved: true,
        evidence: [evidence],
        verifiedAt: new Date(T0 + 3_000).toISOString(),
      },
      executionRunId: runId,
    });

    // A (stale) attempts the acknowledgement with its old fencing token.
    const refusal = await storeA.finalizeObjectiveIfLeaseOwner(
      missionId,
      objectiveId,
      { owner: 'mission-runtime', token: 'lease_A' },
      {
        objective: intended('A evidence', 'run_A'),
        leaseToken: 'lease_A',
        at: new Date(T0 + 3_000).toISOString(),
      },
    );
    expect(refusal?.applied).toBe(false);
    expect(refusal?.mission.objectives[0]?.lease?.token).toBe('lease_B');

    // The refusal is DURABLE: nothing of A's landed.
    const afterRefusal = (await (await storeOver(file)).get(missionId))!.objectives[0];
    expect(afterRefusal?.state).toBe('RUNNING');
    expect(afterRefusal?.lease?.token).toBe('lease_B');
    expect(afterRefusal?.verifiedOutcome).toBeUndefined();

    // B (the current owner) commits.
    const applied = await storeB.finalizeObjectiveIfLeaseOwner(
      missionId,
      objectiveId,
      { owner: 'mission-runtime', token: 'lease_B' },
      {
        objective: intended('B evidence', 'run_B'),
        leaseToken: 'lease_B',
        at: new Date(T0 + 4_000).toISOString(),
      },
    );
    expect(applied?.applied).toBe(true);

    const durable = (await (await storeOver(file)).get(missionId))!.objectives[0];
    expect(durable?.state).toBe('VERIFIED');
    expect(durable?.verifiedOutcome?.evidence).toEqual(['B evidence']);
    expect(durable?.finalizedByLeaseToken).toBe('lease_B');
    expect(durable?.lease).toBeUndefined();
  });

  it('B: a re-acquisition that lands after healing survives the recovery publication', async () => {
    const file = tempDbPath();
    const missionId = `mission_${randomUUID()}`;
    const objectiveId = `objective_${randomUUID()}`;
    const storeA = await storeOver(file);
    await storeA.saveRequired(
      missionFixture(
        missionId,
        objectiveId,
        'RUNNING',
        leaseAt('mission-runtime', 'lease_1', T0 + 1_000),
      ),
    );
    // Recovery's SNAPSHOT (taken through A's mirror).
    const stale = (await storeA.get(missionId))!;

    // Meanwhile another process heals and re-acquires the objective.
    const storeB = await storeOver(file);
    await storeB.releaseExpiredObjectiveLease(missionId, objectiveId, {
      nowMs: T0 + 2_000,
      failureReason: 'expired',
    });
    await storeB.acquireObjectiveLease(
      missionId,
      objectiveId,
      leaseAt('mission-runtime', 'lease_2', T0 + 120_000) as NonNullable<MissionObjective['lease']>,
    );

    const published = await storeA.applyRecoveryChanges(
      missionId,
      [
        {
          objectiveId,
          expected: {
            state: 'RUNNING',
            leaseToken: 'lease_1',
            leaseExpiresAt: stale.objectives[0]!.lease!.expiresAt,
          },
          state: 'READY',
          failureReason: 'healed',
        },
      ],
      {
        nowMs: T0 + 2_000,
        activity: [
          {
            id: 'act_recovery_1',
            at: new Date(T0 + 2_000).toISOString(),
            kind: 'RECOVERY_LEASE_EXPIRED',
            message: 'healed',
          },
        ],
      },
    );
    expect(published?.applied).toEqual([]);
    expect(published?.skipped).toEqual([objectiveId]);

    const durable = (await (await storeOver(file)).get(missionId))!;
    expect(durable.objectives[0]?.state).toBe('RUNNING');
    expect(durable.objectives[0]?.lease?.token).toBe('lease_2');
    // The recovery ACTIVITY is still recorded (merge-only never reverts state).
    expect(durable.activity?.some((event) => event.id === 'act_recovery_1')).toBe(true);
  });

  it('C: a renewal that lands after the recovery snapshot survives an unrelated recovery change', async () => {
    const file = tempDbPath();
    const missionId = `mission_${randomUUID()}`;
    const objectiveId = `objective_${randomUUID()}`;
    const staleObjectiveId = `objective_${randomUUID()}`;
    const storeA = await storeOver(file);

    const mission = missionFixture(
      missionId,
      objectiveId,
      'RUNNING',
      leaseAt('mission-runtime', 'lease_1', T0 + 60_000),
    );
    mission.objectives.push(objectiveFixture(missionId, staleObjectiveId, 'PENDING'));
    await storeA.saveRequired(mission);
    const stale = (await storeA.get(missionId))!;

    // Another process RENEWS the live lease before recovery publishes.
    const storeB = await storeOver(file);
    expect(
      await storeB.renewObjectiveLease(missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_1',
        nowMs: T0 + 1_000,
        expiresAt: new Date(T0 + 121_000).toISOString(),
      }),
    ).toBeDefined();

    const published = await storeA.applyRecoveryChanges(
      missionId,
      [
        {
          objectiveId: staleObjectiveId,
          expected: { state: 'PENDING' },
          state: 'SKIPPED',
          failureReason: 'stale objective',
        },
      ],
      { nowMs: T0 + 1_000 },
    );
    expect(published?.applied).toEqual([staleObjectiveId]);

    const durable = (await (await storeOver(file)).get(missionId))!;
    const live = durable.objectives.find((objective) => objective.objectiveId === objectiveId);
    const skipped = durable.objectives.find(
      (objective) => objective.objectiveId === staleObjectiveId,
    );
    // The unrelated change landed…
    expect(skipped?.state).toBe('SKIPPED');
    // …and the RENEWED expiration (not the stale snapshot's) is authoritative.
    expect(live?.state).toBe('RUNNING');
    expect(live?.lease?.token).toBe('lease_1');
    expect(live?.lease?.expiresAt).toBe(new Date(T0 + 121_000).toISOString());
    expect(live?.lease?.expiresAt).not.toBe(stale.objectives[0]?.lease?.expiresAt);
  });
});

// ─────────────────────────────────────────────────────────────────────
// LEASE-03 — acquisition must not queue a stale whole-document write
//
// The acquisition transaction already commits the authoritative row; the
// mirror is refreshed with `remember` (no queued upsert). This test holds the
// best-effort drain open across a SECOND process's renewal: if acquisition
// queued a whole-document write, releasing the queue would overwrite the newer
// renewal with the older acquisition copy.
// ─────────────────────────────────────────────────────────────────────

/** The file driver with a switchable gate in front of its DIRECT statements. */
function gatedFileSql(filePath: string) {
  const base = createFileBackedSql(filePath).sql;
  let gate: Promise<void> | undefined;
  let release: (() => void) | undefined;
  const gated = ((...args: unknown[]) => {
    const call = (): unknown => (base as unknown as (...a: unknown[]) => unknown)(...args);
    return gate === undefined ? call() : gate.then(call);
  }) as unknown as typeof base;
  gated.json = base.json;
  gated.begin = base.begin;
  gated.end = base.end;
  return {
    sql: gated,
    arm(): void {
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    release(): void {
      const done = release;
      gate = undefined;
      release = undefined;
      done?.();
    },
  };
}

describe('LEASE-03 · acquisition queues no stale document write', () => {
  it('an acquisition whose best-effort queue is delayed cannot overwrite a later renewal', async () => {
    const file = tempDbPath();
    const missionId = `mission_${randomUUID()}`;
    const objectiveId = `objective_${randomUUID()}`;
    const gated = gatedFileSql(file);
    const storeA = new PostgresMissionStore(gated.sql);
    await storeA.ensureTable();
    await storeA.hydrate();
    await storeA.saveRequired(missionFixture(missionId, objectiveId, 'READY'));
    await storeA.flush();

    // Hold every DIRECT (non-transaction) statement — the best-effort queue.
    gated.arm();
    await storeA.acquireObjectiveLease(
      missionId,
      objectiveId,
      leaseAt('mission-runtime', 'lease_1', T0 + 60_000) as NonNullable<MissionObjective['lease']>,
    );

    // A second process renews the same acquisition while the queue is held.
    const storeB = await storeOver(file);
    expect(
      await storeB.renewObjectiveLease(missionId, objectiveId, {
        owner: 'mission-runtime',
        token: 'lease_1',
        nowMs: T0 + 1_000,
        expiresAt: new Date(T0 + 181_000).toISOString(),
      }),
    ).toBeDefined();

    // Release whatever acquisition may have queued, then flush it.
    gated.release();
    await storeA.flush();

    const durable = (await (await storeOver(file)).get(missionId))!.objectives[0];
    expect(durable?.state).toBe('RUNNING');
    expect(durable?.lease?.token).toBe('lease_1');
    expect(durable?.lease?.expiresAt).toBe(new Date(T0 + 181_000).toISOString());
  });
});
