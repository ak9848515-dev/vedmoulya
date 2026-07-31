// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Insight Service
// Generates insights by analyzing patterns across all modules
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type {
  InsightDTO,
  ExecutionCardDTO,
  DecisionCardDTO,
  MemoryCardDTO,
  JourneyDTO,
  DashboardMetricsDTO,
} from './DashboardDTO.js';

interface InsightInput {
  execution: ExecutionCardDTO;
  decisions: DecisionCardDTO;
  memory: MemoryCardDTO;
  journey: JourneyDTO;
  metrics: DashboardMetricsDTO;
}

export class DashboardInsightService {
  /** Generate insights from current dashboard state */
  generateInsights(input: InsightInput): InsightDTO[] {
    const insights: InsightDTO[] = [];
    const now = new Date().toISOString();

    // Execution insights
    insights.push(...this.getExecutionInsights(input.execution, now));

    // Decision insights
    insights.push(...this.getDecisionInsights(input.decisions, now));

    // Journey insights
    insights.push(...this.getJourneyInsights(input.journey, now));

    // Metric insights
    insights.push(...this.getMetricInsights(input.metrics, now));

    // Achievement insights
    insights.push(...this.getAchievementInsights(input, now));

    // Trend insights
    insights.push(...this.getTrendInsights(input, now));

    return insights.sort((a, b) => {
      const severityOrder: Record<string, number> = {
        critical: 0,
        warning: 1,
        positive: 2,
        info: 3,
      };
      return (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
    });
  }

  /** Filter actionable insights */
  getActionableInsights(insights: InsightDTO[]): InsightDTO[] {
    return insights.filter((i) => i.actionable);
  }

  /** Get insights by type */
  getInsightsByType(insights: InsightDTO[], type: InsightDTO['type']): InsightDTO[] {
    return insights.filter((i) => i.type === type);
  }

  private getExecutionInsights(execution: ExecutionCardDTO, now: string): InsightDTO[] {
    const insights: InsightDTO[] = [];
    let idCounter = 0;

    if (execution.blockedPlans > 0) {
      insights.push({
        id: `insight_exec_blocked_${String(++idCounter)}`,
        type: 'warning',
        title: 'Blocked Plans Detected',
        description: `${String(execution.blockedPlans)} plan${execution.blockedPlans > 1 ? 's are' : ' is'} currently blocked. Resolve blockers to maintain progress.`,
        severity: 'warning',
        source: 'execution',
        timestamp: now,
        actionable: true,
        actionLabel: 'Review Blocked Plans',
        actionRoute: '/execution/blocked',
      });
    }

    if (execution.completedToday > 0) {
      insights.push({
        id: `insight_exec_completed_${String(++idCounter)}`,
        type: 'achievement',
        title: 'Tasks Completed Today',
        description: `You've completed ${String(execution.completedToday)} task${execution.completedToday > 1 ? 's' : ''} today. Keep the momentum going!`,
        severity: 'positive',
        source: 'execution',
        timestamp: now,
        actionable: false,
      });
    }

    const completionRate =
      execution.todayTasks.length > 0
        ? (execution.completedToday / execution.todayTasks.length) * 100
        : 0;

    if (completionRate < 25 && execution.todayTasks.length > 0) {
      insights.push({
        id: `insight_exec_lowrate_${String(++idCounter)}`,
        type: 'pattern',
        title: 'Low Task Completion Rate',
        description: `You've completed ${String(Math.round(completionRate))}% of today's tasks. Consider breaking tasks into smaller steps.`,
        severity: 'info',
        source: 'execution',
        timestamp: now,
        actionable: true,
        actionLabel: 'View Tasks',
        actionRoute: '/execution',
      });
    }

    return insights;
  }

  private getDecisionInsights(decisions: DecisionCardDTO, now: string): InsightDTO[] {
    const insights: InsightDTO[] = [];
    let idCounter = 0;

    if (decisions.pendingDecisions > 5) {
      insights.push({
        id: `insight_dec_pending_${String(++idCounter)}`,
        type: 'warning',
        title: 'Decision Backlog Growing',
        description: `You have ${String(decisions.pendingDecisions)} pending decisions. Consider batching decision-making sessions.`,
        severity: 'warning',
        source: 'decision',
        timestamp: now,
        actionable: true,
        actionLabel: 'Review Decisions',
        actionRoute: '/decisions',
      });
    }

    if (decisions.highRiskDecisions > 0) {
      insights.push({
        id: `insight_dec_risk_${String(++idCounter)}`,
        type: 'warning',
        title: 'High Risk Decisions',
        description: `${String(decisions.highRiskDecisions)} high-risk decision${decisions.highRiskDecisions > 1 ? 's need' : ' needs'} attention. Review risk mitigation strategies.`,
        severity: 'warning',
        source: 'decision',
        timestamp: now,
        actionable: true,
        actionLabel: 'Assess Risks',
        actionRoute: '/decisions/risk',
      });
    }

    if (decisions.averageConfidence >= 0.8) {
      insights.push({
        id: `insight_dec_conf_${String(++idCounter)}`,
        type: 'achievement',
        title: 'High Decision Confidence',
        description:
          'Your average decision confidence is strong. Well-analyzed decisions lead to better outcomes.',
        severity: 'positive',
        source: 'decision',
        timestamp: now,
        actionable: false,
      });
    }

    return insights;
  }

  private getJourneyInsights(journey: JourneyDTO, now: string): InsightDTO[] {
    const insights: InsightDTO[] = [];
    let idCounter = 0;

    if (journey.streak >= 7) {
      insights.push({
        id: `insight_jrn_streak_${String(++idCounter)}`,
        type: 'achievement',
        title: `${String(journey.streak)}-Day Streak!`,
        description: `You've maintained a ${String(journey.streak)}-day streak. Consistency is building powerful momentum.`,
        severity: 'positive',
        source: 'journey',
        timestamp: now,
        actionable: false,
      });
    }

    if (journey.week.trend === 'improving') {
      insights.push({
        id: `insight_jrn_improve_${String(++idCounter)}`,
        type: 'trend',
        title: 'Positive Weekly Trend',
        description: "Your weekly completion rate is improving. Keep applying what's working.",
        severity: 'positive',
        source: 'journey',
        timestamp: now,
        actionable: false,
      });
    }

    if (journey.week.trend === 'declining') {
      insights.push({
        id: `insight_jrn_decline_${String(++idCounter)}`,
        type: 'trend',
        title: 'Declining Completion Trend',
        description:
          'Your completion rate has been declining. Consider reducing task volume or re-prioritizing.',
        severity: 'warning',
        source: 'journey',
        timestamp: now,
        actionable: true,
        actionLabel: 'Review Journey',
        actionRoute: '/journey',
      });
    }

    if (journey.consistency >= 80) {
      insights.push({
        id: `insight_jrn_consist_${String(++idCounter)}`,
        type: 'achievement',
        title: 'Exceptional Consistency',
        description:
          'Your consistency score is outstanding. This level of reliability drives extraordinary results.',
        severity: 'positive',
        source: 'journey',
        timestamp: now,
        actionable: false,
      });
    }

    return insights;
  }

  private getMetricInsights(metrics: DashboardMetricsDTO, now: string): InsightDTO[] {
    const insights: InsightDTO[] = [];
    let idCounter = 0;

    if (metrics.lifeScore >= 80) {
      insights.push({
        id: `insight_metric_life_${String(++idCounter)}`,
        type: 'achievement',
        title: 'Thriving Life Score',
        description: `Your life score of ${String(metrics.lifeScore)} indicates you're thriving across multiple dimensions.`,
        severity: 'positive',
        source: 'metrics',
        timestamp: now,
        actionable: false,
      });
    }

    if (metrics.lifeScore < 30 && metrics.lifeScore > 0) {
      insights.push({
        id: `insight_metric_lifelow_${String(++idCounter)}`,
        type: 'warning',
        title: 'Life Score Needs Attention',
        description: `Your life score is ${String(metrics.lifeScore)}. Focus on small, consistent improvements in key areas.`,
        severity: 'warning',
        source: 'metrics',
        timestamp: now,
        actionable: true,
        actionLabel: 'See Details',
        actionRoute: '/metrics',
      });
    }

    if (metrics.goalProgress > metrics.missionProgress) {
      insights.push({
        id: `insight_metric_goalmis_${String(++idCounter)}`,
        type: 'pattern',
        title: 'Goals vs Missions Gap',
        description:
          'Your goal progress outpaces mission progress. Consider aligning missions more closely with goals.',
        severity: 'info',
        source: 'metrics',
        timestamp: now,
        actionable: true,
        actionLabel: 'Align Missions',
        actionRoute: '/execution',
      });
    }

    return insights;
  }

  private getAchievementInsights(input: InsightInput, now: string): InsightDTO[] {
    const insights: InsightDTO[] = [];
    let idCounter = 0;

    // Check for achievement patterns
    if (input.execution.completedToday >= 5) {
      insights.push({
        id: `insight_achievement_5tasks_${String(++idCounter)}`,
        type: 'achievement',
        title: 'Power User Day',
        description: "You've completed 5+ tasks today. That's a highly productive day!",
        severity: 'positive',
        source: 'dashboard',
        timestamp: now,
        actionable: false,
      });
    }

    if (input.memory.totalMemories > 50) {
      insights.push({
        id: `insight_achievement_memories_${String(++idCounter)}`,
        type: 'achievement',
        title: 'Rich Memory Collection',
        description: `You've captured ${String(input.memory.totalMemories)} memories. Your life story is being well documented.`,
        severity: 'positive',
        source: 'memory',
        timestamp: now,
        actionable: false,
      });
    }

    return insights;
  }

  private getTrendInsights(input: InsightInput, now: string): InsightDTO[] {
    const insights: InsightDTO[] = [];
    let idCounter = 0;

    // Pattern: High momentum but low consistency
    if (input.journey.momentum > 60 && input.journey.consistency < 40) {
      insights.push({
        id: `insight_trend_momvcon_${String(++idCounter)}`,
        type: 'pattern',
        title: 'Momentum vs Consistency Gap',
        description:
          'High momentum but low consistency suggests bursts of activity. Focus on steady, sustainable progress.',
        severity: 'info',
        source: 'dashboard',
        timestamp: now,
        actionable: true,
        actionLabel: 'View Journey',
        actionRoute: '/journey',
      });
    }

    // Prediction: Based on current trajectory
    if (input.journey.week.trend === 'improving' && input.journey.consistency > 50) {
      insights.push({
        id: `insight_trend_prediction_${String(++idCounter)}`,
        type: 'prediction',
        title: 'Positive Trajectory',
        description: "Based on current trends, you're on track to exceed last month's performance.",
        severity: 'positive',
        source: 'dashboard',
        timestamp: now,
        actionable: false,
      });
    }

    return insights;
  }
}
