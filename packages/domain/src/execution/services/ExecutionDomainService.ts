// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Domain Service
// Domain operations for planning, scheduling, and monitoring
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { ExecutionRepository } from '../repository/ExecutionRepository.js';
import type { ExecutionPlan } from '../entities/ExecutionPlan.js';

export interface DomainResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DailyPlanResult {
  planId: string;
  tasks: Array<{
    taskId: string;
    label: string;
    estimatedDuration: number;
    priority: string;
    missionLabel?: string;
  }>;
  totalEstimatedMinutes: number;
  priority: string;
}

export interface WeeklyReviewResult {
  planId: string;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  bottlenecks: Array<{ entityId: string; entityType: string; issue: string }>;
  recommendations: string[];
}

export interface MonthlyReviewResult extends WeeklyReviewResult {
  completedMissions: number;
  totalMissions: number;
  timeVariance: number;
  streak: number;
}

export class ExecutionDomainService {
  private readonly repository: ExecutionRepository;

  constructor(repository: ExecutionRepository) {
    this.repository = repository;
  }

  /** Generate a daily plan from the active plan */
  generateDailyPlan(
    plan: ExecutionPlan,
    timeAvailableMinutes: number,
  ): DomainResult<DailyPlanResult> {
    try {
      const availableTasks = plan.tasks
        .filter((t) => t.canStart)
        .sort((a, b) => b.priority.score - a.priority.score);

      const tasks = availableTasks.slice(0, 5).map((t) => ({
        taskId: t.id,
        label: t.label,
        estimatedDuration: t.estimatedDuration,
        priority: t.priority.level,
        missionLabel: t.missionId
          ? plan.missions.find((m) => m.id === t.missionId)?.label
          : undefined,
      }));

      const totalEstimatedMinutes = tasks.reduce((sum, t) => sum + t.estimatedDuration, 0);
      const adjustedTasks =
        totalEstimatedMinutes > timeAvailableMinutes
          ? tasks.slice(0, Math.max(1, tasks.length - 1))
          : tasks;

      return {
        success: true,
        data: {
          planId: plan.id,
          tasks: adjustedTasks,
          totalEstimatedMinutes: adjustedTasks.reduce((sum, t) => sum + t.estimatedDuration, 0),
          priority: plan.priority.level,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Daily plan error' };
    }
  }

  /** Generate weekly review */
  weeklyReview(plan: ExecutionPlan): DomainResult<WeeklyReviewResult> {
    try {
      const bottlenecks = plan.analyzeBottlenecks();
      const recommendations: string[] = [];

      if (bottlenecks.length > 0) {
        recommendations.push(`Resolve ${String(bottlenecks.length)} blocking dependencies`);
      }
      if (plan.progress.percentage < 30 && plan.totalTasks > 5) {
        recommendations.push('Focus on completing quick wins to build momentum');
      }
      if (plan.progress.percentage > 70) {
        recommendations.push('Plan for completion and review phase');
      }

      return {
        success: true,
        data: {
          planId: plan.id,
          completedTasks: plan.completedTasks,
          totalTasks: plan.totalTasks,
          completionRate: plan.progress.percentage,
          bottlenecks,
          recommendations,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Weekly review error',
      };
    }
  }

  /** Generate monthly review */
  monthlyReview(plan: ExecutionPlan): DomainResult<MonthlyReviewResult> {
    try {
      const weekly = this.weeklyReview(plan);
      if (!weekly.success || !weekly.data) {
        return { success: false, error: weekly.error };
      }

      return {
        success: true,
        data: {
          ...weekly.data,
          completedMissions: plan.completedMissions,
          totalMissions: plan.totalMissions,
          timeVariance: 0,
          streak: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Monthly review error',
      };
    }
  }

  /** Calculate execution statistics */
  async calculateStats(_userId: string): Promise<
    DomainResult<{
      totalPlans: number;
      activePlans: number;
      completedPlans: number;
      overduePlans: number;
      completionRate: number;
    }>
  > {
    try {
      const [totalPlans, activePlans, completedPlans, overduePlans] = await Promise.all([
        this.repository.count(),
        this.repository.countActive(),
        this.findCompletedCount(),
        this.repository.countOverdue(),
      ]);

      const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

      return {
        success: true,
        data: { totalPlans, activePlans, completedPlans, overduePlans, completionRate },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Stats error' };
    }
  }

  private async findCompletedCount(): Promise<number> {
    try {
      const byStatus = await this.repository.countByStatus();
      return byStatus['completed'] ?? 0;
    } catch {
      return 0;
    }
  }
}
