// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Platform Health Router
// Health checks, metrics, and platform status endpoints
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import type { LifeOSApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';

export interface PlatformHealth {
  status: 'healthy' | 'degraded' | 'critical';
  version: string;
  uptime: number;
  modules: Array<{ name: string; status: string }>;
  cache: { totalEntries: number; hitRate: number; memoryUsage: number };
}

const startupTime = Date.now();

export function createHealthRouter(lifeOSService: LifeOSApplicationService): {
  check: (_input: unknown, _ctx: TRPCContext) => { success: boolean; data: PlatformHealth };
  live: (
    _input: unknown,
    _ctx: TRPCContext,
  ) => { success: boolean; data: { status: string; timestamp: string } };
  ready: (
    _input: unknown,
    _ctx: TRPCContext,
  ) => { success: boolean; data: { status: string; uptime: number } };
  version: (
    _input: unknown,
    _ctx: TRPCContext,
  ) => { success: boolean; data: { version: string; buildDate: string; modules: string[] } };
} {
  return {
    /** Overall platform health */
    check: (_input: unknown, _ctx: TRPCContext): { success: boolean; data: PlatformHealth } => {
      const isHealthy = lifeOSService.isHealthy();
      return {
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'degraded',
          version: '1.0.0',
          uptime: Date.now() - startupTime,
          modules: [{ name: 'lifeOS', status: isHealthy ? 'healthy' : 'degraded' }],
          cache: {
            totalEntries: 0,
            hitRate: 0,
            memoryUsage: 0,
          },
        },
      };
    },

    /** Quick liveness check */
    live: (
      _input: unknown,
      _ctx: TRPCContext,
    ): { success: boolean; data: { status: string; timestamp: string } } => {
      return {
        success: true,
        data: { status: 'alive', timestamp: new Date().toISOString() },
      };
    },

    /** Quick readiness check */
    ready: (
      _input: unknown,
      _ctx: TRPCContext,
    ): { success: boolean; data: { status: string; uptime: number } } => {
      const isHealthy = lifeOSService.isHealthy();
      return {
        success: true,
        data: { status: isHealthy ? 'ready' : 'not_ready', uptime: Date.now() - startupTime },
      };
    },

    /** Platform version */
    version: (
      _input: unknown,
      _ctx: TRPCContext,
    ): { success: boolean; data: { version: string; buildDate: string; modules: string[] } } => {
      return {
        success: true,
        data: {
          version: '1.0.0',
          buildDate: '2026-07-30',
          modules: [
            'identity',
            'ai-orchestrator',
            'knowledge-graph',
            'memory',
            'decision',
            'execution',
            'dashboard',
            'career',
            'learning',
            'business',
            'marketplace',
            'life-os',
          ],
        },
      };
    },
  };
}
