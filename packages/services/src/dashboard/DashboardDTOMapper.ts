// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard DTO Mapper
// Maps between domain models and dashboard DTOs
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type {
  IdentityCardDTO,
  FocusCardDTO,
  ExecutionCardDTO,
  DecisionCardDTO,
  MemoryCardDTO,
  KnowledgeCardDTO,
  CareerCardDTO,
  LearningCardDTO,
  BusinessCardDTO,
  MarketplaceCardDTO,
  GrowthSectionDTO,
  JourneyPeriodDTO,
  TimelineDTO,
  TimelineEntryDTO,
  InsightDTO,
  QuickActionDTO,
  HealthIndicatorDTO,
  DashboardMetricsDTO,
  GreetingDTO,
} from './DashboardDTO.js';

import type { UserDTO } from '../identity/UserDTO.js';
import type { MemoryDTO, MemoryStatsDTO } from '../memory/MemoryDTO.js';
import type { DecisionDTO, DecisionStatsDTO } from '../decision/DecisionDTO.js';
import type { PlanDTO, MissionDTO, DailyPlanDTO } from '../execution/ExecutionDTO.js';
import type { KnowledgeNodeDTO, GraphStatisticsDTO } from '../knowledge/KnowledgeDTO.js';

export class DashboardDTOMapper {
  /** Map UserDTO to IdentityCardDTO */
  toIdentityCard(
    user: UserDTO,
    greeting: GreetingDTO,
    purpose: string,
    primaryGoal: string,
    insight: string,
  ): IdentityCardDTO {
    return {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.statusState,
      purpose,
      avatarUrl: user.avatarUrl,
      currentJourney: purpose,
      primaryGoal,
      motivationalInsight: insight,
      greeting,
    };
  }

  /** Map execution data to FocusCardDTO */
  toFocusCard(mission?: MissionDTO, aiRecommendation?: string): FocusCardDTO {
    return {
      missionId: mission?.id,
      missionLabel: mission?.label ?? 'No active mission',
      missionDescription: mission?.description ?? 'Focus on setting your next mission.',
      completionPercentage: mission?.progress.percentage ?? 0,
      estimatedTimeMinutes: this.calculateMissionEstimatedTime(mission),
      nextMilestone: this.findNextMilestone(mission),
      isBlocked: mission?.status === 'blocked',
      blockReason: mission?.status === 'blocked' ? 'Mission is blocked' : undefined,
      aiRecommendation,
      priority: mission?.priority.level ?? 'low',
    };
  }

  /** Map execution data to ExecutionCardDTO */
  toExecutionCard(
    plans: PlanDTO[],
    dailyPlan?: DailyPlanDTO,
    recoverySuggestions: string[] = [],
  ): ExecutionCardDTO {
    const activePlans = plans.filter((p) => p.status === 'active' || p.status === 'in_progress');
    const blockedPlans = plans.filter((p) => p.status === 'blocked');
    const todayTasks = dailyPlan?.tasks ?? [];
    const completedToday = todayTasks.filter((t) =>
      plans.some((p) => p.tasks.some((pt) => pt.id === t.taskId && pt.status === 'completed')),
    ).length;

    return {
      todayTasks: todayTasks.map((t) => ({
        taskId: t.taskId,
        label: t.label,
        status: this.findTaskStatus(t.taskId, plans),
        estimatedDuration: t.estimatedDuration,
        priority: t.priority,
      })),
      activePlans: activePlans.length,
      blockedPlans: blockedPlans.length,
      completedToday,
      upcomingSchedule: todayTasks
        .filter((t) => t.estimatedDuration > 0)
        .slice(0, 5)
        .map((t) => ({
          taskId: t.taskId,
          label: t.label,
          scheduledStart: new Date().toISOString(),
          scheduledEnd: new Date(Date.now() + t.estimatedDuration * 60000).toISOString(),
        })),
      recoverySuggestions,
      totalEstimatedMinutes: todayTasks.reduce((sum, t) => sum + t.estimatedDuration, 0),
    };
  }

  /** Map DecisionDTOs to DecisionCardDTO */
  toDecisionCard(decisions: DecisionDTO[], _stats: DecisionStatsDTO): DecisionCardDTO {
    const pending = decisions.filter((d) => d.status === 'open' || d.status === 'analyzing');
    const recommended = decisions
      .filter((d) => d.selectedOptionId && d.confidence.score > 0.5)
      .map((d) => ({
        decisionId: d.id,
        title: d.title,
        confidence: d.confidence.score,
        priority: d.priority.level,
      }));
    const highRisk = decisions.filter((d) =>
      d.options.some((o) => o.risk && o.risk.level === 'high'),
    );

    return {
      pendingDecisions: pending.length,
      recommendedDecisions: recommended,
      averageConfidence:
        decisions.length > 0
          ? decisions.reduce((s, d) => s + d.confidence.score, 0) / decisions.length
          : 0,
      highRiskDecisions: highRisk.length,
      lastDecisionDate: decisions.find((d) => d.completedAt)?.completedAt,
    };
  }

  /** Map MemoryDTOs to MemoryCardDTO */
  toMemoryCard(memories: MemoryDTO[], stats: MemoryStatsDTO): MemoryCardDTO {
    const recent = [...memories]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((m) => ({
        memoryId: m.id,
        summary: m.title,
        category: m.category,
        timestamp: m.createdAt,
        importance: m.importance.score,
      }));

    const important = memories
      .filter((m) => m.importance.score >= 7)
      .slice(0, 3)
      .map((m) => ({
        memoryId: m.id,
        title: m.title,
        date: m.createdAt,
      }));

    const milestones = memories
      .filter((m) => m.category === 'milestone')
      .slice(0, 3)
      .map((m) => ({
        memoryId: m.id,
        title: m.title,
        date: m.createdAt,
      }));

    return {
      recentMemories: recent,
      importantEvents: important,
      lifeMilestones: milestones,
      aiObservations: this.generateMemoryObservations(memories),
      reflectionPrompts: this.generateReflectionPrompts(memories),
      totalMemories: stats.total,
    };
  }

  /** Map knowledge data to KnowledgeCardDTO */
  toKnowledgeCard(nodes: KnowledgeNodeDTO[], stats?: GraphStatisticsDTO): KnowledgeCardDTO {
    const categories = this.countCategories(nodes);
    return {
      recentNodes: nodes.length,
      totalNodes: stats?.nodeCount ?? nodes.length,
      recentEdges: stats?.edgeCount ?? 0,
      topCategories: Object.entries(categories)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      lastUpdated: nodes[0]?.updatedAt,
    };
  }

  /** Map to GrowthSectionDTO */
  toGrowthSection(
    learning: LearningCardDTO,
    career: CareerCardDTO,
    knowledge: KnowledgeCardDTO,
    _business: BusinessCardDTO,
    _marketplace: MarketplaceCardDTO,
  ): GrowthSectionDTO {
    return {
      learning,
      career,
      knowledge,
      skills: [],
      achievements: [],
    };
  }

  /** Map to TimelineDTO */
  toTimeline(entries: TimelineEntryDTO[]): TimelineDTO {
    return {
      entries,
      totalEntries: entries.length,
      hasMore: entries.length >= 20,
    };
  }

  /** Map to WeeklySummaryDTO */
  toWeeklySummary(
    weekJourney: JourneyPeriodDTO,
    insights: InsightDTO[],
  ): {
    weekStart: string;
    weekEnd: string;
    completionRate: number;
    trend: string;
    taskCount: number;
    insightCount: number;
  } {
    return {
      weekStart: weekJourney.startDate,
      weekEnd: weekJourney.endDate,
      completionRate: weekJourney.completionRate,
      trend: weekJourney.trend,
      taskCount: weekJourney.completedTasks,
      insightCount: insights.length,
    };
  }

  /** Map to MonthlySummaryDTO */
  toMonthlySummary(
    monthJourney: JourneyPeriodDTO,
    insights: InsightDTO[],
  ): {
    monthStart: string;
    monthEnd: string;
    completionRate: number;
    trend: string;
    missionCount: number;
    insightCount: number;
  } {
    return {
      monthStart: monthJourney.startDate,
      monthEnd: monthJourney.endDate,
      completionRate: monthJourney.completionRate,
      trend: monthJourney.trend,
      missionCount: monthJourney.completedMissions,
      insightCount: insights.length,
    };
  }

  /** Create a quick action DTO */
  createQuickAction(
    id: string,
    label: string,
    description: string,
    icon: string,
    route: string,
    priority: number,
    category: string,
    isAvailable: boolean = true,
    disabledReason?: string,
  ): QuickActionDTO {
    return { id, label, description, icon, route, priority, category, isAvailable, disabledReason };
  }

  /** Create a health indicator DTO */
  createHealthIndicator(
    services: Array<{ name: string; status: 'healthy' | 'degraded' | 'down'; latency: number }>,
  ): HealthIndicatorDTO {
    const warnings: string[] = [];
    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';

    for (const svc of services) {
      if (svc.status === 'down') {
        overall = 'critical';
        warnings.push(`${svc.name} is down`);
      } else if (svc.status === 'degraded' && overall !== 'critical') {
        overall = 'degraded';
        warnings.push(`${svc.name} is degraded (${String(svc.latency)}ms)`);
      }
    }

    return {
      overall,
      services,
      lastChecked: new Date().toISOString(),
      warnings,
    };
  }

  /** Aggregate metrics from component scores */
  aggregateMetrics(
    components: {
      goalProgress: number;
      missionProgress: number;
      executionRate: number;
      decisionQuality: number;
      learningHours: number;
      careerGrowth: number;
      weeklyCompletion: number;
      monthlyCompletion: number;
      previousWeeklyCompletion: number;
      dailyCompletionRates: number[];
      dailyCompletions: Array<{ date: string; completed: number; total: number }>;
      consistency: number;
      momentum: number;
      streak: number;
    },
    lifeScore: number,
  ): DashboardMetricsDTO {
    return {
      lifeScore,
      goalProgress: components.goalProgress,
      missionProgress: components.missionProgress,
      executionRate: components.executionRate,
      decisionQuality: components.decisionQuality,
      learningHours: components.learningHours,
      careerGrowth: components.careerGrowth,
      consistency: components.consistency,
      momentum: components.momentum,
      streak: components.streak,
      weeklyCompletion: components.weeklyCompletion,
      monthlyCompletion: components.monthlyCompletion,
    };
  }

  private calculateMissionEstimatedTime(mission?: MissionDTO): number {
    if (!mission) return 0;
    return mission.tasks.reduce((sum, t) => sum + t.estimatedDuration, 0);
  }

  private findNextMilestone(mission?: MissionDTO): string | undefined {
    if (!mission) return undefined;
    const incomplete = mission.tasks.find((t) => t.status !== 'completed');
    return incomplete?.label;
  }

  private findTaskStatus(taskId: string, plans: PlanDTO[]): string {
    for (const plan of plans) {
      for (const task of plan.tasks) {
        if (task.id === taskId) return task.status;
      }
    }
    return 'unknown';
  }

  private generateMemoryObservations(memories: MemoryDTO[]): string[] {
    const observations: string[] = [];
    if (memories.length === 0) return observations;

    const highImportance = memories.filter((m) => m.importance.score >= 7);
    if (highImportance.length >= 3) {
      observations.push('You have several significant memories from this period.');
    }

    const categories = new Set(memories.map((m) => m.category));
    if (categories.size >= 3) {
      observations.push('Your memories span diverse areas of life.');
    }

    const recentStrong = memories
      .filter((m) => new Date(m.createdAt) > new Date(Date.now() - 7 * 86400000))
      .filter((m) => m.confidence.score >= 0.7);
    if (recentStrong.length >= 2) {
      observations.push('Recent memories show high retention strength.');
    }

    return observations;
  }

  private generateReflectionPrompts(memories: MemoryDTO[]): string[] {
    const prompts: string[] = [];

    if (memories.length > 10) {
      prompts.push('What patterns do you notice in your recent memories?');
    }

    const hasMilestones = memories.some((m) => m.category === 'milestone');
    if (hasMilestones) {
      prompts.push('How have the recent milestones shaped your journey?');
    }

    prompts.push('What are you most grateful for today?');
    prompts.push('What would you like to accomplish in the next week?');

    return prompts;
  }

  private countCategories(nodes: KnowledgeNodeDTO[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const node of nodes) {
      const cat = node.category;
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }
}
