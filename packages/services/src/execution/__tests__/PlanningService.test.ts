import { describe, it, expect, vi } from 'vitest';
import { PlanningService } from '../PlanningService.js';
import { ExecutionFactory } from '@vedmoulya/domain';
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

describe('PlanningService', () => {
  describe('createPlan', () => {
    it('creates a valid plan', async () => {
      const repo = createMockRepo();
      repo.save.mockResolvedValue(undefined);
      const svc = new PlanningService(repo as any);
      const result = await svc.createPlan({ title: 'Test Plan', description: 'A test' });
      expect(result.success).toBe(true);
      expect(result.data!.title).toBe('Test Plan');
      expect(result.data!.status).toBe('pending');
    });

    it('creates with all optional fields', async () => {
      const repo = createMockRepo();
      repo.save.mockResolvedValue(undefined);
      const svc = new PlanningService(repo as any);
      const result = await svc.createPlan({
        title: 'Full',
        description: 'Full plan',
        planningLevel: 'strategic',
        priorityScore: 9,
        tags: ['urgent'],
        metadata: { key: 'val' },
        goalReferences: [{ goalId: 'g1', label: 'Goal 1', description: 'A goal' }],
        decisionReferences: [{ decisionId: 'd1', title: 'Dec 1', selectedOption: 'opt1' }],
      });
      expect(result.success).toBe(true);
      expect(result.data!.planningLevel).toBe('strategic');
    });
  });

  describe('getPlan', () => {
    it('retrieves an existing plan', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'plan_1', title: 'My Plan', description: 'Desc' });
      repo.findById.mockResolvedValue(plan);
      const svc = new PlanningService(repo as any);
      const result = await svc.getPlan('plan_1');
      expect(result.success).toBe(true);
      expect(result.data!.title).toBe('My Plan');
    });

    it('returns error for missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new PlanningService(repo as any);
      const result = await svc.getPlan('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('listPlans', () => {
    it('lists plans with pagination', async () => {
      const repo = createMockRepo();
      repo.count.mockResolvedValue(5);
      const plan = ExecutionPlan.create({ id: 'p1', title: 'Plan', description: 'D' });
      repo.search.mockResolvedValue({ data: [plan], total: 1, page: 1, limit: 20, totalPages: 1 });
      const svc = new PlanningService(repo as any);
      const result = await svc.listPlans(1, 20);
      expect(result.success).toBe(true);
      expect(result.data!.total).toBe(5);
      expect(result.data!.data).toHaveLength(1);
    });

    it('handles empty results', async () => {
      const repo = createMockRepo();
      repo.count.mockResolvedValue(0);
      repo.search.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      const svc = new PlanningService(repo as any);
      const result = await svc.listPlans();
      expect(result.success).toBe(true);
      expect(result.data!.data).toHaveLength(0);
    });

    it('handles search error', async () => {
      const repo = createMockRepo();
      repo.count.mockRejectedValue(new Error('DB error'));
      const svc = new PlanningService(repo as any);
      const result = await svc.listPlans();
      expect(result.success).toBe(false);
    });
  });

  describe('createMission', () => {
    it('creates a mission in a plan', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'Plan', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new PlanningService(repo as any);
      const result = await svc.createMission('p1', { label: 'Mission 1', description: 'Do it' });
      expect(result.success).toBe(true);
      expect(result.data!.missions).toHaveLength(1);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new PlanningService(repo as any);
      const result = await svc.createMission('bad', { label: 'M', description: 'D' });
      expect(result.success).toBe(false);
    });
  });

  describe('createPlan error handling', () => {
    it('propagates repository save error', async () => {
      const repo = createMockRepo();
      repo.save.mockRejectedValue(new Error('Save error'));
      const svc = new PlanningService(repo as any);
      await expect(svc.createPlan({ title: 'Fail Plan', description: 'D' })).rejects.toThrow(
        'Save error',
      );
    });
  });

  describe('createTask', () => {
    it('creates a task in a plan', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'Plan', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new PlanningService(repo as any);
      const result = await svc.createTask('p1', { label: 'Task 1', description: 'Do it' });
      expect(result.success).toBe(true);
      expect(result.data!.tasks).toHaveLength(1);
    });

    it('creates task with mission and duration', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new PlanningService(repo as any);
      const result = await svc.createTask('p1', {
        label: 'T',
        description: 'D',
        estimatedDuration: 60,
        missionId: 'mis_1',
      });
      expect(result.success).toBe(true);
    });

    it('handles missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new PlanningService(repo as any);
      const result = await svc.createTask('bad', { label: 'T', description: 'D' });
      expect(result.success).toBe(false);
    });
  });

  describe('getPlan error', () => {
    it('propagates repository error', async () => {
      const repo = createMockRepo();
      repo.findById.mockRejectedValue(new Error('DB error'));
      const svc = new PlanningService(repo as any);
      await expect(svc.getPlan('p1')).rejects.toThrow('DB error');
    });
  });

  describe('addStep', () => {
    it('adds step metadata to plan', async () => {
      const repo = createMockRepo();
      const task = new ExecutionTask({
        id: 't1',
        label: 'Task',
        description: 'D',
        priority: ExecutionPriority.medium(),
      });
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.addTask(task);
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new PlanningService(repo as any);
      const result = await svc.addStep('p1', 't1', { label: 'Step 1', description: 'Do step' });
      expect(result.success).toBe(true);
    });

    it('rejects missing task', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      const svc = new PlanningService(repo as any);
      const result = await svc.addStep('p1', 'nonexistent', { label: 'Step', description: 'D' });
      expect(result.success).toBe(false);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new PlanningService(repo as any);
      const result = await svc.addStep('bad', 't1', { label: 'S', description: 'D' });
      expect(result.success).toBe(false);
    });
  });

  describe('generateDailyPlan', () => {
    it('generates daily plan from active plan', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'Task 1',
          description: 'D',
          priority: ExecutionPriority.high(),
        }),
      );
      repo.findById.mockResolvedValue(plan);
      const svc = new PlanningService(repo as any);
      const result = await svc.generateDailyPlan('p1', 120);
      expect(result.success).toBe(true);
      expect(result.data!.tasks).toBeDefined();
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new PlanningService(repo as any);
      const result = await svc.generateDailyPlan('bad');
      expect(result.success).toBe(false);
    });

    it('handles empty plan (no tasks)', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      const svc = new PlanningService(repo as any);
      const result = await svc.generateDailyPlan('p1');
      expect(result.success).toBe(true);
      expect(result.data!.tasks).toHaveLength(0);
    });
  });

  describe('weeklyReview', () => {
    it('generates weekly review', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'T',
          description: 'D',
          priority: ExecutionPriority.medium(),
        }),
      );
      repo.findById.mockResolvedValue(plan);
      const svc = new PlanningService(repo as any);
      const result = await svc.weeklyReview('p1');
      expect(result.success).toBe(true);
      expect(result.data!.completedTasks).toBe(0);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new PlanningService(repo as any);
      const result = await svc.weeklyReview('bad');
      expect(result.success).toBe(false);
    });
  });

  describe('large plans', () => {
    it('handles plan with many tasks', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({
        id: 'big',
        title: 'Big Plan',
        description: 'Many tasks',
      });
      for (let i = 0; i < 100; i++) {
        plan.addTask(
          new ExecutionTask({
            id: `t${i}`,
            label: `Task ${i}`,
            description: `Task ${i}`,
            priority: ExecutionPriority.medium(),
          }),
        );
      }
      repo.findById.mockResolvedValue(plan);
      repo.save.mockResolvedValue(undefined);
      const svc = new PlanningService(repo as any);
      const result = await svc.generateDailyPlan('big', 480);
      expect(result.success).toBe(true);
      expect(result.data!.tasks.length).toBeLessThanOrEqual(5);
    });
  });
});
