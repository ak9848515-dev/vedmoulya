// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Search Router
// Global search and recent search procedures
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import type { LifeOSApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { createRequestAudit } from '../middleware/audit.js';
import type { GlobalSearchInput } from './LifeOSRouter.js';
import type { ApiResponse } from '../services/ResponseMapper.js';

export function createSearchRouter(lifeOSService: LifeOSApplicationService): {
  global: (input: GlobalSearchInput, ctx: TRPCContext) => Promise<ApiResponse>;
  recent: (_input: { userId: string }, _ctx: TRPCContext) => ApiResponse;
} {
  return {
    global: async (input: GlobalSearchInput, ctx: TRPCContext): Promise<ApiResponse> => {
      const startTime = Date.now();

      const results = await lifeOSService.globalSearch(input.query, {
        categories: input.categories,
        sources: input.sources,
        maxResults: input.maxResults ?? 20,
      });

      createRequestAudit(
        'search.perform',
        ctx.userId,
        'search.global',
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

    recent: (_input: { userId: string }, _ctx: TRPCContext): ApiResponse => {
      return {
        success: true,
        data: [],
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },
  };
}
