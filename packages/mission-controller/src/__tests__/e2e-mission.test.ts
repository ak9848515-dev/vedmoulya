// VedMoulya � Mission Controller: E2E Two-Objective Proof
import { describe, it, expect } from 'vitest';
import { MissionControllerService } from '../application/MissionControllerService.js';
import { InMemoryMissionStore } from '../infrastructure/InMemoryMissionStore.js';
import { InMemoryCheckpointStore } from '../infrastructure/InMemoryCheckpointStore.js';
import { SystemClock } from '../infrastructure/SystemClock.js';
import { createIdGenerator } from '../infrastructure/IdGenerator.js';
import { createTestPlan, createTestProviderStatus } from './fixtures.js';

function createFakePorts() {
  let callCount = 0;
  return {
    objectiveSelector: {
      selectNextObjective: async (mission: any) => {
        const pending = mission.objectives.find((o: any) => o.state === 'PENDING');
        if (!pending) {
          return {
            selected: false,
            reason: 'No pending objectives',
            evidence: [],
            alternativesConsidered: [],
            priority: 0,
          };
        }
        callCount++;
        return {
          selected: true,
          objectiveId: pending.objectiveId,
          reason: `Objective #${callCount} selected by priority`,
          evidence: ['Priority order'],
          alternativesConsidered: [],
          priority: pending.priority,
        };
      },
    },
    providerAvailability: {
      getProviderStatus: async (requiredCapabilities: string[]) =>
        createTestProviderStatus({
          capableProviders: [
            {
              providerId: 'gemini',
              modelId: 'gemini-1.5-pro',
              capabilities: requiredCapabilities,
              healthy: true,
            },
          ],
        }),
    },
    goalUnderstanding: {
      understandGoal: async (objective: string) => ({
        goal: objective,
        requiredCapabilities: ['coding'],
        constraints: [],
        estimatedComplexity: 'MEDIUM',
      }),
    },
    planner: {
      createPlan: async (goal: string) => createTestPlan({ objective: goal }),
    },
    executor: {
      executePlan: async (plan: any) => ({
        runId: 'run_1',
        success: true,
        verified: true,
        output: 'All checks passed',
        usage: { tokens: 100, costUsd: 0.01, latencyMs: 50, toolCalls: 1 },
      }),
    },
    verifier: {
      verifyObjective: async (objective: any, result: any) => ({
        verified: result.success,
        method: 'automated_test',
        evidence: ['All checks passed'],
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
    failureClassifier: {
      classify: async () => ({
        failureClass: 'UNKNOWN' as const,
        recoverable: false,
        reason: 'Unknown',
        suggestedAction: 'FAIL' as const,
        evidence: [],
      }),
    },
  };
}

function createService() {
  const ports = createFakePorts();
  return new MissionControllerService({
    store: new InMemoryMissionStore(),
    checkpointStore: new InMemoryCheckpointStore(),
    objectiveSelector: ports.objectiveSelector as any,
    providerAvailability: ports.providerAvailability as any,
    goalUnderstanding: ports.goalUnderstanding as any,
    planner: ports.planner as any,
    executor: ports.executor as any,
    verifier: ports.verifier as any,
    executionMemory: ports.executionMemory as any,
    experienceOptimization: ports.experienceOptimization as any,
    failureClassifier: ports.failureClassifier as any,
    clock: new SystemClock(),
    idGenerator: createIdGenerator(),
  });
}

describe('Mission Controller E2E', () => {
  it('completes two sequential objectives without user prompt', async () => {
    const service = createService();
    const objectives = ['Fix failing test', 'Add unit tests'];
    const mission = await service.createMission({
      userId: 'user_test_1',
      title: 'Improve VedMoulya',
      objective: 'Complete two development objectives',
      initialObjectives: objectives,
      budget: { maxObjectives: 5 },
    });
    expect(mission.state).toBe('CREATED');
    expect(mission.objectives).toHaveLength(2);
    const started = await service.startMission(mission.missionId);
    expect(started.state).toBe('RUNNING');
    const completed = await service.runAutonomousLoop(mission.missionId);
    expect(completed.state).toBe('COMPLETED');
    expect(completed.outcome).toBe('ACHIEVED');
    expect(completed.objectives.every((o: any) => o.state === 'VERIFIED')).toBe(true);
    expect(completed.checkpoints).toHaveLength(2);
  });
});
