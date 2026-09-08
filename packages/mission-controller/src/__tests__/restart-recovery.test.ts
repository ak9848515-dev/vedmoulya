// VedMoulya - Mission Controller: BLD-025 Restart Recovery & Hardening
//
// Unit-level verification of the BLD-025 recovery semantics owned by the
// MissionControllerService itself:
//   * discovery-driven restart recovery(no pre-planned objectives:the next
//     objective is discovered from ACTUAL repository state after a restart),
//   * crash recovery at defined boundaries(lease persisted before unsafe
//     continuation: a live lease is never re-run: an expired lease is healed),
//   * duplicate execution prevention(VERIFIED objectives never re-execute),
//   * runtime/replan budget durability across restarts,
//   * infinite-loop protection(replan budget caps identical re-attempts),
//   * approval-wait durability across restart(no auto-execution while held),
//   * stale-objective / external-change detection(SKIP, never VERIFY),
//   * minimal watch dog(stuck RUNNING -> recoverable BLOCKED).
//
// Controllers are restarted by constructing a NEW MissionControllerService
// over the SAME authoritative stores - the only restart boundary a unit test
// needs to model. No second loop, no new architecture: every execution still
// goes through the frozen selector/planner/executor/verifier chain.

import { describe, expect, it } from 'vitest';
import {
  MissionControllerService,
  InMemoryMissionStore,
  InMemoryCheckpointStore,
  DevelopmentObjectiveSelector,
  SimpleGoalUnderstanding,
  createIdGenerator,
} from '../index.js';
import type {
  ClockPort,
  MissionObjective,
  MissionStore,
  RepositoryInspectionPort,
  RepositoryInspectionResult,
} from '../index.js';
import { createTestPlan, createTestProviderStatus } from './fixtures.js';

// Deterministic fake repository inspector -------------------------------------
class FakeRepoInspector implements RepositoryInspectionPort {
  todos: string[] = [];
  failingTests: string[] = [];
  incompletePackages: string[] = [];
  missingIntegrations: string[] = [];
  architecturalGaps: string[] = [];

  constructor(initial: { todos?: string[]; failingTests?: string[] } = {}) {
    this.todos = initial.todos ?? [];
    this.failingTests = initial.failingTests ?? [];
  }

  async inspectRepository(): Promise<RepositoryInspectionResult> {
    return {
      failingTests: this.failingTests,
      incompletePackages: this.incompletePackages,
      missingIntegrations: this.missingIntegrations,
      architecturalGaps: this.architecturalGaps,
      todos: this.todos,
      gitStatus: { clean: true, branch: 'main', modifiedFiles: [] },
    };
  }
}

interface TestHarnessOptions {
  stores?: { missions?: MissionStore; checkpoints?: InMemoryCheckpointStore };
  inspector?: FakeRepoInspector;

  /** Advance the fake wall-clock by this amount on every execution attempt. */
  clockTickMs?: number;
  executorThrows?: string;
  /** Classify executor failures as transient (bounded retry path). */
  transientFailure?: boolean;
  approvalGate?: (objective: MissionObjective, error: string) => boolean | Promise<boolean>;
}

interface TestHarness {
  service: MissionControllerService;
  service2: MissionControllerService;
  missions: InMemoryMissionStore;
  checkpoints: InMemoryCheckpointStore;

  executions: string[];
  advanceMs(ms: number): void;
}
function makeHarness(options: TestHarnessOptions = {}): TestHarness {
  const missions = (options.stores?.missions ?? new InMemoryMissionStore()) as InMemoryMissionStore;

  const checkpoints = (options.stores?.checkpoints ??
    new InMemoryCheckpointStore()) as InMemoryCheckpointStore;

  // A controllable wall-clock so runtime-budget accumulation is deterministic.
  let nowMs = 1_000_000;
  const advanceMs = (ms: number) => {
    nowMs += ms;
  };

  const clock: ClockPort = {
    now: () => new Date(nowMs).toISOString(),
    timestampMs: () => nowMs,
  };

  const inspector = options.inspector ?? new FakeRepoInspector();
  const selector = new DevelopmentObjectiveSelector(inspector);

  const executions: string[] = [];
  const doExecute = (plan: { objective?: string }) => {
    // The work item actually executed (deterministic identifier).
    const work = inspector.todos[0] ?? plan.objective ?? '?';
    executions.push(work);
    if (options.clockTickMs) advanceMs(options.clockTickMs);
    if (options.executorThrows) throw new Error(options.executorThrows);

    // Simulate the workspace mutation:athe resolved TODO disappears from the
    // ACTUAL repository state (so discovery on the next phase does not re-create
    // an already-completed objective).
    inspector.todos.shift();
    return {
      runId: `run_${executions.length}`,
      success: true,
      verified: true,
      output: 'All checks passed',
      usage: { tokens: 100, costUsd: 0.01, latencyMs: 50, toolCalls: 1 },
    };
  };

  const failureClassifier = options.transientFailure
    ? {
        classify: async () => ({
          failureClass: 'TRANSIENT_TOOL',
          recoverable: true,
          reason: 'Tool execution failed - may succeed on retry',
          suggestedAction: 'RETRY',
          evidence: [],
        }),
      }
    : {
        classify: async () => ({
          failureClass: 'UNKNOWN',
          recoverable: false,
          reason: 'Unknown',
          suggestedAction: 'FAIL',
          evidence: [],
        }),
      };

  const makeService = (): MissionControllerService =>
    new MissionControllerService({
      store: missions,
      checkpointStore: checkpoints,
      objectiveSelector: selector,
      providerAvailability: {
        getProviderStatus: async (requiredCapabilities: string[]) =>
          createTestProviderStatus({
            available: true,
            capableProviders: [
              {
                providerId: 'mock',
                modelId: 'mock-1',
                capabilities: requiredCapabilities,
                healthy: true,
              },
            ],
          }),
      },
      goalUnderstanding: new SimpleGoalUnderstanding(),
      planner: {
        createPlan: async (goal: string) => ({ ...createTestPlan(), objective: goal }),
      },
      executor: {
        executePlan: async (plan: { objective?: string }) => doExecute(plan),
      },
      verifier: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        verifyObjective: async (_objective: MissionObjective, result: { success: boolean }) => ({
          verified: result.success,
          evidence: ['All checks passed'],
          method: 'test_verification',
        }),
      },
      executionMemory: { recordVerifiedOutcome: async () => undefined },
      experienceOptimization: {
        getAdvisorySignal: async () => ({
          recommendation: 'proceed',
          confidence: 0.9,
          evidenceCount: 0,
          reason: 'No prior evidence',
        }),
      },
      failureClassifier,
      clock,
      idGenerator: createIdGenerator(),
      repositoryInspector: inspector,
      approvalGate: options.approvalGate,
      leaseTtlMs: 50,
    });

  // "Restart":a fresh controller over the SAME authoritative stores.

  const service = makeService();
  const service2 = makeService();
  return { service, service2, missions, checkpoints, executions, advanceMs };
}

// BLD-025 scenarios -----------------------------------------------------------

describe('BLD-025 restart recovery (discovery-driven)', () => {
  it('discovers objective 1, crashes, restarts, discovers objective 2 from the CURRENT repository - no duplicate of objective 1, no second prompt', async () => {
    const inspector = new FakeRepoInspector({ todos: ['todo-alpha', 'todo-beta'] });
    const h = makeHarness({ inspector });
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'Long-running mission',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace: '/ws',
      initialObjectives: [],
    });
    await h.service.startMission(mission.missionId);

    // Objective 1 is DISCOVERED from repo state (no pre-planned objectives).
    // One loop iteration = one objective; then the "process crash".
    const afterOne = await h.service.runNextObjective(mission.missionId);
    expect(afterOne.objectives).toHaveLength(1);
    expect(afterOne.objectives[0]?.state).toBe('VERIFIED');
    expect(afterOne.objectives[0]?.title).toContain('todo-alpha');
    expect(h.executions).toHaveLength(1);

    // "Process crash" - a fresh controller over the SAME durable stores.
    const recovered = await h.service2.recoverMission(mission.missionId);
    expect(recovered.state).toBe('RUNNING'); // never terminal-reopened
    expect(recovered.objectives[0]?.state).toBe('VERIFIED'); // verified history restored

    // The loop continues: the next objective is DISCOVERED from the CURRENT
    // repository (todo-alpha was resolved; todo-beta is next), executed,
    // verified, checkpointed - with no second user prompt.
    const completed = await h.service2.runAutonomousLoop(mission.missionId);
    expect(completed.state).toBe('COMPLETED');
    expect(completed.objectives).toHaveLength(2);
    expect(completed.objectives.map((o) => o.state)).toEqual(['VERIFIED', 'VERIFIED']);
    expect(completed.budgetUsage.objectivesCompleted).toBe(2);
    // Exactly one execution per objective - objective 1 was NEVER re-run.
    expect(h.executions.filter((e) => e.includes('todo-alpha'))).toHaveLength(1);
  });

  it('an objective interrupted between objectives is recovered safely after restart - verified history restored, next objective runs once', async () => {
    const h = makeHarness();
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'Crash between objectives',
      objective: 'Do the work',
      initialObjectives: ['First', 'Second'],
    });
    await h.service.startMission(mission.missionId);
    await h.service.runNextObjective(mission.missionId); // First VERIFIED + checkpoint

    const recovered = await h.service2.recoverMission(mission.missionId);
    expect(recovered.objectives[0]?.state).toBe('VERIFIED');

    const done = await h.service2.runAutonomousLoop(mission.missionId);
    expect(done.state).toBe('COMPLETED');
    expect(done.objectives[1]?.state).toBe('VERIFIED');
    expect(h.executions).toEqual(['First', 'Second']); // each exactly once
  });
});

describe('BLD-025 objective lease / execution ownership', () => {
  it('cross-controller lease acquisition has exactly one winner', async () => {
    const h = makeHarness();
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Single objective'],
    });
    await h.service.startMission(mission.missionId);

    const lease = {
      owner: 'worker-a',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const objectiveId = mission.objectives[0]!.objectiveId;
    const winners = await Promise.all([
      h.missions.acquireObjectiveLease!(mission.missionId, objectiveId, lease),
      h.missions.acquireObjectiveLease!(mission.missionId, objectiveId, {
        ...lease,
        owner: 'worker-b',
      }),
    ]);

    expect(winners.filter((winner) => winner !== undefined)).toHaveLength(1);
    const stored = (await h.missions.get(mission.missionId))!;
    expect(stored.objectives[0]?.state).toBe('RUNNING');
    expect(['worker-a', 'worker-b']).toContain(stored.objectives[0]?.lease?.owner);
  });

  it('serializes concurrent objective acquisition so only one execution occurs', async () => {
    const h = makeHarness();
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Single objective'],
    });
    await h.service.startMission(mission.missionId);

    await Promise.all([
      h.service.runNextObjective(mission.missionId),
      h.service.runNextObjective(mission.missionId),
    ]);

    expect(h.executions).toEqual(['Single objective']);
    const stored = (await h.missions.get(mission.missionId))!;
    expect(stored.objectives[0]?.state).toBe('VERIFIED');
  });

  it('a RUNNING objective with a LIVE lease is never touched by recovery', async () => {
    const h = makeHarness();
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Owned objective'],
    });
    await h.service.startMission(mission.missionId);

    const stored = (await h.missions.get(mission.missionId))!;
    stored.objectives[0]!.state = 'RUNNING';
    stored.objectives[0]!.lease = {
      owner: 'another-worker',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    stored.updatedAt = new Date().toISOString();
    await h.missions.save(stored);

    await h.service2.recoverMission(mission.missionId);
    const after = (await h.missions.get(mission.missionId))!;
    expect(after.objectives[0]?.state).toBe('RUNNING'); // untouched
    expect(after.objectives[0]?.lease?.owner).toBe('another-worker');
    expect(h.executions).toHaveLength(0);
  });

  it('a RUNNING objective with an EXPIRED lease is healed to READY and re-executed exactly once', async () => {
    const h = makeHarness();
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Recoverable objective'],
    });
    await h.service.startMission(mission.missionId);

    // Simulated crash mid-execution: RUNNING + expired lease persisted.
    const stored = (await h.missions.get(mission.missionId))!;
    stored.objectives[0]!.state = 'RUNNING';
    stored.objectives[0]!.lease = {
      owner: 'dead-worker',
      acquiredAt: new Date(0).toISOString(),
      expiresAt: new Date(0).toISOString(),
    };
    stored.updatedAt = new Date(0).toISOString();
    await h.missions.save(stored);

    const recovered = await h.service2.recoverMission(mission.missionId);
    expect(recovered.objectives[0]?.state).toBe('READY'); // healed to recoverable
    expect(recovered.objectives[0]?.lease).toBeUndefined();
    expect(h.executions).toHaveLength(0); // nothing re-executed yet

    await h.service2.runAutonomousLoop(mission.missionId);
    expect(h.executions).toHaveLength(1); // exactly once - no duplicates
    const done = (await h.missions.get(mission.missionId))!;
    expect(done.objectives[0]?.state).toBe('VERIFIED');
  });
});

describe('BLD-025 budget durability across restart', () => {
  it('runtime budget accumulates, survives restart, and the ceiling stops further objectives', async () => {
    const h = makeHarness({ clockTickMs: 5_000 });
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'Bounded mission',
      objective: 'Do bounded work',
      initialObjectives: ['First', 'Second', 'Third'],
      budget: { maxRuntimeMs: 8_000 },
    });
    await h.service.startMission(mission.missionId);

    // Objective 1 consumes 5s of the 8s budget.
    const afterOne = await h.service.runNextObjective(mission.missionId);
    expect(afterOne.budgetUsage.runtimeMs).toBe(5_000);
    const storedBefore = (await h.missions.get(mission.missionId))!;
    expect(storedBefore.budgetUsage.runtimeMs).toBe(5_000); // durable

    // "Restart": fresh controller over the same stores; usage must NOT reset.
    const completed = await h.service2.runAutonomousLoop(mission.missionId);
    // Objective 2 consumed another 5s (10s > 8s cap); the hard ceiling stops
    // before a THIRD objective can be consumed.
    expect(completed.budgetUsage.runtimeMs).toBe(10_000);
    expect(completed.budgetUsage.objectivesCompleted).toBe(2);
    expect(completed.state).toBe('FAILED');
    expect(completed.outcomeReason).toContain('Maximum runtime');
  });
});

describe('BLD-025 infinite-loop protection', () => {
  it('an objective failing identically is capped by the replan budget - never an unbounded repeat', async () => {
    const h = makeHarness({
      executorThrows: 'tool failed: run_tests crashed',
      transientFailure: true,
      clockTickMs: 1,
    });
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'Loop protection',
      objective: 'Flaky work',
      initialObjectives: ['Flaky objective'],
      budget: { maxReplans: 2, maxRetries: 5 },
    });
    await h.service.startMission(mission.missionId);

    const result = await h.service.runAutonomousLoop(mission.missionId);
    // The replan budget (2) caps re-attempts NO MATTER the retry budget (5):
    expect(result.budgetUsage.replansConsumed).toBe(2);
    expect(result.budgetUsage.retriesConsumed).toBe(2);
    expect(result.objectives[0]?.retryCount).toBe(2);
    expect(result.objectives[0]?.verifiedOutcome).toBeUndefined();
    expect(result.state).toBe('FAILED');
  });
});

describe('BLD-025 approval wait durability', () => {
  it('approval gate holds across restart; APPROVE resumes through the normal chain; REJECT fails honestly', async () => {
    const h = makeHarness({
      executorThrows: 'permission denied: cannot write /etc',
      clockTickMs: 1,
      approvalGate: async () => true,
    });
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'Approval mission',
      objective: 'High-risk work',
      initialObjectives: ['Write protected config'],
    });
    await h.service.startMission(mission.missionId);

    const waiting = await h.service.runNextObjective(mission.missionId);
    expect(waiting.state).toBe('WAITING_FOR_APPROVAL');
    expect(h.executions).toHaveLength(1);

    // Restart: the approval hold persists - nothing executes automatically.
    const recovered = await h.service2.recoverMission(mission.missionId);
    expect(recovered.state).toBe('WAITING_FOR_APPROVAL');
    expect(h.executions).toHaveLength(1);

    // Operator approves -> the frozen state machine resumes and the objective
    // re-runs through the normal verification chain (the gate re-triggers).
    const approved = await h.service2.approveObjective(
      mission.missionId,
      recovered.objectives[0]?.objectiveId ?? '',
    );
    expect(approved.state).toBe('RUNNING');
    const afterLoop = await h.service2.runAutonomousLoop(mission.missionId);
    expect(h.executions).toHaveLength(2);
    expect(afterLoop.state).toBe('WAITING_FOR_APPROVAL'); // gate re-triggers honestly

    // Reject path (fresh mission): the human no is final - FAILED.
    const h2 = makeHarness({
      executorThrows: 'permission denied: cannot write /etc',
      clockTickMs: 1,
      approvalGate: async () => true,
    });
    const m2 = await h2.service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Write protected config'],
    });
    await h2.service.startMission(m2.missionId);
    const waiting2 = await h2.service.runNextObjective(m2.missionId);
    const rejected = await h2.service.rejectObjective(
      m2.missionId,
      waiting2.objectives[0]?.objectiveId ?? '',
    );
    expect(rejected.state).toBe('FAILED');
  });
});

describe('BLD-025 stale objective / external change detection', () => {
  it('an objective whose repository evidence disappeared is SKIPPED - never re-executed, never VERIFIED', async () => {
    const inspector = new FakeRepoInspector({ failingTests: ['broken-test'] });
    const h = makeHarness({ inspector });
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'Stale mission',
      objective: 'Improve workspace',
      mode: 'DEVELOPMENT',
      workspace: '/ws',
      initialObjectives: ['Fix failing test: broken-test'],
    });
    await h.service.startMission(mission.missionId);
    expect(h.executions).toHaveLength(0); // not executed yet

    // External actor resolved the failing test while the mission was paused.
    inspector.failingTests = [];

    const recovered = await h.service2.recoverMission(mission.missionId);
    expect(recovered.objectives[0]?.state).toBe('SKIPPED'); // stale detected
    expect(recovered.objectives[0]?.verifiedOutcome).toBeUndefined(); // never fabricated
    expect(h.executions).toHaveLength(0); // the objective was never re-run

    // Nothing selectable remains -> the mission completes honestly.
    const done = await h.service2.runAutonomousLoop(mission.missionId);
    expect(done.objectives[0]?.state).toBe('SKIPPED');
    expect(done.state).toBe('COMPLETED');
  });
});

describe('BLD-025 watchdog (stuck mission)', () => {
  it('a RUNNING mission with no live lease and no progress becomes BLOCKED (recoverable)', async () => {
    const h = makeHarness();
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Pending work'],
    });
    await h.service.startMission(mission.missionId);

    // Age the persisted mission: RUNNING since the epoch, no owner, no progress
    // (the harness fake clock sits just after the epoch, so this is stale).
    const stored = (await h.missions.get(mission.missionId))!;
    stored.updatedAt = '1970-01-01T00:00:00.000Z';
    await h.missions.save(stored);

    const result = await h.service2.detectStuckMission(mission.missionId, 0);
    expect(result?.state).toBe('BLOCKED');
    expect(result?.outcomeReason).toContain('no progress');
  });

  it('a RUNNING mission with a live lease is NOT marked stuck (an owner is executing)', async () => {
    const h = makeHarness();
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'T',
      objective: 'O',
      initialObjectives: ['Long objective'],
    });
    await h.service.startMission(mission.missionId);

    const stored = (await h.missions.get(mission.missionId))!;
    stored.objectives[0]!.state = 'RUNNING';
    stored.objectives[0]!.lease = {
      owner: 'live-worker',
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    stored.updatedAt = '1970-01-01T00:00:00.000Z';
    await h.missions.save(stored);

    const result = await h.service2.detectStuckMission(mission.missionId, 0);
    expect(result).toBeUndefined();
  });
});

describe('BLD-025 recovery isolation (one poisoned mission never aborts the pass)', () => {
  it('recoverAllActive isolates a mission whose workspace can no longer be inspected — other missions still recover', async () => {
    // Inspector that REFUSES the poisoned workspace (e.g. deleted after an
    // operator config change / workspace moved) while serving healthy ones.
    class PartialInspector extends FakeRepoInspector {
      override async inspectRepository(
        workspacePath?: string,
      ): Promise<RepositoryInspectionResult> {
        if (workspacePath === '/poisoned') {
          throw new Error('workspace path escapes the authorized root: /poisoned');
        }
        return super.inspectRepository(workspacePath);
      }
    }
    const h = makeHarness({ inspector: new PartialInspector() });

    // Mission A: its persisted workspace can no longer be inspected (a
    // PENDING repo-derived objective forces the inspection on recovery).
    const poisoned = await h.service.createMission({
      userId: 'u1',
      title: 'Poisoned',
      objective: 'Do work',
      mode: 'DEVELOPMENT',
      workspace: '/poisoned',
      initialObjectives: ['Fix failing test: broken-test'],
    });
    await h.service.startMission(poisoned.missionId);
    // Mission B: healthy, recoverable, resumable.
    const healthy = await h.service.createMission({
      userId: 'u1',
      title: 'Healthy',
      objective: 'Do work',
      mode: 'DEVELOPMENT',
      workspace: '/ws',
      initialObjectives: ['Healthy objective'],
    });
    await h.service.startMission(healthy.missionId);

    // Boot recovery on a FRESH controller: must NOT throw; must recover the
    // healthy mission and report the poisoned one as an isolated failure.
    const result = await h.service2.recoverAllActive();
    expect(result.active).toBe(2);
    expect(result.recovered).toBe(1); // healthy only
    expect(result.resumableMissionIds).toEqual([healthy.missionId]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.missionId).toBe(poisoned.missionId);
    expect(result.failed[0]?.reason).toContain('escapes');

    // The healthy mission actually completes afterwards (pass was not aborted).
    const done = await h.service2.runAutonomousLoop(healthy.missionId);
    expect(done.state).toBe('COMPLETED');
    expect(h.executions).toEqual(['Healthy objective']);

    // The poisoned mission is untouched — no fabricated state, no execution.
    const storedPoisoned = (await h.missions.get(poisoned.missionId))!;
    expect(storedPoisoned.state).toBe('RUNNING');
    expect(storedPoisoned.activity?.some((a) => a.message.includes('Recovery failed'))).toBe(true);
  });
});

describe('BLD-025 duplicate execution prevention across restarts', () => {
  it('verified objectives are never re-executed across repeated restarts', async () => {
    const h = makeHarness();
    const mission = await h.service.createMission({
      userId: 'u1',
      title: 'No duplicates',
      objective: 'Run once',
      initialObjectives: ['A', 'B', 'C'],
    });
    await h.service.startMission(mission.missionId);
    await h.service.runNextObjective(mission.missionId);
    expect(h.executions).toEqual(['A']);

    // Repeated "restarts" driving the loop must only execute B and C.
    for (const service of [h.service2, h.service, h.service2]) {
      await service.runAutonomousLoop(mission.missionId);
    }
    expect(h.executions).toEqual(['A', 'B', 'C']); // each exactly once
    const done = (await h.missions.get(mission.missionId))!;
    expect(done.state).toBe('COMPLETED');
  });
});
