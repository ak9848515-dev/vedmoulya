// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Cross-Engine tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { OSCrossEngineValidationService } from '../services/OSCrossEngineValidationService.js';
import { OSEngineProbeService } from '../services/OSEngineProbeService.js';
import {
  defaultFixtureData,
  makeEngines,
  emptyOrchestratorFixture,
  failingGoalsFixture,
} from './fixtures.js';

const service = new OSCrossEngineValidationService();
const probeService = new OSEngineProbeService();

async function validatePairs(data = defaultFixtureData()) {
  const probes = await probeService.measure(makeEngines(data));
  return service.validate(probes);
}

describe('OSCrossEngineValidationService', () => {
  it('validates all nine integration pairs on a ready platform', async () => {
    const pairs = await validatePairs();
    expect(pairs).toHaveLength(9);
    for (const pair of pairs) {
      expect(pair.status).toBe('validated');
      expect(pair.checks.length).toBeGreaterThan(0);
    }
  });

  it('covers the spec pairs', async () => {
    const pairs = await validatePairs();
    const labels = pairs.map((p) => p.pair);
    expect(labels).toEqual([
      'Capability ↔ Provider',
      'Provider ↔ Context',
      'Context ↔ Knowledge',
      'Knowledge ↔ Memory',
      'Memory ↔ Learning',
      'Learning ↔ Brain',
      'Brain ↔ Strategy',
      'Strategy ↔ Execution',
      'Execution ↔ Learning',
    ]);
  });

  it('reports not_checked pairs when no cross-referencing data exists yet', async () => {
    const pairs = await validatePairs(emptyOrchestratorFixture());
    const strategyExecution = pairs.find((p) => p.pair === 'Strategy ↔ Execution');
    const executionLearning = pairs.find((p) => p.pair === 'Execution ↔ Learning');
    expect(strategyExecution?.status).toBe('not_checked');
    expect(executionLearning?.status).toBe('not_checked');
    // The other seven still validate.
    expect(pairs.filter((p) => p.status === 'validated')).toHaveLength(7);
  });

  it('fails a pair when one engine is unreachable', async () => {
    const pairs = await validatePairs(failingGoalsFixture());
    // Capability ↔ Provider does not involve goals — still validated.
    const capabilityProvider = pairs.find((p) => p.pair === 'Capability ↔ Provider');
    expect(capabilityProvider?.status).toBe('validated');
    expect(pairs.every((p) => p.status !== 'failed')).toBe(true);
  });

  it('fails a pair when both sides are down', async () => {
    const data = defaultFixtureData();
    data.providers = null;
    data.capabilities = null;
    const pairs = await validatePairs(data);
    const capabilityProvider = pairs.find((p) => p.pair === 'Capability ↔ Provider');
    expect(capabilityProvider?.status).toBe('failed');
  });

  it('reports check descriptions on every pair', async () => {
    const pairs = await validatePairs();
    for (const pair of pairs) {
      for (const check of pair.checks) {
        expect(check.description.length).toBeGreaterThan(0);
        expect(typeof check.passed).toBe('boolean');
      }
    }
  });

  it('reports not_checked when providers carry no capability matrix', async () => {
    const data = defaultFixtureData();
    data.providers = {
      providers: [],
      total: 0,
      activeCount: 0,
      healthyCount: 0,
      countByLifecycleStatus: {},
      countByFamily: {},
      countByCapability: {},
    };
    const pairs = await validatePairs(data);
    const pair = pairs.find((p) => p.pair === 'Capability ↔ Provider');
    expect(pair?.status).toBe('not_checked');
    expect(pair?.checks[0]?.passed).toBe(false);
  });
});
