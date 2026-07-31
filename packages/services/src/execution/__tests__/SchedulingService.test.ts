import { describe, it, expect, vi } from 'vitest';
import { SchedulingService } from '../SchedulingService.js';
import {
  ExecutionPlan,
  ExecutionTask,
  ExecutionPriority,
  ExecutionDependency,
  ExecutionSchedule,
} from '@vedmoulya/domain';

function createMockRepo() {
  return { findById: vi.fn(), update: vi.fn() };
}

describe('SchedulingService', () => {
  describe('scheduleTask', () => {
    it('schedules a task in a plan', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'Plan', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new SchedulingService(repo as any);
      const start = new Date('2026-08-01T09:00:00Z');
      const end = new Date('2026-08-01T10:00:00Z');
      const result = await svc.scheduleTask('p1', 't1', start, end, 60);
      expect(result.success).toBe(true);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new SchedulingService(repo as any);
      const result = await svc.scheduleTask('bad', 't1', new Date(), new Date(), 30);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('handles overlapping schedule times', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new SchedulingService(repo as any);
      // Schedule two tasks at the same time
      await svc.scheduleTask(
        'p1',
        't1',
        new Date('2026-08-01T09:00'),
        new Date('2026-08-01T10:00'),
        60,
      );
      const result = await svc.scheduleTask(
        'p1',
        't2',
        new Date('2026-08-01T09:30'),
        new Date('2026-08-01T10:30'),
        60,
      );
      expect(result.success).toBe(true); // Scheduling records metadata; overlap detection is future work
    });
  });

  describe('getDependencyGraph', () => {
    it('returns dependency graph', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'Setup',
          description: 'Prep',
          priority: ExecutionPriority.high(),
        }),
      );
      plan.addTask(
        new ExecutionTask({
          id: 't2',
          label: 'Build',
          description: 'Do',
          priority: ExecutionPriority.high(),
        }),
      );
      repo.findById.mockResolvedValue(plan);
      const svc = new SchedulingService(repo as any);
      const result = await svc.getDependencyGraph('p1');
      expect(result.success).toBe(true);
      expect(result.data!.tasks).toHaveLength(2);
    });

    it('handles empty plan', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      const svc = new SchedulingService(repo as any);
      const result = await svc.getDependencyGraph('p1');
      expect(result.success).toBe(true);
      expect(result.data!.tasks).toHaveLength(0);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new SchedulingService(repo as any);
      const result = await svc.getDependencyGraph('bad');
      expect(result.success).toBe(false);
    });
  });

  describe('resolveDependencies', () => {
    it('resolves dependencies and returns blocked tasks', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task1 = new ExecutionTask({
        id: 't1',
        label: 'First',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      const task2 = new ExecutionTask({
        id: 't2',
        label: 'Second',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      task2.addDependency(ExecutionDependency.finishToStart('t2', 't1', 't2 depends on t1'));
      plan.addTask(task1);
      plan.addTask(task2);
      repo.findById.mockResolvedValue(plan);
      const svc = new SchedulingService(repo as any);
      const result = await svc.resolveDependencies('p1');
      expect(result.success).toBe(true);
    });

    it('returns tasks with no dependencies as unblocked', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'Solo',
          description: 'D',
          priority: ExecutionPriority.medium(),
        }),
      );
      repo.findById.mockResolvedValue(plan);
      const svc = new SchedulingService(repo as any);
      const result = await svc.resolveDependencies('p1');
      expect(result.success).toBe(true);
      expect(result.data!.tasks[0]!.dependencies).toHaveLength(0);
    });
  });

  describe('getTodaySchedule', () => {
    it('returns tasks scheduled for today', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      // Tasks without schedules won't match today
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'Task 1',
          description: 'D',
          priority: ExecutionPriority.medium(),
        }),
      );
      repo.findById.mockResolvedValue(plan);
      const svc = new SchedulingService(repo as any);
      const result = await svc.getTodaySchedule('p1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0); // No scheduled tasks
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new SchedulingService(repo as any);
      const result = await svc.getTodaySchedule('bad');
      expect(result.success).toBe(false);
    });

    it('filters by schedule date matching today', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const today = new Date();
      const schedule = new ExecutionSchedule(today, new Date(today.getTime() + 3600000), 60);
      const task = new ExecutionTask({
        id: 't1',
        label: 'Today Task',
        description: 'D',
        priority: ExecutionPriority.high(),
        schedule,
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      const svc = new SchedulingService(repo as any);
      const result = await svc.getTodaySchedule('p1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0]!.taskId).toBe('t1');
    });

    it('filters out tasks with non-matching dates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const tomorrow = new Date(Date.now() + 86400000);
      const schedule = new ExecutionSchedule(tomorrow, new Date(tomorrow.getTime() + 3600000), 60);
      const task = new ExecutionTask({
        id: 't1',
        label: 'Tomorrow Task',
        description: 'D',
        priority: ExecutionPriority.medium(),
        schedule,
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      const svc = new SchedulingService(repo as any);
      const result = await svc.getTodaySchedule('p1');
      expect(result.data).toHaveLength(0);
    });
  });
});
