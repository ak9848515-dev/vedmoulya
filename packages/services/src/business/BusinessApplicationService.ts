// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Application Service
// Main orchestration entry point for the Business Intelligence Platform
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessSnapshotDTO, BusinessConfigDTO } from './BusinessDTO.js';
import type { BusinessDashboardViewModel } from './BusinessViewModelFactory.js';
import { BusinessAssembler } from './BusinessAssembler.js';
import { BusinessCacheService } from './BusinessCacheService.js';
import { BusinessConfigurationService } from './BusinessConfigurationService.js';
import { BusinessHealthService } from './BusinessHealthService.js';
import { BusinessAnalyticsService } from './BusinessAnalyticsService.js';
import { BusinessViewModelFactory } from './BusinessViewModelFactory.js';
import { BusinessDTOMapper } from './BusinessDTOMapper.js';

import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';

export interface BusinessResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

export class BusinessApplicationService {
  private readonly assembler: BusinessAssembler;
  private readonly cache: BusinessCacheService;
  private readonly config: BusinessConfigurationService;
  private readonly health: BusinessHealthService;
  private readonly analytics: BusinessAnalyticsService;
  private readonly viewModelFactory: BusinessViewModelFactory;
  private readonly mapper: BusinessDTOMapper;

  constructor(
    identityService: IdentityApplicationService,
    memoryService: MemoryApplicationService,
    decisionService: DecisionApplicationService,
    executionService: ExecutionApplicationService,
    knowledgeService: KnowledgeApplicationService,
    aiService: AIOrchestrationService,
  ) {
    this.assembler = new BusinessAssembler(
      identityService,
      memoryService,
      decisionService,
      executionService,
      knowledgeService,
      aiService,
    );
    this.cache = new BusinessCacheService(300_000);
    this.config = new BusinessConfigurationService();
    this.health = new BusinessHealthService();
    this.analytics = new BusinessAnalyticsService();
    this.viewModelFactory = new BusinessViewModelFactory();
    this.mapper = new BusinessDTOMapper();
  }

  async getBusiness(
    userId: string,
    displayName: string = 'My Business',
  ): Promise<BusinessResult<BusinessSnapshotDTO>> {
    const startTime = Date.now();
    const cacheKey = `business_${userId}`;

    try {
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get<BusinessSnapshotDTO>(cacheKey);
        if (cached.hit && cached.data) {
          this.analytics.trackCacheHit();
          this.analytics.trackLoad('business', Date.now() - startTime, true);
          return { success: true, data: cached.data, latency: Date.now() - startTime };
        }
      }

      this.analytics.trackCacheMiss();
      const snapshot = await this.assembler.assemble(userId, displayName);
      const userConfig = this.config.getConfig(userId);
      this.cache.set(cacheKey, snapshot, userConfig.enableNotifications ? 60_000 : 300_000);
      this.analytics.trackLoad('business', Date.now() - startTime, true);
      return { success: true, data: snapshot, latency: Date.now() - startTime };
    } catch (error) {
      this.analytics.trackLoad('business', Date.now() - startTime, false);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate business snapshot',
        latency: Date.now() - startTime,
      };
    }
  }

  async getBusinessViewModel(
    userId: string,
    displayName?: string,
  ): Promise<BusinessResult<BusinessDashboardViewModel>> {
    const result = await this.getBusiness(userId, displayName);
    if (!result.success || !result.data) {
      return { success: false, error: result.error, latency: result.latency };
    }
    const viewModel = this.viewModelFactory.createDashboardViewModel(result.data);
    return { success: true, data: viewModel, latency: result.latency };
  }

  getConfig(userId: string): BusinessConfigDTO {
    return this.config.getConfig(userId);
  }
  updateConfig(userId: string, updates: Partial<BusinessConfigDTO>): BusinessConfigDTO {
    return this.config.updateConfig(userId, updates);
  }
  resetConfig(userId: string): BusinessConfigDTO {
    return this.config.resetConfig(userId);
  }
  invalidateCache(userId: string): void {
    this.cache.invalidateByPrefix(`business_${userId}`);
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
