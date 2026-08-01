import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { ExecutionApplicationService } from '@vedmoulya/services';
import { ExecutionController } from '../controllers/ExecutionController.js';
import { errorMiddleware } from '../middleware/ErrorMapper.js';

export function createExecutionRouter(executionService: ExecutionApplicationService): Hono {
  const controller = new ExecutionController(executionService);
  const router = new Hono();

  // Global Middleware
  router.use('*', cors());
  router.use('*', logger());
  router.use('*', errorMiddleware);

  // Plan CRUD
  router.post('/plans', (c) => controller.createPlan(c));
  router.get('/plans', (c) => controller.listPlans(c));

  // Search & Statistics (registered before /plans/:id so the static segments
  // win over the parameterized route)
  router.get('/plans/search', (c) => controller.searchPlans(c));
  router.get('/plans/stats', (c) => controller.getStatistics(c));

  router.get('/plans/:id', (c) => controller.getPlan(c));
  router.patch('/plans/:id', (c) => controller.updatePlan(c));

  // Lifecycle
  router.post('/plans/:id/activate', (c) => controller.activatePlan(c));
  router.post('/plans/:id/start', (c) => controller.startPlan(c));
  router.post('/plans/:id/pause', (c) => controller.pausePlan(c));
  router.post('/plans/:id/resume', (c) => controller.resumePlan(c));
  router.post('/plans/:id/complete', (c) => controller.completePlan(c));
  router.post('/plans/:id/cancel', (c) => controller.cancelPlan(c));

  // Missions & Tasks
  router.post('/plans/:id/missions', (c) => controller.addMission(c));
  router.post('/plans/:id/tasks', (c) => controller.addTask(c));
  router.post('/plans/:id/tasks/:taskId/complete', (c) => controller.completeTask(c));

  // Scheduling & Recovery
  router.post('/plans/:id/schedule', (c) => controller.scheduleTasks(c));
  router.post('/plans/:id/recover', (c) => controller.recoverPlan(c));

  // Analysis
  router.get('/plans/:id/bottlenecks', (c) => controller.getBottlenecks(c));

  // Health
  router.get('/health', (c) => controller.health(c));

  return router;
}

export const executionRouteConfig = {
  basePath: '/api/v1/execution',
  tags: ['Execution Intelligence Engine'],
  description:
    'Execution Engine API — create, plan, schedule, execute, monitor, and recover execution plans with full lifecycle management',
} as const;
