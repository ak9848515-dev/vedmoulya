// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Autonomous Planning Router
// Planning Intelligence procedures (BLD-017A)
// The planner PROPOSES; the frozen execution kernel executes. Both
// procedures are owner-scoped (the session userId is enforced by the
// gateway IDOR guard), rate-limited at the heavy tier (every call may hit
// the AI runtime for AI mode), and return the full observability result:
// understanding + plan + readiness + issues + planner AI usage.
// ─────────────────────────────────────────────────────────────────────────────

import type { PlanningApplicationService } from '@vedmoulya/planning';
import type { PlanAndExecuteResult, PlanGenerationResult } from '@vedmoulya/planning';
import type { TRPCContext } from '../router.js';
import { successResponse, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry);
// the planning domain re-validates capabilities, tools, dependencies,
// budgets and readiness before anything can execute.

export interface PlanningHandlers {
  /** GOAL → UNDERSTANDING → PLAN → VALIDATION → READINESS (no execution). */
  plan: (
    input: {
      userId: string;
      goal: string;
      context?: string;
      constraints?: unknown;
      mode?: 'deterministic' | 'ai';
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<PlanGenerationResult>>;
  /** Plan AND execute — only a READY plan is handed to the frozen engine. */
  planAndExecute: (
    input: {
      userId: string;
      goal: string;
      context?: string;
      constraints?: unknown;
      mode?: 'deterministic' | 'ai';
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<PlanAndExecuteResult>>;
}

export function createPlanningRouter(planning: PlanningApplicationService): PlanningHandlers {
  const svc = planning;
  return {
    plan: async (input, _ctx) =>
      successResponse(
        await svc.generatePlan({
          userId: input.userId,
          goal: input.goal,
          context: input.context,
          constraints: input.constraints as Parameters<typeof svc.generatePlan>[0]['constraints'],
          mode: input.mode,
        }),
      ),
    planAndExecute: async (input, _ctx) =>
      successResponse(
        await svc.planAndExecute({
          userId: input.userId,
          goal: input.goal,
          context: input.context,
          constraints: input.constraints as Parameters<typeof svc.planAndExecute>[0]['constraints'],
          mode: input.mode,
        }),
      ),
  };
}
