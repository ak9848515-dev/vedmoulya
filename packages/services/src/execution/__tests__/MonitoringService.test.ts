import { describe, it, expect, vi } from 'vitest';
import { MonitoringService } from '../MonitoringService.js';
import {
  ExecutionPlan,
  ExecutionTask,
  ExecutionPriority,
  ExecutionProgress,
} from '@vedmoulya/domain';

function createMockRepo() {
  return {
    findById: vi.fn(),
    search: vi.fn(),
    count: vi.fn(),
    countActive: vi.fn(),
    countOverdue: vi.fn(),
    countByStatus: vi.fn(),
  };
}

describe('MonitoringService', () => {
  describe('analyzeBottlenecks', () => {
    it('returns empty for healthy plan', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      const svc = new MonitoringService(repo as any);
      const result = await svc.analyzeBottlenecks('p1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('detects blocked tasks', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      task.pause('Waiting');
      repo.findById.mockResolvedValue(plan);
      const svc = new MonitoringService(repo as any);
      const result = await svc.analyzeBottlenecks('p1');
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });

    it('detects paused tasks as bottlenecks', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T1',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      task.pause('Blocked');
      repo.findById.mockResolvedValue(plan);
      const svc = new MonitoringService(repo as any);
      const result = await svc.analyzeBottlenecks('p1');
      expect(result.data!.some((b) => b.entityId === 't1')).toBe(true);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new MonitoringService(repo as any);
      const result = await svc.analyzeBottlenecks('bad');
      expect(result.success).toBe(false);
    });

    it('handles repository error', async () => {
      const repo = createMockRepo();
      repo.findById.mockRejectedValue(new Error('DB error'));
      const svc = new MonitoringService(repo as any);
      const result = await svc.analyzeBottlenecks('p1');
      expect(result.success).toBe(false);
    });
  });

  describe('getStats', () => {
    it('returns monitoring stats', async () => {
      const repo = createMockRepo();
      repo.count.mockResolvedValue(10);
      repo.countActive.mockResolvedValue(4);
      repo.countOverdue.mockResolvedValue(1);
      repo.countByStatus.mockResolvedValue({ completed: 5 });
      const svc = new MonitoringService(repo as any);
      const result = await svc.getStats();
      expect(result.success).toBe(true);
      expect(result.data!.activePlans).toBe(4);
      expect(result.data!.overduePlans).toBe(1);
    });

    it('handles zero stats', async () => {
      const repo = createMockRepo();
      repo.count.mockResolvedValue(0);
      repo.countActive.mockResolvedValue(0);
      repo.countOverdue.mockResolvedValue(0);
      repo.countByStatus.mockResolvedValue({});
      const svc = new MonitoringService(repo as any);
      const result = await svc.getStats();
      expect(result.success).toBe(true);
      expect(result.data!.completionRate).toBe(0);
    });

    it('handles error', async () => {
      const repo = createMockRepo();
      repo.count.mockRejectedValue(new Error('Error'));
      const svc = new MonitoringService(repo as any);
      const result = await svc.getStats();
      expect(result.success).toBe(false);
    });
  });

  describe('getAtRiskPlans', () => {
    it('returns at-risk plans', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'Risk Plan', description: 'D' });
      repo.search.mockResolvedValue({ data: [plan], total: 1, page: 1, limit: 100, totalPages: 1 });
      const svc = new MonitoringService(repo as any);
      const result = await svc.getAtRiskPlans();
      expect(result.success).toBe(true);
    });

    it('handles empty results', async () => {
      const repo = createMockRepo();
      repo.search.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 });
      const svc = new MonitoringService(repo as any);
      const result = await svc.getAtRiskPlans();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('handles error', async () => {
      const repo = createMockRepo();
      repo.search.mockRejectedValue(new Error('Search error'));
      const svc = new MonitoringService(repo as any);
      const result = await svc.getAtRiskPlans();
      expect(result.success).toBe(false);
    });

    it('flags at-risk plan when many tasks remain incomplete', async () => {
      const repo = createMockRepo();
      // isAtRisk requires: percentage < 50 AND total > completed + 3
      // With 0 completed and 6 total: percentage=0%, total(6) > 0+3 → true
      const plan = ExecutionPlan.create({ id: 'p1', title: 'Behind Plan', description: 'D' });
      plan.activate();
      plan.start();
      for (let i = 0; i < 6; i++) {
        plan.addTask(
          new ExecutionTask({
            id: `t${i}`,
            label: `T${i}`,
            description: 'D',
            priority: ExecutionPriority.medium(),
          }),
        );
      }
      // Plan is in_progress with 0/6 completed → isAtRisk should be true
      repo.search.mockResolvedValue({ data: [plan], total: 1, page: 1, limit: 100, totalPages: 1 });
      const svc = new MonitoringService(repo as any);
      const result = await svc.getAtRiskPlans();
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
      expect(result.data![0]!.id).toBe('p1');
    });

    it('does not flag healthy plan as at-risk', async () => {
      const repo = createMockRepo();
      // isAtRisk requires: percentage < 50 AND total > completed + 3
      // With 3 tasks and 0 completed: total(3) > 0+3 → false → isAtRisk = false
      const plan = ExecutionPlan.create({ id: 'p2', title: 'Healthy Plan', description: 'D' });
      plan.activate();
      plan.start();
      for (let i = 0; i < 3; i++) {
        plan.addTask(
          new ExecutionTask({
            id: `t${i}`,
            label: `T${i}`,
            description: 'D',
            priority: ExecutionPriority.medium(),
          }),
        );
      }
      repo.search.mockResolvedValue({ data: [plan], total: 1, page: 1, limit: 100, totalPages: 1 });
      const svc = new MonitoringService(repo as any);
      const result = await svc.getAtRiskPlans();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0); // No at-risk plans
    });

    it('handles repository error in getAtRiskPlans', async () => {
      const repo = createMockRepo();
      repo.search.mockRejectedValue(new Error('DB timeout'));
      const svc = new MonitoringService(repo as any);
      const result = await svc.getAtRiskPlans();
      expect(result.success).toBe(false);
    });
  });
});
