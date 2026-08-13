// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Performance
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Measures end-to-end and per-engine latency from one probe pass.
// The OS health pass fans out to every engine in parallel, so the
// end-to-end latency is the slowest engine, not the sum — this is the
// number the OS dashboard reports as "OS health pass latency".
// ──────────────────────────────────────────────────────────────────

import type { OSPerformanceMetric, OSPerformanceMetrics } from '../../types/os-types.js';
import type { OSEngineProbe } from './OSEngineProbeService.js';

export class OSPerformanceService {
  /** Derive performance metrics from a probe pass (no re-calls). */
  metrics(probes: readonly OSEngineProbe[]): OSPerformanceMetrics {
    const perEngine: OSPerformanceMetric[] = probes.map((probe) => ({
      engine: probe.spec.engine,
      calls: 1,
      totalLatencyMs: Math.round(probe.latencyMs),
      avgLatencyMs: Math.round(probe.latencyMs),
    }));
    const endToEndLatencyMs = probes.reduce((max, probe) => Math.max(max, probe.latencyMs), 0);
    return {
      endToEndLatencyMs: Math.round(endToEndLatencyMs),
      perEngine,
      totalCalls: probes.length,
      checkedAt: new Date().toISOString(),
    };
  }
}
