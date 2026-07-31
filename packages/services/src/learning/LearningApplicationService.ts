// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Application Service
// Main orchestration entry point for the Learning Intelligence Platform
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningSnapshotDTO, LearningConfigDTO } from './LearningDTO.js';
import type { LearningDashboardViewModel } from './LearningViewModelFactory.js';
import { LearningAssembler } from './LearningAssembler.js';
import { LearningCacheService } from './LearningCacheService.js';
import { LearningConfigurationService } from './LearningConfigurationService.js';
import { LearningHealthService } from './LearningHealthService.js';
import { LearningAnalyticsService } from './LearningAnalyticsService.js';
import { LearningViewModelFactory } from './LearningViewModelFactory.js';
import { LearningDTOMapper } from './LearningDTOMapper.js';

import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';

export interface LearningResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

export class LearningApplicationService {
  private readonly assembler: LearningAssembler;
  private readonly cache: LearningCacheService;
  private readonly config: LearningConfigurationService;
  private readonly health: LearningHealthService;
  private readonly analytics: LearningAnalyticsService;
  private readonly viewModelFactory: LearningViewModelFactory;
  private readonly mapper: LearningDTOMapper;

  constructor(
    identityService: IdentityApplicationService,
    memoryService: MemoryApplicationService,
    decisionService: DecisionApplicationService,
    executionService: ExecutionApplicationService,
    knowledgeService: KnowledgeApplicationService,
    aiService: AIOrchestrationService,
  ) {
    this.assembler = new LearningAssembler(
      identityService,
      memoryService,
      decisionService,
      executionService,
      knowledgeService,
      aiService,
    );
    this.cache = new LearningCacheService(300_000);
    this.config = new LearningConfigurationService();
    this.health = new LearningHealthService();
    this.analytics = new LearningAnalyticsService();
    this.viewModelFactory = new LearningViewModelFactory();
    this.mapper = new LearningDTOMapper();
  }

  // ── Snapshot Operations ──────────────────────────────────────────────────

  /** Get the full learning snapshot (cached) */
  async getLearning(
    userId: string,
    displayName: string = 'User',
  ): Promise<LearningResult<LearningSnapshotDTO>> {
    const startTime = Date.now();
    const cacheKey = `learning_${userId}`;

    try {
      // Try cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get<LearningSnapshotDTO>(cacheKey);
        if (cached.hit && cached.data) {
          this.analytics.trackCacheHit();
          this.analytics.trackLoad('learning', Date.now() - startTime, true);
          return { success: true, data: cached.data, latency: Date.now() - startTime };
        }
      }

      this.analytics.trackCacheMiss();

      // Generate fresh snapshot
      const snapshot = await this.assembler.assemble(userId, displayName);
      const userConfig = this.config.getConfig(userId);

      // Cache the result
      this.cache.set(cacheKey, snapshot, userConfig.enableReminders ? 60_000 : 300_000);

      this.analytics.trackLoad('learning', Date.now() - startTime, true);
      return { success: true, data: snapshot, latency: Date.now() - startTime };
    } catch (error) {
      this.analytics.trackLoad('learning', Date.now() - startTime, false);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate learning snapshot',
        latency: Date.now() - startTime,
      };
    }
  }

  /** Get learning view model (computed from snapshot) */
  async getLearningViewModel(
    userId: string,
    displayName?: string,
  ): Promise<LearningResult<LearningDashboardViewModel>> {
    const result = await this.getLearning(userId, displayName);
    if (!result.success || !result.data) {
      return { success: false, error: result.error, latency: result.latency };
    }
    const viewModel = this.viewModelFactory.createDashboardViewModel(result.data);
    return { success: true, data: viewModel, latency: result.latency };
  }

  // ── Configuration Operations ─────────────────────────────────────────────

  getConfig(userId: string): LearningConfigDTO {
    return this.config.getConfig(userId);
  }

  updateConfig(userId: string, updates: Partial<LearningConfigDTO>): LearningConfigDTO {
    return this.config.updateConfig(userId, updates);
  }

  resetConfig(userId: string): LearningConfigDTO {
    return this.config.resetConfig(userId);
  }

  // ── Cache Operations ─────────────────────────────────────────────────────

  invalidateCache(userId: string): void {
    this.cache.invalidateByPrefix(`learning_${userId}`);
  }

  // ── Health Operations ────────────────────────────────────────────────────

  reportServiceHealth(
    name: string,
    status: 'healthy' | 'degraded' | 'down',
    latency: number,
  ): void {
    this.health.reportHealth(name, status, latency);
  }

  isHealthy(): boolean {
    return this.health.isHealthy();
  }

  // ── Analytics Operations ─────────────────────────────────────────────────

  getAnalytics(): {
    totalLoads: number;
    averageLoadTime: number;
    cacheHitRate: number;
    recentEvents: Array<{
      type: string;
      section: string;
      latency: number;
      timestamp: string;
      success: boolean;
    }>;
  } {
    return this.analytics.getAnalytics();
  }
}
