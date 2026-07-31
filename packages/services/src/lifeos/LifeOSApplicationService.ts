// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Application Service
// Main orchestration entry point for the Life OS Integration Layer
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type {
  LifeOSSnapshotDTO,
  LifeOSConfigDTO,
  LifeOSSearchResultDTO,
  LifeOSSearchCategory,
  LifeOSModule,
  LifeOSCacheMetricsDTO,
} from './LifeOSDTO.js';
import type { LifeOSDashboardViewModel } from './LifeOSViewModelFactory.js';
import { LifeOSAssembler } from './LifeOSAssembler.js';
import { LifeOSSnapshotService } from './LifeOSSnapshotService.js';
import { LifeOSCacheService } from './LifeOSCacheService.js';
import { LifeOSConfigurationService } from './LifeOSConfigurationService.js';
import { LifeOSHealthService } from './LifeOSHealthService.js';
import { LifeOSAnalyticsService } from './LifeOSAnalyticsService.js';
import { LifeOSViewModelFactory } from './LifeOSViewModelFactory.js';
import { LifeOSDTOMapper } from './LifeOSDTOMapper.js';
import { LifeOSSearchService } from './LifeOSSearchService.js';
import { LifeOSNavigationService, type NavigationItem } from './LifeOSNavigationService.js';

import type { DashboardApplicationService } from '../dashboard/index.js';
import type { CareerApplicationService } from '../career/index.js';
import type { LearningApplicationService } from '../learning/index.js';
import type { BusinessApplicationService } from '../business/index.js';
import type { MarketplaceApplicationService } from '../marketplace/index.js';
import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';

export interface LifeOSResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

export class LifeOSApplicationService {
  private readonly assembler: LifeOSAssembler;
  private readonly snapshotService: LifeOSSnapshotService;
  private readonly cache: LifeOSCacheService;
  private readonly config: LifeOSConfigurationService;
  private readonly health: LifeOSHealthService;
  private readonly analytics: LifeOSAnalyticsService;
  private readonly search: LifeOSSearchService;
  private readonly navigation: LifeOSNavigationService;
  private readonly viewModelFactory: LifeOSViewModelFactory;
  private readonly mapper: LifeOSDTOMapper;

  constructor(
    dashboardService: DashboardApplicationService,
    careerService: CareerApplicationService,
    learningService: LearningApplicationService,
    businessService: BusinessApplicationService,
    marketplaceService: MarketplaceApplicationService,
    identityService: IdentityApplicationService,
    memoryService: MemoryApplicationService,
    decisionService: DecisionApplicationService,
    executionService: ExecutionApplicationService,
    knowledgeService: KnowledgeApplicationService,
    aiService: AIOrchestrationService,
  ) {
    this.assembler = new LifeOSAssembler(
      dashboardService,
      careerService,
      learningService,
      businessService,
      marketplaceService,
      identityService,
      memoryService,
      decisionService,
      executionService,
      knowledgeService,
      aiService,
    );
    this.cache = new LifeOSCacheService(300_000);
    this.config = new LifeOSConfigurationService();
    this.health = new LifeOSHealthService();
    this.analytics = new LifeOSAnalyticsService();
    this.search = new LifeOSSearchService();
    this.navigation = new LifeOSNavigationService();
    this.viewModelFactory = new LifeOSViewModelFactory();
    this.mapper = new LifeOSDTOMapper();
    this.snapshotService = new LifeOSSnapshotService(
      this.assembler,
      this.cache,
      this.config,
      this.analytics,
    );
  }

  // ── Unified Snapshot ─────────────────────────────────────────────────────

  async getLifeOS(userId: string): Promise<LifeOSResult<LifeOSSnapshotDTO>> {
    const result = await this.snapshotService.getSnapshot(userId);
    if (result.error) {
      return { success: false, error: result.error, latency: result.latency };
    }
    return { success: true, data: result.data, latency: result.latency };
  }

  async getLifeOSViewModel(userId: string): Promise<LifeOSResult<LifeOSDashboardViewModel>> {
    const result = await this.getLifeOS(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error, latency: result.latency };
    }
    const viewModel = this.viewModelFactory.createDashboardViewModel(result.data);
    return { success: true, data: viewModel, latency: result.latency };
  }

  invalidateCache(userId: string): void {
    this.snapshotService.invalidateSnapshot(userId);
  }

  // ── Search ───────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/require-await
  async globalSearch(
    query: string,
    options?: {
      categories?: LifeOSSearchCategory[];
      sources?: LifeOSModule[];
      maxResults?: number;
    },
  ): Promise<LifeOSSearchResultDTO[]> {
    this.analytics.trackSearch();
    const results = this.search.search(query, options);
    this.analytics.trackLoad('search', 0, true);
    return results;
  }

  indexSearchItems(items: LifeOSSearchResultDTO[]): void {
    this.search.indexItems(items);
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  getNavigation(badges?: Partial<Record<LifeOSModule, number>>): NavigationItem[] {
    return this.navigation.getNavigation(badges);
  }

  // ── Configuration ────────────────────────────────────────────────────────

  getConfig(userId: string): LifeOSConfigDTO {
    return this.config.getConfig(userId);
  }
  updateConfig(userId: string, updates: Partial<LifeOSConfigDTO>): LifeOSConfigDTO {
    return this.config.updateConfig(userId, updates);
  }
  resetConfig(userId: string): LifeOSConfigDTO {
    return this.config.resetConfig(userId);
  }

  // ── Health ───────────────────────────────────────────────────────────────

  reportModuleHealth(
    name: LifeOSModule,
    status: 'healthy' | 'degraded' | 'down',
    latency: number,
  ): void {
    this.health.reportModuleHealth(name, status, latency);
  }

  isHealthy(): boolean {
    return this.health.isHealthy();
  }

  // ── Analytics ────────────────────────────────────────────────────────────

  getAnalytics(): {
    totalLoads: number;
    averageLoadTime: number;
    cacheHitRate: number;
    searchCount: number;
    timelineMerges: number;
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

  // ── Cache ────────────────────────────────────────────────────────────────

  getCacheMetrics(): LifeOSCacheMetricsDTO {
    return this.snapshotService.getCacheMetrics();
  }
}
