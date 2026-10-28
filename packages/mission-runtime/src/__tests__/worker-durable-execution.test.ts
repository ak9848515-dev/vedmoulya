// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — WORKER-01 · durable execution worker (LOCAL scope)
//
// These tests exercise the WORKER CONTRACT, not a production deployment:
//   • one objective per tick, terminal missions stop being claimed;
//   • two workers over the same DURABLE state never execute the same
//     objective twice (the objective lease decides, not the worker);
//   • a crashed worker's objective is recovered and completed exactly once;
//   • stop() prevents new claims.
//
// Durability is modelled with the SAME file-backed driver the mission-runtime
// restart suite uses: two independent store instances over ONE durable file,
// with only the SQL driver replaced (the production store classes are used
// unchanged). No production database is touched.
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_LEASE_TTL_MS,
  DeterministicObjectiveSelector,
  InMemoryCheckpointStore,
  InMemoryWorkspaceLeaseStore,
  MissionControllerService,
  SimpleGoalUnderstanding,
  classifyFailure,
  createIdGenerator,
} from '@vedmoulya/mission-controller';
import type { ClockPort, Mission } from '@vedmoulya/mission-controller';
import { PostgresMissionStore } from '../persistence/PostgresMissionStores.js';
import { createFileBackedSql } from './file-backed-sql-driver.js';
import { createLocalWorkerHarness } from '../worker/LocalWorkerHarness.js';

const START_MS = Date.parse('2026-10-27T09:00:00.000Z');
const MISSIONS_TABLE = 'mission_controller_missions';

const temporaryDirs: string[] = [];
afterAll(() => {
  for (const dir of temporaryDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // disposable evidence files
    }
  }
});

function durableFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vedmoulya-worker-'));
  temporaryDirs.push(dir);
  return path.join(dir, 'missions.json');
}

function makeClock(): { clock: ClockPort; set(ms: number): void; advance(ms: number): void } {
  let nowMs = START_MS;
  return {
    clock: {
      now: () => new Date(nowMs).toISOString(),
      timestampMs: () => nowMs,
    },
    set: (ms: number) => {
      nowMs = ms;
    },
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

function makeController(options: {
  store: PostgresMissionStore;
  clock: ClockPort;
  executions: string[];
  onExecute?: () => Promise<void> | void;
}): MissionControllerService {
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
    planner: {
      createPlan: async (goal: string) => ({
        planId: 'plan_worker_1',
        goalId: 'goal_worker_1',
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
        options.executions.push('execute');
        await options.onExecute?.();
        return {
          runId: `run_${String(options.executions.length)}`,
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
        evidence: ['checks passed'],
        method: 'test_verification',
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
    leaseTtlMs: DEFAULT_LEASE_TTL_MS,
  });
}

async function createStartedMission(
  controller: MissionControllerService,
  objectives: string[] = ['Do the work'],
): Promise<Mission> {
  const mission = await controller.createMission({
    userId: 'u1',
    title: 'Worker mission',
    objective: 'Execute durably',
    initialObjectives: objectives,
    workspace: '/authorized/workspace',
  });
  await controller.startMission(mission.missionId);
  return mission;
}

describe('WORKER-01 · the local durable-execution worker', () => {
  it('executes one objective per tick and stops claiming a terminal mission', async () => {
    const file = durableFile();
    const time = makeClock();
    const executions: string[] = [];
    const store = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    const controller = makeController({ store, clock: time.clock, executions });
    const harness = createLocalWorkerHarness({
      missions: store,
      controllerFactory: () => controller,
      clock: time.clock,
      instanceId: 'worker-1',
    });

    const mission = await createStartedMission(controller, ['First', 'Second']);

    const first = await harness.tick();
    expect(first.considered).toBe(1);
    expect(executions).toHaveLength(1);
    expect(first.progressed).toContain(mission.missionId);

    const second = await harness.tick();
    expect(executions).toHaveLength(2);
    expect(second.progressed).toContain(mission.missionId);

    const stored = (await store.get(mission.missionId))!;
    expect(stored.objectives.map((objective) => objective.state)).toEqual(['VERIFIED', 'VERIFIED']);

    // The next tick finds nothing selectable and finalises the mission.
    const completionTick = await harness.tick();
    expect(executions).toHaveLength(2); // no further execution
    expect((await store.get(mission.missionId))!.state).toBe('COMPLETED');
    expect(completionTick.completed).toContain(mission.missionId);

    const afterTerminal = await harness.tick();
    expect(executions).toHaveLength(2); // terminal missions are never claimed
    expect(afterTerminal.considered).toBe(0);
    expect(harness.status().ticks).toBe(4);
  });

  it('two workers over the same durable state never execute the same objective twice', async () => {
    const file = durableFile();
    const time = makeClock();
    const executions: string[] = [];
    const storeA = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    const storeB = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    await storeA.hydrate();
    await storeB.hydrate();

    const controllerA = makeController({ store: storeA, clock: time.clock, executions });
    const controllerB = makeController({ store: storeB, clock: time.clock, executions });
    const workspaceLeases = new InMemoryWorkspaceLeaseStore();
    const workerA = createLocalWorkerHarness({
      missions: storeA,
      workspaceLeases,
      controllerFactory: () => controllerA,
      clock: time.clock,
      instanceId: 'worker-a',
    });
    const workerB = createLocalWorkerHarness({
      missions: storeB,
      workspaceLeases,
      controllerFactory: () => controllerB,
      clock: time.clock,
      instanceId: 'worker-b',
    });

    const mission = await createStartedMission(controllerA, ['Only objective']);

    // Both workers tick the same mission in the same interval.
    await workerA.tick();
    await workerB.tick();

    expect(executions).toHaveLength(1); // exactly one execution
    const stored = (await storeA.get(mission.missionId))!;
    expect(stored.objectives[0]!.state).toBe('VERIFIED');
  });

  it("a crashed worker's objective is recovered and completed exactly once", async () => {
    const file = durableFile();
    const time = makeClock();
    const executions: string[] = [];

    // ── Worker A: starts executing, then its process "dies" (stops renewing).
    let releaseA: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    let enteredResolve: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => {
      enteredResolve = resolve;
    });
    const storeA = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    const controllerA = makeController({
      store: storeA,
      clock: time.clock,
      executions,
      onExecute: async () => {
        enteredResolve?.();
        await gate;
      },
    });
    const mission = await createStartedMission(controllerA, ['Survives a crash']);

    const crashedTick = controllerA.runNextObjective(mission.missionId); // no worker wrapper: it hangs
    await entered;

    // The lease TTL passes with no renewal — exactly what a killed process does.
    time.set(START_MS + DEFAULT_LEASE_TTL_MS + 1_000);

    // ── Fresh worker over the SAME durable file (a new process).
    const storeB = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    await storeB.hydrate();
    const controllerB = makeController({ store: storeB, clock: time.clock, executions });
    const workerB = createLocalWorkerHarness({
      missions: storeB,
      controllerFactory: () => controllerB,
      clock: time.clock,
      instanceId: 'worker-restarted',
    });

    const tick = await workerB.tick();
    expect(tick.recovered).toContain(mission.missionId);
    const recovered = (await storeB.get(mission.missionId))!;
    expect(recovered.objectives[0]!.state).toBe('VERIFIED');

    // The dead attempt finishes late: it is refused, and its result is not
    // duplicated or claimed as its own.
    releaseA?.();
    const late = await crashedTick;
    expect(late.objectives[0]!.state).toBe('VERIFIED');
    expect(executions).toHaveLength(2); // one crashed attempt + one real execution
    expect(recovered.objectives).toHaveLength(1);
    expect(recovered.objectives.filter((objective) => objective.state === 'VERIFIED')).toHaveLength(
      1,
    );
  });

  it('stop() prevents new claims and reports an honest status', async () => {
    const file = durableFile();
    const time = makeClock();
    const executions: string[] = [];
    const store = new PostgresMissionStore(createFileBackedSql(file).sql, MISSIONS_TABLE);
    const controller = makeController({ store, clock: time.clock, executions });
    const harness = createLocalWorkerHarness({
      missions: store,
      controllerFactory: () => controller,
      clock: time.clock,
      instanceId: 'worker-stopping',
    });
    await createStartedMission(controller, ['Never starts']);

    await harness.worker.stop('test shutdown');
    const result = await harness.tick();

    expect(executions).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('worker stopped');
    const status = harness.status();
    expect(status.running).toBe(false);
    expect(status.stoppedReason).toBe('test shutdown');
    expect(status.instanceId).toBe('worker-stopping');
  });
});
