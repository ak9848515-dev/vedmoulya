import { describe, it, expect } from 'vitest';
import { ExecutionPlan } from '../entities/ExecutionPlan.js';
import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';
import { ExecutionProgress } from '../value-objects/ExecutionProgress.js';
import { ExecutionMission } from '../entities/ExecutionMission.js';
import { ExecutionTask } from '../entities/ExecutionTask.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';
import { ExecutionDependency } from '../value-objects/ExecutionDependency.js';

function createTestPlan(): ExecutionPlan {
  return new ExecutionPlan({ id: 'plan_test', title: 'Test Plan', description: 'A test plan' });
}

describe('ExecutionPlan', () => {
  it('creates a plan with defaults', () => {
    const plan = new ExecutionPlan({ id: 'plan_1', title: 'My Plan', description: 'Description' });
    expect(plan.id).toBe('plan_1');
    expect(plan.title).toBe('My Plan');
    expect(plan.status.isPending).toBe(true);
    expect(plan.priority.level).toBe('medium');
    expect(plan.progress.completed).toBe(0);
    expect(plan.missions).toHaveLength(0);
    expect(plan.tasks).toHaveLength(0);
  });

  it('activates the plan', () => {
    const plan = createTestPlan();
    plan.activate();
    expect(plan.status.isReady).toBe(true);
  });

  it('starts the plan', () => {
    const plan = createTestPlan();
    plan.activate();
    plan.start();
    expect(plan.status.isInProgress).toBe(true);
  });

  it('pauses and resumes the plan', () => {
    const plan = createTestPlan();
    plan.activate();
    plan.start();
    plan.pause('Need a break');
    expect(plan.status.isPaused).toBe(true);
    plan.resume();
    expect(plan.status.isInProgress).toBe(true);
  });

  it('completes the plan with a result', () => {
    const plan = createTestPlan();
    plan.activate();
    plan.start();
    plan.complete(ExecutionResult.success('All done'));
    expect(plan.status.isCompleted).toBe(true);
    expect(plan.completedAt).toBeDefined();
    expect(plan.result?.value).toBe('success');
  });

  it('cancels the plan', () => {
    const plan = createTestPlan();
    plan.cancel('Changed my mind');
    expect(plan.status.isCancelled).toBe(true);
  });

  it('fails the plan', () => {
    const plan = createTestPlan();
    plan.activate();
    plan.start();
    plan.fail('Something went wrong');
    expect(plan.status.isFailed).toBe(true);
  });

  it('manages missions', () => {
    const plan = createTestPlan();
    const mission = new ExecutionMission({
      id: 'mis_1',
      label: 'Mission 1',
      description: 'Do it',
      priority: ExecutionPriority.medium(),
      planId: plan.id,
    });
    plan.addMission(mission);
    expect(plan.missions).toHaveLength(1);
    expect(plan.totalMissions).toBe(1);
  });

  it('manages tasks', () => {
    const plan = createTestPlan();
    const task = new ExecutionTask({
      id: 'task_1',
      label: 'Task 1',
      description: 'Do it',
      priority: ExecutionPriority.medium(),
    });
    plan.addTask(task);
    expect(plan.tasks).toHaveLength(1);
    expect(plan.totalTasks).toBe(1);
  });

  it('emits events on lifecycle transitions', () => {
    const plan = ExecutionPlan.create({
      id: 'test_events',
      title: 'Event Test',
      description: 'Testing events',
    });
    const createdEvents = plan.pullEvents();
    expect(createdEvents.length).toBeGreaterThan(0);
    plan.activate();
    const events = plan.pullEvents();
    expect(events.some((e) => e.type === 'plan.activated')).toBe(true);
  });

  it('adds dependencies', () => {
    const plan = createTestPlan();
    const dep = ExecutionDependency.finishToStart('task_1', 'task_2', 'Task 1 blocks Task 2');
    plan.addDependency(dep);
    expect(plan.dependencies).toHaveLength(1);
  });

  it('resolves dependencies', () => {
    const plan = createTestPlan();
    const task1 = new ExecutionTask({
      id: 'task_1',
      label: 'Task 1',
      description: 'First',
      priority: ExecutionPriority.medium(),
    });
    const task2 = new ExecutionTask({
      id: 'task_2',
      label: 'Task 2',
      description: 'Second',
      priority: ExecutionPriority.medium(),
    });
    task2.addDependency(
      ExecutionDependency.finishToStart('task_2', 'task_1', 'Task 2 depends on Task 1'),
    );
    plan.addTask(task1);
    plan.addTask(task2);
    const blocked = plan.resolveDependencies();
    expect(blocked.length).toBeGreaterThan(0);
  });

  it('generates events after creation', () => {
    const plan = ExecutionPlan.create({
      id: 'plan_create',
      title: 'Created Plan',
      description: 'Via static create',
    });
    const events = plan.pullEvents();
    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('plan.created');
  });

  it('returns a string representation', () => {
    const plan = createTestPlan();
    expect(plan.toString()).toContain('Test Plan');
  });
});
