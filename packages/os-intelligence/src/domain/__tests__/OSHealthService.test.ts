// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Health tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { OSHealthService } from '../services/OSHealthService.js';
import {
  defaultFixtureData,
  makeEngines,
  failingGoalsFixture,
  emptyOrchestratorFixture,
} from './fixtures.js';

const service = new OSHealthService();

describe('OSHealthService.systemHealth', () => {
  it('reports every engine healthy on a ready platform', async () => {
    const health = await service.systemHealth(makeEngines());
    expect(health.engines).toHaveLength(11);
    for (const engine of health.engines) {
      expect(engine.status).toBe('healthy');
      expect(engine.consulted).toBe(true);
    }
  });

  it('extracts totals and a human summary per engine', async () => {
    const health = await service.systemHealth(makeEngines());
    const goals = health.engines.find((e) => e.engine === 'goals');
    expect(goals?.totals.goals).toBe(5);
    expect(goals?.totals.tasks).toBe(12);
    expect(goals?.dataSummary).toContain('goals 5');
    const memory = health.engines.find((e) => e.engine === 'memory');
    expect(memory?.totals.citations).toBe(21);
  });

  it('measures latency on every engine', async () => {
    const health = await service.systemHealth(makeEngines());
    for (const engine of health.engines) {
      expect(engine.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('flags an unreachable engine as unhealthy with the error preserved', async () => {
    const health = await service.systemHealth(makeEngines(failingGoalsFixture()));
    const goals = health.engines.find((e) => e.engine === 'goals');
    expect(goals?.status).toBe('unhealthy');
    expect(goals?.error).toBeDefined();
  });

  it('marks an answered-but-empty engine as degraded', async () => {
    const data = defaultFixtureData();
    data.orchestrator = {
      totalGraphs: 0,
      totalSessions: 0,
      activeSessions: 0,
      completedSessions: 0,
      failedSessions: 0,
      totalWorkers: 2,
      idleWorkers: 2,
      busyWorkers: 0,
      statusByState: {},
    };
    const health = await service.systemHealth(makeEngines(data));
    const orchestrator = health.engines.find((e) => e.engine === 'orchestrator');
    expect(orchestrator?.status).toBe('degraded');
    expect(orchestrator?.totals.graphs).toBe(0);
  });

  it('computes the overall OS health score', async () => {
    const health = await service.systemHealth(makeEngines());
    expect(health.overallScore).toBeGreaterThanOrEqual(90);
    expect(health.status).toBe('healthy');
  });

  it('lowers the score when an engine is down', async () => {
    const healthy = await service.systemHealth(makeEngines());
    const unhealthy = await service.systemHealth(makeEngines(failingGoalsFixture()));
    expect(unhealthy.overallScore).toBeLessThan(healthy.overallScore);
    expect(unhealthy.status).not.toBe('healthy');
  });

  it('reports repository readiness for all engines', async () => {
    const health = await service.systemHealth(makeEngines());
    expect(health.repositories).toHaveLength(11);
    expect(health.repositories.every((r) => r.status === 'ready')).toBe(true);
    const memory = health.repositories.find((r) => r.engine === 'memory');
    expect(memory?.table).toBe('memory_registry');
  });

  it('reports the pipeline state', async () => {
    const health = await service.systemHealth(makeEngines());
    expect(health.pipeline.valid).toBe(true);
    expect(health.pipeline.overallStatus).toBe('ready');
    expect(health.pipeline.stages).toHaveLength(15);
  });

  it('degrades the pipeline when the orchestrator store is empty', async () => {
    const health = await service.systemHealth(makeEngines(emptyOrchestratorFixture()));
    expect(health.pipeline.valid).toBe(true);
    expect(health.pipeline.overallStatus).toBe('degraded');
    expect(health.pipeline.notStartedStages).toBeGreaterThan(0);
  });

  it('reports cross-engine pairs', async () => {
    const health = await service.systemHealth(makeEngines());
    expect(health.crossEngine).toHaveLength(9);
    expect(health.crossEngine.every((p) => p.status === 'validated')).toBe(true);
  });

  it('reports diagnostics with zero critical findings on a ready platform', async () => {
    const health = await service.systemHealth(makeEngines());
    expect(health.diagnostics.critical).toBe(0);
    expect(health.diagnostics.passed).toBeGreaterThan(0);
  });

  it('reports performance metrics from the measured pass', async () => {
    const health = await service.systemHealth(makeEngines());
    expect(health.performance.totalCalls).toBe(11);
    expect(health.performance.perEngine).toHaveLength(11);
    expect(health.performance.endToEndLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('timestamps the pass', async () => {
    const health = await service.systemHealth(makeEngines());
    expect(new Date(health.checkedAt).getTime()).not.toBeNaN();
  });
});

describe('OSHealthService.aggregate / statusFromProbe', () => {
  it('aggregates a health report from an existing probe pass without re-calling', async () => {
    const engine = makeEngines();
    const probes = await new (
      await import('../services/OSEngineProbeService.js')
    ).OSEngineProbeService().measure(engine);
    const health = service.aggregate(probes);
    expect(health.engines).toHaveLength(11);
    expect(health.pipeline.valid).toBe(true);
  });

  it('summarizes an unreachable engine', () => {
    const status = service.statusFromProbe({
      spec: {
        engine: 'goals',
        name: 'Enterprise Goal & Task Intelligence Engine',
        packageName: '@vedmoulya/goals',
        sprint: 'EI-006',
        repository: 'PostgresGoalRepository',
        table: 'goal_registry',
        port: 'goals',
      },
      success: false,
      data: undefined,
      error: 'down',
      latencyMs: 0,
    });
    expect(status.status).toBe('unhealthy');
    expect(status.dataSummary).toBe('unreachable');
  });
});
