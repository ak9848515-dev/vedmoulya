import { describe, expect, it } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import type { ExecutionStrategyPort, ProviderIntelligencePort } from '@vedmoulya/services';
import { MockProvider } from '@vedmoulya/orchestrator';
import { AIOrchestratorSpecialistPort } from '../AIOrchestratorSpecialistPort.js';

function makePort(): { ai: AIOrchestrationService; port: AIOrchestratorSpecialistPort } {
  const ai = new AIOrchestrationService();
  ai.registerProvider(new MockProvider());
  // Wire EI-002/EI-004 stubs so the runtime's advisor (AI-SELECT) is live.
  const providerIntelligence: ProviderIntelligencePort = {
    getCandidates: async () => [
      {
        providerId: 'mock',
        family: 'mock',
        capabilities: [
          'reasoning',
          'coding',
          'summarization',
          'classification',
          'content_generation',
        ],
        healthy: true,
        models: [{ id: 'mock-v1', contextWindow: 8000, maxOutputTokens: 2000, streaming: false }],
        benchmarkScore: 7,
        averageLatencyMs: 50,
        costPer1KInput: 0.001,
        costPer1KOutput: 0.002,
      },
    ],
  };
  const executionStrategy: ExecutionStrategyPort = {
    getRoutingContext: async () => ({ strategy: 'balanced' as const }),
  };
  ai.configureIntelligence({ providerIntelligence, executionStrategy });
  return { ai, port: new AIOrchestratorSpecialistPort(ai) };
}

describe('AIOrchestratorSpecialistPort', () => {
  it('executes a task through the frozen runtime (never provider SDKs)', async () => {
    const { port } = makePort();
    const result = await port.execute({
      taskId: 'task-1',
      capability: 'reasoning',
      qualityTier: 'standard',
      userInput: 'Analyze this ABAP short dump.',
      enableOptimization: true,
      userId: 'user-1',
    });
    expect(result.content).toContain('Mock response');
    expect(result.provider).toBe('mock');
    expect(result.tokens.total).toBeGreaterThan(0);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.selectionExplanation).toBeDefined();
  });

  it('forwards evidence requirements (RAG + grounding) to the runtime', async () => {
    const { port } = makePort();
    const result = await port.execute({
      taskId: 'task-2',
      capability: 'reasoning',
      qualityTier: 'standard',
      userInput: 'Retrieve SAP knowledge.',
      ragQuery: { collection: 'loop:abap-debugger', query: 'short dump field symbol', topK: 5 },
      groundingRequired: true,
      userId: 'user-1',
    });
    // No RAG port wired here → no evidence reported, but the call completes.
    expect(result.abstained).toBe(false);
    expect(result.provider).toBe('mock');
  });

  it('answers the Phase 3 explain selection question through the runtime', async () => {
    const { port } = makePort();
    const explanation = await port.explain({ capability: 'reasoning' });
    expect(explanation.providerId).toBe('mock');
    expect(explanation.reasons.length).toBeGreaterThan(0);
    expect(explanation.strategy).toBeTruthy();
  });

  it('propagates provider failures to the loop engine retry policy', async () => {
    const ai = new AIOrchestrationService();
    const failing: MockProvider = Object.assign(
      Object.create(Object.getPrototypeOf(new MockProvider())),
      {
        name: 'mock',
        family: 'mock',
        capabilities: [
          'reasoning',
          'coding',
          'summarization',
          'classification',
          'content_generation',
        ],
        isHealthy: async () => true,
        getHealth: async () => ({
          providerId: 'mock',
          status: 'healthy' as const,
          latency: 1,
          errorRate: 0,
          lastChecked: new Date(),
          isRateLimited: false,
          rateLimitRemaining: 1000,
          rateLimitReset: null,
        }),
        execute: async () => {
          throw new Error('api error: 503 unavailable');
        },
      },
    );
    ai.registerProvider(failing);
    const port = new AIOrchestratorSpecialistPort(ai);
    await expect(
      port.execute({
        taskId: 't',
        capability: 'reasoning',
        qualityTier: 'standard',
        userInput: 'x',
        userId: 'u',
      }),
    ).rejects.toThrow();
  });
});
