// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Application Service
// Orchestrates the Enterprise Execution Strategy Engine: create,
// validate, search, list, explain, and estimate. No execution.
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type { PaginationParams } from '@vedmoulya/core';
import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type { ExecutionMode, StrategyPriority } from '../types/strategy-types.js';
import { ExecutionStrategyService } from '../domain/services/ExecutionStrategyService.js';
import type { ExecutionStrategyRepository } from '../domain/repository/ExecutionStrategyRepository.js';
import type { StrategyId } from '../domain/value-objects/StrategyId.js';
import type {
  CreateStrategyDTO,
  CostEstimateDTO,
  ExecutionStrategyDTO,
  LatencyEstimateDTO,
  StrategyExplanationDTO,
  StrategySearchDTO,
  StrategySummaryDTO,
  TokenEstimateDTO,
} from './StrategyDTO.js';
import { StrategyMapper } from './StrategyMapper.js';

export interface StrategyResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ExecutionStrategyApplicationService {
  private readonly repository: ExecutionStrategyRepository;
  private readonly strategyService: ExecutionStrategyService;

  constructor(repository: ExecutionStrategyRepository) {
    this.repository = repository;
    this.strategyService = new ExecutionStrategyService();
  }

  // ── Create & Validate ────────────────────────────────────────────────────

  async createStrategy(dto: CreateStrategyDTO): Promise<StrategyResult<ExecutionStrategyDTO>> {
    const strategy = this.strategyService.createStrategy(dto);
    await this.repository.save(strategy);
    return { success: true, data: StrategyMapper.toDTO(strategy) };
  }

  async validateStrategy(id: string): Promise<StrategyResult<ExecutionStrategyDTO>> {
    const strategy = await this.repository.findById(id as StrategyId);
    if (!strategy) return { success: false, error: `Strategy not found: ${id}` };
    const validated = this.strategyService.validateStrategy(strategy);
    await this.repository.save(validated);
    return { success: true, data: StrategyMapper.toDTO(validated) };
  }

  // ── Retrieval ────────────────────────────────────────────────────────────

  async getStrategy(id: string): Promise<StrategyResult<ExecutionStrategyDTO>> {
    const strategy = await this.repository.findById(id as StrategyId);
    if (!strategy) return { success: false, error: `Strategy not found: ${id}` };
    return { success: true, data: StrategyMapper.toDTO(strategy) };
  }

  async deleteStrategy(id: string): Promise<StrategyResult<{ deleted: boolean }>> {
    const exists = await this.repository.exists(id as StrategyId);
    if (!exists) return { success: false, error: `Strategy not found: ${id}` };
    await this.repository.delete(id as StrategyId);
    return { success: true, data: { deleted: true } };
  }

  // ── Search & List ────────────────────────────────────────────────────────

  async searchStrategies(
    criteria: StrategySearchDTO,
  ): Promise<StrategyResult<{ items: ExecutionStrategyDTO[]; total: number }>> {
    const pagination: PaginationParams = { page: criteria.page ?? 1, limit: criteria.limit ?? 50 };
    const result = await this.repository.search(criteria, pagination);
    return {
      success: true,
      data: {
        items: result.data.map((s) => StrategyMapper.toDTO(s)),
        total: result.total,
      },
    };
  }

  async listStrategies(): Promise<StrategyResult<ExecutionStrategyDTO[]>> {
    const all = await this.repository.listAll();
    return { success: true, data: all.map((s) => StrategyMapper.toDTO(s)) };
  }

  async listByPriority(
    priority: StrategyPriority,
  ): Promise<StrategyResult<ExecutionStrategyDTO[]>> {
    const result = await this.repository.listByPriority(priority, { page: 1, limit: 100 });
    return { success: true, data: result.data.map((s) => StrategyMapper.toDTO(s)) };
  }

  async listByExecutionMode(mode: ExecutionMode): Promise<StrategyResult<ExecutionStrategyDTO[]>> {
    const result = await this.repository.listByExecutionMode(mode, { page: 1, limit: 100 });
    return { success: true, data: result.data.map((s) => StrategyMapper.toDTO(s)) };
  }

  async listByCapability(
    capability: CapabilityType,
  ): Promise<StrategyResult<ExecutionStrategyDTO[]>> {
    const result = await this.repository.listByCapability(capability, { page: 1, limit: 100 });
    return { success: true, data: result.data.map((s) => StrategyMapper.toDTO(s)) };
  }

  async listByGoal(goalId: string): Promise<StrategyResult<ExecutionStrategyDTO[]>> {
    const result = await this.repository.listByGoal(goalId, { page: 1, limit: 100 });
    return { success: true, data: result.data.map((s) => StrategyMapper.toDTO(s)) };
  }

  // ── Explain ──────────────────────────────────────────────────────────────

  async explainStrategy(id: string): Promise<StrategyResult<StrategyExplanationDTO>> {
    const strategy = await this.repository.findById(id as StrategyId);
    if (!strategy) return { success: false, error: `Strategy not found: ${id}` };
    return { success: true, data: StrategyMapper.explanationToDTO(strategy) };
  }

  // ── Estimates (no strategy persisted) ────────────────────────────────────

  estimateTokens(
    goal: string,
    tier: QualityTier,
    maxTokens?: number,
  ): StrategyResult<TokenEstimateDTO> {
    const estimate = this.strategyService.estimateTokens(goal, tier, maxTokens);
    return { success: true, data: estimate };
  }

  estimateCost(
    goal: string,
    tier: QualityTier,
    maxCostUsd?: number,
  ): StrategyResult<CostEstimateDTO> {
    const estimate = this.strategyService.estimateCost(goal, tier, maxCostUsd);
    return {
      success: true,
      data: {
        expectedCostUsd: estimate.expectedCostUsd,
        minimumCostUsd: Math.round(estimate.expectedCostUsd * 0.8 * 100) / 100,
        maximumCostUsd: estimate.maximumCostUsd,
        confidence: estimate.confidence,
      },
    };
  }

  estimateLatency(
    goal: string,
    tier: QualityTier,
    maxLatencyMs?: number,
  ): StrategyResult<LatencyEstimateDTO> {
    const estimate = this.strategyService.estimateLatency(goal, tier, maxLatencyMs);
    return {
      success: true,
      data: {
        expectedTimeMs: estimate.expectedTimeMs,
        minimumTimeMs: Math.round(estimate.expectedTimeMs * 0.8),
        maximumTimeMs: estimate.maximumTimeMs,
        confidence: estimate.confidence,
      },
    };
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  async getSummary(): Promise<StrategyResult<StrategySummaryDTO>> {
    const [total, averageConfidence, countByPriority, countByExecutionMode] = await Promise.all([
      this.repository.count(),
      this.repository.averageConfidence(),
      this.repository.countByPriority(),
      this.repository.countByExecutionMode(),
    ]);
    return {
      success: true,
      data: StrategyMapper.summaryToDTO(
        total,
        averageConfidence,
        countByPriority,
        countByExecutionMode,
      ),
    };
  }
}
