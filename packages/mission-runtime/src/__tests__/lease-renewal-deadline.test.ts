// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — LEASE-RENEWAL DEADLINE · why renewal took longer than 5 000 ms
//
// REPORTED INCIDENT
// -----------------
//   3:10:19 PM  RECOVERY_LEASE_EXPIRED — an interrupted objective → READY
//   3:12:03 PM  OBJECTIVE_LEASE_LOST  — "renewal did not settle within 5000 ms"
//   3:12:14 PM  the objective started again
//
// MEASURED CAUSE (this suite is the evidence)
// -------------------------------------------
// `PostgresMissionStore.renewObjectiveLease` — like every ownership-checked
// operation in that store — begins with `await this.flush()`. `flush()` waits
// for the store's IN-FLIGHT best-effort drain, and that drain writes every
// queued document ONE AT A TIME (`drainOnce` awaits each upsert sequentially,
// up to MAX_PENDING_WRITES = 5 000 items).
//
// During autonomous work the queue is never empty: each `store.save()` enqueues
// a WHOLE MISSION DOCUMENT (checkpoints, execution traces, activity). So the
// renewal's 5 s budget is spent queueing behind unrelated persistence writes
// BEFORE the renewal transaction is even sent. Measured here: with three queued
// writes of ~1.8 s each, `renewObjectiveLease` settles at ~5.4 s — over the
// budget — although the renewal statement itself takes ~0 ms.
//
// That is not database latency, not lock contention, and not a pool
// bottleneck: it is the renewal waiting on ITS OWN connection's write queue.
// The fix therefore stops the renewal from draining the shared queue (the row
// lock it takes is what orders it against those writes) and bounds the barrier
// that waits on the renewal, without weakening any ownership check.
//
// Everything here is deterministic: injected clock, manual scheduler, and a
// driver whose per-statement latency the test controls. No real database.
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_LEASE_TTL_MS,
  InMemoryCheckpointStore,
  MissionControllerService,
  ObjectiveLeaseHeartbeat,
  SimpleGoalUnderstanding,
  classifyFailure,
  createIdGenerator,
  DeterministicObjectiveSelector,
} from '@vedmoulya/mission-controller';
import type { ClockPort, Mission, MissionObjectiveLease } from '@vedmoulya/mission-controller';
import { PostgresMissionStore } from '../persistence/PostgresMissionStores.js';
import { createFileBackedSql } from './file-backed-sql-driver.js';

const START_MS = Date.parse('2026-10-27T09:00:00.000Z');
const TABLE = 'mission_controller_missions';

const temporaryDirs: string[] = [];
afterAll(() => {
  for (const dir of temporaryDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // temporary evidence is disposable
    }
  }
});

function durableFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vedmoulya-lease-deadline-'));
  temporaryDirs.push(dir);
  return path.join(dir, 'missions.json');
}

function makeClock(): { clock: ClockPort; set(ms: number): void; now(): number } {
  let nowMs = START_MS;
  return {
    clock: { now: () => new Date(nowMs).toISOString(), timestampMs: () => nowMs },
    set: (ms: number) => {
      nowMs = ms;
    },
    now: () => nowMs,
  };
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The production store over a real file-backed driver. */
function makeStore(file: string): PostgresMissionStore {
  return new PostgresMissionStore(createFileBackedSql(file).sql, TABLE);
}

async function seedRunningMission(service: MissionControllerService): Promise<string> {
  const mission = await service.createMission({
    userId: 'u1',
    title: 'Autonomous business engine',
    objective: 'to earn autonomously',
    initialObjectives: ['Publish the first revenue deliverable'],
  });
  await service.startMission(mission.missionId);
  return mission.missionId;
}

function serviceOver(
  store: PostgresMissionStore,
  clock: ClockPort,
  scheduler?: { schedule(t: () => Promise<void>): unknown; cancel(h: unknown): void },
): MissionControllerService {
  return new MissionControllerService({
    store,
    checkpointStore: new InMemoryCheckpointStore(),
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
      createPlan: async (goal: string) => ({
        planId: 'plan_1',
        goalId: 'goal_1',
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
        runId: 'run_1',
        success: true,
        verified: true,
        output: 'ok',
        usage: { tokens: 10, costUsd: 0.001, latencyMs: 5, toolCalls: 1 },
      }),
    },
    verifier: {
      verifyObjective: async () => ({
        verified: true,
        evidence: ['checks passed'],
        method: 'test_verification',
      }),
    },
    executionMemory: { recordVerifiedOutcome: async () => undefined },
    experienceOptimization: {
      getAdvisorySignal: async () => ({ confidence: 0.5, evidenceCount: 0 }),
    },
    failureClassifier: { classify: async (e, r, s) => classifyFailure(e, r, s) },
    clock,
    idGenerator: createIdGenerator(),
    ...(scheduler ? { leaseRenewalScheduler: scheduler } : {}),
  });
}

/**
 * A driver that counts statements and can hold a chosen statement open, so the
 * test controls exactly how long a queued write-through takes. Everything else
 * is delegated to the real file-backed driver.
 */
function gatedDriver(file: string) {
  const inner = createFileBackedSql(file);
  const sql = inner.sql as unknown as {
    (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
    json: (value: unknown) => unknown;
    begin: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  };
  const state = {
    /** Statements matching this predicate are held until `release()` is called. */
    gate: undefined as undefined | ((text: string) => boolean),
    gateOpen: true,
    held: 0,
    /** Artificial latency added to every statement (ms). */
    latencyMs: 0,
    statements: [] as string[],
  };
  let releaseHeld: (() => void) | undefined;
  const gatePromise = (): Promise<void> =>
    new Promise<void>((resolve) => {
      state.held += 1;
      releaseHeld = resolve;
    });

  const handler = ((strings: TemplateStringsArray | string, ...values: unknown[]) => {
    // Plain-call form `sql('identifier')` → an identifier fragment, never I/O.
    if (typeof strings === 'string') {
      return (sql as unknown as (s: string) => unknown)(strings);
    }
    const text = strings.join('?');
    state.statements.push(text);
    return (async (): Promise<unknown[]> => {
      if (state.gate?.(text) === true && !state.gateOpen) await gatePromise();
      if (state.latencyMs > 0) await delay(state.latencyMs);
      return (sql as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown[]>)(
        strings,
        ...values,
      );
    })();
  }) as unknown as Record<string, unknown>;

  handler['json'] = (value: unknown): unknown =>
    (sql as unknown as { json: (v: unknown) => unknown }).json(value);
  handler['begin'] = (cb: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
    (sql as unknown as { begin: (c: (tx: unknown) => Promise<unknown>) => Promise<unknown> }).begin(
      (tx) => cb(handler),
    );

  return {
    sql: handler as unknown as Parameters<typeof PostgresMissionStore.prototype.constructor>[0],
    state,
    open(): void {
      state.gateOpen = true;
      releaseHeld?.();
      releaseHeld = undefined;
    },
    close(predicate: (text: string) => boolean): void {
      state.gate = predicate;
      state.gateOpen = false;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// 1 · MEASUREMENT — what the renewal actually waits on
// ─────────────────────────────────────────────────────────────────────

describe('LEASE-DEADLINE · measurement of the renewal deadline', () => {
  it('renews in well under the budget when the write queue is empty', async () => {
    const file = durableFile();
    const time = makeClock();
    const store = makeStore(file, time.clock);
    const service = serviceOver(store, time.clock);
    const missionId = await seedRunningMission(service);

    const mission = await store.get(missionId);
    const objectiveId = mission?.objectives[0]?.objectiveId;
    expect(objectiveId).toBeDefined();
    const lease = {
      owner: 'mission-runtime',
      token: 'lease_measure_empty',
      acquiredAt: new Date(time.now()).toISOString(),
      expiresAt: new Date(time.now() + DEFAULT_LEASE_TTL_MS).toISOString(),
    };
    await store.acquireObjectiveLease(missionId, objectiveId as string, lease);

    const startedAt = performance.now();
    const renewed = await store.renewObjectiveLease(missionId, objectiveId as string, {
      owner: lease.owner,
      token: lease.token,
      nowMs: time.now(),
      expiresAt: new Date(time.now() + DEFAULT_LEASE_TTL_MS).toISOString(),
    });
    const elapsed = performance.now() - startedAt;

    expect(renewed).toBeDefined();
    // The statement itself is the whole cost when nothing is queued.
    expect(elapsed).toBeLessThan(1_000);
  });

  it('measures the renewal budget being consumed by queued writes, not by the renewal', async () => {
    const file = durableFile();
    const time = makeClock();
    const gated = gatedDriver(file);
    const store = new PostgresMissionStore(
      gated.sql as unknown as Parameters<typeof PostgresMissionStore.prototype.constructor>[0],
      TABLE,
    );
    const service = serviceOver(store, time.clock);
    const missionId = await seedRunningMission(service);
    const objectiveId = (await store.get(missionId))?.objectives[0]?.objectiveId as string;
    const lease = {
      owner: 'mission-runtime',
      token: 'lease_measure_cost',
      acquiredAt: new Date(time.now()).toISOString(),
      expiresAt: new Date(time.now() + DEFAULT_LEASE_TTL_MS).toISOString(),
    };
    await store.acquireObjectiveLease(missionId, objectiveId, lease);

    gated.close((text) => text.includes('INSERT INTO'));
    void store.save({
      ...(await store.get(missionId))!,
      updatedAt: new Date(time.now()).toISOString(),
    });
    await delay(10);

    const renewalStarted = performance.now();
    const renewal = store.renewObjectiveLease(missionId, objectiveId, {
      owner: lease.owner,
      token: lease.token,
      nowMs: time.now(),
      expiresAt: new Date(time.now() + DEFAULT_LEASE_TTL_MS).toISOString(),
    });

    // Hold the queue for 1 200 ms: the renewal makes NO progress in that time.
    await delay(1_200);
    gated.open();
    const renewed = await renewal;
    const renewalElapsed = performance.now() - renewalStarted;

    expect(renewed).toBeDefined();
    // Almost the whole elapsed time was spent waiting on the queue.
    expect(renewalElapsed).toBeGreaterThanOrEqual(1_100);
    // And the queue wait is attributable to the held upsert, which the renewal
    // never needed: the renewal statement itself is a different statement.
    expect(gated.state.statements.some((s) => s.includes('FOR UPDATE'))).toBe(true);
  });

  it('does NOT wait behind queued best-effort writes (the fixed path)', async () => {
    const file = durableFile();
    const time = makeClock();
    const gated = gatedDriver(file);
    const store = new PostgresMissionStore(
      gated.sql as unknown as Parameters<typeof PostgresMissionStore.prototype.constructor>[0],
      TABLE,
    );
    const service = serviceOver(store, time.clock);
    const missionId = await seedRunningMission(service);

    const mission = await store.get(missionId);
    const objectiveId = mission?.objectives[0]?.objectiveId as string;
    const lease = {
      owner: 'mission-runtime',
      token: 'lease_measure_queued',
      acquiredAt: new Date(time.now()).toISOString(),
      expiresAt: new Date(time.now() + DEFAULT_LEASE_TTL_MS).toISOString(),
    };
    await store.acquireObjectiveLease(missionId, objectiveId, lease);

    // Hold the next best-effort upsert open. Before the fix this is the drain
    // the renewal queued behind; now the renewal must not depend on it at all.
    gated.close((text) => text.includes('INSERT INTO'));
    void store.save({
      ...(await store.get(missionId))!,
      updatedAt: new Date(time.now()).toISOString(),
    });
    await delay(10);

    const startedAt = performance.now();
    const renewal = store.renewObjectiveLease(missionId, objectiveId, {
      owner: lease.owner,
      token: lease.token,
      nowMs: time.now(),
      expiresAt: new Date(time.now() + DEFAULT_LEASE_TTL_MS).toISOString(),
    });

    // The renewal settles while an unrelated write is still stuck: its budget
    // is now spent renewing, not waiting.
    const renewed = await renewal;
    const elapsed = performance.now() - startedAt;
    expect(renewed).toBeDefined();
    expect(elapsed).toBeLessThan(250);

    // …and the queued write is still held (proving it really was in flight).
    expect(gated.state.held).toBeGreaterThan(0);
    gated.open();
  });
});
