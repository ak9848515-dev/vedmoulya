// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution tRPC Router Tests
// Exercises every procedure through a tRPC caller with a mocked service.
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExecutionTrpcRouter } from '../ExecutionRouter.js';
import type { ExecutionApplicationService } from '@vedmoulya/services';

function makeService(): ExecutionApplicationService {
  const fn = () => vi.fn().mockResolvedValue({ success: true, data: {} });
  return {
    createPlan: fn(),
    getPlan: fn(),
    updatePlan: fn(),
    activatePlan: fn(),
    startPlan: fn(),
    pausePlan: fn(),
    resumePlan: fn(),
    completePlan: fn(),
    cancelPlan: fn(),
    addMission: fn(),
    addTask: fn(),
    completeTask: fn(),
    scheduleTasks: fn(),
    recoverPlan: fn(),
    listPlans: fn(),
    searchPlans: fn(),
    getStats: fn(),
    analyzeBottlenecks: fn(),
  } as unknown as ExecutionApplicationService;
}

type Caller = {
  createPlan: (input: unknown) => Promise<{ success: boolean; data: unknown }>;
  getPlan: (input: string) => Promise<{ success: boolean; data: unknown }>;
  updatePlan: (input: {
    id: string;
    data: unknown;
  }) => Promise<{ success: boolean; data: unknown }>;
  activatePlan: (input: string) => Promise<{ success: boolean; data: unknown }>;
  startPlan: (input: string) => Promise<{ success: boolean; data: unknown }>;
  pausePlan: (input: {
    id: string;
    reason?: string;
  }) => Promise<{ success: boolean; data: unknown }>;
  resumePlan: (input: string) => Promise<{ success: boolean; data: unknown }>;
  completePlan: (input: {
    id: string;
    data: unknown;
  }) => Promise<{ success: boolean; data: unknown }>;
  cancelPlan: (input: {
    id: string;
    data: unknown;
  }) => Promise<{ success: boolean; data: unknown }>;
  addMission: (input: {
    id: string;
    data: unknown;
  }) => Promise<{ success: boolean; data: unknown }>;
  addTask: (input: { id: string; data: unknown }) => Promise<{ success: boolean; data: unknown }>;
  completeTask: (input: {
    id: string;
    taskId: string;
    data: unknown;
  }) => Promise<{ success: boolean; data: unknown }>;
  analyzeBottlenecks: (input: string) => Promise<{ success: boolean; data: unknown }>;
  listPlans: (input: {
    page?: number;
    limit?: number;
  }) => Promise<{ success: boolean; data: unknown }>;
  getStats: () => Promise<{ success: boolean; data: unknown }>;
};

describe('createExecutionTrpcRouter', () => {
  let service: ExecutionApplicationService;
  let caller: Caller;

  beforeEach(() => {
    service = makeService();
    const router = createExecutionTrpcRouter(service) as { createCaller: (ctx: object) => Caller };
    caller = router.createCaller({});
  });

  it('createPlan calls the service and wraps the result', async () => {
    const result = await caller.createPlan({ title: 'T', description: 'D' });

    expect(result.success).toBe(true);
    expect(service.createPlan).toHaveBeenCalledWith({ title: 'T', description: 'D' });
  });

  it('getPlan calls the service with the id', async () => {
    await caller.getPlan('plan_1');

    expect(service.getPlan).toHaveBeenCalledWith('plan_1');
  });

  it('updatePlan calls the service with id and data', async () => {
    await caller.updatePlan({ id: 'plan_1', data: { title: 'Updated' } });

    expect(service.updatePlan).toHaveBeenCalledWith('plan_1', { title: 'Updated' });
  });

  it('activatePlan and startPlan forward the id', async () => {
    await caller.activatePlan('plan_1');
    await caller.startPlan('plan_1');

    expect(service.activatePlan).toHaveBeenCalledWith('plan_1');
    expect(service.startPlan).toHaveBeenCalledWith('plan_1');
  });

  it('pausePlan forwards id and reason', async () => {
    await caller.pausePlan({ id: 'plan_1', reason: 'tired' });

    expect(service.pausePlan).toHaveBeenCalledWith('plan_1', 'tired');
  });

  it('resumePlan forwards the id', async () => {
    await caller.resumePlan('plan_1');

    expect(service.resumePlan).toHaveBeenCalledWith('plan_1');
  });

  it('completePlan maps the report input', async () => {
    await caller.completePlan({
      id: 'plan_1',
      data: { result: { result: 'success', description: 'Done', qualityScore: 90, duration: 10 } },
    });

    expect(service.completePlan).toHaveBeenCalledWith('plan_1', {
      taskId: 'plan_1',
      result: 'success',
      description: 'Done',
      actualDuration: 10,
      quality: 90,
    });
  });

  it('cancelPlan forwards id and reason', async () => {
    await caller.cancelPlan({ id: 'plan_1', data: { reason: 'scope change' } });

    expect(service.cancelPlan).toHaveBeenCalledWith('plan_1', 'scope change');
  });

  it('addMission maps the mission input', async () => {
    await caller.addMission({ id: 'plan_1', data: { label: 'M', description: 'D' } });

    expect(service.addMission).toHaveBeenCalledWith('plan_1', {
      label: 'M',
      description: 'D',
      priorityScore: undefined,
      tags: undefined,
      planId: 'plan_1',
      targetDate: undefined,
    });
  });

  it('addTask maps the task input', async () => {
    await caller.addTask({
      id: 'plan_1',
      data: { label: 'T', description: 'D', estimatedDuration: 30 },
    });

    expect(service.addTask).toHaveBeenCalledWith('plan_1', {
      label: 'T',
      description: 'D',
      priorityScore: undefined,
      estimatedDuration: 30,
      missionId: undefined,
      planId: 'plan_1',
      tags: undefined,
    });
  });

  it('completeTask forwards id, taskId, and data', async () => {
    await caller.completeTask({
      id: 'plan_1',
      taskId: 'task_1',
      data: { result: 'success', description: 'D' },
    });

    expect(service.completeTask).toHaveBeenCalledWith('plan_1', 'task_1', {
      result: 'success',
      description: 'D',
    });
  });

  it('analyzeBottlenecks forwards the id', async () => {
    await caller.analyzeBottlenecks('plan_1');

    expect(service.analyzeBottlenecks).toHaveBeenCalledWith('plan_1');
  });

  it('listPlans defaults page and limit', async () => {
    await caller.listPlans({});

    expect(service.listPlans).toHaveBeenCalledWith(1, 20);
  });

  it('getStats calls the service', async () => {
    await caller.getStats();

    expect(service.getStats).toHaveBeenCalled();
  });
});
