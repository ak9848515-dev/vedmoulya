// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Adapters
// SPRINT-093 — Concrete adapter implementations for external
// integration.
// ──────────────────────────────────────────────────────────────────

import type { WorkItem, WorkItemResult } from '../types/work-item.js';
import type { ProviderHealthStatus } from '../types/provider-router.js';
import type { WorkItemHandler } from '../domain/OrchestratorService.js';
import { logger, metrics as coreMetrics } from '@vedmoulya/core';

// ── Engine Adapter ─────────────────────────────────────────────────────

export function createEngineAdapter(
  name: string,
  supportedTypes: string[],
  fn: (workItem: WorkItem) => Promise<WorkItemResult>,
): WorkItemHandler {
  return {
    supportedWorkTypes: supportedTypes as WorkItemHandler['supportedWorkTypes'],
    execute: async (workItem: WorkItem) => {
      const startTime = Date.now();
      try {
        const result = await fn(workItem);
        coreMetrics.increment(`orchestration.engine.${name}.completed`);
        return result;
      } catch (error) {
        coreMetrics.increment(`orchestration.engine.${name}.failed`);
        throw error;
      } finally {
        const elapsed = Date.now() - startTime;
        coreMetrics.increment(`orchestration.engine.${name}.latency_ms`, elapsed);
      }
    },
  };
}

// ── Provider Health Bridge ─────────────────────────────────────────────

export class ProviderHealthBridge {
  private readonly healthMap = new Map<string, ProviderHealthStatus>();

  recordObservation(
    providerName: string,
    opts: {
      latencyMs: number;
      success: boolean;
      tokensUsed?: number;
      costUsd?: number;
    },
  ): void {
    const existing = this.healthMap.get(providerName);
    const totalRequests = (existing?.totalRequests ?? 0) + 1;
    const failedRequests = (existing?.failedRequests ?? 0) + (opts.success ? 0 : 1);
    const successRate = totalRequests > 0 ? (totalRequests - failedRequests) / totalRequests : 1;
    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;
    const avgLatency = existing
      ? existing.lastLatencyMs * 0.7 + opts.latencyMs * 0.3
      : opts.latencyMs;

    const score =
      successRate * 0.6 + (1 - errorRate) * 0.3 + (1 - Math.min(avgLatency / 5000, 1)) * 0.1;

    this.healthMap.set(providerName, {
      providerName,
      status: score >= 0.8 ? 'healthy' : score >= 0.5 ? 'degraded' : 'unhealthy',
      score,
      lastLatencyMs: avgLatency,
      errorRate,
      successRate,
      totalRequests,
      failedRequests,
      lastCheckedAt: new Date().toISOString(),
    });
  }

  getHealth(providerName: string): ProviderHealthStatus | undefined {
    return this.healthMap.get(providerName);
  }

  getAllHealth(): ProviderHealthStatus[] {
    return Array.from(this.healthMap.values());
  }
}

// ── Metrics Bridge ─────────────────────────────────────────────────────

export function exportMetricsToCore(fabricMetrics: {
  queue: { depth: number; dropRate: number };
  execution: {
    activeCount: number;
    completedPerMinute: number;
    failedPerMinute: number;
    averageLatencyMs: number;
    successRate: number;
  };
  peakConcurrency: number;
  totalProcessed: number;
}): void {
  coreMetrics.setGauge('orchestration.queue.depth', fabricMetrics.queue.depth);
  coreMetrics.setGauge('orchestration.execution.active', fabricMetrics.execution.activeCount);
  coreMetrics.setGauge(
    'orchestration.execution.completed_per_min',
    fabricMetrics.execution.completedPerMinute,
  );
  coreMetrics.setGauge(
    'orchestration.execution.failed_per_min',
    fabricMetrics.execution.failedPerMinute,
  );
  coreMetrics.setGauge(
    'orchestration.execution.avg_latency_ms',
    fabricMetrics.execution.averageLatencyMs,
  );
  coreMetrics.setGauge('orchestration.execution.success_rate', fabricMetrics.execution.successRate);
  coreMetrics.setGauge('orchestration.peak_concurrency', fabricMetrics.peakConcurrency);
  coreMetrics.setGauge('orchestration.total_processed', fabricMetrics.totalProcessed);
}

// ── Event Logger ──────────────────────────────────────────────────────

export function logOrchestratorEvent(event: {
  type: string;
  workItemId: string;
  correlationId: string;
  timestamp: string;
  message: string;
  metadata?: Record<string, unknown>;
}): void {
  logger.info(`[ORCHESTRATOR] ${event.type}`, {
    workItemId: event.workItemId,
    correlationId: event.correlationId,
    message: event.message,
    ...event.metadata,
  });
}
