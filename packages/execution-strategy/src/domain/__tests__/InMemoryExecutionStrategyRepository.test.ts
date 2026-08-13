// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Tests: InMemoryExecutionStrategyRepository
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryExecutionStrategyRepository } from '../../infrastructure/InMemoryExecutionStrategyRepository.js';
import { createCatalogStrategies } from '../../catalog/strategy-catalog.js';
import { createStrategyId } from '../value-objects/StrategyId.js';

function seedId(strategy: (typeof seed)[number]): ReturnType<typeof createStrategyId> {
  return createStrategyId(strategy.strategyId);
}

describe('InMemoryExecutionStrategyRepository', () => {
  const seed = createCatalogStrategies();

  it('seeds strategies via the catalog', () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    return expect(repo.count()).resolves.toBe(4);
  });

  it('finds and checks strategies by id', async () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    const found = await repo.findById(seedId(seed[0]!));
    expect(found).not.toBeNull();
    expect(await repo.exists(seedId(seed[0]!))).toBe(true);
    expect(await repo.exists(createStrategyId('missing_strategy'))).toBe(false);
  });

  it('returns null for unknown ids', async () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    expect(await repo.findById(createStrategyId('does_not_exist'))).toBeNull();
  });

  it('saves a new strategy and retrieves it', async () => {
    const repo = new InMemoryExecutionStrategyRepository([]);
    const strategy = seed[0]!;
    await repo.save(strategy);
    expect(await repo.count()).toBe(1);
    const found = await repo.findById(seedId(strategy));
    expect(found?.goal).toBe(strategy.goal);
  });

  it('saves many strategies at once', async () => {
    const repo = new InMemoryExecutionStrategyRepository([]);
    await repo.saveMany(seed);
    expect(await repo.count()).toBe(4);
  });

  it('deletes a strategy', async () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    await repo.delete(seedId(seed[0]!));
    expect(await repo.exists(seedId(seed[0]!))).toBe(false);
    expect(await repo.count()).toBe(3);
  });

  it('lists all strategies', async () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    const all = await repo.listAll();
    expect(all).toHaveLength(4);
  });

  it('searches by free-text query', async () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    const result = await repo.search({ query: 'blog' }, { page: 1, limit: 10 });
    expect(result.total).toBeGreaterThan(0);
    expect(result.data.every((s) => s.goal.toLowerCase().includes('blog'))).toBe(true);
  });

  it('filters by priority, mode, capability, business, and confidence', async () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    const byPriority = await repo.search({ priority: 'high' }, { page: 1, limit: 10 });
    expect(byPriority.data.every((s) => s.priority === 'high')).toBe(true);

    const byMode = await repo.search({ executionMode: 'sequential' }, { page: 1, limit: 10 });
    expect(byMode.data.every((s) => s.executionMode === 'sequential')).toBe(true);

    const byCapability = await repo.search(
      { capabilities: ['content_generation'] },
      { page: 1, limit: 10 },
    );
    expect(byCapability.total).toBeGreaterThan(0);

    const byBusiness = await repo.search({ business: ['platform'] }, { page: 1, limit: 10 });
    expect(byBusiness.total).toBeGreaterThan(0);

    const byConfidence = await repo.search({ minConfidence: 0.99 }, { page: 1, limit: 10 });
    expect(byConfidence.data.every((s) => s.confidence >= 0.99)).toBe(true);
  });

  it('paginates results', async () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    const page1 = await repo.search({}, { page: 1, limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(4);
    expect(page1.totalPages).toBe(2);
  });

  it('lists by priority, mode, capability, and goal', async () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    const byPriority = await repo.listByPriority('high', { page: 1, limit: 10 });
    expect(byPriority.data.every((s) => s.priority === 'high')).toBe(true);

    const byMode = await repo.listByExecutionMode('sequential', { page: 1, limit: 10 });
    expect(byMode.data.every((s) => s.executionMode === 'sequential')).toBe(true);

    const byCapability = await repo.listByCapability('content_generation', { page: 1, limit: 10 });
    expect(byCapability.total).toBeGreaterThan(0);

    const byGoal = await repo.listByGoal(seed[0]!.goalId, { page: 1, limit: 10 });
    expect(byGoal.data.every((s) => s.goalId === seed[0]!.goalId)).toBe(true);
  });

  it('computes counts and averages', async () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    const byPriority = await repo.countByPriority();
    expect(Object.values(byPriority).reduce((a, b) => a + b, 0)).toBe(4);

    const byMode = await repo.countByExecutionMode();
    expect(Object.values(byMode).reduce((a, b) => a + b, 0)).toBe(4);

    const avg = await repo.averageConfidence();
    expect(avg).toBeGreaterThan(0);
    expect(avg).toBeLessThanOrEqual(1);
  });

  it('handles an empty repository gracefully', async () => {
    const repo = new InMemoryExecutionStrategyRepository([]);
    expect(await repo.count()).toBe(0);
    expect(await repo.averageConfidence()).toBe(0);
    expect((await repo.search({}, { page: 1, limit: 10 })).total).toBe(0);
  });

  it('supports finding multiple ids at once', async () => {
    const repo = new InMemoryExecutionStrategyRepository(seed);
    const ids = seed.slice(0, 2).map((s) => seedId(s));
    const found = await repo.findByIds(ids);
    expect(found).toHaveLength(2);
  });
});
