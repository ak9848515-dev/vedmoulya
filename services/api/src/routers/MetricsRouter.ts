// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Metrics Router
// Performance and analytics metrics procedures
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { metrics, metricsSnapshotJson } from '@vedmoulya/core';
import type { DashboardApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import type { ApiResponse } from '../services/ResponseMapper.js';

export function createMetricsRouter(dashboardService: DashboardApplicationService): {
  dashboard: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  lifecycle: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  snapshot: () => ApiResponse;
} {
  return {
    dashboard: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      const dashboard = await dashboardService.getDashboard(input.userId);
      const metrics =
        dashboard.success && dashboard.data
          ? {
              lifeScore: dashboard.data.metrics.lifeScore,
              goalProgress: dashboard.data.metrics.goalProgress,
              executionRate: dashboard.data.metrics.executionRate,
              consistency: dashboard.data.metrics.consistency,
              momentum: dashboard.data.metrics.momentum,
            }
          : null;

      return {
        success: true,
        data: metrics,
        meta: {
          timestamp: new Date().toISOString(),
          duration: dashboard.latency ?? 0,
          version: '1.0.0',
        },
      };
    },

    lifecycle: async (input: { userId: string }, _ctx: TRPCContext): Promise<ApiResponse> => {
      const dashboard = await dashboardService.getDashboard(input.userId);
      const lifecycle =
        dashboard.success && dashboard.data
          ? {
              streak: dashboard.data.metrics.streak,
              weeklyCompletion: dashboard.data.metrics.weeklyCompletion,
              monthlyCompletion: dashboard.data.metrics.monthlyCompletion,
            }
          : null;

      return {
        success: true,
        data: lifecycle,
        meta: {
          timestamp: new Date().toISOString(),
          duration: dashboard.latency ?? 0,
          version: '1.0.0',
        },
      };
    },

    /** Raw metrics snapshot (PH-002/T1) — JSON view of the metrics registry. */
    snapshot: (): ApiResponse => {
      return {
        success: true,
        data: metricsSnapshotJson(metrics),
        meta: {
          timestamp: new Date().toISOString(),
          duration: 0,
          version: '1.0.0',
        },
      };
    },
  };
}
