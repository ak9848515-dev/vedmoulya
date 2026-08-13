// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Tests: ExecutionStrategyApplicationService
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionStrategyApplicationService } from '../ExecutionStrategyApplicationService.js';
import { InMemoryExecutionStrategyRepository } from '../../infrastructure/InMemoryExecutionStrategyRepository.js';
import { createCatalogStrategies } from '../../catalog/strategy-catalog.js';
import { StrategyMapper } from '../StrategyMapper.js';

function createService() {
  const repository = new InMemoryExecutionStrategyRepository(createCatalogStrategies());
  return { service: new ExecutionStrategyApplicationService(repository), repository };
}

describe('ExecutionStrategyApplicationService', () => {
  it('returns the strategy summary from the seeded registry', async () => {
    const { service } = createService();
    const result = await service.getSummary();
    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(4);
    expect(result.data?.averageConfidence).toBeGreaterThan(0);
    expect(Object.values(result.data!.countByPriority).reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('lists all strategies as DTOs', async () => {
    const { service } = createService();
    const result = await service.listStrategies();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(4);
    const dto = result.data![0]!;
    expect(dto).toHaveProperty('strategyId');
    expect(dto).toHaveProperty('capabilityPlan');
    expect(dto).toHaveProperty('providerCandidates');
    expect(dto).toHaveProperty('fallbackPlan');
    expect(dto).toHaveProperty('validation');
  });

  it('fetches a single strategy by id', async () => {
    const { service, repository } = createService();
    const id = (await repository.listAll())[0]!.strategyId;
    const result = await service.getStrategy(id);
    expect(result.success).toBe(true);
    expect(result.data?.strategyId).toBe(id);
  });

  it('returns a failure for an unknown strategy', async () => {
    const { service } = createService();
    const result = await service.getStrategy('strategy_missing');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('creates a strategy and maps it to a full DTO', async () => {
    const { service } = createService();
    const result = await service.createStrategy({
      goalId: 'goal_new',
      goal: 'Generate a blog post about renewable energy',
      business: ['platform'],
      priority: 'high',
      qualityTier: 'premium',
      maxCostUsd: 2,
      maxLatencyMs: 30000,
    });
    expect(result.success).toBe(true);
    const dto = result.data!;
    expect(dto.strategyId).toMatch(/^strategy_/);
    expect(dto.capabilityPlan.steps.length).toBeGreaterThan(0);
    expect(dto.providerCandidates.length).toBeGreaterThan(0);
    expect(dto.validation.passed).toBe(true);
    expect(dto.tokenBudget.maximumTokens).toBeGreaterThan(0);
    expect(dto.risk.level).toBeDefined();
    expect(dto.retryPolicy.stopConditions.length).toBeGreaterThan(0);
  });

  it('validates an existing strategy', async () => {
    const { service, repository } = createService();
    const id = (await repository.listAll())[0]!.strategyId;
    const result = await service.validateStrategy(id);
    expect(result.success).toBe(true);
    expect(result.data?.validation.passed).toBe(true);
  });

  it('searches strategies by query', async () => {
    const { service } = createService();
    const result = await service.searchStrategies({ query: 'blog', page: 1, limit: 10 });
    expect(result.success).toBe(true);
    expect(result.data!.items.length).toBeGreaterThan(0);
    expect(result.data!.items.every((s) => s.goal.toLowerCase().includes('blog'))).toBe(true);
  });

  it('lists strategies by priority, mode, capability, and goal', async () => {
    const { service, repository } = createService();
    const all = await repository.listAll();

    const byPriority = await service.listByPriority('high');
    expect(byPriority.data!.every((s) => s.priority === 'high')).toBe(true);

    const byMode = await service.listByExecutionMode('sequential');
    expect(byMode.data!.every((s) => s.executionMode === 'sequential')).toBe(true);

    const byCapability = await service.listByCapability('content_generation');
    expect(byCapability.data!.length).toBeGreaterThan(0);

    const byGoal = await service.listByGoal(all[0]!.goalId);
    expect(byGoal.data!.every((s) => s.goalId === all[0]!.goalId)).toBe(true);
  });

  it('explains a strategy', async () => {
    const { service, repository } = createService();
    const id = (await repository.listAll())[0]!.strategyId;
    const result = await service.explainStrategy(id);
    expect(result.success).toBe(true);
    expect(result.data?.strategyId).toBe(id);
    expect(result.data?.capabilitySummary).toBeTruthy();
    expect(result.data?.providerSummary).toContain('Top candidate');
    expect(result.data?.budgetSummary).toContain('$');
    expect(result.data?.validationSummary).toBeTruthy();
  });

  it('deletes a strategy', async () => {
    const { service, repository } = createService();
    const id = (await repository.listAll())[0]!.strategyId;
    const result = await service.deleteStrategy(id);
    expect(result.success).toBe(true);
    expect((await service.getStrategy(id)).success).toBe(false);
  });

  it('estimates tokens without persisting a strategy', async () => {
    const { service } = createService();
    const result = await service.estimateTokens('Generate a blog post', 'standard', 5000);
    expect(result.success).toBe(true);
    expect(result.data?.maximumTokens).toBe(5000);
    expect(result.data?.expectedTokens).toBeGreaterThan(0);
  });

  it('estimates cost with the estimate DTO shape', async () => {
    const { service } = createService();
    const result = await service.estimateCost('Generate a blog post', 'premium', 5);
    expect(result.success).toBe(true);
    expect(result.data?.minimumCostUsd).toBeDefined();
    expect(result.data?.maximumCostUsd).toBeDefined();
    expect(result.data!.minimumCostUsd).toBeLessThanOrEqual(result.data!.maximumCostUsd);
  });

  it('estimates latency with the estimate DTO shape', async () => {
    const { service } = createService();
    const result = await service.estimateLatency('Generate a blog post', 'standard', 20000);
    expect(result.success).toBe(true);
    expect(result.data?.minimumTimeMs).toBeDefined();
    expect(result.data?.maximumTimeMs).toBe(20000);
  });

  it('maps domain strategies via StrategyMapper', async () => {
    const { service, repository } = createService();
    const strategy = (await repository.listAll())[0]!;
    const dto = StrategyMapper.toDTO(strategy);
    expect(dto.goal).toBe(strategy.goal);
    expect(dto.capabilityPlan.steps).toHaveLength(strategy.capabilityPlan.steps.length);
    expect(dto.providerCandidates).toHaveLength(strategy.providerCandidates.length);
  });
});
