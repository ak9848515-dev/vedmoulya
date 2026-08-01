// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Routes Tests
// Exercises the Hono router end-to-end with a mocked ExecutionApplicationService.
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createExecutionRouter, executionRouteConfig } from '../ExecutionRoutes.js';
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

describe('createExecutionRouter', () => {
  let app: Hono;
  let service: ExecutionApplicationService;

  beforeEach(() => {
    service = makeService();
    app = createExecutionRouter(service);
  });

  it('creates a plan via POST /plans', async () => {
    const res = await app.request('/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', description: 'D' }),
    });

    expect(res.status).toBe(201);
    expect(service.createPlan).toHaveBeenCalledWith({ title: 'T', description: 'D' });
  });

  it('lists plans via GET /plans', async () => {
    const res = await app.request('/plans');

    expect(res.status).toBe(200);
    expect(service.listPlans).toHaveBeenCalled();
  });

  it('gets a plan via GET /plans/:id', async () => {
    const res = await app.request('/plans/plan_1');

    expect(res.status).toBe(200);
    expect(service.getPlan).toHaveBeenCalledWith('plan_1');
  });

  it('updates a plan via PATCH /plans/:id', async () => {
    const res = await app.request('/plans/plan_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });

    expect(res.status).toBe(200);
    expect(service.updatePlan).toHaveBeenCalledWith('plan_1', {
      title: 'Updated',
      description: undefined,
      priorityScore: undefined,
      tags: undefined,
      metadata: undefined,
    });
  });

  it.each([
    ['activatePlan', '/plans/plan_1/activate'],
    ['startPlan', '/plans/plan_1/start'],
    ['resumePlan', '/plans/plan_1/resume'],
    ['recoverPlan', '/plans/plan_1/recover'],
  ])('calls %s via POST %s', async (method, path) => {
    const res = await app.request(path, { method: 'POST' });

    expect(res.status).toBe(200);
    expect(service[method as keyof ExecutionApplicationService]).toHaveBeenCalledWith('plan_1');
  });

  it('pauses a plan with a reason', async () => {
    const res = await app.request('/plans/plan_1/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'tired' }),
    });

    expect(res.status).toBe(200);
    expect(service.pausePlan).toHaveBeenCalledWith('plan_1', 'tired');
  });

  it('completes a plan', async () => {
    const res = await app.request('/plans/plan_1/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: { result: 'success', description: 'Done' } }),
    });

    expect(res.status).toBe(200);
    expect(service.completePlan).toHaveBeenCalled();
  });

  it('cancels a plan with a reason', async () => {
    const res = await app.request('/plans/plan_1/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'scope change' }),
    });

    expect(res.status).toBe(200);
    expect(service.cancelPlan).toHaveBeenCalledWith('plan_1', 'scope change');
  });

  it('adds a mission', async () => {
    const res = await app.request('/plans/plan_1/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'M', description: 'D' }),
    });

    expect(res.status).toBe(200);
    expect(service.addMission).toHaveBeenCalled();
  });

  it('adds a task', async () => {
    const res = await app.request('/plans/plan_1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'T', description: 'D' }),
    });

    expect(res.status).toBe(200);
    expect(service.addTask).toHaveBeenCalled();
  });

  it('completes a task', async () => {
    const res = await app.request('/plans/plan_1/tasks/task_1/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: 'success', description: 'D' }),
    });

    expect(res.status).toBe(200);
    expect(service.completeTask).toHaveBeenCalledWith('plan_1', 'task_1', {
      result: 'success',
      description: 'D',
      qualityScore: undefined,
      duration: undefined,
    });
  });

  it('schedules tasks', async () => {
    const res = await app.request('/plans/plan_1/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: ['task_1'] }),
    });

    expect(res.status).toBe(200);
    expect(service.scheduleTasks).toHaveBeenCalled();
  });

  it('analyzes bottlenecks via GET /plans/:id/bottlenecks', async () => {
    const res = await app.request('/plans/plan_1/bottlenecks');

    expect(res.status).toBe(200);
    expect(service.analyzeBottlenecks).toHaveBeenCalledWith('plan_1');
  });

  it('searches plans via GET /plans/search', async () => {
    const res = await app.request('/plans/search?q=launch&status=pending');

    expect(res.status).toBe(200);
    expect(service.searchPlans).toHaveBeenCalled();
  });

  it('gets statistics via GET /plans/stats', async () => {
    const res = await app.request('/plans/stats');

    expect(res.status).toBe(200);
    expect(service.getStats).toHaveBeenCalled();
  });

  it('reports healthy via GET /health', async () => {
    const res = await app.request('/health');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'healthy', service: 'execution' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/nope');

    expect(res.status).toBe(404);
  });
});

describe('executionRouteConfig', () => {
  it('declares the base path and tags', () => {
    expect(executionRouteConfig.basePath).toBe('/api/v1/execution');
    expect(executionRouteConfig.tags).toContain('Execution Intelligence Engine');
  });
});
