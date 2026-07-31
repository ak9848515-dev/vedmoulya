// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Notification Router
// Notification management procedures
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import type { DashboardApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { assertRateLimit, RateLimitTiers } from '../middleware/rate-limit.js';
import { createRequestAudit } from '../middleware/audit.js';
import type { ApiResponse } from '../services/ResponseMapper.js';

export function createNotificationRouter(dashboardService: DashboardApplicationService): {
  list: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  dismiss: (
    input: { userId: string; notificationId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
} {
  return {
    list: async (input: { userId: string }, ctx: TRPCContext): Promise<ApiResponse> => {
      assertRateLimit(ctx.userId, RateLimitTiers.standard);
      // Notifications are embedded in the dashboard snapshot
      const dashboard = await dashboardService.getDashboard(input.userId);
      const notifications = dashboard.success && dashboard.data ? dashboard.data.notifications : [];

      return {
        success: true,
        data: notifications,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },

    dismiss: async (
      input: { userId: string; notificationId: string },
      ctx: TRPCContext,
    ): Promise<ApiResponse> => {
      assertRateLimit(ctx.userId, RateLimitTiers.standard);
      const dashboard = await dashboardService.getDashboard(input.userId);
      if (!dashboard.success || !dashboard.data) {
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR' as const,
            message: 'Could not load notifications',
            statusCode: 500,
          },
        };
      }

      const updated = dashboardService.dismissNotification(
        dashboard.data.notifications,
        input.notificationId,
      );

      createRequestAudit('notification.dismiss', ctx.userId, 'notifications.dismiss', 0, true);

      return {
        success: true,
        data: updated,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },
  };
}
