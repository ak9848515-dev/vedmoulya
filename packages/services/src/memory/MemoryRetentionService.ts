// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Retention Service
// Manages memory lifecycle: decay, retention policies, consolidation
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { MemoryRepository } from '@vedmoulya/domain';
import { MemoryDomainService } from '@vedmoulya/domain';
import { MemoryMapper } from './MemoryMapper.js';
import type {
  DecayResultDTO,
  ConsolidationSuggestionDTO,
  RetentionResultDTO,
} from './MemoryDTO.js';

export class MemoryRetentionService {
  private readonly repository: MemoryRepository;
  private readonly domainService: MemoryDomainService;

  constructor(repository: MemoryRepository) {
    this.repository = repository;
    this.domainService = new MemoryDomainService(repository);
  }

  /** Apply decay to all active memories */
  async applyDecay(): Promise<{ success: boolean; data?: DecayResultDTO[]; error?: string }> {
    const result = await this.domainService.applyDecay();
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Decay failed' };
    }
    return { success: true, data: MemoryMapper.toDecayResults(result.data) };
  }

  /** Apply retention policies */
  async applyRetentionPolicies(): Promise<{
    success: boolean;
    data?: RetentionResultDTO;
    error?: string;
  }> {
    const result = await this.domainService.applyRetentionPolicies();
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Retention failed' };
    }
    return { success: true, data: MemoryMapper.toRetentionResult(result.data) };
  }

  /** Get consolidation suggestions */
  async getConsolidationSuggestions(
    category?: string,
  ): Promise<{ success: boolean; data?: ConsolidationSuggestionDTO[]; error?: string }> {
    const result = await this.domainService.suggestConsolidation(category);
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Consolidation failed' };
    }
    return { success: true, data: MemoryMapper.toConsolidationSuggestions(result.data) };
  }

  /** Get memories needing reinforcement */
  async getMemoriesNeedingReinforcement(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ success: boolean; data?: import('./MemoryDTO.js').MemoryListDTO; error?: string }> {
    try {
      const result = await this.repository.findMemoriesNeedingReinforcement({ page, limit });
      const total = await this.repository.count();
      return {
        success: true,
        data: MemoryMapper.toListDTO(result.data, total, page, limit),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reinforcement error',
      };
    }
  }
}
