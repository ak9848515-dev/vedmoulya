// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Execution Strategy Router
// Enterprise Execution Strategy Engine procedures (EPIC-004 / EI-004)
// ─────────────────────────────────────────────────────────────────────────────

import type { ExecutionStrategyApplicationService } from '@vedmoulya/execution-strategy';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry) using
// JSON-safe shapes; the application service re-validates business rules.

export interface ExecutionStrategyHandlers {
  // Create & Validate
  createStrategy: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  validateStrategy: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Retrieval
  getStrategy: (input: { userId: string; id: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  deleteStrategy: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Search & List
  search: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  list: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  listByPriority: (
    input: { userId: string; priority: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listByExecutionMode: (
    input: { userId: string; mode: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listByCapability: (
    input: { userId: string; capability: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listByGoal: (
    input: { userId: string; goalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Explain
  explain: (input: { userId: string; id: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Estimates (synchronous — the application service computes them in-process)
  estimateTokens: (
    input: { userId: string; goal: string; tier: string; maxTokens?: number },
    _ctx: TRPCContext,
  ) => ApiResponse;
  estimateCost: (
    input: { userId: string; goal: string; tier: string; maxCostUsd?: number },
    _ctx: TRPCContext,
  ) => ApiResponse;
  estimateLatency: (
    input: { userId: string; goal: string; tier: string; maxLatencyMs?: number },
    _ctx: TRPCContext,
  ) => ApiResponse;
  // Summary
  getSummary: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createExecutionStrategyRouter(
  strategyService: ExecutionStrategyApplicationService,
): ExecutionStrategyHandlers {
  const svc = strategyService;
  return {
    // ── Create & Validate ───────────────────────────────────────────────
    createStrategy: async (input, _ctx) =>
      fromServiceResult(
        await svc.createStrategy(input as unknown as Parameters<typeof svc.createStrategy>[0]),
      ),
    validateStrategy: async (input, _ctx) =>
      fromServiceResult(await svc.validateStrategy(input.id)),

    // ── Retrieval ───────────────────────────────────────────────────────
    getStrategy: async (input, _ctx) => fromServiceResult(await svc.getStrategy(input.id)),
    deleteStrategy: async (input, _ctx) => fromServiceResult(await svc.deleteStrategy(input.id)),

    // ── Search & List ───────────────────────────────────────────────────
    search: async (input, _ctx) =>
      fromServiceResult(
        await svc.searchStrategies(input as unknown as Parameters<typeof svc.searchStrategies>[0]),
      ),
    list: async (_input, _ctx) => fromServiceResult(await svc.listStrategies()),
    listByPriority: async (input, _ctx) =>
      fromServiceResult(
        await svc.listByPriority(input.priority as Parameters<typeof svc.listByPriority>[0]),
      ),
    listByExecutionMode: async (input, _ctx) =>
      fromServiceResult(
        await svc.listByExecutionMode(input.mode as Parameters<typeof svc.listByExecutionMode>[0]),
      ),
    listByCapability: async (input, _ctx) =>
      fromServiceResult(
        await svc.listByCapability(input.capability as Parameters<typeof svc.listByCapability>[0]),
      ),
    listByGoal: async (input, _ctx) => fromServiceResult(await svc.listByGoal(input.goalId)),

    // ── Explain ─────────────────────────────────────────────────────────
    explain: async (input, _ctx) => fromServiceResult(await svc.explainStrategy(input.id)),

    // ── Estimates ───────────────────────────────────────────────────────
    estimateTokens: (input, _ctx) =>
      fromServiceResult(
        svc.estimateTokens(
          input.goal,
          input.tier as Parameters<typeof svc.estimateTokens>[1],
          input.maxTokens,
        ),
      ),
    estimateCost: (input, _ctx) =>
      fromServiceResult(
        svc.estimateCost(
          input.goal,
          input.tier as Parameters<typeof svc.estimateCost>[1],
          input.maxCostUsd,
        ),
      ),
    estimateLatency: (input, _ctx) =>
      fromServiceResult(
        svc.estimateLatency(
          input.goal,
          input.tier as Parameters<typeof svc.estimateLatency>[1],
          input.maxLatencyMs,
        ),
      ),

    // ── Summary ─────────────────────────────────────────────────────────
    getSummary: async (_input, _ctx) => fromServiceResult(await svc.getSummary()),
  };
}
