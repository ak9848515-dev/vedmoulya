import type { AgentPlan } from '@vedmoulya/agent-execution';
import type {
  Mission,
  ProviderStatus,
  MissionObjective,
  MissionFailureClassification,
} from '../types/mission-types.js';
import type {
  LearningRetrievalPort,
  ObjectiveSelectionPort,
  ProviderAvailabilityPort,
  GoalUnderstandingPort,
  PlanningPort,
  ExecutionPort,
  VerificationPort,
  ExecutionMemoryPort,
  ExperienceOptimizationPort,
  FailureClassificationPort,
} from '../contracts/mission-ports.js';

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
  };
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
  };
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

export interface FakeProviderInfo {
  providerId: string;
  modelId: string;
  capabilities: string[];
  healthy: boolean;
}

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
    failureContext?: unknown;
  }) => void;
  /** Hook recording every understandGoal call. */
  onUnderstand?: (call: {
    objective: string;
    missionContext: string;
    constraints: unknown;
    failureContext?: unknown;
  }) => void;
  /** Hook recording advisory signals requested. */
  onAdvisory?: (taskPattern: string) => void;
  /** Hook recording memory outcomes recorded. */
  onMemory?: (outcome: { success: boolean; evidence: string[] }) => void;
  /** AUTONOMY-06 — hook recording failed-outcome learning records. */
  onFailedMemory?: (failure: { failureClass: string; reason: string; evidence: string[] }) => void;
  /** AUTONOMY-06 — hook recording every createPlan call (incl. learning). */
  onPlan?: (call: {
    goal: string;
    failureContext?: unknown;
    learning?: { items: Array<{ subject: string }>; text: string };
  }) => void;
  /** AUTONOMY-06 — optional learning retrieval port. */
  learningPort?: LearningRetrievalPort;
}

export interface FakePorts {
  objectiveSelector: ObjectiveSelectionPort;
  providerAvailability: ProviderAvailabilityPort;
  goalUnderstanding: GoalUnderstandingPort;
  planner: PlanningPort;
  executor: ExecutionPort;
  verifier: VerificationPort;
  executionMemory: ExecutionMemoryPort;
  experienceOptimization: ExperienceOptimizationPort;
  failureClassifier: FailureClassificationPort;
}

export function createFakePorts(options: FakePortsOptions = {}): FakePorts {
  const executorResult = options.executorResult ?? { success: true, verified: true };
  const verifierResult = options.verifierResult ?? { verified: true, evidence: ['checks passed'] };

  return {
    objectiveSelector: new DeterministicObjectiveSelector(),
    providerAvailability: new SimpleProviderAvailability(),
    goalUnderstanding: new SimpleGoalUnderstanding(),
    planner: {
      createPlan: (
        goal: string,
        caps: string[],
        constraints: string[],
        failureContext?: unknown,
        learning?: { items: Array<{ subject: string }>; text: string },
      ): Promise<AgentPlan> => {
        options.onPlan?.({ goal, failureContext, learning });
        return Promise.resolve({
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
        });
      },
    },
    executor: {
      executePlan: (
        plan: unknown,
        userId: string,
        _budget?: unknown,
        allowedTools?: string[],
        permissionClasses?: string[],
      ): Promise<{
        runId: string;
        success: boolean;
        verified: boolean;
        output?: string;
        error?: string;
        failureClass?: string;
        usage: { tokens: number; costUsd: number; latencyMs: number; toolCalls: number };
      }> => {
        options.onExecute?.({ plan, userId, allowedTools, permissionClasses });
        return Promise.resolve({
          runId: 'run_fake_1',
          success: executorResult.success,
          verified: executorResult.verified,
          output: executorResult.success ? 'completed' : undefined,
          error: executorResult.error,
          failureClass: executorResult.failureClass,
          usage: { tokens: 100, costUsd: 0.001, latencyMs: 50, toolCalls: 1 },
        });
      },
    },
    verifier: {
      verifyObjective: (
        _objective: MissionObjective,
        _executionResult: { output?: string; success: boolean },
      ): Promise<{ verified: boolean; evidence: string[]; method: string }> =>
        Promise.resolve({
          verified: verifierResult.verified,
          evidence: verifierResult.evidence,
          method: 'test_verification',
        }),
    },
    executionMemory: {
      recordVerifiedOutcome: (
        _m: string,
        _o: string,
        outcome: { success: boolean; evidence: string[] },
      ): Promise<void> => {
        options.onMemory?.(outcome);
        return Promise.resolve();
      },
      recordFailedOutcome: (
        _m: string,
        _o: string,
        failure: { failureClass: string; reason: string; evidence: string[] },
      ): Promise<void> => {
        options.onFailedMemory?.(failure);
        return Promise.resolve();
      },
    },
    experienceOptimization: {
      getAdvisorySignal: (
        taskPattern: string,
        _context: Record<string, unknown>,
      ): Promise<{
        recommendation?: string;
        confidence: number;
        evidenceCount: number;
        reason?: string;
      }> => {
        options.onAdvisory?.(taskPattern);
        return Promise.resolve({
          recommendation: 'Proceed',
          confidence: 0.8,
          evidenceCount: 10,
          reason: 'Historical evidence',
        });
      },
    },
    failureClassifier: {
      classify: (
        error: string,
        execResult: { failureClass?: string; usage: unknown },
        ps: ProviderStatus,
      ): Promise<MissionFailureClassification> =>
        Promise.resolve(classifyFailure(error, execResult, ps)),
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
    learning: options.learningPort,
    clock: new SystemClock(),
    idGenerator: createIdGenerator(),
  });

  return { service, store, checkpointStore, providerAvailability, ports };
}
