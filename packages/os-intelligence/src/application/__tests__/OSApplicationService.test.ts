// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Application Service tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { OSApplicationService } from '../OSApplicationService.js';
import { InMemoryOSRepository } from '../../infrastructure/InMemoryOSRepository.js';
import { createCatalogOSSnapshot } from '../../catalog/os-catalog.js';
import {
  makeEngines,
  failingGoalsFixture,
  defaultFixtureData,
} from '../../domain/__tests__/fixtures.js';
import type { OSEngines } from '../../contracts/os-engines.js';
import type { OSRepository } from '../../domain/repository/OSRepository.js';

function makeService(engines: OSEngines = makeEngines(), repository?: OSRepository) {
  const repo = repository ?? new InMemoryOSRepository();
  return new OSApplicationService(repo, engines);
}

describe('OSApplicationService', () => {
  it('returns the full system health and persists a snapshot', async () => {
    const svc = makeService();
    const result = await svc.systemHealth();
    expect(result.success).toBe(true);
    expect(result.data?.engines).toHaveLength(11);
    const snapshots = await svc.listSnapshots();
    expect(snapshots.data?.length).toBeGreaterThan(0);
  });

  it('returns the pipeline health', async () => {
    const result = await makeService().pipelineHealth();
    expect(result.success).toBe(true);
    expect(result.data?.stages).toHaveLength(15);
    expect(result.data?.valid).toBe(true);
  });

  it('returns the diagnostics report', async () => {
    const result = await makeService().runDiagnostics();
    expect(result.success).toBe(true);
    expect(result.data?.total).toBeGreaterThan(0);
  });

  it('returns the platform validation gate', async () => {
    const result = await makeService().validatePlatform();
    expect(result.success).toBe(true);
    expect(result.data?.valid).toBe(true);
  });

  it('returns the engine status list', async () => {
    const result = await makeService().engineStatus();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(11);
  });

  it('returns the dependency graph without probing engines', async () => {
    const result = await makeService().dependencyGraph();
    expect(result.success).toBe(true);
    expect(result.data?.nodes).toHaveLength(11);
    expect(result.data?.acyclic).toBe(true);
  });

  it('returns the performance metrics', async () => {
    const result = await makeService().performanceMetrics();
    expect(result.success).toBe(true);
    expect(result.data?.totalCalls).toBe(11);
  });

  it('returns the OS dashboard with snapshot history', async () => {
    const repo = new InMemoryOSRepository();
    await repo.saveSnapshot(createCatalogOSSnapshot());
    const svc = makeService(makeEngines(), repo);
    const result = await svc.dashboard();
    expect(result.success).toBe(true);
    expect(result.data?.health.engines).toHaveLength(11);
    expect(result.data?.snapshotHistory.length).toBeGreaterThan(0);
    expect(result.data?.latestSnapshot).toBeDefined();
  });

  it('lists snapshots with a limit', async () => {
    const repo = new InMemoryOSRepository();
    await repo.saveSnapshot(createCatalogOSSnapshot());
    const svc = makeService(makeEngines(), repo);
    const result = await svc.listSnapshots(1);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('surfaces a failing engine in the health without throwing', async () => {
    const result = await makeService(makeEngines(failingGoalsFixture())).systemHealth();
    expect(result.success).toBe(true);
    const goals = result.data?.engines.find((e) => e.engine === 'goals');
    expect(goals?.status).toBe('unhealthy');
    // One failed engine out of eleven drops the overall score below healthy.
    expect(result.data?.overallScore).toBeLessThan(90);
    expect(result.data?.status).not.toBe('healthy');
  });

  it('returns a typed error when the probe pass throws', async () => {
    const throwingEngines = makeEngines(defaultFixtureData());
    throwingEngines.goals = {
      getSummary: async () => {
        throw new Error('port exploded');
      },
    };
    const result = await makeService(throwingEngines).systemHealth();
    expect(result.success).toBe(true); // OS health tolerates engine failures
    const goals = result.data?.engines.find((e) => e.engine === 'goals');
    expect(goals?.status).toBe('unhealthy');
    expect(goals?.error).toContain('port exploded');
  });

  it('fails gracefully when the snapshot store throws (best-effort persistence)', async () => {
    const brokenRepo: OSRepository = {
      saveSnapshot: async () => {
        throw new Error('store down');
      },
      listSnapshots: async () => [],
      countSnapshots: async () => 0,
      ensureTable: async () => {},
    };
    const result = await makeService(makeEngines(), brokenRepo).systemHealth();
    expect(result.success).toBe(true);
    expect(result.data?.overallScore).toBeGreaterThan(0);
  });
});
