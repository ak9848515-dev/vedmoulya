// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Life OS Router
// Unified Life OS experience — primary data source for the Dashboard
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import type {
  LifeOSSearchCategory,
  LifeOSModule,
  LifeOSApplicationService,
} from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';
import { createRequestAudit } from '../middleware/audit.js';

// ── Input Types ──────────────────────────────────────────────────────────────

export interface GetSnapshotInput {
  userId: string;
}

export interface GlobalSearchInput {
  query: string;
  categories?: LifeOSSearchCategory[];
  sources?: LifeOSModule[];
  maxResults?: number;
}

export interface UpdateConfigInput {
  userId: string;
  updates: Record<string, unknown>;
}

// ── Router Factory ──────────────────────────────────────────────────────────

export function createLifeOSRouter(lifeOSService: LifeOSApplicationService): {
  getSnapshot: (input: GetSnapshotInput, ctx: TRPCContext) => Promise<ApiResponse>;
  getViewModel: (input: GetSnapshotInput, _ctx: TRPCContext) => Promise<ApiResponse>;
  globalSearch: (input: GlobalSearchInput, ctx: TRPCContext) => Promise<ApiResponse>;
  invalidateCache: (input: GetSnapshotInput, ctx: TRPCContext) => ApiResponse<{ message: string }>;
  getNavigation: (_input: unknown, _ctx: TRPCContext) => ApiResponse;
  updateConfig: (input: UpdateConfigInput, ctx: TRPCContext) => ApiResponse;
  getConfig: (input: GetSnapshotInput, _ctx: TRPCContext) => ApiResponse;
  getCacheMetrics: (_input: unknown, _ctx: TRPCContext) => ApiResponse;
} {
  return {
    /** Get the full unified Life OS snapshot */
    getSnapshot: async (input: GetSnapshotInput, ctx: TRPCContext): Promise<ApiResponse> => {
      const startTime = Date.now();

      const result = await lifeOSService.getLifeOS(input.userId);

      createRequestAudit(
        'api.request',
        ctx.userId,
        'lifeOS.getSnapshot',
        Date.now() - startTime,
        result.success,
      );

      return fromServiceResult(result);
    },

    /** Get the Life OS dashboard view model */
    getViewModel: async (input: GetSnapshotInput, _ctx: TRPCContext): Promise<ApiResponse> => {
      const result = await lifeOSService.getLifeOSViewModel(input.userId);
      return fromServiceResult(result);
    },

    /** Global search across all modules */
    globalSearch: async (input: GlobalSearchInput, ctx: TRPCContext): Promise<ApiResponse> => {
      const startTime = Date.now();

      const results = await lifeOSService.globalSearch(input.query, {
        categories: input.categories,
        sources: input.sources,
        maxResults: input.maxResults,
      });

      createRequestAudit(
        'search.perform',
        ctx.userId,
        'lifeOS.globalSearch',
        Date.now() - startTime,
        true,
      );

      return {
        success: true,
        data: results,
        meta: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          version: '1.0.0',
        },
      };
    },

    /** Invalidate the cache for a user */
    invalidateCache: (
      input: GetSnapshotInput,
      ctx: TRPCContext,
    ): ApiResponse<{ message: string }> => {
      lifeOSService.invalidateCache(input.userId);
      createRequestAudit('cache.invalidate', ctx.userId, 'lifeOS.invalidateCache', 0, true);
      return {
        success: true,
        data: { message: 'Cache invalidated' },
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },

    /** Get navigation structure */
    getNavigation: (_input: unknown, _ctx: TRPCContext): ApiResponse => {
      const navigation = lifeOSService.getNavigation();
      return {
        success: true,
        data: navigation,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },

    /** Update configuration */
    updateConfig: (input: UpdateConfigInput, ctx: TRPCContext): ApiResponse => {
      const config = lifeOSService.updateConfig(input.userId, input.updates);
      createRequestAudit('config.update', ctx.userId, 'lifeOS.updateConfig', 0, true);
      return {
        success: true,
        data: config,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },

    /** Get configuration */
    getConfig: (input: GetSnapshotInput, _ctx: TRPCContext): ApiResponse => {
      const config = lifeOSService.getConfig(input.userId);
      return {
        success: true,
        data: config,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },

    /** Get cache metrics */
    getCacheMetrics: (_input: unknown, _ctx: TRPCContext): ApiResponse => {
      const metrics = lifeOSService.getCacheMetrics();
      return {
        success: true,
        data: metrics,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },
  };
}
