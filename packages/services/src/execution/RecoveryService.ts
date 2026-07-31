// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Recovery Service
// Recovery and adaptation operations for Execution
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { ExecutionRepository } from '@vedmoulya/domain';
import type { AdaptPlanDTO, PlanDTO } from './ExecutionDTO.js';
import { ExecutionMapper } from './ExecutionMapper.js';

export class RecoveryService {
  private readonly repository: ExecutionRepository;

  constructor(repository: ExecutionRepository) {
    this.repository = repository;
  }

  /** Pause execution of a plan */
  async pausePlan(
    planId: string,
    reason?: string,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    plan.pause(reason);
    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Resume execution of a plan */
  async resumePlan(planId: string): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    plan.resume();
    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Cancel a plan */
  async cancelPlan(
    planId: string,
    reason: string,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    plan.cancel(reason);
    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Retry a failed task */
  async retryTask(
    planId: string,
    taskId: string,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    // Record retry in plan metadata
    // Full task-level retry requires mutation support on ExecutionTask
    plan.updateMetadata({
      retryAttempt: {
        taskId,
        timestamp: new Date().toISOString(),
      },
    });

    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Recover a failed plan — records recovery attempt and recalculates progress */
  async recoverPlan(
    planId: string,
    reason?: string,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    // Record recovery attempt in plan metadata
    plan.updateMetadata({
      recoveryAttempt: {
        timestamp: new Date().toISOString(),
        reason: reason ?? 'Recovery without specific reason',
      },
    });

    plan.recalculateProgress();
    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Adapt a plan in response to changing circumstances */
  async adaptPlan(
    planId: string,
    dto: AdaptPlanDTO,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    plan.updateMetadata({
      lastAdaptation: {
        trigger: dto.trigger,
        impact: dto.impact,
        timestamp: new Date().toISOString(),
        preferredApproach: dto.preferredApproach,
      },
    });

    plan.recalculateProgress();
    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Activate a plan — move from pending to ready */
  async activatePlan(
    planId: string,
  ): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    plan.activate();
    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }

  /** Start execution of a plan */
  async startPlan(planId: string): Promise<{ success: boolean; data?: PlanDTO; error?: string }> {
    const plan = await this.repository.findById(planId);
    if (!plan) return { success: false, error: `Plan not found: ${planId}` };

    plan.start();
    await this.repository.update(plan);
    return { success: true, data: ExecutionMapper.toPlanDTO(plan) };
  }
}
