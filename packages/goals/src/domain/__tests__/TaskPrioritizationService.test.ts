import { describe, expect, it } from 'vitest';
import { TaskPrioritizationService } from '../services/TaskPrioritizationService.js';
import type { Task } from '../../types/goal-types.js';

const service = new TaskPrioritizationService();

function sampleTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: `task_${Math.random().toString(36).slice(2, 8)}`,
    goalId: 'goal_p',
    title: 'Sample task',
    capability: 'reasoning',
    priority: 0,
    businessValue: 0.5,
    urgency: 0.5,
    importance: 0.5,
    risk: 0.2,
    confidence: 0.8,
    estimatedTokens: 1000,
    estimatedCostUsd: 0.1,
    estimatedTimeMs: 10000,
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
    ...overrides,
  };
}

describe('TaskPrioritizationService', () => {
  it('scores a high-value, high-confidence task above a low-value one', () => {
    const high = sampleTask({ businessValue: 1, urgency: 1, importance: 1, confidence: 0.95 });
    const low = sampleTask({ businessValue: 0, urgency: 0, importance: 0, confidence: 0.5 });
    expect(service.score(high, 0)).toBeGreaterThan(service.score(low, 0));
  });

  it('increases score with dependency load', () => {
    const base = sampleTask({ confidence: 0.9, businessValue: 0.5 });
    expect(service.score(base, 4)).toBeGreaterThan(service.score(base, 0));
  });

  it('returns scores bounded to 0–100', () => {
    const task = sampleTask({ businessValue: 1, urgency: 1, importance: 1, confidence: 1 });
    const score = service.score(task, 4);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('prioritizes a whole list without mutating identity', () => {
    const tasks = [sampleTask(), sampleTask({ taskId: 'task_fixed' })];
    const prioritized = service.prioritize(tasks);
    expect(prioritized.map((t) => t.taskId).sort()).toEqual(tasks.map((t) => t.taskId).sort());
    expect(prioritized.every((t) => t.priority > 0)).toBe(true);
  });
});
