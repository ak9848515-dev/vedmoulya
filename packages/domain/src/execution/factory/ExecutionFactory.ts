// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Factory
// Consistent factory for creating execution entities
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import {
  ExecutionPlan,
  type PlanningLevel,
  type GoalReference,
  type DecisionReference,
} from '../entities/ExecutionPlan.js';
import { ExecutionMission } from '../entities/ExecutionMission.js';
import { ExecutionTask } from '../entities/ExecutionTask.js';
import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';
import { ExecutionProgress } from '../value-objects/ExecutionProgress.js';
import { ExecutionTimeline } from '../value-objects/ExecutionTimeline.js';
import { ExecutionContext } from '../value-objects/ExecutionContext.js';

export interface CreatePlanCommand {
  title: string;
  description: string;
  planningLevel?: string;
  priorityScore?: number;
  goalReferences?: GoalReference[];
  decisionReferences?: DecisionReference[];
  knowledgeNodeIds?: string[];
  memoryIds?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateMissionCommand {
  label: string;
  description: string;
  priorityScore?: number;
  tags?: string[];
  planId: string;
  targetDate?: Date;
}

export interface CreateTaskCommand {
  label: string;
  description: string;
  priorityScore?: number;
  estimatedDuration?: number;
  missionId?: string;
  planId: string;
  tags?: string[];
}

export interface FactoryResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ExecutionFactory {
  /** Create a new ExecutionPlan from a command */
  static createPlan(command: CreatePlanCommand): FactoryResult<ExecutionPlan> {
    try {
      const id = `plan_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const validLevels: PlanningLevel[] = ['strategic', 'tactical', 'operational', 'daily'];
      const planningLevel = (validLevels as string[]).includes(command.planningLevel ?? '')
        ? (command.planningLevel as PlanningLevel)
        : 'operational';
      const priority =
        command.priorityScore !== undefined
          ? ExecutionPriority.fromScore(command.priorityScore)
          : ExecutionPriority.medium();

      const plan = ExecutionPlan.create({
        id,
        title: command.title,
        description: command.description,
        planningLevel,
        priority,
        goalReferences: command.goalReferences,
        decisionReferences: command.decisionReferences,
        knowledgeNodeIds: command.knowledgeNodeIds,
        memoryIds: command.memoryIds,
        tags: command.tags,
        metadata: command.metadata,
      });

      return { success: true, data: plan };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Factory error' };
    }
  }

  /** Create a mission */
  static createMission(command: CreateMissionCommand): FactoryResult<ExecutionMission> {
    try {
      const id = `mis_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const priority =
        command.priorityScore !== undefined
          ? ExecutionPriority.fromScore(command.priorityScore)
          : ExecutionPriority.medium();

      const mission = new ExecutionMission({
        id,
        label: command.label,
        description: command.description,
        priority,
        planId: command.planId,
        tags: command.tags,
        targetDate: command.targetDate,
      });

      return { success: true, data: mission };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Factory error' };
    }
  }

  /** Create a task */
  static createTask(command: CreateTaskCommand): FactoryResult<ExecutionTask> {
    try {
      const id = `task_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const priority =
        command.priorityScore !== undefined
          ? ExecutionPriority.fromScore(command.priorityScore)
          : ExecutionPriority.medium();

      const task = new ExecutionTask({
        id,
        label: command.label,
        description: command.description,
        priority,
        estimatedDuration: command.estimatedDuration,
        missionId: command.missionId,
        planId: command.planId,
        tags: command.tags,
      });

      return { success: true, data: task };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Factory error' };
    }
  }

  /** Reconstruct a plan from persisted data — accepts full JSONB payload */
  static reconstructPlan(params: {
    id: string;
    title: string;
    description: string;
    planningLevel?: string;
    status?: string;
    statusReason?: string;
    priorityLevel?: string;
    priorityScore?: number;
    completedCount?: number;
    totalCount?: number;
    missions?: ExecutionMission[];
    tasks?: ExecutionTask[];
    timeline?: ExecutionTimeline;
    context?: ExecutionContext;
    goalReferences?: GoalReference[];
    decisionReferences?: DecisionReference[];
    knowledgeNodeIds?: string[];
    memoryIds?: string[];
    tags?: string[];
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
    completedAt?: Date;
  }): ExecutionPlan {
    const status = params.status
      ? ExecutionStatus.fromStatus(params.status, params.statusReason)
      : ExecutionStatus.pending();

    const priority =
      params.priorityScore !== undefined
        ? ExecutionPriority.fromScore(params.priorityScore)
        : ExecutionPriority.fromLevel(params.priorityLevel ?? 'medium');

    return new ExecutionPlan({
      id: params.id,
      title: params.title,
      description: params.description,
      planningLevel: params.planningLevel as PlanningLevel,
      status,
      priority,
      progress: new ExecutionProgress(params.completedCount ?? 0, params.totalCount ?? 1),
      missions: params.missions,
      tasks: params.tasks,
      timeline: params.timeline,
      context: params.context,
      goalReferences: params.goalReferences,
      decisionReferences: params.decisionReferences,
      knowledgeNodeIds: params.knowledgeNodeIds,
      memoryIds: params.memoryIds,
      tags: params.tags,
      metadata: params.metadata,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      completedAt: params.completedAt,
    });
  }
}
