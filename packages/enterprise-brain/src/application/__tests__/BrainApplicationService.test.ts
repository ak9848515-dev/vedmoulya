// ──────────────────────────────────────────────────────────────────
// VedMoulya — Integration Tests: Enterprise Brain Application Service
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Runs the Brain over the REAL seeded engines (goals, capabilities,
// providers, context, strategies, orchestrator, learning) exactly as
// the gateway wires them, plus the human-approval/handoff workflow.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { BrainApplicationService } from '../BrainApplicationService.js';
import { InMemoryBrainRepository } from '../../infrastructure/InMemoryBrainRepository.js';
import { createCatalogBrainPlan, hasAllDecisionTypes } from '../../catalog/brain-catalog.js';
import {
  GoalsApplicationService,
  InMemoryGoalRepository,
  InMemoryTaskRepository,
  createCatalogGoals,
} from '@vedmoulya/goals';
import {
  CapabilityApplicationService,
  InMemoryCapabilityRepository,
  createCatalogCapabilities,
} from '@vedmoulya/capabilities';
import {
  ProviderApplicationService,
  InMemoryProviderRepository,
  createCatalogProviders,
} from '@vedmoulya/providers';
import {
  ContextApplicationService,
  InMemoryContextRepository,
  createCatalogContext,
} from '@vedmoulya/context';
import {
  ExecutionStrategyApplicationService,
  InMemoryExecutionStrategyRepository,
  createCatalogStrategies,
} from '@vedmoulya/execution-strategy';
import {
  OrchestratorApplicationService,
  InMemoryExecutionGraphRepository,
  InMemoryExecutionSessionRepository,
  InMemoryWorkerRegistry,
  InMemoryExecutionQueueRepository,
  InMemoryExecutionHistoryRepository,
} from '@vedmoulya/execution-orchestrator';
import {
  LearningIntelligenceApplicationService,
  InMemoryLearningRepository,
  createCatalogLearningEvents,
} from '@vedmoulya/learning-intelligence';
import { BRAIN_DECISION_TYPES } from '../../types/brain-types.js';

// ── The engine bundle exactly as the gateway wires it ───────────────────────

function buildBrain(repository = new InMemoryBrainRepository()): BrainApplicationService {
  const goals = new GoalsApplicationService(
    new InMemoryGoalRepository(createCatalogGoals()),
    new InMemoryTaskRepository(),
  );
  const capabilities = new CapabilityApplicationService(
    new InMemoryCapabilityRepository(createCatalogCapabilities()),
  );
  const providers = new ProviderApplicationService(
    new InMemoryProviderRepository(createCatalogProviders()),
  );
  const context = new ContextApplicationService(
    new InMemoryContextRepository(createCatalogContext()),
  );
  const strategies = new ExecutionStrategyApplicationService(
    new InMemoryExecutionStrategyRepository(createCatalogStrategies()),
  );
  const orchestrator = new OrchestratorApplicationService(
    new InMemoryExecutionGraphRepository(),
    new InMemoryExecutionSessionRepository(),
    new InMemoryWorkerRegistry(),
    new InMemoryExecutionQueueRepository(),
    new InMemoryExecutionHistoryRepository(),
  );
  const learning = new LearningIntelligenceApplicationService(
    new InMemoryLearningRepository(createCatalogLearningEvents()),
    { goals, capabilities, providers, context, strategies, orchestrator },
  );
  return new BrainApplicationService(repository, {
    goals,
    learning,
    capabilities,
    providers,
    context,
    strategies,
    orchestrator,
  });
}

describe('BrainApplicationService — decideGoal pipeline', () => {
  it('decides a seeded goal into a persisted, fully explained plan', async () => {
    const brain = buildBrain();
    const result = await brain.decideGoal({ goalId: 'goal_blog_seed' });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    const plan = result.data;
    expect(plan?.goalId).toBe('goal_blog_seed');
    expect(plan?.decisions).toHaveLength(14);
    expect(hasAllDecisionTypes(plan?.decisions ?? [])).toBe(true);
    expect(plan?.pipeline).toHaveLength(11);
    expect(plan?.overallConfidence).toBeGreaterThan(0);
    // Persisted: retrievable by id.
    const fetched = await brain.getPlan(plan?.planId ?? '');
    expect(fetched.data?.planId).toBe(plan?.planId);
  });

  it('honors an operator budget in the budget decision', async () => {
    const brain = buildBrain();
    const result = await brain.decideGoal({ goalId: 'goal_blog_seed', budgetUsd: 4 });
    const budget = result.data?.decisions.find((d) => d.type === 'budget_strategy');
    expect(budget?.recommendation.params.budgetMaxUsd).toBe(4);
  });

  it('re-deciding a goal supersedes the previous plan (audited)', async () => {
    const brain = buildBrain();
    const first = await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const second = await brain.decideGoal({ goalId: 'goal_blog_seed' });
    expect(second.data?.planId).not.toBe(first.data?.planId);

    const plans = await brain.listPlans('goal_blog_seed');
    expect(plans.data).toHaveLength(2);
    const superseded = plans.data?.find((p) => p.planId === first.data?.planId);
    expect(superseded?.status).toBe('superseded');
    expect(superseded?.version).toBe(2);

    const oldDecisions = await brain.listDecisions({
      goalId: 'goal_blog_seed',
      page: 1,
      limit: 100,
    });
    const firstPlanDecisions =
      oldDecisions.data?.items.filter((d) => d.planId === first.data?.planId) ?? [];
    expect(firstPlanDecisions.length).toBeGreaterThan(0);
    expect(firstPlanDecisions.every((d) => d.status === 'superseded')).toBe(true);
  });

  it('rejects a missing goal with a clear error', async () => {
    const brain = buildBrain();
    const result = await brain.decideGoal({ goalId: 'does-not-exist' });
    // The pipeline degrades but the plan is still produced for the descriptor.
    expect(result.success).toBe(true);
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.data?.goalTitle).toBe('Received goal');
  });

  it('validates input at the boundary', async () => {
    const brain = buildBrain();
    const empty = await brain.decideGoal({ goalId: '' });
    expect(empty.success).toBe(false);
    expect(empty.error).toContain('goalId');

    const negative = await brain.decideGoal({ goalId: 'goal_blog_seed', budgetUsd: -1 });
    expect(negative.success).toBe(false);
    expect(negative.error).toContain('budgetUsd');
  });
});

describe('BrainApplicationService — human-approval workflow', () => {
  it('approves and rejects individual decisions (versioned + audited)', async () => {
    const brain = buildBrain();
    await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const decisions = await brain.listDecisions({});
    const provider = decisions.data?.items.find((d) => d.type === 'provider_selection');

    const approved = await brain.approveDecision({
      decisionId: provider?.decisionId ?? '',
      actor: 'owner',
      note: 'looks good',
    });
    expect(approved.success).toBe(true);
    expect(approved.data?.status).toBe('approved');
    expect(approved.data?.version).toBe(2);
    expect(approved.data?.history).toHaveLength(2);
    expect(approved.data?.history[1]?.note).toBe('looks good');

    const rejected = await brain.rejectDecision({
      decisionId: provider?.decisionId ?? '',
      actor: 'owner',
    });
    expect(rejected.success).toBe(false); // already approved → cannot reject

    // Approve a different decision, then reject it.
    const budget = decisions.data?.items.find((d) => d.type === 'budget_strategy');
    const rejectResult = await brain.rejectDecision({
      decisionId: budget?.decisionId ?? '',
      actor: 'owner',
    });
    expect(rejectResult.success).toBe(true);
    expect(rejectResult.data?.status).toBe('rejected');
    expect(rejectResult.data?.version).toBe(2);
  });

  it('requires an actor for decision actions', async () => {
    const brain = buildBrain();
    await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const decisions = await brain.listDecisions({});
    const result = await brain.approveDecision({
      decisionId: decisions.data?.items[0]?.decisionId ?? '',
      actor: '',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('actor');
  });

  it('returns a typed error for unknown decisions', async () => {
    const brain = buildBrain();
    const result = await brain.approveDecision({ decisionId: 'missing', actor: 'owner' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Decision not found');
  });

  it('approvePlan approves the plan and every proposed decision', async () => {
    const brain = buildBrain();
    const decided = await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const approved = await brain.approvePlan({
      planId: decided.data?.planId ?? '',
      actor: 'owner',
    });
    expect(approved.success).toBe(true);
    expect(approved.data?.status).toBe('approved');
    expect(approved.data?.version).toBe(2);

    const decisions = await brain.listDecisions({});
    const planDecisions =
      decisions.data?.items.filter((d) => d.planId === decided.data?.planId) ?? [];
    expect(planDecisions.every((d) => d.status === 'approved')).toBe(true);
  });

  it('handOffPlan requires approval first, then hands the plan to the orchestrator', async () => {
    const brain = buildBrain();
    const decided = await brain.decideGoal({ goalId: 'goal_blog_seed' });

    const premature = await brain.handOffPlan({
      planId: decided.data?.planId ?? '',
      actor: 'owner',
    });
    expect(premature.success).toBe(false);
    expect(premature.error).toContain('approved');

    await brain.approvePlan({ planId: decided.data?.planId ?? '', actor: 'owner' });
    const handed = await brain.handOffPlan({
      planId: decided.data?.planId ?? '',
      actor: 'owner',
      note: 'run it',
    });
    expect(handed.success).toBe(true);
    expect(handed.data?.status).toBe('handed_off');

    const decisions = await brain.listDecisions({});
    const planDecisions =
      decisions.data?.items.filter((d) => d.planId === decided.data?.planId) ?? [];
    expect(planDecisions.every((d) => d.status === 'handed_off')).toBe(true);
  });

  it('rejectPlan rejects the plan and its proposed decisions', async () => {
    const brain = buildBrain();
    const decided = await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const rejected = await brain.rejectPlan({ planId: decided.data?.planId ?? '', actor: 'owner' });
    expect(rejected.success).toBe(true);
    expect(rejected.data?.status).toBe('rejected');
  });

  it('a vetoed decision blocks plan approval (re-decide or reject the plan)', async () => {
    const brain = buildBrain();
    const decided = await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const decisions = await brain.listDecisions({});
    const budget = decisions.data?.items.find((d) => d.type === 'budget_strategy');
    await brain.rejectDecision({ decisionId: budget?.decisionId ?? '', actor: 'owner' });

    const approve = await brain.approvePlan({ planId: decided.data?.planId ?? '', actor: 'owner' });
    expect(approve.success).toBe(false);
    expect(approve.error).toContain('rejected');

    // The remedy: re-deciding the goal supersedes the blocked plan.
    const redecided = await brain.decideGoal({ goalId: 'goal_blog_seed' });
    expect(redecided.success).toBe(true);
    expect(redecided.data?.planId).not.toBe(decided.data?.planId);
  });

  it('handOffPlan refuses a plan carrying a vetoed decision', async () => {
    const { plan, decisions } = createCatalogBrainPlan();
    const approvedPlan = { ...plan, status: 'approved' as const, version: 2 };
    const mutatedDecisions = decisions.map((d, i) =>
      i === 0
        ? { ...d, status: 'rejected' as const, version: 2 }
        : { ...d, status: 'approved' as const, version: 2 },
    );
    const brain = buildBrain(
      new InMemoryBrainRepository({ plans: [approvedPlan], decisions: mutatedDecisions }),
    );

    const result = await brain.handOffPlan({ planId: plan.planId, actor: 'owner' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('approved');
  });
});

describe('BrainApplicationService — queries', () => {
  it('getTimeline returns recent decisions newest first', async () => {
    const brain = buildBrain();
    await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const timeline = await brain.getTimeline({ limit: 5 });
    expect(timeline.success).toBe(true);
    expect(timeline.data?.length).toBe(5);
  });

  it('getHistory flattens the version history feed', async () => {
    const brain = buildBrain();
    await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const decisions = await brain.listDecisions({});
    const provider = decisions.data?.items.find((d) => d.type === 'provider_selection');
    await brain.approveDecision({ decisionId: provider?.decisionId ?? '', actor: 'owner' });

    const history = await brain.getHistory();
    expect(history.success).toBe(true);
    expect(history.data?.length).toBeGreaterThan(14);
    expect(history.data?.some((h) => h.action === 'approved')).toBe(true);
    expect(history.data?.every((h) => h.timestamp)).toBe(true);
  });

  it('getMetrics aggregates the decision store', async () => {
    const brain = buildBrain();
    await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const metrics = await brain.getMetrics();
    expect(metrics.success).toBe(true);
    expect(metrics.data?.totals.decisions).toBe(14);
    expect(metrics.data?.totals.plans).toBe(1);
    expect(metrics.data?.byType.goal_priority.count).toBe(1);
  });

  it('getDashboard returns the aggregate with a 14-day trend', async () => {
    const brain = buildBrain();
    await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const dashboard = await brain.getDashboard();
    expect(dashboard.success).toBe(true);
    expect(dashboard.data?.totals.decisions).toBe(14);
    expect(dashboard.data?.totals.pendingApprovals).toBe(14);
    expect(dashboard.data?.trend).toHaveLength(14);
    expect(dashboard.data?.recentDecisions.length).toBeGreaterThan(0);
    expect(dashboard.data?.recentPlans.length).toBeGreaterThan(0);
    expect(Object.keys(dashboard.data?.byType ?? {})).toHaveLength(BRAIN_DECISION_TYPES.length);
  });

  it('supports filtered + paginated decision listing', async () => {
    const brain = buildBrain();
    await brain.decideGoal({ goalId: 'goal_blog_seed' });
    const providers = await brain.listDecisions({ type: 'provider_selection' });
    expect(providers.data?.total).toBe(1);

    const paged = await brain.listDecisions({ page: 1, limit: 5 });
    expect(paged.data?.items).toHaveLength(5);
    expect(paged.data?.total).toBe(14);
  });
});

describe('BrainApplicationService — seeded repository', () => {
  it('serves the seed catalog from the dashboard', async () => {
    const { plan, decisions } = createCatalogBrainPlan();
    const brain = buildBrain(new InMemoryBrainRepository({ plans: [plan], decisions }));
    const dashboard = await brain.getDashboard();
    expect(dashboard.data?.totals.decisions).toBe(14);
    expect(dashboard.data?.totals.plans).toBe(1);
    expect(dashboard.data?.totals.approved).toBe(2);
    const planById = await brain.getPlan(plan.planId);
    expect(planById.data?.overallConfidence).toBe(0.78);
  });
});
