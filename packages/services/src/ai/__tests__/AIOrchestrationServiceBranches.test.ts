// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestration Service branch-coverage tests
// ARC-005 — AI Orchestration
// Complements AIOrchestrationService.test.ts with the defensive and
// listing branches: validation errors, context message building,
// cache eviction + TTL expiry, provider health (found/missing/all),
// provider/capability listings, and failure classification.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { metrics } from '@vedmoulya/core';
import { AIOrchestrationService } from '../AIOrchestrationService.js';
import type { ProviderAdapter } from '../AIOrchestrationService.js';
import type { AIResponse, CapabilityType, ProviderHealth } from '@vedmoulya/ai';
import type { OrchestrateRequestDTO } from '../AIDTO.js';

const FAST_OPTS = { retryBaseDelayMs: 1 };

function makeService(
  opts: { maxCacheEntries?: number; cacheTtlMs?: number } = {},
): AIOrchestrationService {
  return new AIOrchestrationService({ retryBaseDelayMs: 1, ...opts });
}

function makeResponse(provider: string, content = `response from ${provider}`): AIResponse {
  return {
    content,
    provider,
    model: `${provider}-model`,
    confidence: 0.9,
    qualityScore: 8,
    latency: 10,
    cost: 0.001,
    tokenUsage: { input: 10, output: 20, total: 30 },
    validation: { passed: true, checks: [], overallScore: 8, decision: 'pass' },
    traceId: `trace-${provider}`,
    metadata: {
      providerFamily: provider as never,
      modelVersion: `${provider}-model`,
      processingTime: 10,
      contextUsed: [],
      routingDecision: {
        selectedProvider: provider,
        reason: 'test',
        alternativesConsidered: [],
        strategy: 'balanced',
      },
      validationDetails: [],
    },
  };
}

function makeProvider(
  name: string,
  executeImpl?: ProviderAdapter['execute'],
  capabilities: CapabilityType[] = ['reasoning', 'general_conversation', 'vision'],
): ProviderAdapter {
  const health: ProviderHealth = {
    providerId: name,
    status: 'healthy',
    latency: 5,
    errorRate: 0,
    lastChecked: new Date(),
    isRateLimited: false,
    rateLimitRemaining: 100,
    rateLimitReset: null,
  };
  return {
    name,
    family: name,
    capabilities,
    isHealthy: async () => true,
    getHealth: async () => health,
    execute: executeImpl ?? (async () => makeResponse(name)),
  };
}

function makeRequest(overrides: Partial<OrchestrateRequestDTO> = {}): OrchestrateRequestDTO {
  return {
    capability: 'reasoning',
    userInput: 'Explain generics',
    qualityTier: 'standard',
    ...overrides,
  };
}

describe('AIOrchestrationService — listing & health', () => {
  beforeEach(() => {
    metrics.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listProviders returns every registered provider with metadata', () => {
    const service = makeService();
    service.registerProvider(makeProvider('openai'));
    service.registerProvider(makeProvider('anthropic'));
    const list = service.listProviders();
    expect(list.total).toBe(2);
    expect(list.providers.map((p) => p.id)).toEqual(
      expect.arrayContaining(['openai', 'anthropic']),
    );
    expect(list.providers[0]?.capabilities).toContain('reasoning');
  });

  it('listCapabilities aggregates providers per capability', () => {
    const service = makeService();
    service.registerProvider(makeProvider('openai', undefined, ['reasoning', 'vision']));
    service.registerProvider(makeProvider('anthropic', undefined, ['reasoning']));
    const list = service.listCapabilities();
    expect(list.total).toBe(2);
    const reasoning = list.capabilities.find((c) => c.type === 'reasoning');
    expect(reasoning?.providerCount).toBe(2);
    expect(reasoning?.bestProvider).toBeTruthy();
  });

  it('getProvider returns the registered adapter or undefined', () => {
    const service = makeService();
    service.registerProvider(makeProvider('openai'));
    expect(service.getProvider('openai')).toBeDefined();
    expect(service.getProvider('nope')).toBeUndefined();
  });

  it('getProviderHealth returns mapped health for a registered provider', async () => {
    const service = makeService();
    service.registerProvider(makeProvider('openai'));
    const health = await service.getProviderHealth('openai');
    expect(health.providerId).toBe('openai');
    expect(health.status).toBe('healthy');
    expect(metrics.getGauge('ai.provider.health')).toBe(1);
  });

  it('getProviderHealth throws NotFoundError for an unregistered provider', async () => {
    const service = makeService();
    await expect(service.getProviderHealth('missing')).rejects.toThrow('Provider');
  });

  it('getAllProviderHealth reports a provider as down when its health check fails', async () => {
    const service = makeService();
    const healthy = makeProvider('openai');
    const broken = makeProvider('broken');
    (broken as { getHealth: unknown }).getHealth = async () => {
      throw new Error('boom');
    };
    service.registerProvider(healthy);
    service.registerProvider(broken);
    const results = await service.getAllProviderHealth();
    expect(results).toHaveLength(2);
    const down = results.find((r) => r.providerId === 'broken');
    expect(down?.status).toBe('down');
    expect(down?.errorRate).toBe(1);
  });
});

describe('AIOrchestrationService — validation & context', () => {
  beforeEach(() => {
    metrics.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws a ValidationError for an unsupported capability', async () => {
    const service = makeService();
    service.registerProvider(makeProvider('openai'));
    await expect(
      service.orchestrate(makeRequest({ capability: 'not_a_real_capability' as never })),
    ).rejects.toThrow("Capability 'not_a_real_capability' is not supported");
  });

  it('throws a ValidationError for an invalid quality tier', async () => {
    const service = makeService();
    service.registerProvider(makeProvider('openai'));
    await expect(
      service.orchestrate(makeRequest({ qualityTier: 'not_a_tier' as never })),
    ).rejects.toThrow('does not support');
  });

  it('includes user/task context blocks in provider messages', async () => {
    const service = makeService();
    const execute = vi.fn(async () => makeResponse('openai'));
    service.registerProvider(makeProvider('openai', execute));
    await service.orchestrate(
      makeRequest({
        context: {
          systemPrompt: 'You are a strategist',
          identityContext: 'User Jane',
          knowledgeContext: 'Company docs',
        },
      }),
    );
    const messages = execute.mock.calls[0]?.[0].messages ?? [];
    expect(messages.some((m) => m.content.includes('User Jane'))).toBe(true);
    expect(messages.some((m) => m.content.includes('Company docs'))).toBe(true);
    expect(messages[0]?.content).toBe('You are a strategist');
  });

  it('labels memory, business and project context sections in provider messages', async () => {
    const service = makeService();
    const execute = vi.fn(async () => makeResponse('openai'));
    service.registerProvider(makeProvider('openai', execute));
    await service.orchestrate(
      makeRequest({
        context: {
          systemPrompt: 'You are a strategist',
          memoryContext: 'Earlier we agreed on a phased rollout.',
          decisionContext: 'Budget approved for Q3.',
          executionContext: 'Sprint 12 is in progress.',
        },
      }),
    );
    const messages = execute.mock.calls[0]?.[0].messages ?? [];
    const contents = messages.map((m) => m.content).join('\n');
    expect(contents).toContain('Memory Context:');
    expect(contents).toContain('Earlier we agreed on a phased rollout.');
    expect(contents).toContain('Decision Context:');
    expect(contents).toContain('Budget approved for Q3.');
    expect(contents).toContain('Execution Context:');
    expect(contents).toContain('Sprint 12 is in progress.');
  });
});

describe('AIOrchestrationService — cache bounds', () => {
  beforeEach(() => {
    metrics.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('evicts the oldest entry when the cache exceeds maxCacheEntries', async () => {
    const service = makeService({ maxCacheEntries: 2 });
    const execute = vi.fn(async () => makeResponse('openai'));
    service.registerProvider(makeProvider('openai', execute));
    await service.orchestrate(makeRequest({ userInput: 'A' }));
    await service.orchestrate(makeRequest({ userInput: 'B' }));
    await service.orchestrate(makeRequest({ userInput: 'C' }));
    // Re-request A: evicted, so the provider executes again.
    await service.orchestrate(makeRequest({ userInput: 'A' }));
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it('expires cached entries after the TTL elapses', async () => {
    vi.useFakeTimers();
    try {
      const service = makeService({ cacheTtlMs: 100 });
      const execute = vi.fn(async () => makeResponse('openai'));
      service.registerProvider(makeProvider('openai', execute));
      await service.orchestrate(makeRequest());
      vi.advanceTimersByTime(200);
      await service.orchestrate(makeRequest());
      expect(execute).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('AIOrchestrationService — failure classification', () => {
  beforeEach(() => {
    metrics.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifies timeouts and network errors as retryable, then falls back', async () => {
    const service = makeService();
    service.registerProvider(
      makeProvider('p1', async () => {
        throw new Error('request timed out');
      }),
    );
    service.registerProvider(makeProvider('p2', async () => makeResponse('p2')));
    const result = await service.orchestrate(makeRequest());
    expect(result.provider).toBe('p2');
  });

  it('classifies rate limits and records the rate-limit metric', async () => {
    const service = makeService();
    let calls = 0;
    service.registerProvider(
      makeProvider('p1', async () => {
        calls += 1;
        throw new Error('429 Too Many Requests');
      }),
    );
    service.registerProvider(makeProvider('p2', async () => makeResponse('p2')));
    const result = await service.orchestrate(makeRequest());
    expect(result.provider).toBe('p2');
    expect(metrics.getCounter('ai.ratelimit.hit')).toBeGreaterThanOrEqual(1);
    expect(calls).toBe(3); // 1 + 2 retries (MAX_RETRIES=3 → attempts 0..2), then fallback
  });

  it('throws the original error when retries and fallbacks are exhausted', async () => {
    const service = makeService();
    service.registerProvider(
      makeProvider('p1', async () => {
        throw new Error('boom 500');
      }),
    );
    service.registerProvider(
      makeProvider('p2', async () => {
        throw new Error('boom 500');
      }),
    );
    await expect(service.orchestrate(makeRequest())).rejects.toThrow();
    expect(metrics.getCounter('ai.requests.failure')).toBeGreaterThanOrEqual(1);
  });
});
