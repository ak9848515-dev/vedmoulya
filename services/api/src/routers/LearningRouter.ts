// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Learning Router
// Learning Intelligence Platform procedures
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import type { LearningApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

export function createLearningRouter(learningService: LearningApplicationService): {
  getLearning: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getViewModel: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getConfig: (input: { userId: string }, _ctx: TRPCContext) => ApiResponse;
  invalidateCache: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => ApiResponse<{ message: string }>;
} {
  return {
    getLearning: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await learningService.getLearning(input.userId));
    },
    getViewModel: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await learningService.getLearningViewModel(input.userId));
    },
    getConfig: (input: { userId: string }, _ctx: TRPCContext): ApiResponse => {
      const config = learningService.getConfig(input.userId);
      return {
        success: true,
        data: config,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },
    invalidateCache: (
      input: { userId: string },
      _ctx: TRPCContext,
    ): ApiResponse<{ message: string }> => {
      learningService.invalidateCache(input.userId);
      return {
        success: true,
        data: { message: 'Cache invalidated' },
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },
  };
}
