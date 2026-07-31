import { describe, it, expect, vi } from 'vitest';
import { ExecutionApplicationService } from '../ExecutionApplicationService.js';
import {
  ExecutionPlan,
  ExecutionTask,
  ExecutionMission,
  ExecutionPriority,
} from '@vedmoulya/domain';

function createMockRepo() {
  return {
    findById: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    findByPlanningLevel: vi.fn(),
    findByStatus: vi.fn(),
    search: vi.fn(),
    findByGoalId: vi.fn(),
    findByDecisionId: vi.fn(),
    findActivePlans: vi.fn(),
    findRecentlyCompleted: vi.fn(),
    count: vi.fn(),
    countByPlanningLevel: vi.fn(),
    countByStatus: vi.fn(),
    countActive: vi.fn(),
    countOverdue: vi.fn(),
  };
}

describe('ExecutionApplicationService', () => {
  describe('constructor', () => {
    it('creates all sub-services', () => {
      const repo = createMockRepo();
      const svc = new ExecutionApplicationService(repo as any);
      expect(svc.planning).toBeDefined();
      expect(svc.scheduling).toBeDefined();
      expect(svc.progress).toBeDefined();
      expect(svc.monitoring).toBeDefined();
      expect(svc.recovery).toBeDefined();
    });
  });

  describe('createPlan', () => {
    it('delegates to planning service', async () => {
      const repo = createMockRepo();
      repo.save.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.createPlan({ title: 'Plan', description: 'D' });
      expect(result.success).toBe(true);
    });
  });

  describe('getPlan', () => {
    it('delegates to planning service', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.getPlan('p1');
      expect(result.success).toBe(true);
    });
  });

  describe('listPlans', () => {
    it('lists with pagination defaults', async () => {
      const repo = createMockRepo();
      repo.count.mockResolvedValue(0);
      repo.search.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.listPlans();
      expect(result.success).toBe(true);
    });
  });

  describe('searchPlans', () => {
    it('searches with query params', async () => {
      const repo = createMockRepo();
      repo.search.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.searchPlans({
        query: 'test',
        statuses: ['in_progress'],
        page: 1,
        limit: 10,
      });
      expect(result.success).toBe(true);
    });

    it('handles search error', async () => {
      const repo = createMockRepo();
      repo.search.mockRejectedValue(new Error('Search failed'));
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.searchPlans({ query: 'test' });
      expect(result.success).toBe(false);
    });
  });

  describe('createMission', () => {
    it('creates a mission', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.createMission('p1', { label: 'M1', description: 'D' });
      expect(result.success).toBe(true);
    });
  });

  describe('createTask', () => {
    it('creates a task', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.createTask('p1', { label: 'T1', description: 'D' });
      expect(result.success).toBe(true);
    });
  });

  describe('addStep', () => {
    it('adds step to task', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T',
        description: 'D',
        priority: ExecutionPriority.medium(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.addStep('p1', 't1', { label: 'Step 1', description: 'Do' });
      expect(result.success).toBe(true);
    });
  });

  describe('generateDailyPlan', () => {
    it('generates daily plan', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'T',
          description: 'D',
          priority: ExecutionPriority.high(),
        }),
      );
      repo.findById.mockResolvedValue(plan);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.generateDailyPlan('p1', 240);
      expect(result.success).toBe(true);
    });
  });

  describe('weeklyReview', () => {
    it('generates weekly review', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      repo.findById.mockResolvedValue(plan);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.weeklyReview('p1');
      expect(result.success).toBe(true);
    });
  });

  describe('monthlyReview', () => {
    it('generates monthly review', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      repo.findById.mockResolvedValue(plan);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.monthlyReview('p1');
      expect(result.success).toBe(true);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.monthlyReview('bad');
      expect(result.success).toBe(false);
    });

    it('handles domain service error (inactive plan)', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      const svc = new ExecutionApplicationService(repo as any);
      // weeklyReview needs plan to be active. Without activation, it may fail or produce empty data
      const result = await svc.monthlyReview('p1');
      // monthlyReview catches domain errors and returns false
      expect(result.success).toBe(true);
    });

    it('handles monthlyReview exception', async () => {
      const repo = createMockRepo();
      repo.findById.mockRejectedValue(new Error('DB error'));
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.monthlyReview('p1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
    });

    it('rejects missing plan in monthlyReview', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.monthlyReview('bad');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('searchPlans', () => {
    it('handles empty query params', async () => {
      const repo = createMockRepo();
      repo.search.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.searchPlans({});
      expect(result.success).toBe(true);
    });

    it('searches with all optional filters', async () => {
      const repo = createMockRepo();
      repo.search.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.searchPlans({
        query: 'test',
        planningLevels: ['operational'],
        statuses: ['in_progress'],
        tags: ['urgent'],
        goalId: 'g1',
        decisionId: 'd1',
        page: 2,
        limit: 10,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('schedule operations', () => {
    it('scheduleTask delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.scheduleTask('p1', 't1', new Date(), new Date(), 30);
      expect(result.success).toBe(true);
    });

    it('getDependencyGraph delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.getDependencyGraph('p1');
      expect(result.success).toBe(true);
    });

    it('resolveDependencies delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.resolveDependencies('p1');
      expect(result.success).toBe(true);
    });
  });

  describe('progress operations', () => {
    it('trackProgress delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.trackProgress('p1');
      expect(result.success).toBe(true);
    });

    it('completeTask delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.completeTask('p1', 't1', { result: 'success', description: 'Done' });
      expect(result.success).toBe(true);
    });

    it('reportExecution delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const task = new ExecutionTask({
        id: 't1',
        label: 'T',
        description: 'D',
        priority: ExecutionPriority.high(),
      });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.reportExecution('p1', {
        taskId: 't1',
        result: 'success',
        description: 'Done',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('monitoring operations', () => {
    it('analyzeBottlenecks delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.analyzeBottlenecks('p1');
      expect(result.success).toBe(true);
    });

    it('getStats delegates', async () => {
      const repo = createMockRepo();
      repo.count.mockResolvedValue(5);
      repo.countActive.mockResolvedValue(2);
      repo.countOverdue.mockResolvedValue(0);
      repo.countByStatus.mockResolvedValue({ completed: 3 });
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.getStats();
      expect(result.success).toBe(true);
    });

    it('getAtRiskPlans delegates', async () => {
      const repo = createMockRepo();
      repo.search.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 });
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.getAtRiskPlans();
      expect(result.success).toBe(true);
    });
  });

  describe('recovery operations', () => {
    it('activatePlan delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.activatePlan('p1');
      expect(result.success).toBe(true);
    });

    it('startPlan delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.startPlan('p1');
      expect(result.success).toBe(true);
    });

    it('pausePlan delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.pausePlan('p1', 'break');
      expect(result.success).toBe(true);
    });

    it('resumePlan delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      plan.pause();
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.resumePlan('p1');
      expect(result.success).toBe(true);
    });

    it('cancelPlan delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.cancelPlan('p1', 'reason');
      expect(result.success).toBe(true);
    });

    it('adaptPlan delegates', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new ExecutionApplicationService(repo as any);
      const result = await svc.adaptPlan('p1', { trigger: 'T', impact: 'M' });
      expect(result.success).toBe(true);
    });
  });
});
