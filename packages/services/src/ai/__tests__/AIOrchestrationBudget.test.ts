// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestration token-budget guard tests
// AI-RUNTIME-001 — deterministic pre-provider input-token budget
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { ValidationError } from '@vedmoulya/core';
import { AIOrchestrationService } from '../AIOrchestrationService.js';
import type { ProviderAdapter } from '../AIOrchestrationService.js';
import type { AIResponse, CapabilityType, ProviderFamily, ProviderHealth } from '@vedmoulya/ai';

function makeResponse(): AIResponse {
  return {
    content: 'ok',
    provider: 'stub',
    model: 'stub-model',
    confidence: 0.9,
    qualityScore: 8,
    latency: 10,
    cost: 0.001,
    tokenUsage: { input: 10, output: 20, total: 30 },
    validation: { passed: true, checks: [], overallScore: 8, decision: 'pass' },
    traceId: 'trace-stub',
    metadata: {
      providerFamily: 'openai' as ProviderFamily,
      modelVersion: 'stub-model',
      processingTime: 10,
      contextUsed: [],
      routingDecision: {
        selectedProvider: 'stub',
        reason: 'test',
        alternativesConsidered: [],
        strategy: 'balanced',
      },
      validationDetails: [],
    },
  };
}

function makeProvider(executeImpl: ProviderAdapter['execute']): ProviderAdapter {
  return {
    name: 'stub',
    family: 'stub',
    capabilities: ['reasoning' as CapabilityType, 'general_conversation' as CapabilityType],
    isHealthy: async () => true,
    getHealth: async (): Promise<ProviderHealth> => ({
      providerId: 'stub',
      status: 'healthy',
      latency: 1,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 1000,
      rateLimitReset: null,
    }),
    execute: executeImpl,
  };
}

describe('AIOrchestrationService token budget guard', () => {
  it('rejects before any provider call when estimated input tokens exceed maxInputTokens', async () => {
    const execute = vi.fn().mockResolvedValue(makeResponse());
    const svc = new AIOrchestrationService();
    svc.registerProvider(makeProvider(execute));

    await expect(
      svc.orchestrate({
        capability: 'reasoning',
        userInput: 'x'.repeat(4000), // ≈ 1000 tokens + overhead
        qualityTier: 'standard',
        constraints: { maxInputTokens: 500 },
      }),
    ).rejects.toThrow(ValidationError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('executes normally when the estimated tokens fit the budget', async () => {
    const execute = vi.fn().mockResolvedValue(makeResponse());
    const svc = new AIOrchestrationService();
    svc.registerProvider(makeProvider(execute));

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'short input',
      qualityTier: 'standard',
      constraints: { maxInputTokens: 5000 },
    });
    expect(result.content).toBe('ok');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('executes normally when no maxInputTokens budget is set', async () => {
    const execute = vi.fn().mockResolvedValue(makeResponse());
    const svc = new AIOrchestrationService();
    svc.registerProvider(makeProvider(execute));

    const result = await svc.orchestrate({
      capability: 'reasoning',
      userInput: 'x'.repeat(4000),
      qualityTier: 'standard',
    });
    expect(result.content).toBe('ok');
  });
});
