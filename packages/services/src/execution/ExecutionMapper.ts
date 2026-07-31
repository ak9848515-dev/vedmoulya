// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Mapper
// Domain-to-DTO mapping for the Execution Intelligence Engine
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionPlan,
  ExecutionMission,
  ExecutionTask,
  ExecutionStep,
} from '@vedmoulya/domain';
import type {
  PlanDTO,
  MissionDTO,
  TaskDTO,
  StepDTO,
  PlanListDTO,
  ExecutionStatsDTO,
  DailyPlanDTO,
  WeeklyReviewDTO,
} from './ExecutionDTO.js';

export const ExecutionMapper = {
  /** Map an ExecutionPlan to PlanDTO */
  toPlanDTO(plan: ExecutionPlan): PlanDTO {
    return {
      id: plan.id,
      title: plan.title,
      description: plan.description,
      planningLevel: plan.planningLevel,
      status: plan.status.toString(),
      priority: { level: plan.priority.level, score: plan.priority.score },
      progress: {
        completed: plan.progress.completed,
        total: plan.progress.total,
        percentage: plan.progress.percentage,
      },
      missions: plan.missions.map((m) => ExecutionMapper.toMissionDTO(m)),
      tasks: plan.tasks.map((t) => ExecutionMapper.toTaskDTO(t)),
      timeline: {
        entryCount: plan.timeline.entryCount,
        lastEvent: plan.timeline.lastEntry?.eventType,
      },
      context: {
        energyLevel: plan.context.energyLevel,
        timeAvailable: plan.context.timeAvailable,
        location: plan.context.location,
      },
      goalReferences: plan.goalReferences.map((g) => ({ goalId: g.goalId, label: g.label })),
      decisionReferences: plan.decisionReferences.map((d) => ({
        decisionId: d.decisionId,
        title: d.title,
      })),
      knowledgeNodeIds: [...plan.knowledgeNodeIds],
      memoryIds: [...plan.memoryIds],
      tags: [...plan.tags],
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      completedAt: plan.completedAt?.toISOString(),
    };
  },

  /** Map an ExecutionMission to MissionDTO */
  toMissionDTO(mission: ExecutionMission): MissionDTO {
    return {
      id: mission.id,
      label: mission.label,
      description: mission.description,
      status: mission.status.toString(),
      priority: { level: mission.priority.level, score: mission.priority.score },
      progress: {
        completed: mission.progress.completed,
        total: mission.progress.total,
        percentage: mission.progress.percentage,
      },
      tasks: mission.tasks.map((t) => ExecutionMapper.toTaskDTO(t)),
      planId: mission.planId,
      targetDate: mission.targetDate?.toISOString(),
      tags: [...mission.tags],
    };
  },

  /** Map an ExecutionTask to TaskDTO */
  toTaskDTO(task: ExecutionTask): TaskDTO {
    return {
      id: task.id,
      label: task.label,
      description: task.description,
      status: task.status.toString(),
      priority: { level: task.priority.level, score: task.priority.score },
      estimatedDuration: task.estimatedDuration,
      progress: {
        completed: task.progress.completed,
        total: task.progress.total,
        percentage: task.progress.percentage,
      },
      missionId: task.missionId,
      planId: task.planId,
      steps: task.steps.map((s) => ExecutionMapper.toStepDTO(s)),
      tags: [...task.tags],
      schedule: task.schedule
        ? {
            scheduledStart: task.schedule.scheduledStart.toISOString(),
            scheduledEnd: task.schedule.scheduledEnd.toISOString(),
            estimatedDuration: task.schedule.estimatedDuration,
          }
        : undefined,
      context: {
        energyLevel: task.context?.energyLevel,
        timeAvailable: task.context?.timeAvailable,
        location: task.context?.location,
      },
    };
  },

  /** Map an ExecutionStep to StepDTO */
  toStepDTO(step: ExecutionStep): StepDTO {
    return {
      id: step.id,
      label: step.label,
      description: step.description,
      status: step.status.toString(),
      estimatedDuration: step.estimatedDuration,
      order: step.order,
    };
  },

  /** Map paginated results to PlanListDTO */
  toListDTO(data: ExecutionPlan[], total: number, page: number, limit: number): PlanListDTO {
    return {
      data: data.map((p) => ExecutionMapper.toPlanDTO(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /** Map stats to ExecutionStatsDTO */
  toStatsDTO(params: {
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    overduePlans: number;
    completionRate: number;
  }): ExecutionStatsDTO {
    return params;
  },

  /** Map daily plan result to DTO */
  toDailyPlanDTO(
    dailyPlan: {
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
    },
    date: string,
  ): DailyPlanDTO {
    return {
      planId: dailyPlan.planId,
      date,
      tasks: dailyPlan.tasks,
      totalEstimatedMinutes: dailyPlan.totalEstimatedMinutes,
      priority: dailyPlan.priority,
    };
  },

  /** Map weekly review to DTO */
  toWeeklyReviewDTO(review: {
    planId: string;
    completedTasks: number;
    totalTasks: number;
    completionRate: number;
    bottlenecks: Array<{ entityId: string; entityType: string; issue: string }>;
    recommendations: string[];
  }): WeeklyReviewDTO {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      ...review,
      weekStart: weekStart.toISOString(),
      weekEnd: now.toISOString(),
    };
  },
};
