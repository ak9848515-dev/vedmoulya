// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Assembler
// Assembles the complete business snapshot from all modules
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessSnapshotDTO } from './BusinessDTO.js';
import { BusinessDTOMapper } from './BusinessDTOMapper.js';
import { BusinessProfileService } from './BusinessProfileService.js';
import { BusinessGoalService } from './BusinessGoalService.js';
import { BusinessProjectService } from './BusinessProjectService.js';
import { BusinessStrategyService } from './BusinessStrategyService.js';
import { BusinessKPIService } from './BusinessKPIService.js';
import { BusinessFinanceService } from './BusinessFinanceService.js';
import { BusinessRiskService } from './BusinessRiskService.js';
import { BusinessOpportunityService } from './BusinessOpportunityService.js';
import { BusinessExecutionService } from './BusinessExecutionService.js';
import { BusinessInsightService } from './BusinessInsightService.js';
import { BusinessRecommendationService } from './BusinessRecommendationService.js';
import { BusinessMetricsService } from './BusinessMetricsService.js';
import { BusinessHealthService } from './BusinessHealthService.js';
import { BusinessNotificationService } from './BusinessNotificationService.js';
import { BusinessTimelineService } from './BusinessTimelineService.js';
import { BusinessConfigurationService } from './BusinessConfigurationService.js';

import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';
import type { BusinessProfileDTO, BusinessAIContextDTO, QuickActionDTO } from './BusinessDTO.js';

export interface SafeCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class BusinessAssembler {
  private readonly mapper: BusinessDTOMapper;
  private readonly profile: BusinessProfileService;
  private readonly goals: BusinessGoalService;
  private readonly projects: BusinessProjectService;
  private readonly strategies: BusinessStrategyService;
  private readonly kpis: BusinessKPIService;
  private readonly finance: BusinessFinanceService;
  private readonly risks: BusinessRiskService;
  private readonly opportunities: BusinessOpportunityService;
  private readonly execution: BusinessExecutionService;
  private readonly insights: BusinessInsightService;
  private readonly recommendations: BusinessRecommendationService;
  private readonly metrics: BusinessMetricsService;
  private readonly health: BusinessHealthService;
  private readonly notifications: BusinessNotificationService;
  private readonly timeline: BusinessTimelineService;
  private readonly config: BusinessConfigurationService;

  constructor(
    private readonly identityService: IdentityApplicationService,
    private readonly memoryService: MemoryApplicationService,
    private readonly decisionService: DecisionApplicationService,
    private readonly executionService: ExecutionApplicationService,
    private readonly knowledgeService: KnowledgeApplicationService,
    private readonly aiService: AIOrchestrationService,
  ) {
    this.mapper = new BusinessDTOMapper();
    this.profile = new BusinessProfileService();
    this.goals = new BusinessGoalService();
    this.projects = new BusinessProjectService();
    this.strategies = new BusinessStrategyService();
    this.kpis = new BusinessKPIService();
    this.finance = new BusinessFinanceService();
    this.risks = new BusinessRiskService();
    this.opportunities = new BusinessOpportunityService();
    this.execution = new BusinessExecutionService();
    this.insights = new BusinessInsightService();
    this.recommendations = new BusinessRecommendationService();
    this.metrics = new BusinessMetricsService();
    this.health = new BusinessHealthService();
    this.notifications = new BusinessNotificationService();
    this.timeline = new BusinessTimelineService();
    this.config = new BusinessConfigurationService();
  }

  async assemble(userId: string, displayName: string): Promise<BusinessSnapshotDTO> {
    const startTime = Date.now();

    const [identityResult, , , , aiResult] = await Promise.all([
      this.safeCall(() => this.identityService.getUserById(userId)),
      this.safeCall(() => this.memoryService.getStats()),
      this.safeCall(() => this.decisionService.getStats()),
      this.safeCall(() => this.executionService.getStats()),
      this.safeCall(() =>
        this.aiService.orchestrate({
          capability: 'reasoning',
          userInput: `Business context analysis for user ${userId}`,
          qualityTier: 'standard',
          userId,
          context: {
            systemPrompt: `Business context for user ${userId}`,
          },
        }),
      ),
    ]);

    // Note: _memoryResult, _decisionResult, _executionResult reserved for future cross-module integration

    const profileDTO = this.resolveProfile(userId, displayName, identityResult);
    const goalList = this.goals.getGoals(userId);
    const activeGoals = this.goals.getActiveGoals(userId);
    const projectList = this.projects.getProjects(userId);
    const blockedProjects = this.projects.getBlockedProjects(userId);
    const strategyList = this.strategies.getStrategies(userId);
    const kpiList = this.kpis.getKPIs(userId);
    const kpisAtRisk = this.kpis.getKPIsAtRisk(userId);
    const financeDTO = this.finance.getFinance(userId);
    const riskList = this.risks.getRisks(userId);
    const criticalRisks = this.risks.getCriticalRisks(userId);
    const oppList = this.opportunities.getOpportunities(userId);
    const topOpps = this.opportunities.getTopOpportunities(userId);
    const execDTO = this.execution.analyzeExecution(userId, projectList);

    const goalProgress =
      activeGoals.length > 0
        ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
        : 0;
    const revenueGrowth =
      financeDTO.revenue.previousPeriod > 0
        ? Math.round(
            ((financeDTO.revenue.currentPeriod - financeDTO.revenue.previousPeriod) /
              financeDTO.revenue.previousPeriod) *
              100,
          )
        : 0;

    const metricsDTO = this.metrics.aggregate({
      revenueHealth: Math.min(100, revenueGrowth > 0 ? 50 + revenueGrowth : 50 + revenueGrowth),
      expenseEfficiency:
        financeDTO.expenses.budgeted > 0
          ? Math.round(
              Math.max(
                0,
                100 - (financeDTO.expenses.currentPeriod / financeDTO.expenses.budgeted) * 100,
              ),
            )
          : 50,
      profitability: financeDTO.profitability.netMargin,
      growthRate: Math.max(0, revenueGrowth),
      projectSuccessRate:
        projectList.length > 0
          ? Math.round(
              (projectList.filter((p) => p.status === 'completed').length / projectList.length) *
                100,
            )
          : 0,
      kpiAchievementRate:
        kpiList.length > 0
          ? Math.round(
              (kpiList.filter((k) => k.currentValue >= k.targetValue).length / kpiList.length) *
                100,
            )
          : 0,
      riskExposure:
        riskList.length > 0
          ? Math.round(riskList.reduce((s, r) => s + r.riskScore, 0) / riskList.length)
          : 0,
      opportunityValue:
        topOpps.length > 0
          ? Math.round(topOpps.reduce((s, o) => s + o.roi, 0) / topOpps.length)
          : 0,
      executionVelocity: execDTO.velocity,
      goalProgress,
    });

    const insightDTOs = this.insights.generateInsights({
      kpisAtRisk: kpisAtRisk.length,
      hasCriticalRisks: criticalRisks.length > 0,
      hasNewOpportunities: topOpps.length > 0,
      goalProgress,
      revenueGrowth,
      hasDelayedProjects: execDTO.delayedTasks > 0,
    });

    const recDTOs = this.recommendations.generateRecommendations({
      hasCriticalRisks: criticalRisks.length > 0,
      hasHighValueOpps: topOpps.length > 0,
      kpisAtRisk: kpisAtRisk.length,
      goalProgress,
      hasDelayedProjects: execDTO.delayedTasks > 0,
      revenueDeclining: revenueGrowth < 0,
      hasBlockedProjects: blockedProjects.length > 0,
    });

    const notifDTOs = this.notifications.generateNotifications({
      kpisAtRisk: kpisAtRisk.length,
      hasCriticalRisks: criticalRisks.length > 0,
      hasNewOpportunities: topOpps.length > 0,
      projectsDelayed: execDTO.delayedTasks,
      goalProgress,
    });

    const timelineEntries = this.timeline.buildTimeline([
      ...projectList
        .filter((p) => p.status === 'completed')
        .map((p) => ({
          id: p.id,
          type: 'project' as const,
          title: p.title,
          description: 'Project completed',
          timestamp: p.completedDate ?? new Date().toISOString(),
          importance: 8,
          icon: 'check-circle',
        })),
      ...activeGoals.map((g) => ({
        id: g.id,
        type: 'milestone' as const,
        title: g.title,
        description: `${String(g.progress)}% complete`,
        timestamp: g.createdAt,
        importance: 7,
        icon: 'target',
      })),
      ...criticalRisks.map((r) => ({
        id: r.id,
        type: 'milestone' as const,
        title: r.title,
        description: `Risk score: ${String(r.riskScore)}`,
        timestamp: r.createdAt,
        importance: 9,
        icon: 'alert-triangle',
      })),
    ]);

    const timelineDTO = this.mapper.toTimeline(timelineEntries);

    const quickActions: QuickActionDTO[] = [
      this.mapper.createQuickAction(
        'create_goal',
        'Create Goal',
        'Set a new business goal',
        'flag',
        '/business/goals/new',
        1,
        'goal',
        true,
      ),
      this.mapper.createQuickAction(
        'add_kpi',
        'Add KPI',
        'Track a new business metric',
        'bar-chart',
        '/business/kpis/new',
        2,
        'kpi',
        true,
      ),
      this.mapper.createQuickAction(
        'create_project',
        'Create Project',
        'Start a new project',
        'briefcase',
        '/business/projects/new',
        3,
        'project',
        true,
      ),
      this.mapper.createQuickAction(
        'record_milestone',
        'Record Milestone',
        'Log a business milestone',
        'award',
        '/business/milestones',
        4,
        'milestone',
        true,
      ),
      this.mapper.createQuickAction(
        'analyze_business',
        'Analyze Business',
        'Run a comprehensive analysis',
        'search',
        '/business/analyze',
        5,
        'analysis',
        true,
      ),
      this.mapper.createQuickAction(
        'generate_report',
        'Generate Report',
        'Create a business report',
        'file-text',
        '/business/reports',
        6,
        'report',
        true,
      ),
      this.mapper.createQuickAction(
        'review_risks',
        'Review Risks',
        criticalRisks.length > 0
          ? `${String(criticalRisks.length)} critical risks`
          : 'View risk register',
        'shield',
        '/business/risks',
        7,
        'risk',
        true,
      ),
      this.mapper.createQuickAction(
        'review_opportunities',
        'Review Opportunities',
        topOpps.length > 0
          ? `${String(topOpps.length)} high-value opportunities`
          : 'Explore opportunities',
        'zap',
        '/business/opportunities',
        8,
        'opportunity',
        true,
      ),
    ];

    this.health.reportHealth('business', 'healthy', Date.now() - startTime);
    const healthDTO = this.health.getHealth();
    const healthIndicator = this.mapper.createHealthIndicator(
      healthDTO.services.map((s) => ({ name: s.name, status: s.status, latency: s.latency })),
    );

    const aiContext: BusinessAIContextDTO = {
      currentFocus: activeGoals[0]?.title ?? 'Setting up business',
      recentActivity: this.buildRecentActivitySummary(projectList, criticalRisks),
      suggestedQuestions: [
        'What business goals should I prioritize this quarter?',
        `How can I improve my ${kpisAtRisk.length > 0 ? 'underperforming KPIs' : 'business strategy'}?`,
        'What are my biggest growth opportunities?',
      ],
      contextSummary:
        aiResult.success && aiResult.data
          ? `AI analysis available for ${profileDTO.businessName}`
          : `${profileDTO.businessName} has ${String(kpiList.length)} KPIs tracked with ${String(activeGoals.length)} active goals.`,
    };

    const achievements: Array<{
      id: string;
      title: string;
      description: string;
      icon: string;
      unlockedAt: string;
      category: string;
      rarity: string;
    }> = [];
    if (goalProgress > 80)
      achievements.push({
        id: 'biz_goal_80',
        title: 'Goal Achiever',
        description: 'Achieved 80%+ goal progress',
        icon: 'flag',
        unlockedAt: new Date().toISOString(),
        category: 'goals',
        rarity: 'uncommon',
      });
    if (projectList.filter((p) => p.status === 'completed').length >= 5)
      achievements.push({
        id: 'biz_proj_5',
        title: 'Project Master',
        description: 'Completed 5+ projects',
        icon: 'briefcase',
        unlockedAt: new Date().toISOString(),
        category: 'projects',
        rarity: 'rare',
      });
    if (revenueGrowth > 20)
      achievements.push({
        id: 'biz_rev_20',
        title: 'Revenue Growth',
        description: 'Achieved 20%+ revenue growth',
        icon: 'trending-up',
        unlockedAt: new Date().toISOString(),
        category: 'finance',
        rarity: 'epic',
      });

    const snapshot: BusinessSnapshotDTO = {
      id: `bsnap_${userId}_${String(Date.now())}`,
      userId,
      generatedAt: new Date().toISOString(),
      ttl: 300_000,
      profile: profileDTO,
      vision: profileDTO.vision,
      mission: profileDTO.mission,
      goals: goalList,
      strategies: strategyList,
      projects: projectList,
      kpis: kpiList,
      finance: financeDTO,
      risks: riskList,
      opportunities: oppList,
      execution: execDTO,
      milestones: activeGoals.flatMap((g) => g.milestones),
      timeline: timelineDTO,
      insights: insightDTOs,
      recommendations: this.recommendations.prioritizeRecommendations(recDTOs),
      notifications: notifDTOs,
      quickActions,
      metrics: metricsDTO,
      health: healthIndicator,
      aiContext,
    };

    this.health.reportHealth('business-snapshot', 'healthy', Date.now() - startTime);
    return snapshot;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private resolveProfile(
    userId: string,
    displayName: string,
    identityResult: SafeCallResult<unknown>,
  ): BusinessProfileDTO {
    let profileDTO = this.profile.getProfile(userId);
    if (!profileDTO) {
      profileDTO = this.profile.createGuestProfile(userId, displayName);
    }
    if (identityResult.success && identityResult.data) {
      const userDTO = identityResult.data as { displayName?: string; id?: string };
      if (userDTO.displayName) {
        profileDTO = this.profile.updateProfile(userId, { businessName: userDTO.displayName });
      }
    }
    return profileDTO;
  }

  private buildRecentActivitySummary(
    projects: { status: string }[],
    risks: { riskScore: number }[],
  ): string[] {
    const activities: string[] = [];
    const done = projects.filter((p) => p.status === 'completed').length;
    if (done > 0) activities.push(`Completed ${String(done)} projects`);
    const critical = risks.filter((r) => r.riskScore >= 15).length;
    if (critical > 0) activities.push(`${String(critical)} critical risks identified`);
    return activities.length > 0 ? activities : ['Business profile created'];
  }

  // ── Service Accessors ────────────────────────────────────────────────────

  getProfileService(): BusinessProfileService {
    return this.profile;
  }
  getGoalService(): BusinessGoalService {
    return this.goals;
  }
  getProjectService(): BusinessProjectService {
    return this.projects;
  }
  getStrategyService(): BusinessStrategyService {
    return this.strategies;
  }
  getKPIService(): BusinessKPIService {
    return this.kpis;
  }
  getFinanceService(): BusinessFinanceService {
    return this.finance;
  }
  getRiskService(): BusinessRiskService {
    return this.risks;
  }
  getOpportunityService(): BusinessOpportunityService {
    return this.opportunities;
  }
  getExecutionService(): BusinessExecutionService {
    return this.execution;
  }
  getInsightService(): BusinessInsightService {
    return this.insights;
  }
  getRecommendationService(): BusinessRecommendationService {
    return this.recommendations;
  }

  private async safeCall<T>(fn: () => Promise<T>): Promise<SafeCallResult<T>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
