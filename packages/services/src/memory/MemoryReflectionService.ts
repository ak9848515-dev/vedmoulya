// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Reflection Service
// Generates reflections, patterns, insights, and summarizations
// from stored memories. Prepares context for AI Orchestrator.
// ARC-003/ARC-004 — Memory Engine Bounded Context
// BLD-005 — AI Orchestrator Integration
// ──────────────────────────────────────────────────────────────────

import type { MemoryRepository, MemoryCategoryValue } from '@vedmoulya/domain';
import { MemoryMapper } from './MemoryMapper.js';
import type { MemoryDTO } from './MemoryDTO.js';

export interface ReflectionResult {
  category: string;
  memoryCount: number;
  timeSpan: { from: string; to: string };
  keyTopics: string[];
  averageImportance: number;
  patterns: string[];
  memories: MemoryDTO[];
}

export class MemoryReflectionService {
  private readonly repository: MemoryRepository;

  constructor(repository: MemoryRepository) {
    this.repository = repository;
  }

  /** Generate a reflection on a specific category of memories */
  async reflectOnCategory(
    category: MemoryCategoryValue,
  ): Promise<{ success: boolean; data?: ReflectionResult; error?: string }> {
    try {
      const result = await this.repository.findByCategory(category, { page: 1, limit: 100 });

      if (result.data.length === 0) {
        return { success: true, data: this.emptyReflection(category) };
      }

      const memories = result.data;
      const totalImportance = memories.reduce((sum, m) => sum + m.importance.score, 0);
      const avgImportance = totalImportance / memories.length;

      // Extract topics from titles
      const wordFrequency = new Map<string, number>();
      for (const memory of memories) {
        const words = memory.title.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length > 3) {
            wordFrequency.set(word, (wordFrequency.get(word) ?? 0) + 1);
          }
        }
      }

      const keyTopics = [...wordFrequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);

      // Detect simple patterns
      const patterns: string[] = [];
      if (memories.filter((m) => m.importance.score >= 7).length > 2) {
        patterns.push('Multiple high-importance memories in this category');
      }
      if (memories.filter((m) => m.strength.isWeak()).length > 3) {
        patterns.push('Several memories need reinforcement');
      }
      if (memories.length > 10) {
        patterns.push('Rich memory set — consider consolidation');
      }

      const dates = memories.map((m) => m.createdAt.getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));

      return {
        success: true,
        data: {
          category,
          memoryCount: memories.length,
          timeSpan: { from: minDate.toISOString(), to: maxDate.toISOString() },
          keyTopics,
          averageImportance: Math.round(avgImportance * 10) / 10,
          patterns,
          memories: memories.map((m) => MemoryMapper.toDTO(m)),
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Reflection error' };
    }
  }

  /** Prepare context data for AI Orchestrator */
  async prepareAIContext(params: {
    maxMemories?: number;
    categories?: MemoryCategoryValue[];
    importanceMin?: number;
  }): Promise<{
    success: boolean;
    data?: {
      context: string;
      memories: Array<{ id: string; title: string; content: string; importance: number }>;
    };
    error?: string;
  }> {
    try {
      const searchParams = {
        query: '',
        categories: params.categories,
        importanceMin: params.importanceMin,
      };
      const result = await this.repository.search(searchParams, {
        page: 1,
        limit: params.maxMemories ?? 20,
      });

      const context = result.data
        .map((m) => `[${m.category.value}] ${m.title}: ${m.content.slice(0, 200)}`)
        .join('\n\n');

      return {
        success: true,
        data: {
          context,
          memories: result.data.map((m) => ({
            id: m.id,
            title: m.title,
            content: m.content,
            importance: m.importance.score,
          })),
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'AI context error' };
    }
  }

  private emptyReflection(category: MemoryCategoryValue): ReflectionResult {
    return {
      category,
      memoryCount: 0,
      timeSpan: { from: new Date().toISOString(), to: new Date().toISOString() },
      keyTopics: [],
      averageImportance: 0,
      patterns: ['No memories recorded yet in this category'],
      memories: [],
    };
  }
}
