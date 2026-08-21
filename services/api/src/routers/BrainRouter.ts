// ──────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Brain Routers
// 1) EI-008 — Enterprise Brain (createEnterpriseBrainRouter):
//    the highest decision layer — decides, never executes. Plans and
//    decisions require human approval before handoff to the Execution
//    Orchestrator.
// 2) EPIC-016 — The VedMoulya Brain (createBrainRouter):
//    the central intelligence & orchestration coordinator. brain.*
//    namespace: createTask (understand), plan (capability plan),
//    selectResources (N-provider roles), execute, verify,
//    requestApproval / approve / reject (sensitive-action gates),
//    getStatus / listTasks / getDecisionRecords (owner-scoped reads),
//    cancel, evaluateOutcome (learning feed).
// Every procedure is authenticated + rate-limited; ownership is
// enforced at the service boundary (IDOR refused there) AND by the
// auth middleware (input.userId must match the session user).
// ──────────────────────────────────────────────────────────────────

import type { BrainApplicationService as EnterpriseBrainService } from '@vedmoulya/enterprise-brain';
import type { BrainApplicationService } from '@vedmoulya/brain';
import type { BrainDashboardService } from '../services/BrainDashboardService.js';
import type { TRPCContext } from '../services/RouterRegistry.js';
import { assertRateLimit, RateLimitTiers } from '../middleware/rate-limit.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { fromServiceResult } from '../services/ResponseMapper.js';

// ══════════════════════════════════════════════════════════════════
// 1. EI-008 — Enterprise Brain (frozen decision layer)
// ══════════════════════════════════════════════════════════════════

export interface EnterpriseBrainHandlers {
  decideGoal: (
    input: { userId: string; goalId: string; budgetUsd?: number; actor?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getPlan: (input: { userId: string; planId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  listPlans: (input: { userId: string; goalId?: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  listDecisions: (
    input: {
      userId: string;
      type?: string;
      status?: string;
      goalId?: string;
      page?: number;
      limit?: number;
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getDecision: (
    input: { userId: string; decisionId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getTimeline: (
    input: { userId: string; limit?: number },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getHistory: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  approveDecision: (
    input: { userId: string; decisionId: string; actor: string; note?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  rejectDecision: (
    input: { userId: string; decisionId: string; actor: string; note?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  approvePlan: (
    input: { userId: string; planId: string; actor: string; note?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  rejectPlan: (
    input: { userId: string; planId: string; actor: string; note?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  handOffPlan: (
    input: { userId: string; planId: string; actor: string; note?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getMetrics: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  getDashboard: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createEnterpriseBrainRouter(
  service: EnterpriseBrainService,
): EnterpriseBrainHandlers {
  const svc = service;
  return {
    decideGoal: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(
        await svc.decideGoal({
          goalId: input.goalId,
          budgetUsd: input.budgetUsd,
          actor: input.actor,
        }),
      );
    },

    getPlan: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(await svc.getPlan(input.planId));
    },

    listPlans: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(await svc.listPlans(input.goalId));
    },

    listDecisions: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(
        await svc.listDecisions({
          type: input.type as never,
          status: input.status as never,
          goalId: input.goalId,
          page: input.page,
          limit: input.limit,
        }),
      );
    },

    getDecision: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(await svc.getDecision(input.decisionId));
    },

    getTimeline: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(await svc.getTimeline({ limit: input.limit }));
    },

    getHistory: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(await svc.getHistory());
    },

    approveDecision: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(
        await svc.approveDecision({
          decisionId: input.decisionId,
          actor: input.actor,
          note: input.note,
        }),
      );
    },

    rejectDecision: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(
        await svc.rejectDecision({
          decisionId: input.decisionId,
          actor: input.actor,
          note: input.note,
        }),
      );
    },

    approvePlan: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(
        await svc.approvePlan({ planId: input.planId, actor: input.actor, note: input.note }),
      );
    },

    rejectPlan: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(
        await svc.rejectPlan({ planId: input.planId, actor: input.actor, note: input.note }),
      );
    },

    handOffPlan: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(
        await svc.handOffPlan({ planId: input.planId, actor: input.actor, note: input.note }),
      );
    },

    getMetrics: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(await svc.getMetrics());
    },

    getDashboard: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(await svc.getDashboard());
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// 2. EPIC-016 — The VedMoulya Brain (orchestration coordinator)
// ══════════════════════════════════════════════════════════════════

export interface BrainHandlers {
  createTask: (input: { userId: string; input: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  plan: (input: { userId: string; taskId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  selectResources: (
    input: { userId: string; taskId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  execute: (input: { userId: string; taskId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  verify: (input: { userId: string; taskId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  requestApproval: (
    input: { userId: string; taskId: string; action: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  approve: (
    input: { userId: string; taskId: string; action: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  reject: (
    input: { userId: string; taskId: string; action: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getStatus: (input: { userId: string; taskId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  listTasks: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  getDecisionRecords: (
    input: { userId: string; taskId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  cancel: (input: { userId: string; taskId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  evaluateOutcome: (
    input: {
      userId: string;
      taskId: string;
      outputAccepted: boolean;
      satisfaction?: 'YES' | 'PARTIALLY' | 'NO' | 'UNKNOWN';
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // SPRINT-025 — user correction loop (the only new learning write surface)
  correctLearning: (
    input: {
      userId: string;
      statement: string;
      target: 'approach' | 'provider' | 'result' | 'preference';
      providerId?: string;
      capability?: string;
      taskId?: string;
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // EPIC-020 (Outcome & Revenue layer) — Today's Top 5
  dailyPriorities: (
    input: { userId: string; limit?: number },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // EPIC-020 — continuous intelligence surface
  discoverIntelligence: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  listOpportunities: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  updateOpportunity: (
    input: {
      userId: string;
      opportunityId: string;
      status: 'NEW' | 'RECOMMENDED' | 'ACCEPTED' | 'DISMISSED';
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listIntelligenceEvents: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  updateIntelligenceEvent: (
    input: {
      userId: string;
      eventId: string;
      status: 'NEW' | 'REVIEWED' | 'RECOMMENDED' | 'DISMISSED';
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  providerScores: (
    input: { userId: string; capability: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  dashboard: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createBrainRouter(
  service: BrainApplicationService,
  dashboard?: BrainDashboardService,
): BrainHandlers {
  return {
    createTask: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.createTask(input.userId, input.input));
    },

    plan: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(await service.plan(input.userId, input.taskId));
    },

    selectResources: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(await service.selectResources(input.userId, input.taskId));
    },

    execute: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(await service.execute(input.userId, input.taskId));
    },

    verify: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.verify(input.userId, input.taskId));
    },

    requestApproval: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.requestApproval(input.userId, input.taskId, input.action));
    },

    approve: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.approve(input.userId, input.taskId, input.action));
    },

    reject: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.reject(input.userId, input.taskId, input.action));
    },

    getStatus: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.getStatus(input.userId, input.taskId));
    },

    listTasks: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.listTasks(input.userId));
    },

    getDecisionRecords: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.getDecisionRecords(input.userId, input.taskId));
    },

    cancel: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.cancel(input.userId, input.taskId));
    },

    evaluateOutcome: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(
        await service.evaluateOutcome(
          input.userId,
          input.taskId,
          input.outputAccepted,
          input.satisfaction ?? 'UNKNOWN',
        ),
      );
    },

    // SPRINT-025 — user correction loop (auth + rate limit + IDOR at boundary).
    correctLearning: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(
        await service.correctLearning(input.userId, {
          statement: input.statement,
          target: input.target,
          providerId: input.providerId,
          capability: input.capability,
          taskId: input.taskId,
        }),
      );
    },

    // ── EPIC-020 (Outcome & Revenue layer) — Today's Top 5 ───────
    dailyPriorities: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.dailyPriorities(input.userId, input.limit ?? 5));
    },

    // ── EPIC-020 — Continuous intelligence surface ───────────────
    discoverIntelligence: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(await service.discoverIntelligence(input.userId));
    },

    listOpportunities: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.listOpportunities(input.userId));
    },

    updateOpportunity: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(
        service.updateOpportunity(input.userId, input.opportunityId, input.status),
      );
    },

    listIntelligenceEvents: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.listIntelligenceEvents(input.userId));
    },

    updateIntelligenceEvent: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(
        service.updateIntelligenceEvent(input.userId, input.eventId, input.status),
      );
    },

    providerScores: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.providerScores(input.capability as never));
    },

    dashboard: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      if (!dashboard) {
        return fromServiceResult({ success: false, error: 'Brain dashboard is not configured.' });
      }
      return fromServiceResult({ success: true, data: await dashboard.get(input.userId) });
    },
  };
}
