// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Application Service
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Facade over the Enterprise Brain domain services. Exposes the API
// surface: decide a goal (the full 11-step pipeline), list/get plans
// and decisions, the timeline + DecisionHistory feed, decision metrics,
// the Enterprise Brain Dashboard, and the human-approval workflow —
// approve/reject a decision, approve a plan, and hand the approved
// plan to the Execution Orchestrator. Re-deciding a goal supersedes
// the previous plan (versioned + audited).
//
// The Brain DECIDES and never executes: the only "handoff" is the
// approved plan being marked handed_off for the orchestrator, gated
// on explicit human approval.
// ──────────────────────────────────────────────────────────────────

import type { PaginationParams } from '@vedmoulya/core';
import type { BrainEngines } from '../contracts/brain-engines.js';
import type { BrainRepository } from '../domain/repository/BrainRepository.js';
import { BrainPlanService } from '../domain/services/BrainPlanService.js';
import { BrainMetricsService } from '../domain/services/BrainMetricsService.js';
import {
  BrainDecisionService,
  type DecisionServiceOptions,
} from '../domain/services/BrainDecisionService.js';
import {
  canTransitionDecision,
  canTransitionPlan,
  entityRule,
} from '../domain/rules/BrainDecisionRules.js';
import { generateAuditId } from '../domain/value-objects/BrainDecisionId.js';
import type {
  BrainDecision,
  BrainDecisionPlan,
  BrainDecisionStatus,
} from '../types/brain-types.js';
import { BrainMapper } from './BrainMapper.js';
import type {
  BrainDashboardDTO,
  BrainDecisionActionDTO,
  BrainDecisionDTO,
  BrainDecisionMetricsDTO,
  BrainHistoryDTO,
  BrainListDecisionsQueryDTO,
  BrainPlanActionDTO,
  BrainPlanDTO,
  BrainTimelineDTO,
  DecideGoalDTO,
} from './BrainDTO.js';

export interface BrainResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** Engine consultation errors tolerated during the pipeline run. */
  errors?: string[];
}

export interface BrainApplicationOptions {
  decision?: DecisionServiceOptions;
}

const TIMELINE_DEFAULT_LIMIT = 50;

export class BrainApplicationService {
  private readonly planService: BrainPlanService;
  private readonly metrics: BrainMetricsService;
  readonly decisionService: BrainDecisionService;

  constructor(
    private readonly repository: BrainRepository,
    private readonly engines: BrainEngines,
    options: BrainApplicationOptions = {},
  ) {
    this.decisionService = new BrainDecisionService(options.decision);
    this.planService = new BrainPlanService(this.decisionService);
    this.metrics = new BrainMetricsService();
  }

  // ── Decide a goal (the decision pipeline) ─────────────────────────────────

  async decideGoal(dto: DecideGoalDTO): Promise<BrainResult<BrainPlanDTO>> {
    const goalRule = entityRule(dto.goalId, 'goalId');
    if (!goalRule.passed) {
      return { success: false, error: goalRule.message ?? 'goalId is required' };
    }
    if (dto.budgetUsd !== undefined && (Number.isNaN(dto.budgetUsd) || dto.budgetUsd < 0)) {
      return { success: false, error: 'budgetUsd must be >= 0' };
    }
    const actor = dto.actor ?? 'enterprise-brain';

    const { plan, errors } = await this.planService.buildPlan(dto.goalId, this.engines, {
      budgetUsd: dto.budgetUsd,
      actor,
    });

    // Supersede any live previous plans for the same goal (audited).
    const previousPlans = await this.repository.listPlans(dto.goalId);
    for (const previous of previousPlans) {
      if (
        previous.status === 'proposed' ||
        previous.status === 'approved' ||
        previous.status === 'handed_off'
      ) {
        await this.supersedePlan(previous, actor);
      }
    }

    await this.repository.savePlan(plan);
    for (const decision of plan.decisions) {
      await this.repository.saveDecision(decision);
    }
    return { success: true, data: BrainMapper.planToDTO(plan), errors };
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  async getPlan(planId: string): Promise<BrainResult<BrainPlanDTO>> {
    const plan = await this.repository.findPlanById(planId);
    if (!plan) return { success: false, error: `Decision plan not found: ${planId}` };
    return { success: true, data: BrainMapper.planToDTO(plan) };
  }

  async listPlans(goalId?: string): Promise<BrainResult<BrainPlanDTO[]>> {
    const plans = await this.repository.listPlans(goalId);
    return { success: true, data: plans.map((p) => BrainMapper.planToDTO(p)) };
  }

  // ── Decisions ─────────────────────────────────────────────────────────────

  async listDecisions(
    dto: BrainListDecisionsQueryDTO = {},
  ): Promise<BrainResult<{ items: BrainDecisionDTO[]; total: number }>> {
    const pagination: PaginationParams = {
      page: Math.max(1, dto.page ?? 1),
      limit: Math.min(200, Math.max(1, dto.limit ?? 50)),
    };
    const result = await this.repository.listDecisions(
      { type: dto.type, status: dto.status, goalId: dto.goalId },
      pagination,
    );
    return {
      success: true,
      data: { items: result.data.map((d) => BrainMapper.decisionToDTO(d)), total: result.total },
    };
  }

  async getDecision(decisionId: string): Promise<BrainResult<BrainDecisionDTO>> {
    const decision = await this.repository.findDecisionById(decisionId);
    if (!decision) return { success: false, error: `Decision not found: ${decisionId}` };
    return { success: true, data: BrainMapper.decisionToDTO(decision) };
  }

  async getTimeline(dto: BrainTimelineDTO = {}): Promise<BrainResult<BrainDecisionDTO[]>> {
    const limit = Math.max(1, Math.min(200, dto.limit ?? TIMELINE_DEFAULT_LIMIT));
    const decisions = await this.repository.listAllDecisions();
    const recent = [...decisions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
    return { success: true, data: recent.map((d) => BrainMapper.decisionToDTO(d)) };
  }

  async getHistory(): Promise<BrainResult<BrainHistoryDTO[]>> {
    const decisions = await this.repository.listAllDecisions();
    return { success: true, data: BrainMapper.historyToDTO(decisions) };
  }

  // ── Metrics / Dashboard ───────────────────────────────────────────────────

  async getMetrics(): Promise<BrainResult<BrainDecisionMetricsDTO>> {
    const [decisions, plans] = await Promise.all([
      this.repository.listAllDecisions(),
      this.repository.listPlans(),
    ]);
    return {
      success: true,
      data: BrainMapper.metricsToDTO(this.metrics.aggregate(decisions, plans)),
    };
  }

  async getDashboard(): Promise<BrainResult<BrainDashboardDTO>> {
    const [decisions, plans] = await Promise.all([
      this.repository.listAllDecisions(),
      this.repository.listPlans(),
    ]);
    return {
      success: true,
      data: BrainMapper.dashboardToDTO({
        metrics: this.metrics.aggregate(decisions, plans),
        decisions,
        plans,
      }),
    };
  }

  // ── Human-approval workflow ───────────────────────────────────────────────

  async approveDecision(dto: BrainDecisionActionDTO): Promise<BrainResult<BrainDecisionDTO>> {
    return this.transitionDecision(dto, 'approved');
  }

  async rejectDecision(dto: BrainDecisionActionDTO): Promise<BrainResult<BrainDecisionDTO>> {
    return this.transitionDecision(dto, 'rejected');
  }

  async approvePlan(dto: BrainPlanActionDTO): Promise<BrainResult<BrainPlanDTO>> {
    const plan = await this.repository.findPlanById(dto.planId);
    if (!plan) return { success: false, error: `Decision plan not found: ${dto.planId}` };
    const actor = this.requireActor(dto.actor);
    if (!actor) return { success: false, error: 'actor is required for plan decisions' };

    const gate = canTransitionPlan(plan.status, 'approved');
    if (!gate.allowed) return { success: false, error: gate.message ?? 'Plan cannot be approved' };

    // A plan with a vetoed decision can never be approved as a whole: approval
    // means the human accepts every choice. The remedy for a rejected decision
    // is to re-decide the goal (supersedes this plan) or reject the plan.
    const decisions = await this.repository.listDecisionsByPlan(plan.planId);
    const vetoed = decisions.find((d) => d.status === 'rejected');
    if (vetoed) {
      return {
        success: false,
        error: `Plan cannot be approved: decision ${vetoed.decisionId} (${vetoed.type}) was rejected. Re-decide the goal or reject the plan.`,
      };
    }

    const updated = this.bumpPlan(plan, 'approved', actor, dto.note);
    await this.repository.savePlan(updated);

    // Approve every still-proposed decision of the plan.
    for (const decision of decisions) {
      if (decision.status === 'proposed') {
        await this.repository.saveDecision(
          this.bumpDecision(decision, 'approved', actor, dto.note),
        );
      }
    }
    return { success: true, data: BrainMapper.planToDTO(updated) };
  }

  async rejectPlan(dto: BrainPlanActionDTO): Promise<BrainResult<BrainPlanDTO>> {
    const plan = await this.repository.findPlanById(dto.planId);
    if (!plan) return { success: false, error: `Decision plan not found: ${dto.planId}` };
    const actor = this.requireActor(dto.actor);
    if (!actor) return { success: false, error: 'actor is required for plan decisions' };

    const gate = canTransitionPlan(plan.status, 'rejected');
    if (!gate.allowed) return { success: false, error: gate.message ?? 'Plan cannot be rejected' };

    const updated = this.bumpPlan(plan, 'rejected', actor, dto.note);
    await this.repository.savePlan(updated);

    const decisions = await this.repository.listDecisionsByPlan(plan.planId);
    for (const decision of decisions) {
      if (decision.status === 'proposed') {
        await this.repository.saveDecision(
          this.bumpDecision(decision, 'rejected', actor, dto.note),
        );
      }
    }
    return { success: true, data: BrainMapper.planToDTO(updated) };
  }

  /**
   * Pass an approved plan to the Execution Orchestrator. The Brain never
   * executes — it only marks the approved plan handed_off (and its
   * approved decisions), which is the orchestrator's cue to run.
   */
  async handOffPlan(dto: BrainPlanActionDTO): Promise<BrainResult<BrainPlanDTO>> {
    const plan = await this.repository.findPlanById(dto.planId);
    if (!plan) return { success: false, error: `Decision plan not found: ${dto.planId}` };
    const actor = this.requireActor(dto.actor);
    if (!actor) return { success: false, error: 'actor is required for the handoff' };

    const gate = canTransitionPlan(plan.status, 'handed_off');
    if (!gate.allowed) {
      return {
        success: false,
        error: gate.message ?? 'Plan must be approved before it can be handed to the orchestrator',
      };
    }

    // The orchestrator must never receive a plan carrying a decision the human
    // vetoed: only plans whose every decision is approved may be handed off.
    const decisions = await this.repository.listDecisionsByPlan(plan.planId);
    const notApproved = decisions.find((d) => d.status !== 'approved');
    if (notApproved) {
      return {
        success: false,
        error: `Plan cannot be handed to the orchestrator: decision ${notApproved.decisionId} (${notApproved.type}) is ${notApproved.status}. Every decision must be approved first.`,
      };
    }

    const updated = this.bumpPlan(plan, 'handed_off', actor, dto.note);
    await this.repository.savePlan(updated);

    for (const decision of decisions) {
      await this.repository.saveDecision(
        this.bumpDecision(decision, 'handed_off', actor, dto.note),
      );
    }
    return { success: true, data: BrainMapper.planToDTO(updated) };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private requireActor(actor: string | undefined): string | undefined {
    return actor && actor.trim().length > 0 ? actor : undefined;
  }

  private async transitionDecision(
    dto: BrainDecisionActionDTO,
    to: Exclude<BrainDecisionStatus, 'proposed'>,
  ): Promise<BrainResult<BrainDecisionDTO>> {
    const actor = this.requireActor(dto.actor);
    if (!actor) return { success: false, error: 'actor is required for decision actions' };
    const decision = await this.repository.findDecisionById(dto.decisionId);
    if (!decision) return { success: false, error: `Decision not found: ${dto.decisionId}` };

    const gate = canTransitionDecision(decision.status, to);
    if (!gate.allowed) {
      return { success: false, error: gate.message ?? 'Invalid decision transition' };
    }

    const updated = this.bumpDecision(decision, to, actor, dto.note);
    await this.repository.saveDecision(updated);
    return { success: true, data: BrainMapper.decisionToDTO(updated) };
  }

  private async supersedePlan(plan: BrainDecisionPlan, actor: string): Promise<void> {
    const updated = this.bumpPlan(plan, 'superseded', actor, 'Superseded by a newer decision plan');
    await this.repository.savePlan(updated);
    const decisions = await this.repository.listDecisionsByPlan(plan.planId);
    for (const decision of decisions) {
      if (
        decision.status === 'proposed' ||
        decision.status === 'approved' ||
        decision.status === 'handed_off'
      ) {
        await this.repository.saveDecision(this.bumpDecision(decision, 'superseded', actor));
      }
    }
  }

  private bumpDecision(
    decision: BrainDecision,
    to: Exclude<BrainDecisionStatus, 'proposed'>,
    actor: string,
    note?: string,
  ): BrainDecision {
    const version = decision.version + 1;
    return {
      ...decision,
      status: to,
      version,
      actor,
      history: [
        ...decision.history,
        {
          auditId: generateAuditId(),
          action: to,
          version,
          actor,
          note,
          timestamp: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
  }

  private bumpPlan(
    plan: BrainDecisionPlan,
    to: BrainDecisionStatus,
    actor: string,
    _note?: string,
  ): BrainDecisionPlan {
    const version = plan.version + 1;
    return {
      ...plan,
      status: to,
      version,
      actor,
      updatedAt: new Date().toISOString(),
    };
  }
}
