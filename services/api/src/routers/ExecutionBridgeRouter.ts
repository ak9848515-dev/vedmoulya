// ──────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Execution Bridge Router
// EPIC-014 — Capability Execution Engine (PLAN → EXECUTE → VERIFY)
//
// The execution.* namespace: start (plan → bounded run), get / list
// (owner-scoped reads), approve / reject (approval gate), completeHandoff
// (configure/manual/external hand-off), cancel (stop), preferenceLedger
// (Phase 5 provenance, owner-scoped), intelligence (Phase 4 run view).
// Every procedure is authenticated + rate-limited; ownership is enforced
// at the service boundary (IDOR refused there) AND by the auth middleware
// (input.userId must match the session user).
// ──────────────────────────────────────────────────────────────────

import type { ExecutionRunService } from '@vedmoulya/execution-bridge';
import type { TRPCContext } from '../services/RouterRegistry.js';
import { assertRateLimit, RateLimitTiers } from '../middleware/rate-limit.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { fromServiceResult } from '../services/ResponseMapper.js';

export interface ExecutionBridgeHandlers {
  start: (input: { userId: string; planId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  get: (
    input: { userId: string; executionId: string },
    ctx: TRPCContext,
  ) => ApiResponse | Promise<ApiResponse>;
  list: (input: { userId: string }, ctx: TRPCContext) => ApiResponse | Promise<ApiResponse>;
  approve: (
    input: { userId: string; executionId: string; stepId: string; note?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  reject: (
    input: { userId: string; executionId: string; stepId: string; note?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  completeHandoff: (
    input: { userId: string; executionId: string; stepId: string; note?: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  cancel: (
    input: { userId: string; executionId: string },
    ctx: TRPCContext,
  ) => ApiResponse | Promise<ApiResponse>;
  preferenceLedger: (
    input: { userId: string; executionId?: string },
    ctx: TRPCContext,
  ) => ApiResponse | Promise<ApiResponse>;
  intelligence: (
    input: { userId: string; executionId: string },
    ctx: TRPCContext,
  ) => ApiResponse | Promise<ApiResponse>;
}

export function createExecutionBridgeRouter(service: ExecutionRunService): ExecutionBridgeHandlers {
  return {
    start: async (input, _ctx): Promise<ApiResponse> => {
      assertRateLimit(input.userId, RateLimitTiers.heavy);
      const result = await service.start(input.userId, input.planId);
      return fromServiceResult(result);
    },

    get: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.get(input.userId, input.executionId));
    },

    list: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.list(input.userId));
    },

    approve: async (input, _ctx): Promise<ApiResponse> => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(
        await service.approve(input.userId, input.executionId, input.stepId, input.note),
      );
    },

    reject: async (input, _ctx): Promise<ApiResponse> => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(
        await service.reject(input.userId, input.executionId, input.stepId, input.note),
      );
    },

    completeHandoff: async (input, _ctx): Promise<ApiResponse> => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(
        await service.completeHandoff(input.userId, input.executionId, input.stepId, input.note),
      );
    },

    cancel: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.cancel(input.userId, input.executionId));
    },

    preferenceLedger: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.preferenceLedger(input.userId, input.executionId));
    },

    intelligence: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      const run = service.get(input.userId, input.executionId);
      if (!run.success || !run.data) return fromServiceResult(run);
      return fromServiceResult({ success: true, data: service.intelligence(run.data) });
    },
  };
}
