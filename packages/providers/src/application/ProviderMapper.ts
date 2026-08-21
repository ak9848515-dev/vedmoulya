// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Mapper
// Maps domain entities to application DTOs
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { Provider } from '../domain/entities/Provider.js';
import type {
  ProviderCapabilityMatrixDTO,
  ProviderDTO,
  ProviderFleetHealthDTO,
  ProviderMarketplaceDTO,
} from './ProviderDTO.js';

export const ProviderMapper = {
  toDTO(provider: Provider): ProviderDTO {
    const health = provider.health;
    return {
      id: provider.id,
      family: provider.family,
      name: provider.name,
      description: provider.description,
      owner: provider.owner,
      models: provider.models.map((m) => ({ ...m })),
      capabilities: [...provider.capabilities],
      supportedModalities: [...provider.supportedModalities],
      inputPerMillionTokens: provider.cost.inputPerMillionTokens,
      outputPerMillionTokens: provider.cost.outputPerMillionTokens,
      currency: provider.cost.currency,
      costTier: provider.cost.tier,
      p50Ms: provider.latency.p50Ms,
      p95Ms: provider.latency.p95Ms,
      requestsPerMinute: provider.rateLimits.requestsPerMinute,
      tokensPerMinute: provider.rateLimits.tokensPerMinute,
      requestsPerDay: provider.rateLimits.requestsPerDay,
      maxConcurrentRequests: provider.rateLimits.maxConcurrentRequests,
      availability: provider.availability,
      health: {
        status: health.status,
        healthScore: health.healthScore,
        latencyMs: health.latencyMs,
        successCount: health.successCount,
        failureCount: health.failureCount,
        quotaUsedPercent: health.quotaUsedPercent,
        rateLimitRemaining: health.rateLimitRemaining,
        lastSuccessAt: health.lastSuccessAt,
        lastFailureAt: health.lastFailureAt,
        lastCheckedAt: health.lastCheckedAt,
      },
      lifecycleStatus: provider.lifecycleStatus.value,
      version: provider.version.toString(),
      tags: [...provider.tags],
      documentationUrl: provider.documentationUrl,
      matrix: provider.matrix.map((m) => ({ ...m })),
      bestQuality: provider.bestQuality,
      bestCostUsd: provider.bestCostUsd,
      maxContextLength: provider.maxContextLength,
      hasStreaming: provider.hasFeature('streaming'),
      hasVision: provider.hasFeature('vision'),
      hasFunctionCalling: provider.hasFeature('function_calling'),
      hasEmbeddings: provider.hasFeature('embeddings'),
      createdAt: provider.createdAt.toISOString(),
      updatedAt: provider.updatedAt.toISOString(),
      customConfig: provider.customConfig,
    };
  },

  toCapabilityMatrixDTO(matrix: {
    rows: Array<{
      capability: ProviderCapabilityMatrixDTO['rows'][number]['capability'];
      providerCount: number;
      bestProviderId: string | null;
      rankings: Array<{
        providerId: string;
        providerName: string;
        quality: number;
        expectedCostUsd: number;
        expectedLatencyMs: number;
        expectedInputTokens: number;
        expectedOutputTokens: number;
        confidence: number;
        historicalSuccess: number;
        qualityTier: ProviderCapabilityMatrixDTO['rows'][number]['rankings'][number]['qualityTier'];
      }>;
    }>;
  }): ProviderCapabilityMatrixDTO {
    return {
      rows: matrix.rows.map((row) => ({
        capability: row.capability,
        providerCount: row.providerCount,
        bestProviderId: row.bestProviderId,
        rankings: row.rankings.map((r) => ({ ...r })),
      })),
    };
  },

  toFleetHealthDTO(health: ProviderFleetHealthDTO): ProviderFleetHealthDTO {
    return health;
  },

  toMarketplaceDTO(
    providers: readonly Provider[],
    counts: {
      activeCount: number;
      healthyCount: number;
      countByLifecycleStatus: Record<string, number>;
      countByFamily: Record<string, number>;
      countByCapability: Record<string, number>;
    },
  ): ProviderMarketplaceDTO {
    return {
      providers: providers.map((p) => ProviderMapper.toDTO(p)),
      total: providers.length,
      activeCount: counts.activeCount,
      healthyCount: counts.healthyCount,
      countByLifecycleStatus: counts.countByLifecycleStatus,
      countByFamily: counts.countByFamily,
      countByCapability: counts.countByCapability,
    };
  },
};
