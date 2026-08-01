// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Mapper Tests
// Covers AIMapper: toOrchestrateResponse, toProviderHealthDTO,
//                  toCapabilityProfileDTO, toCostEstimateDTO
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { AIMapper } from '../AIMapper.js';
import type { AIResponse } from '@vedmoulya/ai';

// ── toOrchestrateResponse ───────────────────────────────────────────────────

describe('AIMapper.toOrchestrateResponse', () => {
  const base: AIResponse = {
    content: 'Hello',
    provider: 'openai',
    model: 'gpt-4o',
    confidence: 0.95,
    qualityScore: 0.9,
    latency: 120,
    cost: 0.01,
    tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    validation: { valid: true, issues: [] },
    traceId: 'trace-1',
    metadata: {},
  };

  it('maps all fields onto the DTO', () => {
    const dto = AIMapper.toOrchestrateResponse(base);
    expect(dto.content).toBe('Hello');
    expect(dto.provider).toBe('openai');
    expect(dto.model).toBe('gpt-4o');
    expect(dto.confidence).toBe(0.95);
    expect(dto.qualityScore).toBe(0.9);
    expect(dto.latency).toBe(120);
    expect(dto.cost).toBe(0.01);
    expect(dto.tokenUsage.inputTokens).toBe(10);
    expect(dto.validation.valid).toBe(true);
    expect(dto.traceId).toBe('trace-1');
  });

  it('falls back to a default routing decision when metadata is empty', () => {
    const dto = AIMapper.toOrchestrateResponse(base);
    expect(dto.routingDecision.selectedProvider).toBe('openai');
    expect(dto.routingDecision.reason).toBe('Default routing');
    expect(dto.routingDecision.strategy).toBe('balanced');
  });

  it('uses the explicit routing decision when metadata provides one', () => {
    const withRouting: AIResponse = {
      ...base,
      metadata: {
        routingDecision: {
          selectedProvider: 'anthropic',
          reason: 'Quality',
          alternativesConsidered: ['openai'],
          strategy: 'cost',
        },
      },
    };
    const dto = AIMapper.toOrchestrateResponse(withRouting);
    expect(dto.routingDecision.selectedProvider).toBe('anthropic');
    expect(dto.routingDecision.reason).toBe('Quality');
    expect(dto.routingDecision.alternativesConsidered).toEqual(['openai']);
  });
});

// ── toProviderHealthDTO ─────────────────────────────────────────────────────

describe('AIMapper.toProviderHealthDTO', () => {
  it('maps a provider health object with a Date lastChecked', () => {
    const dto = AIMapper.toProviderHealthDTO({
      providerId: 'openai',
      status: 'healthy',
      latency: 100,
      errorRate: 0.01,
      isRateLimited: false,
      lastChecked: new Date('2026-01-01T00:00:00Z'),
    });
    expect(dto.providerId).toBe('openai');
    expect(dto.status).toBe('healthy');
    expect(dto.latency).toBe(100);
    expect(dto.errorRate).toBe(0.01);
    expect(dto.isRateLimited).toBe(false);
    expect(dto.lastChecked).toBe('2026-01-01T00:00:00.000Z');
  });

  it('maps a provider health object with a string lastChecked', () => {
    const dto = AIMapper.toProviderHealthDTO({
      providerId: 'anthropic',
      status: 'degraded',
      latency: 500,
      errorRate: 0.2,
      isRateLimited: true,
      lastChecked: '2026-01-01T00:00:00.000Z',
    });
    expect(dto.lastChecked).toBe('2026-01-01T00:00:00.000Z');
    expect(dto.isRateLimited).toBe(true);
  });
});

// ── toCapabilityProfileDTO ──────────────────────────────────────────────────

describe('AIMapper.toCapabilityProfileDTO', () => {
  it('maps a capability profile with providers', () => {
    const dto = AIMapper.toCapabilityProfileDTO({
      capability: 'reasoning',
      providers: [
        {
          providerId: 'openai',
          qualityScore: 0.95,
          averageLatency: 150,
          averageCost: 0.02,
          contextWindow: 128000,
        },
      ],
      bestProvider: 'openai',
      fallbackProviders: ['anthropic'],
    });
    expect(dto.capability).toBe('reasoning');
    expect(dto.providers).toHaveLength(1);
    expect(dto.providers[0]?.providerId).toBe('openai');
    expect(dto.providers[0]?.qualityScore).toBe(0.95);
    expect(dto.providers[0]?.contextWindow).toBe(128000);
    expect(dto.bestProvider).toBe('openai');
    expect(dto.fallbackProviders).toEqual(['anthropic']);
  });

  it('maps an empty providers list', () => {
    const dto = AIMapper.toCapabilityProfileDTO({
      capability: 'reasoning',
      providers: [],
      bestProvider: 'none',
      fallbackProviders: [],
    });
    expect(dto.providers).toEqual([]);
  });
});

// ── toCostEstimateDTO ───────────────────────────────────────────────────────

describe('AIMapper.toCostEstimateDTO', () => {
  it('maps a cost estimate', () => {
    const dto = AIMapper.toCostEstimateDTO({
      estimatedInputTokens: 1000,
      estimatedOutputTokens: 500,
      estimatedCost: 0.005,
      currency: 'USD',
      providerId: 'openai',
      confidence: 'medium',
    });
    expect(dto.estimatedInputTokens).toBe(1000);
    expect(dto.estimatedOutputTokens).toBe(500);
    expect(dto.estimatedCost).toBe(0.005);
    expect(dto.currency).toBe('USD');
    expect(dto.providerId).toBe('openai');
    expect(dto.confidence).toBe('medium');
  });
});
