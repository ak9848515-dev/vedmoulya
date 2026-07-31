// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Mapper
// Domain-to-DTO mapping for the AI Orchestrator
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import type { AIResponse, CapabilityProfile, ProviderHealth } from '@vedmoulya/ai';
import type {
  OrchestrateResponseDTO,
  ProviderHealthDTO,
  CapabilityProfileDTO,
  CostEstimateDTO,
} from './AIDTO.js';

export const AIMapper = {
  toOrchestrateResponse(response: AIResponse): OrchestrateResponseDTO {
    return {
      content: response.content,
      provider: response.provider,
      model: response.model,
      confidence: response.confidence,
      qualityScore: response.qualityScore,
      latency: response.latency,
      cost: response.cost,
      tokenUsage: response.tokenUsage,
      validation: response.validation,
      traceId: response.traceId,
      routingDecision: response.metadata?.routingDecision ?? {
        selectedProvider: response.provider,
        reason: 'Default routing',
        alternativesConsidered: [],
        strategy: 'balanced',
      },
    };
  },

  toProviderHealthDTO(health: ProviderHealth): ProviderHealthDTO {
    return {
      providerId: health.providerId,
      status: health.status,
      latency: health.latency,
      errorRate: health.errorRate,
      isRateLimited: health.isRateLimited,
      lastChecked:
        health.lastChecked instanceof Date
          ? health.lastChecked.toISOString()
          : String(health.lastChecked),
    };
  },

  toCapabilityProfileDTO(profile: CapabilityProfile): CapabilityProfileDTO {
    return {
      capability: profile.capability,
      providers: profile.providers.map((p) => ({
        providerId: p.providerId,
        qualityScore: p.qualityScore,
        averageLatency: p.averageLatency,
        averageCost: p.averageCost,
        contextWindow: p.contextWindow,
      })),
      bestProvider: profile.bestProvider,
      fallbackProviders: profile.fallbackProviders,
    };
  },

  toCostEstimateDTO(estimate: import('@vedmoulya/ai').CostEstimate): CostEstimateDTO {
    return {
      estimatedInputTokens: estimate.estimatedInputTokens,
      estimatedOutputTokens: estimate.estimatedOutputTokens,
      estimatedCost: estimate.estimatedCost,
      currency: estimate.currency,
      providerId: estimate.providerId,
      confidence: estimate.confidence,
    };
  },
};
