// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Diagnostics tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { OSDiagnosticsService } from '../services/OSDiagnosticsService.js';
import { OSHealthService } from '../services/OSHealthService.js';
import {
  defaultFixtureData,
  makeEngines,
  failingGoalsFixture,
  emptyOrchestratorFixture,
} from './fixtures.js';
import type { OSDiagnosticsInput } from '../services/OSDiagnosticsService.js';

const service = new OSDiagnosticsService();
const healthService = new OSHealthService();

async function runReport(data = defaultFixtureData()) {
  const health = await healthService.systemHealth(makeEngines(data));
  const input: OSDiagnosticsInput = {
    engineStatuses: health.engines,
    dependencies: health.dependencies,
    pipeline: health.pipeline,
    crossEngine: health.crossEngine,
    repositoryStatuses: health.repositories,
  };
  return service.report(input);
}

describe('OSDiagnosticsService', () => {
  it('passes every check on a ready platform', async () => {
    const report = await runReport();
    expect(report.critical).toBe(0);
    expect(report.failed).toBe(0);
    expect(report.passed).toBeGreaterThan(0);
    expect(report.healthScore).toBeGreaterThanOrEqual(90);
    expect(report.total).toBe(report.passed + report.warnings + report.critical);
  });

  it('covers the spec categories', async () => {
    const report = await runReport();
    const categories = new Set(report.findings.map((f) => f.category));
    for (const expected of [
      'engine',
      'dependency',
      'contract',
      'repository',
      'pipeline',
      'lifecycle',
      'event_flow',
      'ownership',
      'database',
    ]) {
      expect(categories.has(expected as never)).toBe(true);
    }
  });

  it('reports critical findings for an unreachable engine', async () => {
    const report = await runReport(failingGoalsFixture());
    expect(report.critical).toBeGreaterThan(0);
    const engineFinding = report.findings.find((f) => f.id === 'os-diag-engine-goals');
    expect(engineFinding?.severity).toBe('critical');
    expect(engineFinding?.message).toContain('unreachable');
    expect(report.healthScore).toBeLessThan(90);
  });

  it('warns on empty-but-available engines and not-started pipeline stages', async () => {
    const report = await runReport(emptyOrchestratorFixture());
    expect(report.warnings).toBeGreaterThan(0);
    const eventFlow = report.findings.find((f) => f.id === 'os-diag-event-flow');
    expect(eventFlow?.severity).toBe('warning');
    expect(eventFlow?.message).toContain('not started');
  });

  it('issues per-engine repository findings', async () => {
    const report = await runReport();
    const repoFinding = report.findings.find((f) => f.id === 'os-diag-repo-memory');
    expect(repoFinding?.severity).toBe('info');
    expect(repoFinding?.message).toContain('memory_registry');
  });

  it('reports the consultation contract coverage', async () => {
    const report = await runReport();
    const contract = report.findings.find((f) => f.id === 'os-diag-deps-contract');
    expect(contract?.severity).toBe('info');
    expect(contract?.message).toContain('consultation matrix covers');
  });

  it('warns on degraded (empty-but-available) engines', async () => {
    const report = await runReport(emptyOrchestratorFixture());
    const orchestrator = report.findings.find((f) => f.id === 'os-diag-engine-orchestrator');
    expect(orchestrator?.severity).toBe('warning');
    expect(orchestrator?.message).toContain('no registry data');
  });

  it('warns on not_checked cross-engine pairs', async () => {
    const report = await runReport(emptyOrchestratorFixture());
    const pair = report.findings.find((f) => f.id === 'os-diag-crossengine-strategy-orchestrator');
    expect(pair?.severity).toBe('warning');
    expect(pair?.message).toContain('no cross-referencing data');
  });

  it('reports the 15-stage pipeline category finding', async () => {
    const report = await runReport();
    const pipeline = report.findings.find((f) => f.id === 'os-diag-pipeline');
    expect(pipeline?.severity).toBe('info');
    expect(pipeline?.message).toContain('15-stage pipeline ready');
  });

  it('reports critical cross-engine findings when both sides are down', async () => {
    const data = defaultFixtureData();
    data.providers = null;
    data.capabilities = null;
    const report = await runReport(data);
    const pair = report.findings.find((f) => f.id === 'os-diag-crossengine-capabilities-providers');
    expect(pair?.severity).toBe('critical');
    expect(pair?.message).toContain('failed');
  });

  it('reports database migration readiness incomplete when a repository is missing', () => {
    const input: OSDiagnosticsInput = {
      engineStatuses: [],
      dependencies: {
        nodes: [],
        packageEdges: [],
        consultationEdges: [],
        packageCycles: [],
        consultationCycles: [],
        acyclic: true,
        matrix: {},
      },
      pipeline: {
        stages: [],
        overallStatus: 'ready',
        totalLatencyMs: 0,
        valid: true,
        passedStages: 15,
        notStartedStages: 0,
        failedStages: 0,
      },
      crossEngine: [],
      repositoryStatuses: [
        {
          engine: 'goals',
          repository: 'x',
          table: 'goal_registry',
          persisted: false,
          status: 'missing',
        },
      ],
    };
    const report = service.report(input);
    const database = report.findings.find((f) => f.id === 'os-diag-db-migration');
    expect(database?.severity).toBe('critical');
    expect(database?.message).toContain('incomplete');
    const repoFinding = report.findings.find((f) => f.id === 'os-diag-repo-goals');
    expect(repoFinding?.severity).toBe('critical');
  });
});
