// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestration Service Tests
// Covers: request cache (hit/miss), provider fallback, per-provider
// retry with exponential backoff, all-providers-failed, metrics
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { metrics } from '@vedmoulya/core';
import { AIOrchestrationService } from '../AIOrchestrationService.js';
import type { ProviderAdapter } from '../AIOrchestrationService.js';
import type { AIResponse, CapabilityType, ProviderFamily, ProviderHealth } from '@vedmoulya/ai';
import type { OrchestrateRequestDTO } from '../AIDTO.js';

// Fast backoff so retry tests do not sleep for seconds
const FAST_OPTS = { retryBaseDelayMs: 1 };

function makeService(): AIOrchestrationService {
  return new AIOrchestrationService(FAST_OPTS);
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
    validation: {
      passed: true,
      checks: [{ name: 'format', passed: true, score: 10 }],
      overallScore: 8,
      decision: 'pass',
    },
    traceId: `trace-${provider}`,
    metadata: {
      providerFamily: provider as ProviderFamily,
      modelVersion: `${provider}-model`,
      processingTime: 10,
      contextUsed: ['system', 'user'],
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
  capabilities: CapabilityType[] = ['reasoning', 'general_conversation'],
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
    execute:
      executeImpl ??
      (async () => {
        return makeResponse(name);
      }),
  };
}

function makeRequest(overrides: Partial<OrchestrateRequestDTO> = {}): OrchestrateRequestDTO {
  return {
    capability: 'reasoning',
    userInput: 'Explain TypeScript generics',
    qualityTier: 'standard',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AIOrchestrationService', () => {
  beforeEach(() => {
    metrics.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic orchestration', () => {
    it('routes to a provider and returns the mapped response', async () => {
      const service = makeService();
      const provider = makeProvider('openai');
      service.registerProvider(provider);

      const result = await service.orchestrate(makeRequest());

      expect(result.content).toBe('response from openai');
      expect(result.provider).toBe('openai');
      expect(result.routingDecision.selectedProvider).toBe('openai');
    });

    it('throws when no registered provider supports the capability', async () => {
      const service = makeService();
      service.registerProvider(makeProvider('openai'));

      // 'vision' passes supportedCapabilityRule but no registered provider
      // advertises it, so selectCandidates throws NotFoundError.
      await expect(
        service.orchestrate(makeRequest({ capability: 'vision' as CapabilityType })),
      ).rejects.toThrow('Provider');
    });
  });

  describe('requestCache', () => {
    it('returns cached response on repeated identical requests (cache hit)', async () => {
      const service = makeService();
      const execute = vi.fn(async () => makeResponse('openai'));
      service.registerProvider(makeProvider('openai', execute));

      const first = await service.orchestrate(makeRequest());
      const second = await service.orchestrate(makeRequest());

      expect(first.content).toBe(second.content);
      // Provider executed only once — second request served from cache
      expect(execute).toHaveBeenCalledTimes(1);
      expect(metrics.getCounter('ai.cache.miss')).toBe(1);
      expect(metrics.getCounter('ai.cache.hit')).toBe(1);
    });

    it('does not share cache entries across different inputs', async () => {
      const service = makeService();
      const execute = vi.fn(async () => makeResponse('openai'));
      service.registerProvider(makeProvider('openai', execute));

      await service.orchestrate(makeRequest({ userInput: 'Question one' }));
      await service.orchestrate(makeRequest({ userInput: 'Question two' }));

      expect(execute).toHaveBeenCalledTimes(2);
      expect(metrics.getCounter('ai.cache.miss')).toBe(2);
      expect(metrics.getCounter('ai.cache.hit')).toBe(0);
    });

    it('distinguishes cache entries by quality tier', async () => {
      const service = makeService();
      const execute = vi.fn(async () => makeResponse('openai'));
      service.registerProvider(makeProvider('openai', execute));

      await service.orchestrate(makeRequest({ qualityTier: 'standard' }));
      await service.orchestrate(makeRequest({ qualityTier: 'premium' }));

      expect(execute).toHaveBeenCalledTimes(2);
    });

    it('distinguishes cache entries by constraints', async () => {
      const service = makeService();
      const execute = vi.fn(async () => makeResponse('openai'));
      service.registerProvider(makeProvider('openai', execute));

      await service.orchestrate(makeRequest({ constraints: { maxOutputTokens: 256 } }));
      await service.orchestrate(makeRequest({ constraints: { maxOutputTokens: 1024 } }));

      expect(execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('provider fallback', () => {
    it('falls back to the next provider when the primary fails', async () => {
      const service = makeService();
      const failing = makeProvider('failing', async () => {
        throw new Error('OpenAI API error: 500 Internal Server Error');
      });
      const backup = makeProvider('backup', async () => makeResponse('backup'));
      service.registerProvider(failing);
      service.registerProvider(backup);

      const result = await service.orchestrate(makeRequest());

      expect(result.provider).toBe('backup');
      expect(metrics.getCounter('ai.fallback.count')).toBe(1);
      expect(metrics.getCounter('ai.requests.success')).toBe(1);
    });

    it('throws when every provider fails', async () => {
      const service = makeService();
      service.registerProvider(
        makeProvider('p1', async () => {
          throw new Error('OpenAI API error: 500');
        }),
      );
      service.registerProvider(
        makeProvider('p2', async () => {
          throw new Error('OpenAI API error: 500');
        }),
      );

      await expect(service.orchestrate(makeRequest())).rejects.toThrow();
      expect(metrics.getCounter('ai.requests.failure')).toBeGreaterThanOrEqual(1);
      // No cache pollution on failure
      expect(metrics.getCounter('ai.cache.hit')).toBe(0);
    });
  });

  describe('retry with backoff', () => {
    it('retries a retryable failure before succeeding', async () => {
      const service = makeService();
      let calls = 0;
      const flaky = makeProvider('flaky', async () => {
        calls++;
        if (calls < 3) {
          throw new Error('OpenAI API error: 429 Too Many Requests');
        }
        return makeResponse('flaky');
      });
      service.registerProvider(flaky);

      const result = await service.orchestrate(makeRequest());

      expect(result.provider).toBe('flaky');
      expect(calls).toBe(3);
      expect(metrics.getCounter('ai.ratelimit.hit')).toBeGreaterThanOrEqual(2);
      expect(metrics.getCounter('ai.requests.success')).toBe(1);
    });

    it('records token usage and cost on success', async () => {
      const service = makeService();
      service.registerProvider(makeProvider('openai'));

      await service.orchestrate(makeRequest());

      const snapshot = metrics.snapshot();
      const tokenStats = (snapshot.histograms as Record<string, { avg: number }>)[
        'ai.tokens.input'
      ];
      const costStats = (snapshot.histograms as Record<string, { avg: number }>)['ai.cost.total'];
      expect(tokenStats?.avg).toBe(10);
      expect(costStats?.avg).toBe(0.001);
    });
  });

  describe('provider health', () => {
    it('records provider health gauge', async () => {
      const service = makeService();
      service.registerProvider(makeProvider('openai'));

      await service.getProviderHealth('openai');

      expect(metrics.getGauge('ai.provider.health')).toBe(1);
    });
  });
});
