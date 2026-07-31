import { z } from 'zod';
import { initTRPC } from '@trpc/server';
import type { ExecutionApplicationService } from '@vedmoulya/services';
import {
  createPlanSchema,
  updatePlanSchema,
  createMissionSchema,
  createTaskSchema,
  completeTaskSchema,
  reportExecutionSchema,
  cancelPlanSchema,
} from '../validation/ExecutionSchemas.js';

export function createExecutionTrpcRouter(executionService: ExecutionApplicationService): object {
  const t = initTRPC.create();

  return t.router({
    // Plan CRUD
    createPlan: t.procedure.input(createPlanSchema).mutation(async ({ input }) => {
      const result = await executionService.createPlan(input);
      return { success: true as const, data: result };
    }),

    getPlan: t.procedure.input(z.string()).query(async ({ input }) => {
      const result = await executionService.getPlan(input);
      return { success: true as const, data: result };
    }),

    updatePlan: t.procedure
      .input(z.object({ id: z.string(), data: updatePlanSchema }))
      .mutation(async ({ input }) => {
        const result = await executionService.updatePlan(input.id, input.data);
        return { success: true as const, data: result };
      }),

    // Lifecycle
    activatePlan: t.procedure.input(z.string()).mutation(async ({ input }) => {
      const result = await executionService.activatePlan(input);
      return { success: true as const, data: result };
    }),

    startPlan: t.procedure.input(z.string()).mutation(async ({ input }) => {
      const result = await executionService.startPlan(input);
      return { success: true as const, data: result };
    }),

    pausePlan: t.procedure
      .input(z.object({ id: z.string(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        const result = await executionService.pausePlan(input.id, input.reason);
        return { success: true as const, data: result };
      }),

    resumePlan: t.procedure.input(z.string()).mutation(async ({ input }) => {
      const result = await executionService.resumePlan(input);
      return { success: true as const, data: result };
    }),

    completePlan: t.procedure
      .input(z.object({ id: z.string(), data: reportExecutionSchema }))
      .mutation(async ({ input }) => {
        const result = await executionService.completePlan(input.id, {
          taskId: input.id,
          result: input.data.result.result,
          description: input.data.result.description,
          actualDuration: input.data.result.duration,
          quality: input.data.result.qualityScore,
        });
        return { success: true as const, data: result };
      }),

    cancelPlan: t.procedure
      .input(z.object({ id: z.string(), data: cancelPlanSchema }))
      .mutation(async ({ input }) => {
        const result = await executionService.cancelPlan(input.id, input.data.reason);
        return { success: true as const, data: result };
      }),

    // Missions & Tasks
    addMission: t.procedure
      .input(z.object({ id: z.string(), data: createMissionSchema }))
      .mutation(async ({ input }) => {
        const result = await executionService.addMission(input.id, {
          label: input.data.label,
          description: input.data.description,
          priorityScore: input.data.priorityScore,
          tags: input.data.tags,
          planId: input.id,
          targetDate: input.data.targetDate,
        });
        return { success: true as const, data: result };
      }),

    addTask: t.procedure
      .input(z.object({ id: z.string(), data: createTaskSchema }))
      .mutation(async ({ input }) => {
        const result = await executionService.addTask(input.id, {
          label: input.data.label,
          description: input.data.description,
          priorityScore: input.data.priorityScore,
          estimatedDuration: input.data.estimatedDuration,
          missionId: input.data.missionId,
          planId: input.id,
          tags: input.data.tags,
        });
        return { success: true as const, data: result };
      }),

    completeTask: t.procedure
      .input(z.object({ id: z.string(), taskId: z.string(), data: completeTaskSchema }))
      .mutation(async ({ input }) => {
        const result = await executionService.completeTask(input.id, input.taskId, input.data);
        return { success: true as const, data: result };
      }),

    // Analysis
    analyzeBottlenecks: t.procedure.input(z.string()).query(async ({ input }) => {
      const result = await executionService.analyzeBottlenecks(input);
      return { success: true as const, data: result };
    }),

    // List & Search
    listPlans: t.procedure
      .input(
        z.object({
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        }),
      )
      .query(async ({ input }) => {
        const result = await executionService.listPlans(input.page, input.limit);
        return { success: true as const, data: result };
      }),

    // Statistics
    getStats: t.procedure.query(async () => {
      const result = await executionService.getStats();
      return { success: true as const, data: result };
    }),
  });
}
