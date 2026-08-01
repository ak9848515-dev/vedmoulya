/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Platform Health Router
// Health checks, metrics, and platform status endpoints
// BLD-016A — API Gateway & Platform Services
// PH-002 — Enterprise Operations & Reliability (T3 Runtime Health)
// ─────────────────────────────────────────────────────────────────────────────

import { getRuntimeInfo, metrics } from '@vedmoulya/core';
import type { LifeOSApplicationService } from '@vedmoulya/services';
import type { InfrastructureHealthProbe } from '../services/InfrastructureHealthProbe.js';
import type { TRPCContext } from '../router.js';

export interface PlatformHealthComponent {
  name:
    'application' | 'database' | 'redis' | 'ai' | 'memory' | 'cache' | 'queue' | 'cpu' | 'lifeos';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'not_configured';
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface PlatformHealth {
  status: 'healthy' | 'degraded' | 'critical';
  version: string;
  gitSha?: string;
  buildTimestamp?: string;
  uptime: number;
  startedAt: string;
  modules: Array<{ name: string; status: string }>;
  cache: { totalEntries: number; hitRate: number; memoryUsage: number };
  runtime: { node: string; platform: string; arch: string; memoryHeapMb: number };
  components: PlatformHealthComponent[];
  responseTimes: Record<string, number>;
  readiness: 'ready' | 'not_ready';
}

const startupTime = Date.now();

function componentStatus(isHealthy: boolean): 'healthy' | 'degraded' {
  return isHealthy ? 'healthy' : 'degraded';
}

export function createHealthRouter(
  lifeOSService: LifeOSApplicationService,
  infrastructureHealth?: InfrastructureHealthProbe,
): {
  check: (
    _input: unknown,
    _ctx: TRPCContext,
  ) => Promise<{ success: boolean; data: PlatformHealth }>;
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
  ) => {
    success: boolean;
    data: { version: string; gitSha?: string; buildDate: string; modules: string[] };
  };
} {
  return {
    /** Overall platform health with component-level detail (PH-002/T3) */
    check: async (
      _input: unknown,
      _ctx: TRPCContext,
    ): Promise<{ success: boolean; data: PlatformHealth }> => {
      const runtime = getRuntimeInfo();
      const isHealthy = lifeOSService.isHealthy();

      // Real cache metrics from the LifeOS cache service (not placeholders).
      const cacheMetrics = lifeOSService.getCacheMetrics();
      const cacheTotal = cacheMetrics.totalEntries;
      const cacheHitRate = cacheMetrics.hitRate;
      const cacheMemory = cacheMetrics.memoryUsage;

      // Response-time map: real per-component measured latency (PH-002/T3).
      const responseTimes: Record<string, number> = {
        cache: cacheMetrics.averageLatency,
      };

      const timed = <T>(label: string, fn: () => T): T => {
        const start = performance.now();
        const result = fn();
        const latency = Math.round((performance.now() - start) * 100) / 100;
        responseTimes[label] = latency;
        // PH-002/T1 — record measured component latency into the metrics
        // registry so it is exported via Prometheus (api.health.<comp>_ms).
        metrics.observe(`api.health.${label}.latency_ms`, latency);
        return result;
      };

      const components: PlatformHealthComponent[] = [];

      timed('application', () => {
        components.push({
          name: 'application',
          status: 'healthy',
          message: `vedmoulya ${runtime.version} running on ${runtime.platform}/${runtime.arch}`,
        });
      });

      timed('memory', () => {
        components.push({
          name: 'memory',
          status: runtime.memory.heapUsedBytes < 512 * 1024 * 1024 ? 'healthy' : 'degraded',
          message: `Heap: ${String(Math.round(runtime.memory.heapUsedBytes / 1024 / 1024))}MB`,
          details: {
            heapUsedBytes: runtime.memory.heapUsedBytes,
            rssBytes: runtime.memory.rssBytes,
          },
        });
      });

      timed('cpu', () => {
        components.push({
          name: 'cpu',
          status: runtime.cpu.cpuUsagePercent < 80 ? 'healthy' : 'degraded',
          message: `CPU: ${String(runtime.cpu.cpuUsagePercent)}% (load ${String(runtime.cpu.loadAvg1m)})`,
          details: {
            cpuUsagePercent: runtime.cpu.cpuUsagePercent,
            loadAvg1m: runtime.cpu.loadAvg1m,
          },
        });
      });

      timed('cache', () => {
        components.push({
          name: 'cache',
          status: cacheTotal > 0 ? 'healthy' : 'not_configured',
          message: `Cache entries: ${String(cacheTotal)}, hit rate: ${String(Math.round(cacheHitRate * 100))}%`,
          details: { totalEntries: cacheTotal, hitRate: cacheHitRate, memoryUsage: cacheMemory },
        });
      });

      timed('lifeos', () => {
        components.push({
          name: 'lifeos',
          status: componentStatus(isHealthy),
          message: isHealthy ? 'LifeOS healthy' : 'LifeOS degraded',
        });
      });

      // Dependency components — real Database and Redis probes (PH-002/T3
      // follow-up). When a probe is configured it performs a live round-trip
      // (SELECT 1 / RESP PING) and reports the measured status + latency;
      // otherwise it stays honestly not_configured. AI/queue remain unregistered.
      if (infrastructureHealth) {
        const [db, redis] = await Promise.all([
          infrastructureHealth.checkDatabase(),
          infrastructureHealth.checkRedis(),
        ]);
        components.push({
          name: 'database',
          status: db.status,
          message: db.message,
          latencyMs: db.latencyMs,
          details: db.error ? { error: db.error } : undefined,
        });
        components.push({
          name: 'redis',
          status: redis.status,
          message: redis.message,
          latencyMs: redis.latencyMs,
          details: redis.error ? { error: redis.error } : undefined,
        });
        if (db.latencyMs !== undefined) responseTimes.database = db.latencyMs;
        if (redis.latencyMs !== undefined) responseTimes.redis = redis.latencyMs;
      } else {
        components.push(
          {
            name: 'database',
            status: 'not_configured',
            message: 'No database connection registered at the API gateway',
          },
          {
            name: 'redis',
            status: 'not_configured',
            message: 'No Redis connection registered at the API gateway',
          },
        );
      }

      components.push(
        {
          name: 'ai',
          status: 'not_configured',
          message: 'No AI provider health registered at the API gateway',
        },
        {
          name: 'queue',
          status: 'not_configured',
          message: 'No background queue configured',
        },
      );

      const degradedCount = components.filter((c) => c.status === 'degraded').length;
      const unhealthyCount = components.filter((c) => c.status === 'unhealthy').length;
      // A hard dependency failure (e.g. database probe unhealthy) escalates to
      // critical; LifeOS unavailability remains degraded (backward compatible).
      const status: PlatformHealth['status'] =
        unhealthyCount > 0 ? 'critical' : !isHealthy || degradedCount > 0 ? 'degraded' : 'healthy';

      return {
        success: true,
        data: {
          status,
          version: runtime.version,
          gitSha: runtime.gitSha,
          buildTimestamp: runtime.buildTimestamp,
          uptime: Date.now() - startupTime,
          startedAt: runtime.startedAt,
          modules: [{ name: 'lifeOS', status: isHealthy ? 'healthy' : 'degraded' }],
          cache: {
            totalEntries: cacheTotal,
            hitRate: cacheHitRate,
            memoryUsage: cacheMemory,
          },
          runtime: {
            node: runtime.nodeVersion,
            platform: runtime.platform,
            arch: runtime.arch,
            memoryHeapMb: Math.round(runtime.memory.heapUsedBytes / 1024 / 1024),
          },
          components,
          responseTimes,
          readiness: status === 'healthy' ? 'ready' : 'not_ready',
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

    /** Platform version + build metadata (PH-002/T3) */
    version: (
      _input: unknown,
      _ctx: TRPCContext,
    ): {
      success: boolean;
      data: { version: string; gitSha?: string; buildDate: string; modules: string[] };
    } => {
      const runtime = getRuntimeInfo();
      metrics.increment('health.version.requests');
      return {
        success: true,
        data: {
          version: runtime.version,
          gitSha: runtime.gitSha,
          buildDate: runtime.buildTimestamp ?? runtime.startedAt,
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
