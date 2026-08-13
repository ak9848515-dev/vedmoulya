// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Execution Strategy Repository
// EI-004 — Enterprise Execution Strategy Engine
//
// Verifies query building, JSONB row <-> entity mapping, and
// pagination WITHOUT a live database: the `postgres` module is mocked
// with a fake `sql` template-tag function (same pattern as the
// providers Postgres repository test). CERT-002 C-04.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresExecutionStrategyRepository } from '../PostgresExecutionStrategyRepository.js';
import { createStrategyId } from '../../domain/value-objects/StrategyId.js';
import type { ExecutionStrategy } from '../../types/strategy-types.js';

// ── Fake postgres `sql` ─────────────────────────────────────────────────────

function makeFakeSql(results: Array<() => unknown>): postgres.Sql {
  let idx = 0;
  const next = (): Promise<unknown> => {
    const r = results[idx] ? results[idx]() : [];
    idx += 1;
    return Promise.resolve(r);
  };
  const sql = vi.fn(() => next()) as unknown as postgres.Sql;
  sql.unsafe = vi.fn(() => next());
  return sql;
}

function strategyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'strategy_pg_1',
    data: JSON.stringify({
      strategyId: 'strategy_pg_1',
      goalId: 'goal_1',
      goal: 'Launch a newsletter',
      business: ['content-agency'],
      capabilityPlan: { requiredCapabilities: ['content_generation'] },
      providerCandidates: [],
      contextReference: { contextPackageId: 'ctx_pkg_1' },
      executionMode: 'sequential',
      modePlan: { mode: 'sequential' },
      priority: 'high',
      risk: { level: 'low', mitigations: [] },
      confidence: 0.82,
      tokenBudget: { maxTokens: 100000 },
      costBudget: { maxCostUsd: 10 },
      latencyBudget: { maxLatencyMs: 5000 },
      qualityTarget: { target: 0.9 },
      fallbackPlan: { fallbacks: [] },
      retryPolicy: { maxRetries: 2 },
      validation: { passed: true, checks: [], summary: 'ok', score: 0.9 },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: '1.0.0',
    }),
    ...overrides,
  };
}

function makeStrategy(id: string): ExecutionStrategy {
  return {
    strategyId: id,
    goalId: 'goal_1',
    goal: 'Launch a newsletter',
    business: ['content-agency'],
    capabilityPlan: { requiredCapabilities: ['content_generation'] },
    providerCandidates: [],
    contextReference: { contextPackageId: 'ctx_pkg_1' },
    executionMode: 'sequential',
    modePlan: { mode: 'sequential' },
    priority: 'high',
    risk: { level: 'low', mitigations: [] },
    confidence: 0.82,
    tokenBudget: { maxTokens: 100000 },
    costBudget: { maxCostUsd: 10 },
    latencyBudget: { maxLatencyMs: 5000 },
    qualityTarget: { target: 0.9 },
    fallbackPlan: { fallbacks: [] },
    retryPolicy: { maxRetries: 2 },
    validation: { passed: true, checks: [], summary: 'ok', score: 0.9 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: '1.0.0',
  };
}

describe('PostgresExecutionStrategyRepository', () => {
  it('saves and finds by id', async () => {
    const sql = makeFakeSql([
      () => [], // INSERT nested object call
      () => [], // INSERT outer template
      () => [strategyRow()], // SELECT by id
    ]);
    const repo = new PostgresExecutionStrategyRepository(sql);

    await repo.save(makeStrategy('strategy_pg_1'));

    const found = await repo.findById(createStrategyId('strategy_pg_1'));
    expect(found).not.toBeNull();
    expect(found?.priority).toBe('high');
    expect(found?.executionMode).toBe('sequential');
  });

  it('returns null for a missing id', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresExecutionStrategyRepository(sql);
    expect(await repo.findById(createStrategyId('missing'))).toBeNull();
  });

  it('searches and lists by priority/mode/capability/goal with pagination', async () => {
    const sql = makeFakeSql([
      () => [{ count: 1 }], // search COUNT
      () => [strategyRow()], // search rows
      () => [{ count: 1 }], // listByPriority COUNT
      () => [strategyRow()], // listByPriority rows
      () => [{ count: 1 }], // listByExecutionMode COUNT
      () => [strategyRow()], // listByExecutionMode rows
      () => [{ count: 1 }], // listByCapability COUNT
      () => [strategyRow()], // listByCapability rows
      () => [{ count: 1 }], // listByGoal COUNT
      () => [strategyRow()], // listByGoal rows
    ]);
    const repo = new PostgresExecutionStrategyRepository(sql);
    const params = { page: 1, limit: 10 };

    const searched = await repo.search({ priority: 'high', minConfidence: 0.5 }, params);
    expect(searched.total).toBe(1);

    expect((await repo.listByPriority('high', params)).total).toBe(1);
    expect((await repo.listByExecutionMode('sequential', params)).total).toBe(1);
    expect((await repo.listByCapability('content_generation', params)).total).toBe(1);
    expect((await repo.listByGoal('goal_1', params)).total).toBe(1);
  });

  it('computes statistics', async () => {
    const sql = makeFakeSql([
      () => [{ count: 1 }], // count
      () => [{ priority: 'high', count: 1 }], // countByPriority
      () => [{ mode: 'sequential', count: 1 }], // countByExecutionMode
      () => [{ avg: 0.82 }], // averageConfidence
    ]);
    const repo = new PostgresExecutionStrategyRepository(sql);
    expect(await repo.count()).toBe(1);
    expect((await repo.countByPriority()).high).toBe(1);
    expect((await repo.countByExecutionMode()).sequential).toBe(1);
    expect(await repo.averageConfidence()).toBeCloseTo(0.82);
  });

  it('deletes and checks existence', async () => {
    const sql = makeFakeSql([
      () => [], // DELETE
      () => [{ exists: true }],
    ]);
    const repo = new PostgresExecutionStrategyRepository(sql);
    await expect(repo.delete(createStrategyId('strategy_pg_1'))).resolves.toBeUndefined();
    expect(await repo.exists(createStrategyId('strategy_pg_1'))).toBe(true);
  });

  it('saves many and finds by ids', async () => {
    const sql = makeFakeSql([
      () => [], // INSERT nested
      () => [], // INSERT outer
      () => [], // INSERT nested
      () => [], // INSERT outer
      () => [strategyRow()], // findByIds rows
    ]);
    const repo = new PostgresExecutionStrategyRepository(sql);
    await repo.saveMany([makeStrategy('a'), makeStrategy('b')]);
    const found = await repo.findByIds([createStrategyId('a'), createStrategyId('b')]);
    expect(found).toHaveLength(1);
  });

  it('searches with every filter branch', async () => {
    const sql = makeFakeSql([
      () => [{ count: 1 }], // COUNT
      () => [strategyRow()], // rows
      () => [{ count: 1 }], // COUNT
      () => [strategyRow()], // rows
    ]);
    const repo = new PostgresExecutionStrategyRepository(sql);
    const params = { page: 1, limit: 10 };

    const full = await repo.search(
      {
        query: 'newsletter',
        priority: 'high',
        executionMode: 'sequential',
        capabilities: ['content_generation'],
        business: ['content-agency'],
        minConfidence: 0.5,
      },
      params,
    );
    expect(full.total).toBe(1);

    const empty = await repo.search({}, params);
    expect(empty.total).toBe(1);
  });

  it('lists all strategies', async () => {
    const sql = makeFakeSql([() => [strategyRow()]]);
    const repo = new PostgresExecutionStrategyRepository(sql);
    expect(await repo.listAll()).toHaveLength(1);
  });

  it('returns empty for an empty findByIds array', async () => {
    const sql = makeFakeSql([]);
    const repo = new PostgresExecutionStrategyRepository(sql);
    expect(await repo.findByIds([])).toEqual([]);
  });
});
