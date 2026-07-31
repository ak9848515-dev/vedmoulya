// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Search Service
// Memory search, ranking, and relevance scoring
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type {
  MemoryRepository,
  MemorySearchParams,
  MemoryCategoryValue,
  MemoryStateValue,
} from '@vedmoulya/domain';
import { MemoryMapper } from './MemoryMapper.js';
import type { MemoryDTO, MemoryListDTO } from './MemoryDTO.js';

export class MemorySearchService {
  private readonly repository: MemoryRepository;

  constructor(repository: MemoryRepository) {
    this.repository = repository;
  }

  /** Search memories with filters */
  async search(params: {
    query?: string;
    categories?: MemoryCategoryValue[];
    states?: MemoryStateValue[];
    importanceMin?: number;
    importanceMax?: number;
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
    knowledgeNodeId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data?: MemoryListDTO; error?: string }> {
    try {
      const searchParams: MemorySearchParams = {
        query: params.query ?? '',
        categories: params.categories,
        states: params.states,
        importanceMin: params.importanceMin,
        importanceMax: params.importanceMax,
        dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
        dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
        tags: params.tags,
        knowledgeNodeId: params.knowledgeNodeId,
      };

      const pagination = { page: params.page ?? 1, limit: params.limit ?? 20 };
      const result = await this.repository.search(searchParams, pagination);
      const total = await this.repository.count();

      return {
        success: true,
        data: MemoryMapper.toListDTO(result.data, total, pagination.page, pagination.limit),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Search error' };
    }
  }

  /** Find related memories (same category, similar importance) */
  async findRelated(
    category: MemoryCategoryValue,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ success: boolean; data?: MemoryDTO[]; error?: string }> {
    try {
      const result = await this.repository.findRelatedMemories(category, { page, limit });
      return { success: true, data: result.data.map((m) => MemoryMapper.toDTO(m)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Related error' };
    }
  }

  /** Find memories linked to a specific Knowledge Graph node */
  async findByKnowledgeNode(
    knowledgeNodeId: string,
  ): Promise<{ success: boolean; data?: MemoryDTO[]; error?: string }> {
    try {
      const memories = await this.repository.findByKnowledgeNodeId(knowledgeNodeId);
      return { success: true, data: memories.map((m) => MemoryMapper.toDTO(m)) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Knowledge node error',
      };
    }
  }
}
