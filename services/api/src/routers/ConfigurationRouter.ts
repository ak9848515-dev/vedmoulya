// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Configuration Router
// Configuration management procedures
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import type { DashboardApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { createRequestAudit } from '../middleware/audit.js';
import type { ApiResponse } from '../services/ResponseMapper.js';

export function createConfigurationRouter(dashboardService: DashboardApplicationService): {
  get: (input: { userId: string }, _ctx: TRPCContext) => ApiResponse;
  update: (
    input: { userId: string; updates: Record<string, unknown> },
    ctx: TRPCContext,
  ) => ApiResponse;
} {
  return {
    get: (input: { userId: string }, _ctx: TRPCContext): ApiResponse => {
      const config = dashboardService.getConfig(input.userId);
      return {
        success: true,
        data: config,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },

    update: (
      input: { userId: string; updates: Record<string, unknown> },
      ctx: TRPCContext,
    ): ApiResponse => {
      const config = dashboardService.updateConfig(input.userId, input.updates);

      createRequestAudit('config.update', ctx.userId, 'config.update', 0, true);

      return {
        success: true,
        data: config,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },
  };
}
