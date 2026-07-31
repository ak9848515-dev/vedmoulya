// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Dashboard Router
// Dashboard Experience Platform procedures
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import type { DashboardApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

export function createDashboardRouter(dashboardService: DashboardApplicationService): {
  getDashboard: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getViewModel: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getIdentity: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getFocus: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getExecution: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getDecisions: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getMemory: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getGrowth: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getJourney: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getInsights: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getRecommendations: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getHealth: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getMetrics: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  refreshSection: (
    input: { userId: string; sectionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  invalidateCache: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => ApiResponse<{ message: string }>;
} {
  return {
    getDashboard: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getDashboard(input.userId));
    },
    getViewModel: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getDashboardViewModel(input.userId));
    },
    getIdentity: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getIdentity(input.userId));
    },
    getFocus: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getFocus(input.userId));
    },
    getExecution: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getExecution(input.userId));
    },
    getDecisions: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getDecisions(input.userId));
    },
    getMemory: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getMemory(input.userId));
    },
    getGrowth: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getGrowth(input.userId));
    },
    getJourney: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getJourney(input.userId));
    },
    getInsights: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getInsights(input.userId));
    },
    getRecommendations: async (
      input: { userId: string },
      _ctx: TRPCContext,
    ): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getRecommendations(input.userId));
    },
    getHealth: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getHealth(input.userId));
    },
    getMetrics: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      return fromServiceResult(await dashboardService.getMetrics(input.userId));
    },
    refreshSection: async (
      input: { userId: string; sectionId: string },
      _ctx: TRPCContext,
    ): Promise<ApiResponse> => {
      return fromServiceResult(
        await dashboardService.refreshSection(input.userId, input.sectionId),
      );
    },
    invalidateCache: (
      input: { userId: string },
      _ctx: TRPCContext,
    ): ApiResponse<{ message: string }> => {
      dashboardService.invalidateCache(input.userId);
      return {
        success: true,
        data: { message: 'Cache invalidated' },
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },
  };
}
