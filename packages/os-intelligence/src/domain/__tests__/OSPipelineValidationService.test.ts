// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Pipeline Validation tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { OSPipelineValidationService } from '../services/OSPipelineValidationService.js';
import { OSEngineProbeService } from '../services/OSEngineProbeService.js';
import { OSPIPELINE_STAGES } from '../../catalog/os-pipeline.js';
import {
  defaultFixtureData,
  makeEngines,
  failingGoalsFixture,
  emptyOrchestratorFixture,
} from './fixtures.js';

const service = new OSPipelineValidationService();
const probeService = new OSEngineProbeService();

async function validate(data = defaultFixtureData()) {
  const probes = await probeService.measure(makeEngines(data));
  return service.validate(probes);
}

describe('OSPipelineValidationService', () => {
  it('validates all 15 stages in canonical order', async () => {
    const health = await validate();
    expect(health.stages.map((s) => s.stage)).toEqual(OSPIPELINE_STAGES);
    expect(health.passedStages).toBe(15);
    expect(health.overallStatus).toBe('ready');
    expect(health.valid).toBe(true);
  });

  it('marks every stage with evidence detail', async () => {
    const health = await validate();
    for (const stage of health.stages) {
      expect(stage.detail.length).toBeGreaterThan(0);
    }
  });

  it('reports not_started stages when an engine store is empty (available, not exercised)', async () => {
    const health = await validate(emptyOrchestratorFixture());
    expect(health.valid).toBe(true);
    expect(health.overallStatus).toBe('degraded');
    expect(health.notStartedStages).toBe(2);
    const graph = health.stages.find((s) => s.stage === 'execution_graph');
    expect(graph?.status).toBe('not_started');
    expect(graph?.detail).toContain('0 execution graph');
  });

  it('blocks the pipeline when an engine is unreachable', async () => {
    const health = await validate(failingGoalsFixture());
    expect(health.valid).toBe(false);
    expect(health.overallStatus).toBe('blocked');
    expect(health.failedStages).toBeGreaterThan(0);
    const goal = health.stages.find((s) => s.stage === 'goal');
    expect(goal?.status).toBe('failed');
    expect(goal?.error).toBeDefined();
  });

  it('sums per-stage latency from the probe pass', async () => {
    const health = await validate();
    expect(health.totalLatencyMs).toBeGreaterThanOrEqual(0);
    const sum = health.stages.reduce((acc, s) => acc + s.latencyMs, 0);
    expect(health.totalLatencyMs).toBe(sum);
  });

  it('reports knowledge_update not_started when nothing consumes knowledge yet', async () => {
    const data = defaultFixtureData();
    data.knowledge = {
      totals: {
        items: 30,
        active: 30,
        review: 0,
        validated: 30,
        deprecated: 0,
        relationships: 26,
        citations: 0,
        consumers: 0,
        totalReads: 0,
        avgTrust: 0.8,
        avgConfidence: 0.8,
      },
      byCategory: {},
      byLifecycle: {},
      byValidation: {},
      trustDistribution: [],
      trend: [],
      recentItems: [],
      topTrusted: [],
      mostConsumed: [],
    };
    const health = await validate(data);
    const update = health.stages.find((s) => s.stage === 'knowledge_update');
    expect(update?.status).toBe('not_started');
    expect(update?.detail).toContain('no knowledge consumption');
  });

  it('marks a missing probe stage as skipped', () => {
    const health = service.validate([]);
    expect(health.stages).toHaveLength(15);
    expect(health.stages[0]?.status).toBe('skipped');
    expect(health.overallStatus).toBe('blocked');
  });

  it('reports memory_update not_started when nothing consumes memories yet', async () => {
    const data = defaultFixtureData();
    data.memory = {
      totals: {
        memories: 23,
        active: 23,
        archived: 0,
        expired: 0,
        relationships: 0,
        citations: 0,
        consumers: 0,
        totalRetrievals: 0,
        avgImportance: 0.6,
        avgConfidence: 0.7,
        avgRecency: 0.5,
      },
      byType: { learning: 0 },
      byLifecycle: {},
      byCompression: {},
      importanceDistribution: [],
      retentionCountdown: [],
      trend: [],
      recentMemories: [],
      mostImportant: [],
      mostRetrieved: [],
    };
    const health = await validate(data);
    const update = health.stages.find((s) => s.stage === 'memory_update');
    expect(update?.status).toBe('not_started');
    expect(update?.detail).toContain('no memory consumption');
  });

  it('handles sparse engine data (missing keys) with evidence fallbacks', async () => {
    const sparse = {
      goals: {},
      capabilities: {},
      providers: {},
      context: {},
      strategy: {},
      orchestrator: {},
      intelligence: {},
      learning: {},
      brain: {},
      knowledge: {},
      memory: {},
    };
    const health = await validate(sparse);
    expect(health.valid).toBe(true);
    expect(health.notStartedStages).toBe(15);
    for (const stage of health.stages) {
      expect(stage.status).toBe('not_started');
      expect(stage.detail.length).toBeGreaterThan(0);
    }
  });

  it('falls back to the defensive evidence default for unknown stages', () => {
    const probe = {
      spec: {
        engine: 'goals' as never,
        name: 'x',
        packageName: 'p',
        sprint: 's',
        repository: 'r',
        table: 't',
        port: 'goals',
      },
      success: true,
      data: { totalGoals: 5 },
      latencyMs: 0,
    } as never;
    const evidence = service.evidence('goal' as never, probe);
    expect(evidence.hasData).toBe(true);
    const fallback = service.evidence('unknown_stage' as never, probe);
    expect(fallback.hasData).toBe(false);
    expect(fallback.detail).toBe('stage not validated');
  });
});
