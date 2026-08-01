// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Controller Tests
// Covers every HTTP handler: success, validation-error (400), not-found (404),
// service-error, and thrown-error paths.
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from 'hono';
import { ExecutionController } from '../ExecutionController.js';
import type { ExecutionApplicationService } from '@vedmoulya/services';

type MockCtx = {
  req: {
    json: ReturnType<typeof vi.fn>;
    param: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  json: ReturnType<typeof vi.fn>;
};

function makeContext(body: unknown = {}, params: Record<string, string> = {}): MockCtx {
  const param = vi.fn((key: string) => params[key] ?? 'plan_1');
  return {
    req: {
      json: vi.fn().mockResolvedValue(body),
      param,
      query: vi.fn().mockReturnValue({}),
    },
    json: vi.fn(),
  };
}

function makeService(): ExecutionApplicationService {
  const fn = () => vi.fn();
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

const success = { success: true, data: { id: 'plan_1' } };
// No `error` field: exercises the `result.error ?? 'fallback'` branches.
const failure = { success: false };

/**
 * Assert the controller returned an error response with the expected error
 * code and status. Uses toMatchObject on the captured call args because
 * expect.objectContaining compares nested plain objects with full equality.
 */
function expectError(c: MockCtx, code: string, status: number): void {
  expect(c.json).toHaveBeenCalledTimes(1);
  const [body, statusCode] = c.json.mock.calls[0] as [Record<string, unknown>, number];
  expect(statusCode).toBe(status);
  expect(body).toMatchObject({ success: false, error: { code } });
}

describe('ExecutionController', () => {
  let service: ExecutionApplicationService;
  let controller: ExecutionController;

  beforeEach(() => {
    service = makeService();
    controller = new ExecutionController(service);
  });

  describe('createPlan', () => {
    it('returns 201 on success', async () => {
      (service.createPlan as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ title: 'T', description: 'D' });

      await controller.createPlan(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } }, 201);
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ title: '' });

      await controller.createPlan(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });

    it('returns 400 on service failure', async () => {
      (service.createPlan as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext({ title: 'T', description: 'D' });

      await controller.createPlan(c as unknown as Context);

      expectError(c, 'CREATE_ERROR', 400);
    });
  });

  describe('getPlan', () => {
    it('returns the plan on success', async () => {
      (service.getPlan as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();

      await controller.getPlan(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } });
    });

    it('returns 404 when the plan is missing', async () => {
      (service.getPlan as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.getPlan(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('updatePlan', () => {
    it('returns the updated plan on success', async () => {
      (service.updatePlan as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ title: 'Updated' });

      await controller.updatePlan(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ title: '' });

      await controller.updatePlan(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });

    it('returns 404 when the plan is missing', async () => {
      (service.updatePlan as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext({ title: 'Updated' });

      await controller.updatePlan(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('lifecycle handlers', () => {
    it.each([
      ['activatePlan', 'activatePlan'],
      ['startPlan', 'startPlan'],
      ['resumePlan', 'resumePlan'],
      ['recoverPlan', 'recoverPlan'],
    ] as const)('%s returns the plan on success', async (handler, method) => {
      (service[method] as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();

      await (controller as unknown as Record<string, (ctx: Context) => Promise<Response>>)[handler](
        c as unknown as Context,
      );

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } });
    });

    it.each([
      ['activatePlan', 'activatePlan'],
      ['startPlan', 'startPlan'],
      ['resumePlan', 'resumePlan'],
    ] as const)('%s returns 404 when the plan is missing', async (handler, method) => {
      (service[method] as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await (controller as unknown as Record<string, (ctx: Context) => Promise<Response>>)[handler](
        c as unknown as Context,
      );

      expectError(c, 'NOT_FOUND', 404);
    });

    it('recoverPlan returns 500 on service failure', async () => {
      (service.recoverPlan as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.recoverPlan(c as unknown as Context);

      expectError(c, 'RECOVERY_FAILED', 500);
    });
  });

  describe('pausePlan', () => {
    it('passes the reason through', async () => {
      (service.pausePlan as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ reason: 'tired' });

      await controller.pausePlan(c as unknown as Context);

      expect(service.pausePlan).toHaveBeenCalledWith('plan_1', 'tired');
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } });
    });

    it('tolerates a missing body', async () => {
      (service.pausePlan as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();
      (c.req.json as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no body'));

      await controller.pausePlan(c as unknown as Context);

      expect(service.pausePlan).toHaveBeenCalledWith('plan_1', undefined);
    });

    it('returns 404 when the plan is missing', async () => {
      (service.pausePlan as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.pausePlan(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('completePlan', () => {
    const body = {
      result: { result: 'success', description: 'Done', qualityScore: 90, duration: 10 },
    };

    it('returns the completed plan on success', async () => {
      (service.completePlan as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext(body);

      await controller.completePlan(c as unknown as Context);

      expect(service.completePlan).toHaveBeenCalledWith('plan_1', {
        taskId: 'plan_1',
        result: 'success',
        description: 'Done',
        actualDuration: 10,
        quality: 90,
      });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({});

      await controller.completePlan(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('cancelPlan', () => {
    it('passes the reason through', async () => {
      (service.cancelPlan as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ reason: 'scope change' });

      await controller.cancelPlan(c as unknown as Context);

      expect(service.cancelPlan).toHaveBeenCalledWith('plan_1', 'scope change');
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({});

      await controller.cancelPlan(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('addMission', () => {
    it('adds the mission and returns the plan', async () => {
      (service.addMission as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ label: 'M', description: 'D' });

      await controller.addMission(c as unknown as Context);

      expect(service.addMission).toHaveBeenCalledWith('plan_1', {
        label: 'M',
        description: 'D',
        priorityScore: undefined,
        tags: undefined,
        planId: 'plan_1',
        targetDate: undefined,
      });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ label: '' });

      await controller.addMission(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('addTask', () => {
    it('adds the task and returns the plan', async () => {
      (service.addTask as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ label: 'T', description: 'D', estimatedDuration: 30 });

      await controller.addTask(c as unknown as Context);

      expect(service.addTask).toHaveBeenCalledWith('plan_1', {
        label: 'T',
        description: 'D',
        priorityScore: undefined,
        estimatedDuration: 30,
        missionId: undefined,
        planId: 'plan_1',
        tags: undefined,
      });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ label: '' });

      await controller.addTask(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('completeTask', () => {
    it('completes the task and returns the plan', async () => {
      (service.completeTask as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ result: 'success', description: 'D' }, { taskId: 'task_1' });

      await controller.completeTask(c as unknown as Context);

      expect(service.completeTask).toHaveBeenCalledWith('plan_1', 'task_1', {
        result: 'success',
        description: 'D',
        qualityScore: undefined,
        duration: undefined,
      });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({});

      await controller.completeTask(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('scheduleTasks', () => {
    it('schedules tasks and returns the plan', async () => {
      (service.scheduleTasks as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ taskIds: ['task_1', 'task_2'] });

      await controller.scheduleTasks(c as unknown as Context);

      expect(service.scheduleTasks).toHaveBeenCalledWith('plan_1', {
        taskIds: ['task_1', 'task_2'],
        scheduledDates: undefined,
      });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'plan_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ taskIds: [] });

      await controller.scheduleTasks(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('listPlans', () => {
    it('returns the plan list on success', async () => {
      (service.listPlans as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { items: [], total: 0 },
      });
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({ page: '1', limit: '10' });

      await controller.listPlans(c as unknown as Context);

      expect(service.listPlans).toHaveBeenCalledWith(1, 10);
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { items: [], total: 0 } });
    });

    it('returns 400 on invalid query', async () => {
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({ page: 'abc' });

      await controller.listPlans(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });

    it('returns 500 on service failure', async () => {
      (service.listPlans as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.listPlans(c as unknown as Context);

      expectError(c, 'LIST_ERROR', 500);
    });
  });

  describe('searchPlans', () => {
    it('passes status and planning level filters', async () => {
      (service.searchPlans as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { items: [], total: 0 },
      });
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({
        q: 'launch',
        status: 'pending',
        planningLevel: 'operational',
        page: '2',
        limit: '5',
      });

      await controller.searchPlans(c as unknown as Context);

      expect(service.searchPlans).toHaveBeenCalledWith({
        query: 'launch',
        statuses: ['pending'],
        planningLevels: ['operational'],
        page: 2,
        limit: 5,
      });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { items: [], total: 0 } });
    });

    it('returns 500 on service failure', async () => {
      (service.searchPlans as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.searchPlans(c as unknown as Context);

      expectError(c, 'SEARCH_ERROR', 500);
    });
  });

  describe('getStatistics', () => {
    it('returns stats on success', async () => {
      (service.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { total: 1 },
      });
      const c = makeContext();

      await controller.getStatistics(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { total: 1 } });
    });

    it('returns 500 on service failure', async () => {
      (service.getStats as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.getStatistics(c as unknown as Context);

      expectError(c, 'STATS_ERROR', 500);
    });
  });

  describe('getBottlenecks', () => {
    it('returns bottlenecks on success', async () => {
      (service.analyzeBottlenecks as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [{ entityId: 'task_1', entityType: 'task', issue: 'blocked' }],
      });
      const c = makeContext();

      await controller.getBottlenecks(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({
        success: true,
        data: [{ entityId: 'task_1', entityType: 'task', issue: 'blocked' }],
      });
    });

    it('returns 404 when the plan is missing', async () => {
      (service.analyzeBottlenecks as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.getBottlenecks(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('health', () => {
    it('reports healthy', () => {
      const c = makeContext();

      controller.health(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ status: 'healthy', service: 'execution' });
    });
  });

  describe('thrown service errors map to 500 for every handler', () => {
    it.each([
      ['createPlan', 'createPlan', { title: 'T', description: 'D' }],
      ['getPlan', 'getPlan', {}],
      ['updatePlan', 'updatePlan', { title: 'T' }],
      ['activatePlan', 'activatePlan', {}],
      ['startPlan', 'startPlan', {}],
      ['pausePlan', 'pausePlan', { reason: 'x' }],
      ['resumePlan', 'resumePlan', {}],
      ['completePlan', 'completePlan', { result: { result: 'success', description: 'D' } }],
      ['cancelPlan', 'cancelPlan', { reason: 'x' }],
      ['addMission', 'addMission', { label: 'M', description: 'D' }],
      ['addTask', 'addTask', { label: 'T', description: 'D' }],
      ['completeTask', 'completeTask', { result: 'success', description: 'D' }],
      ['scheduleTasks', 'scheduleTasks', { taskIds: ['task_1'] }],
      ['recoverPlan', 'recoverPlan', {}],
      ['listPlans', 'listPlans', {}],
      ['searchPlans', 'searchPlans', {}],
      ['getStatistics', 'getStats', {}],
      ['getBottlenecks', 'analyzeBottlenecks', {}],
    ] as const)('%s -> INTERNAL_ERROR 500', async (handler, method, body) => {
      (
        service[method as keyof ExecutionApplicationService] as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error('boom'));
      const c = makeContext(body);
      if (handler === 'listPlans' || handler === 'searchPlans') {
        (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({});
      }

      await (controller as unknown as Record<string, (ctx: Context) => Promise<Response>>)[handler](
        c as unknown as Context,
      );

      expectError(c, 'INTERNAL_ERROR', 500);
    });
  });

  describe('service errors carrying a message use the message via the ?? fallback branch', () => {
    const failureWithMessage = { success: false, error: 'boom' };
    it.each([
      ['createPlan', 'createPlan', { title: 'T', description: 'D' }, 'CREATE_ERROR', 400],
      ['getPlan', 'getPlan', {}, 'NOT_FOUND', 404],
      ['updatePlan', 'updatePlan', { title: 'T' }, 'NOT_FOUND', 404],
      ['activatePlan', 'activatePlan', {}, 'NOT_FOUND', 404],
      ['startPlan', 'startPlan', {}, 'NOT_FOUND', 404],
      ['pausePlan', 'pausePlan', { reason: 'x' }, 'NOT_FOUND', 404],
      ['resumePlan', 'resumePlan', {}, 'NOT_FOUND', 404],
      [
        'completePlan',
        'completePlan',
        { result: { result: 'success', description: 'D' } },
        'NOT_FOUND',
        404,
      ],
      ['cancelPlan', 'cancelPlan', { reason: 'x' }, 'NOT_FOUND', 404],
      ['addMission', 'addMission', { label: 'M', description: 'D' }, 'NOT_FOUND', 404],
      ['addTask', 'addTask', { label: 'T', description: 'D' }, 'NOT_FOUND', 404],
      ['completeTask', 'completeTask', { result: 'success', description: 'D' }, 'NOT_FOUND', 404],
      ['scheduleTasks', 'scheduleTasks', { taskIds: ['task_1'] }, 'NOT_FOUND', 404],
      ['recoverPlan', 'recoverPlan', {}, 'RECOVERY_FAILED', 500],
      ['listPlans', 'listPlans', {}, 'LIST_ERROR', 500],
      ['searchPlans', 'searchPlans', {}, 'SEARCH_ERROR', 500],
      ['getStatistics', 'getStats', {}, 'STATS_ERROR', 500],
      ['getBottlenecks', 'analyzeBottlenecks', {}, 'NOT_FOUND', 404],
    ] as const)('%s -> %s %s', async (handler, method, body, code, status) => {
      (
        service[method as keyof ExecutionApplicationService] as ReturnType<typeof vi.fn>
      ).mockResolvedValue(failureWithMessage);
      const c = makeContext(body);

      await (controller as unknown as Record<string, (ctx: Context) => Promise<Response>>)[handler](
        c as unknown as Context,
      );

      expectError(c, code, status);
    });
  });
});
