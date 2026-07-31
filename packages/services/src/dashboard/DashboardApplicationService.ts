// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Application Service
// Main orchestration entry point for the Dashboard Experience Platform
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type { DashboardSnapshotDTO } from './DashboardDTO.js';
import { DashboardAssembler } from './DashboardAssembler.js';
import { DashboardSnapshotService } from './DashboardSnapshotService.js';
import { DashboardCacheService } from './DashboardCacheService.js';
import { DashboardConfigurationService } from './DashboardConfigurationService.js';
import { DashboardPersonalizationService } from './DashboardPersonalizationService.js';
import { DashboardHealthService } from './DashboardHealthService.js';
import { DashboardMetricsService } from './DashboardMetricsService.js';
import { DashboardJourneyService } from './DashboardJourneyService.js';
import { DashboardRecommendationService } from './DashboardRecommendationService.js';
import { DashboardInsightService } from './DashboardInsightService.js';
import { DashboardNotificationService } from './DashboardNotificationService.js';
import { DashboardTimelineService } from './DashboardTimelineService.js';
import {
  DashboardAnalyticsService,
  type DashboardAnalyticsData,
} from './DashboardAnalyticsService.js';
import { DashboardViewModelFactory } from './DashboardViewModelFactory.js';
import { DashboardDTOMapper } from './DashboardDTOMapper.js';
import type {
  DashboardConfigDTO,
  PersonalizationConfigDTO,
  WidgetStateDTO,
  NotificationDTO,
  RecommendationDTO,
  CacheMetricsDTO,
} from './DashboardDTO.js';
import type {
  DashboardViewModel,
  IdentityViewModel,
  FocusViewModel,
  ExecutionViewModel,
  DecisionViewModel,
  MemoryViewModel,
  GrowthViewModel,
  JourneyViewModel,
  InsightSummaryViewModel,
  RecommendationSummaryViewModel,
  HealthViewModel,
  MetricsViewModel,
} from './DashboardViewModelFactory.js';

import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';

export interface DashboardResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

export class DashboardApplicationService {
  private readonly assembler: DashboardAssembler;
  private readonly snapshotService: DashboardSnapshotService;
  private readonly cache: DashboardCacheService;
  private readonly config: DashboardConfigurationService;
  private readonly personalization: DashboardPersonalizationService;
  private readonly health: DashboardHealthService;
  private readonly metrics: DashboardMetricsService;
  private readonly journey: DashboardJourneyService;
  private readonly recommendations: DashboardRecommendationService;
  private readonly insights: DashboardInsightService;
  private readonly notifications: DashboardNotificationService;
  private readonly timeline: DashboardTimelineService;
  private readonly analytics: DashboardAnalyticsService;
  private readonly viewModelFactory: DashboardViewModelFactory;
  private readonly mapper: DashboardDTOMapper;

  constructor(
    identityService: IdentityApplicationService,
    memoryService: MemoryApplicationService,
    decisionService: DecisionApplicationService,
    executionService: ExecutionApplicationService,
    knowledgeService: KnowledgeApplicationService,
    aiService: AIOrchestrationService,
  ) {
    this.assembler = new DashboardAssembler(
      identityService,
      memoryService,
      decisionService,
      executionService,
      knowledgeService,
      aiService,
    );
    this.cache = new DashboardCacheService(300_000);
    this.config = new DashboardConfigurationService();
    this.personalization = new DashboardPersonalizationService();
    this.health = new DashboardHealthService();
    this.metrics = new DashboardMetricsService();
    this.journey = new DashboardJourneyService();
    this.recommendations = new DashboardRecommendationService();
    this.insights = new DashboardInsightService();
    this.notifications = new DashboardNotificationService();
    this.timeline = new DashboardTimelineService();
    this.analytics = new DashboardAnalyticsService();
    this.viewModelFactory = new DashboardViewModelFactory();
    this.mapper = new DashboardDTOMapper();

    this.snapshotService = new DashboardSnapshotService(
      this.assembler,
      this.cache,
      this.config,
      this.analytics,
    );
  }

  // ── Snapshot Operations ──────────────────────────────────────────────────

  /** Get the full dashboard snapshot (cached) */
  async getDashboard(userId: string): Promise<DashboardResult<DashboardSnapshotDTO>> {
    const result = await this.snapshotService.getSnapshot(userId);
    if (result.error) {
      return { success: false, error: result.error, latency: result.latency };
    }
    return { success: true, data: result.data, latency: result.latency };
  }

  /** Get dashboard view model (computed from snapshot) */
  async getDashboardViewModel(userId: string): Promise<DashboardResult<DashboardViewModel>> {
    const result = await this.getDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error, latency: result.latency };
    }
    const viewModel = this.viewModelFactory.createDashboardViewModel(result.data);
    return { success: true, data: viewModel, latency: result.latency };
  }

  /** Get dashboard data or return error */
  private async requireDashboard(userId: string): Promise<DashboardResult<DashboardSnapshotDTO>> {
    const result = await this.getDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return { ...result, data: result.data };
  }

  /** Refresh a specific section */
  async refreshSection(
    userId: string,
    sectionId: string,
  ): Promise<DashboardResult<Partial<DashboardSnapshotDTO>>> {
    const result = await this.snapshotService.refreshSection(userId, sectionId);
    if (result.error) {
      return { success: false, error: result.error, latency: result.latency };
    }
    return { success: true, data: result.data, latency: result.latency };
  }

  /** Invalidate the cached snapshot */
  invalidateCache(userId: string): void {
    this.snapshotService.invalidateSnapshot(userId);
  }

  /** Warm the cache for a user (background) */
  async warmCache(userId: string): Promise<boolean> {
    return this.snapshotService.warmCache(userId);
  }

  // ── Section-specific Operations ──────────────────────────────────────────

  /** Get identity section */
  async getIdentity(userId: string): Promise<DashboardResult<IdentityViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createIdentityViewModel(result.data.identity),
    };
  }

  /** Get focus section */
  async getFocus(userId: string): Promise<DashboardResult<FocusViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createFocusViewModel(result.data.focus),
    };
  }

  /** Get execution section */
  async getExecution(userId: string): Promise<DashboardResult<ExecutionViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createExecutionViewModel(result.data.execution),
    };
  }

  /** Get decisions section */
  async getDecisions(userId: string): Promise<DashboardResult<DecisionViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createDecisionViewModel(result.data.decisions),
    };
  }

  /** Get memory section */
  async getMemory(userId: string): Promise<DashboardResult<MemoryViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createMemoryViewModel(result.data.memory),
    };
  }

  /** Get growth section */
  async getGrowth(userId: string): Promise<DashboardResult<GrowthViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createGrowthViewModel(result.data.growth),
    };
  }

  /** Get journey section */
  async getJourney(userId: string): Promise<DashboardResult<JourneyViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createJourneyViewModel(result.data.journey),
    };
  }

  /** Get insights section */
  async getInsights(userId: string): Promise<DashboardResult<InsightSummaryViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createInsightSummaryViewModel(result.data.insights),
    };
  }

  /** Get recommendations section */
  async getRecommendations(
    userId: string,
  ): Promise<DashboardResult<RecommendationSummaryViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createRecommendationSummaryViewModel(result.data.recommendations),
    };
  }

  /** Get health section */
  async getHealth(userId: string): Promise<DashboardResult<HealthViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createHealthViewModel(result.data.health),
    };
  }

  /** Get metrics section */
  async getMetrics(userId: string): Promise<DashboardResult<MetricsViewModel>> {
    const result = await this.requireDashboard(userId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      data: this.viewModelFactory.createMetricsViewModel(result.data.metrics),
    };
  }

  // ── Configuration Operations ─────────────────────────────────────────────

  /** Get dashboard configuration */
  getConfig(userId: string): DashboardConfigDTO {
    return this.config.getConfig(userId);
  }

  /** Update dashboard configuration */
  updateConfig(userId: string, updates: Partial<DashboardConfigDTO>): DashboardConfigDTO {
    return this.config.updateConfig(userId, updates);
  }

  /** Update widget state */
  updateWidgetState(
    userId: string,
    widgetId: string,
    state: Partial<WidgetStateDTO>,
  ): WidgetStateDTO {
    return this.config.updateWidgetState(userId, widgetId, state);
  }

  /** Update personalization preferences */
  updatePersonalization(
    userId: string,
    updates: Partial<PersonalizationConfigDTO>,
  ): PersonalizationConfigDTO {
    return this.config.updatePersonalization(userId, updates);
  }

  /** Reset configuration to defaults */
  resetConfig(userId: string): DashboardConfigDTO {
    return this.config.resetConfig(userId);
  }

  // ── Notification Operations ─────────────────────────────────────────────

  /** Dismiss a notification */
  dismissNotification(notifications: NotificationDTO[], id: string): NotificationDTO[] {
    return this.notifications.markAsRead(notifications, id);
  }

  /** Mark all notifications as read */
  markAllNotificationsRead(notifications: NotificationDTO[]): NotificationDTO[] {
    return this.notifications.markAllAsRead(notifications);
  }

  /** Get unread notification count */
  getUnreadNotificationCount(notifications: NotificationDTO[]): number {
    return this.notifications.getUnreadCount(notifications);
  }

  // ── Recommendation Operations ────────────────────────────────────────────

  /** Dismiss a recommendation */
  dismissRecommendation(recommendations: RecommendationDTO[], id: string): RecommendationDTO[] {
    return this.recommendations.dismissRecommendation(recommendations, id);
  }

  /** Prioritize recommendations */
  prioritizeRecommendations(
    recommendations: RecommendationDTO[],
    maxCount?: number,
  ): RecommendationDTO[] {
    return this.recommendations.prioritizeRecommendations(recommendations, maxCount);
  }

  // ── Analytics Operations ─────────────────────────────────────────────────

  /** Get performance analytics */
  getAnalytics(): DashboardAnalyticsData {
    return this.analytics.getAnalytics();
  }

  /** Get cache metrics */
  getCacheMetrics(): CacheMetricsDTO {
    return this.snapshotService.getCacheMetrics();
  }

  // ── Health Operations ────────────────────────────────────────────────────

  /** Report service health */
  reportServiceHealth(
    name: string,
    status: 'healthy' | 'degraded' | 'down',
    latency: number,
  ): void {
    this.health.reportHealth(name, status, latency);
  }

  /** Check if dashboard is healthy */
  isHealthy(): boolean {
    return this.health.isHealthy();
  }
}
