// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard ViewModel Factory
// Creates view models from snapshot DTOs for the UI layer
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type {
  DashboardSnapshotDTO,
  IdentityCardDTO,
  FocusCardDTO,
  ExecutionCardDTO,
  DecisionCardDTO,
  MemoryCardDTO,
  GrowthSectionDTO,
  JourneyDTO,
  TimelineDTO,
  InsightDTO,
  RecommendationDTO,
  NotificationDTO,
  QuickActionDTO,
  HealthIndicatorDTO,
  DashboardMetricsDTO,
  AICompanionContextDTO,
  DashboardSectionDTO,
} from './DashboardDTO.js';

export interface IdentityViewModel {
  userId: string;
  displayName: string;
  greeting: string;
  role: string;
  purpose: string;
  primaryGoal: string;
  motivationalInsight: string;
  avatarUrl?: string;
  timeOfDay: string;
  emoji: string;
}

export interface FocusViewModel {
  missionLabel: string;
  missionDescription: string;
  completionPercentage: number;
  estimatedTimeMinutes: number;
  nextMilestone?: string;
  isBlocked: boolean;
  blockReason?: string;
  aiRecommendation?: string;
  priority: string;
  progressBar: number;
  urgencyLabel: string;
}

export interface ExecutionViewModel {
  todayTasks: number;
  activePlans: number;
  completedToday: number;
  blockedPlans: number;
  totalEstimatedMinutes: number;
  recoverySuggestions: string[];
  scheduleSummary: string;
  isOnTrack: boolean;
  productivityScore: number;
}

export interface DecisionViewModel {
  pendingDecisions: number;
  recommendedCount: number;
  highRiskCount: number;
  averageConfidence: number;
  topDecision: string;
  needsAttention: boolean;
}

export interface MemoryViewModel {
  recentCount: number;
  importantEvents: number;
  lifeMilestones: number;
  reflectionPrompt: string;
  aiObservation: string;
  totalMemories: number;
}

export interface GrowthViewModel {
  learningHours: number;
  careerScore: number;
  skillsCount: number;
  achievementsCount: number;
  activeCourses: number;
  learningStreak: number;
}

export interface JourneyViewModel {
  todayProgress: number;
  weeklyProgress: number;
  monthlyProgress: number;
  momentum: number;
  consistency: number;
  streak: number;
  trend: string;
  energyDescription: string;
}

export interface InsightSummaryViewModel {
  totalCount: number;
  warnings: number;
  positiveCount: number;
  criticalCount: number;
  latestInsight: string;
  hasActionable: boolean;
}

export interface RecommendationSummaryViewModel {
  totalCount: number;
  topCategory: string;
  topPriority: number;
  hasNew: boolean;
}

export interface HealthViewModel {
  overall: string;
  healthyCount: number;
  degradedCount: number;
  downCount: number;
  warnings: string[];
  isHealthy: boolean;
}

export interface MetricsViewModel {
  lifeScore: number;
  lifeScoreLabel: string;
  goalProgress: number;
  executionRate: number;
  consistency: number;
  momentum: number;
  streak: number;
}

export interface DashboardViewModel {
  identity: IdentityViewModel;
  focus: FocusViewModel;
  execution: ExecutionViewModel;
  decisions: DecisionViewModel;
  memory: MemoryViewModel;
  growth: GrowthViewModel;
  journey: JourneyViewModel;
  insights: InsightSummaryViewModel;
  recommendations: RecommendationSummaryViewModel;
  health: HealthViewModel;
  metrics: MetricsViewModel;
  quickActions: QuickActionDTO[];
  notifications: NotificationDTO[];
  timeline: TimelineDTO;
  aiContext: AICompanionContextDTO;
  sections: DashboardSectionDTO[];
  lastRefreshed: string;
}

export class DashboardViewModelFactory {
  /** Create identity view model */
  createIdentityViewModel(identity: IdentityCardDTO): IdentityViewModel {
    return {
      userId: identity.userId,
      displayName: identity.displayName,
      greeting: identity.greeting.text,
      role: identity.role,
      purpose: identity.purpose,
      primaryGoal: identity.primaryGoal,
      motivationalInsight: identity.motivationalInsight,
      avatarUrl: identity.avatarUrl,
      timeOfDay: identity.greeting.timeOfDay,
      emoji: identity.greeting.emoji,
    };
  }

  /** Create focus view model */
  createFocusViewModel(focus: FocusCardDTO): FocusViewModel {
    return {
      missionLabel: focus.missionLabel,
      missionDescription: focus.missionDescription,
      completionPercentage: focus.completionPercentage,
      estimatedTimeMinutes: focus.estimatedTimeMinutes,
      nextMilestone: focus.nextMilestone,
      isBlocked: focus.isBlocked,
      blockReason: focus.blockReason,
      aiRecommendation: focus.aiRecommendation,
      priority: focus.priority,
      progressBar: Math.min(100, Math.max(0, focus.completionPercentage)),
      urgencyLabel: this.getUrgencyLabel(focus.priority, focus.isBlocked),
    };
  }

  /** Create execution view model */
  createExecutionViewModel(execution: ExecutionCardDTO): ExecutionViewModel {
    const completedRate =
      execution.todayTasks.length > 0 ? execution.completedToday / execution.todayTasks.length : 0;
    return {
      todayTasks: execution.todayTasks.length,
      activePlans: execution.activePlans,
      completedToday: execution.completedToday,
      blockedPlans: execution.blockedPlans,
      totalEstimatedMinutes: execution.totalEstimatedMinutes,
      recoverySuggestions: execution.recoverySuggestions,
      scheduleSummary:
        execution.upcomingSchedule.length > 0
          ? `Next: ${execution.upcomingSchedule[0]?.label ?? ''}`
          : 'No upcoming tasks',
      isOnTrack: completedRate >= 0.5 && execution.blockedPlans === 0,
      productivityScore: Math.round(completedRate * 100),
    };
  }

  /** Create decision view model */
  createDecisionViewModel(decision: DecisionCardDTO): DecisionViewModel {
    return {
      pendingDecisions: decision.pendingDecisions,
      recommendedCount: decision.recommendedDecisions.length,
      highRiskCount: decision.highRiskDecisions,
      averageConfidence: Math.round(decision.averageConfidence * 100),
      topDecision: decision.recommendedDecisions[0]?.title ?? 'No decisions pending',
      needsAttention: decision.highRiskDecisions > 0 || decision.pendingDecisions > 5,
    };
  }

  /** Create memory view model */
  createMemoryViewModel(memory: MemoryCardDTO): MemoryViewModel {
    return {
      recentCount: memory.recentMemories.length,
      importantEvents: memory.importantEvents.length,
      lifeMilestones: memory.lifeMilestones.length,
      reflectionPrompt: memory.reflectionPrompts[0] ?? 'Take a moment to reflect on your day.',
      aiObservation: memory.aiObservations[0] ?? 'No observations yet.',
      totalMemories: memory.totalMemories,
    };
  }

  /** Create growth view model */
  createGrowthViewModel(growth: GrowthSectionDTO): GrowthViewModel {
    return {
      learningHours: growth.learning.totalHours,
      careerScore: growth.career.careerScore,
      skillsCount: growth.skills.length,
      achievementsCount: growth.achievements.length,
      activeCourses: growth.learning.activeCourses,
      learningStreak: growth.learning.learningStreak,
    };
  }

  /** Create journey view model */
  createJourneyViewModel(journey: JourneyDTO): JourneyViewModel {
    return {
      todayProgress: journey.today.completionRate,
      weeklyProgress: journey.week.completionRate,
      monthlyProgress: journey.month.completionRate,
      momentum: journey.momentum,
      consistency: journey.consistency,
      streak: journey.streak,
      trend: journey.week.trend,
      energyDescription: this.getEnergyDescription(journey.momentum, journey.consistency),
    };
  }

  /** Create insight summary view model */
  createInsightSummaryViewModel(insights: InsightDTO[]): InsightSummaryViewModel {
    return {
      totalCount: insights.length,
      warnings: insights.filter((i) => i.severity === 'warning').length,
      positiveCount: insights.filter((i) => i.severity === 'positive').length,
      criticalCount: insights.filter((i) => i.severity === 'critical').length,
      latestInsight: insights[0]?.description ?? 'No insights available',
      hasActionable: insights.some((i) => i.actionable),
    };
  }

  /** Create recommendation summary view model */
  createRecommendationSummaryViewModel(
    recommendations: RecommendationDTO[],
  ): RecommendationSummaryViewModel {
    const categories = recommendations.map((r) => r.category);
    const topCategory = this.mostFrequent(categories) ?? 'general';
    return {
      totalCount: recommendations.length,
      topCategory,
      topPriority:
        recommendations.length > 0 ? Math.max(...recommendations.map((r) => r.priority)) : 0,
      hasNew: recommendations.some((r) => !r.isDismissed),
    };
  }

  /** Create health view model */
  createHealthViewModel(health: HealthIndicatorDTO): HealthViewModel {
    const healthy = health.services.filter((s) => s.status === 'healthy').length;
    const degraded = health.services.filter((s) => s.status === 'degraded').length;
    const down = health.services.filter((s) => s.status === 'down').length;
    return {
      overall: health.overall,
      healthyCount: healthy,
      degradedCount: degraded,
      downCount: down,
      warnings: health.warnings,
      isHealthy: health.overall === 'healthy',
    };
  }

  /** Create metrics view model */
  createMetricsViewModel(metrics: DashboardMetricsDTO): MetricsViewModel {
    return {
      lifeScore: metrics.lifeScore,
      lifeScoreLabel: this.getLifeScoreLabel(metrics.lifeScore),
      goalProgress: metrics.goalProgress,
      executionRate: metrics.executionRate,
      consistency: metrics.consistency,
      momentum: metrics.momentum,
      streak: metrics.streak,
    };
  }

  /** Create full dashboard view model */
  createDashboardViewModel(snapshot: DashboardSnapshotDTO): DashboardViewModel {
    return {
      identity: this.createIdentityViewModel(snapshot.identity),
      focus: this.createFocusViewModel(snapshot.focus),
      execution: this.createExecutionViewModel(snapshot.execution),
      decisions: this.createDecisionViewModel(snapshot.decisions),
      memory: this.createMemoryViewModel(snapshot.memory),
      growth: this.createGrowthViewModel(snapshot.growth),
      journey: this.createJourneyViewModel(snapshot.journey),
      insights: this.createInsightSummaryViewModel(snapshot.insights),
      recommendations: this.createRecommendationSummaryViewModel(snapshot.recommendations),
      health: this.createHealthViewModel(snapshot.health),
      metrics: this.createMetricsViewModel(snapshot.metrics),
      quickActions: snapshot.quickActions,
      notifications: snapshot.notifications,
      timeline: snapshot.timeline,
      aiContext: snapshot.aiContext,
      sections: this.buildSections(snapshot),
      lastRefreshed: snapshot.generatedAt,
    };
  }

  /** Build section metadata from snapshot */
  private buildSections(snapshot: DashboardSnapshotDTO): DashboardSectionDTO[] {
    const now = snapshot.generatedAt;
    const sections: DashboardSectionDTO[] = [
      {
        id: 'identity',
        type: 'identity',
        title: 'Welcome',
        priority: 0,
        data: snapshot.identity,
        isLoading: false,
        lastRefreshed: now,
      },
      {
        id: 'focus',
        type: 'focus',
        title: "Today's Focus",
        priority: 1,
        data: snapshot.focus,
        isLoading: false,
        lastRefreshed: now,
      },
      {
        id: 'execution',
        type: 'execution',
        title: 'Execution',
        priority: 2,
        data: snapshot.execution,
        isLoading: false,
        lastRefreshed: now,
      },
      {
        id: 'decisions',
        type: 'decisions',
        title: 'Decision Center',
        priority: 3,
        data: snapshot.decisions,
        isLoading: false,
        lastRefreshed: now,
      },
      {
        id: 'memory',
        type: 'memory',
        title: 'Memory Timeline',
        priority: 4,
        data: snapshot.memory,
        isLoading: false,
        lastRefreshed: now,
      },
      {
        id: 'growth',
        type: 'growth',
        title: 'Growth Center',
        priority: 5,
        data: snapshot.growth,
        isLoading: false,
        lastRefreshed: now,
      },
      {
        id: 'journey',
        type: 'journey',
        title: 'Your Journey',
        priority: 6,
        data: snapshot.journey,
        isLoading: false,
        lastRefreshed: now,
      },
      {
        id: 'insights',
        type: 'insights',
        title: 'Insights',
        priority: 7,
        data: snapshot.insights,
        isLoading: false,
        lastRefreshed: now,
      },
      {
        id: 'recommendations',
        type: 'recommendations',
        title: 'Recommendations',
        priority: 8,
        data: snapshot.recommendations,
        isLoading: false,
        lastRefreshed: now,
      },
      {
        id: 'metrics',
        type: 'metrics',
        title: 'Metrics',
        priority: 9,
        data: snapshot.metrics,
        isLoading: false,
        lastRefreshed: now,
      },
      {
        id: 'health',
        type: 'health',
        title: 'System Health',
        priority: 10,
        data: snapshot.health,
        isLoading: false,
        lastRefreshed: now,
      },
    ];
    return sections;
  }

  private getUrgencyLabel(priority: string, isBlocked: boolean): string {
    if (isBlocked) return 'Blocked';
    switch (priority) {
      case 'critical':
        return 'Critical';
      case 'high':
        return 'Urgent';
      case 'medium':
        return 'Important';
      case 'low':
        return 'Upcoming';
      default:
        return 'Scheduled';
    }
  }

  private getEnergyDescription(momentum: number, consistency: number): string {
    const avg = (momentum + consistency) / 2;
    if (avg >= 80) return 'Exceptional momentum — keep pushing!';
    if (avg >= 60) return "Good rhythm — you're making steady progress.";
    if (avg >= 40) return 'Building momentum — stay consistent.';
    if (avg >= 20) return 'Finding your pace — every step counts.';
    return 'Starting your journey — momentum will build.';
  }

  private getLifeScoreLabel(score: number): string {
    if (score >= 90) return 'Exceptional';
    if (score >= 75) return 'Thriving';
    if (score >= 60) return 'Flourishing';
    if (score >= 45) return 'Growing';
    if (score >= 30) return 'Developing';
    if (score >= 15) return 'Emerging';
    return 'Beginning';
  }

  private mostFrequent(items: string[]): string | undefined {
    if (items.length === 0) return undefined;
    const freq = new Map<string, number>();
    let maxCount = 0;
    let maxItem: string | undefined;
    for (const item of items) {
      const count = (freq.get(item) ?? 0) + 1;
      freq.set(item, count);
      if (count > maxCount) {
        maxCount = count;
        maxItem = item;
      }
    }
    return maxItem;
  }
}
