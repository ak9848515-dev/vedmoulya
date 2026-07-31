// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Mapper
// Domain-to-DTO mapping for the Memory Engine
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { Memory } from '@vedmoulya/domain';
import type {
  MemoryDTO,
  MemoryListDTO,
  TimelineEntryDTO,
  MemoryStatsDTO,
  DecayResultDTO,
  ConsolidationSuggestionDTO,
  RetentionResultDTO,
  MemoryContractEvent,
} from './MemoryDTO.js';
import type { DecayResult, ConsolidationSuggestion } from '@vedmoulya/domain';

export const MemoryMapper = {
  /** Map a Memory entity to a MemoryDTO */
  toDTO(memory: Memory): MemoryDTO {
    return {
      id: memory.id,
      category: memory.category.value,
      title: memory.title,
      content: memory.content,
      importance: { level: memory.importance.level, score: memory.importance.score },
      confidence: { level: memory.confidence.level, score: memory.confidence.score },
      strength: {
        value: memory.strength.value,
        interval: memory.strength.interval,
        easeFactor: memory.strength.easeFactor,
      },
      state: memory.state.state,
      source: { type: memory.source.type, detail: memory.source.detail },
      version: memory.version.label,
      retentionPolicy: memory.retentionPolicy.retentionClass,
      knowledgeNodeId: memory.knowledgeNodeId,
      tags: [...memory.tags],
      createdAt: memory.createdAt.toISOString(),
      updatedAt: memory.updatedAt.toISOString(),
      lastRecalledAt: memory.lastRecalledAt?.toISOString(),
    };
  },

  /** Map paginated memory results to a MemoryListDTO */
  toListDTO(data: Memory[], total: number, page: number, limit: number): MemoryListDTO {
    return {
      data: data.map((m) => MemoryMapper.toDTO(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /** Map timeline entries to TimelineEntryDTOs */
  toTimelineEntries(
    entries: Array<{
      memory: Memory;
      date: Date;
      type: 'created' | 'recalled' | 'updated' | 'archived';
    }>,
  ): TimelineEntryDTO[] {
    return entries.map((entry) => ({
      memory: MemoryMapper.toDTO(entry.memory),
      date: entry.date.toISOString(),
      type: entry.type,
    }));
  },

  /** Map stats to MemoryStatsDTO */
  toStatsDTO(params: {
    total: number;
    byCategory: Record<string, number>;
    byState: Record<string, number>;
    linkedCount: number;
  }): MemoryStatsDTO {
    return {
      total: params.total,
      byCategory: params.byCategory,
      byState: params.byState,
      linkedCount: params.linkedCount,
    };
  },

  /** Map decay results to DTOs */
  toDecayResults(results: DecayResult[]): DecayResultDTO[] {
    return results.map((r) => ({
      memoryId: r.memoryId,
      previousStrength: r.previousStrength,
      newStrength: r.newStrength,
      transitioned: r.transitioned,
      newState: r.newState,
    }));
  },

  /** Map consolidation suggestions to DTOs */
  toConsolidationSuggestions(suggestions: ConsolidationSuggestion[]): ConsolidationSuggestionDTO[] {
    return suggestions.map((s) => ({
      sourceId: s.sourceId,
      targetId: s.targetId,
      reason: s.reason,
      confidence: s.confidence,
    }));
  },

  /** Map retention results to DTO */
  toRetentionResult(data: { archived: number; forgotten: number }): RetentionResultDTO {
    return data;
  },

  /** Map a Memory entity to a contract event */
  toContractEvent(memory: Memory, eventType: MemoryDTO['state']): MemoryContractEvent {
    return {
      type: `memory.${eventType}` as MemoryContractEvent['type'],
      memoryId: memory.id,
      timestamp: new Date().toISOString(),
      data: {
        title: memory.title,
        category: memory.category.value,
        importance: memory.importance.score,
        knowledgeNodeId: memory.knowledgeNodeId,
      },
    };
  },
};
