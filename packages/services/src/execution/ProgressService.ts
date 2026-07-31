// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Progress Service
// Progress tracking for the Execution Intelligence Engine
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { ExecutionResult } from '@vedmoulya/domain';
import type { ExecutionRepository } from '@vedmoulya/domain';
import type {
  CompleteTaskDTO,
  ReportExecutionDTO,
  PlanDTO,
  ExecutionStatsDTO,
} from './ExecutionDTO.js';
import { ExecutionMapper } from './ExecutionMapper.js';

export class ProgressService {
  private readonly repository: ExecutionRepository;

  constructor(repository: ExecutionRepository) {
    this.repository = repository;
  }

  /** Track progress for a plan */
  async trackProgress(planId: string): Promise<{
    success: boolean;
    data?: {
      overall: { completed: number; total: number; percentage: number };
      missions: Array<{
        id: string;
        progress: { completed: number; total: number; percentage: number };
      }>;
    };
    error?: string;
  }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    const progress = plan.trackProgress();
    return {
      success: true,
      data: {
        overall: {
          completed: progress.overall.completed,
          total: progress.overall.total,
          percentage: progress.overall.percentage,
        },
        missions: progress.missions.map((m) => ({
          id: m.id,
          progress: {
            completed: m.progress.completed,
            total: m.progress.total,
            percentage: m.progress.percentage,
          },
        })),
      },
    };
  }

  /** Complete a task with result */
  async completeTask(
    planId: string,
    taskId: string,
    dto: CompleteTaskDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    const result = new ExecutionResult({
      value: dto.result,
      description: dto.description,
      actualDuration: dto.actualDuration,
      quality: dto.quality,
      notes: dto.notes,
    });

    plan.completeTask(taskId, result);
    plan.recalculateProgress();
    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Report execution of a task */
  async reportExecution(
    planId: string,
    dto: ReportExecutionDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    const result = new ExecutionResult({
      value: dto.result,
      description: dto.description,
      actualDuration: dto.actualDuration,
      quality: dto.quality,
      notes: [...(dto.notes ?? []), ...(dto.obstacles ?? []).map((o) => `Obstacle: ${o}`)],
    });

    plan.completeTask(dto.taskId, result);
    plan.recalculateProgress();
    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Calculate execution statistics */
  async getStats(): Promise<{ success: boolean; data?: ExecutionStatsDTO; error?: string }> {
    try {
      const totalPlans = await this.repository.count();
      const activePlans = await this.repository.countActive();
      const overduePlans = await this.repository.countOverdue();
      const byStatus = await this.repository.countByStatus();
      const completedPlans = byStatus['completed'] ?? 0;
      const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

      return {
        success: true,
        data: ExecutionMapper.toStatsDTO({
          totalPlans,
          activePlans,
          completedPlans,
          overduePlans,
          completionRate,
        }),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Stats error' };
    }
  }
}
