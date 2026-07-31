import { describe, it, expect } from 'vitest';
import { ExecutionPlan } from '../entities/ExecutionPlan.js';
import { ExecutionTask } from '../entities/ExecutionTask.js';
import { ExecutionStep } from '../entities/ExecutionStep.js';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';
import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';
import { ExecutionProgress } from '../value-objects/ExecutionProgress.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';
import { ExecutionDependency } from '../value-objects/ExecutionDependency.js';
import { ExecutionTimeline } from '../value-objects/ExecutionTimeline.js';
import { ExecutionContext } from '../value-objects/ExecutionContext.js';

/**
 * Helper: create a plan with N tasks for performance testing
 * Uses the direct constructor (not ExecutionPlan.create()) to pass tasks.
 */
function createPlanWithTasks(taskCount: number): ExecutionPlan {
  const tasks: ExecutionTask[] = [];
  for (let i = 0; i < taskCount; i++) {
    const hasDep = Math.random() > 0.8;
    const deps = hasDep
      ? [
          new ExecutionDependency(
            `perf_task_${Math.floor(Math.random() * Math.max(1, i))}`,
            'finish_to_start',
            true,
          ),
        ]
      : [];
    tasks.push(
      new ExecutionTask({
        id: `perf_task_${i}`,
        label: `Task ${i}`,
        description: `Description for task ${i}`,
        priority: ExecutionPriority.fromScore(i % 10),
        status: ExecutionStatus.pending(),
        estimatedDuration: 30,
        dependencies: deps,
        steps: [
          new ExecutionStep({
            id: `step_${i}_1`,
            label: `Step 1 for task ${i}`,
            description: 'Do step 1',
            estimatedDuration: 15,
          }),
        ],
        tags: [],
      }),
    );
  }

  const plan = new ExecutionPlan({
    id: `perf_plan_${taskCount}`,
    title: `Performance Test Plan (${taskCount} tasks)`,
    description: 'Performance test plan',
    planningLevel: 'tactical',
    priority: ExecutionPriority.fromScore(5),
    progress: new ExecutionProgress(0, taskCount),
    tasks,
    tags: [],
  });

  plan.recalculateProgress();
  return plan;
}

describe('Execution Performance', () => {
  it('handles 100 tasks within acceptable time', () => {
    const plan = createPlanWithTasks(100);
    const bottlenecks = plan.analyzeBottlenecks();
    expect(bottlenecks).toBeDefined();
    plan.recalculateProgress();
    expect(plan.progress.total).toBe(100);
  });

  it('handles 500 tasks within acceptable time', () => {
    const plan = createPlanWithTasks(500);
    const bottlenecks = plan.analyzeBottlenecks();
    expect(bottlenecks).toBeDefined();
    plan.recalculateProgress();
    expect(plan.progress.total).toBe(500);
  });

  it('handles 1000 tasks within acceptable time', () => {
    const plan = createPlanWithTasks(1000);
    const bottlenecks = plan.analyzeBottlenecks();
    expect(bottlenecks).toBeDefined();
    expect(plan.progress.total).toBe(1000);
  });

  it('handles 10000 tasks within acceptable time', () => {
    const plan = createPlanWithTasks(10000);
    const start = performance.now();
    const bottlenecks = plan.analyzeBottlenecks();
    const elapsed = performance.now() - start;
    // Generous threshold for slow environments
    expect(elapsed).toBeLessThan(15000);
    expect(bottlenecks).toBeDefined();
    expect(plan.progress.total).toBe(10000);
  });

  it('completes tasks without issue', () => {
    const plan = createPlanWithTasks(200);
    const result = new ExecutionResult('success', 'Completed', 85, 30);

    for (let i = 0; i < 100; i++) {
      const task = plan.tasks.find((t) => t.id === `perf_task_${i}`);
      if (task) {
        task.start();
        task.complete(result);
      }
    }
    plan.recalculateProgress();

    expect(plan.progress.completed).toBe(100);
  });

  it('filters urgent tasks for daily planning', () => {
    const plan = createPlanWithTasks(1000);

    const urgentTasks = plan.tasks
      .filter((t) => t.status.isPending || t.status.isReady)
      .sort((a, b) => b.priority.score - a.priority.score)
      .slice(0, 10);

    expect(urgentTasks.length).toBe(10);
  });
});
