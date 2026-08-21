// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Assembler
// Assembles the complete dashboard snapshot from all frozen modules
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type { DashboardSnapshotDTO } from './DashboardDTO.js';
import { DashboardDTOMapper } from './DashboardDTOMapper.js';
import { DashboardPersonalizationService } from './DashboardPersonalizationService.js';
import { DashboardJourneyService } from './DashboardJourneyService.js';
import { DashboardMetricsService } from './DashboardMetricsService.js';
import { DashboardHealthService } from './DashboardHealthService.js';
import { DashboardConfigurationService } from './DashboardConfigurationService.js';
import { DashboardRecommendationService } from './DashboardRecommendationService.js';
import { DashboardInsightService } from './DashboardInsightService.js';
import { DashboardNotificationService } from './DashboardNotificationService.js';
import { DashboardTimelineService } from './DashboardTimelineService.js';
import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';

export class DashboardAssembler {
  private readonly mapper: DashboardDTOMapper;
  private readonly personalization: DashboardPersonalizationService;
  private readonly journey: DashboardJourneyService;
  private readonly metrics: DashboardMetricsService;
  private readonly health: DashboardHealthService;
  private readonly config: DashboardConfigurationService;
  private readonly recommendations: DashboardRecommendationService;
  private readonly insights: DashboardInsightService;
  private readonly notifications: DashboardNotificationService;
  private readonly timeline: DashboardTimelineService;

  constructor(
    private readonly identityService: IdentityApplicationService,
    private readonly memoryService: MemoryApplicationService,
    private readonly decisionService: DecisionApplicationService,
    private readonly executionService: ExecutionApplicationService,
    private readonly knowledgeService: KnowledgeApplicationService,
    private readonly aiService: AIOrchestrationService,
  ) {
    this.mapper = new DashboardDTOMapper();
    this.personalization = new DashboardPersonalizationService();
    this.journey = new DashboardJourneyService();
    this.metrics = new DashboardMetricsService();
    this.health = new DashboardHealthService();
    this.config = new DashboardConfigurationService();
    this.recommendations = new DashboardRecommendationService();
    this.insights = new DashboardInsightService();
    this.notifications = new DashboardNotificationService();
    this.timeline = new DashboardTimelineService();
  }

  /** Assemble the full dashboard snapshot for a user */
  async assemble(userId: string): Promise<DashboardSnapshotDTO> {
    const startTime = Date.now();

    const config = this.config.getConfig(userId);
    const greeting = this.personalization.generateGreeting('User', config.personalization);

    // Gather data from all frozen modules in parallel
    const [identityResult, memoryResult, decisionResult, , knowledgeResult] = await Promise.all([
      this.safeCall(() => this.identityService.getUserById(userId)),
      this.safeCall(() => this.memoryService.getStats()),
      this.safeCall(() => this.decisionService.getStats()),
      this.safeCall(() => this.executionService.getStats()),
      this.safeCall(() => this.knowledgeService.searchNodes('', { page: 1, limit: 20 })),
    ]);

    const userDTO = identityResult.data;
    const memoryStats = memoryResult.data;
    const decisionStats = decisionResult.data;
    const knowledgeNodes = (knowledgeResult.data?.nodes ?? []) as never[];

    // Build sub-components
    const identityCard = userDTO
      ? this.mapper.toIdentityCard(
          userDTO,
          greeting,
          'Personal growth and development',
          'Achieve your goals',
          'Every step forward is progress.',
        )
      : this.mapper.toIdentityCard(
          this.getGuestIdentity(userId),
          greeting,
          'Discover your purpose',
          'Set your first goal',
          'Welcome to your dashboard.',
        );

    // Try to get execution data
    let executionData;
    try {
      const plansResult = await this.executionService.listPlans(1, 10);
      executionData = plansResult.data;
    } catch {
      executionData = undefined;
    }

    // Get memory data
    let memoryData;
    try {
      const memResult = await this.memoryService.listMemories(1, 10);
      memoryData = memResult.data;
    } catch {
      memoryData = undefined;
    }

    // Get decision data
    let decisionData;
    try {
      const decResult = await this.decisionService.listDecisions(1, 10);
      decisionData = decResult.data;
    } catch {
      decisionData = undefined;
    }

    // Build decision card
    const decisionCard = this.mapper.toDecisionCard(
      decisionData?.data ?? [],
      decisionStats?.data ?? { total: 0, byCategory: {}, byStatus: {}, linkedCount: 0 },
    );

    // Build memory card
    const memoryCard = this.mapper.toMemoryCard(
      memoryData?.data ?? [],
      memoryStats?.data ?? { total: 0, byCategory: {}, byState: {}, linkedCount: 0 },
    );

    // Build knowledge card
    const knowledgeCard = this.mapper.toKnowledgeCard(knowledgeNodes);

    // Build execution card
    const executionCard = this.mapper.toExecutionCard(executionData?.data ?? [], undefined, []);

    // Build focus card
    const focusCard = this.mapper.toFocusCard(undefined);

    // Build growth section
    const growthSection = this.mapper.toGrowthSection(
      {
        activeCourses: 0,
        completedCourses: 0,
        totalHours: 0,
        recentAchievements: [],
        recommendedNext: [],
        learningStreak: 0,
      },
      {
        currentRole: 'Member',
        careerScore: 50,
        skillsGained: 0,
        certifications: 0,
        opportunities: [],
      },
      knowledgeCard,
      { activeProjects: 0, completedProjects: 0, milestones: [], healthScore: 50 },
      { activeListings: 0, completedTransactions: 0, rating: 0, recentActivity: [] },
    );

    // Build journey
    const todayJourney = this.journey.buildTodayJourney(
      executionCard.completedToday,
      executionCard.todayTasks.length,
      [],
      [],
    );

    const weekJourney = this.journey.buildWeekJourney([], []);

    const monthJourney = this.journey.buildMonthJourney([], []);

    const journeyDTO = this.journey.buildJourney(todayJourney, weekJourney, monthJourney, [], []);

    // Build timeline
    const timelineDTO = this.mapper.toTimeline(
      this.timeline.buildTimeline(
        memoryData?.data ?? [],
        decisionData?.data ?? [],
        executionData?.data ?? [],
      ),
    );

    // Build insights
    const insightDTOs = this.insights.generateInsights({
      execution: executionCard,
      decisions: decisionCard,
      memory: memoryCard,
      journey: journeyDTO,
      metrics: {
        lifeScore: 50,
        goalProgress: 0,
        missionProgress: 0,
        executionRate: 0,
        decisionQuality: 0,
        learningHours: 0,
        careerGrowth: 0,
        consistency: 0,
        momentum: 0,
        streak: 0,
        weeklyCompletion: 0,
        monthlyCompletion: 0,
      },
    });

    // Build recommendations
    const recommendationDTOs = this.recommendations.generateRecommendations({
      identity: identityCard,
      execution: executionCard,
      decisions: decisionCard,
      memory: memoryCard,
      journey: journeyDTO,
    });

    // Build notifications
    const notificationDTOs = this.notifications.generateNotifications({
      decisions: decisionCard,
      execution: executionCard,
      health: this.health.getHealth(),
    });

    // Build quick actions
    const quickActions = this.buildQuickActions(focusCard);

    // Build health
    const healthDTO = this.health.getHealth();
    const healthServices = healthDTO.services.map((s) => ({
      name: s.name,
      status: s.status,
      latency: s.latency,
    }));
    const healthIndicator = this.mapper.createHealthIndicator(healthServices);

    // Build metrics — compute lifeScore via DashboardMetricsService (no duplicate business logic)
    const lifeScore = this.metrics.calculateLifeScore({
      goalProgress: 0,
      missionProgress: 0,
      executionRate:
        executionCard.todayTasks.length > 0
          ? Math.round((executionCard.completedToday / executionCard.todayTasks.length) * 100)
          : 0,
      decisionQuality: Math.round(decisionCard.averageConfidence * 100),
      learningHours: 0,
      careerGrowth: 0,
      consistency: journeyDTO.consistency,
    });

    const metricsDTO = this.mapper.aggregateMetrics(
      {
        goalProgress: 0,
        missionProgress: 0,
        executionRate:
          executionCard.todayTasks.length > 0
            ? Math.round((executionCard.completedToday / executionCard.todayTasks.length) * 100)
            : 0,
        decisionQuality: Math.round(decisionCard.averageConfidence * 100),
        learningHours: 0,
        careerGrowth: 0,
        weeklyCompletion: weekJourney.completionRate,
        monthlyCompletion: monthJourney.completionRate,
        previousWeeklyCompletion: 0,
        dailyCompletionRates: [],
        dailyCompletions: [],
        consistency: journeyDTO.consistency,
        momentum: journeyDTO.momentum,
        streak: journeyDTO.streak,
      },
      lifeScore,
    );

    // Build AI context
    const aiContext = this.personalization.generateAICompanionContext(
      focusCard.missionLabel,
      executionCard.todayTasks.map((t) => t.label),
      `User ${userId} is focused on ${focusCard.missionLabel}.`,
    );

    // Assemble snapshot
    const snapshot: DashboardSnapshotDTO = {
      id: `snap_${userId}_${String(Date.now())}`,
      userId,
      generatedAt: new Date().toISOString(),
      ttl: 300_000,
      identity: identityCard,
      focus: focusCard,
      execution: executionCard,
      decisions: decisionCard,
      memory: memoryCard,
      knowledge: knowledgeCard,
      growth: growthSection,
      journey: journeyDTO,
      timeline: timelineDTO,
      insights: insightDTOs,
      recommendations: recommendationDTOs,
      notifications: notificationDTOs,
      quickActions,
      health: healthIndicator,
      metrics: metricsDTO,
      aiContext,
      widgetStates: config.widgets,
    };

    // Report health
    this.health.reportHealth('dashboard', 'healthy', Date.now() - startTime);

    return snapshot;
  }

  /** Assemble a partial snapshot for section-specific refresh */
  async assembleSection(userId: string, sectionId: string): Promise<Partial<DashboardSnapshotDTO>> {
    // Only query the minimal required data for the requested section
    const config = this.config.getConfig(userId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const greeting = this.personalization.generateGreeting('User', config.personalization);

    switch (sectionId) {
      case 'execution': {
        const plansResult = await this.safeCall(() => this.executionService.listPlans(1, 10));
        const executionCard = this.mapper.toExecutionCard(
          (plansResult.data?.data ?? []) as never[],
          undefined,
          [],
        );
        const focusCard = this.mapper.toFocusCard(undefined);
        return {
          execution: executionCard,
          quickActions: this.buildQuickActions(focusCard),
        };
      }

      case 'decisions': {
        const statsResult = await this.safeCall(() => this.decisionService.getStats());
        const decResult = await this.safeCall(() => this.decisionService.listDecisions(1, 10));
        return {
          decisions: this.mapper.toDecisionCard(
            (decResult.data?.data ?? []) as never[],
            (statsResult.data ?? {
              total: 0,
              byCategory: {},
              byStatus: {},
              linkedCount: 0,
            }) as never,
          ),
        };
      }

      case 'memory': {
        const statsResult = await this.safeCall(() => this.memoryService.getStats());
        const memResult = await this.safeCall(() => this.memoryService.listMemories(1, 10));
        const memoryCard = this.mapper.toMemoryCard(
          (memResult.data?.data ?? []) as never[],
          (statsResult.data ?? { total: 0, byCategory: {}, byState: {}, linkedCount: 0 }) as never,
        );
        return {
          memory: memoryCard,
          timeline: this.mapper.toTimeline(
            this.timeline.buildTimeline((memResult.data?.data ?? []) as never[], [], []),
          ),
        };
      }

      case 'insights':
      case 'recommendations':
      case 'notifications': {
        // These depend on full data, fall back to cached snapshot
        const section = await this.assemble(userId);
        return {
          [sectionId]: section[sectionId as keyof DashboardSnapshotDTO],
        };
      }

      case 'journey': {
        const execResult = await this.safeCall(() => this.executionService.listPlans(1, 10));
        const executionCard = this.mapper.toExecutionCard(
          (execResult.data?.data ?? []) as never[],
          undefined,
          [],
        );
        const todayJourney = this.journey.buildTodayJourney(
          executionCard.completedToday,
          executionCard.todayTasks.length,
          [],
          [],
        );
        const weekJourney = this.journey.buildWeekJourney([], []);
        const monthJourney = this.journey.buildMonthJourney([], []);
        return {
          journey: this.journey.buildJourney(todayJourney, weekJourney, monthJourney, [], []),
        };
      }

      case 'metrics':
      case 'health': {
        const section = await this.assemble(userId);
        return {
          [sectionId]: section[sectionId as keyof DashboardSnapshotDTO],
        };
      }

      default:
        return {};
    }
  }

  private buildQuickActions(focus: { missionLabel: string; isBlocked: boolean }): Array<{
    id: string;
    label: string;
    description: string;
    icon: string;
    route: string;
    priority: number;
    category: string;
    isAvailable: boolean;
    disabledReason?: string;
  }> {
    const actions: Array<{
      id: string;
      label: string;
      description: string;
      icon: string;
      route: string;
      priority: number;
      category: string;
      isAvailable: boolean;
      disabledReason?: string;
    }> = [];

    if (focus.missionLabel !== 'No active mission') {
      actions.push({
        id: 'continue_mission',
        label: 'Continue Mission',
        description: focus.isBlocked ? 'Resolve blocking issues' : 'Continue your current mission',
        icon: 'play-circle',
        route: '/execution',
        priority: 1,
        category: 'execution',
        isAvailable: !focus.isBlocked,
        disabledReason: focus.isBlocked ? 'Mission is blocked' : undefined,
      });
    }

    actions.push(
      {
        id: 'create_goal',
        label: 'Create Goal',
        description: 'Set a new goal to work towards',
        icon: 'target',
        route: '/goals/new',
        priority: 5,
        category: 'goals',
        isAvailable: true,
      },
      {
        id: 'review_decisions',
        label: 'Review Decision',
        description: 'Review and make pending decisions',
        icon: 'scale',
        route: '/decisions',
        priority: 3,
        category: 'decisions',
        isAvailable: true,
      },
      {
        id: 'start_learning',
        label: 'Start Learning',
        description: 'Begin a new learning activity',
        icon: 'book-open',
        route: '/learning',
        priority: 6,
        category: 'learning',
        isAvailable: true,
      },
      {
        id: 'add_memory',
        label: 'Add Memory',
        description: 'Capture a new memory or reflection',
        icon: 'feather',
        route: '/memories/new',
        priority: 8,
        category: 'memories',
        isAvailable: true,
      },
      {
        id: 'open_career',
        label: 'Open Career',
        description: 'View career opportunities and progress',
        icon: 'briefcase',
        route: '/career',
        priority: 7,
        category: 'career',
        isAvailable: true,
      },
      {
        id: 'search_knowledge',
        label: 'Search Knowledge',
        description: 'Search your knowledge graph',
        icon: 'search',
        route: '/knowledge',
        priority: 9,
        category: 'knowledge',
        isAvailable: true,
      },
      {
        id: 'ask_ai',
        label: 'Ask AI',
        description: 'Ask VedMoulya for guidance or analysis',
        icon: 'message-circle',
        route: '/ai',
        priority: 2,
        category: 'ai',
        isAvailable: true,
      },
    );

    return actions;
  }

  private getGuestIdentity(userId: string): {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    statusState: string;
    timezone?: string;
    locale?: string;
    theme: 'light' | 'dark' | 'system';
    language: string;
    givenName?: string;
    familyName?: string;
    bio?: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    profileVisibility: string;
    entityStatus: string;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: userId,
      email: '',
      displayName: 'Guest',
      statusState: 'active',
      theme: 'system',
      language: 'en',
      emailVerified: false,
      twoFactorEnabled: false,
      profileVisibility: 'public',
      entityStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private async safeCall<T>(
    fn: () => Promise<T>,
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // Log the error for debugging without crashing the dashboard
      console.warn(`[DashboardAssembler] Module call failed: ${message}`);
      return { success: false, error: message };
    }
  }
}
