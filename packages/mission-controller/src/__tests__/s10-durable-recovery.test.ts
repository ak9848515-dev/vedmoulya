// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S10 · Durable continuation & recovery (crash windows)
//
// Proves the durability barrier and the honest failure semantics for the crash
// windows the sprint brief enumerates:
//   1. interruption before execution
//   2. interruption during execution (lease durable BEFORE any side effect)
//   3/5. execution+verification succeed but the result is not durably recorded
//   4. checkpoint AND verified-state persistence fail
//   6. memory/experience persistence fails after objective completion
//   8. concurrent recovery / retry attempts
//   9. terminal-state persistence fails
//  10. transient and exhausted persistence-write failures
//
// The harness models the REAL persistence contract of
// `WriteThroughDocumentStore` (the base of the Postgres mission stores):
//   • a synchronous MIRROR that every write updates and reads come from, and
//   • a DURABLE snapshot that only a write which actually LANDS updates.
// A best-effort `save()` during an outage updates the mirror but leaves the
// durable snapshot untouched (exactly what the real queued write does), which
// is what makes "assert durable state, not method calls" meaningful. Failure
// injection is deterministic (predicates/counters), never timing-based, and
// `restart()` rehydrates a fresh process from durable state alone.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { MissionStore, CheckpointStore } from '../contracts/mission-ports.js';
import type { Mission, MissionCheckpoint, MissionObjective } from '../types/mission-types.js';
import { MissionControllerService } from '../application/MissionControllerService.js';
import { DeterministicObjectiveSelector } from '../domain/objective-selector.js';
import { SystemClock } from '../infrastructure/SystemClock.js';
import { createIdGenerator } from '../infrastructure/IdGenerator.js';
import { createFakePorts, type FakePortsOptions } from './fixtures.js';

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

/**
 * Mission store modelling mirror + durable state, with deterministic failure
 * injection on the REQUIRED (durability-barrier) path.
 */
class HarnessMissionStore implements MissionStore {
  /** Synchronous mirror — every write, durable or not (reads come from here). */
  private mirror = new Map<string, Mission>();
  /** Durable state — only writes that actually LAND (a fresh process reads this). */
  private durableState = new Map<string, Mission>();
  readonly requiredOps: string[] = [];
  failRequiredAlways = false;
  failRequiredWhen: ((mission: Mission) => boolean) | undefined;
  failRequiredTimes = 0;
  /** When false an outage swallows the best-effort write too (never durable). */
  bestEffortLands = true;

  private shouldFailRequired(mission: Mission): boolean {
    if (this.failRequiredAlways) return true;
    if (this.failRequiredTimes > 0) {
      this.failRequiredTimes -= 1;
      return true;
    }
    return this.failRequiredWhen?.(mission) ?? false;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(mission: Mission): Promise<void> {
    // Best-effort: the mirror is always updated (the process keeps working);
    // durability only happens when the write actually lands.
    this.mirror.set(mission.missionId, structuredClone(mission));
    if (this.bestEffortLands && !this.failRequiredAlways) {
      this.durableState.set(mission.missionId, structuredClone(mission));
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async saveRequired(mission: Mission): Promise<void> {
    if (this.shouldFailRequired(mission)) throw new Error('simulated persistence outage');
    this.requiredOps.push(mission.missionId);
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

  /** Exactly what an independent, freshly-booted process would read. */
  durable(missionId: string): Mission | undefined {
    const found = this.durableState.get(missionId);
    return found ? structuredClone(found) : undefined;
  }

  /** Simulate a process restart: the mirror is rebuilt from durable state only. */
  restart(): void {
    this.mirror = new Map(
      [...this.durableState.entries()].map(([id, mission]) => [id, structuredClone(mission)]),
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async acquireObjectiveLease(
    missionId: string,
    objectiveId: string,
    lease: NonNullable<MissionObjective['lease']>,
  ): Promise<Mission | undefined> {
    // The real store performs this inside a transaction (SELECT … FOR UPDATE),
    // so it is both atomic and durable.
    const mission = this.durableState.get(missionId) ?? this.mirror.get(missionId);
    const objective = mission?.objectives.find((c) => c.objectiveId === objectiveId);
    if (!mission || !objective || !['PENDING', 'READY'].includes(objective.state)) {
      return undefined;
    }
    objective.state = 'RUNNING';
    objective.stateHistory.push('RUNNING');
    objective.lease = lease;
    objective.startedAt = objective.startedAt ?? lease.acquiredAt;
    objective.updatedAt = lease.acquiredAt;
    mission.updatedAt = lease.acquiredAt;
    const snapshot = structuredClone(mission);
    this.mirror.set(missionId, structuredClone(snapshot));
    this.durableState.set(missionId, snapshot);
    return structuredClone(snapshot);
  }
}

/** Checkpoint store with the same durable/barrier distinction. */
class HarnessCheckpointStore implements CheckpointStore {
  private readonly stored: MissionCheckpoint[] = [];
  failRequiredAlways = false;

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(checkpoint: MissionCheckpoint): Promise<void> {
    if (this.failRequiredAlways) return; // best-effort during an outage: not durable
    this.stored.push(structuredClone(checkpoint));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async saveRequired(checkpoint: MissionCheckpoint): Promise<void> {
    if (this.failRequiredAlways) throw new Error('simulated checkpoint outage');
    this.stored.push(structuredClone(checkpoint));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getLatestForMission(missionId: string): Promise<MissionCheckpoint | undefined> {
    const list = this.stored.filter((c) => c.missionId === missionId);
    return list.length > 0 ? structuredClone(list[list.length - 1]) : undefined;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listForMission(missionId: string): Promise<MissionCheckpoint[]> {
    return this.stored.filter((c) => c.missionId === missionId).map((c) => structuredClone(c));
  }
}

interface HarnessOptions extends FakePortsOptions {
  store?: HarnessMissionStore;
  checkpointStore?: HarnessCheckpointStore;
  attempts?: number;
  providerAvailable?: () => boolean;
  /** 0 makes every lease instantly expired (deterministic; no timing waits). */
  leaseTtlMs?: number;
}

function harness(options: HarnessOptions = {}) {
  const store = options.store ?? new HarnessMissionStore();
  const checkpointStore = options.checkpointStore ?? new HarnessCheckpointStore();
  const ports = createFakePorts(options);
  const providerAvailability = options.providerAvailable
    ? {
        getProviderStatus: (): Promise<{
          available: boolean;
          capableProviders: [];
          unhealthyProviders: [];
        }> =>
          Promise.resolve({
            available: options.providerAvailable?.() ?? true,
            capableProviders: [],
            unhealthyProviders: [],
          }),
      }
    : ports.providerAvailability;

  const service = new MissionControllerService({
    store,
    checkpointStore,
    objectiveSelector: new DeterministicObjectiveSelector(),
    providerAvailability,
    goalUnderstanding: ports.goalUnderstanding,
    planner: ports.planner,
    executor: ports.executor,
    verifier: ports.verifier,
    executionMemory: ports.executionMemory,
    experienceOptimization: ports.experienceOptimization,
    failureClassifier: ports.failureClassifier,
    clock: new SystemClock(),
    idGenerator: createIdGenerator(),
    // Deterministic and instant: the retry BUDGET is what matters, not the delay.
    persistenceRetry: { attempts: options.attempts ?? 3, baseDelayMs: 0 },
    ...(options.leaseTtlMs !== undefined ? { leaseTtlMs: options.leaseTtlMs } : {}),
  });
  return { service, store, checkpointStore, ports };
}

async function createRunningMission(
  service: MissionControllerService,
  objectives: string[] = ['Do the work'],
) {
  const mission = await service.createMission({
    userId: 'u1',
    title: 'S10 mission',
    objective: 'Continue safely',
    initialObjectives: objectives,
  });
  await service.startMission(mission.missionId);
  return mission;
}

describe('S10 · window 1 — interruption BEFORE execution', () => {
  it('an un-durable lease barrier executes nothing and never claims durable success', async () => {
    let executeCount = 0;
    const h = harness({ onExecute: () => (executeCount += 1) });
    const mission = await createRunningMission(h.service);

    // Total outage: no write can become durable.
    h.store.failRequiredAlways = true;
    h.store.bestEffortLands = false;
    const result = await h.service.runNextObjective(mission.missionId);

    // Nothing executed — the barrier is BEFORE the side effect.
    expect(executeCount).toBe(0);
    // The acknowledgement was withdrawn, not fabricated.
    expect(result.state).toBe('BLOCKED');
    expect(result.outcome).toBeUndefined();
    expect(result.outcomeReason).toContain('Durability barrier');
    expect(result.activity?.some((a) => a.kind === 'PERSISTENCE_FAILED')).toBe(true);
    // The DURABLE state claims neither verification nor a terminal outcome.
    const durable = h.store.durable(mission.missionId);
    expect(durable?.state).not.toBe('COMPLETED');
    expect(durable?.outcome).toBeUndefined();
    expect(durable?.objectives.some((o) => o.state === 'VERIFIED')).toBe(false);
    expect(durable?.objectives[0]?.verifiedOutcome).toBeUndefined();
  });

  it('self-heals after a restart once persistence recovers — no work is lost or duplicated', async () => {
    let executeCount = 0;
    const onExecute = (): void => {
      executeCount += 1;
    };
    const h = harness({ onExecute, leaseTtlMs: 0 });
    const mission = await createRunningMission(h.service);
    h.store.failRequiredAlways = true;
    h.store.bestEffortLands = false;
    const held = await h.service.runNextObjective(mission.missionId);
    expect(held.state).toBe('BLOCKED');
    expect(executeCount).toBe(0);

    // Persistence recovers and the process restarts: the fresh process sees
    // ONLY durable state (mission RUNNING, objective RUNNING, lease expired).
    h.store.failRequiredAlways = false;
    h.store.bestEffortLands = true;
    h.store.restart();
    const fresh = harness({
      store: h.store,
      checkpointStore: h.checkpointStore,
      onExecute,
      leaseTtlMs: 0,
    });

    // The EXISTING recovery path heals the abandoned objective and reports the
    // mission resumable, so the SAME loop continues it — no side effect ran.
    const recovery = await fresh.service.recoverAllActive();
    expect(recovery.resumableMissionIds).toContain(mission.missionId);
    const done = await fresh.service.runAutonomousLoop(mission.missionId);

    expect(done.state).toBe('COMPLETED');
    expect(executeCount).toBe(1);
    expect(h.store.durable(mission.missionId)?.objectives[0]?.state).toBe('VERIFIED');
  });
});

describe('S10 · window 2 — interruption DURING execution', () => {
  it('the objective lease is DURABLE before the executor is ever called', async () => {
    const observed: Array<{ state: string; leased: boolean }> = [];
    let missionId = '';
    const h = harness({
      onExecute: () => {
        const durable = h.store.durable(missionId);
        const objective = durable?.objectives[0];
        observed.push({
          state: objective?.state ?? 'MISSING',
          leased: objective?.lease !== undefined,
        });
      },
    });
    const mission = await createRunningMission(h.service);
    missionId = mission.missionId;
    await h.service.runNextObjective(mission.missionId);

    // At the moment of execution the durable snapshot already owned the
    // objective, so recovery can tell "ran" from "never ran".
    expect(observed).toHaveLength(1);
    expect(observed[0]?.state).toBe('RUNNING');
    expect(observed[0]?.leased).toBe(true);
  });

  it('the attempt-final result is durable before success is returned', async () => {
    const h = harness();
    const mission = await createRunningMission(h.service);
    const result = await h.service.runNextObjective(mission.missionId);

    expect(result.objectives[0]?.state).toBe('VERIFIED');
    const durable = h.store.durable(mission.missionId);
    expect(durable?.objectives[0]?.state).toBe('VERIFIED');
    expect(durable?.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    // Objective-start barrier + attempt-final barrier both became durable.
    expect(h.store.requiredOps.length).toBeGreaterThanOrEqual(2);
  });
});

describe('S10 · window 3/5 — result not durably recorded, checkpoint persists', () => {
  it('a durable checkpoint witness prevents re-executing a verified objective', async () => {
    let executeCount = 0;
    const h = harness({ onExecute: () => (executeCount += 1) });
    const mission = await createRunningMission(h.service);

    // The mission write fails exactly while the objective is VERIFIED (the
    // checkpoint write — a separate store — still lands first).
    h.store.failRequiredWhen = (m) => m.objectives.some((o) => o.state === 'VERIFIED');
    h.store.bestEffortLands = false;
    const held = await h.service.runNextObjective(mission.missionId);

    expect(executeCount).toBe(1);
    expect(held.state).toBe('BLOCKED');
    // The mission document does NOT claim the verified result...
    const durableBefore = h.store.durable(mission.missionId);
    expect(durableBefore?.objectives[0]?.state).not.toBe('VERIFIED');
    expect(durableBefore?.objectives[0]?.verifiedOutcome).toBeUndefined();
    // ...but the checkpoint DOES — it is the durable witness.
    const checkpoints = await h.checkpointStore.listForMission(mission.missionId);
    expect(checkpoints.some((c) => c.state === 'VERIFIED')).toBe(true);

    // ── Process restart: persistence healthy, fresh service, durable state only.
    h.store.failRequiredWhen = undefined;
    h.store.bestEffortLands = true;
    h.store.restart();
    const fresh = harness({ store: h.store, checkpointStore: h.checkpointStore });
    const resumed = await fresh.service.resumeFromCheckpoint(mission.missionId);

    expect(executeCount).toBe(1); // never re-executed
    expect(resumed.state).toBe('COMPLETED');
    expect(resumed.objectives[0]?.state).toBe('VERIFIED');
    expect(resumed.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    expect(resumed.activity?.some((a) => a.kind === 'CHECKPOINT_RESTORED')).toBe(true);
    expect(h.store.durable(mission.missionId)?.objectives[0]?.state).toBe('VERIFIED');
  });
});

describe('S10 · window 4 — checkpoint AND verified-state persistence fail', () => {
  it('nothing is acknowledged as durable and the mission is held for an operator', async () => {
    let executeCount = 0;
    const h = harness({ onExecute: () => (executeCount += 1) });
    const mission = await createRunningMission(h.service);

    // The objective-start barrier SUCCEEDS (so the objective really runs), then
    // BOTH witnesses for the verified result fail to persist.
    h.store.failRequiredWhen = (m) => m.objectives.some((o) => o.state === 'VERIFIED');
    h.store.bestEffortLands = false;
    h.checkpointStore.failRequiredAlways = true;
    const held = await h.service.runNextObjective(mission.missionId);

    expect(executeCount).toBe(1);
    expect(held.state).toBe('BLOCKED');
    expect(held.activity?.some((a) => a.kind === 'PERSISTENCE_FAILED')).toBe(true);
    // No durable claim of the verified result and no durable checkpoint.
    const durable = h.store.durable(mission.missionId);
    expect(durable?.objectives[0]?.verifiedOutcome).toBeUndefined();
    expect(durable?.objectives.some((o) => o.state === 'VERIFIED')).toBe(false);
    expect(durable?.outcome).toBeUndefined();
    expect(await h.checkpointStore.listForMission(mission.missionId)).toHaveLength(0);

    // A BLOCKED mission is NEVER auto-resumed by a recovery pass, and the
    // ambigious objective is not blindly re-executed.
    h.store.failRequiredWhen = undefined;
    h.store.bestEffortLands = true;
    h.checkpointStore.failRequiredAlways = false;
    const recovery = await h.service.recoverAllActive();
    expect(recovery.resumableMissionIds).not.toContain(mission.missionId);
    expect(executeCount).toBe(1);
  });
});

describe('S10 · window 6 — advisory persistence fails after completion', () => {
  it('a failing memory/experience port cannot destroy a verified objective', async () => {
    const ports = createFakePorts();
    const store = new HarnessMissionStore();
    const service = new MissionControllerService({
      store,
      checkpointStore: new HarnessCheckpointStore(),
      objectiveSelector: new DeterministicObjectiveSelector(),
      providerAvailability: ports.providerAvailability,
      goalUnderstanding: ports.goalUnderstanding,
      planner: ports.planner,
      executor: ports.executor,
      verifier: ports.verifier,
      executionMemory: {
        ...ports.executionMemory,
        recordVerifiedOutcome: () => Promise.reject(new Error('memory store down')),
      },
      experienceOptimization: {
        getAdvisorySignal: () => Promise.reject(new Error('experience store down')),
      },
      failureClassifier: ports.failureClassifier,
      clock: new SystemClock(),
      idGenerator: createIdGenerator(),
      persistenceRetry: { attempts: 3, baseDelayMs: 0 },
    });
    const mission = await createRunningMission(service);
    const done = await service.runAutonomousLoop(mission.missionId);

    // The mission completes on real evidence; the advisory failures are
    // recorded as absence, never as a false mission failure.
    expect(done.state).toBe('COMPLETED');
    expect(done.outcome).toBe('ACHIEVED');
    expect(done.stateHistory).not.toContain('FAILED');
    const durable = store.durable(mission.missionId);
    expect(durable?.objectives[0]?.state).toBe('VERIFIED');
    expect(durable?.state).toBe('COMPLETED');
  });
});

describe('S10 · window 8 — concurrent recovery / retry attempts', () => {
  it('two workers sharing the store execute the objective exactly once', async () => {
    let executeCount = 0;
    const store = new HarnessMissionStore();
    const checkpointStore = new HarnessCheckpointStore();
    const workerA = harness({ store, checkpointStore, onExecute: () => (executeCount += 1) });
    const workerB = harness({ store, checkpointStore, onExecute: () => (executeCount += 1) });
    const mission = await createRunningMission(workerA.service);

    // Both workers race for the SAME objective; the durable lease CAS admits one.
    await Promise.all([
      workerA.service.runNextObjective(mission.missionId),
      workerB.service.runNextObjective(mission.missionId),
    ]);

    expect(executeCount).toBe(1);
    const durable = store.durable(mission.missionId);
    expect(durable?.objectives.filter((o) => o.state === 'VERIFIED')).toHaveLength(1);
  });

  it('concurrent recovery passes heal an abandoned objective without duplicating it', async () => {
    let executeCount = 0;
    const h = harness({ onExecute: () => (executeCount += 1) });
    const mission = await createRunningMission(h.service);
    const firstObjectiveId = h.store.durable(mission.missionId)?.objectives[0]?.objectiveId;
    expect(firstObjectiveId).toBeDefined();
    // A crashed owner: the objective is RUNNING under an EXPIRED lease.
    await h.store.acquireObjectiveLease(mission.missionId, firstObjectiveId as string, {
      owner: 'crashed-worker',
      acquiredAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:01:00.000Z',
    });

    await Promise.all([
      h.service.reconcileAbandonedExecutions(),
      h.service.reconcileAbandonedExecutions(),
    ]);

    // Idempotent healing: exactly one READY objective, no lease, no execution.
    const healed = h.store.durable(mission.missionId);
    const objective = healed?.objectives.find((o) => o.objectiveId === firstObjectiveId);
    expect(objective?.state).toBe('READY');
    expect(objective?.lease).toBeUndefined();
    expect(healed?.objectives.filter((o) => o.state === 'RUNNING')).toHaveLength(0);
    expect(executeCount).toBe(0);
  });
});

describe('S10 · window 9 — terminal-state persistence fails', () => {
  it('a mission is never REPORTED terminal when its completion is not durable', async () => {
    const h = harness();
    const mission = await createRunningMission(h.service);
    // Fail only the TERMINAL write; the objective-level barriers succeed.
    h.store.failRequiredWhen = (m) =>
      m.objectives.every((o) => o.state === 'VERIFIED') && m.state === 'RUNNING';

    const result = await h.service.runAutonomousLoop(mission.missionId);

    // No fabricated terminal outcome, in memory or on disk.
    expect(result.state).not.toBe('COMPLETED');
    expect(result.outcome).toBeUndefined();
    const durable = h.store.durable(mission.missionId);
    expect(durable?.state).not.toBe('COMPLETED');
    expect(durable?.outcome).toBeUndefined();
    // The lifecycle event for the withdrawn transition was reverted with it.
    expect(result.activity?.some((a) => a.kind === 'MISSION_COMPLETED')).toBe(false);
    expect(result.activity?.some((a) => a.kind === 'PERSISTENCE_FAILED')).toBe(true);

    // Persistence recovers: the SAME durable state still derives completion.
    h.store.failRequiredWhen = undefined;
    const resumed = await h.service.resumeMission(mission.missionId);
    const completed = await h.service.runAutonomousLoop(resumed.missionId);

    expect(completed.state).toBe('COMPLETED');
    const durableAfter = h.store.durable(mission.missionId);
    expect(durableAfter?.state).toBe('COMPLETED');
    expect(durableAfter?.outcome).toBe('ACHIEVED');
  });
});

describe('S10 · window 10 — transient and exhausted write failures', () => {
  it('a transient outage is retried within the bounded budget and then succeeds', async () => {
    const h = harness({ attempts: 3 });
    const mission = await createRunningMission(h.service);
    h.store.failRequiredTimes = 2; // fails twice, then the 3rd attempt lands

    const result = await h.service.runNextObjective(mission.missionId);

    expect(result.state).not.toBe('BLOCKED');
    expect(result.objectives[0]?.state).toBe('VERIFIED');
    expect(result.activity?.some((a) => a.kind === 'PERSISTENCE_RETRIED')).toBe(true);
    expect(h.store.durable(mission.missionId)?.objectives[0]?.state).toBe('VERIFIED');
  });

  it('an exhausted budget is observable, bounded and never fabricates success', async () => {
    const h = harness({ attempts: 2 });
    const mission = await createRunningMission(h.service);
    h.store.failRequiredAlways = true;
    h.store.bestEffortLands = false;

    const result = await h.service.runNextObjective(mission.missionId);

    expect(result.state).toBe('BLOCKED');
    expect(result.outcomeReason).toContain('2 attempt(s)');
    expect(result.activity?.some((a) => a.kind === 'PERSISTENCE_FAILED')).toBe(true);
    expect(h.store.durable(mission.missionId)?.objectives[0]?.state).not.toBe('VERIFIED');
  });
});

describe('S10 · gates preserved', () => {
  it('the provider hold and pause semantics are unchanged by the barrier', async () => {
    let providerAvailable = true;
    const h = harness({ providerAvailable: () => providerAvailable });
    const mission = await createRunningMission(h.service);

    providerAvailable = false;
    const waiting = await h.service.runNextObjective(mission.missionId);
    // Still an explicit, persisted HOLD — not a block, not a failure.
    expect(waiting.state).toBe('WAITING_FOR_PROVIDER');
    expect(h.store.durable(mission.missionId)?.state).toBe('WAITING_FOR_PROVIDER');

    providerAvailable = true;
    const paused = await h.service.pauseMission(mission.missionId);
    expect(paused.state).toBe('PAUSED');
    const afterLoop = await h.service.runAutonomousLoop(mission.missionId);
    expect(afterLoop.state).toBe('PAUSED');
  });

  it('only acknowledgement transitions take a required write — reads never do', async () => {
    const h = harness();
    const mission = await createRunningMission(h.service);
    const before = h.store.requiredOps.length;

    await h.service.getStatus(mission.missionId, 'u1');
    h.service.status(mission.missionId);
    await h.service.recoverAllActive();

    expect(h.store.requiredOps.length).toBe(before);
  });
});
