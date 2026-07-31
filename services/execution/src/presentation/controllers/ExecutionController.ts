import type { Context } from 'hono';
import { BaseController } from '@vedmoulya/core';
import type { ExecutionApplicationService } from '@vedmoulya/services';
import { mapErrorToResponse } from '../middleware/ErrorMapper.js';
import {
  createPlanSchema,
  updatePlanSchema,
  createMissionSchema,
  createTaskSchema,
  scheduleTasksSchema,
  completeTaskSchema,
  reportExecutionSchema,
  cancelPlanSchema,
  searchQuery,
} from '../validation/ExecutionSchemas.js';
import type { PlanDTO, PlanListDTO, ExecutionStatsDTO, BottleneckDTO } from '@vedmoulya/services';

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ExecutionController extends BaseController {
  private readonly executionService: ExecutionApplicationService;

  constructor(executionService: ExecutionApplicationService) {
    super('execution');
    this.executionService = executionService;
  }

  /** Safely handle errors in controller methods */
  private handleError(error: unknown, c: Context): Response {
    return mapErrorToResponse(error, c);
  }

  // ── Plan CRUD ──────────────────────────────────────────────────────────

  /** POST /plans */
  async createPlan(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = createPlanSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      const result: ServiceResult<PlanDTO> = await this.executionService.createPlan(parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'CREATE_ERROR', message: result.error ?? 'Create failed' },
          },
          400,
        );
      }
      return c.json({ success: true, data: result.data }, 201);
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** GET /plans/:id */
  async getPlan(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result: ServiceResult<PlanDTO> = await this.executionService.getPlan(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** PATCH /plans/:id */
  async updatePlan(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = updatePlanSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      const result: ServiceResult<PlanDTO> = await this.executionService.updatePlan(id, {
        title: parsed.data.title,
        description: parsed.data.description,
        priorityScore: parsed.data.priorityScore,
        tags: parsed.data.tags,
        metadata: parsed.data.metadata,
      });
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  // ── Lifecycle Operations ─────────────────────────────────────────────

  /** POST /plans/:id/activate */
  async activatePlan(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result: ServiceResult<PlanDTO> = await this.executionService.activatePlan(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** POST /plans/:id/start */
  async startPlan(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result: ServiceResult<PlanDTO> = await this.executionService.startPlan(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** POST /plans/:id/pause */
  async pausePlan(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
      const result: ServiceResult<PlanDTO> = await this.executionService.pausePlan(id, body.reason);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** POST /plans/:id/resume */
  async resumePlan(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result: ServiceResult<PlanDTO> = await this.executionService.resumePlan(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** POST /plans/:id/complete */
  async completePlan(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = reportExecutionSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      const result: ServiceResult<PlanDTO> = await this.executionService.completePlan(id, {
        taskId: id,
        result: parsed.data.result.result,
        description: parsed.data.result.description,
        actualDuration: parsed.data.result.duration,
        quality: parsed.data.result.qualityScore,
      });
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** POST /plans/:id/cancel */
  async cancelPlan(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = cancelPlanSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      const result: ServiceResult<PlanDTO> = await this.executionService.cancelPlan(
        id,
        parsed.data.reason,
      );
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  // ── Mission & Task Operations ─────────────────────────────────────────

  /** POST /plans/:id/missions */
  async addMission(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = createMissionSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      const result: ServiceResult<PlanDTO> = await this.executionService.addMission(id, {
        label: parsed.data.label,
        description: parsed.data.description,
        priorityScore: parsed.data.priorityScore,
        tags: parsed.data.tags,
        planId: id,
        targetDate: parsed.data.targetDate,
      });
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** POST /plans/:id/tasks */
  async addTask(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = createTaskSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      const result: ServiceResult<PlanDTO> = await this.executionService.addTask(id, {
        label: parsed.data.label,
        description: parsed.data.description,
        priorityScore: parsed.data.priorityScore,
        estimatedDuration: parsed.data.estimatedDuration,
        missionId: parsed.data.missionId,
        planId: id,
        tags: parsed.data.tags,
      });
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** POST /plans/:id/tasks/:taskId/complete */
  async completeTask(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const taskId = c.req.param('taskId') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = completeTaskSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      const result: ServiceResult<PlanDTO> = await this.executionService.completeTask(
        id,
        taskId,
        parsed.data,
      );
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan or task not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  // ── Scheduling & Recovery ──────────────────────────────────────────────

  /** POST /plans/:id/schedule */
  async scheduleTasks(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = scheduleTasksSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      const result: ServiceResult<PlanDTO> = await this.executionService.scheduleTasks(id, {
        taskIds: parsed.data.taskIds,
        scheduledDates: parsed.data.scheduledDates,
      });
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** POST /plans/:id/recover */
  async recoverPlan(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result: ServiceResult<PlanDTO> = await this.executionService.recoverPlan(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'RECOVERY_FAILED', message: result.error ?? 'Recovery failed' },
          },
          500,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  // ── Search & Statistics ──────────────────────────────────────────────

  /** GET /plans */
  async listPlans(c: Context): Promise<Response> {
    try {
      const query = c.req.query();
      const parsed = searchQuery.safeParse(query);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      const { page, limit } = parsed.data;
      const result: ServiceResult<PlanListDTO> = await this.executionService.listPlans(page, limit);
      if (!result.success) {
        return c.json(
          { success: false, error: { code: 'LIST_ERROR', message: result.error ?? 'List failed' } },
          500,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** GET /plans/search */
  async searchPlans(c: Context): Promise<Response> {
    try {
      const query = c.req.query();
      const parsed = searchQuery.safeParse(query);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }
      const { q, status, planningLevel, page, limit } = parsed.data;
      const result: ServiceResult<PlanListDTO> = await this.executionService.searchPlans({
        query: q,
        statuses: status ? [status] : undefined,
        planningLevels: planningLevel ? [planningLevel] : undefined,
        page,
        limit,
      });
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'SEARCH_ERROR', message: result.error ?? 'Search failed' },
          },
          500,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** GET /plans/stats */
  async getStatistics(c: Context): Promise<Response> {
    try {
      const result: ServiceResult<ExecutionStatsDTO> = await this.executionService.getStats();
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'STATS_ERROR', message: result.error ?? 'Stats failed' },
          },
          500,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  /** GET /plans/:id/bottlenecks */
  async getBottlenecks(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result: ServiceResult<BottleneckDTO[]> =
        await this.executionService.analyzeBottlenecks(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Plan not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error: unknown) {
      return this.handleError(error, c);
    }
  }

  // ── Health ───────────────────────────────────────────────────────────

  /** GET /health */
  health(c: Context): Response {
    return c.json({ status: 'healthy', service: 'execution' });
  }
}
