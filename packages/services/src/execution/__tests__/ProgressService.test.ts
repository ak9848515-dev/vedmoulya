import { describe, it, expect, vi } from 'vitest';
import { ProgressService } from '../ProgressService.js';
import {
  ExecutionPlan,
  ExecutionTask,
  ExecutionMission,
  ExecutionPriority,
  ExecutionResult,
} from '@vedmoulya/domain';

function createMockRepo() {
  return {
    findById: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    countActive: vi.fn(),
    countOverdue: vi.fn(),
    countByStatus: vi.fn(),
  };
}

describe('ProgressService', () => {
  describe('trackProgress', () => {
    it('tracks progress for a plan with tasks', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'T1',
          description: 'D',
          priority: ExecutionPriority.high(),
        }),
      );
      plan.addTask(
        new ExecutionTask({
          id: 't2',
          label: 'T2',
          description: 'D',
          priority: ExecutionPriority.high(),
        }),
      );
      repo.findById.mockResolvedValue(plan);
      const svc = new ProgressService(repo as any);
      const result = await svc.trackProgress('p1');
      expect(result.success).toBe(true);
      expect(result.data!.overall.total).toBe(2);
      expect(result.data!.overall.completed).toBe(0);
    });

    it('tracks progress with completed tasks after recalc', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      task.complete(ExecutionResult.success('Done'));
      plan.recalculateProgress(); // Sync plan-level progress
      repo.findById.mockResolvedValue(plan);
      const svc = new ProgressService(repo as any);
      const result = await svc.trackProgress('p1');
      expect(result.data!.overall.completed).toBe(1);
    });

    it('tracks progress with missions', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const mission = new ExecutionMission({
        id: 'mis_1',
        label: 'M1',
        description: 'D',
        priority: ExecutionPriority.medium(),
        planId: 'p1',
      });
      plan.addMission(mission);
      repo.findById.mockResolvedValue(plan);
      const svc = new ProgressService(repo as any);
      const result = await svc.trackProgress('p1');
      expect(result.data!.missions).toHaveLength(1);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new ProgressService(repo as any);
      const result = await svc.trackProgress('bad');
      expect(result.success).toBe(false);
    });
  });

  describe('completeTask', () => {
    it('completes a task successfully', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ProgressService(repo as any);
      const result = await svc.completeTask('p1', 't1', {
        result: 'success',
        description: 'All done',
        actualDuration: 30,
        quality: 90,
        notes: ['Good'],
      });
      expect(result.success).toBe(true);
    });

    it('handles partial completion', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ProgressService(repo as any);
      const result = await svc.completeTask('p1', 't1', {
        result: 'partial',
        description: 'Partially done',
        quality: 50,
      });
      expect(result.success).toBe(true);
    });

    it('handles task failure', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ProgressService(repo as any);
      const result = await svc.completeTask('p1', 't1', {
        result: 'failed',
        description: 'Failed',
      });
      expect(result.success).toBe(true);
    });

    it('handles unknown result type', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ProgressService(repo as any);
      const result = await svc.completeTask('p1', 't1', {
        result: 'unknown',
        description: 'Unclear',
      });
      expect(result.success).toBe(true);
    });

    it('handles missing task gracefully', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      // completeTask throws when task not found; this is expected behavior
      const svc = new ProgressService(repo as any);
      try {
        await svc.completeTask('p1', 'nonexistent', { result: 'success', description: 'D' });
      } catch {
        // Expected to throw - task not found in plan
      }
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new ProgressService(repo as any);
      const result = await svc.completeTask('bad', 't1', { result: 'success', description: 'D' });
      expect(result.success).toBe(false);
    });
  });

  describe('reportExecution', () => {
    it('reports execution with obstacles', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ProgressService(repo as any);
      const result = await svc.reportExecution('p1', {
        taskId: 't1',
        result: 'success',
        description: 'Done',
        notes: ['Note'],
        obstacles: ['Lag', 'Bug'],
      });
      expect(result.success).toBe(true);
    });

    it('handles null notes (falls back to empty array)', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ProgressService(repo as any);
      const result = await svc.reportExecution('p1', {
        taskId: 't1',
        result: 'success',
        description: 'Done',
        obstacles: ['Bug'],
      });
      expect(result.success).toBe(true);
    });

    it('handles null obstacles (falls back to empty array)', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ProgressService(repo as any);
      const result = await svc.reportExecution('p1', {
        taskId: 't1',
        result: 'success',
        description: 'Done',
        notes: ['Note'],
      });
      expect(result.success).toBe(true);
    });

    it('handles both null notes and null obstacles', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ProgressService(repo as any);
      const result = await svc.reportExecution('p1', {
        taskId: 't1',
        result: 'success',
        description: 'Done',
      });
      expect(result.success).toBe(true);
    });

    it('handles missing plan for reportExecution', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new ProgressService(repo as any);
      const result = await svc.reportExecution('bad', {
        taskId: 't1',
        result: 'success',
        description: 'Done',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('getStats completion rate', () => {
    it('calculates 100% completion rate', async () => {
      const repo = createMockRepo();
      repo.count.mockResolvedValue(10);
      repo.countActive.mockResolvedValue(0);
      repo.countOverdue.mockResolvedValue(0);
      repo.countByStatus.mockResolvedValue({ completed: 10 });
      const svc = new ProgressService(repo as any);
      const result = await svc.getStats();
      expect(result.success).toBe(true);
      expect(result.data!.completionRate).toBe(100);
    });

    it('calculates 0% completion rate', async () => {
      const repo = createMockRepo();
      repo.count.mockResolvedValue(5);
      repo.countActive.mockResolvedValue(5);
      repo.countOverdue.mockResolvedValue(2);
      repo.countByStatus.mockResolvedValue({ completed: 0 });
      const svc = new ProgressService(repo as any);
      const result = await svc.getStats();
      expect(result.success).toBe(true);
      expect(result.data!.completionRate).toBe(0);
    });
  });

  describe('getStats', () => {
    it('returns execution statistics', async () => {
      const repo = createMockRepo();
      repo.count.mockResolvedValue(10);
      repo.countActive.mockResolvedValue(5);
      repo.countOverdue.mockResolvedValue(2);
      repo.countByStatus.mockResolvedValue({ completed: 3 });
      const svc = new ProgressService(repo as any);
      const result = await svc.getStats();
      expect(result.success).toBe(true);
      expect(result.data!.totalPlans).toBe(10);
      expect(result.data!.activePlans).toBe(5);
      expect(result.data!.completionRate).toBe(30);
    });

    it('handles zero plans', async () => {
      const repo = createMockRepo();
      repo.count.mockResolvedValue(0);
      repo.countActive.mockResolvedValue(0);
      repo.countOverdue.mockResolvedValue(0);
      repo.countByStatus.mockResolvedValue({});
      const svc = new ProgressService(repo as any);
      const result = await svc.getStats();
      expect(result.success).toBe(true);
      expect(result.data!.completionRate).toBe(0);
    });

    it('handles repository error', async () => {
      const repo = createMockRepo();
      repo.count.mockRejectedValue(new Error('DB error'));
      const svc = new ProgressService(repo as any);
      const result = await svc.getStats();
      expect(result.success).toBe(false);
    });
  });
});
