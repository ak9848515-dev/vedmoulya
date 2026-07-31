// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Application Service
// Core orchestration service for all execution operations
// BLD-009 — Execution Intelligence Engine
// BLD-005 — AI Orchestrator Integration (use only BLD-005 contracts)
// BLD-006 — Knowledge Graph Integration (read only)
// BLD-007 — Memory Engine Integration (store execution history)
// BLD-008 — Decision Engine Integration (consume only)
// ──────────────────────────────────────────────────────────────────

import type { ExecutionRepository } from '@vedmoulya/domain';
import { ExecutionDomainService } from '@vedmoulya/domain';
import { PlanningService } from './PlanningService.js';
import { SchedulingService } from './SchedulingService.js';
import { ProgressService } from './ProgressService.js';
import { MonitoringService } from './MonitoringService.js';
import { RecoveryService } from './RecoveryService.js';
import type {
  CreatePlanDTO,
  CreateMissionDTO,
  CreateTaskDTO,
  AddStepDTO,
  UpdatePlanDTO,
  CompleteTaskDTO,
  ReportExecutionDTO,
  AdaptPlanDTO,
  PlanDTO,
  PlanListDTO,
  DailyPlanDTO,
  WeeklyReviewDTO,
  MonthlyReviewDTO,
  ExecutionStatsDTO,
  BottleneckDTO,
  DependencyGraphDTO,
} from './ExecutionDTO.js';
import type { ExecutionQueryDTO } from './ExecutionDTO.js';
import { ExecutionMapper } from './ExecutionMapper.js';

export class ExecutionApplicationService {
  private readonly repository: ExecutionRepository;
  private readonly domainService: ExecutionDomainService;
  public readonly planning: PlanningService;
  public readonly scheduling: SchedulingService;
  public readonly progress: ProgressService;
  public readonly monitoring: MonitoringService;
  public readonly recovery: RecoveryService;

  constructor(repository: ExecutionRepository) {
    this.repository = repository;
    this.domainService = new ExecutionDomainService(repository);
    this.planning = new PlanningService(repository);
    this.scheduling = new SchedulingService(repository);
    this.progress = new ProgressService(repository);
    this.monitoring = new MonitoringService(repository);
    this.recovery = new RecoveryService(repository);
  }

  // ── CRUD Operations ─────────────────────────────────────────────────────

  /** Create a new plan */
  async createPlan(
    dto: CreatePlanDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.planning.createPlan(dto);
  }

  /** Get a plan by ID */
  async getPlan(id: string): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.planning.getPlan(id);
  }

  /** List plans with pagination */
  async listPlans(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ success: boolean; data?: PlanListDTO; error?: string }> {
    return this.planning.listPlans(page, limit);
  }

  /** Search plans */
  async searchPlans(
    params: ExecutionQueryDTO,
  ): Promise<{ success: boolean; data?: PlanListDTO; error?: string }> {
    try {
      const searchParams = {
        query: params.query ?? '',
        planningLevels: params.planningLevels,
        statuses: params.statuses,
        tags: params.tags,
        goalId: params.goalId,
        decisionId: params.decisionId,
      } as import('@vedmoulya/domain').ExecutionSearchParams;
      const pagination = { page: params.page ?? 1, limit: params.limit ?? 20 };
      const result = await this.repository.search(searchParams, pagination);
      return {
        success: true,
        data: ExecutionMapper.toListDTO(
          result.data,
          result.total,
          pagination.page,
          pagination.limit,
        ),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Search error' };
    }
  }

  // ── Planning Operations ─────────────────────────────────────────────────

  /** Create a mission */
  async createMission(
    planId: string,
    dto: CreateMissionDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.planning.createMission(planId, dto);
  }

  /** Create a task */
  async createTask(
    planId: string,
    dto: CreateTaskDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.planning.createTask(planId, dto);
  }

  /** Add a step to a task */
  async addStep(
    planId: string,
    taskId: string,
    dto: AddStepDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.planning.addStep(planId, taskId, dto);
  }

  /** Generate a daily plan */
  async generateDailyPlan(
    planId: string,
    timeAvailableMinutes?: number,
  ): Promise<{ success: boolean; data?: DailyPlanDTO; error?: string }> {
    return this.planning.generateDailyPlan(planId, timeAvailableMinutes);
  }

  /** Weekly review */
  async weeklyReview(
    planId: string,
  ): Promise<{ success: boolean; data?: WeeklyReviewDTO; error?: string }> {
    return this.planning.weeklyReview(planId);
  }

  // ── Scheduling Operations ───────────────────────────────────────────────

  /** Schedule a task */
  async scheduleTask(
    planId: string,
    taskId: string,
    start: Date,
    end: Date,
    duration: number,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.scheduling.scheduleTask(planId, taskId, start, end, duration);
  }

  /** Get dependency graph */
  async getDependencyGraph(
    planId: string,
  ): Promise<{ success: boolean; data?: DependencyGraphDTO; error?: string }> {
    return this.scheduling.getDependencyGraph(planId);
  }

  /** Resolve dependencies */
  async resolveDependencies(
    planId: string,
  ): Promise<{ success: boolean; data?: DependencyGraphDTO; error?: string }> {
    return this.scheduling.resolveDependencies(planId);
  }

  // ── Progress Operations ─────────────────────────────────────────────────

  /** Track progress */
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
    return this.progress.trackProgress(planId);
  }

  /** Complete a task */
  async completeTask(
    planId: string,
    taskId: string,
    dto: CompleteTaskDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.progress.completeTask(planId, taskId, dto);
  }

  /** Report execution */
  async reportExecution(
    planId: string,
    dto: ReportExecutionDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.progress.reportExecution(planId, dto);
  }

  // ── Monitoring Operations ───────────────────────────────────────────────

  /** Analyze bottlenecks */
  async analyzeBottlenecks(
    planId: string,
  ): Promise<{ success: boolean; data?: BottleneckDTO[]; error?: string }> {
    return this.monitoring.analyzeBottlenecks(planId);
  }

  /** Get execution stats */
  async getStats(): Promise<{ success: boolean; data?: ExecutionStatsDTO; error?: string }> {
    return this.monitoring.getStats();
  }

  /** Get at-risk plans */
  async getAtRiskPlans(): Promise<{
    success: boolean;
    data?: Array<{ id: string; title: string; reason: string }>;
    error?: string;
  }> {
    return this.monitoring.getAtRiskPlans();
  }

  // ── Recovery Operations ─────────────────────────────────────────────────

  /** Activate a plan */
  async activatePlan(
    planId: string,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.recovery.activatePlan(planId);
  }

  /** Start a plan */
  async startPlan(planId: string): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.recovery.startPlan(planId);
  }

  /** Pause a plan */
  async pausePlan(
    planId: string,
    reason?: string,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.recovery.pausePlan(planId, reason);
  }

  /** Resume a plan */
  async resumePlan(planId: string): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.recovery.resumePlan(planId);
  }

  /** Cancel a plan */
  async cancelPlan(
    planId: string,
    reason: string,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.recovery.cancelPlan(planId, reason);
  }

  /** Adapt a plan */
  async adaptPlan(
    planId: string,
    dto: AdaptPlanDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.recovery.adaptPlan(planId, dto);
  }

  /** Monthly review */
  async monthlyReview(
    planId: string,
  ): Promise<{ success: boolean; data?: MonthlyReviewDTO; error?: string }> {
    try {
      const plan = await this.repository.findById(planId);
      if (!plan) return { success: false, error: `Plan not found: ${planId}` };
      const result = this.domainService.monthlyReview(plan);
      if (!result.success) {
        return { success: false, error: result.error ?? 'Monthly review failed' };
      }
      return { success: true, data: result.data as unknown as MonthlyReviewDTO };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Monthly review error',
      };
    }
  }

  // ── Compatibility Wrappers (Public API) ─────────────────────────────────

  /** Update a plan (alias for adaptPlan) */
  async updatePlan(
    id: string,
    dto: UpdatePlanDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.adaptPlan(id, {
      trigger: 'manual_update',
      impact: JSON.stringify(dto),
      preferredApproach: undefined,
    });
  }

  /** Complete a plan (alias for reportExecution) */
  async completePlan(
    id: string,
    dto: ReportExecutionDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.reportExecution(id, dto);
  }

  /** Add a mission to a plan (alias for createMission) */
  async addMission(
    planId: string,
    dto: CreateMissionDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.createMission(planId, dto);
  }

  /** Add a task to a plan (alias for createTask) */
  async addTask(
    planId: string,
    dto: CreateTaskDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.createTask(planId, dto);
  }

  /** Schedule multiple tasks (alias for scheduleTask — schedules one at a time) */
  async scheduleTasks(
    planId: string,
    schedule: { taskIds: string[]; scheduledDates?: string[] },
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    for (const taskId of schedule.taskIds) {
      const result = await this.scheduleTask(planId, taskId, new Date(), new Date(), 30);
      if (!result.success) return result;
    }
    return this.getPlan(planId);
  }

  /** Recover a plan (alias for resumePlan) */
  async recoverPlan(planId: string): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    return this.resumePlan(planId);
  }
}
