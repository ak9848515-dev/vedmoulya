import type { AgentPlan } from '@vedmoulya/agent-execution';
import type { Mission, ProviderStatus } from '../types/mission-types.js';
import { InMemoryMissionStore } from '../infrastructure/InMemoryMissionStore.js';
import { InMemoryCheckpointStore } from '../infrastructure/InMemoryCheckpointStore.js';
import { SystemClock } from '../infrastructure/SystemClock.js';
import { createIdGenerator } from '../infrastructure/IdGenerator.js';
import { DeterministicObjectiveSelector } from '../domain/objective-selector.js';
import { SimpleGoalUnderstanding } from '../domain/goal-understanding.js';
import { SimpleProviderAvailability } from '../domain/provider-availability.js';
import { classifyFailure } from '../domain/mission-failure-classifier.js';
import { MissionControllerService } from '../application/MissionControllerService.js';

export function createTestPlan(overrides?: Partial<AgentPlan>): AgentPlan {
  return {
    planId: 'plan_test_1',
    goalId: 'goal_test_1',
    objective: 'Test objective',
    steps: [
      {
        stepId: 'step_1',
        order: 0,
        action: { type: 'tool_call', tool: 'read_file', arguments: { path: 'test.ts' } },
        verification: { type: 'tool_success' },
        dependencies: [],
      },
    ],
    verification: { type: 'all_steps_succeed' },
    requiredCapabilities: ['coding'],
    estimatedCost: 0.01,
    ...overrides,
  } as AgentPlan;
}

export function createTestMission(overrides?: Partial<Mission>): Mission {
  const now = new Date().toISOString();
  return {
    missionId: 'mission_test_1',
    userId: 'user_test_1',
    title: 'Test Mission',
    objective: 'Complete test objectives',
    description: 'A test mission',
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
    budget: {
      maxObjectives: 5,
      maxActions: 50,
      maxToolCalls: 100,
      maxRetries: 3,
      maxReplans: 2,
      maxRuntimeMs: 3600000,
      maxTokens: 100000,
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
    state: 'CREATED',
    stateHistory: ['CREATED'],
    objectives: [],
    checkpoints: [],
    decisions: [],
    successCriteria: ['All objectives verified'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Mission;
}

export function createTestProviderStatus(overrides?: Partial<ProviderStatus>): ProviderStatus {
  return {
    available: true,
    capableProviders: [
      {
        providerId: 'gemini',
        modelId: 'gemini-1.5-pro',
        capabilities: ['coding', 'testing'],
        healthy: true,
      },
    ],
    unhealthyProviders: [],
    ...overrides,
  };
}
// ── Reusable fake ports + service builder ─────────────────────────────

export type FakeProviderInfo = {
  providerId: string;
  modelId: string;
  capabilities: string[];
  healthy: boolean;
};

export interface FakePortsOptions {
  /** Simulated execution result. */
  executorResult?: { success: boolean; verified: boolean; error?: string; failureClass?: string };
  /** Simulated verification result. */
  verifierResult?: { verified: boolean; evidence: string[] };
  /** Hook recording every executePlan call (duplicate-protection assertions). */
  onExecute?: (call: {
    plan: unknown;
    userId: string;
    allowedTools?: string[];
    permissionClasses?: string[];
  }) => void;
  /** Hook recording advisory signals requested. */
  onAdvisory?: (taskPattern: string) => void;
  /** Hook recording memory outcomes recorded. */
  onMemory?: (outcome: { success: boolean; evidence: string[] }) => void;
}

export interface FakePorts {
  objectiveSelector: any;
  providerAvailability: any;
  goalUnderstanding: any;
  planner: any;
  executor: any;
  verifier: any;
  executionMemory: any;
  experienceOptimization: any;
  failureClassifier: any;
}

export function createFakePorts(options: FakePortsOptions = {}): FakePorts {
  const executorResult = options.executorResult ?? { success: true, verified: true };
  const verifierResult = options.verifierResult ?? { verified: true, evidence: ['checks passed'] };

  return {
    objectiveSelector: new DeterministicObjectiveSelector(),
    providerAvailability: new SimpleProviderAvailability(),
    goalUnderstanding: new SimpleGoalUnderstanding(),
    planner: {
      createPlan: async (
        goal: string,
        caps: string[],
        constraints: string[],
      ): Promise<AgentPlan> => ({
        planId: 'plan_fake_1',
        goalId: 'goal_fake_1',
        objective: goal,
        steps: [
          {
            stepId: 'step_1',
            objective: goal,
            allowedTools: ['read_file'],
            dependencies: [],
            actions: [
              {
                actionId: 'a_1',
                kind: 'tool',
                toolName: 'read_file',
                arguments: { path: 'test.ts' },
              },
            ],
            verificationPolicy: {
              kind: 'command',
              description: 'read_file succeeds',
              command: { toolName: 'read_file', arguments: { path: 'test.ts' }, expect: 'ok' },
            },
          },
        ],
        finalVerification: {
          kind: 'command',
          description: 'all steps succeeded',
          command: { toolName: 'read_file', arguments: { path: 'test.ts' }, expect: 'ok' },
        },
        completionCriteria: ['objective verified'],
      }),
    },
    executor: {
      executePlan: async (
        plan: unknown,
        userId: string,
        _budget?: unknown,
        allowedTools?: string[],
        permissionClasses?: string[],
      ) => {
        options.onExecute?.({ plan, userId, allowedTools, permissionClasses });
        return {
          runId: 'run_fake_1',
          success: executorResult.success,
          verified: executorResult.verified,
          output: executorResult.success ? 'completed' : undefined,
          error: executorResult.error,
          failureClass: executorResult.failureClass,
          usage: { tokens: 100, costUsd: 0.001, latencyMs: 50, toolCalls: 1 },
        };
      },
    },
    verifier: {
      verifyObjective: async () => ({
        verified: verifierResult.verified,
        evidence: verifierResult.evidence,
        method: 'test_verification',
      }),
    },
    executionMemory: {
      recordVerifiedOutcome: async (
        _m: string,
        _o: string,
        outcome: { success: boolean; evidence: string[] },
      ) => {
        options.onMemory?.(outcome);
      },
    },
    experienceOptimization: {
      getAdvisorySignal: async (taskPattern: string) => {
        options.onAdvisory?.(taskPattern);
        return {
          recommendation: 'Proceed',
          confidence: 0.8,
          evidenceCount: 10,
          reason: 'Historical evidence',
        };
      },
    },
    failureClassifier: {
      classify: async (
        error: string,
        execResult: { failureClass?: string; usage: unknown },
        ps: ProviderStatus,
      ) => classifyFailure(error, execResult, ps),
    },
  };
}

export interface TestServiceContext {
  service: MissionControllerService;
  store: InMemoryMissionStore;
  checkpointStore: InMemoryCheckpointStore;
  providerAvailability: SimpleProviderAvailability;
  ports: FakePorts;
}

export interface TestServiceOptions extends FakePortsOptions {
  providers?: FakeProviderInfo[];
}

export function createTestService(options: TestServiceOptions = {}): TestServiceContext {
  const store = new InMemoryMissionStore();
  const checkpointStore = new InMemoryCheckpointStore();
  const ports = createFakePorts(options);
  const providerAvailability = options.providers
    ? new SimpleProviderAvailability(options.providers)
    : (ports.providerAvailability as SimpleProviderAvailability);

  const service = new MissionControllerService({
    store,
    checkpointStore,
    objectiveSelector: ports.objectiveSelector,
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
  });

  return { service, store, checkpointStore, providerAvailability, ports };
}
