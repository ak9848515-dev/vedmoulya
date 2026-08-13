// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Mapper
// Maps domain entities to application DTOs and vice versa
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { ContextItem } from '../types/context-types.js';
import type { ContextScore } from '../types/context-types.js';
import type { CompressionStep, CompressionStrategy } from '../types/context-types.js';
import type {
  ContextItemDTO,
  ContextScoreDTO,
  ContextCompressionResultDTO,
  ContextFilterResultDTO,
  ContextDiscoveryDTO,
  ContextPreviewDTO,
  ContextExplanationDTO,
  ContextRegistrySummaryDTO,
  EnterpriseContextPackageDTO,
  ContextMetricsDTO,
  RegisterContextDTO,
} from './ContextDTO.js';
import { CONTEXT_SOURCES, CONTEXT_CATEGORIES, CONTEXT_PRIORITIES } from '../types/context-types.js';
import { generateContextId } from '../domain/value-objects/ContextId.js';

export const ContextMapper = {
  /**
   * Map a RegisterContextDTO to a ContextItem entity.
   * Generates a new contextId and sets timestamps.
   */
  fromRegisterDTO(dto: RegisterContextDTO): ContextItem {
    const now = new Date().toISOString();
    return {
      contextId: generateContextId(),
      source: dto.source,
      category: dto.category,
      priority: dto.priority,
      importance: dto.importance,
      confidence: dto.confidence,
      freshness: 1.0, // freshly created
      size: dto.content.length,
      estimatedTokens: Math.ceil(dto.content.length / 4),
      language: dto.language ?? 'en',
      tags: dto.tags ?? [],
      business: dto.business ?? [],
      capability: dto.capability ?? [],
      version: '1.0.0',
      content: dto.content,
      metadata: dto.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      sourceId: dto.sourceId,
    };
  },

  /**
   * Map a ContextItem to its DTO.
   */
  toDTO(item: ContextItem): ContextItemDTO {
    return {
      contextId: item.contextId,
      source: item.source,
      category: item.category,
      priority: item.priority,
      importance: item.importance,
      confidence: item.confidence,
      freshness: item.freshness,
      estimatedTokens: item.estimatedTokens,
      language: item.language,
      tags: [...item.tags],
      business: [...item.business],
      capability: [...item.capability],
      version: item.version,
      content: item.content,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      sourceId: item.sourceId,
    };
  },

  /**
   * Map a ContextScore to its DTO.
   */
  scoreToDTO(score: ContextScore): ContextScoreDTO {
    return { ...score };
  },

  /**
   * Map compression steps to DTO-safe format.
   */
  stepsToDTO(steps: CompressionStep[]): ContextCompressionResultDTO['steps'] {
    return steps.map((s) => ({
      strategy: s.strategy,
      itemsBefore: s.itemsBefore,
      itemsAfter: s.itemsAfter,
      tokensBefore: s.tokensBefore,
      tokensAfter: s.tokensAfter,
      description: s.description,
    }));
  },

  /**
   * Build a ContextCompressionResultDTO.
   */
  compressionResultToDTO(
    result: {
      items: ContextItem[];
      originalTokens: number;
      compressedTokens: number;
      reductionPercent: number;
      strategy: CompressionStrategy;
      confidence: number;
      chunksRemoved: number;
      chunksMerged: number;
      compressionTimeMs: number;
    },
    steps: CompressionStep[],
  ): ContextCompressionResultDTO {
    return {
      items: result.items.map((i) => ContextMapper.toDTO(i)),
      originalTokens: result.originalTokens,
      compressedTokens: result.compressedTokens,
      reductionPercent: result.reductionPercent,
      strategy: result.strategy,
      confidence: result.confidence,
      chunksRemoved: result.chunksRemoved,
      chunksMerged: result.chunksMerged,
      compressionTimeMs: result.compressionTimeMs,
      steps: ContextMapper.stepsToDTO(steps),
    };
  },

  /**
   * Build a ContextFilterResultDTO.
   */
  filterResultToDTO(result: {
    retained: ContextItem[];
    removed: Array<{ item: ContextItem; reason: string }>;
  }): ContextFilterResultDTO {
    return {
      retained: result.retained.map((i) => ContextMapper.toDTO(i)),
      removed: result.removed.map((r) => ({ contextId: r.item.contextId, reason: r.reason })),
    };
  },

  /**
   * Build a ContextDiscoveryDTO.
   */
  discoveryToDTO(
    items: ContextItem[],
    scores: Map<string, ContextScore>,
    appliedFilters: ContextDiscoveryDTO['appliedFilters'],
  ): ContextDiscoveryDTO {
    const scoreRecord: Record<string, ContextScoreDTO> = {};
    for (const [id, score] of scores) {
      scoreRecord[id] = ContextMapper.scoreToDTO(score);
    }
    return {
      total: items.length,
      items: items.map((i) => ContextMapper.toDTO(i)),
      scores: scoreRecord,
      appliedFilters,
    };
  },

  /**
   * Build a ContextPreviewDTO.
   */
  previewToDTO(item: ContextItem, score: ContextScore): ContextPreviewDTO {
    return {
      contextId: item.contextId,
      snippet: item.content.slice(0, 200) + (item.content.length > 200 ? '...' : ''),
      source: item.source,
      category: item.category,
      priority: item.priority,
      estimatedTokens: item.estimatedTokens,
      confidence: item.confidence,
      score: ContextMapper.scoreToDTO(score),
    };
  },

  /**
   * Build a ContextExplanationDTO.
   */
  explanationToDTO(
    item: ContextItem,
    score: ContextScore,
    compressionSavings?: string,
  ): ContextExplanationDTO {
    const breakdown = [
      `Priority: ${(score.priorityScore * 100).toFixed(0)}% (${item.priority})`,
      `Relevance: ${(score.relevanceScore * 100).toFixed(0)}%`,
      `Freshness: ${(score.freshnessScore * 100).toFixed(0)}%`,
      `Business: ${(score.businessScore * 100).toFixed(0)}%`,
      `Confidence: ${(score.confidenceScore * 100).toFixed(0)}%`,
    ].join(' | ');

    return {
      contextId: item.contextId,
      source: item.source,
      whyRelevant: generateWhyRelevant(item, score),
      score: ContextMapper.scoreToDTO(score),
      scoreBreakdown: breakdown,
      compressionSavings,
    };
  },

  /**
   * Build a ContextRegistrySummaryDTO.
   */
  summaryToDTO(
    total: number,
    totalTokens: number,
    countBySource: Record<string, number>,
    countByCategory: Record<string, number>,
    countByPriority: Record<string, number>,
  ): ContextRegistrySummaryDTO {
    // Ensure all keys are present with 0 defaults
    const sourceCounts = {} as Record<(typeof CONTEXT_SOURCES)[number], number>;
    for (const s of CONTEXT_SOURCES) sourceCounts[s] = 0;
    for (const [key, val] of Object.entries(countBySource)) {
      if (key in sourceCounts) (sourceCounts as Record<string, number>)[key] = val;
    }

    const categoryCounts = {} as Record<(typeof CONTEXT_CATEGORIES)[number], number>;
    for (const c of CONTEXT_CATEGORIES) categoryCounts[c] = 0;
    for (const [key, val] of Object.entries(countByCategory)) {
      if (key in categoryCounts) (categoryCounts as Record<string, number>)[key] = val;
    }

    const priorityCounts = {} as Record<(typeof CONTEXT_PRIORITIES)[number], number>;
    for (const p of CONTEXT_PRIORITIES) priorityCounts[p] = 0;
    for (const [key, val] of Object.entries(countByPriority)) {
      if (key in priorityCounts) (priorityCounts as Record<string, number>)[key] = val;
    }

    return {
      total,
      totalTokens,
      countBySource: sourceCounts,
      countByCategory: categoryCounts,
      countByPriority: priorityCounts,
    };
  },

  /**
   * Build an EnterpriseContextPackageDTO from the domain package.
   */
  packageToDTO(pkg: {
    packageId: string;
    goal: string;
    capability: string;
    memory: ContextItem[];
    knowledge: ContextItem[];
    business: ContextItem[];
    client: ContextItem[];
    documents: ContextItem[];
    prompt: string;
    assembledPrompt: string;
    metadata: {
      totalItems: number;
      estimatedTokens: number;
      confidence: number;
      sources: string[];
      categories: string[];
      compressionSteps: CompressionStep[];
      assembledAt: string;
      version: string;
    };
  }): EnterpriseContextPackageDTO {
    return {
      packageId: pkg.packageId,
      goal: pkg.goal,
      capability: pkg.capability as EnterpriseContextPackageDTO['capability'],
      memory: pkg.memory.map((i) => ContextMapper.toDTO(i)),
      knowledge: pkg.knowledge.map((i) => ContextMapper.toDTO(i)),
      business: pkg.business.map((i) => ContextMapper.toDTO(i)),
      client: pkg.client.map((i) => ContextMapper.toDTO(i)),
      documents: pkg.documents.map((i) => ContextMapper.toDTO(i)),
      prompt: pkg.prompt,
      assembledPrompt: pkg.assembledPrompt,
      metadata: {
        totalItems: pkg.metadata.totalItems,
        estimatedTokens: pkg.metadata.estimatedTokens,
        confidence: pkg.metadata.confidence,
        sources: pkg.metadata.sources as EnterpriseContextPackageDTO['metadata']['sources'],
        categories: pkg.metadata
          .categories as EnterpriseContextPackageDTO['metadata']['categories'],
        compressionSteps: ContextMapper.stepsToDTO(pkg.metadata.compressionSteps),
        assembledAt: pkg.metadata.assembledAt,
        version: pkg.metadata.version,
      },
    };
  },

  /**
   * Build a ContextMetricsDTO.
   */
  metricsToDTO(metrics: {
    originalTokens: number;
    compressedTokens: number;
    reductionPercent: number;
    compressionTimeMs: number;
    qualityEstimate: number;
    confidence: number;
    itemsProcessed: number;
    itemsRemoved: number;
    itemsMerged: number;
    timestamp: string;
  }): ContextMetricsDTO {
    return { ...metrics };
  },
};

/**
 * Generate a human-readable explanation of why this context item is relevant.
 */
function generateWhyRelevant(item: ContextItem, score: ContextScore): string {
  const parts: string[] = [];
  if (score.relevanceScore > 0.7) {
    parts.push(`Highly relevant to the request capability (${item.capability.join(', ')})`);
  } else if (score.relevanceScore > 0.4) {
    parts.push(`Partially relevant — related capabilities: ${item.capability.join(', ')}`);
  }
  if (score.priorityScore > 0.7) {
    parts.push(`High priority (${item.priority}) from ${item.source}`);
  }
  if (score.freshnessScore > 0.7) {
    parts.push('Recently created or updated');
  }
  if (score.businessScore > 0.5) {
    parts.push(`Matches current business context: ${item.business.join(', ')}`);
  }
  if (parts.length === 0) {
    parts.push(`Context item from ${item.source} in category ${item.category}`);
  }
  return parts.join('. ') + '.';
}
