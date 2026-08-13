// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Enterprise Brain Plan Service (Pipeline)
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Verifies the 11-step decision pipeline: happy path over all engines
// and graceful degradation when engines are unavailable.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { BrainPlanService } from '../BrainPlanService.js';
import type { BrainEngines } from '../../../contracts/brain-engines.js';
import type { GoalDTO, TaskDTO } from '@vedmoulya/goals';
import type { LearningModelDTO } from '@vedmoulya/learning-intelligence';

const GOAL: GoalDTO = {
  goalId: 'goal_blog_seed',
  title: 'Publish a client blog post',
  description: '',
  category: 'business',
  business: ['blog'],
  priority: 'high',
  urgency: 0.7,
  importance: 0.9,
  complexity: 'standard',
  estimatedEffort: 5,
  status: 'active',
  confidence: 0.9,
  goalScore: 0.8,
  successCriteria: [],
  milestones: [],
  dependencies: [],
  childGoalIds: [],
  tags: [],
  events: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function task(): TaskDTO {
  return {
    taskId: 'task_1',
    goalId: 'goal_blog_seed',
    title: 'Draft',
    capability: 'writing',
    priority: 0.9,
    businessValue: 0.8,
    urgency: 0.7,
    importance: 0.8,
    risk: 0.2,
    confidence: 0.9,
    estimatedTokens: 500,
    estimatedCostUsd: 0.01,
    estimatedTimeMs: 60_000,
    dependencies: [],
    parallelEligible: true,
    flowType: 'sequential',
    retryPolicy: { maxRetries: 2, retryDelayMs: 1000, retryableFailures: [] },
    validationRules: [],
    status: 'planned',
    subTaskIds: [],
    order: 1,
    critical: false,
    slack: 0,
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
    sampleCount: 3,
    successCount: 3,
    failureCount: 0,
    successRate: 1,
    avgCostUsd: 0.1,
    avgLatencyMs: 500,
    avgAccuracy: 0.9,
    avgRetries: 0,
    avgQuality: 0.9,
    avgFeedback: 0,
    avgBusinessOutcome: 0,
    confidence: 0.5,
    trend: 0,
    lastSeen: '2026-08-01T00:00:00.000Z',
  };
}

/** Stub engines — every method succeeds with minimal valid data. */
function stubEngines(): BrainEngines {
  const ok = <T>(data: T): Promise<{ success: boolean; data?: T; error?: string }> =>
    Promise.resolve({ success: true, data });

  return {
    goals: {
      getGoal: () => ok(GOAL),
      listTasks: () => ok([task()]),
      getSummary: () =>
        ok({
          totalGoals: 1,
          activeGoals: 1,
          completedGoals: 0,
          byCategory: {},
          byStatus: {},
          byPriority: {},
          avgConfidence: 0.9,
          avgGoalScore: 0.8,
        }),
    },
    learning: {
      getDashboard: () =>
        ok({
          totals: {
            events: 54,
            successes: 45,
            failures: 9,
            pendingApprovals: 0,
            approved: 0,
            insights: 0,
            models: 5,
            reports: 0,
          },
          byCategory: {},
          trend: [],
          recentEvents: [],
          recommendations: [],
          insights: [],
          reports: [],
          models: [budgetModel()],
        }),
      getRecommendations: () => ok([]),
      getModels: () => ok([budgetModel()]),
    },
    capabilities: {
      getMarketplace: () =>
        ok({
          capabilities: [],
          total: 0,
          activeCount: 0,
          compositionCount: 0,
          countByStatus: {},
          countByCategory: {},
          countByBusinessModule: {},
        }),
    },
    providers: {
      getMarketplace: () =>
        ok({
          providers: [],
          total: 0,
          activeCount: 0,
          healthyCount: 0,
          countByLifecycleStatus: {},
          countByFamily: {},
          countByCapability: {},
        }),
    },
    context: {
      getContextSummary: () =>
        ok({
          total: 10,
          totalTokens: 5000,
          countBySource: {},
          countByCategory: {},
          countByPriority: {},
        }),
    },
    strategies: {
      getSummary: () =>
        ok({
          total: 2,
          averageConfidence: 0.8,
          countByPriority: {},
          countByExecutionMode: { sequential: 2 },
        }),
    },
    orchestrator: {
      getSummary: () =>
        ok({
          totalGraphs: 1,
          totalSessions: 2,
          activeSessions: 0,
          completedSessions: 1,
          failedSessions: 0,
          totalWorkers: 1,
          idleWorkers: 1,
          busyWorkers: 0,
          statusByState: {},
        }),
    },
  };
}

/** Stub engines — every method fails (degradation test). */
function failingEngines(): BrainEngines {
  const fail = (name: string): Promise<{ success: boolean; data?: never; error?: string }> =>
    Promise.reject(new Error(`${name} unavailable`));
  return {
    goals: {
      getGoal: () => fail('goals'),
      listTasks: () => fail('goals'),
      getSummary: () => fail('goals'),
    },
    learning: {
      getDashboard: () => fail('learning'),
      getRecommendations: () => fail('learning'),
      getModels: () => fail('learning'),
    },
    capabilities: { getMarketplace: () => fail('capabilities') },
    providers: { getMarketplace: () => fail('providers') },
    context: { getContextSummary: () => fail('context') },
    strategies: { getSummary: () => fail('strategies') },
    orchestrator: { getSummary: () => fail('orchestrator') },
  };
}

describe('BrainPlanService.buildPlan', () => {
  it('runs the full pipeline and assembles an explained plan', async () => {
    const service = new BrainPlanService();
    const { plan, errors } = await service.buildPlan('goal_blog_seed', stubEngines());

    expect(errors).toHaveLength(0);
    expect(plan.goalId).toBe('goal_blog_seed');
    expect(plan.goalTitle).toBe('Publish a client blog post');
    expect(plan.status).toBe('proposed');
    expect(plan.version).toBe(1);
    expect(plan.decisions).toHaveLength(14);
    expect(plan.overallConfidence).toBeGreaterThan(0);
    expect(plan.overallConfidence).toBeLessThanOrEqual(1);
  });

  it('records all 11 pipeline steps', async () => {
    const service = new BrainPlanService();
    const { plan } = await service.buildPlan('goal_blog_seed', stubEngines());
    expect(plan.pipeline).toHaveLength(11);
    expect(plan.pipeline[0]?.step).toBe('Receive Goal');
    expect(plan.pipeline[9]?.step).toBe('Explain Decision');
    expect(plan.pipeline[10]?.step).toBe('Pass to Execution Orchestrator');
    expect(plan.pipeline.every((step) => step.consulted)).toBe(true);
  });

  it('annotates the receive step with an operator budget', async () => {
    const service = new BrainPlanService();
    const { plan } = await service.buildPlan('goal_blog_seed', stubEngines(), { budgetUsd: 3.5 });
    expect(plan.pipeline[0]?.note).toContain('$3.5');
    expect(
      plan.decisions.find((d) => d.type === 'budget_strategy')?.recommendation.params.budgetMaxUsd,
    ).toBe(3.5);
  });

  it('degrades gracefully when every engine is unavailable', async () => {
    const service = new BrainPlanService();
    const { plan, errors } = await service.buildPlan('goal_missing', failingEngines());

    expect(errors.length).toBeGreaterThanOrEqual(8);
    expect(plan.decisions).toHaveLength(14);
    // Still fully explained, just lower confidence and explicit evidence.
    const unavailableMarkers = plan.decisions.filter((d) =>
      d.reason.evidence.some((line) => line.toLowerCase().includes('unavailable')),
    );
    expect(unavailableMarkers.length).toBeGreaterThanOrEqual(6);
    for (const decision of plan.decisions) {
      expect(decision.reason.why.length).toBeGreaterThan(0);
      expect(decision.reason.evidence.length).toBeGreaterThan(0);
      expect(decision.confidence.score).toBeLessThan(0.85);
    }
    // The consulted flags reflect the failures.
    const goalStep = plan.pipeline.find((step) => step.step === 'Consult Goal Engine');
    expect(goalStep?.consulted).toBe(false);
    expect(goalStep?.note).toBe('Engine unavailable — degraded decision');
    const analyzeStep = plan.pipeline.find((step) => step.step === 'Analyze Goal');
    expect(analyzeStep?.note).toBe('Goal not found in the Goal Engine');
    const receiveStep = plan.pipeline[0];
    expect(receiveStep?.consulted).toBe(true);
  });

  it('uses the operator actor for the plan', async () => {
    const service = new BrainPlanService();
    const { plan } = await service.buildPlan('goal_blog_seed', stubEngines(), {
      actor: 'human-owner',
    });
    expect(plan.actor).toBe('human-owner');
  });
});
