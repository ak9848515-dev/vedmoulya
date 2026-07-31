import { z } from 'zod';

const planningLevelSchema = z.enum(['strategic', 'tactical', 'operational', 'daily']);

export const createPlanSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  planningLevel: planningLevelSchema.optional(),
  priorityScore: z.number().min(0).max(10).optional(),
  goalReferences: z
    .array(z.object({ goalId: z.string(), label: z.string(), description: z.string() }))
    .optional(),
  decisionReferences: z
    .array(z.object({ decisionId: z.string(), title: z.string(), selectedOption: z.string() }))
    .optional(),
  knowledgeNodeIds: z.array(z.string()).optional(),
  memoryIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updatePlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priorityScore: z.number().min(0).max(10).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createMissionSchema = z.object({
  label: z.string().min(1).max(200),
  description: z.string(),
  priorityScore: z.number().min(0).max(10).optional(),
  tags: z.array(z.string()).optional(),
  targetDate: z.string().datetime().optional(),
});

export const createTaskSchema = z.object({
  label: z.string().min(1).max(200),
  description: z.string(),
  priorityScore: z.number().min(0).max(10).optional(),
  estimatedDuration: z.number().min(1).optional(),
  missionId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const addStepSchema = z.object({
  label: z.string().min(1).max(200),
  description: z.string().optional(),
  estimatedDuration: z.number().min(1).optional(),
});

export const scheduleTasksSchema = z.object({
  taskIds: z.array(z.string()).min(1),
  scheduledDates: z.array(z.string().datetime()).min(1).optional(),
});

export const completeTaskSchema = z.object({
  result: z.enum(['success', 'partial', 'failed', 'skipped', 'unknown']),
  description: z.string(),
  qualityScore: z.number().min(0).max(100).optional(),
  duration: z.number().min(0).optional(),
});

export const reportExecutionSchema = z.object({
  result: z.object({
    result: z.enum(['success', 'partial', 'failed', 'skipped', 'unknown']),
    description: z.string(),
    qualityScore: z.number().min(0).max(100).optional(),
    duration: z.number().min(0).optional(),
  }),
});

export const adaptPlanSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priorityScore: z.number().min(0).max(10).optional(),
  planningLevel: planningLevelSchema.optional(),
});

export const pausePlanSchema = z.object({
  reason: z.string().optional(),
});

export const cancelPlanSchema = z.object({
  reason: z.string(),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchQuery = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  planningLevel: planningLevelSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
