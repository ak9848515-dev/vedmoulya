// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Domain Service
// ARC-003/ARC-004 — Domain operations for memory lifecycle,
// consolidation, decay, and knowledge graph integration
// ──────────────────────────────────────────────────────────────────

import type { MemoryRepository } from '../repository/MemoryRepository.js';
import { MemoryImportance } from '../value-objects/MemoryImportance.js';
import { MemoryConfidence } from '../value-objects/MemoryConfidence.js';

// ── Result Types ──────────────────────────────────────────────────────────

export interface DomainOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ConsolidationSuggestion {
  sourceId: string;
  targetId: string;
  reason: string;
  confidence: number;
}

export interface DecayResult {
  memoryId: string;
  previousStrength: number;
  newStrength: number;
  transitioned: boolean;
  newState?: string;
}

export interface TimelineSummary {
  total: number;
  dateRange: { from: Date; to: Date };
  categories: Record<string, number>;
}

/**
 * MemoryDomainService — domain service for memory operations.
 * Implements consolidation, decay, importance calculation,
 * and knowledge graph integration logic.
 */
export class MemoryDomainService {
  private readonly repository: MemoryRepository;

  constructor(repository: MemoryRepository) {
    this.repository = repository;
  }

  /** Suggest which memories to consolidate based on similarity */
  async suggestConsolidation(
    category?: string,
  ): Promise<DomainOperationResult<ConsolidationSuggestion[]>> {
    try {
      const suggestions: ConsolidationSuggestion[] = [];
      const memories = category
        ? await this.repository.findByCategory(category as never, { page: 1, limit: 100 })
        : await this.repository.search({ query: '' }, { page: 1, limit: 100 });

      // Simple similarity check — memories with same category and similar importance
      for (let i = 0; i < memories.data.length; i++) {
        const a = memories.data[i];
        if (!a) continue;
        for (let j = i + 1; j < memories.data.length; j++) {
          const b = memories.data[j];
          if (!b) continue;
          if (a.category.value === b.category.value) {
            const importanceDiff = Math.abs(a.importance.score - b.importance.score);
            if (importanceDiff <= 2) {
              suggestions.push({
                sourceId: a.id,
                targetId: b.id,
                reason: `Similar ${a.category.value} memories with comparable importance`,
                confidence: 1 - importanceDiff * 0.1,
              });
            }
          }
        }
      }

      return { success: true, data: suggestions.slice(0, 20) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Consolidation error',
      };
    }
  }

  /** Apply decay to all active memories */
  async applyDecay(): Promise<DomainOperationResult<DecayResult[]>> {
    try {
      const results: DecayResult[] = [];
      const activeMemories = await this.repository.findByState('active', { page: 1, limit: 1000 });

      for (const memory of activeMemories.data) {
        const elapsedHours = (Date.now() - memory.updatedAt.getTime()) / (1000 * 60 * 60);
        if (elapsedHours < 1) continue; // Skip very recent memories

        const previousStrength = memory.strength.value;
        memory.applyDecay(elapsedHours);
        const previousState = memory.state.state;

        await this.repository.update(memory);

        results.push({
          memoryId: memory.id,
          previousStrength,
          newStrength: memory.strength.value,
          transitioned: previousState !== memory.state.state,
          newState: memory.state.state,
        });
      }

      return { success: true, data: results };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Decay error',
      };
    }
  }

  /** Apply retention policy — archive/forget memories that exceed policy limits */
  async applyRetentionPolicies(): Promise<
    DomainOperationResult<{ archived: number; forgotten: number }>
  > {
    try {
      let archivedCount = 0;
      let forgottenCount = 0;
      const activeMemories = await this.repository.findByState('active', { page: 1, limit: 1000 });
      const decayingMemories = await this.repository.findByState('decaying', {
        page: 1,
        limit: 1000,
      });
      const allMemories = [...activeMemories.data, ...decayingMemories.data];

      for (const memory of allMemories) {
        const policy = memory.retentionPolicy;
        const daysSinceCreation = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const daysSinceLastRecall = memory.lastRecalledAt
          ? (Date.now() - memory.lastRecalledAt.getTime()) / (1000 * 60 * 60 * 24)
          : daysSinceCreation;

        if (!policy.shouldRetain(memory.importance.score, daysSinceLastRecall)) {
          if (memory.importance.score >= 3) {
            memory.archive('Retention policy exceeded');
            await this.repository.update(memory);
            archivedCount++;
          } else {
            memory.forget('Retention policy exceeded');
            await this.repository.update(memory);
            forgottenCount++;
          }
        }
      }

      return { success: true, data: { archived: archivedCount, forgotten: forgottenCount } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Retention error',
      };
    }
  }

  /** Calculate the importance of a memory based on various factors */
  static calculateImportance(params: {
    recallFrequency: number;
    timeSpan: number; // days
    relevanceScore: number; // 0-1
    userFeedback?: number; // 0-10
    connectedToKnowledge?: boolean;
  }): MemoryImportance {
    let score = 3; // Base medium

    // Higher recall frequency = more important
    score += Math.min(3, params.recallFrequency * 0.5);

    // Recently created memories get a boost
    if (params.timeSpan < 7) score += 2;
    else if (params.timeSpan < 30) score += 1;

    // Relevance to current context
    score += Math.round(params.relevanceScore * 3);

    // User feedback
    if (params.userFeedback) {
      score += Math.round(params.userFeedback * 0.3);
    }

    // Connected to knowledge graph = more important
    if (params.connectedToKnowledge) score += 1;

    return MemoryImportance.fromScore(score);
  }

  /** Calculate the confidence of a memory */
  static calculateConfidence(params: {
    sourceReliability: number; // 0-1
    corroborationCount: number;
    timeSinceCreation: number; // days
    recallSuccessRate: number; // 0-1
  }): MemoryConfidence {
    let score = 0.3; // Base low

    // Reliable sources increase confidence
    score += params.sourceReliability * 0.3;

    // Corroboration
    score += Math.min(0.2, params.corroborationCount * 0.05);

    // Recent memories have higher confidence
    if (params.timeSinceCreation < 30) score += 0.1;
    else if (params.timeSinceCreation > 365) score -= 0.1;

    // Recall success rate
    score += params.recallSuccessRate * 0.2;

    return MemoryConfidence.fromScore(Math.max(0, Math.min(1, score)));
  }

  /** Get timeline summary statistics */
  async getTimelineSummary(): Promise<DomainOperationResult<TimelineSummary>> {
    try {
      const total = await this.repository.count();
      const categoryDist = await this.repository.countByCategory();
      const allMemories = await this.repository.getTimeline('desc', { page: 1, limit: 1 });
      const oldestMemories = await this.repository.getTimeline('asc', { page: 1, limit: 1 });

      const toDate = allMemories[0]?.date ?? new Date();
      const fromDate = oldestMemories[0]?.date ?? new Date();

      return {
        success: true,
        data: {
          total,
          dateRange: { from: fromDate, to: toDate },
          categories: categoryDist,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Timeline error',
      };
    }
  }
}
