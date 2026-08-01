// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Assembler
// Assembles the complete unified Life OS snapshot from all certified modules
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSSnapshotDTO, LifeOSModule, LifeOSModuleSummaryDTO } from './LifeOSDTO.js';
import { LifeOSDTOMapper } from './LifeOSDTOMapper.js';
import { LifeOSNavigationService } from './LifeOSNavigationService.js';
import { LifeOSSearchService } from './LifeOSSearchService.js';
import { LifeOSTimelineService } from './LifeOSTimelineService.js';
import { LifeOSRecommendationService } from './LifeOSRecommendationService.js';
import { LifeOSNotificationService } from './LifeOSNotificationService.js';
import { LifeOSQuickActionService } from './LifeOSQuickActionService.js';
import { LifeOSInsightService } from './LifeOSInsightService.js';
import { LifeOSMetricsService } from './LifeOSMetricsService.js';
import { LifeOSHealthService } from './LifeOSHealthService.js';
import { LifeOSConfigurationService } from './LifeOSConfigurationService.js';

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

export interface SafeCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-plus-operands, security/detect-object-injection */
// LifeOSAssembler merges data from many sources — dynamic property access and
// as-casts are inherent to the data-assembly pattern and cannot be statically typed.
export class LifeOSAssembler {
  private readonly mapper: LifeOSDTOMapper;
  private _navigation: LifeOSNavigationService | undefined;
  private _search: LifeOSSearchService | undefined;
  private readonly timeline: LifeOSTimelineService;
  private readonly recommendations: LifeOSRecommendationService;
  private readonly notifications: LifeOSNotificationService;
  private readonly quickActions: LifeOSQuickActionService;
  private readonly insights: LifeOSInsightService;
  private readonly metrics: LifeOSMetricsService;
  private readonly health: LifeOSHealthService;
  private readonly config: LifeOSConfigurationService;

  constructor(
    private readonly dashboardService: DashboardApplicationService,
    private readonly careerService: CareerApplicationService,
    private readonly learningService: LearningApplicationService,
    private readonly businessService: BusinessApplicationService,
    private readonly marketplaceService: MarketplaceApplicationService,
    private readonly _identityService: IdentityApplicationService,
    private readonly _memoryService: MemoryApplicationService,
    private readonly _decisionService: DecisionApplicationService,
    private readonly _executionService: ExecutionApplicationService,
    private readonly _knowledgeService: KnowledgeApplicationService,
    private readonly _aiService: AIOrchestrationService,
  ) {
    this.mapper = new LifeOSDTOMapper();
    this.timeline = new LifeOSTimelineService();
    this.recommendations = new LifeOSRecommendationService();
    this.notifications = new LifeOSNotificationService();
    this.quickActions = new LifeOSQuickActionService();
    this.insights = new LifeOSInsightService();
    this.metrics = new LifeOSMetricsService();
    this.health = new LifeOSHealthService();
    this.config = new LifeOSConfigurationService();
  }

  async assemble(userId: string): Promise<LifeOSSnapshotDTO> {
    const startTime = Date.now();

    // Gather certified module snapshots
    const dashboardResult = await this.safeCall(() => this.dashboardService.getDashboard(userId));
    const careerResult = await this.safeCall(() => this.careerService.getCareer(userId, 'User'));
    const learningResult = await this.safeCall(() =>
      this.learningService.getLearning(userId, 'User'),
    );
    const businessResult = await this.safeCall(() =>
      this.businessService.getBusiness(userId, 'My Business'),
    );
    const marketplaceResult = await this.safeCall(() =>
      this.marketplaceService.getMarketplace(userId, 'My Workspace'),
    );

    const dashboardData = dashboardResult.success ? (dashboardResult.data as any)?.data : undefined;
    const careerData = careerResult.success ? (careerResult.data as any)?.data : undefined;
    const learningData = learningResult.success ? (learningResult.data as any)?.data : undefined;
    const businessData = businessResult.success ? (businessResult.data as any)?.data : undefined;
    const marketplaceData = marketplaceResult.success
      ? (marketplaceResult.data as any)?.data
      : undefined;

    // Build module summaries
    const dashboardSummary = this.buildModuleSummary('dashboard', dashboardData);
    const careerSummary = this.buildModuleSummary('career', careerData);
    const learningSummary = this.buildModuleSummary('learning', learningData);
    const businessSummary = this.buildModuleSummary('business', businessData);
    const marketplaceSummary = this.buildModuleSummary('marketplace', marketplaceData);

    // Extract cross-domain data
    const allNotifications = this.extractNotifications(
      dashboardData,
      careerData,
      learningData,
      businessData,
      marketplaceData,
    );
    const allQuickActions = this.extractQuickActions(
      dashboardData,
      careerData,
      learningData,
      businessData,
      marketplaceData,
    );
    const timelineEntries = this.extractTimelineEntries(
      dashboardData,
      careerData,
      learningData,
      businessData,
      marketplaceData,
    );

    // Global notifications
    const globalNotifications = this.notifications.aggregateNotifications(allNotifications);

    // Quick actions
    const aggregatedQuickActions = this.quickActions.aggregateQuickActions(allQuickActions);

    // Unified timeline
    const unifiedTimeline = this.timeline.mergeTimelines(timelineEntries, 'week');

    // Priorities
    const priorities = this.buildPriorities(businessData, careerData, learningData, dashboardData);

    // Cross-domain insights
    const crossDomainInsights = this.insights.generateCrossDomainInsights({
      totalNotifications: globalNotifications.length,
      unreadCount: this.notifications.getUnreadCount(globalNotifications),
      pendingDecisions: dashboardData?.decisions?.pendingDecisions ?? 0,
      activePlans: dashboardData?.execution?.activePlans ?? 0,
      completedToday: dashboardData?.execution?.completedToday ?? 0,
      hasCriticalRisks: businessData ? this.hasCriticalRisks(businessData) : false,
      careerProgress: careerData ? this.getCareerProgress(careerData) : 0,
      learningProgress: learningData ? this.getLearningProgress(learningData) : 0,
      businessHealth: businessData ? this.getBusinessHealth(businessData) : 100,
      marketplaceUpdates: marketplaceData?.availableUpdates?.length ?? 0,
    });

    // Cross-domain recommendations
    const recDTOs = this.recommendations.generateCrossDomainRecommendations({
      careerProgress: careerData ? this.getCareerProgress(careerData) : 0,
      learningProgress: learningData ? this.getLearningProgress(learningData) : 0,
      businessGoalsAtRisk: businessData ? this.getBusinessGoalsAtRisk(businessData) : 0,
      hasCriticalRisks: businessData ? this.hasCriticalRisks(businessData) : false,
      marketplaceUpdates: marketplaceData?.availableUpdates?.length ?? 0,
      pendingDecisions: dashboardData?.decisions?.pendingDecisions ?? 0,
      hasBlockedProjects: businessData ? this.hasBlockedProjects(businessData) : false,
      skillGaps: careerData ? this.getSkillGaps(careerData) : 0,
    });

    // Metrics
    const metricsDTO = this.metrics.aggregate({
      moduleEngagement: {
        dashboard: dashboardResult.success ? 1 : 0,
        career: careerResult.success ? 1 : 0,
        learning: learningResult.success ? 1 : 0,
        business: businessResult.success ? 1 : 0,
        marketplace: marketplaceResult.success ? 1 : 0,
      },
      totalNotifications: globalNotifications.length,
      unreadNotifications: this.notifications.getUnreadCount(globalNotifications),
      totalRecommendations: recDTOs.length,
      activeRecommendations: recDTOs.filter((r) => !r.isDismissed).length,
      searchPerformed: 0,
      timelineEntries: unifiedTimeline.totalEntries,
      quickActionsUsed: aggregatedQuickActions.length,
      engagementScore: 80,
      notificationResponse: 70,
      recommendationFollow: 60,
      timelineActivity: 75,
      searchEngagement: 50,
      overallConsistency: 65,
    });

    // Identity
    const identitySummary = {
      displayName: dashboardData?.identity?.displayName ?? 'User',
      email: dashboardData?.identity?.email ?? '',
      role: dashboardData?.identity?.role ?? '',
      purpose: dashboardData?.identity?.purpose ?? '',
      primaryGoal: dashboardData?.identity?.primaryGoal ?? '',
      currentJourney: dashboardData?.identity?.currentJourney ?? '',
      greeting: `Good ${this.getTimeOfDay()}, ${dashboardData?.identity?.displayName ?? 'User'}!`,
      avatarUrl: dashboardData?.identity?.avatarUrl,
    };

    // AI Context
    const aiContext = this.insights.buildAIContext({
      displayName: identitySummary.displayName,
      currentFocus: priorities[0]?.title ?? 'Getting started with Life OS',
      recentActivity: crossDomainInsights,
      crossDomainInsights,
      topPriorities: priorities.map((p) => p.title),
    });

    this.health.reportModuleHealth(
      'dashboard',
      dashboardResult.success ? 'healthy' : 'degraded',
      Date.now() - startTime,
    );
    this.health.reportModuleHealth(
      'career',
      careerResult.success ? 'healthy' : 'degraded',
      Date.now() - startTime,
    );
    this.health.reportModuleHealth(
      'learning',
      learningResult.success ? 'healthy' : 'degraded',
      Date.now() - startTime,
    );
    this.health.reportModuleHealth(
      'business',
      businessResult.success ? 'healthy' : 'degraded',
      Date.now() - startTime,
    );
    this.health.reportModuleHealth(
      'marketplace',
      marketplaceResult.success ? 'healthy' : 'degraded',
      Date.now() - startTime,
    );

    const moduleHealth = this.health.getModuleHealth();
    const platformHealth = this.mapper.createPlatformHealth(moduleHealth);

    const snapshot: LifeOSSnapshotDTO = {
      id: `losnap_${userId}_${Date.now()}`,
      userId,
      generatedAt: new Date().toISOString(),
      ttl: 300_000,
      identity: identitySummary,
      dashboard: dashboardSummary,
      career: careerSummary,
      learning: learningSummary,
      business: businessSummary,
      marketplace: marketplaceSummary,
      memory: {
        totalMemories: 0,
        recentCount: 0,
        importantEvents: 0,
        aiObservations: [],
        reflectionPrompts: [],
      },
      decisions: {
        pendingDecisions: dashboardData?.decisions?.pendingDecisions ?? 0,
        decisionsToday: 0,
        averageConfidence: dashboardData?.decisions?.averageConfidence ?? 0,
        highRiskCount: dashboardData?.decisions?.highRiskDecisions ?? 0,
        topPending: [],
      },
      execution: {
        activePlans: dashboardData?.execution?.activePlans ?? 0,
        blockedPlans: dashboardData?.execution?.blockedPlans ?? 0,
        completedToday: dashboardData?.execution?.completedToday ?? 0,
        totalEstimatedMinutes: dashboardData?.execution?.totalEstimatedMinutes ?? 0,
        recoverySuggestions: dashboardData?.execution?.recoverySuggestions ?? [],
      },
      knowledge: { totalNodes: 0, recentNodes: 0, topCategories: [], lastUpdated: undefined },
      priorities,
      unifiedTimeline,
      crossDomainRecommendations: this.recommendations.prioritizeRecommendations(recDTOs),
      globalNotifications,
      quickActions: aggregatedQuickActions,
      searchResults: [],
      platformHealth,
      metrics: metricsDTO,
      aiContext,
    };

    return snapshot;
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private buildModuleSummary(
    module: LifeOSModule,
    data?: Record<string, unknown>,
  ): LifeOSModuleSummaryDTO {
    return {
      module,
      status: data ? 'available' : 'unavailable',
      summary: data
        ? `${module.charAt(0).toUpperCase() + module.slice(1)} module operational`
        : `${module} module unavailable`,
      metrics: {},
      lastUpdated: new Date().toISOString(),
      hasNotifications: false,
      notificationCount: 0,
    };
  }

  private extractNotifications(
    ...snapshots: Array<Record<string, unknown> | undefined>
  ): Array<{ module: LifeOSModule; notifications: any[] }> {
    const modules: LifeOSModule[] = ['dashboard', 'career', 'learning', 'business', 'marketplace'];
    const result: Array<{ module: LifeOSModule; notifications: any[] }> = [];
    for (let i = 0; i < snapshots.length; i++) {
      const data = snapshots[i];
      const notifs = (data as any)?.notifications ?? (data as any)?.globalNotifications ?? [];
      result.push({ module: modules[i]!, notifications: Array.isArray(notifs) ? notifs : [] });
    }
    return result;
  }

  private extractQuickActions(
    ...snapshots: Array<Record<string, unknown> | undefined>
  ): Array<{ module: LifeOSModule; actions: any[] }> {
    const modules: LifeOSModule[] = ['dashboard', 'career', 'learning', 'business', 'marketplace'];
    const result: Array<{ module: LifeOSModule; actions: any[] }> = [];
    for (let i = 0; i < snapshots.length; i++) {
      const data = snapshots[i];
      const actions = (data as any)?.quickActions ?? [];
      result.push({ module: modules[i]!, actions: Array.isArray(actions) ? actions : [] });
    }
    return result;
  }

  private extractTimelineEntries(
    ...snapshots: Array<Record<string, unknown> | undefined>
  ): Array<{ entries: any[] }> {
    const entries: any[] = [];
    for (const data of snapshots) {
      if (data) {
        const timeline = (data as any)?.timeline;
        if (timeline?.entries) entries.push(...timeline.entries);
      }
    }
    return [{ entries }];
  }

  private buildPriorities(
    business?: Record<string, unknown>,
    career?: Record<string, unknown>,
    learning?: Record<string, unknown>,
    dashboard?: Record<string, unknown>,
  ): LifeOSSnapshotDTO['priorities'] {
    const priorities: LifeOSSnapshotDTO['priorities'] = [];
    const businessData = business as any;
    const careerData = career as any;
    const learningData = learning as any;
    const dashboardData = dashboard as any;

    if (businessData?.goals?.[0]) {
      priorities.push(
        this.mapper.createPriority(
          'biz_goal_1',
          businessData.goals[0].title,
          'Business goal',
          'business',
          1,
          'goal',
        ),
      );
    }
    if (careerData?.currentRole) {
      priorities.push(
        this.mapper.createPriority(
          'career_role',
          `Advance in ${careerData.currentRole}`,
          'Career growth',
          'career',
          2,
          'career',
        ),
      );
    }
    if (learningData?.activePaths?.[0]) {
      priorities.push(
        this.mapper.createPriority(
          'learn_path',
          learningData.activePaths[0].name,
          'Learning path',
          'learning',
          3,
          'learning',
        ),
      );
    }
    if (dashboardData?.focus?.missionLabel) {
      priorities.push(
        this.mapper.createPriority(
          'dash_mission',
          dashboardData.focus.missionLabel,
          dashboardData.focus.missionDescription ?? '',
          'dashboard',
          4,
          'mission',
          dashboardData.focus.isBlocked,
        ),
      );
    }

    return priorities.sort((a, b) => a.priority - b.priority);
  }

  private hasCriticalRisks(data: Record<string, unknown>): boolean {
    return (data.risks as any)?.some((r: any) => r.riskScore >= 15) ?? false;
  }

  private getCareerProgress(data: Record<string, unknown>): number {
    const roadmap = data.roadmap as any;
    return roadmap?.progress ?? 50;
  }

  private getLearningProgress(data: Record<string, unknown>): number {
    const paths = data.activePaths as any;
    if (paths?.length > 0) {
      return Math.round(
        paths.reduce((s: number, p: any) => s + (p.progress ?? 0), 0) / paths.length,
      );
    }
    return 50;
  }

  private getBusinessGoalsAtRisk(data: Record<string, unknown>): number {
    return (data.kpis as any)?.filter((k: any) => k.currentValue < k.targetValue * 0.5).length ?? 0;
  }

  private hasBlockedProjects(data: Record<string, unknown>): boolean {
    return (data.projects as any)?.some((p: any) => p.status === 'blocked') ?? false;
  }

  private getSkillGaps(data: Record<string, unknown>): number {
    return (data.skillGaps as any)?.length ?? 0;
  }

  private getBusinessHealth(data: Record<string, unknown>): number {
    return (data.metrics as any)?.businessScore ?? 100;
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  private async safeCall<T>(fn: () => Promise<T>): Promise<SafeCallResult<T>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ── Service Accessors ────────────────────────────────────────────────────

  // Lazily initialized — not used in assemble(), only exposed via accessors
  private _getNavService(): LifeOSNavigationService {
    if (!this._navigation) this._navigation = new LifeOSNavigationService();
    return this._navigation;
  }
  private _getSearchService(): LifeOSSearchService {
    if (!this._search) this._search = new LifeOSSearchService();
    return this._search;
  }

  getNavigationService(): LifeOSNavigationService {
    return this._getNavService();
  }
  getSearchService(): LifeOSSearchService {
    return this._getSearchService();
  }
  getTimelineService(): LifeOSTimelineService {
    return this.timeline;
  }
  getRecommendationService(): LifeOSRecommendationService {
    return this.recommendations;
  }
  getNotificationService(): LifeOSNotificationService {
    return this.notifications;
  }
  getQuickActionService(): LifeOSQuickActionService {
    return this.quickActions;
  }
  getInsightService(): LifeOSInsightService {
    return this.insights;
  }
}
