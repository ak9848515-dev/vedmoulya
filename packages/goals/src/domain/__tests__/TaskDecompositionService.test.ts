import { describe, expect, it } from 'vitest';
import { TaskDecompositionService } from '../services/TaskDecompositionService.js';
import type { Goal } from '../../types/goal-types.js';

const service = new TaskDecompositionService();

function sampleGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    goalId: 'goal_dec',
    title: 'Grow client revenue',
    description: 'Sell retainers and grow recurring revenue.',
    category: 'revenue',
    business: ['sales'],
    priority: 'high',
    urgency: 0.7,
    importance: 0.8,
    complexity: 'moderate',
    estimatedEffort: 30,
    status: 'accepted',
    confidence: 0.6,
    goalScore: 0,
    successCriteria: [],
    milestones: [],
    dependencies: [],
    childGoalIds: [],
    tags: [],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('TaskDecompositionService', () => {
  it('decomposes a goal into ordered root tasks', () => {
    const { tasks, rootTasks } = service.decompose(sampleGoal());
    expect(tasks.length).toBeGreaterThan(0);
    expect(rootTasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.goalId === 'goal_dec')).toBe(true);
    // Root tasks carry order starting at 1.
    const roots = tasks.filter((t) => !t.parentTaskId);
    expect(roots[0]?.order).toBe(1);
  });

  it('produces nested sub-tasks with parent links', () => {
    const { tasks } = service.decompose(sampleGoal());
    const nested = tasks.filter((t) => t.parentTaskId);
    expect(nested.length).toBeGreaterThan(0);
    for (const t of nested) {
      const parent = tasks.find((p) => p.taskId === t.parentTaskId);
      expect(parent).toBeDefined();
      expect(parent?.subTaskIds).toContain(t.taskId);
    }
  });

  it('assigns validation rules, retry policy, and budgets to every task', () => {
    const { tasks } = service.decompose(sampleGoal());
    for (const t of tasks) {
      expect(t.retryPolicy.maxRetries).toBeGreaterThanOrEqual(1);
      expect(t.estimatedTokens).toBeGreaterThan(0);
      expect(t.estimatedTimeMs).toBeGreaterThan(0);
      expect(t.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    }
    const withRules = tasks.find((t) => t.validationRules.length > 0);
    expect(withRules).toBeDefined();
  });

  it('uses the fallback template for unknown categories', () => {
    const { tasks } = service.decompose(sampleGoal({ category: 'custom' }));
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('marks parallel tasks as parallel-eligible', () => {
    const { tasks } = service.decompose(sampleGoal());
    const parallel = tasks.filter((t) => t.flowType === 'parallel');
    expect(parallel.length).toBeGreaterThan(0);
    expect(parallel.every((t) => t.parallelEligible)).toBe(true);
  });
});
