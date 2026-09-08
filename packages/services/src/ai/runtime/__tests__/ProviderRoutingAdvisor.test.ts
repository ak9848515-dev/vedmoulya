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

  // ── Phase G/H: measured routing evidence ────────────────────────────────

  it('measured reliability (MEASURED confidence) can flip a close call', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({
          providerId: 'catalog-favorite',
          benchmarkScore: 92,
          // no measured evidence → static path only
        }),
        candidate({
          providerId: 'proven',
          benchmarkScore: 89,
          measured: {
            sampleCount: 120,
            effectiveSampleCount: 120,
            successRate: 1,
            failureRate: 0,
            p50LatencyMs: 900,
            recentFailureCount: 0,
            confidence: 'MEASURED',
            influence: 1,
            provenance: 'MEASURED',
          },
        }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.selected.providerId).toBe('proven');
    expect(decision.selected.reasons.some((r) => r.includes('measured reliability'))).toBe(true);
  });

  it('cold start: INSUFFICIENT evidence contributes zero influence (no destabilization)', async () => {
    const measured = {
      sampleCount: 2,
      effectiveSampleCount: 2,
      successRate: 1,
      failureRate: 0,
      p50LatencyMs: 1,
      recentFailureCount: 0,
      confidence: 'INSUFFICIENT' as const,
      influence: 0,
      provenance: 'MEASURED' as const,
    };
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({ providerId: 'baseline', benchmarkScore: 90, measured }),
        candidate({ providerId: 'stronger', benchmarkScore: 95 }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    // 2/2 perfect runs with INSUFFICIENT confidence must NOT beat the
    // catalog-favored candidate — measured evidence is not yet influential.
    expect(decision.selected.providerId).toBe('stronger');
    expect(decision.selected.reasons.some((r) => r.includes('measured reliability'))).toBe(false);
  });

  it('prefers measured p50 latency over the static registry latency signal', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({
          providerId: 'static-fast',
          averageLatencyMs: 300,
          benchmarkScore: 80,
        }),
        candidate({
          providerId: 'measured-fast',
          averageLatencyMs: 5000, // static registry signal says slow
          benchmarkScore: 82,
          measured: {
            sampleCount: 40,
            effectiveSampleCount: 40,
            successRate: 0.98,
            failureRate: 0.02,
            p50LatencyMs: 250, // but real executions are fast
            recentFailureCount: 0,
            confidence: 'MEASURED',
            influence: 1,
            provenance: 'MEASURED',
          },
        }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'latency-first' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.selected.providerId).toBe('measured-fast');
    expect(decision.selected.reasons.some((r) => r.includes('measured p50 latency'))).toBe(true);
  });

  it('recent measured failures weigh against an otherwise healthy provider', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [
        candidate({
          providerId: 'flaky',
          benchmarkScore: 95,
          measured: {
            sampleCount: 50,
            effectiveSampleCount: 50,
            successRate: 0.9,
            failureRate: 0.1,
            p50LatencyMs: 500,
            recentFailureCount: 8,
            confidence: 'MEASURED',
            influence: 1,
            provenance: 'MEASURED',
          },
        }),
        candidate({ providerId: 'steady', benchmarkScore: 91 }),
      ],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.selected.providerId).toBe('steady');
    expect(decision.candidatesConsidered.find((c) => c.providerId === 'flaky')?.excluded).toBe(
      false,
    );
    expect(decision.selected.reasons.some((r) => r.includes('recent failure(s)'))).toBe(false);
  });
});

describe('ProviderRoutingAdvisor — capability requirements (provider vs model)', () => {
  const visionCandidate = (
    overrides: Partial<ProviderCandidateIntelligence> = {},
  ): ProviderCandidateIntelligence =>
    candidate({
      providerId: 'google',
      capabilities: ['reasoning', 'coding', 'vision'],
      models: [
        {
          id: 'gemini-2.5-pro',
          contextWindow: 1048576,
          maxOutputTokens: 8192,
          streaming: true,
          capabilities: ['reasoning', 'coding', 'vision', 'summarization'],
        },
        {
          id: 'gemini-vision-nano',
          contextWindow: 1048576,
          maxOutputTokens: 8192,
          streaming: true,
          capabilities: ['vision'],
        },
        // No declared capability list → UNKNOWN (conservative, never excluded).
        { id: 'legacy-unknown', contextWindow: 128000, maxOutputTokens: 4096, streaming: true },
      ],
      ...overrides,
    });

  it('excludes a candidate whose models cannot serve an extra required capability', async () => {
    const noVisionModel = candidate({
      providerId: 'deepseek',
      capabilities: ['reasoning', 'coding'],
      models: [
        {
          id: 'deepseek-chat',
          contextWindow: 128000,
          maxOutputTokens: 8192,
          streaming: true,
          capabilities: ['reasoning', 'coding'],
        },
      ],
    });
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [noVisionModel, visionCandidate()],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({
      capability: 'vision',
      requiredCapabilities: ['vision'],
      estimatedInputTokens: 500,
    });
    expect(decision.selected.providerId).toBe('google');
    expect(decision.requiredCapabilities).toEqual(['vision']);
    const deepseek = decision.candidatesConsidered.find((c) => c.providerId === 'deepseek');
    expect(deepseek?.excluded).toBe(true);
    expect(decision.selected.reasons).toContain('capability compatible');
  });

  it('selects the model that supports all required capabilities (not the largest)', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [visionCandidate()],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({
      capability: 'coding',
      requiredCapabilities: ['coding', 'reasoning'],
      estimatedInputTokens: 500,
    });
    // gemini-2.5-pro is the only declared model with coding+reasoning; the
    // vision-only model is excluded at model level, and the undeclared legacy
    // model is UNKNOWN (allowed, but pro wins on context size).
    expect(decision.selected.modelId).toBe('gemini-2.5-pro');
    expect(decision.selected.reasons.some((r) => r.includes('model(s) excluded'))).toBe(true);
  });

  it('keeps cold-start behavior when no requiredCapabilities are supplied', async () => {
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [visionCandidate()],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.requiredCapabilities).toEqual(['reasoning']);
    expect(decision.selected.reasons).toContain('capability compatible');
  });
});

describe('ProviderRoutingAdvisor — real-time execution health influence', () => {
  const healthy = (id: string, benchmarkScore: number): ProviderCandidateIntelligence =>
    candidate({ providerId: id, benchmarkScore });

  it('lets a runtime DEGRADED signal penalize but not exclude a provider', async () => {
    const degraded = candidate({
      providerId: 'flaky',
      benchmarkScore: 95,
      runtimeHealth: {
        scope: 'provider',
        verdict: 'DEGRADED',
        sampleCount: 40,
        consecutiveFailures: 3,
        timeoutCount: 3,
        rateLimitCount: 0,
        authFailureCount: 0,
        unsupportedCount: 0,
        detail: 'elevated recent failure rate',
      },
    });
    const steady = candidate({ providerId: 'steady', benchmarkScore: 93 });
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [degraded, steady],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.selected.providerId).toBe('steady');
    // The degraded provider is still considered (not excluded) but ranked
    // below the steady provider; its reasons explain the runtime penalty.
    const flaky = decision.fallback.find((f) => f.providerId === 'flaky');
    expect(flaky).toBeDefined();
    expect(flaky?.reasons.some((r) => r.includes('degraded by recent execution failures'))).toBe(
      true,
    );
    expect(decision.candidatesConsidered.find((c) => c.providerId === 'flaky')?.excluded).toBe(
      false,
    );
  });

  it('treats a runtime UNAVAILABLE verdict like an unhealthy provider when a healthy one exists', async () => {
    const down = candidate({
      providerId: 'down',
      healthy: true, // registry says healthy — the runtime verdict overrides
      benchmarkScore: 60, // low enough that the -1 gate keeps it out of the pool
      runtimeHealth: {
        scope: 'provider',
        verdict: 'UNAVAILABLE',
        sampleCount: 30,
        consecutiveFailures: 8,
        timeoutCount: 8,
        rateLimitCount: 0,
        authFailureCount: 0,
        unsupportedCount: 0,
        detail: '8 consecutive execution failures (burst)',
      },
    });
    const steady = healthy('steady', 90);
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [down, steady],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.selected.providerId).toBe('steady');
    // The runtime-UNAVAILABLE provider is treated as unhealthy: excluded from
    // the considered pool while a healthy alternative exists (never an
    // auto-disable — the pool degrades to it when nothing else is healthy).
    expect(decision.candidatesConsidered.find((c) => c.providerId === 'down')?.excluded).toBe(true);
    expect(decision.selected.reasons).not.toContain('8 consecutive execution failures (burst)');
  });

  it('does not exclude a runtime-unavailable model from a healthy provider (model scope)', async () => {
    const provider = candidate({
      providerId: 'openai',
      runtimeUnavailableModelIds: ['gpt-4o-mini'],
      models: [
        { id: 'gpt-4o-mini', contextWindow: 128000, maxOutputTokens: 4096, streaming: true },
        { id: 'gpt-4o', contextWindow: 128000, maxOutputTokens: 8192, streaming: true },
      ],
    });
    const intelligence: ProviderIntelligencePort = {
      getCandidates: async () => [provider],
    };
    const executionStrategy: ExecutionStrategyPort = {
      getRoutingContext: async () => strategy({ strategy: 'balanced' }),
    };
    const advisor = new ProviderRoutingAdvisor(intelligence, executionStrategy);
    const decision = await advisor.decide({ capability: 'reasoning', estimatedInputTokens: 500 });
    expect(decision.selected.providerId).toBe('openai');
    expect(decision.selected.modelId).toBe('gpt-4o');
    expect(decision.selected.reasons.some((r) => r.includes('capability compatible'))).toBe(true);
  });
});
