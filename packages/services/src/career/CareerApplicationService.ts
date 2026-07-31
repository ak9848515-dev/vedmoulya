// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Application Service
// Main orchestration entry point for the Career Intelligence Platform
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CareerSnapshotDTO } from './CareerDTO.js';
import { CareerAssembler } from './CareerAssembler.js';
import { CareerCacheService } from './CareerCacheService.js';
import { CareerConfigurationService } from './CareerConfigurationService.js';
import { CareerHealthService } from './CareerHealthService.js';
import { CareerAnalyticsService } from './CareerAnalyticsService.js';
import { CareerViewModelFactory } from './CareerViewModelFactory.js';
import { CareerDTOMapper } from './CareerDTOMapper.js';
import type { CareerConfigDTO } from './CareerDTO.js';
import type { CareerDashboardViewModel } from './CareerViewModelFactory.js';

import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';

export interface CareerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

export class CareerApplicationService {
  private readonly assembler: CareerAssembler;
  private readonly cache: CareerCacheService;
  private readonly config: CareerConfigurationService;
  private readonly health: CareerHealthService;
  private readonly analytics: CareerAnalyticsService;
  private readonly viewModelFactory: CareerViewModelFactory;
  private readonly mapper: CareerDTOMapper;

  constructor(
    identityService: IdentityApplicationService,
    memoryService: MemoryApplicationService,
    decisionService: DecisionApplicationService,
    executionService: ExecutionApplicationService,
    knowledgeService: KnowledgeApplicationService,
    aiService: AIOrchestrationService,
  ) {
    this.assembler = new CareerAssembler(
      identityService,
      memoryService,
      decisionService,
      executionService,
      knowledgeService,
      aiService,
    );
    this.cache = new CareerCacheService(300_000);
    this.config = new CareerConfigurationService();
    this.health = new CareerHealthService();
    this.analytics = new CareerAnalyticsService();
    this.viewModelFactory = new CareerViewModelFactory();
    this.mapper = new CareerDTOMapper();
  }

  // ── Snapshot Operations ──────────────────────────────────────────────────

  /** Get the full career snapshot (cached) */
  async getCareer(
    userId: string,
    displayName: string = 'User',
  ): Promise<CareerResult<CareerSnapshotDTO>> {
    const startTime = Date.now();
    const cacheKey = `career_${userId}`;

    try {
      // Try cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get<CareerSnapshotDTO>(cacheKey);
        if (cached.hit && cached.data) {
          this.analytics.trackCacheHit();
          this.analytics.trackLoad('career', Date.now() - startTime, true);
          return { success: true, data: cached.data, latency: Date.now() - startTime };
        }
      }

      this.analytics.trackCacheMiss();

      // Generate fresh snapshot
      const snapshot = await this.assembler.assemble(userId, displayName);
      const userConfig = this.config.getConfig(userId);

      // Cache the result
      this.cache.set(cacheKey, snapshot, userConfig.jobSearchActive ? 60_000 : 300_000);

      this.analytics.trackLoad('career', Date.now() - startTime, true);
      return { success: true, data: snapshot, latency: Date.now() - startTime };
    } catch (error) {
      this.analytics.trackLoad('career', Date.now() - startTime, false);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate career snapshot',
        latency: Date.now() - startTime,
      };
    }
  }

  /** Get career view model (computed from snapshot) */
  async getCareerViewModel(
    userId: string,
    displayName?: string,
  ): Promise<CareerResult<CareerDashboardViewModel>> {
    const result = await this.getCareer(userId, displayName);
    if (!result.success || !result.data) {
      return { success: false, error: result.error, latency: result.latency };
    }
    const viewModel = this.viewModelFactory.createDashboardViewModel(result.data);
    return { success: true, data: viewModel, latency: result.latency };
  }

  // ── Service Accessors ────────────────────────────────────────────────────

  // ── Configuration Operations ─────────────────────────────────────────────

  getConfig(userId: string): CareerConfigDTO {
    return this.config.getConfig(userId);
  }

  updateConfig(userId: string, updates: Partial<CareerConfigDTO>): CareerConfigDTO {
    return this.config.updateConfig(userId, updates);
  }

  resetConfig(userId: string): CareerConfigDTO {
    return this.config.resetConfig(userId);
  }

  // ── Cache Operations ─────────────────────────────────────────────────────

  invalidateCache(userId: string): void {
    this.cache.invalidateByPrefix(`career_${userId}`);
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
