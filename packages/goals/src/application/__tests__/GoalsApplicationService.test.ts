import { describe, expect, it } from 'vitest';
import { GoalsApplicationService } from '../GoalsApplicationService.js';
import { InMemoryGoalRepository } from '../../infrastructure/InMemoryGoalRepository.js';
import { InMemoryTaskRepository } from '../../infrastructure/InMemoryTaskRepository.js';
import { createCatalogGoals } from '../../catalog/goal-catalog.js';

function makeService(seed = false): GoalsApplicationService {
  return new GoalsApplicationService(
    seed ? new InMemoryGoalRepository(createCatalogGoals()) : new InMemoryGoalRepository(),
    new InMemoryTaskRepository(),
  );
}

describe('GoalsApplicationService', () => {
  it('creates a goal with analysis, classification, criteria, and events', async () => {
    const svc = makeService();
    const result = await svc.createGoal({
      userId: 'u1',
      title: 'Grow recurring revenue by 25%',
      description: 'Increase monthly subscription sales and retainers this quarter.',
    });
    expect(result.success).toBe(true);
    const goal = result.data;
    expect(goal).toBeDefined();
    expect(goal?.category).toBe('revenue');
    expect(goal?.status).toBe('proposed');
    expect(goal?.successCriteria.length).toBeGreaterThan(0);
    expect(goal?.classification).toBeDefined();
    expect(goal?.analysis).toBeDefined();
    expect(goal?.goalScore).toBeGreaterThan(0);
    expect(goal?.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['created', 'analyzed']),
    );
  });

  it('honors explicit inputs and success criteria', async () => {
    const svc = makeService();
    const result = await svc.createGoal({
      userId: 'u1',
      title: 'Ship the dashboard',
      description: 'Launch the internal analytics dashboard for the platform team.',
      category: 'project',
      priority: 'high',
      urgency: 0.9,
      importance: 0.9,
      estimatedEffort: 40,
      tags: ['product'],
      successCriteria: [
        {
          definition: 'MVP deployed',
          validation: 'Verify production deployment',
          completionCriteria: ['Deploy verified'],
          expectedOutcome: 'Team uses it daily',
        },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data?.category).toBe('project');
    expect(result.data?.priority).toBe('high');
    expect(result.data?.successCriteria[0]?.definition).toBe('MVP deployed');
  });

  it('generates a task graph with critical path and milestones', async () => {
    const svc = makeService();
    const created = await svc.createGoal({
      userId: 'u1',
      title: 'Grow recurring revenue by 25%',
      description: 'Increase monthly subscription sales and retainers this quarter.',
    });
    const goalId = created.data?.goalId;
    expect(goalId).toBeDefined();
    const result = await svc.generateTasks(goalId ?? '');
    expect(result.success).toBe(true);
    const graph = result.data;
    expect(graph?.tasks.length).toBeGreaterThan(0);
    expect(graph?.criticalPath.length).toBeGreaterThan(0);
    expect(graph?.parallelGroups.length).toBeGreaterThanOrEqual(0);
    expect(graph?.milestones.length).toBeGreaterThan(0);
    expect(graph?.totalEstimatedTokens).toBeGreaterThan(0);
    expect(graph?.tasks.every((t) => t.priority > 0)).toBe(true);
  });

  it('validates a goal after task generation passes all checks', async () => {
    const svc = makeService();
    const created = await svc.createGoal({
      userId: 'u1',
      title: 'Grow recurring revenue by 25%',
      description: 'Increase monthly subscription sales and retainers this quarter.',
    });
    const goalId = created.data?.goalId ?? '';
    await svc.generateTasks(goalId);
    const result = await svc.validateGoal(goalId);
    expect(result.success).toBe(true);
    expect(result.data?.passed).toBe(true);
    expect(result.data?.checks.length).toBe(8);
  });

  it('explains a goal', async () => {
    const svc = makeService(true);
    const goals = await svc.listGoals();
    const goalId = goals.data?.[0]?.goalId ?? '';
    const result = await svc.explainGoal(goalId);
    expect(result.success).toBe(true);
    expect(result.data?.goalId).toBe(goalId);
    expect(result.data?.classificationSummary.length).toBeGreaterThan(0);
  });

  it('walks the full lifecycle through transitions', async () => {
    const svc = makeService();
    const created = await svc.createGoal({
      userId: 'u1',
      title: 'Improve health',
      description: 'Build a sustainable fitness and nutrition routine.',
    });
    const goalId = created.data?.goalId ?? '';

    const scored = await svc.transitionGoal(goalId, { type: 'score' });
    expect(scored.data?.status).toBe('scored');
    const accepted = await svc.transitionGoal(goalId, { type: 'accept' });
    expect(accepted.data?.status).toBe('accepted');
    const active = await svc.transitionGoal(goalId, { type: 'activate' });
    expect(active.data?.status).toBe('active');
    const blocked = await svc.transitionGoal(goalId, { type: 'block', reason: 'awaiting budget' });
    expect(blocked.data?.status).toBe('blocked');
    const resumed = await svc.transitionGoal(goalId, { type: 'unblock' });
    expect(resumed.data?.status).toBe('active');
    const completed = await svc.transitionGoal(goalId, { type: 'complete' });
    expect(completed.data?.status).toBe('completed');
    const archived = await svc.transitionGoal(goalId, { type: 'archive' });
    expect(archived.data?.status).toBe('archived');
    expect(archived.data?.events.map((e) => e.type)).toContain('archived');
  });

  it('rejects illegal lifecycle transitions with an error', async () => {
    const svc = makeService();
    const created = await svc.createGoal({
      userId: 'u1',
      title: 'Some goal',
      description: 'A goal that cannot be completed from proposed state.',
    });
    const goalId = created.data?.goalId ?? '';
    const result = await svc.transitionGoal(goalId, { type: 'complete' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Illegal goal transition');
  });

  it('links a child goal under a parent', async () => {
    const svc = makeService();
    const parent = await svc.createGoal({
      userId: 'u1',
      title: 'Grow the agency',
      description: 'Grow the content agency across operations and revenue.',
    });
    const parentId = parent.data?.goalId ?? '';
    const child = await svc.createGoal({
      userId: 'u1',
      title: 'Sign three retainers',
      description: 'Close three new retainer deals for the agency.',
      parentGoalId: parentId,
    });
    expect(child.success).toBe(true);
    expect(child.data?.parentGoalId).toBe(parentId);
    const parentNow = await svc.getGoal(parentId);
    expect(parentNow.data?.childGoalIds).toContain(child.data?.goalId);
  });

  it('builds a strategy handoff after generation', async () => {
    const svc = makeService();
    const created = await svc.createGoal({
      userId: 'u1',
      title: 'Grow recurring revenue by 25%',
      description: 'Increase monthly subscription sales and retainers this quarter.',
    });
    const goalId = created.data?.goalId ?? '';
    await svc.generateTasks(goalId);
    const handoff = await svc.buildStrategyHandoff(goalId);
    expect(handoff.success).toBe(true);
    expect(handoff.data?.goalId).toBe(goalId);
    expect(handoff.data?.steps.length).toBeGreaterThan(0);
    expect(handoff.data?.mode).toMatch(/sequential|hybrid|parallel|pipeline/);
    expect(handoff.data?.estimatedTokens).toBeGreaterThan(0);
  });

  it('returns a summary across goals and tasks', async () => {
    const svc = makeService(true);
    const summary = await svc.getSummary();
    expect(summary.success).toBe(true);
    expect(summary.data?.totalGoals).toBe(5);
    expect(summary.data?.byCategory).toHaveProperty('business');
    expect(summary.data?.totalTasks).toBe(0);
    expect(summary.data?.avgConfidence).toBeGreaterThan(0);
  });

  it('searches and lists goals from the catalog', async () => {
    const svc = makeService(true);
    const list = await svc.listGoals();
    expect(list.data?.length).toBe(5);
    const search = await svc.searchGoals({ query: 'revenue', categories: ['revenue'] });
    expect(search.success).toBe(true);
    expect(search.data?.items.length).toBeGreaterThan(0);
  });

  it('returns errors for missing goals', async () => {
    const svc = makeService();
    const result = await svc.getGoal('goal_missing');
    expect(result.success).toBe(false);
    const tasks = await svc.generateTasks('goal_missing');
    expect(tasks.success).toBe(false);
  });
});
