// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Probe tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { OSEngineProbeService } from '../OSEngineProbeService.js';
import { makeEngines } from '../../../domain/__tests__/fixtures.js';

const service = new OSEngineProbeService();

describe('OSEngineProbeService', () => {
  it('probes all eleven engines', async () => {
    const probes = await service.measure(makeEngines());
    expect(probes).toHaveLength(11);
    for (const probe of probes) {
      expect(probe.success).toBe(true);
      expect(probe.data).toBeDefined();
    }
  });

  it('captures a thrown port error as an unhealthy probe', async () => {
    const engines = makeEngines();
    engines.goals = {
      getSummary: async () => {
        throw new Error('port exploded');
      },
    };
    const probes = await service.measure(engines);
    const goals = probes.find((p) => p.spec.engine === 'goals');
    expect(goals?.success).toBe(false);
    expect(goals?.error).toContain('port exploded');
  });

  it('measures latency per probe', async () => {
    const probes = await service.measure(makeEngines());
    for (const probe of probes) {
      expect(probe.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });
});
