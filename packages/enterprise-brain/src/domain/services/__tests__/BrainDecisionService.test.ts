// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Enterprise Brain Decision Service
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Pins the 14 decision generators: types, recommendations,
// confidence levels, and the graceful-degradation paths.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { BrainDecisionService, type BrainEngineSnapshot } from '../BrainDecisionService.js';
import { BRAIN_DECISION_TYPES } from '../../../types/brain-types.js';
import type { GoalDTO, TaskDTO } from '@vedmoulya/goals';
import type { ProviderDTO } from '@vedmoulya/providers';
import type {
  LearningDashboardDTO,
  LearningModelDTO,
  LearningRecommendationDTO,
} from '@vedmoulya/learning-intelligence';

// ── Fixtures ────────────────────────────────────────────────────────────────

const GOAL: GoalDTO = {
  goalId: 'goal_blog_seed',
  title: 'Publish a client blog post',
  description: 'Write and publish a blog post for the content-agency client.',
  category: 'business',
  business: ['content-agency', 'blog'],
  priority: 'high',
  urgency: 0.7,
  importance: 0.9,
  complexity: 'standard',
  estimatedEffort: 5,
  status: 'active',
  confidence: 0.9,
  goalScore: 0.82,
  successCriteria: [],
  milestones: [],
  dependencies: [],
  childGoalIds: [],
  tags: ['blog'],
  classification: {
    businessDomain: ['content-agency'],
    requiredCapabilities: ['research'],
    requiredContext: ['knowledge'],
    riskScore: 0.42,
    riskLevel: 'medium',
    complexity: 'standard',
    estimatedTokenRange: { min: 1000, max: 5000 },
    estimatedCostRangeUsd: { min: 0.5, max: 1 },
  },
  events: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function task(id: string, overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    taskId: id,
    goalId: 'goal_blog_seed',
    title: `Task ${id}`,
    capability: 'research',
    priority: 0.8,
    businessValue: 0.7,
    urgency: 0.6,
    importance: 0.7,
    risk: 0.3,
    confidence: 0.9,
    estimatedTokens: 500,
    estimatedCostUsd: 0.01,
    estimatedTimeMs: 60_000,
    dependencies: [],
    parallelEligible: false,
    flowType: 'sequential',
    retryPolicy: { maxRetries: 2, retryDelayMs: 1000, retryableFailures: ['timeout'] },
    validationRules: [],
    status: 'planned',
    subTaskIds: [],
    order: 1,
    critical: false,
    slack: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function providerRec(
  entityLabel: string,
  entityId: string,
  type: string,
): LearningRecommendationDTO {
  return {
    recommendationId: `rec_${type}_${entityId}`,
    type: type as never,
    category: 'provider',
    title: type,
    description: '',
    targetEntity: { entityType: 'provider', entityId, entityLabel },
    value: 0.92,
    confidence: 0.9,
    sampleCount: 5,
    status: 'pending',
    version: 1,
    rationale: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function budgetModel(): LearningModelDTO {
  return {
    category: 'budget',
    entityType: 'budget',
    entityId: 'budget_standard',
    entityLabel: 'Standard budget',
    sampleCount: 4,
    successCount: 4,
    failureCount: 0,
    successRate: 1,
    avgCostUsd: 0.1,
    avgLatencyMs: 500,
    avgAccuracy: 0.9,
    avgRetries: 0,
    avgQuality: 0.9,
    avgFeedback: 0,
    avgBusinessOutcome: 0,
    confidence: 0.6,
    trend: 0,
    lastSeen: '2026-08-01T00:00:00.000Z',
  };
}

function learningDashboard(failures: number): LearningDashboardDTO {
  return {
    totals: {
      events: 54,
      successes: 54 - failures,
      failures,
      pendingApprovals: 0,
      approved: 0,
      insights: 0,
      models: 5,
      reports: 0,
    },
    byCategory: {
      provider: { events: 10, successRate: 0.9, models: 1, failures: 1, avgCostUsd: 0.01 },
      context: { events: 5, successRate: 0.9, models: 1, failures: 0, avgCostUsd: 0.01 },
      capability: { events: 7, successRate: 0.8, models: 1, failures: 1, avgCostUsd: 0.01 },
      prompt: { events: 5, successRate: 0.9, models: 1, failures: 0, avgCostUsd: 0.01 },
      budget: { events: 4, successRate: 1, models: 1, failures: 0, avgCostUsd: 0.6 },
      quality: { events: 3, successRate: 0.7, models: 1, failures: 1, avgCostUsd: 0.01 },
      execution: { events: 8, successRate: 0.8, models: 2, failures: 2, avgCostUsd: 0.02 },
      business: { events: 3, successRate: 1, models: 1, failures: 0, avgCostUsd: 0.4 },
      user_preference: { events: 3, successRate: 0.7, models: 1, failures: 1, avgCostUsd: 0.01 },
      failure: { events: 6, successRate: 0, models: 1, failures: 6, avgCostUsd: 0.02 },
    },
    trend: [],
    recentEvents: [],
    recommendations: [],
    insights: [],
    reports: [],
    models: [budgetModel()],
  };
}

function provider(id: string, name: string, healthy: boolean): ProviderDTO {
  return {
    id,
    family: 'openai',
    name,
    description: '',
    owner: 'test',
    models: [],
    capabilities: [],
    supportedModalities: [],
    inputPerMillionTokens: 3,
    outputPerMillionTokens: 15,
    currency: 'USD',
    costTier: 'low',
    p50Ms: 400,
    p95Ms: 900,
    requestsPerMinute: 60,
    tokensPerMinute: 1000,
    requestsPerDay: 1000,
    maxConcurrentRequests: 10,
    availability: 0.99,
    health: {
      status: healthy ? 'healthy' : 'degraded',
      healthScore: healthy ? 0.95 : 0.5,
      latencyMs: 400,
      successCount: 10,
      failureCount: healthy ? 0 : 5,
      quotaUsedPercent: 10,
      rateLimitRemaining: 100,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastCheckedAt: '2026-08-01T00:00:00.000Z',
    },
    lifecycleStatus: healthy ? 'active' : 'maintenance',
    version: '1.0.0',
    tags: [],
    matrix: [],
    bestQuality: healthy ? 0.95 : 0.6,
    bestCostUsd: 0.01,
    maxContextLength: 128_000,
    hasStreaming: true,
    hasVision: false,
    hasFunctionCalling: true,
    hasEmbeddings: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function baseSnapshot(overrides: Partial<BrainEngineSnapshot> = {}): BrainEngineSnapshot {
  return {
    goal: GOAL,
    tasks: [task('task_1'), task('task_2', { dependencies: ['task_1'], parallelEligible: true })],
    learning: learningDashboard(9),
    learningRecommendations: [providerRec('OpenAI', 'openai', 'best_provider')],
    learningModels: [budgetModel()],
    capabilities: {
      capabilities: [
        {
          id: 'research',
          name: 'Research',
          category: 'research',
          description: '',
          owner: 'test',
          inputs: [],
          outputs: [],
          dependencies: [],
          requiredAIFeatures: ['reasoning'],
          estimatedCostUsd: 0.004,
          costTier: 'low',
          estimatedInputTokens: 100,
          estimatedOutputTokens: 200,
          p50Ms: 800,
          p95Ms: 2000,
          qualityTarget: 0.95,
          qualityMinimum: 0.7,
          confidence: 0.94,
          version: '1.0.0',
          status: 'active',
          tags: [],
          businessModules: ['content-agency'],
          isComposition: false,
          composition: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      total: 1,
      activeCount: 1,
      compositionCount: 0,
      countByStatus: {},
      countByCategory: {},
      countByBusinessModule: {},
    },
    providers: {
      providers: [provider('openai', 'OpenAI', true), provider('google', 'Google', false)],
      total: 2,
      activeCount: 1,
      healthyCount: 1,
      countByLifecycleStatus: {},
      countByFamily: {},
      countByCapability: {},
    },
    context: {
      total: 30,
      totalTokens: 48_200,
      countBySource: {},
      countByCategory: {},
      countByPriority: { high: 5, critical: 1, medium: 10, low: 10, background: 4 },
    },
    strategies: {
      total: 4,
      averageConfidence: 0.84,
      countByPriority: {},
      countByExecutionMode: { pipeline: 3, sequential: 1 },
    },
    orchestrator: {
      totalGraphs: 2,
      totalSessions: 5,
      activeSessions: 1,
      completedSessions: 3,
      failedSessions: 1,
      totalWorkers: 2,
      idleWorkers: 1,
      busyWorkers: 1,
      statusByState: {},
    },
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('BrainDecisionService.generateDecisions', () => {
  const service = new BrainDecisionService();

  it('generates exactly the 14 documented decisions', () => {
    const decisions = service.generateDecisions('plan_x', GOAL, baseSnapshot());
    expect(decisions).toHaveLength(14);
    expect(decisions.map((d) => d.type).sort()).toEqual([...BRAIN_DECISION_TYPES].sort());
  });

  it('gives every decision full explainability and bounded confidence', () => {
    const decisions = service.generateDecisions('plan_x', GOAL, baseSnapshot());
    for (const decision of decisions) {
      expect(decision.reason.why.length).toBeGreaterThan(0);
      expect(decision.reason.evidence.length).toBeGreaterThan(0);
      expect(decision.reason.tradeoffs.length).toBeGreaterThan(0);
      expect(decision.reason.alternatives.length).toBeGreaterThan(0);
      expect(decision.reason.risks.length).toBeGreaterThan(0);
      expect(decision.confidence.score).toBeGreaterThanOrEqual(0);
      expect(decision.confidence.score).toBeLessThanOrEqual(1);
      expect(decision.status).toBe('proposed');
      expect(decision.version).toBe(1);
    }
  });

  it('provider_selection prefers the learned recommendation', () => {
    const decisions = service.generateDecisions('plan_x', GOAL, baseSnapshot());
    const provider = decisions.find((d) => d.type === 'provider_selection');
    expect(provider?.recommendation.entityId).toBe('openai');
    expect(provider?.recommendation.params.source).toBe('learning');
    expect(provider?.confidence.level).toBe('high');
  });

  it('provider_selection falls back to the registry when learning has no recommendation', () => {
    const snapshot = baseSnapshot({ learningRecommendations: [] });
    const decisions = service.generateDecisions('plan_x', GOAL, snapshot);
    const provider = decisions.find((d) => d.type === 'provider_selection');
    expect(provider?.recommendation.entityId).toBe('openai');
    expect(provider?.recommendation.params.source).toBe('registry');
  });

  it('provider_selection escalates when no healthy provider exists', () => {
    const snapshot = baseSnapshot({
      learningRecommendations: [],
      providers: {
        providers: [provider('google', 'Google', false)],
        total: 1,
        activeCount: 0,
        healthyCount: 0,
        countByLifecycleStatus: {},
        countByFamily: {},
        countByCapability: {},
      },
    });
    const decisions = service.generateDecisions('plan_x', GOAL, snapshot);
    const providerDecision = decisions.find((d) => d.type === 'provider_selection');
    expect(providerDecision?.recommendation.action).toBe('escalate');
  });

  it('provider_selection defers when no registry or learning data exists', () => {
    const snapshot = baseSnapshot({
      learningRecommendations: [],
      providers: undefined,
      learning: undefined,
      learningModels: [],
    });
    const decisions = service.generateDecisions('plan_x', GOAL, snapshot);
    const provider = decisions.find((d) => d.type === 'provider_selection');
    expect(provider?.recommendation.action).toBe('defer');
  });

  it('task_priority defers when no tasks exist', () => {
    const snapshot = baseSnapshot({ tasks: [] });
    const decisions = service.generateDecisions('plan_x', GOAL, snapshot);
    const priority = decisions.find((d) => d.type === 'task_priority');
    expect(priority?.recommendation.action).toBe('defer');
    const order = decisions.find((d) => d.type === 'execution_order');
    expect(order?.recommendation.params.order).toEqual([]);
  });

  it('task_priority ranks tasks and execution_order is dependency-safe', () => {
    const decisions = service.generateDecisions('plan_x', GOAL, baseSnapshot());
    const priority = decisions.find((d) => d.type === 'task_priority');
    expect(priority?.recommendation.params.order).toEqual(['task_1', 'task_2']);
    const order = decisions.find((d) => d.type === 'execution_order');
    const sequence = order?.recommendation.params.order as string[];
    // Dependency safety: task_1 (dependency of task_2) must come first.
    expect(sequence.indexOf('task_2')).toBeGreaterThan(sequence.indexOf('task_1'));
  });

  it('budget_strategy honors an explicit operator budget', () => {
    const snapshot = baseSnapshot({ budgetUsd: 3.5 });
    const decisions = service.generateDecisions('plan_x', GOAL, snapshot);
    const budget = decisions.find((d) => d.type === 'budget_strategy');
    expect(budget?.recommendation.params.budgetMinUsd).toBe(3.5);
    expect(budget?.recommendation.params.budgetMaxUsd).toBe(3.5);
  });

  it('quality_threshold is strict for high-priority goals and standard otherwise', () => {
    const strict = service.generateDecisions('plan_x', GOAL, baseSnapshot());
    expect(
      strict.find((d) => d.type === 'quality_threshold')?.recommendation.params.qualityThreshold,
    ).toBe(0.9);

    const lowGoal: GoalDTO = { ...GOAL, priority: 'low' };
    const standard = service.generateDecisions('plan_x', lowGoal, baseSnapshot());
    expect(
      standard.find((d) => d.type === 'quality_threshold')?.recommendation.params.qualityThreshold,
    ).toBe(0.75);
  });

  it('retry_policy scales with the observed failure rate', () => {
    const highFailures = service.generateDecisions(
      'plan_x',
      GOAL,
      baseSnapshot({ learning: learningDashboard(30) }),
    );
    expect(
      highFailures.find((d) => d.type === 'retry_policy')?.recommendation.params.maxRetries,
    ).toBe(4);

    const lowFailures = service.generateDecisions(
      'plan_x',
      GOAL,
      baseSnapshot({ learning: learningDashboard(1) }),
    );
    expect(
      lowFailures.find((d) => d.type === 'retry_policy')?.recommendation.params.maxRetries,
    ).toBe(2);
  });

  it('execution_strategy picks the dominant mode from the strategy registry', () => {
    const decisions = service.generateDecisions('plan_x', GOAL, baseSnapshot());
    const strategy = decisions.find((d) => d.type === 'execution_strategy');
    expect(strategy?.recommendation.params.mode).toBe('pipeline');
  });

  it('context_strategy switches to hybrid compression for heavy context', () => {
    const heavy = baseSnapshot({
      context: {
        total: 100,
        totalTokens: 120_000,
        countBySource: {},
        countByCategory: {},
        countByPriority: {},
      },
    });
    const decisions = service.generateDecisions('plan_x', GOAL, heavy);
    const strategy = decisions.find((d) => d.type === 'context_strategy');
    expect(strategy?.recommendation.params.compression).toBe('hybrid');
  });

  it('capability_selection matches the goal requirements against the registry', () => {
    const decisions = service.generateDecisions('plan_x', GOAL, baseSnapshot());
    const capability = decisions.find((d) => d.type === 'capability_selection');
    expect(capability?.recommendation.entityId).toBe('research');
    expect(capability?.confidence.level).toBe('high');
  });

  it('capability_selection defers when the registry is unavailable', () => {
    const decisions = service.generateDecisions(
      'plan_x',
      GOAL,
      baseSnapshot({ capabilities: undefined }),
    );
    const capability = decisions.find((d) => d.type === 'capability_selection');
    expect(capability?.recommendation.action).toBe('defer');
  });

  it('fallback_policy builds a healthy-provider chain', () => {
    const decisions = service.generateDecisions('plan_x', GOAL, baseSnapshot());
    const fallback = decisions.find((d) => d.type === 'fallback_policy');
    expect((fallback?.recommendation.params.fallbackOrder as string[]).includes('openai')).toBe(
      true,
    );
  });

  it('maps business objectives by goal category', () => {
    const decisions = service.generateDecisions('plan_x', GOAL, baseSnapshot());
    const objectives = decisions.find((d) => d.type === 'business_objectives');
    expect(objectives?.recommendation.params.objectives).toEqual(
      expect.arrayContaining(['Operational impact']),
    );

    const revenueGoal: GoalDTO = { ...GOAL, category: 'revenue' };
    const revenue = service.generateDecisions('plan_x', revenueGoal, baseSnapshot());
    expect(
      revenue.find((d) => d.type === 'business_objectives')?.recommendation.params.objectives,
    ).toContain('Revenue growth');
  });

  it('handles a missing goal gracefully (received descriptor only)', () => {
    const snapshot = baseSnapshot({
      goal: undefined,
      tasks: [],
      capabilities: undefined,
      providers: undefined,
      context: undefined,
      strategies: undefined,
      learning: undefined,
      learningRecommendations: [],
      learningModels: [],
    });
    const decisions = service.generateDecisions('plan_x', undefined, snapshot);
    expect(decisions).toHaveLength(14);
    for (const decision of decisions) {
      expect(decision.goalId).toBe('received_goal');
      expect(decision.confidence.score).toBeLessThan(0.8); // lower confidence without data
    }
  });

  it('enginesUsed reflects the engines that contributed data', () => {
    expect(service.enginesUsed('provider_selection', baseSnapshot())).toEqual([
      'goals',
      'learning',
      'providers',
    ]);
    expect(
      service.enginesUsed(
        'provider_selection',
        baseSnapshot({ learning: undefined, learningModels: [] }),
      ),
    ).toEqual(['goals', 'providers']);
    expect(service.enginesUsed('quality_threshold', baseSnapshot())).toEqual(['goals']);
    expect(
      service.enginesUsed('goal_priority', baseSnapshot({ goal: undefined, tasks: [] })),
    ).toEqual([]);
  });

  it('respects custom confidence thresholds via options', () => {
    const strict = new BrainDecisionService({ highConfidenceAt: 0.9 });
    const decisions = strict.generateDecisions('plan_x', GOAL, baseSnapshot());
    const provider = decisions.find((d) => d.type === 'provider_selection');
    expect(provider?.confidence.level).toBe('medium'); // 0.85 < 0.9
  });
});
