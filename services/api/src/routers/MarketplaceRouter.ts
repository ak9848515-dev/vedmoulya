// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Marketplace Router
// Marketplace Platform procedures
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import type { MarketplaceApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

export function createMarketplaceRouter(marketplaceService: MarketplaceApplicationService): {
  getMarketplace: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getViewModel: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getConfig: (input: { userId: string }, _ctx: TRPCContext) => ApiResponse;
  invalidateCache: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => ApiResponse<{ message: string }>;
} {
  return {
    getMarketplace: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await marketplaceService.getMarketplace(input.userId));
    },
    getViewModel: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await marketplaceService.getMarketplaceViewModel(input.userId));
    },
    getConfig: (input: { userId: string }, _ctx: TRPCContext): ApiResponse => {
      const config = marketplaceService.getConfig(input.userId);
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
      marketplaceService.invalidateCache(input.userId);
      return {
        success: true,
        data: { message: 'Cache invalidated' },
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },
  };
}
