// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Goal & Task Intelligence Router
// Enterprise Goal & Task Intelligence procedures (EPIC-004 / EI-006)
// ─────────────────────────────────────────────────────────────────────────────

import type { GoalsApplicationService } from '@vedmoulya/goals';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

export interface GoalsHandlers {
  // SPRINT-023 — typed problem understanding
  understandProblem: (
    input: { userId: string; problem: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Goals
  createGoal: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  analyzeGoal: (
    input: { userId: string; goalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  validateGoal: (
    input: { userId: string; goalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  explainGoal: (
    input: { userId: string; goalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getGoal: (input: { userId: string; goalId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  listGoals: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  searchGoals: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Tasks / graph
  generateTasks: (
    input: { userId: string; goalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getTaskGraph: (
    input: { userId: string; goalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listTasks: (input: { userId: string; goalId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Lifecycle
  transitionGoal: (
    input: { userId: string; goalId: string; command: unknown },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Strategy handoff + summary
  buildStrategyHandoff: (
    input: { userId: string; goalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getSummary: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createGoalsRouter(goals: GoalsApplicationService): GoalsHandlers {
  const svc = goals;
  return {
    // ── SPRINT-023 — problem understanding ────────────────────────────────
    understandProblem: (input, _ctx) =>
      Promise.resolve(fromServiceResult(svc.understandProblem(input.problem))),

    // ── Goals ──────────────────────────────────────────────────────────────
    createGoal: async (input, _ctx) =>
      fromServiceResult(
        await svc.createGoal(input as unknown as Parameters<typeof svc.createGoal>[0]),
      ),
    analyzeGoal: async (input, _ctx) => fromServiceResult(await svc.analyzeGoal(input.goalId)),
    validateGoal: async (input, _ctx) => fromServiceResult(await svc.validateGoal(input.goalId)),
    explainGoal: async (input, _ctx) => fromServiceResult(await svc.explainGoal(input.goalId)),
    getGoal: async (input, _ctx) => fromServiceResult(await svc.getGoal(input.goalId)),
    listGoals: async (_input, _ctx) => fromServiceResult(await svc.listGoals()),
    searchGoals: async (input, _ctx) =>
      fromServiceResult(
        await svc.searchGoals(input as unknown as Parameters<typeof svc.searchGoals>[0]),
      ),

    // ── Tasks / graph ──────────────────────────────────────────────────────
    generateTasks: async (input, _ctx) => fromServiceResult(await svc.generateTasks(input.goalId)),
    getTaskGraph: async (input, _ctx) => fromServiceResult(await svc.getTaskGraph(input.goalId)),
    listTasks: async (input, _ctx) => fromServiceResult(await svc.listTasks(input.goalId)),

    // ── Lifecycle ──────────────────────────────────────────────────────────
    transitionGoal: async (input, _ctx) =>
      fromServiceResult(
        await svc.transitionGoal(
          input.goalId,
          input.command as Parameters<typeof svc.transitionGoal>[1],
        ),
      ),

    // ── Strategy handoff + summary ─────────────────────────────────────────
    buildStrategyHandoff: async (input, _ctx) =>
      fromServiceResult(await svc.buildStrategyHandoff(input.goalId)),
    getSummary: async (_input, _ctx) => fromServiceResult(await svc.getSummary()),
  };
}
