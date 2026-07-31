// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Application Service
// Main orchestration entry point for the Marketplace Platform
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceSnapshotDTO, MarketplaceConfigDTO } from './MarketplaceDTO.js';
import type { MarketplaceDashboardViewModel } from './MarketplaceViewModelFactory.js';
import { MarketplaceAssembler } from './MarketplaceAssembler.js';
import { MarketplaceCacheService } from './MarketplaceCacheService.js';
import { MarketplaceConfigurationService } from './MarketplaceConfigurationService.js';
import { MarketplaceHealthService } from './MarketplaceHealthService.js';
import { MarketplaceAnalyticsService } from './MarketplaceAnalyticsService.js';
import { MarketplaceViewModelFactory } from './MarketplaceViewModelFactory.js';
import { MarketplaceDTOMapper } from './MarketplaceDTOMapper.js';

import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';

export interface MarketplaceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

export class MarketplaceApplicationService {
  private readonly assembler: MarketplaceAssembler;
  private readonly cache: MarketplaceCacheService;
  private readonly config: MarketplaceConfigurationService;
  private readonly health: MarketplaceHealthService;
  private readonly analytics: MarketplaceAnalyticsService;
  private readonly viewModelFactory: MarketplaceViewModelFactory;
  private readonly mapper: MarketplaceDTOMapper;

  constructor(
    identityService: IdentityApplicationService,
    memoryService: MemoryApplicationService,
    decisionService: DecisionApplicationService,
    executionService: ExecutionApplicationService,
    knowledgeService: KnowledgeApplicationService,
    aiService: AIOrchestrationService,
  ) {
    this.assembler = new MarketplaceAssembler(
      identityService,
      memoryService,
      decisionService,
      executionService,
      knowledgeService,
      aiService,
    );
    this.cache = new MarketplaceCacheService(300_000);
    this.config = new MarketplaceConfigurationService();
    this.health = new MarketplaceHealthService();
    this.analytics = new MarketplaceAnalyticsService();
    this.viewModelFactory = new MarketplaceViewModelFactory();
    this.mapper = new MarketplaceDTOMapper();
  }

  async getMarketplace(
    userId: string,
    displayName: string = 'My Workspace',
  ): Promise<MarketplaceResult<MarketplaceSnapshotDTO>> {
    const startTime = Date.now();
    const cacheKey = `marketplace_${userId}`;

    try {
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get<MarketplaceSnapshotDTO>(cacheKey);
        if (cached.hit && cached.data) {
          this.analytics.trackCacheHit();
          this.analytics.trackLoad('marketplace', Date.now() - startTime, true);
          return { success: true, data: cached.data, latency: Date.now() - startTime };
        }
      }

      this.analytics.trackCacheMiss();
      const snapshot = await this.assembler.assemble(userId, displayName);
      const userConfig = this.config.getConfig(userId);
      this.cache.set(cacheKey, snapshot, userConfig.cacheTTL);
      this.analytics.trackLoad('marketplace', Date.now() - startTime, true);
      return { success: true, data: snapshot, latency: Date.now() - startTime };
    } catch (error) {
      this.analytics.trackLoad('marketplace', Date.now() - startTime, false);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate marketplace snapshot',
        latency: Date.now() - startTime,
      };
    }
  }

  async getMarketplaceViewModel(
    userId: string,
    displayName?: string,
  ): Promise<MarketplaceResult<MarketplaceDashboardViewModel>> {
    const result = await this.getMarketplace(userId, displayName);
    if (!result.success || !result.data) {
      return { success: false, error: result.error, latency: result.latency };
    }
    const viewModel = this.viewModelFactory.createDashboardViewModel(result.data);
    return { success: true, data: viewModel, latency: result.latency };
  }

  getConfig(userId: string): MarketplaceConfigDTO {
    return this.config.getConfig(userId);
  }
  updateConfig(userId: string, updates: Partial<MarketplaceConfigDTO>): MarketplaceConfigDTO {
    return this.config.updateConfig(userId, updates);
  }
  resetConfig(userId: string): MarketplaceConfigDTO {
    return this.config.resetConfig(userId);
  }
  invalidateCache(userId: string): void {
    this.cache.invalidateByPrefix(`marketplace_${userId}`);
  }
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
