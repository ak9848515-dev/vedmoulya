// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Engine Probe
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The single measured pass over every engine port. One probe per
// engine: the port result, the measured latency, and the engine spec.
// All probes run in parallel (the OS health pass is a fan-out, not a
// sequence), which is what makes the end-to-end latency equal to the
// slowest engine rather than the sum.
// ──────────────────────────────────────────────────────────────────

import type { OSEngines } from '../../contracts/os-engines.js';
import type { OSEngineId } from '../../types/os-types.js';
import { OS_ENGINE_SPECS } from '../../catalog/os-catalog.js';
import type { OSEngineSpec } from '../../catalog/os-catalog.js';

export interface OSEngineProbe {
  spec: OSEngineSpec;
  /** The owning engine's port answered. */
  success: boolean;
  /** The engine's DTO payload (unknown — consumed through tolerant accessors). */
  data: unknown;
  error?: string;
  /** Measured port latency in ms. */
  latencyMs: number;
}

export interface OSPortResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class OSEngineProbeService {
  /**
   * Measure every engine port in parallel. Each engine is called through
   * the exact method its application service exposes (the same seam the
   * memory/knowledge/brain layers use) — no dynamic dispatch, no
   * duplicated logic.
   */
  async measure(engines: OSEngines): Promise<OSEngineProbe[]> {
    const probes = await Promise.all(
      OS_ENGINE_SPECS.map(async (spec): Promise<OSEngineProbe> => {
        const startedAt = performance.now();
        const result = await this.call(engines, spec.engine);
        return {
          spec,
          success: result.success,
          data: result.data,
          error: result.error,
          latencyMs: Math.max(0, performance.now() - startedAt),
        };
      }),
    );
    return probes;
  }

  private async call(engines: OSEngines, engine: OSEngineId): Promise<OSPortResult> {
    try {
      switch (engine) {
        case 'goals':
          return await engines.goals.getSummary();
        case 'capabilities':
          return await engines.capabilities.getMarketplace();
        case 'providers':
          return await engines.providers.getMarketplace();
        case 'context':
          return await engines.context.getContextSummary();
        case 'strategy':
          return await engines.strategies.getSummary();
        case 'orchestrator':
          return await engines.orchestrator.getSummary();
        case 'intelligence':
          return await engines.intelligence.getDashboard();
        case 'learning':
          return await engines.learning.getDashboard();
        case 'brain':
          return await engines.brain.getDashboard();
        case 'knowledge':
          return await engines.knowledge.getDashboard();
        case 'memory':
          return await engines.memory.getDashboard();
        default:
          return { success: false, error: 'unknown engine' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
