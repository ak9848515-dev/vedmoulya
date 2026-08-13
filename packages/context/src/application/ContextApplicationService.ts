// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Application Service
// Orchestrates the Enterprise Context Registry: ranking, filtering,
// compression, assembly, discovery, and metrics.
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { PaginationParams } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  CompressionStrategy,
  ContextCategory,
  ContextPriority,
  ContextSource,
} from '../types/context-types.js';
import { ContextRankingService } from '../domain/services/ContextRankingService.js';
import { ContextFilteringService } from '../domain/services/ContextFilteringService.js';
import { ContextCompressionService } from '../domain/services/ContextCompressionService.js';
import { ContextAssemblyService } from '../domain/services/ContextAssemblyService.js';
import type { ContextRepository } from '../domain/repository/ContextRepository.js';
import type { ContextId } from '../domain/value-objects/ContextId.js';
import type {
  RegisterContextDTO,
  ContextQueryDTO,
  ContextItemDTO,
  ContextScoreDTO,
  ContextRankingDTO,
  ContextFilterResultDTO,
  ContextCompressionResultDTO,
  EnterpriseContextPackageDTO,
  ContextMetricsDTO,
  ContextDiscoveryDTO,
  ContextPreviewDTO,
  ContextExplanationDTO,
  ContextRegistrySummaryDTO,
} from './ContextDTO.js';
import { ContextMapper } from './ContextMapper.js';

export interface ContextResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ContextApplicationService {
  private readonly repository: ContextRepository;
  private readonly rankingService: ContextRankingService;
  private readonly filteringService: ContextFilteringService;
  private readonly compressionService: ContextCompressionService;
  private readonly assemblyService: ContextAssemblyService;

  constructor(repository: ContextRepository) {
    this.repository = repository;
    this.rankingService = new ContextRankingService();
    this.filteringService = new ContextFilteringService();
    this.compressionService = new ContextCompressionService();
    this.assemblyService = new ContextAssemblyService();
  }

  // ── Registry CRUD ────────────────────────────────────────────────────────

  async registerContext(dto: RegisterContextDTO): Promise<ContextResult<ContextItemDTO>> {
    const item = ContextMapper.fromRegisterDTO(dto);
    await this.repository.save(item);
    return { success: true, data: ContextMapper.toDTO(item) };
  }

  async bulkRegisterContext(dtos: RegisterContextDTO[]): Promise<ContextResult<{ count: number }>> {
    const items = dtos.map((d) => ContextMapper.fromRegisterDTO(d));
    await this.repository.saveMany(items);
    return { success: true, data: { count: items.length } };
  }

  async getContext(id: string): Promise<ContextResult<ContextItemDTO>> {
    const item = await this.repository.findById(id as ContextId);
    if (!item) return { success: false, error: `Context item not found: ${id}` };
    return { success: true, data: ContextMapper.toDTO(item) };
  }

  async deleteContext(id: string): Promise<ContextResult<{ deleted: boolean }>> {
    const exists = await this.repository.exists(id as ContextId);
    if (!exists) return { success: false, error: `Context item not found: ${id}` };
    await this.repository.delete(id as ContextId);
    return { success: true, data: { deleted: true } };
  }

  // ── Ranking ──────────────────────────────────────────────────────────────

  async rankContext(
    query: ContextQueryDTO,
    requestCapability: CapabilityType,
    requestIntent?: string,
    businessContext?: string[],
    maxResults?: number,
  ): Promise<ContextResult<ContextRankingDTO>> {
    const pagination: PaginationParams = { page: 1, limit: 500 };
    const result = await this.repository.search(query, pagination);

    const scores = this.rankingService.scoreItems(
      result.data,
      requestCapability,
      requestIntent,
      businessContext,
    );
    const ranked = this.rankingService.rankItems(result.data, scores, maxResults);

    const scoreRecord: Record<string, ContextScoreDTO> = {};
    for (const [id, score] of scores) {
      scoreRecord[id] = ContextMapper.scoreToDTO(score);
    }

    return {
      success: true,
      data: {
        scores: scoreRecord,
        ranked: ranked.map((i) => ContextMapper.toDTO(i)),
      },
    };
  }

  // ── Filtering ────────────────────────────────────────────────────────────

  async filterContext(query: ContextQueryDTO): Promise<ContextResult<ContextFilterResultDTO>> {
    const all = await this.repository.listAll();
    const result = this.filteringService.process(all, query);
    return {
      success: true,
      data: ContextMapper.filterResultToDTO(result),
    };
  }

  // ── Compression ──────────────────────────────────────────────────────────

  async compressContext(
    query: ContextQueryDTO,
    targetTokens: number,
    strategy: CompressionStrategy = 'extractive',
    preserveCritical?: boolean,
    minConfidence?: number,
  ): Promise<ContextResult<ContextCompressionResultDTO>> {
    const pagination: PaginationParams = { page: 1, limit: 500 };
    const result = await this.repository.search(query, pagination);

    const compressionResult = this.compressionService.compress({
      items: result.data,
      targetTokens,
      strategy,
      preserveCritical,
      minConfidence,
    });

    // Reconstruct steps from the compression result for the DTO
    const steps = [
      {
        strategy: 'top_k' as CompressionStrategy,
        itemsBefore: result.data.length,
        itemsAfter: result.data.length,
        tokensBefore: result.data.reduce((s, i) => s + i.estimatedTokens, 0),
        tokensAfter: result.data.reduce((s, i) => s + i.estimatedTokens, 0),
        description: 'Items retrieved from registry',
      },
      {
        strategy: strategy,
        itemsBefore: result.data.length,
        itemsAfter: compressionResult.items.length,
        tokensBefore: compressionResult.originalTokens,
        tokensAfter: compressionResult.compressedTokens,
        description: `Applied ${strategy} compression`,
      },
    ];

    return {
      success: true,
      data: ContextMapper.compressionResultToDTO(compressionResult, steps),
    };
  }

  // ── Assembly ─────────────────────────────────────────────────────────────

  async assembleContext(
    query: ContextQueryDTO,
    goal: string,
    capability: CapabilityType,
    prompt: string,
    requestIntent?: string,
    businessContext?: string[],
    targetTokens?: number,
    strategy?: CompressionStrategy,
  ): Promise<ContextResult<EnterpriseContextPackageDTO>> {
    const pagination: PaginationParams = { page: 1, limit: 500 };
    const result = await this.repository.search(query, pagination);
    let items = result.data;

    // Rank items
    const scores = this.rankingService.scoreItems(
      items,
      capability,
      requestIntent,
      businessContext,
    );
    items = this.rankingService.rankItems(items, scores);

    // Filter duplicates
    const filtered = this.filteringService.removeDuplicates(items);
    items = filtered.retained;

    // Compress if target tokens specified
    const compressionSteps = [
      {
        strategy: 'top_k' as CompressionStrategy,
        itemsBefore: items.length,
        itemsAfter: items.length,
        tokensBefore: items.reduce((s, i) => s + i.estimatedTokens, 0),
        tokensAfter: items.reduce((s, i) => s + i.estimatedTokens, 0),
        description: 'Initial ranking and deduplication',
      },
    ];

    if (targetTokens && targetTokens > 0) {
      const compressionResult = this.compressionService.compress({
        items,
        targetTokens,
        strategy: strategy ?? 'extractive',
        preserveCritical: true,
        minConfidence: 0.3,
      });
      compressionSteps.push({
        strategy: strategy ?? 'extractive',
        itemsBefore: items.length,
        itemsAfter: compressionResult.items.length,
        tokensBefore: items.reduce((s, i) => s + i.estimatedTokens, 0),
        tokensAfter: compressionResult.items.reduce((s, i) => s + i.estimatedTokens, 0),
        description: `Compressed to ${targetTokens} tokens using ${strategy ?? 'extractive'}`,
      });
      items = compressionResult.items;
    }

    // Build the context package
    const pkg = this.assemblyService.assemble(
      items,
      prompt,
      {
        packageId: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        goal,
        capability,
        version: '1.0.0',
      },
      compressionSteps,
    );

    // Build the assembled prompt
    const assembledPrompt = this.assemblyService.buildPrompt(pkg);

    return {
      success: true,
      data: ContextMapper.packageToDTO({
        ...pkg,
        assembledPrompt,
      }),
    };
  }

  // ── Discovery ────────────────────────────────────────────────────────────

  async discoverContext(
    query: ContextQueryDTO,
    requestCapability?: CapabilityType,
    businessContext?: string[],
  ): Promise<ContextResult<ContextDiscoveryDTO>> {
    const pagination: PaginationParams = { page: query.page ?? 1, limit: query.limit ?? 50 };
    const result = await this.repository.search(query, pagination);

    // Score items if capability is provided
    const scores = new Map<string, ContextScoreDTO>();
    if (requestCapability) {
      const scoreMap = this.rankingService.scoreItems(
        result.data,
        requestCapability,
        undefined,
        businessContext,
      );
      for (const [id, score] of scoreMap) {
        scores.set(id, ContextMapper.scoreToDTO(score));
      }
    }

    return {
      success: true,
      data: {
        total: result.total,
        items: result.data.map((i) => ContextMapper.toDTO(i)),
        scores: Object.fromEntries(scores),
        appliedFilters: query,
      },
    };
  }

  async previewContext(
    id: string,
    requestCapability?: CapabilityType,
  ): Promise<ContextResult<ContextPreviewDTO>> {
    const item = await this.repository.findById(id as ContextId);
    if (!item) return { success: false, error: `Context item not found: ${id}` };

    const score = this.rankingService.scoreItem(item, requestCapability ?? 'general_conversation');

    return {
      success: true,
      data: ContextMapper.previewToDTO(item, score),
    };
  }

  async explainContext(
    id: string,
    requestCapability?: CapabilityType,
    originalTokens?: number,
    compressedTokens?: number,
  ): Promise<ContextResult<ContextExplanationDTO>> {
    const item = await this.repository.findById(id as ContextId);
    if (!item) return { success: false, error: `Context item not found: ${id}` };

    const score = this.rankingService.scoreItem(item, requestCapability ?? 'general_conversation');

    let compressionSavings: string | undefined;
    if (originalTokens !== undefined && compressedTokens !== undefined && originalTokens > 0) {
      const pct = ((originalTokens - compressedTokens) / originalTokens) * 100;
      compressionSavings = `${pct.toFixed(1)}% reduction (${originalTokens} → ${compressedTokens} tokens)`;
    }

    return {
      success: true,
      data: ContextMapper.explanationToDTO(item, score, compressionSavings),
    };
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  async getContextSummary(): Promise<ContextResult<ContextRegistrySummaryDTO>> {
    const [total, totalTokens, countBySource, countByCategory, countByPriority] = await Promise.all(
      [
        this.repository.count(),
        this.repository.totalTokens(),
        this.repository.countBySource(),
        this.repository.countByCategory(),
        this.repository.countByPriority(),
      ],
    );

    return {
      success: true,
      data: ContextMapper.summaryToDTO(
        total,
        totalTokens,
        countBySource,
        countByCategory,
        countByPriority,
      ),
    };
  }

  async getContextMetrics(compressionResult?: {
    originalTokens: number;
    compressedTokens: number;
    reductionPercent: number;
    compressionTimeMs: number;
    itemsProcessed: number;
    itemsRemoved: number;
    itemsMerged: number;
  }): Promise<ContextResult<ContextMetricsDTO>> {
    if (compressionResult) {
      return {
        success: true,
        data: ContextMapper.metricsToDTO({
          ...compressionResult,
          qualityEstimate: Math.max(0.5, Math.min(1, 1 - compressionResult.reductionPercent / 200)),
          confidence: Math.max(0.3, Math.min(1, 1 - compressionResult.reductionPercent / 300)),
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Return baseline metrics from registry
    const all = await this.repository.listAll();
    const totalTokens = all.reduce((s, i) => s + i.estimatedTokens, 0);
    return {
      success: true,
      data: {
        originalTokens: totalTokens,
        compressedTokens: totalTokens,
        reductionPercent: 0,
        compressionTimeMs: 0,
        qualityEstimate: 1,
        confidence: 1,
        itemsProcessed: all.length,
        itemsRemoved: 0,
        itemsMerged: 0,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── Discovery & Search ───────────────────────────────────────────────────

  async searchContext(
    query: ContextQueryDTO,
  ): Promise<ContextResult<{ items: ContextItemDTO[]; total: number }>> {
    const pagination: PaginationParams = { page: query.page ?? 1, limit: query.limit ?? 50 };
    const result = await this.repository.search(query, pagination);
    return {
      success: true,
      data: {
        items: result.data.map((i) => ContextMapper.toDTO(i)),
        total: result.total,
      },
    };
  }

  async listBySource(source: ContextSource): Promise<ContextResult<ContextItemDTO[]>> {
    const result = await this.repository.findBySource(source, { page: 1, limit: 100 });
    return { success: true, data: result.data.map((i) => ContextMapper.toDTO(i)) };
  }

  async listByCategory(category: ContextCategory): Promise<ContextResult<ContextItemDTO[]>> {
    const result = await this.repository.findByCategory(category, { page: 1, limit: 100 });
    return { success: true, data: result.data.map((i) => ContextMapper.toDTO(i)) };
  }

  async listByPriority(priority: ContextPriority): Promise<ContextResult<ContextItemDTO[]>> {
    const result = await this.repository.findByPriority(priority, { page: 1, limit: 100 });
    return { success: true, data: result.data.map((i) => ContextMapper.toDTO(i)) };
  }

  async listByCapability(capability: CapabilityType): Promise<ContextResult<ContextItemDTO[]>> {
    const result = await this.repository.findByCapability(capability, { page: 1, limit: 100 });
    return { success: true, data: result.data.map((i) => ContextMapper.toDTO(i)) };
  }
}
