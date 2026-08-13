// Deterministic fixtures for EPIC-017 bridge tests. No secrets, no
// network, no live services — hermetic by construction.

import type { CapabilityId, FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';
import type { BrainTask } from '@vedmoulya/brain';
import type { IntelligenceOption, TaskIntelligenceResult } from '@vedmoulya/ecosystem-intelligence';
import type { ExecutionRun, StepRun } from '@vedmoulya/execution-bridge';
import type {
  BridgeAiWorldPort,
  BridgeBrainPort,
  BridgeClockPort,
  BridgeExecutionPort,
  BridgeIntelligencePort,
  BridgeMarketplacePort,
} from '../contracts/bridge-ports.js';
import type { BrainCandidatePort, BrainPreferencePort } from '../contracts/bridge-ports.js';

export class FixedClock implements BridgeClockPort {
  private t = 1_700_000_000_000;
  now(): string {
    return new Date(this.t).toISOString();
  }
  timestampMs(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

/** Deterministic candidate port: one configured provider + one discovery. */
export function createCandidatePort(): BrainCandidatePort {
  return {
    providerCandidates: async (capability: CapabilityId) => [
      {
        providerId: 'cfg-base',
        family: 'openai',
        name: 'Configured Base',
        modelId: 'gpt-base',
        modelName: 'GPT-Base',
        capabilities: [capability],
        quality: 0.7,
        costTier: 'free',
        availability: 1,
        configured: true,
        estimatedCostUsd: 0,
        evidence: [
          { claim: 'Configured and usable now.', source: 'registry', confidence: 'VERIFIED' },
        ],
      },
      {
        providerId: 'paid-star',
        family: 'openai',
        name: 'Paid Star',
        modelId: 'gpt-star',
        modelName: 'GPT-Star',
        capabilities: [capability],
        quality: 0.96,
        costTier: 'high',
        availability: 1,
        configured: false,
        estimatedCostUsd: 0.05,
        evidence: [
          { claim: 'High quality evidenced.', source: 'registry', confidence: 'MEASURED' },
        ],
      },
    ],
    discoveryCandidates: async () => [
      {
        itemId: 'item-github-1',
        category: 'github',
        title: 'OpenRepo Kit',
        capabilities: [],
        freeClass: 'OPEN_SOURCE',
        localAvailability: 'UNKNOWN',
        configurable: false,
        evidence: [
          {
            claim: 'Open-source project with active maintenance.',
            source: 'github',
            confidence: 'MEASURED',
          },
        ],
        securityFlags: ['needs-review'],
      },
    ],
    localModelCandidates: async () => [
      {
        id: 'local-q4',
        name: 'Local Q4',
        runtime: 'ollama',
        capabilities: [],
        capabilitiesProvenance: 'INFERRED',
        available: false,
        evidence: [
          {
            claim: 'Local runtime detected; quality inferred.',
            source: 'local',
            confidence: 'INFERRED',
          },
        ],
      },
    ],
  };
}

/** Deterministic intelligence port over the fixture candidates. */
export function createIntelligencePort(
  recordResponse?: (action: string, recommendationId: string) => void,
): BridgeIntelligencePort {
  return {
    findBetterOption: async (): Promise<TaskIntelligenceResult> => ({
      taskId: 'task-1',
      requestedOutcome: 'fixture',
      options: [
        {
          kind: 'BEST_CONFIGURED',
          providerId: 'cfg-base',
          name: 'Configured Base',
          capability: 'TEXT_GENERATION',
          quality: 70,
          reason: 'Already configured — usable now.',
          evidence: ['registry claim'],
          requires: [],
        },
        {
          kind: 'BEST_AVAILABLE_NOW',
          providerId: 'cfg-base',
          name: 'Configured Base',
          capability: 'TEXT_GENERATION',
          quality: 70,
          reason: 'Best among configured.',
          evidence: ['registry claim'],
          requires: [],
        },
        {
          kind: 'BEST_PAID',
          providerId: 'paid-star',
          name: 'Paid Star',
          capability: 'TEXT_GENERATION',
          quality: 96,
          costUsd: 0.05,
          reason: 'Stronger task evidence — materially better.',
          evidence: ['measured quality 96', 'task-fit evidence'],
          requires: ['api_key', 'subscription'],
        },
      ],
      bestAvailableNow: {
        kind: 'BEST_AVAILABLE_NOW',
        providerId: 'cfg-base',
        name: 'Configured Base',
        capability: 'TEXT_GENERATION',
        quality: 70,
        reason: 'Best among configured.',
        evidence: ['registry claim'],
        requires: [],
      },
      betterOptionAvailable: true,
      fallback: {
        order: ['FREE', 'FREE_QUOTA', 'LOCAL', 'OPEN_SOURCE', 'GITHUB', 'CURRENT_CONFIGURED'],
        bestAchievable: 'Continue with configured base.',
        note: 'Declining is never task failure.',
      },
    }),
    findFreeAlternative: async () => ({
      free: true,
      name: 'Configured Base',
      providerId: 'cfg-base',
      quality: 70,
    }),
    findLocalAlternative: async () => ({
      available: false,
      note: 'No local model available on current hardware.',
    }),
    findGitHubCapability: async () => ({
      found: true,
      items: [{ title: 'OpenRepo Kit', configurable: false, securityFlags: ['needs-review'] }],
    }),
    findBetterProvider: async () => ({
      better: true,
      current: { name: 'Configured Base', quality: 70 },
      recommended: { name: 'Paid Star', quality: 96, requiresActivation: true },
    }),
    evaluateSecurity: () => ({ state: 'SECURITY_REVIEWED', evidence: ['no blocking indicators'] }),
    evaluateLicense: (_userId, facts) => ({
      license: facts.license,
      software: {
        present: Boolean(facts.license),
        type: facts.license,
        commercialUseRestricted: false,
        redistributionRestricted: false,
        attributionRequired: false,
        verdict: facts.license ? 'PERMISSIVE' : 'LICENSE_UNKNOWN',
      },
      verdict: facts.license ? 'PERMISSIVE' : 'LICENSE_UNKNOWN',
    }),
    respondToRecommendation: async (_userId, recommendationId, action) => {
      recordResponse?.(action, recommendationId);
      return { state: action === 'use_recommended' ? 'ACCEPTED' : 'DECLINED' };
    },
    notify: (_, opts) => ({
      id: `notif-${opts.title.length}`,
      kind: opts.kind,
      title: opts.title,
      body: opts.body,
      relevance: opts.relevance,
      createdAt: new Date().toISOString(),
    }),
  };
}

/** Deterministic brain port returning a fully-formed BrainTask. */
export function createBrainPort(): BridgeBrainPort {
  const task = (id: string): BrainTask => ({
    id,
    userId: 'user-1',
    objective: 'Create a professional blog post',
    originalInput: 'Create a professional blog post',
    intent: {
      objective: 'Create a professional blog post',
      domain: 'content',
      desiredOutcome: 'A professional blog post',
      constraints: [],
      qualityTarget: 'HIGH',
      privacyRequirement: 'STANDARD',
      urgency: 'NORMAL',
      authorizedActions: [],
      ambiguities: [],
      assumptions: [],
    },
    mode: 'QUALITY',
    domain: 'content',
    qualityTarget: 'HIGH',
    privacyRequirement: 'STANDARD',
    budget: { maxTokens: 100000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 60000 },
    requiredCapabilities: ['TEXT_GENERATION'],
    roleAssignments: [],
    graph: { nodes: [], edges: [], waves: [] },
    status: 'NEW',
    stage: 'UNDERSTANDING',
    stageStatuses: {
      UNDERSTANDING: 'pending',
      PLAN: 'pending',
      INTELLIGENCE: 'pending',
      EXECUTION: 'pending',
      VERIFICATION: 'pending',
      RESULT: 'pending',
      CANCELLED: 'pending',
      FAILED: 'pending',
    },
    providerOutputs: [],
    conflicts: [],
    decisionRecords: [],
    // EPIC-020 — BrainTask gained failoverEvents; the fixture must stay in sync.
    failoverEvents: [],
    approvalRequired: [],
    approvalGranted: [],
    traceId: `trace-${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    createTask: () => ({ success: true, data: task('brain-1') }),
    plan: async (_, __) => ({
      success: true,
      data: {
        ...task('brain-1'),
        capabilityPlanId: 'plan-1',
        requiredCapabilities: ['TEXT_GENERATION'],
        stage: 'PLAN',
        stageStatuses: { ...task('brain-1').stageStatuses, PLAN: 'completed' },
      },
    }),
    selectResources: async () => ({ success: true, data: task('brain-1') }),
    requestApproval: () => ({ success: false, error: 'Not tested.', code: 'NOT_REQUIRED' }),
    approve: () => ({ success: true, data: { ...task('brain-1'), approvalGranted: ['purchase'] } }),
    reject: () => ({ success: true, data: { ...task('brain-1') } }),
    execute: async () => ({ success: true, data: task('brain-1') }),
    verify: () => ({ success: true, data: task('brain-1') }),
    evaluateOutcome: async () => ({ success: true, data: task('brain-1') }),
    getStatus: () => ({ success: true, data: task('brain-1') }),
    listTasks: () => ({ success: true, data: [task('brain-1')] }),
  };
}

/** Deterministic marketplace port. */
export function createMarketplacePort(): BridgeMarketplacePort {
  const plan: FactoryCapabilityPlan = {
    id: 'plan-1',
    requestedOutcome: 'Create a professional blog post',
    createdAt: new Date().toISOString(),
    requiredCapabilities: ['TEXT_GENERATION'],
    candidates: [],
    steps: [
      {
        id: 'create',
        title: 'Create',
        capability: 'TEXT_GENERATION',
        purpose: 'Produce the core content.',
        candidates: [],
        automation: 'FULLY_AUTOMATED',
        irreversible: false,
        reasons: ['fixture'],
      },
    ],
    automationLevel: 'FULLY_AUTOMATED',
    automationPercent: 100,
    evidence: [],
    risks: [],
    humanApprovalPoints: [],
    unavailableCapabilities: [],
    recommendations: [],
  };
  return {
    plan: async (_, __) => plan,
    getPlan: async (_, id) => (id === plan.id ? plan : undefined),
  };
}

/** Deterministic execution port with a fully-completed run. */
export function createExecutionPort(): BridgeExecutionPort {
  const step = (state: StepRun['state']): StepRun => ({
    stepId: 'create',
    title: 'Create',
    capability: 'TEXT_GENERATION',
    disposition: 'EXECUTABLE',
    state,
    provider: 'cfg-base',
    model: 'gpt-base',
    artifacts: [],
    attempts: 1,
    retried: false,
    costUsd: 0,
    tokensUsed: 100,
    latencyMs: 200,
    updatedAt: new Date().toISOString(),
    // Completed steps carry their verification contract (EXECUTION + OUTPUT + VALIDATION).
    ...(state === 'completed'
      ? {
          verification: {
            stepId: 'create',
            pre: { passed: true, checks: [] },
            post: { passed: true, checks: [] },
          },
        }
      : {}),
  });
  const run = (over: Partial<ExecutionRun> = {}): ExecutionRun => ({
    executionId: 'exec-1',
    planId: 'plan-1',
    ownerId: 'user-1',
    traceId: 'trace-exec-1',
    goal: 'Create a professional blog post',
    status: 'COMPLETED',
    steps: [step('completed')],
    checkpoints: [],
    handoffs: [],
    budget: {
      maxIterations: 10,
      maxTokens: 100000,
      maxCostUsd: 1,
      maxLatencyMs: 60000,
      spentTokens: 100,
      spentCostUsd: 0,
      spentLatencyMs: 200,
      iterations: 1,
      exceeded: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  });

  return {
    start: async () => ({ success: true, data: run() }),
    approve: async () => ({ success: true, data: run() }),
    reject: async () => ({ success: true, data: run({ status: 'BLOCKED' }) }),
    completeHandoff: async () => ({ success: true, data: run() }),
    get: () => ({ success: true, data: run() }),
    list: () => ({ success: true, data: [run()] }),
  };
}

/** Deterministic AI World emission port. */
export function createAiWorldPort(): {
  port: BridgeAiWorldPort;
  emitted: Array<{ kind: string; title: string }>;
} {
  const emitted: Array<{ kind: string; title: string }> = [];
  return {
    emitted,
    port: {
      emit: async (_userId, event) => {
        emitted.push({ kind: event.kind, title: event.title });
        return { emitted: true };
      },
      unreadCount: async () => emitted.length,
    },
  };
}

/** Recording preference port. */
export function createPreferencePort(): BrainPreferencePort & { events: unknown[] } {
  const events: unknown[] = [];
  return {
    events,
    record: async (event) => {
      events.push(event);
    },
  };
}

export function option(
  partial: Partial<IntelligenceOption> & { name: string },
): IntelligenceOption {
  return {
    kind: 'BEST_PAID',
    providerId: 'paid-star',
    capability: 'TEXT_GENERATION',
    reason: 'fixture option',
    evidence: [],
    requires: [],
    ...partial,
  };
}
