import { describe, it, expect, vi } from 'vitest';
import { RecoveryService } from '../RecoveryService.js';
import {
  ExecutionPlan,
  ExecutionTask,
  ExecutionPriority,
  ExecutionResult,
} from '@vedmoulya/domain';

function createMockRepo() {
  return { findById: vi.fn(), update: vi.fn() };
}

function createActivePlan(): ExecutionPlan {
  const plan = ExecutionPlan.create({ id: 'p1', title: 'Active Plan', description: 'D' });
  plan.activate();
  plan.start();
  plan.addTask(
    new ExecutionTask({
      id: 't1',
      label: 'Task 1',
      description: 'D',
      priority: ExecutionPriority.high(),
    }),
  );
  return plan;
}

describe('RecoveryService', () => {
  describe('activatePlan', () => {
    it('activates a plan', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new RecoveryService(repo as any);
      const result = await svc.activatePlan('p1');
      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('ready');
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new RecoveryService(repo as any);
      const result = await svc.activatePlan('bad');
      expect(result.success).toBe(false);
    });
  });

  describe('startPlan', () => {
    it('starts an activated plan', async () => {
      const repo = createMockRepo();
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new RecoveryService(repo as any);
      const result = await svc.startPlan('p1');
      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('in_progress');
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new RecoveryService(repo as any);
      const result = await svc.startPlan('bad');
      expect(result.success).toBe(false);
    });
  });

  describe('pausePlan', () => {
    it('pauses an active plan', async () => {
      const repo = createMockRepo();
      const plan = createActivePlan();
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new RecoveryService(repo as any);
      const result = await svc.pausePlan('p1', 'Need break');
      expect(result.success).toBe(true);
      expect(result.data!.status).toContain('paused');
    });

    it('pauses without reason', async () => {
      const repo = createMockRepo();
      const plan = createActivePlan();
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new RecoveryService(repo as any);
      const result = await svc.pausePlan('p1');
      expect(result.success).toBe(true);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new RecoveryService(repo as any);
      const result = await svc.pausePlan('bad');
      expect(result.success).toBe(false);
    });
  });

  describe('resumePlan', () => {
    it('resumes a paused plan', async () => {
      const repo = createMockRepo();
      const plan = createActivePlan();
      plan.pause('Paused');
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new RecoveryService(repo as any);
      const result = await svc.resumePlan('p1');
      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('in_progress');
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new RecoveryService(repo as any);
      const result = await svc.resumePlan('bad');
      expect(result.success).toBe(false);
    });
  });

  describe('cancelPlan', () => {
    it('cancels a plan', async () => {
      const repo = createMockRepo();
      const plan = createActivePlan();
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new RecoveryService(repo as any);
      const result = await svc.cancelPlan('p1', 'No longer needed');
      expect(result.success).toBe(true);
      expect(result.data!.status).toContain('cancelled');
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new RecoveryService(repo as any);
      const result = await svc.cancelPlan('bad', 'reason');
      expect(result.success).toBe(false);
    });
  });

  describe('retryTask', () => {
    it('records retry attempt', async () => {
      const repo = createMockRepo();
      const plan = createActivePlan();
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new RecoveryService(repo as any);
      const result = await svc.retryTask('p1', 't1');
      expect(result.success).toBe(true);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new RecoveryService(repo as any);
      const result = await svc.retryTask('bad', 't1');
      expect(result.success).toBe(false);
    });
  });

  describe('recoverPlan', () => {
    it('recovers a failed plan', async () => {
      const repo = createMockRepo();
      const plan = createActivePlan();
      plan.fail('Out of time');
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new RecoveryService(repo as any);
      const result = await svc.recoverPlan('p1', 'Recovering');
      expect(result.success).toBe(true);
    });

    it('recovers without reason', async () => {
      const repo = createMockRepo();
      const plan = createActivePlan();
      plan.fail('Error');
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new RecoveryService(repo as any);
      const result = await svc.recoverPlan('p1');
      expect(result.success).toBe(true);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new RecoveryService(repo as any);
      const result = await svc.recoverPlan('bad');
      expect(result.success).toBe(false);
    });
  });

  describe('adaptPlan', () => {
    it('adapts a plan to new circumstances', async () => {
      const repo = createMockRepo();
      const plan = createActivePlan();
      repo.findById.mockResolvedValue(plan);
      repo.update.mockResolvedValue(undefined);
      const svc = new RecoveryService(repo as any);
      const result = await svc.adaptPlan('p1', {
        trigger: 'New priority',
        impact: 'Medium',
        preferredApproach: 'Replan',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing plan', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const svc = new RecoveryService(repo as any);
      const result = await svc.adaptPlan('bad', { trigger: 'T', impact: 'M' });
      expect(result.success).toBe(false);
    });
  });
});
