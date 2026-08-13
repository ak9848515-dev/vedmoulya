import { describe, expect, it } from 'vitest';
import { TaskDependencyGraphService } from '../services/TaskDependencyGraphService.js';
import type { Milestone, Task } from '../../types/goal-types.js';

const service = new TaskDependencyGraphService();

function task(id: string, deps: string[], timeMs = 1000, parallel = false): Task {
  return {
    taskId: id,
    goalId: 'goal_g',
    title: `Task ${id}`,
    capability: 'reasoning',
    priority: 50,
    businessValue: 0.5,
    urgency: 0.5,
    importance: 0.5,
    risk: 0.2,
    confidence: 0.8,
    estimatedTokens: 500,
    estimatedCostUsd: 0.05,
    estimatedTimeMs: timeMs,
    dependencies: deps,
    parallelEligible: parallel,
    flowType: parallel ? 'parallel' : 'sequential',
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

describe('TaskDependencyGraphService', () => {
  it('builds a DAG and marks acyclic validation', () => {
    const tasks = [task('a', []), task('b', ['a']), task('c', ['b'])];
    const graph = service.build('goal_g', tasks, []);
    expect(graph.validated).toBe(true);
    expect(graph.criticalPath).toContain('a');
    expect(graph.criticalPath).toContain('c');
  });

  it('computes the weighted critical path (longest duration chain)', () => {
    const tasks = [task('a', [], 100), task('b', ['a'], 900), task('c', ['a'], 500)];
    const graph = service.build('goal_g', tasks, []);
    // a → b (100 + 900) beats a → c (100 + 500).
    expect(graph.criticalPath).toEqual(['a', 'b']);
    expect(graph.totalEstimatedTimeMs).toBe(1000);
  });

  it('detects cycles', () => {
    const tasks = [task('a', ['b']), task('b', ['a'])];
    const graph = service.build('goal_g', tasks, []);
    expect(graph.validated).toBe(false);
    expect(
      service.findCycle(tasks, new Map(tasks.map((t) => [t.taskId, t]))).length,
    ).toBeGreaterThan(0);
  });

  it('flags unresolved dependencies as invalid', () => {
    const tasks = [task('a', ['missing'])];
    const graph = service.build('goal_g', tasks, []);
    expect(graph.validated).toBe(false);
  });

  it('builds parallel groups from parallel-eligible runs', () => {
    const tasks = [
      task('a', []),
      task('b', ['a'], 1000, true),
      task('c', ['a'], 1000, true),
      task('d', ['b', 'c']),
    ];
    const graph = service.build('goal_g', tasks, []);
    expect(graph.parallelGroups.length).toBeGreaterThan(0);
    expect(graph.parallelGroups.flat()).toEqual(expect.arrayContaining(['b', 'c']));
  });

  it('marks milestone achievement from completed member tasks', () => {
    const tasks = [
      { ...task('a', []), status: 'completed' as const },
      { ...task('b', ['a']), status: 'proposed' as const },
    ];
    const milestones: Milestone[] = [
      {
        milestoneId: 'm1',
        title: 'Done A',
        description: '',
        taskIds: ['a'],
        order: 1,
        achieved: false,
      },
      {
        milestoneId: 'm2',
        title: 'Done B',
        description: '',
        taskIds: ['b'],
        order: 2,
        achieved: false,
      },
    ];
    const graph = service.build('goal_g', tasks, milestones);
    expect(graph.milestones.find((m) => m.milestoneId === 'm1')?.achieved).toBe(true);
    expect(graph.milestones.find((m) => m.milestoneId === 'm2')?.achieved).toBe(false);
  });

  it('produces a topological order', () => {
    const tasks = [task('a', []), task('b', ['a']), task('c', []), task('d', ['b', 'c'])];
    const ordered = service.topologicalOrder(tasks);
    expect(ordered.map((t) => t.taskId)).toContain('a');
    const idx = (id: string): number => ordered.findIndex((t) => t.taskId === id);
    expect(idx('a')).toBeLessThan(idx('b'));
    expect(idx('b')).toBeLessThan(idx('d'));
    expect(idx('c')).toBeLessThan(idx('d'));
  });
});
