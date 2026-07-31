// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Application Service
// Core orchestration service for all memory operations
// ARC-003/ARC-004 — Memory Engine Bounded Context
// BLD-006 — Knowledge Graph Integration (never duplicate knowledge)
// BLD-005 — AI Orchestrator Integration (use only BLD-005 contracts)
// ──────────────────────────────────────────────────────────────────

import type { MemoryRepository } from '@vedmoulya/domain';
import { MemoryFactory } from '@vedmoulya/domain';
import { MemoryDomainService } from '@vedmoulya/domain';
import {
  memoryContentRule,
  importanceConstraintRule,
  retentionPolicyRule,
  validate,
} from '@vedmoulya/domain';
import type { CreateMemoryDTO, UpdateMemoryDTO, MemoryDTO, MemoryListDTO } from './MemoryDTO.js';
import { MemoryMapper } from './MemoryMapper.js';

export class MemoryApplicationService {
  private readonly repository: MemoryRepository;
  private readonly factory: MemoryFactory;
  private readonly domainService: MemoryDomainService;

  constructor(repository: MemoryRepository) {
    this.repository = repository;
    this.factory = new MemoryFactory(repository);
    this.domainService = new MemoryDomainService(repository);
  }

  /** Capture a new memory */
  async captureMemory(
    dto: CreateMemoryDTO,
  ): Promise<{ success: boolean; data?: MemoryDTO; error?: string }> {
    const result = await this.factory.createMemory({
      category: dto.category,
      title: dto.title,
      content: dto.content,
      importanceScore: dto.importanceScore,
      confidenceScore: dto.confidenceScore,
      sourceType: dto.sourceType as never,
      sourceDetail: dto.sourceDetail,
      knowledgeNodeId: dto.knowledgeNodeId,
      tags: dto.tags,
      metadata: dto.metadata,
      retentionClass: dto.retentionClass,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to create memory' };
    }

    const memory = result.data;

    // Validate business rules
    const validation = validate(
      [memoryContentRule, importanceConstraintRule, retentionPolicyRule],
      memory,
    );
    if (!validation.valid) {
      return { success: false, error: validation.message };
    }

    await this.repository.save(memory);
    return { success: true, data: MemoryMapper.toDTO(memory) };
  }

  /** Recall a memory by ID */
  async recallMemory(
    id: string,
    success: boolean,
  ): Promise<{ success: boolean; data?: MemoryDTO; error?: string }> {
    const memory = await this.repository.findById(id as never);
    if (!memory) {
      return { success: false, error: `Memory not found: ${id}` };
    }

    if (success) {
      memory.recall();
    } else {
      memory.failedRecall();
    }

    await this.repository.update(memory);
    return { success: true, data: MemoryMapper.toDTO(memory) };
  }

  /** Update a memory */
  async updateMemory(
    id: string,
    dto: UpdateMemoryDTO,
  ): Promise<{ success: boolean; data?: MemoryDTO; error?: string }> {
    const memory = await this.repository.findById(id as never);
    if (!memory) {
      return { success: false, error: `Memory not found: ${id}` };
    }

    if (dto.title !== undefined || dto.content !== undefined) {
      memory.update(dto.title ?? memory.title, dto.content ?? memory.content);
    }
    if (dto.importanceScore !== undefined) {
      const diff = dto.importanceScore - memory.importance.score;
      if (diff > 0) memory.increaseImportance(diff);
      else if (diff < 0) memory.decreaseImportance(-diff);
    }
    if (dto.tags !== undefined) {
      for (const tag of dto.tags) {
        memory.addTag(tag);
      }
    }
    if (dto.metadata !== undefined) {
      memory.updateMetadata(dto.metadata);
    }

    await this.repository.update(memory);
    return { success: true, data: MemoryMapper.toDTO(memory) };
  }

  /** Strengthen a memory */
  async strengthenMemory(
    id: string,
    amount?: number,
  ): Promise<{ success: boolean; data?: MemoryDTO; error?: string }> {
    const memory = await this.repository.findById(id as never);
    if (!memory) {
      return { success: false, error: `Memory not found: ${id}` };
    }

    memory.strengthenConfidence(amount ?? 0.1);
    await this.repository.update(memory);
    return { success: true, data: MemoryMapper.toDTO(memory) };
  }

  /** Weaken a memory */
  async weakenMemory(
    id: string,
    amount?: number,
  ): Promise<{ success: boolean; data?: MemoryDTO; error?: string }> {
    const memory = await this.repository.findById(id as never);
    if (!memory) {
      return { success: false, error: `Memory not found: ${id}` };
    }

    memory.weakenConfidence(amount ?? 0.1);
    await this.repository.update(memory);
    return { success: true, data: MemoryMapper.toDTO(memory) };
  }

  /** Merge two memories */
  async mergeMemories(
    sourceId: string,
    targetId: string,
  ): Promise<{ success: boolean; data?: MemoryDTO; error?: string }> {
    const [source, target] = await Promise.all([
      this.repository.findById(sourceId as never),
      this.repository.findById(targetId as never),
    ]);

    if (!source) return { success: false, error: `Source memory not found: ${sourceId}` };
    if (!target) return { success: false, error: `Target memory not found: ${targetId}` };

    target.merge(source);
    await this.repository.update(target);
    await this.repository.delete(source.id);

    return { success: true, data: MemoryMapper.toDTO(target) };
  }

  /** Archive a memory */
  async archiveMemory(
    id: string,
    reason?: string,
  ): Promise<{ success: boolean; data?: MemoryDTO; error?: string }> {
    const memory = await this.repository.findById(id as never);
    if (!memory) {
      return { success: false, error: `Memory not found: ${id}` };
    }

    memory.archive(reason);
    await this.repository.update(memory);
    return { success: true, data: MemoryMapper.toDTO(memory) };
  }

  /** Restore an archived memory */
  async restoreMemory(id: string): Promise<{ success: boolean; data?: MemoryDTO; error?: string }> {
    const memory = await this.repository.findById(id as never);
    if (!memory) {
      return { success: false, error: `Memory not found: ${id}` };
    }

    memory.restore();
    await this.repository.update(memory);
    return { success: true, data: MemoryMapper.toDTO(memory) };
  }

  /** Forget a memory */
  async forgetMemory(id: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const memory = await this.repository.findById(id as never);
    if (!memory) {
      return { success: false, error: `Memory not found: ${id}` };
    }

    memory.forget(reason);
    await this.repository.update(memory);
    return { success: true };
  }

  /** Get a memory by ID */
  async getMemory(id: string): Promise<{ success: boolean; data?: MemoryDTO; error?: string }> {
    const memory = await this.repository.findById(id as never);
    if (!memory) {
      return { success: false, error: `Memory not found: ${id}` };
    }
    return { success: true, data: MemoryMapper.toDTO(memory) };
  }

  /** List memories with pagination */
  async listMemories(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ success: boolean; data?: MemoryListDTO; error?: string }> {
    try {
      const total = await this.repository.count();
      const result = await this.repository.search({ query: '' }, { page, limit });
      return {
        success: true,
        data: MemoryMapper.toListDTO(result.data, total, page, limit),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'List error' };
    }
  }

  /** Search memories with filters — used by the /search endpoint */
  async searchMemories(params: {
    query?: string;
    categories?: string[];
    states?: string[];
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data?: MemoryListDTO; error?: string }> {
    try {
      const searchParams = {
        query: params.query ?? '',
        categories: params.categories,
        states: params.states,
      };
      const pagination = { page: params.page ?? 1, limit: params.limit ?? 20 };
      const result = await this.repository.search(
        searchParams as import('@vedmoulya/domain').MemorySearchParams,
        pagination,
      );
      return {
        success: true,
        data: MemoryMapper.toListDTO(result.data, result.total, pagination.page, pagination.limit),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Search error' };
    }
  }

  /** Get memory statistics */
  async getStats(): Promise<{
    success: boolean;
    data?: {
      total: number;
      byCategory: Record<string, number>;
      byState: Record<string, number>;
      linkedCount: number;
    };
    error?: string;
  }> {
    try {
      const [total, byCategory, byState, linkedCount] = await Promise.all([
        this.repository.count(),
        this.repository.countByCategory(),
        this.repository.countByState(),
        this.repository.countLinked(),
      ]);
      return {
        success: true,
        data: MemoryMapper.toStatsDTO({ total, byCategory, byState, linkedCount }),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Stats error' };
    }
  }
}
