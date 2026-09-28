// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mock is a LAST-RESORT provider (PRODUCT-001)
//
// PRODUCTION-001 fact: the deterministic mock can score HIGHER than a real
// adapter in provider intelligence (cheap, instant, "healthy"), which would
// make the autonomous loop appear to work while executing fake AI. This test
// wires an advisor that deliberately ranks the mock first and proves the
// runtime still executes the REAL registered adapter.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { metrics } from '@vedmoulya/core';
import { AIOrchestrationService } from '../AIOrchestrationService.js';
import type { ProviderAdapter } from '../AIOrchestrationService.js';
import type { AIResponse, CapabilityType, ProviderFamily, ProviderHealth } from '@vedmoulya/ai';
import type { OrchestrateRequestDTO } from '../AIDTO.js';

function makeResponse(provider: string): AIResponse {
  return {
    content: `response from ${provider}`,
    provider,
    model: `${provider}-model`,
    confidence: 0.9,
    qualityScore: 8,
    latency: 10,
    cost: 0,
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

function makeProvider(name: string, family: string): ProviderAdapter {
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
    family,
    capabilities: ['reasoning'] as CapabilityType[],
    isHealthy: async () => true,
    getHealth: async () => health,
    execute: async () => makeResponse(name),
  };
}

const request: OrchestrateRequestDTO = {
  capability: 'reasoning',
  userInput: 'Explain why the mock must never outrank a real provider',
  qualityTier: 'standard',
};

describe('mock is a last-resort provider (PRODUCT-001)', () => {
  beforeEach(() => metrics.reset());
  afterEach(() => vi.restoreAllMocks());

  it('executes the REAL adapter even when the advisor ranks the mock first', async () => {
    const service = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const real = makeProvider('ollama', 'ollama');
    const mock = makeProvider('mock', 'mock');
    const mockExecute = vi.spyOn(mock, 'execute');
    const realExecute = vi.spyOn(real, 'execute');
    service.registerProvider(real);
    service.registerProvider(mock);

    // Advisor deliberately values the mock highest and the real adapter lowest.
    service.configureIntelligence({
      providerIntelligence: {
        getCandidates: async () =>
          Promise.resolve([
            {
              providerId: 'mock',
              family: 'mock',
              capabilities: ['reasoning'],
              healthy: true,
              models: [
                { id: 'mock-1', contextWindow: 131072, maxOutputTokens: 8192, streaming: true },
              ],
              benchmarkScore: 100,
              averageLatencyMs: 1,
              costPer1KInput: 0,
              costPer1KOutput: 0,
            },
            {
              providerId: 'ollama',
              family: 'ollama',
              capabilities: ['reasoning'],
              healthy: true,
              models: [
                {
                  id: 'qwen2.5-coder:7b-instruct',
                  contextWindow: 131072,
                  maxOutputTokens: 8192,
                  streaming: true,
                },
              ],
              benchmarkScore: 10,
              averageLatencyMs: 5000,
              costPer1KInput: 0.01,
              costPer1KOutput: 0.01,
            },
          ]),
      },
      executionStrategy: {
        getRoutingContext: async () => Promise.resolve({ strategy: 'balanced' as const }),
      },
    });

    const result = await service.orchestrate(request);

    expect(result.provider).toBe('ollama');
    expect(realExecute).toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('still serves the mock when NO real adapter can serve the capability', async () => {
    const service = new AIOrchestrationService({ retryBaseDelayMs: 1 });
    const mock = makeProvider('mock', 'mock');
    const mockExecute = vi.spyOn(mock, 'execute');
    service.registerProvider(mock);

    const result = await service.orchestrate(request);

    expect(result.provider).toBe('mock');
    expect(mockExecute).toHaveBeenCalled();
  });
});
