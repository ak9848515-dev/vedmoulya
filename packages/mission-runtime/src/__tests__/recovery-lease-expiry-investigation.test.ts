// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — INVESTIGATION: the reported "RECOVERY LEASE EXPIRED" lifecycle
//
// WHAT IS REPRODUCED HERE
// -----------------------
// The dashboard evidence under investigation is:
//   • activity `RECOVERY_LEASE_EXPIRED`,
//   • one interrupted objective returned to `READY`,
//   • `Last verification: Unavailable`.
//
// This suite reproduces that sequence EXACTLY, deterministically, with two
// independent store instances over ONE durable database file (two "processes"
// sharing the production persistence path — PostgresMissionStore over
// WriteThroughDocumentStore, with only the SQL driver replaced; see
// file-backed-sql-driver.ts for why that substitution is honest):
//
//   A  acquires the objective lease and starts executing…
//   …A stops renewing (what a killed/frozen process does — it does NOT release
//     its lease, because a killed process runs no cleanup code)…
//   …the lease passes its TTL…
//   B  (a fresh process) hydrates the durable state, runs the production
//      recovery pass and observes RECOVERY_LEASE_EXPIRED + READY…
//   B  re-executes and verifies the objective…
//   A  finishes its now-unowned attempt and is refused (fencing)…
//
// It establishes, for the investigation:
//   1. recovery after a DEAD owner is correct, durable and idempotent;
//   2. `Last verification` is Unavailable because no objective holds a
//      `verifiedOutcome` at that moment (the API view maps evidence from it);
//   3. verification results ARE persisted and ARE readable by a fresh process;
//   4. two executions of the SAME objective really can overlap after expiry
//      (duplicate SIDE EFFECTS), while only ONE result is ever persisted.
//
// No production behaviour is changed and no repository work is executed: the
// executor is a fake.
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_LEASE_TTL_MS,
  DeterministicObjectiveSelector,
  InMemoryCheckpointStore,
  MissionControllerService,
  SimpleGoalUnderstanding,
  classifyFailure,
  createIdGenerator,
} from '@vedmoulya/mission-controller';
import type { ClockPort, Mission, MissionStore } from '@vedmoulya/mission-controller';
import type { AgentPlan } from '@vedmoulya/agent-execution';
import { PostgresMissionStore } from '../persistence/PostgresMissionStores.js';
import { createFileBackedSql } from './file-backed-sql-driver.js';

const START_MS = Date.parse('2026-10-27T09:00:00.000Z');
const MISSIONS_TABLE = 'mission_controller_missions';
const OBJECTIVE =
  'Improve the authorized workspace autonomously: inspect the repository, select high-value objectives, implement them, and verify the results.';

const temporaryDirs: string[] = [];

afterAll(() => {
  for (const dir of temporaryDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // temporary evidence files are disposable
    }
  }
});

function durableFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vedmoulya-lease-investigation-'));
  temporaryDirs.push(dir);
  return path.join(dir, 'missions.json');
}

/** A scheduler that NEVER fires: models a process that renews nothing. */
const frozenProcessScheduler = {
  schedule: (): unknown => ({ frozen: true }),
  cancel: (): void => undefined,
};

interface ProcessOptions {
  store: MissionStore;
  clock: ClockPort;
  /** Runs when the executor is entered. */
  onExecute?: () => Promise<void> | void;
}

function makeProcess(options: ProcessOptions): MissionControllerService {
  const plan: AgentPlan = {
    planId: 'plan_investigation_1',
    goalId: 'goal_investigation_1',
    objective: OBJECTIVE,
    steps: [],
    finalVerification: {
      kind: 'command',
      description: 'the test suite passes',
      command: { toolName: 'run_command', arguments: { command: 'test' }, expect: 'ok' },
    },
    completionCriteria: [],
  };
  return new MissionControllerService({
    store: options.store,
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
    planner: { createPlan: async () => plan },
    executor: {
      executePlan: async () => {
        await options.onExecute?.();
        return {
          runId: `run_${String(Date.now())}`,
          success: true,
          verified: true,
          output: 'ok',
          usage: { tokens: 10, costUsd: 0.001, latencyMs: 5, toolCalls: 1 },
        };
      },
    },
    verifier: {
      verifyObjective: async () => ({
        verified: true,
        evidence: ['run_command exit 0: test suite passed'],
        method: 'command_exit_status',
      }),
    },
    executionMemory: { recordVerifiedOutcome: async () => undefined },
    experienceOptimization: {
      getAdvisorySignal: async () => ({ confidence: 0.5, evidenceCount: 0 }),
    },
    failureClassifier: {
      classify: async (error, result, status) => classifyFailure(error, result, status),
    },
    clock: options.clock,
    idGenerator: createIdGenerator(),
    leaseRenewalScheduler: frozenProcessScheduler,
  });
}

function makeClock(): { clock: ClockPort; set(ms: number): void } {
  let nowMs = START_MS;
  return {
    clock: {
      now: () => new Date(nowMs).toISOString(),
      timestampMs: () => nowMs,
    },
    set: (ms: number) => {
      nowMs = ms;
    },
  };
}

function objectiveOf(mission: Mission | undefined, objectiveId: string) {
  return mission?.objectives.find((objective) => objective.objectiveId === objectiveId);
}

async function createRunningMission(controller: MissionControllerService): Promise<{
  missionId: string;
  objectiveId: string;
}> {
  const created = await controller.createMission({
    userId: 'u1',
    title: 'Build VedMoulya into a powerful autonomous AI platform',
    objective: OBJECTIVE,
    initialObjectives: [OBJECTIVE],
    workspace: '/authorized/workspace',
  });
  await controller.startMission(created.missionId);
  const mission = await controller.getMission(created.missionId);
  return {
    missionId: created.missionId,
    objectiveId: mission.objectives[0]!.objectiveId,
  };
}

describe('INVESTIGATION · the reported RECOVERY_LEASE_EXPIRED lifecycle', () => {
  it('expiry → READY → Last verification Unavailable → retry → VERIFIED, with no persisted duplicate', async () => {
    const file = durableFile();
    const time = makeClock();
    const executions: string[] = [];

    // ── Process A: creates the mission, starts it, then hangs mid-execution.
    let releaseA: (() => void) | undefined;
    const aGate = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    let aEnteredResolve: (() => void) | undefined;
    const aEntered = new Promise<void>((resolve) => {
      aEnteredResolve = resolve;
    });

    const storeA = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    const controllerA = makeProcess({
      store: storeA,
      clock: time.clock,
      onExecute: async () => {
        executions.push('A');
        aEnteredResolve?.();
        await aGate;
      },
    });

    const { missionId, objectiveId } = await createRunningMission(controllerA);
    let aSettled = false;
    const aAttempt = controllerA.runNextObjective(missionId).finally(() => {
      aSettled = true;
    });
    await aEntered; // A is genuinely inside the executor, holding the lease

    const runningForA = objectiveOf(await storeA.get(missionId), objectiveId);
    expect(runningForA?.state).toBe('RUNNING');
    expect(runningForA?.lease).toBeDefined();

    // A's process now dies (or is frozen): nothing renews, nothing releases.
    time.set(START_MS + DEFAULT_LEASE_TTL_MS + 1_000);

    // ── Process B: a FRESH process over the SAME durable database. ────────
    const storeB = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    await storeB.hydrate();
    const controllerB = makeProcess({
      store: storeB,
      clock: time.clock,
      onExecute: () => {
        executions.push('B');
      },
    });

    const beforeRecovery = objectiveOf(await storeB.get(missionId), objectiveId);
    expect(beforeRecovery?.state).toBe('RUNNING');
    expect(beforeRecovery?.lease).toBeDefined();

    const healed = await controllerB.recoverMission(missionId);
    const healedObjective = objectiveOf(healed, objectiveId);
    expect(healedObjective?.state).toBe('READY');
    expect(healedObjective?.lease).toBeUndefined();
    expect(healedObjective?.failureReason).toContain('durable lease expired');
    expect(healed.activity?.some((event) => event.kind === 'RECOVERY_LEASE_EXPIRED')).toBe(true);
    expect(
      healed.activity?.find((event) => event.kind === 'RECOVERY_LEASE_EXPIRED')?.message,
    ).toContain('1 interrupted objective(s) returned to READY after process interruption');

    // ── WHY `Last verification` READS "Unavailable" ───────────────────────
    // The API view maps `evidence` ONLY from `verifiedOutcome.evidence`
    // (services/api `MissionService.getStatus`). No objective has one here, so
    // the panel renders its "Unavailable" fallback: the objective was
    // interrupted BEFORE it verified anything — nothing was verified and lost.
    expect(healed.objectives.every((objective) => objective.verifiedOutcome === undefined)).toBe(
      true,
    );

    // ── B re-executes the recovered objective and verifies it. ────────────
    const verified = await controllerB.runNextObjective(missionId);
    const verifiedObjective = objectiveOf(verified, objectiveId);
    expect(verifiedObjective?.state).toBe('VERIFIED');
    expect(verifiedObjective?.verifiedOutcome?.evidence).toEqual([
      'run_command exit 0: test suite passed',
    ]);

    // ── A is STILL running at this instant: the executions overlapped. ────
    expect(aSettled).toBe(false);
    expect(executions).toEqual(['A', 'B']);

    // ── The verification result IS durable and IS readable fresh. ─────────
    const thirdProcess = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    await thirdProcess.hydrate();
    const restored = objectiveOf(await thirdProcess.get(missionId), objectiveId);
    expect(restored?.state).toBe('VERIFIED');
    expect(restored?.verifiedOutcome?.evidence).toEqual(['run_command exit 0: test suite passed']);

    // ── A finishes its now-unowned attempt. ───────────────────────────────
    releaseA?.();
    const aResult = await aAttempt;
    const afterA = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    await afterA.hydrate();
    const authoritative = await afterA.get(missionId);

    // Exactly ONE objective and ONE verified result exist; A's late result was
    // refused by its fencing token and never overwrote B's.
    expect(authoritative?.objectives).toHaveLength(1);
    expect(
      authoritative?.objectives.filter((objective) => objective.state === 'VERIFIED'),
    ).toHaveLength(1);
    expect(objectiveOf(authoritative, objectiveId)?.verifiedOutcome?.evidence).toEqual([
      'run_command exit 0: test suite passed',
    ]);
    // A's returned view is the authoritative (B's) record — never a stale win…
    expect(objectiveOf(aResult, objectiveId)?.state).toBe('VERIFIED');
    // …and the loss is recorded honestly on the durable trail.
    expect(authoritative?.activity?.some((event) => event.kind === 'OBJECTIVE_LEASE_LOST')).toBe(
      true,
    );

    // ── CAVEAT (reported, not asserted as a defect): an instance that does
    // not re-hydrate keeps its boot-time mirror, so it never observes another
    // process's later commits. `thirdProcess` was hydrated before A's refusal
    // landed and therefore has no OBJECTIVE_LEASE_LOST event; a fresh hydrate
    // does. Reads are mirror-only by design (WriteThroughDocumentStore.read).
    expect(
      (await thirdProcess.get(missionId))?.activity?.some(
        (event) => event.kind === 'OBJECTIVE_LEASE_LOST',
      ),
    ).not.toBe(true);
  });

  it('does NOT heal a LIVE lease — the TTL is a detection window, not the cause', async () => {
    const file = durableFile();
    const time = makeClock();
    const store = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    const controller = makeProcess({ store, clock: time.clock });
    const { missionId, objectiveId } = await createRunningMission(controller);

    await store.acquireObjectiveLease(missionId, objectiveId, {
      owner: 'mission-runtime',
      token: 'lease_live',
      acquiredAt: new Date(time.clock.timestampMs()).toISOString(),
      expiresAt: new Date(time.clock.timestampMs() + DEFAULT_LEASE_TTL_MS).toISOString(),
    });

    // Inside the TTL, the objective is owned: recovery leaves it completely
    // alone and records no interruption.
    const insideTtl = await controller.recoverMission(missionId);
    expect(objectiveOf(insideTtl, objectiveId)?.state).toBe('RUNNING');
    expect(insideTtl.activity?.some((event) => event.kind === 'RECOVERY_LEASE_EXPIRED')).not.toBe(
      true,
    );

    // One millisecond past the TTL it is treated as abandoned.
    time.set(time.clock.timestampMs() + DEFAULT_LEASE_TTL_MS + 1);
    const afterTtl = await controller.recoverMission(missionId);
    expect(objectiveOf(afterTtl, objectiveId)?.state).toBe('READY');
    expect(afterTtl.activity?.some((event) => event.kind === 'RECOVERY_LEASE_EXPIRED')).toBe(true);
  });
});
