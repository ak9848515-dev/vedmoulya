// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Planning Service
// Planning operations for the Execution Intelligence Engine
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { ExecutionFactory } from '@vedmoulya/domain';
import type { ExecutionRepository } from '@vedmoulya/domain';
import { ExecutionDomainService } from '@vedmoulya/domain';
import type {
  CreatePlanDTO,
  CreateMissionDTO,
  CreateTaskDTO,
  AddStepDTO,
  DailyPlanDTO,
} from './ExecutionDTO.js';
import { ExecutionMapper } from './ExecutionMapper.js';
import type { PlanDTO, PlanListDTO, WeeklyReviewDTO } from './ExecutionDTO.js';

export class PlanningService {
  private readonly repository: ExecutionRepository;
  private readonly domainService: ExecutionDomainService;

  constructor(repository: ExecutionRepository) {
    this.repository = repository;
    this.domainService = new ExecutionDomainService(repository);
  }

  /** Create a new plan */
  async createPlan(
    dto: CreatePlanDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const result = ExecutionFactory.createPlan({
      title: dto.title,
      description: dto.description,
      planningLevel: dto.planningLevel,
      priorityScore: dto.priorityScore,
      goalReferences: dto.goalReferences,
      decisionReferences: dto.decisionReferences,
      knowledgeNodeIds: dto.knowledgeNodeIds,
      memoryIds: dto.memoryIds,
      tags: dto.tags,
      metadata: dto.metadata,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to create plan' };
    }

    await this.repository.save(result.data);
    return { success: true, data: ExecutionMapper.toPlanDTO(result.data) };
  }

  /** Get a plan by ID */
  async getPlan(id: string): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(id);
    if (!plan) return { success: false, error: `Plan not found: ${id}` };
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** List plans with pagination */
  async listPlans(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ success: boolean; data?: PlanListDTO; error?: string }> {
    try {
      const total = await this.repository.count();
      const result = await this.repository.search({ query: '' }, { page, limit });
      return {
        success: true,
        data: ExecutionMapper.toListDTO(result.data, total, page, limit),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'List error' };
    }
  }

  /** Create a mission within a plan */
  async createMission(
    planId: string,
    dto: CreateMissionDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    const result = ExecutionFactory.createMission({
      label: dto.label,
      description: dto.description,
      priorityScore: dto.priorityScore,
      tags: dto.tags,
      planId,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to create mission' };
    }

    plan.addMission(result.data);
    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Create a task within a plan */
  async createTask(
    planId: string,
    dto: CreateTaskDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    const result = ExecutionFactory.createTask({
      label: dto.label,
      description: dto.description,
      priorityScore: dto.priorityScore,
      estimatedDuration: dto.estimatedDuration,
      missionId: dto.missionId,
      planId,
      tags: dto.tags,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to create task' };
    }

    plan.addTask(result.data);

    // If a mission is specified, the mission reference is stored on the task
    // ExecutionPlan.addTask already sets the task reference.

    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Add a step to a task */
  async addStep(
    planId: string,
    taskId: string,
    dto: AddStepDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    const task = plan.tasks.find((t) => t.id === taskId);
    if (!task) return { success: false, error: `Task not found: ${taskId}` };

    // Note: Steps are currently tracked via the plan's task array.
    // Direct step manipulation on ExecutionTask requires a mutable method
    // on the task or plan entity. Adding steps is tracked through task metadata.
    plan.updateMetadata({
      stepAdded: { taskId, label: dto.label, timestamp: new Date().toISOString() },
    });

    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Generate a daily plan */
  async generateDailyPlan(
    planId: string,
    timeAvailableMinutes: number = 480,
  ): Promise<{ success: boolean; data?: DailyPlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    const result = this.domainService.generateDailyPlan(plan, timeAvailableMinutes);
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Daily plan generation failed' };
    }

    return {
      success: true,
      data: ExecutionMapper.toDailyPlanDTO(result.data, new Date().toISOString()),
    };
  }

  /** Generate weekly review */
  async weeklyReview(
    planId: string,
  ): Promise<{ success: boolean; data?: WeeklyReviewDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    const result = this.domainService.weeklyReview(plan);
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Weekly review failed' };
    }

    return { success: true, data: ExecutionMapper.toWeeklyReviewDTO(result.data) };
  }
}
