// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Performance tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { OSPerformanceService } from '../services/OSPerformanceService.js';
import { OSEngineProbeService } from '../services/OSEngineProbeService.js';
import { makeEngines } from './fixtures.js';

const service = new OSPerformanceService();

describe('OSPerformanceService', () => {
  it('records one call per engine with latency', async () => {
    const probes = await new OSEngineProbeService().measure(makeEngines());
    const metrics = service.metrics(probes);
    expect(metrics.perEngine).toHaveLength(11);
    expect(metrics.totalCalls).toBe(11);
    for (const metric of metrics.perEngine) {
      expect(metric.calls).toBe(1);
      expect(metric.avgLatencyMs).toBe(metric.totalLatencyMs);
      expect(metric.totalLatencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('computes the end-to-end latency as the slowest parallel engine', () => {
    const probes = [
      {
        spec: {
          engine: 'goals',
          name: 'x',
          packageName: 'p',
          sprint: 's',
          repository: 'r',
          table: 't',
          port: 'goals',
        },
        success: true,
        data: {},
        latencyMs: 10,
      },
      {
        spec: {
          engine: 'memory',
          name: 'x',
          packageName: 'p',
          sprint: 's',
          repository: 'r',
          table: 't',
          port: 'memory',
        },
        success: true,
        data: {},
        latencyMs: 40,
      },
      {
        spec: {
          engine: 'brain',
          name: 'x',
          packageName: 'p',
          sprint: 's',
          repository: 'r',
          table: 't',
          port: 'brain',
        },
        success: true,
        data: {},
        latencyMs: 25,
      },
    ] as never;
    const metrics = service.metrics(probes);
    expect(metrics.endToEndLatencyMs).toBe(40);
  });

  it('returns zero end-to-end latency for an empty pass', () => {
    const metrics = service.metrics([]);
    expect(metrics.endToEndLatencyMs).toBe(0);
    expect(metrics.totalCalls).toBe(0);
    expect(metrics.perEngine).toEqual([]);
  });

  it('timestamps the metrics', () => {
    const metrics = service.metrics([]);
    expect(new Date(metrics.checkedAt).getTime()).not.toBeNaN();
  });
});
