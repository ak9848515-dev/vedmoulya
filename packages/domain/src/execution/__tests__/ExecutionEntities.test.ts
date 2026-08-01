import { describe, it, expect } from 'vitest';
import { ExecutionMission } from '../entities/ExecutionMission.js';
import { ExecutionTask } from '../entities/ExecutionTask.js';
import { ExecutionStep } from '../entities/ExecutionStep.js';
import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';
import { ExecutionDependency } from '../value-objects/ExecutionDependency.js';
import { ExecutionSchedule } from '../value-objects/ExecutionSchedule.js';
import { ExecutionContext } from '../value-objects/ExecutionContext.js';
import { ExecutionProgress } from '../value-objects/ExecutionProgress.js';

function createTask(id = 'task_1'): ExecutionTask {
  return new ExecutionTask({
    id,
    label: `Task ${id}`,
    description: 'A task',
    priority: ExecutionPriority.medium(),
  });
}

describe('ExecutionMission', () => {
  it('creates a mission with defaults', () => {
    const m = new ExecutionMission({ id: 'mis_1', label: 'L', description: 'D', planId: 'p1' });
    expect(m.id).toBe('mis_1');
    expect(m.label).toBe('L');
    expect(m.description).toBe('D');
    expect(m.status.isPending).toBe(true);
    expect(m.priority.level).toBe('medium');
    expect(m.tasks).toHaveLength(0);
    expect(m.dependencies).toHaveLength(0);
    expect(m.tags).toHaveLength(0);
    expect(m.planId).toBe('p1');
    expect(m.targetDate).toBeUndefined();
    expect(m.totalTasks).toBe(0);
    expect(m.completedTasks).toBe(0);
  });

  it('creates a mission with full params', () => {
    const target = new Date('2026-12-31');
    const m = new ExecutionMission({
      id: 'mis_2',
      label: 'L',
      description: 'D',
      status: ExecutionStatus.ready(),
      priority: ExecutionPriority.high(),
      progress: new ExecutionProgress(1, 3),
      tasks: [createTask()],
      dependencies: [ExecutionDependency.finishToStart('a', 'b', 'd')],
      tags: ['tag'],
      planId: 'p1',
      targetDate: target,
    });
    expect(m.status.isReady).toBe(true);
    expect(m.priority.level).toBe('high');
    expect(m.progress.completed).toBe(1);
    expect(m.tasks).toHaveLength(1);
    expect(m.dependencies).toHaveLength(1);
    expect(m.tags).toEqual(['tag']);
    expect(m.targetDate).toBe(target);
    expect(m.totalTasks).toBe(1);
  });

  it('starts and completes', () => {
    const m = new ExecutionMission({ id: 'mis_1', label: 'L', description: 'D', planId: 'p1' });
    m.start();
    expect(m.status.isInProgress).toBe(true);
    m.complete(ExecutionResult.success('Done'));
    expect(m.status.isCompleted).toBe(true);
    expect(m.progress.isComplete).toBe(true);
    expect(m.result?.value).toBe('success');
  });

  it('pauses and resumes', () => {
    const m = new ExecutionMission({ id: 'mis_1', label: 'L', description: 'D', planId: 'p1' });
    m.pause('waiting');
    expect(m.status.isPaused).toBe(true);
    m.resume();
    expect(m.status.isInProgress).toBe(true);
    // resume on non-paused is a no-op
    m.resume();
    expect(m.status.isInProgress).toBe(true);
  });

  it('updates priority', () => {
    const m = new ExecutionMission({ id: 'mis_1', label: 'L', description: 'D', planId: 'p1' });
    m.updatePriority(ExecutionPriority.critical());
    expect(m.priority.level).toBe('critical');
  });

  it('manages tasks and recalculates progress', () => {
    const m = new ExecutionMission({ id: 'mis_1', label: 'L', description: 'D', planId: 'p1' });
    const t1 = createTask('t1');
    const t2 = createTask('t2');
    m.addTask(t1);
    m.addTask(t2);
    expect(m.totalTasks).toBe(2);
    expect(m.progress.completed).toBe(0);
    m.completeTask('t1', ExecutionResult.success('Done'));
    expect(m.completedTasks).toBe(1);
    expect(m.progress.percentage).toBe(50);
    m.recalculateProgress();
    expect(m.progress.completed).toBe(1);
  });

  it('throws when completing an unknown task', () => {
    const m = new ExecutionMission({ id: 'mis_1', label: 'L', description: 'D', planId: 'p1' });
    expect(() => m.completeTask('nope', ExecutionResult.success('D'))).toThrow(/Task not found/);
  });

  it('stringifies the mission', () => {
    const m = new ExecutionMission({ id: 'mis_1', label: 'L', description: 'D', planId: 'p1' });
    expect(m.toString()).toContain('L');
  });
});

describe('ExecutionTask', () => {
  it('creates a task with defaults', () => {
    const t = new ExecutionTask({ id: 't1', label: 'T', description: 'D' });
    expect(t.id).toBe('t1');
    expect(t.label).toBe('T');
    expect(t.description).toBe('D');
    expect(t.status.isPending).toBe(true);
    expect(t.priority.level).toBe('medium');
    expect(t.estimatedDuration).toBe(30);
    expect(t.schedule).toBeUndefined();
    expect(t.progress.completed).toBe(0);
    expect(t.steps).toHaveLength(0);
    expect(t.dependencies).toHaveLength(0);
    expect(t.context).toBeUndefined();
    expect(t.tags).toHaveLength(0);
    expect(t.missionId).toBeUndefined();
    expect(t.planId).toBeUndefined();
    expect(t.canStart).toBe(true);
  });

  it('creates a task with full params', () => {
    const schedule = new ExecutionSchedule(
      new Date(),
      new Date(Date.now() + 3_600_000),
      60,
      'morning',
    );
    const t = new ExecutionTask({
      id: 't2',
      label: 'T',
      description: 'D',
      status: ExecutionStatus.ready(),
      priority: ExecutionPriority.high(),
      estimatedDuration: 45,
      schedule,
      progress: new ExecutionProgress(1, 2),
      steps: [new ExecutionStep({ id: 's1', label: 'S', description: 'D' })],
      dependencies: [ExecutionDependency.finishToStart('a', 'b', 'd')],
      context: new ExecutionContext({ energyLevel: 7 }),
      tags: ['urgent'],
      missionId: 'mis_1',
      planId: 'plan_1',
    });
    expect(t.status.isReady).toBe(true);
    expect(t.priority.level).toBe('high');
    expect(t.estimatedDuration).toBe(45);
    expect(t.schedule).toBe(schedule);
    expect(t.progress.percentage).toBe(50);
    expect(t.steps).toHaveLength(1);
    expect(t.hasHardDependencies).toBe(true);
    expect(t.context?.energyLevel).toBe(7);
    expect(t.tags).toEqual(['urgent']);
    expect(t.missionId).toBe('mis_1');
    expect(t.planId).toBe('plan_1');
  });

  it('start() only when startable', () => {
    const t = createTask();
    t.start();
    expect(t.status.isInProgress).toBe(true);
  });

  it('does not start when it has hard dependencies', () => {
    const t = createTask();
    t.addDependency(ExecutionDependency.finishToStart('a', 't1', 'blocked'));
    expect(t.hasHardDependencies).toBe(true);
    expect(t.canStart).toBe(false);
    t.start();
    expect(t.status.isPending).toBe(true);
  });

  it('starts when ready despite dependencies', () => {
    const t = new ExecutionTask({
      id: 't1',
      label: 'T',
      description: 'D',
      status: ExecutionStatus.ready(),
    });
    t.addDependency(ExecutionDependency.finishToStart('a', 't1', 'blocked'));
    expect(t.canStart).toBe(true);
    t.start();
    expect(t.status.isInProgress).toBe(true);
  });

  it('completes and fails', () => {
    const t = createTask();
    t.complete(ExecutionResult.success('Done'));
    expect(t.status.isCompleted).toBe(true);
    expect(t.result?.value).toBe('success');
    expect(t.progress.isComplete).toBe(true);

    const t2 = createTask('t2');
    t2.fail('broke');
    expect(t2.status.isFailed).toBe(true);
    expect(t2.result?.value).toBe('failed');
  });

  it('pauses and resumes', () => {
    const t = createTask();
    t.pause('break');
    expect(t.status.isPaused).toBe(true);
    t.resume();
    expect(t.status.isInProgress).toBe(true);
    // resume on non-paused is a no-op
    t.resume();
    expect(t.status.isInProgress).toBe(true);
  });

  it('marks ready only when pending', () => {
    const t = createTask();
    t.markReady();
    expect(t.status.isReady).toBe(true);
    // second markReady is a no-op
    t.markReady();
    expect(t.status.isReady).toBe(true);
  });

  it('updates priority, schedule, and context', () => {
    const t = createTask();
    t.updatePriority(ExecutionPriority.low());
    expect(t.priority.level).toBe('low');
    const s = new ExecutionSchedule(new Date(), new Date(Date.now() + 3_600_000), 60);
    t.setSchedule(s);
    expect(t.schedule).toBe(s);
    const ctx = new ExecutionContext({ location: 'home' });
    t.updateContext(ctx);
    expect(t.context?.location).toBe('home');
  });

  it('manages steps', () => {
    const t = createTask();
    t.addStep(new ExecutionStep({ id: 's1', label: 'S1', description: 'D' }));
    t.addStep(new ExecutionStep({ id: 's2', label: 'S2', description: 'D' }));
    expect(t.steps).toHaveLength(2);
    t.completeStep('s1', ExecutionResult.success('Done'));
    expect(t.progress.completed).toBe(1);
    expect(t.progress.total).toBe(2);
    expect(() => t.completeStep('nope', ExecutionResult.success('D'))).toThrow(/Step not found/);
  });

  it('stringifies the task', () => {
    const t = createTask();
    expect(t.toString()).toContain('Task task_1');
  });
});

describe('ExecutionStep', () => {
  it('creates a step with defaults', () => {
    const s = new ExecutionStep({ id: 's1', label: 'S', description: 'D' });
    expect(s.id).toBe('s1');
    expect(s.status.isPending).toBe(true);
    expect(s.estimatedDuration).toBe(15);
    expect(s.order).toBe(0);
    expect(s.context).toBeUndefined();
    expect(s.isCompletable).toBe(false);
  });

  it('creates a step with full params', () => {
    const s = new ExecutionStep({
      id: 's1',
      label: 'S',
      description: 'D',
      status: ExecutionStatus.ready(),
      estimatedDuration: 30,
      order: 2,
    });
    expect(s.status.isReady).toBe(true);
    expect(s.estimatedDuration).toBe(30);
    expect(s.order).toBe(2);
    expect(s.isCompletable).toBe(true);
  });

  it('handles lifecycle', () => {
    const s = new ExecutionStep({ id: 's1', label: 'S', description: 'D' });
    s.start();
    expect(s.status.isInProgress).toBe(true);
    s.complete(ExecutionResult.success('Done'));
    expect(s.status.isCompleted).toBe(true);
    expect(s.result?.value).toBe('success');

    const s2 = new ExecutionStep({ id: 's2', label: 'S', description: 'D' });
    s2.fail('broke');
    expect(s2.status.isFailed).toBe(true);

    const s3 = new ExecutionStep({ id: 's3', label: 'S', description: 'D' });
    s3.pause('wait');
    expect(s3.status.isPaused).toBe(true);
    s3.resume();
    expect(s3.status.isInProgress).toBe(true);
  });

  it('marks ready only when pending', () => {
    const s = new ExecutionStep({ id: 's1', label: 'S', description: 'D' });
    s.markReady();
    expect(s.status.isReady).toBe(true);
  });

  it('stringifies the step', () => {
    const s = new ExecutionStep({ id: 's1', label: 'S', description: 'D', order: 3 });
    expect(s.toString()).toBe('[3] S - pending');
  });
});
