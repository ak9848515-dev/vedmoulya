// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — CONNECT_TIMEOUT · connection-failure reliability
//
// Regression guard for the production failure
//   `Autonomous loop error: write CONNECT_TIMEOUT (address unavailable)`
// in the "Autonomous business engine" mission (objective: "to earn
// autonomously"), which started successfully and died ~98 s later.
//
// What these tests pin down (all deterministic — no real network, no DB):
//   1. a connection timeout is classified as a PERMANENT connection failure
//      and is NOT multiplied by the bounded retry budget (a retry storm
//      against an unreachable host is what made the outage last ~100 s);
//   2. a DROPPED connection is still retried (the transient case the budget
//      exists for) — the fix must not turn every error into "no retry";
//   3. the thrown RequiredPersistenceError CARRIES the driver error as
//      `cause`, so the code/address the driver resolved survive to the
//      activity trail instead of being flattened into a message;
//   4. a persistence failure inside one iteration HOLD the mission and the
//      autonomous loop then STOPS — it neither throws out of the loop (which
//      left the mission RUNNING with an orphaned lease) nor keeps burning the
//      same outage in a re-loop;
//   5. an unreachable destination is named honestly on the provider hold.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { MissionStore } from '../contracts/mission-ports.js';
import type { Mission, MissionObjective } from '../types/mission-types.js';
import {
  MissionControllerService,
  RequiredPersistenceError,
} from '../application/MissionControllerService.js';
import { DeterministicObjectiveSelector } from '../domain/objective-selector.js';

import { createIdGenerator } from '../infrastructure/IdGenerator.js';
import { createFakePorts, type FakePortsOptions } from './fixtures.js';

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

/** A connection failure shaped exactly like postgres.js's `Errors.connection`. */
function connectTimeoutError(): Error {
  return Object.assign(new Error('write CONNECT_TIMEOUT undefined:undefined'), {
    code: 'CONNECT_TIMEOUT',
    errno: 'CONNECT_TIMEOUT',
    address: 'db.internal',
    port: 5432,
  });
}

/**
 * Mirror + durable store (the real write-through contract) whose REQUIRED
 * writes fail with a configurable error. Every failure is counted so a test
 * can prove how many attempts the barrier actually made.
 */
class FailingMissionStore implements MissionStore {
  private mirror = new Map<string, Mission>();
  private durableState = new Map<string, Mission>();
  requiredAttempts = 0;
  failRequiredWith: (() => Error) | undefined;

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(mission: Mission): Promise<void> {
    this.mirror.set(mission.missionId, structuredClone(mission));
    if (this.failRequiredWith === undefined) {
      this.durableState.set(mission.missionId, structuredClone(mission));
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async saveRequired(mission: Mission): Promise<void> {
    this.requiredAttempts += 1;
    if (this.failRequiredWith) throw this.failRequiredWith();
    this.mirror.set(mission.missionId, structuredClone(mission));
    this.durableState.set(mission.missionId, structuredClone(mission));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async get(missionId: string): Promise<Mission | undefined> {
    const found = this.mirror.get(missionId);
    return found ? structuredClone(found) : undefined;
  }

  getSync(missionId: string): Mission | undefined {
    const found = this.mirror.get(missionId);
    return found ? structuredClone(found) : undefined;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listByUserId(userId: string): Promise<Mission[]> {
    return [...this.mirror.values()]
      .filter((mission) => mission.userId === userId)
      .map((mission) => structuredClone(mission));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listActive(): Promise<Mission[]> {
    return [...this.mirror.values()]
      .filter((mission) => !TERMINAL.has(mission.state))
      .map((mission) => structuredClone(mission));
  }

  durable(missionId: string): Mission | undefined {
    const found = this.durableState.get(missionId);
    return found ? structuredClone(found) : undefined;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async acquireObjectiveLease(
    missionId: string,
    objectiveId: string,
    lease: NonNullable<MissionObjective['lease']>,
  ): Promise<Mission | undefined> {
    const mission = this.durableState.get(missionId) ?? this.mirror.get(missionId);
    const objective = mission?.objectives.find((c) => c.objectiveId === objectiveId);
    if (!mission || !objective || !['PENDING', 'READY'].includes(objective.state)) {
      return undefined;
    }
    objective.state = 'RUNNING';
    objective.stateHistory.push('RUNNING');
    objective.lease = lease;
    objective.startedAt = objective.startedAt ?? lease.acquiredAt;
    const snapshot = structuredClone(mission);
    this.mirror.set(missionId, structuredClone(snapshot));
    this.durableState.set(missionId, structuredClone(snapshot));
    return structuredClone(snapshot);
  }
}

/** In-memory checkpoint store (the witness path is not under test here). */
class MemoryCheckpointStore {
  private readonly stored: Array<Record<string, unknown>> = [];

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(checkpoint: unknown): Promise<void> {
    this.stored.push(structuredClone(checkpoint) as Record<string, unknown>);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async saveRequired(checkpoint: unknown): Promise<void> {
    this.stored.push(structuredClone(checkpoint) as Record<string, unknown>);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getLatestForMission(): Promise<undefined> {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listForMission(): Promise<Array<Record<string, unknown>>> {
    return [];
  }
}

interface HarnessOptions extends FakePortsOptions {
  attempts?: number;
}

/** Lease TTL used by the harness (short, so expiry is expressible). */
const LEASE_TTL_MS = 1_000;

function harness(options: HarnessOptions = {}) {
  const store = new FailingMissionStore();
  const ports = createFakePorts(options);
  // Deterministic clock: lease liveness never depends on wall-clock timing.
  let nowMs = Date.parse('2026-01-01T00:00:00.000Z');
  const clock = {
    now: (): string => new Date(nowMs).toISOString(),
    timestampMs: (): number => nowMs,
    advance: (ms: number): void => {
      nowMs += ms;
    },
  };
  const service = new MissionControllerService({
    store,
    checkpointStore: new MemoryCheckpointStore() as never,
    objectiveSelector: new DeterministicObjectiveSelector(),
    providerAvailability: ports.providerAvailability,
    goalUnderstanding: ports.goalUnderstanding,
    planner: ports.planner,
    executor: ports.executor,
    verifier: ports.verifier,
    executionMemory: ports.executionMemory,
    experienceOptimization: ports.experienceOptimization,
    failureClassifier: ports.failureClassifier,
    clock,
    idGenerator: createIdGenerator(),
    leaseTtlMs: LEASE_TTL_MS,
    // Deterministic and instant: the retry BUDGET is what matters, not the delay.
    persistenceRetry: { attempts: options.attempts ?? 4, baseDelayMs: 0 },
  });
  return { service, store, ports, clock };
}

async function createRunningMission(service: MissionControllerService): Promise<Mission> {
  const mission = await service.createMission({
    userId: 'u1',
    title: 'Autonomous business engine',
    objective: 'to earn autonomously',
    initialObjectives: ['Publish the first revenue deliverable'],
  });
  await service.startMission(mission.missionId);
  return mission;
}

describe('CONNECT_TIMEOUT · permanent connection failures are not retried', () => {
  it('a connection timeout is attempted ONCE, not once per retry budget slot', async () => {
    const h = harness({ attempts: 4 });
    const mission = await createRunningMission(h.service);
    h.store.requiredAttempts = 0;
    h.store.failRequiredWith = connectTimeoutError;

    const held = await h.service.runNextObjective(mission.missionId);

    // The barrier made exactly ONE attempt: the host never accepted a
    // connection, so backing off and reconnecting cannot change the outcome.
    expect(h.store.requiredAttempts).toBe(1);
    // …and the attempt is still held honestly, never acknowledged as success.
    expect(held.state).toBe('BLOCKED');
    expect(held.outcome).toBeUndefined();
    expect(held.outcomeReason).toContain('CONNECT_TIMEOUT');
    expect(held.outcomeReason).toContain('NOT acknowledged as durable');
    expect(held.activity?.some((a) => a.kind === 'PERSISTENCE_FAILED')).toBe(true);
  });

  it('a DROPPED connection is still retried within the bounded budget', async () => {
    const h = harness({ attempts: 3 });
    const mission = await createRunningMission(h.service);
    h.store.requiredAttempts = 0;
    // The FIRST barrier (objective start) fails twice, then lands.
    let remaining = 2;
    h.store.failRequiredWith = () => {
      if (remaining === 0) throw new Error('should not be called after recovery');
      remaining -= 1;
      return Object.assign(new Error('write CONNECTION_CLOSED undefined:undefined'), {
        code: 'CONNECTION_CLOSED',
      });
    };

    await h.service.runNextObjective(mission.missionId);

    // The transient case keeps its retries: 2 failures + 1 success on the
    // objective-start barrier, then the result barrier lands first try. A
    // PERMANENT failure would have stopped after ONE attempt.
    expect(h.store.requiredAttempts).toBe(3);
    // Nothing was executed twice and the durable record is consistent.
    expect(h.store.durable(mission.missionId)?.objectives).toHaveLength(1);
  });

  it('the RequiredPersistenceError carries the driver error as `cause`', () => {
    // The barrier's rejection is the ONLY place the driver's code/address/port
    // can survive; flattening it into a message string is what produced the
    // bare `write CONNECT_TIMEOUT undefined:undefined` report.
    const driver = connectTimeoutError();
    const error = new RequiredPersistenceError('objective_start:obj-1', 1, driver);

    expect(error.cause).toBe(driver);
    expect((error.cause as { code?: string }).code).toBe('CONNECT_TIMEOUT');
    expect((error.cause as { address?: string }).address).toBe('db.internal');
    expect(error.message).toContain('write CONNECT_TIMEOUT');
  });
});

describe('CONNECT_TIMEOUT · the autonomous loop stops instead of re-looping an outage', () => {
  it('a persistence failure mid-loop is held once and does not throw out of the loop', async () => {
    let executeCount = 0;
    const h = harness({ onExecute: () => (executeCount += 1) });
    const mission = await createRunningMission(h.service);
    h.store.requiredAttempts = 0;
    h.store.failRequiredWith = connectTimeoutError;

    // Before the fix this REJECTED out of runAutonomousLoop, which the
    // detached loop reported as `Autonomous loop error: …` while leaving the
    // mission RUNNING and its objective leased but unowned.
    const result = await h.service.runAutonomousLoop(mission.missionId);

    expect(result.state).toBe('BLOCKED');
    expect(result.outcome).toBeUndefined();
    // One barrier attempt for the whole loop: no re-loop, no retry storm.
    expect(h.store.requiredAttempts).toBe(1);
    // Nothing ran and nothing was acknowledged as durable.
    expect(executeCount).toBe(0);
    const durable = h.store.durable(mission.missionId);
    expect(durable?.state).not.toBe('COMPLETED');
    expect(durable?.objectives.some((o) => o.state === 'VERIFIED')).toBe(false);
  });

  it('the held mission is resumable and completes once the destination recovers', async () => {
    let executeCount = 0;
    const h = harness({ onExecute: () => (executeCount += 1) });
    const mission = await createRunningMission(h.service);
    h.store.failRequiredWith = connectTimeoutError;
    const held = await h.service.runAutonomousLoop(mission.missionId);
    expect(held.state).toBe('BLOCKED');

    // Destination recovers: the operator resumes and the SAME work runs once.
    h.store.failRequiredWith = undefined;
    await h.service.resumeMission(mission.missionId);
    // The failed barrier left the objective leased to an attempt that ended
    // and is still inside its TTL, so recovery does NOT steal it. The lease
    // expiry is what makes the objective runnable again — exactly as after a
    // process crash — so the clock is advanced past the lease TTL.
    h.clock.advance(LEASE_TTL_MS + 1_000);
    await h.service.recoverMission(mission.missionId);
    const done = await h.service.runAutonomousLoop(mission.missionId);

    expect(done.state).toBe('COMPLETED');
    expect(executeCount).toBe(1);
    expect(h.store.durable(mission.missionId)?.objectives[0]?.state).toBe('VERIFIED');
  });
});

describe('CONNECT_TIMEOUT · unreachable destinations are named honestly', () => {
  it('a provider hold names the unreachable destination instead of hiding it', async () => {
    const store = new FailingMissionStore();
    const ports = createFakePorts();
    const service = new MissionControllerService({
      store,
      checkpointStore: new MemoryCheckpointStore() as never,
      objectiveSelector: new DeterministicObjectiveSelector(),
      // The port contract is `getProviderStatus`; the OPTIONAL destination
      // diagnostics live on the adapter (structural typing, no contract change).
      providerAvailability: Object.assign(
        {
          getProviderStatus: (): Promise<{
            available: boolean;
            capableProviders: [];
            unhealthyProviders: string[];
          }> =>
            Promise.resolve({
              available: false,
              capableProviders: [] as [],
              unhealthyProviders: ['gemini'],
            }),
        },
        {
          getUnreachableDestinations: (): Array<{ providerId: string; code: string }> => [
            { providerId: 'gemini', code: 'CONNECT_TIMEOUT' },
          ],
        },
      ),
      goalUnderstanding: ports.goalUnderstanding,
      planner: ports.planner,
      executor: ports.executor,
      verifier: ports.verifier,
      executionMemory: ports.executionMemory,
      experienceOptimization: ports.experienceOptimization,
      failureClassifier: ports.failureClassifier,
      clock: { now: () => new Date().toISOString(), timestampMs: () => Date.now() },
      idGenerator: createIdGenerator(),
      persistenceRetry: { attempts: 1, baseDelayMs: 0 },
    });
    const mission = await createRunningMission(service);

    const waiting = await service.runNextObjective(mission.missionId);

    expect(waiting.state).toBe('WAITING_FOR_PROVIDER');
    expect(waiting.outcomeReason).toContain('gemini(CONNECT_TIMEOUT)');
    // The hold is durable — a restart keeps the real reason.
    expect(store.durable(mission.missionId)?.outcomeReason).toContain('gemini(CONNECT_TIMEOUT)');
  });
});
