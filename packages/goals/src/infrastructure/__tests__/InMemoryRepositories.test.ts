import { describe, expect, it } from 'vitest';
import { InMemoryGoalRepository } from '../InMemoryGoalRepository.js';
import { InMemoryTaskRepository } from '../InMemoryTaskRepository.js';
import { createCatalogGoals } from '../../catalog/goal-catalog.js';
import { createGoalId } from '../../domain/value-objects/Identifiers.js';
import type { Goal, Task } from '../../types/goal-types.js';

function minimalGoal(id: string): Goal {
  return {
    goalId: id,
    title: `Goal ${id}`,
    description: 'A sample goal with enough description text to be valid.',
    category: 'business',
    business: ['sales'],
    priority: 'medium',
    urgency: 0.5,
    importance: 0.5,
    complexity: 'moderate',
    estimatedEffort: 8,
    status: 'proposed',
    confidence: 0.5,
    goalScore: 0.4,
    successCriteria: [],
    milestones: [],
    dependencies: [],
    childGoalIds: [],
    tags: ['test'],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function minimalTask(id: string, goalId: string): Task {
  return {
    taskId: id,
    goalId,
    title: `Task ${id}`,
    capability: 'reasoning',
    priority: 50,
    businessValue: 0.5,
    urgency: 0.5,
    importance: 0.5,
    risk: 0.2,
    confidence: 0.8,
    estimatedTokens: 100,
    estimatedCostUsd: 0.01,
    estimatedTimeMs: 1000,
    dependencies: [],
    parallelEligible: false,
    flowType: 'sequential',
    retryPolicy: { maxRetries: 2, retryDelayMs: 1000, retryableFailures: [] },
    validationRules: [],
    status: 'proposed',
    subTaskIds: [],
    order: 1,
    critical: false,
    slack: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('InMemoryGoalRepository', () => {
  it('saves, finds, and clones goals', async () => {
    const repo = new InMemoryGoalRepository();
    const goal = minimalGoal('goal_1');
    await repo.save(goal);
    const found = await repo.findById(createGoalId('goal_1'));
    expect(found?.title).toBe('Goal goal_1');
    // Mutation of the returned clone does not affect the store.
    if (found) found.title = 'Mutated';
    const again = await repo.findById(createGoalId('goal_1'));
    expect(again?.title).toBe('Goal goal_1');
  });

  it('seeds from the catalog', async () => {
    const repo = new InMemoryGoalRepository(createCatalogGoals());
    const all = await repo.listAll();
    expect(all.length).toBe(5);
    const revenue = await repo.findByCategory('revenue');
    expect(revenue.length).toBeGreaterThan(0);
  });

  it('filters by status and searches by query', async () => {
    const repo = new InMemoryGoalRepository();
    await repo.save({ ...minimalGoal('goal_a'), status: 'active', tags: ['alpha'] });
    await repo.save({ ...minimalGoal('goal_b'), status: 'proposed', tags: ['beta'] });
    const active = await repo.search({ statuses: ['active'] });
    expect(active.total).toBe(1);
    const query = await repo.search({ query: 'beta' });
    expect(query.total).toBe(1);
  });

  it('handles parent/child lookups and deletion', async () => {
    const repo = new InMemoryGoalRepository();
    await repo.save({ ...minimalGoal('goal_p') });
    await repo.save({ ...minimalGoal('goal_c'), parentGoalId: 'goal_p' });
    const children = await repo.findChildren('goal_p');
    expect(children.length).toBe(1);
    expect(await repo.delete(createGoalId('goal_p'))).toBe(true);
    expect(await repo.exists(createGoalId('goal_p'))).toBe(false);
  });
});

describe('InMemoryTaskRepository', () => {
  it('saves many tasks and lists by goal', async () => {
    const repo = new InMemoryTaskRepository();
    await repo.saveMany([
      minimalTask('task_1', 'goal_1'),
      minimalTask('task_2', 'goal_1'),
      minimalTask('task_3', 'goal_2'),
    ]);
    const byGoal = await repo.findByGoal('goal_1');
    expect(byGoal.length).toBe(2);
    const found = await repo.findById(createGoalId('task_1') as never);
    expect(found?.title).toBe('Task task_1');
  });
});
