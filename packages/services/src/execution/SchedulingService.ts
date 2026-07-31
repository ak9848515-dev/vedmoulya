// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Scheduling Service
// Scheduling and calendar operations for Execution
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { ExecutionRepository } from '@vedmoulya/domain';
import type { PlanDTO, DependencyGraphDTO } from './ExecutionDTO.js';
import { ExecutionMapper } from './ExecutionMapper.js';

export class SchedulingService {
  private readonly repository: ExecutionRepository;

  constructor(repository: ExecutionRepository) {
    this.repository = repository;
  }

  /** Schedule a task within a plan */
  async scheduleTask(
    planId: string,
    taskId: string,
    scheduledStart: Date,
    scheduledEnd: Date,
    duration: number,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    // Record scheduling info in plan metadata
    // Full task-level scheduling requires adding mutation support to ExecutionTask
    plan.updateMetadata({
      scheduling: {
        taskId,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        duration,
        timestamp: new Date().toISOString(),
      },
    });

    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Get dependency graph for a plan */
  async getDependencyGraph(
    planId: string,
  ): Promise<{ success: boolean; data?: DependencyGraphDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    return {
      success: true,
      data: {
        tasks: plan.tasks.map((t) => ({
          taskId: t.id,
          label: t.label,
          status: t.status.toString(),
          dependencies: t.dependencies.map((d) => d.targetId),
        })),
      },
    };
  }

  /** Resolve dependencies within a plan */
  async resolveDependencies(
    planId: string,
  ): Promise<{ success: boolean; data?: DependencyGraphDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    plan.resolveDependencies();
    return {
      success: true,
      data: {
        tasks: plan.tasks.map((t) => ({
          taskId: t.id,
          label: t.label,
          status: t.status.toString(),
          dependencies: t.dependencies.filter((d) => d.isHard).map((d) => d.targetId),
        })),
      },
    };
  }

  /** Get the schedule for today */
  async getTodaySchedule(planId: string): Promise<{
    success: boolean;
    data?: Array<{ taskId: string; label: string; status: string }>;
    error?: string;
  }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    const todayTasks = plan.tasks.filter((t) => {
      if (!t.schedule) return false;
      const startDate = t.schedule.scheduledStart;
      const today = new Date();
      return startDate.toDateString() === today.toDateString();
    });

    return {
      success: true,
      data: todayTasks.map((t) => ({
        taskId: t.id,
        label: t.label,
        status: t.status.toString(),
      })),
    };
  }
}
