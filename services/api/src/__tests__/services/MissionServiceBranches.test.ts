// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — MissionService branch tests (BLD-024 / FINAL-04 / FINAL-05)
//
// The integration suites (MissionRouter.test.ts, mission-watchdog.test.ts) prove
// the happy paths over the REAL runtime. These tests target the SERVICE's own
// decision surface, which the happy paths never reach:
//   • runtime composition (durable-persistence guard, workspace default)
//   • the operator workspace JAIl. (inside / outside / no authorized root)
//   • repository-development constraint selection (command tool grant)
//   • the one-loop-per-mission lock and the explicit START/RESUME rules
//   • boot recovery / watchdog pass (in-flight skip, failed reporting)
//   • the detached loop's failure classification (terminal / hold / real error)
//   • view building (provider/model truth, checkpoints, activity merge)
//
// A runtime DOUBLE drives the state-dependent branches deterministically; the
// real runtime is used where the jail/constraints must be genuine.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { logger } from '@vedmoulya/core';
import { MissionService, type MissionServiceOptions } from '../../services/MissionService.js';
import { MockProvider } from '@vedmoulya/orchestrator';
import type { Mission, MissionObjective, MissionCheckpoint } from '@vedmoulya/mission-controller';
import type { MissionRuntime } from '@vedmoulya/mission-runtime';
import type { AgentExecutionRun } from '@vedmoulya/agent-execution';

// ── Fixtures ────────────────────────────────────────────────────────────────

function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    missionId: 'm-1',
    userId: 'u-1',
    title: 'Mission',
    objective: 'Improve the workspace autonomously',
    description: 'Improve the workspace autonomously',
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
    budget: {
      maxObjectives: 5,
      maxActions: 20,
      maxToolCalls: 20,
      maxRetries: 2,
      maxReplans: 1,
      maxRuntimeMs: 60_000,
      maxTokens: 10_000,
      maxCostUsd: 1,
    },
    budgetUsage: {
      objectivesCompleted: 1,
      objectivesFailed: 0,
      actionsExecuted: 3,
      toolCallsExecuted: 3,
      retriesConsumed: 0,
      replansConsumed: 0,
      runtimeMs: 120,
      tokensConsumed: 50,
      costUsdConsumed: 0,
    },
    constraints: {},
    state: 'RUNNING',
    stateHistory: ['CREATED', 'RUNNING'],
    objectives: [],
    checkpoints: [],
    decisions: [],
    successCriteria: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Mission;
}

function objective(overrides: Partial<MissionObjective> = {}): MissionObjective {
  return {
    objectiveId: 'obj-1',
    missionId: 'm-1',
    title: 'Do the thing',
    objective: 'Do the thing',
    description: 'Do the thing',
    reason: 'top priority',
    evidence: [],
    priority: 1,
    dependencies: [],
    estimatedComplexity: 'LOW',
    estimatedCost: 0,
    state: 'VERIFIED',
    stateHistory: ['CREATED', 'RUNNING', 'VERIFIED'],
    retryCount: 0,
    maxRetries: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as MissionObjective;
}

function checkpoint(overrides: Partial<MissionCheckpoint> = {}): MissionCheckpoint {
  return {
    checkpointId: 'cp-1',
    missionId: 'm-1',
    objectiveId: 'obj-1',
    state: 'VERIFIED',
    completedWork: ['did the thing'],
    remainingWork: [],
    failures: [],
    recoveryHistory: [],
    learningReferences: [],
    experienceReferences: [],
    budgetRemaining: { objectives: 4, actions: 17, runtimeMs: 59_000, tokens: 9_950, costUsd: 1 },
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as MissionCheckpoint;
}

/**
 * A deterministic runtime double. Only the members MissionService uses are
 * present; the mutable `state.mission` holder lets a test model the store
 * changing as a result of an api call (e.g. APPROVE → RUNNING).
 */
function runtimeDouble(initial: Mission | undefined) {
  const state: { mission: Mission | undefined } = { mission: initial };
  const controller = {
    recoverAllActive: vi.fn(async () => ({
      recovered: 0,
      active: 0,
      failed: [] as Array<{ missionId: string; reason: string }>,
      resumableMissionIds: [] as string[],
    })),
    reconcileAbandonedExecutions: vi.fn(async () => ({
      resumed: [] as string[],
      consideredMissionIds: [] as string[],
      skipped: [] as string[],
      stillOwned: [] as string[],
    })),
    reconcileProviderWaits: vi.fn(async () => ({
      resumed: [] as string[],
      consideredMissionIds: [] as string[],
      stillWaiting: [] as string[],
      skipped: [] as string[],
    })),
    runAutonomousLoop: vi.fn(async () => state.mission as Mission),
    createMission: vi.fn(async () => state.mission as Mission),
  };
  const api = {
    start: vi.fn(async () => state.mission as Mission),
    pause: vi.fn(async () => state.mission as Mission),
    resume: vi.fn(async () => state.mission as Mission),
    cancel: vi.fn(async () => state.mission as Mission),
    approve: vi.fn(async () => state.mission as Mission),
    reject: vi.fn(async () => state.mission as Mission),
    getStatus: vi.fn(async () => ({})),
    listMissions: vi.fn(async () => [] as Mission[]),
  };
  const store = { get: vi.fn(async () => state.mission) };
  const runs = { get: vi.fn(() => undefined as AgentExecutionRun | undefined) };
  const workspace = { getRoot: vi.fn(() => '/authorized/root') };

  const runtime = {
    controller,
    api,
    stores: { missions: store, checkpoints: {} },
    runs,
    workspace,
  } as unknown as MissionRuntime;

  return { runtime, controller, api, store, runs, workspace, state };
}

/** Let the detached autonomous loop settle. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

// The failure-classification tests deliberately drive REAL error paths, so the
// service's own log output is expected — silenced rather than dumped into CI.
beforeEach(() => {
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Real runtime (jail + constraints must be genuine) ───────────────────────

const workspace = mkdtempSync(path.join(tmpdir(), 'vedmoulya-mission-service-'));
afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function realService(options: MissionServiceOptions = {}): MissionService {
  return new MissionService({
    workspaceRoot: workspace,
    runtimeOptions: {
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(new MockProvider());
      },
      orchestratorOptions: { retryBaseDelayMs: 1 },
    },
    ...options,
  });
}

describe('MissionService — runtime composition', () => {
  it('refuses to compose process-local state when durable persistence is required', async () => {
    const service = new MissionService({ requireDurablePersistence: true });

    await expect(
      service.createMission('u-persist', {
        title: 'Needs a database',
        objective: 'Improve things',
      }),
    ).rejects.toThrow(/durable mission persistence is required/i);
  });

  it('uses MISSION_WORKSPACE_ROOT when the operator set it, and the cwd when blank', async () => {
    const previous = process.env.MISSION_WORKSPACE_ROOT;
    try {
      process.env.MISSION_WORKSPACE_ROOT = workspace;
      const configured = new MissionService();
      await configured.recoverAllActive();
      expect(configured.getComposedRuntime()?.workspace.getRoot()).toBe(workspace);

      // A whitespace-only value is not a configured workspace.
      process.env.MISSION_WORKSPACE_ROOT = '   ';
      const blank = new MissionService();
      await blank.recoverAllActive();
      expect(blank.getComposedRuntime()?.workspace.getRoot()).toBe(process.cwd());

      // Nothing is composed until it is needed — introspection stays honest.
      expect(new MissionService().getComposedRuntime()).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.MISSION_WORKSPACE_ROOT;
      else process.env.MISSION_WORKSPACE_ROOT = previous;
    }
  });
});

describe('MissionService — operator workspace jail', () => {
  it('jails a requested workspace inside the authorized root and rejects one outside it', async () => {
    const service = realService();

    const inside = await service.createMission('u-jail', {
      title: 'Jailed mission',
      objective: 'Improve the workspace autonomously',
      workspace: path.join(workspace, 'sub'),
    });
    expect(inside.workspace).toBe(path.join(workspace, 'sub'));

    // The temp root's PARENT is outside the jail — never a widening.
    await expect(
      service.createMission('u-jail', {
        title: 'Escaping mission',
        objective: 'Improve the workspace autonomously',
        workspace: tmpdir(),
      }),
    ).rejects.toThrow(/not inside the authorized workspace root/i);
  });

  it('refuses a workspace request when the runtime has no authorized root', async () => {
    const { runtime, workspace: workspaceBinding } = runtimeDouble(mission());
    workspaceBinding.getRoot.mockReturnValue(undefined as unknown as string);
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await expect(
      service.createMission('u-1', {
        title: 'No root',
        objective: 'Improve things',
        workspace: '/tmp/anywhere',
      }),
    ).rejects.toThrow(/no workspace root is authorized/i);
  });
});

describe('MissionService — repository-development constraint selection', () => {
  it('grants the governed command tool only to repository-development missions', async () => {
    const service = realService();

    const repository = await service.createMission('u-repo', {
      title: 'Fix the build',
      objective: 'Fix the failing tests',
      initialObjectives: ['Repair the broken build'],
    });
    expect(repository.constraints.allowedTools).toContain('run_command');
    expect(repository.constraints.allowedTools).toContain('workspace_write');
    expect(repository.constraints.grantedPermissionClasses).toContain('EXECUTE');

    const documentation = await service.createMission('u-docs', {
      title: 'Write the docs',
      objective: 'Improve the workspace documentation',
    });
    expect(documentation.constraints.allowedTools).not.toContain('run_command');
    expect(documentation.constraints.grantedPermissionClasses).not.toContain('EXECUTE');
  });

  it('lets an explicit operator override win over the objective heuristic', async () => {
    const service = realService();

    const forced = await service.createMission('u-force', {
      title: 'Force the tool',
      objective: 'Improve the workspace documentation',
      allowCommandExecution: true,
    });
    expect(forced.constraints.allowedTools).toContain('run_command');

    const denied = await service.createMission('u-deny', {
      title: 'Deny the tool',
      objective: 'Fix the failing tests',
      allowCommandExecution: false,
    });
    expect(denied.constraints.allowedTools).not.toContain('run_command');
  });
});

describe('MissionService — one loop per mission, explicit transitions', () => {
  it('starts a CREATED mission through the frozen state machine', async () => {
    const { runtime, api, state } = runtimeDouble(mission({ state: 'CREATED' }));
    state.mission = mission({ state: 'CREATED' });
    api.start.mockImplementation(async () => {
      state.mission = mission({ state: 'RUNNING' });
      return state.mission;
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const started = await service.startAutonomousLoop('u-1', 'm-1');

    expect(api.start).toHaveBeenCalledWith('m-1', 'u-1');
    expect(started.state).toBe('RUNNING');
    await flush();
  });

  it('continues a RUNNING mission without re-starting it', async () => {
    const { runtime, api } = runtimeDouble(mission({ state: 'RUNNING' }));
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await service.startAutonomousLoop('u-1', 'm-1');

    expect(api.start).not.toHaveBeenCalled();
    await flush();
  });

  it('refuses START on an operator hold (RESUME is the explicit action)', async () => {
    const { runtime } = runtimeDouble(mission({ state: 'PAUSED' }));
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await expect(service.startAutonomousLoop('u-1', 'm-1')).rejects.toThrow(
      /Illegal mission transition: PAUSED -> START/,
    );
  });

  it('refuses START on a terminal mission', async () => {
    const { runtime } = runtimeDouble(mission({ state: 'COMPLETED' }));
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await expect(service.startAutonomousLoop('u-1', 'm-1')).rejects.toThrow(
      /Illegal mission transition: COMPLETED -> START/,
    );
  });

  it('observes instead of duplicating when a loop is already in flight', async () => {
    const { runtime, controller } = runtimeDouble(mission({ state: 'RUNNING' }));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    controller.runAutonomousLoop.mockImplementation(async () => {
      await gate;
      return mission();
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const first = await service.startAutonomousLoop('u-1', 'm-1');
    const second = await service.startAutonomousLoop('u-1', 'm-1');

    expect(second.missionId).toBe(first.missionId);
    expect(controller.runAutonomousLoop).toHaveBeenCalledTimes(1);

    release();
    await flush();
  });

  it('resumes operator holds and provider waits, and starts a never-started mission', async () => {
    const holds = [
      ['PAUSED', 'Mission resumed from persisted state'],
      ['BLOCKED', 'Mission resumed from persisted state'],
      ['WAITING_FOR_APPROVAL', 'Mission resumed from persisted state'],
      ['WAITING_FOR_PROVIDER', 'Provider available — mission resumed'],
    ] as const;

    for (const [state, expectedMessage] of holds) {
      const { runtime, api, state: holder } = runtimeDouble(mission({ state }));
      api.resume.mockImplementation(async () => {
        holder.mission = mission({ state: 'RUNNING' });
        return holder.mission;
      });
      const service = new MissionService();
      service.setRuntimeForTesting(runtime);

      const resumed = await service.resumeAutonomousLoop('u-1', 'm-1');

      expect(api.resume).toHaveBeenCalledWith('m-1', 'u-1');
      expect(resumed.state).toBe('RUNNING');
      const view = await service.getStatus('u-1', 'm-1');
      expect(view.activity.some((event) => event.message === expectedMessage)).toBe(true);
      await flush();
    }

    // A mission that was never started is STARTED, not resumed.
    const { runtime, api, state: holder } = runtimeDouble(mission({ state: 'CREATED' }));
    api.start.mockImplementation(async () => {
      holder.mission = mission({ state: 'RUNNING' });
      return holder.mission;
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await service.resumeAutonomousLoop('u-1', 'm-1');
    expect(api.start).toHaveBeenCalledWith('m-1', 'u-1');
    expect(api.resume).not.toHaveBeenCalled();
    await flush();

    // A RUNNING mission is already going: RESUME only continues the loop and
    // never issues a state-machine transition of its own.
    const running = runtimeDouble(mission({ state: 'RUNNING' }));
    const runningService = new MissionService();
    runningService.setRuntimeForTesting(running.runtime);

    await runningService.resumeAutonomousLoop('u-1', 'm-1');

    expect(running.api.resume).not.toHaveBeenCalled();
    expect(running.api.start).not.toHaveBeenCalled();
    expect(running.controller.runAutonomousLoop).toHaveBeenCalledTimes(1);
    await flush();
  });

  it('refuses RESUME on a terminal mission', async () => {
    const { runtime } = runtimeDouble(mission({ state: 'FAILED' }));
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await expect(service.resumeAutonomousLoop('u-1', 'm-1')).rejects.toThrow(
      /Illegal mission transition: FAILED -> RESUME/,
    );
  });

  it('observes a resume for a mission whose loop is already in flight', async () => {
    const { runtime, controller } = runtimeDouble(mission({ state: 'RUNNING' }));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    controller.runAutonomousLoop.mockImplementation(async () => {
      await gate;
      return mission();
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const first = await service.startAutonomousLoop('u-1', 'm-1');
    const observed = await service.resumeAutonomousLoop('u-1', 'm-1');

    expect(observed.missionId).toBe(first.missionId);
    expect(runtime.api.resume).not.toHaveBeenCalled();
    expect(controller.runAutonomousLoop).toHaveBeenCalledTimes(1);

    release();
    await flush();
  });

  it('approves the current objective and continues the loop, with or without one', async () => {
    const { runtime, api, state } = runtimeDouble(
      mission({ state: 'WAITING_FOR_APPROVAL', currentObjectiveId: 'obj-1' }),
    );
    api.approve.mockImplementation(async () => {
      state.mission = mission({ state: 'RUNNING', currentObjectiveId: 'obj-1' });
      return state.mission;
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const approved = await service.approve('u-1', 'm-1');

    expect(api.approve).toHaveBeenCalledWith('m-1', 'u-1', 'obj-1');
    expect(approved.state).toBe('RUNNING');
    expect(runtime.controller.runAutonomousLoop).toHaveBeenCalledTimes(1);
    await flush();

    // No current objective recorded: the approval still names one honestly.
    const { runtime: runtime2, api: api2 } = runtimeDouble(
      mission({ state: 'WAITING_FOR_APPROVAL' }),
    );
    const service2 = new MissionService();
    service2.setRuntimeForTesting(runtime2);
    await service2.approve('u-1', 'm-1');
    expect(api2.approve).toHaveBeenCalledWith('m-1', 'u-1', '');
  });

  it('rejects the pending operation without a current objective', async () => {
    const { runtime, api, state } = runtimeDouble(mission({ state: 'WAITING_FOR_APPROVAL' }));
    api.reject.mockImplementation(async () => {
      state.mission = mission({ state: 'FAILED', outcome: 'FAILED' });
      return state.mission;
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const rejected = await service.reject('u-1', 'm-1');

    expect(api.reject).toHaveBeenCalledWith('m-1', 'u-1', '');
    expect(rejected.state).toBe('FAILED');
    const view = await service.getStatus('u-1', 'm-1');
    expect(
      view.activity.some((event) => event.message === 'Operator rejected the pending operation'),
    ).toBe(true);
  });
});

describe('MissionService — boot recovery + watchdog pass', () => {
  it('skips missions already being driven and reports what could not be recovered', async () => {
    const { runtime, controller } = runtimeDouble(mission({ state: 'RUNNING' }));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    controller.runAutonomousLoop.mockImplementation(async () => {
      await gate;
      return mission();
    });
    controller.recoverAllActive.mockResolvedValue({
      recovered: 2,
      active: 1,
      failed: [{ missionId: 'm-2', reason: 'checkpoint unreadable' }],
      resumableMissionIds: ['m-1', 'm-2'],
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await service.startAutonomousLoop('u-1', 'm-1'); // holds the in-flight lock
    const result = await service.recoverAllActive();

    expect(result).toEqual({
      recovered: 2,
      active: 1,
      failed: [{ missionId: 'm-2', reason: 'checkpoint unreadable' }],
    });
    // m-1 is skipped (already in flight); m-2 is relaunched.
    expect(controller.runAutonomousLoop).toHaveBeenCalledTimes(2);

    release();
    await flush();
  });

  it('reports no failure field when every mission recovered cleanly', async () => {
    const { runtime, controller } = runtimeDouble(mission({ state: 'RUNNING' }));
    controller.recoverAllActive.mockResolvedValue({
      recovered: 1,
      active: 1,
      failed: [],
      resumableMissionIds: ['m-9'],
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const result = await service.recoverAllActive();

    expect(result.failed).toBeUndefined();
    expect(result.recovered).toBe(1);
    await flush();
  });

  it('skips a watchdog-resumed mission that an in-flight loop already owns', async () => {
    const { runtime, controller } = runtimeDouble(mission({ state: 'RUNNING' }));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    controller.runAutonomousLoop.mockImplementation(async () => {
      await gate;
      return mission();
    });
    controller.reconcileAbandonedExecutions.mockResolvedValue({
      resumed: ['m-3'],
      consideredMissionIds: ['m-3', 'm-1'],
      skipped: ['m-7'],
      stillOwned: ['m-8'],
    });
    controller.reconcileProviderWaits.mockResolvedValue({
      resumed: ['m-1'],
      consideredMissionIds: ['m-1'],
      stillWaiting: ['m-4'],
      skipped: [],
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await service.startAutonomousLoop('u-1', 'm-1');
    const pass = await service.runWatchdogPass();

    expect(pass.considered).toBe(2);
    expect(pass.resumed).toBe(2);
    expect(pass.stillWaiting).toBe(1);
    expect(pass.skipped).toBe(1);
    expect(pass.abandonedRecovered).toBe(1);
    expect(pass.stillOwned).toBe(1);
    expect(pass.resumedMissionIds).toEqual(['m-3', 'm-1']);
    // Only m-3 is relaunched — m-1 is already owned.
    expect(controller.runAutonomousLoop).toHaveBeenCalledTimes(2);

    release();
    await flush();
  });
});

describe('MissionService — detached loop failure classification', () => {
  it('records an honest failure when the loop dies for a non-hold, non-terminal state', async () => {
    const { runtime } = runtimeDouble(mission({ state: 'RUNNING' }));
    runtime.controller.runAutonomousLoop.mockRejectedValue(new Error('engine exploded'));
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await service.startAutonomousLoop('u-1', 'm-1');
    await flush();

    const view = await service.getStatus('u-1', 'm-1');
    const failure = view.activity.find((event) => event.kind === 'MISSION_FAILED');
    expect(failure?.message).toContain('engine exploded');
  });

  it('falls back to a generic message when the loop rejects with a non-Error', async () => {
    const { runtime } = runtimeDouble(mission({ state: 'RUNNING' }));
    runtime.controller.runAutonomousLoop.mockRejectedValue('a string, not an Error');
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await service.startAutonomousLoop('u-1', 'm-1');
    await flush();

    const view = await service.getStatus('u-1', 'm-1');
    expect(
      view.activity.some((event) =>
        event.message.includes('Autonomous loop error: unknown loop error'),
      ),
    ).toBe(true);
  });

  it('stays silent when the loop stopped because the mission became terminal', async () => {
    // The mission is RUNNING when the loop starts and terminal when it stops.
    const { runtime, state } = runtimeDouble(mission({ state: 'RUNNING' }));
    runtime.controller.runAutonomousLoop.mockImplementation(async () => {
      state.mission = mission({
        state: 'COMPLETED',
        outcome: 'ACHIEVED',
        outcomeReason: 'all verified',
      });
      throw new Error('operator race');
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await service.startAutonomousLoop('u-1', 'm-1');
    await flush();

    const view = await service.getStatus('u-1', 'm-1');
    expect(view.activity.some((event) => event.kind === 'MISSION_FAILED')).toBe(false);
    expect(view.activity.some((event) => event.kind === 'MISSION_COMPLETED')).toBe(true);
  });

  it('stays silent when the loop stopped because the mission is on an operator hold', async () => {
    const { runtime } = runtimeDouble(mission({ state: 'PAUSED' }));
    runtime.controller.runAutonomousLoop.mockRejectedValue(new Error('paused mid-loop'));
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await service.resumeAutonomousLoop('u-1', 'm-1').catch(() => undefined);
    await flush();

    const view = await service.getStatus('u-1', 'm-1');
    expect(view.activity.some((event) => event.kind === 'MISSION_FAILED')).toBe(false);
  });
});

describe('MissionService — view building', () => {
  it('omits provider/model/attempts when no run is recorded', async () => {
    const { runtime, store } = runtimeDouble(
      mission({ objectives: [objective({ executionRunId: undefined })] }),
    );
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const view = await service.getStatus('u-1', 'm-1');

    expect(view.provider).toBeUndefined();
    expect(view.model).toBeUndefined();
    expect(view.attempts).toBeUndefined();
    expect(view.revisions).toBeUndefined();
    expect(store.get).toHaveBeenCalledWith('m-1');
  });

  it('omits provider/model when the recorded run is no longer in the registry', async () => {
    const { runtime, runs } = runtimeDouble(
      mission({ objectives: [objective({ executionRunId: 'run-evicted' })] }),
    );
    runs.get.mockReturnValue(undefined);
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const view = await service.getStatus('u-1', 'm-1');

    expect(runs.get).toHaveBeenCalledWith('run-evicted');
    expect(view.provider).toBeUndefined();
    expect(view.model).toBeUndefined();
  });

  it('reports only the provider/model the last real run recorded', async () => {
    const { runtime, runs } = runtimeDouble(
      mission({ objectives: [objective({ executionRunId: 'run-1' })] }),
    );
    runs.get.mockReturnValue({
      runId: 'run-1',
      usage: { attempts: 2, revisions: 1 },
      stepResults: [
        {
          actions: [{ provider: 'ollama', model: 'llama3.2' }],
          observations: [],
        },
      ],
    } as unknown as AgentExecutionRun);
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const view = await service.getStatus('u-1', 'm-1');

    expect(view.provider).toBe('ollama');
    expect(view.model).toBe('llama3.2');
    expect(view.attempts).toBe(2);
    expect(view.revisions).toBe(1);
  });

  it('reads the provider from an observation when no action recorded one', async () => {
    const { runtime, runs } = runtimeDouble(
      mission({ objectives: [objective({ executionRunId: 'run-2' })] }),
    );
    runs.get.mockReturnValue({
      runId: 'run-2',
      usage: {},
      stepResults: [
        { actions: [{}], observations: [{ provider: 'openai', model: 'gpt-4o-mini' }] },
      ],
    } as unknown as AgentExecutionRun);
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const view = await service.getStatus('u-1', 'm-1');

    expect(view.provider).toBe('openai');
    expect(view.model).toBe('gpt-4o-mini');
  });

  it('omits provider/model when the runtime is not composed (nothing to read)', async () => {
    const { runtime, runs } = runtimeDouble(
      mission({ objectives: [objective({ executionRunId: 'run-3' })] }),
    );
    runs.get.mockReturnValue({
      runId: 'run-3',
      usage: {},
      stepResults: [],
    } as unknown as AgentExecutionRun);
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);
    // Model the moment right after a runtime has been created but before the
    // instance cache is filled: getRuntime still resolves the creation, while
    // `this.runtime` is still empty — lastRunFor must not invent a provider.
    const internals = service as unknown as {
      runtime: MissionRuntime | null;
      runtimeCreation: Promise<MissionRuntime> | null;
    };
    internals.runtimeCreation = Promise.resolve(runtime);
    internals.runtime = null;

    const view = await service.getStatus('u-1', 'm-1');

    expect(view.provider).toBeUndefined();
    expect(view.model).toBeUndefined();
  });

  it('throws for a mission that is not owned by the caller', async () => {
    const { runtime } = runtimeDouble(mission({ userId: 'someone-else' }));
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await expect(service.getStatus('u-1', 'm-1')).rejects.toThrow(/not found for user/);
  });

  it('reports the newest checkpoint, and none when there are none', async () => {
    const { runtime, api } = runtimeDouble(mission({ checkpoints: [checkpoint()] }));
    api.listMissions.mockResolvedValue([
      mission({ missionId: 'm-1', checkpoints: [checkpoint()] }),
      mission({ missionId: 'm-2', checkpoints: [] }),
    ]);
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const summaries = await service.listMissionSummaries('u-1');

    expect(summaries.find((s) => s.missionId === 'm-1')?.lastCheckpoint?.checkpointId).toBe('cp-1');
    expect(summaries.find((s) => s.missionId === 'm-2')?.lastCheckpoint).toBeUndefined();
  });

  it('falls back to the durable activity trail when this process has none', async () => {
    const { runtime } = runtimeDouble(
      mission({
        activity: [
          {
            id: 'durable-1',
            at: '2026-01-01T00:00:00.000Z',
            kind: 'WATCHDOG_RESUMED',
            message: 'watchdog resumed it',
          },
        ] as Mission['activity'],
      }),
    );
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    const view = await service.getStatus('u-1', 'm-1');

    expect(view.activity.map((event) => event.id)).toEqual(['durable-1']);
  });

  it('merges the durable and live trails, deduplicating by id', async () => {
    const { runtime, api } = runtimeDouble(
      mission({
        activity: [
          // Same id as the live event this process will record → shown once.
          {
            id: 'evt-1',
            at: '2026-01-01T00:00:00.000Z',
            kind: 'MISSION_PAUSED',
            message: 'Mission paused — safe state reached',
          },
          {
            id: 'durable-1',
            at: '2026-01-01T00:00:01.000Z',
            kind: 'WATCHDOG_RESUMED',
            message: 'watchdog resumed it',
          },
        ] as Mission['activity'],
      }),
    );
    api.pause.mockResolvedValue(mission({ state: 'PAUSED' }));
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);

    await service.pause('u-1', 'm-1'); // records one LIVE event (evt-1)
    const view = await service.getStatus('u-1', 'm-1');

    const ids = view.activity.map((event) => event.id);
    expect(ids).toContain('durable-1');
    expect(ids.filter((id) => id === 'evt-1')).toHaveLength(1);
  });
});

describe('MissionService — outcome activity derived from real mission state', () => {
  /**
   * Run ONE detached loop that settles into `outcome` and returns the activity
   * it recorded. The mission starts RUNNING (so the START transition is legal)
   * and the loop itself is what moves it to the outcome state — exactly the
   * production sequence.
   */
  async function activityAfterLoop(
    outcome: Mission,
  ): Promise<Array<{ kind: string; message: string }>> {
    const { runtime, state } = runtimeDouble(mission({ state: 'RUNNING' }));
    runtime.controller.runAutonomousLoop.mockImplementation(async () => {
      state.mission = outcome;
      return outcome;
    });
    const service = new MissionService();
    service.setRuntimeForTesting(runtime);
    await service.startAutonomousLoop('u-1', 'm-1');
    await flush();
    const view = await service.getStatus('u-1', 'm-1');
    return view.activity;
  }

  it('reports verification, checkpoint and completion facts with their real values', async () => {
    const activity = await activityAfterLoop(
      mission({
        state: 'COMPLETED',
        outcome: 'ACHIEVED',
        outcomeReason: 'every objective verified',
        objectives: [
          objective({
            verifiedOutcome: {
              achieved: true,
              evidence: ['file written'],
              verifiedAt: '2026-01-01T00:00:02.000Z',
              method: 'workspace_write',
            },
          }),
        ],
        checkpoints: [checkpoint()],
      }),
    );

    expect(activity.some((event) => event.message.includes('(workspace_write)'))).toBe(true);
    expect(activity.some((event) => event.kind === 'CHECKPOINT_SAVED')).toBe(true);
    expect(
      activity.some(
        (event) => event.message === 'Mission completed: ACHIEVED — every objective verified',
      ),
    ).toBe(true);
  });

  it('says "unknown method" and omits a reason it does not have', async () => {
    const activity = await activityAfterLoop(
      mission({
        state: 'COMPLETED',
        outcome: 'ACHIEVED',
        objectives: [objective({ verifiedOutcome: undefined })],
      }),
    );

    expect(activity.some((event) => event.message.includes('(unknown method)'))).toBe(true);
    expect(activity.some((event) => event.message === 'Mission completed: ACHIEVED')).toBe(true);

    // No outcome recorded at all: the message says exactly that.
    const unknownOutcome = await activityAfterLoop(mission({ state: 'COMPLETED' }));
    expect(unknownOutcome.some((event) => event.message === 'Mission completed: UNKNOWN')).toBe(
      true,
    );
  });

  it('reports a failed objective without inventing a reason', async () => {
    const activity = await activityAfterLoop(
      mission({
        state: 'RUNNING',
        objectives: [
          objective({ state: 'FAILED', failureReason: 'verification failed' }),
          objective({ objectiveId: 'obj-2', state: 'FAILED' }),
        ],
      }),
    );

    expect(activity.some((event) => event.message.includes('verification failed'))).toBe(true);
    expect(activity.some((event) => event.message.includes('unknown reason'))).toBe(true);
  });

  it('reports the provider hold with the mission’s own reason when present', async () => {
    const withReason = await activityAfterLoop(
      mission({ state: 'WAITING_FOR_PROVIDER', outcomeReason: 'no provider matched' }),
    );
    expect(withReason.some((event) => event.message === 'no provider matched')).toBe(true);

    const withoutReason = await activityAfterLoop(mission({ state: 'WAITING_FOR_PROVIDER' }));
    expect(
      withoutReason.some(
        (event) => event.message === 'No capable provider available — checkpoint saved',
      ),
    ).toBe(true);

    const waitingApproval = await activityAfterLoop(mission({ state: 'WAITING_FOR_APPROVAL' }));
    expect(waitingApproval.some((event) => event.kind === 'WAITING_FOR_APPROVAL')).toBe(true);
  });

  it('reports a mission failure from its reason, its error, or honestly as unknown', async () => {
    const withReason = await activityAfterLoop(
      mission({ state: 'FAILED', outcomeReason: 'operator rejected' }),
    );
    expect(withReason.some((event) => event.message === 'Mission failed: operator rejected')).toBe(
      true,
    );

    const withError = await activityAfterLoop(
      mission({ state: 'FAILED', error: 'engine exploded' }),
    );
    expect(withError.some((event) => event.message === 'Mission failed: engine exploded')).toBe(
      true,
    );

    const withNeither = await activityAfterLoop(mission({ state: 'FAILED' }));
    expect(withNeither.some((event) => event.message === 'Mission failed: unknown reason')).toBe(
      true,
    );
  });

  it('reports a cancelled mission as cancelled', async () => {
    const activity = await activityAfterLoop(mission({ state: 'CANCELLED' }));

    expect(activity.some((event) => event.kind === 'MISSION_CANCELLED')).toBe(true);
  });
});
