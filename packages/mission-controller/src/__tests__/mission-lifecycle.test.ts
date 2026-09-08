import { describe, it, expect, beforeEach } from 'vitest';
import { MissionControllerService } from '../application/MissionControllerService.js';
import { InMemoryMissionStore } from '../infrastructure/InMemoryMissionStore.js';
import { InMemoryCheckpointStore } from '../infrastructure/InMemoryCheckpointStore.js';
import { SystemClock } from '../infrastructure/SystemClock.js';
import { createIdGenerator } from '../infrastructure/IdGenerator.js';
import { DeterministicObjectiveSelector } from '../domain/objective-selector.js';
import { SimpleGoalUnderstanding } from '../domain/goal-understanding.js';
import { SimpleProviderAvailability } from '../domain/provider-availability.js';
import { classifyFailure } from '../domain/mission-failure-classifier.js';
import type { ProviderStatus } from '../types/mission-types.js';

function createFakePlanner() {
  return {
    createPlan: async (goal: string, caps: string[], constraints: string[]) => ({
      planId: 'plan_fake_1',
      goalId: 'goal_fake_1',
      objective: goal,
      steps: [
        {
          stepId: 'step_1',
          order: 0,
          action: { type: 'tool_call' as const, tool: 'echo', arguments: { text: 'done' } },
          verification: { type: 'tool_success' as const },
          dependencies: [],
        },
      ],
      verification: { type: 'all_steps_succeed' as const },
      requiredCapabilities: caps,
      estimatedCost: 0.01,
    }),
  };
}

function createFakeExecutor(result: {
  success: boolean;
  verified: boolean;
  error?: string;
  failureClass?: string;
}) {
  return {
    executePlan: async () => ({
      runId: 'run_fake_1',
      success: result.success,
      verified: result.verified,
      output: result.success ? 'completed' : undefined,
      error: result.error,
      failureClass: result.failureClass,
      usage: { tokens: 100, costUsd: 0.001, latencyMs: 50, toolCalls: 1 },
    }),
  };
}

function createFakeVerifier(result: { verified: boolean; evidence: string[] }) {
  return {
    verifyObjective: async () => ({
      verified: result.verified,
      evidence: result.evidence,
      method: 'test_verification',
    }),
  };
}

function createFakeExecutionMemory() {
  const recorded: Array<{ missionId: string; objectiveId: string; outcome: unknown }> = [];
  return {
    recordVerifiedOutcome: async (_m: string, _o: string, _r: unknown) => {
      recorded.push({});
    },
    getRecorded: () => recorded,
  };
}

function createFakeExperienceOptimization() {
  return {
    getAdvisorySignal: async () => ({
      recommendation: 'Use proven strategy',
      confidence: 0.8,
      evidenceCount: 10,
      reason: 'Historical evidence supports this approach',
    }),
  };
}

function createFakeFailureClassifier() {
  return {
    classify: async (
      error: string,
      execResult: { failureClass?: string; usage: unknown },
      ps: ProviderStatus,
    ) => classifyFailure(error, execResult, ps),
  };
}

function createService(
  overrides: {
    executor?: ReturnType<typeof createFakeExecutor>;
    verifier?: ReturnType<typeof createFakeVerifier>;
    providerStatus?: ProviderStatus;
  } = {},
) {
  const store = new InMemoryMissionStore();
  const checkpointStore = new InMemoryCheckpointStore();
  const clock = new SystemClock();
  const idGenerator = createIdGenerator();
  const objectiveSelector = new DeterministicObjectiveSelector();
  const providerAvailability = new SimpleProviderAvailability(
    overrides.providerStatus?.capableProviders,
  );
  const goalUnderstanding = new SimpleGoalUnderstanding();
  const planner = createFakePlanner();
  const executor = overrides.executor ?? createFakeExecutor({ success: true, verified: true });
  const verifier =
    overrides.verifier ?? createFakeVerifier({ verified: true, evidence: ['test passed'] });
  const executionMemory = createFakeExecutionMemory();
  const experienceOptimization = createFakeExperienceOptimization();
  const failureClassifier = createFakeFailureClassifier();

  const service = new MissionControllerService({
    store,
    checkpointStore,
    objectiveSelector,
    providerAvailability,
    goalUnderstanding,
    planner,
    executor: executor as any,
    verifier: verifier as any,
    executionMemory: executionMemory as any,
    experienceOptimization: experienceOptimization as any,
    failureClassifier: failureClassifier as any,
    clock,
    idGenerator,
  });

  return { service, store, checkpointStore };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Mission Lifecycle', () => {
  let service: MissionControllerService;
  let store: InMemoryMissionStore;

  beforeEach(() => {
    const created = createService();
    service = created.service;
    store = created.store;
  });

  it('should create a mission in CREATED state', async () => {
    const mission = await service.createMission({
      userId: 'user_1',
      title: 'Test Mission',
      objective: 'Complete objectives',
    });
    expect(mission.state).toBe('CREATED');
    expect(mission.missionId).toBeDefined();
    expect(mission.userId).toBe('user_1');
  });

  it('should start a mission from CREATED', async () => {
    const created = await service.createMission({
      userId: 'user_1',
      title: 'Test',
      objective: 'Obj',
    });
    const started = await service.startMission(created.missionId);
    expect(started.state).toBe('RUNNING');
  });

  it('should pause a running mission', async () => {
    const created = await service.createMission({
      userId: 'user_1',
      title: 'Test',
      objective: 'Obj',
    });
    const started = await service.startMission(created.missionId);
    const paused = await service.pauseMission(started.missionId);
    expect(paused.state).toBe('PAUSED');
  });

  it('should resume a paused mission', async () => {
    const created = await service.createMission({
      userId: 'user_1',
      title: 'Test',
      objective: 'Obj',
    });
    const started = await service.startMission(created.missionId);
    const paused = await service.pauseMission(started.missionId);
    const resumed = await service.resumeMission(paused.missionId);
    expect(resumed.state).toBe('RUNNING');
  });

  it('should cancel a mission', async () => {
    const created = await service.createMission({
      userId: 'user_1',
      title: 'Test',
      objective: 'Obj',
    });
    const started = await service.startMission(created.missionId);
    const cancelled = await service.cancelMission(started.missionId);
    expect(cancelled.state).toBe('CANCELLED');
    expect(cancelled.outcome).toBe('CANCELLED');
  });

  it('should reject starting a mission not in CREATED state', async () => {
    const created = await service.createMission({
      userId: 'user_1',
      title: 'Test',
      objective: 'Obj',
    });
    await service.startMission(created.missionId);
    await expect(service.startMission(created.missionId)).rejects.toThrow();
  });

  it('should preserve state history', async () => {
    const created = await service.createMission({
      userId: 'user_1',
      title: 'Test',
      objective: 'Obj',
    });
    const started = await service.startMission(created.missionId);
    const paused = await service.pauseMission(started.missionId);
    expect(paused.stateHistory).toEqual(['CREATED', 'RUNNING', 'PAUSED']);
  });
});

describe('Mission with Initial Objectives', () => {
  it('should create mission with initial objectives', async () => {
    const { service } = createService();
    const mission = await service.createMission({
      userId: 'user_1',
      title: 'Test',
      objective: 'Obj',
      initialObjectives: ['Write tests', 'Fix bugs', 'Update docs'],
    });
    expect(mission.objectives).toHaveLength(3);
    expect(mission.objectives[0].state).toBe('PENDING');
    expect(mission.objectives[0].priority).toBe(0);
    expect(mission.objectives[1].priority).toBe(1);
  });
});

describe('Mission Status DTO', () => {
  it('should return mission status', async () => {
    const { service } = createService();
    const created = await service.createMission({
      userId: 'user_1',
      title: 'Test',
      objective: 'Obj',
    });
    const status = await service.getStatus(created.missionId, 'user_1');
    expect(status.missionId).toBe(created.missionId);
    expect(status.state).toBe('CREATED');
    expect(status.progress.totalObjectives).toBe(0);
  });
});
