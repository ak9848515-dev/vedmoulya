// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Enterprise Intelligence Integration Router
// Enterprise Intelligence Pipeline procedures (EPIC-004 / EI-006 / INT-001)
// ─────────────────────────────────────────────────────────────────────────────

import type { IntelligenceApplicationService } from '@vedmoulya/intelligence';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

export interface IntelligenceHandlers {
  buildPipeline: (
    input: { userId: string; goalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  validatePipeline: (
    input: { userId: string; pipelineId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  explainPipeline: (
    input: { userId: string; pipelineId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getPipeline: (
    input: { userId: string; pipelineId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listPipelines: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getDashboard: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createIntelligenceRouter(
  intelligence: IntelligenceApplicationService,
): IntelligenceHandlers {
  const svc = intelligence;
  return {
    buildPipeline: async (input, _ctx) =>
      fromServiceResult(await svc.buildPipeline({ goalId: input.goalId })),
    validatePipeline: async (input, _ctx) =>
      fromServiceResult(await svc.validatePipeline(input.pipelineId)),
    explainPipeline: async (input, _ctx) =>
      fromServiceResult(await svc.explainPipeline(input.pipelineId)),
    getPipeline: async (input, _ctx) => fromServiceResult(await svc.getPipeline(input.pipelineId)),
    listPipelines: async (_input, _ctx) => fromServiceResult(await svc.listPipelines()),
    getDashboard: async (_input, _ctx) => fromServiceResult(await svc.getDashboard()),
  };
}
