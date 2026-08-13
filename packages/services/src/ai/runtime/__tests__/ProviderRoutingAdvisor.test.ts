import { describe, it, expect } from 'vitest';
import { ProviderRoutingAdvisor } from '../ProviderRoutingAdvisor.js';
import type {
  ExecutionStrategyPort,
  ProviderCandidateIntelligence,
  ProviderIntelligencePort,
} from '../ProviderRoutingAdvisor.js';

function candidate(
  overrides: Partial<ProviderCandidateIntelligence> = {},
): ProviderCandidateIntelligence {
  return {
    providerId: 'openai',
    family: 'openai',
    capabilities: ['reasoning', 'coding'],
    healthy: true,
    models: [{ id: 'gpt-4o-mini', contextWindow: 128000, maxOutputTokens: 4096, streaming: true }],
    benchmarkScore: 92,
    averageLatencyMs: 1200,
    costPer1KInput: 0.15,
    costPer1KOutput: 0.6,
    ...overrides,
  };
}

function strategy(
  overrides: Partial<Awaited<ReturnType<ExecutionStrategyPort['getRoutingContext']>>> = {},
) {
  return overrides;
}

describe('ProviderRoutingAdvisor', () => {
  it('selects the highest-scoring provider deterministically with reasons', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({ providerId: 'openai', benchmarkScore: 92, averageLatencyMs: 1200 }),
        candidate({ providerId: 'anthropic', benchmarkScore: 88, averageLatencyMs: 900 }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);

    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });

    expect(decision.selected.providerId).toBe('openai');
    expect(decision.selected.reasons.length).toBeGreaterThan(0);
    expect(decision.selected.reasons).toContain('capability compatible');
    expect(decision.fallback[0].providerId).toBe('anthropic');
    expect(decision.candidatesConsidered).toHaveLength(2);
  });

  it('prefers the cheaper provider under a cost-first strategy when scores are close', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({ providerId: 'openai', benchmarkScore: 90, costPer1KInput: 0.15 }),
        candidate({ providerId: 'deepseek', benchmarkScore: 86, costPer1KInput: 0.01 }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'cost-first' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.strategy).toBe('cost-first');
    expect(decision.selected.providerId).toBe('deepseek');
  });

  it('excludes unhealthy providers when a healthy alternative exists', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({ providerId: 'unhealthy', healthy: false, benchmarkScore: 99 }),
        candidate({ providerId: 'healthy', benchmarkScore: 70 }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.selected.providerId).toBe('healthy');
    expect(decision.candidatesConsidered.find((c) => c.providerId === 'unhealthy')?.excluded).toBe(
      true,
    );
  });

  it('respects the execution-strategy preferred providers within a close field', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({ providerId: 'a', benchmarkScore: 85 }),
        candidate({ providerId: 'b', benchmarkScore: 90 }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced', preferredProviders: ['a'] }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.selected.providerId).toBe('a');
    expect(decision.selected.reasons).toContain('execution strategy preferred provider');
  });

  it('throws a clear error when no candidate is eligible', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [candidate({ healthy: false, benchmarkScore: 10 })],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    await expect(
      advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 }),
    ).rejects.toThrow('No eligible provider');
  });

  it('is deterministic: identical inputs produce identical decisions', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({ providerId: 'a', benchmarkScore: 80 }),
        candidate({ providerId: 'b', benchmarkScore: 80 }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const first = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    const second = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(first.selected.providerId).toBe(second.selected.providerId);
  });

  it('records the no-fitting-model reason when every model context window is too small', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({
          models: [{ id: 'small', contextWindow: 1024, maxOutputTokens: 256, streaming: false }],
        }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 5000 });
    expect(decision.selected.reasons).toContain('no model with sufficient context window');
  });

  it('flags estimated cost above the execution-strategy budget', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({ providerId: 'pricey', costPer1KInput: 10, costPer1KOutput: 40 }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced', maxCost: 0.01 }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({
      capability: 'reasoning',
      estimatedInputTokens: 500,
      requestedOutputTokens: 500,
    });
    expect(decision.selected.reasons).toContain('estimated cost above budget');
  });

  it('prefers a candidate whose model fits over a higher-scored one with no fitting model', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({
          providerId: 'premium-no-fit',
          benchmarkScore: 99,
          models: [{ id: 'small', contextWindow: 1024, maxOutputTokens: 256, streaming: false }],
        }),
        candidate({
          providerId: 'fits',
          benchmarkScore: 70,
          models: [
            { id: 'gpt-4o-mini', contextWindow: 128000, maxOutputTokens: 4096, streaming: true },
          ],
        }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 5000 });
    // The token budget must not be defeated by routing: only the candidate
    // whose model actually fits the input is selected.
    expect(decision.selected.providerId).toBe('fits');
    expect(decision.selected.reasons).toContain('context window sufficient');
  });

  it('latency-first strategy selects the fastest healthy capable provider (calibration)', async () => {
    // AI-RUNTIME-003 Phase 4 calibration: under latency-first, an 180ms
    // provider must beat a 3200ms provider even when the slow one has a
    // higher benchmark score — the strategy intent is latency.
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({
          providerId: 'ultra',
          benchmarkScore: 95,
          averageLatencyMs: 3200,
          costPer1KInput: 2.5,
          costPer1KOutput: 10,
        }),
        candidate({
          providerId: 'fast',
          benchmarkScore: 74,
          averageLatencyMs: 180,
          costPer1KInput: 0.05,
          costPer1KOutput: 0.15,
        }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'latency-first' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 800 });
    expect(decision.selected.providerId).toBe('fast');
    expect(decision.selected.reasons.some((r) => r.includes('latency'))).toBe(true);
  });

  it('picks the largest fitting model when several models fit the token budget', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({
          models: [
            { id: 'mid', contextWindow: 16_000, maxOutputTokens: 4096, streaming: true },
            { id: 'large', contextWindow: 128_000, maxOutputTokens: 4096, streaming: true },
          ],
        }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.selected.modelId).toBe('large');
  });

  it('EPIC-012B: never routes to models the intelligence layer marks unavailable/deprecated', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({
          providerId: 'retiring',
          benchmarkScore: 99,
          models: [
            { id: 'retired-model', contextWindow: 128_000, maxOutputTokens: 4096, streaming: true },
          ],
          unavailableModelIds: ['retired-model'],
        }),
        candidate({
          providerId: 'active',
          benchmarkScore: 70,
          models: [
            { id: 'gpt-4o-mini', contextWindow: 128_000, maxOutputTokens: 4096, streaming: true },
          ],
        }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    // The higher-scored provider's only model is unavailable → it is treated
    // as having no fitting model and never wins; the deprecated model id is
    // never selected.
    expect(decision.selected.providerId).toBe('active');
    expect(decision.selected.modelId).not.toBe('retired-model');
    expect(decision.candidatesConsidered.some((c) => c.providerId === 'retiring')).toBe(true);
  });
});
