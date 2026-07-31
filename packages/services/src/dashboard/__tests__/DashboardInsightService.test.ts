import { describe, it, expect } from 'vitest';
import { DashboardInsightService } from '../DashboardInsightService.js';

describe('DashboardInsightService', () => {
  let service: DashboardInsightService;

  beforeEach(() => {
    service = new DashboardInsightService();
  });

  const baseInput = () => ({
    execution: {
      todayTasks: [],
      activePlans: 1,
      blockedPlans: 0,
      completedToday: 0,
      upcomingSchedule: [],
      recoverySuggestions: [],
      totalEstimatedMinutes: 0,
    },
    decisions: {
      pendingDecisions: 0,
      recommendedDecisions: [],
      averageConfidence: 0,
      highRiskDecisions: 0,
    },
    memory: {
      recentMemories: [],
      importantEvents: [],
      lifeMilestones: [],
      aiObservations: [],
      reflectionPrompts: [],
      totalMemories: 0,
    },
    journey: {
      today: {
        date: '',
        completedTasks: 0,
        totalTasks: 0,
        completionRate: 0,
        highlights: [],
        challenges: [],
      },
      week: {
        startDate: '',
        endDate: '',
        completedTasks: 0,
        totalTasks: 0,
        completionRate: 0,
        completedMissions: 0,
        totalMissions: 0,
        trend: 'stable' as const,
      },
      month: {
        startDate: '',
        endDate: '',
        completedTasks: 0,
        totalTasks: 0,
        completionRate: 0,
        completedMissions: 0,
        totalMissions: 0,
        trend: 'stable' as const,
      },
      momentum: 50,
      consistency: 50,
      streak: 0,
    },
    metrics: {
      lifeScore: 50,
      goalProgress: 50,
      missionProgress: 50,
      executionRate: 50,
      decisionQuality: 50,
      learningHours: 10,
      careerGrowth: 50,
      consistency: 50,
      momentum: 50,
      streak: 0,
      weeklyCompletion: 50,
      monthlyCompletion: 50,
    },
  });

  describe('generateInsights', () => {
    it('generates blocked plan warning', () => {
      const input = baseInput();
      input.execution.blockedPlans = 2;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Blocked'))).toBe(true);
    });

    it('generates task completion achievement', () => {
      const input = baseInput();
      input.execution.completedToday = 5;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.type === 'achievement')).toBe(true);
    });

    it('generates decision backlog warning', () => {
      const input = baseInput();
      input.decisions.pendingDecisions = 6;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Backlog'))).toBe(true);
    });

    it('generates high risk decision warning', () => {
      const input = baseInput();
      input.decisions.highRiskDecisions = 1;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('High Risk'))).toBe(true);
    });

    it('generates streak achievement', () => {
      const input = baseInput();
      input.journey.streak = 14;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Streak'))).toBe(true);
    });

    it('generates improving trend insight', () => {
      const input = baseInput();
      input.journey.week.trend = 'improving';
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.type === 'trend')).toBe(true);
    });

    it('generates declining trend warning', () => {
      const input = baseInput();
      input.journey.week.trend = 'declining';
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Declining'))).toBe(true);
    });

    it('generates high life score achievement', () => {
      const input = baseInput();
      input.metrics.lifeScore = 85;
      const insights = service.generateInsights(input);
      expect(
        insights.some((i) => i.title.includes('Life Score') && i.severity === 'positive'),
      ).toBe(true);
    });

    it('generates low life score warning', () => {
      const input = baseInput();
      input.metrics.lifeScore = 25;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Life Score') && i.severity === 'warning')).toBe(
        true,
      );
    });

    it('generates prediction insight', () => {
      const input = baseInput();
      input.journey.week.trend = 'improving';
      input.journey.consistency = 60;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.type === 'prediction')).toBe(true);
    });

    it('handles empty state gracefully', () => {
      const insights = service.generateInsights(baseInput());
      expect(Array.isArray(insights)).toBe(true);
    });

    it('sorts by severity order', () => {
      const input = baseInput();
      input.execution.blockedPlans = 1;
      input.execution.completedToday = 6;
      const insights = service.generateInsights(input);
      for (let i = 1; i < insights.length; i++) {
        const order: Record<string, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
        expect(order[insights[i - 1]!.severity]).toBeLessThanOrEqual(
          order[insights[i]!.severity] ?? 99,
        );
      }
    });
  });

  describe('branch coverage — execution insights', () => {
    it('generates low completion rate insight when <25%', () => {
      const input = baseInput();
      input.execution.todayTasks = [
        { taskId: 't1', label: 'T1', status: 'pending', estimatedDuration: 30, priority: 'high' },
      ];
      input.execution.completedToday = 0;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Completion Rate'))).toBe(true);
    });

    it('does not generate low completion insight when no tasks', () => {
      const input = baseInput();
      input.execution.todayTasks = [];
      input.execution.completedToday = 0;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Completion Rate'))).toBe(false);
    });
  });

  describe('branch coverage — decision insights', () => {
    it('generates high confidence achievement', () => {
      const input = baseInput();
      input.decisions.averageConfidence = 0.85;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('High Decision Confidence'))).toBe(true);
    });
  });

  describe('branch coverage — journey insights', () => {
    it('generates exceptional consistency achievement', () => {
      const input = baseInput();
      input.journey.consistency = 90;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Exceptional Consistency'))).toBe(true);
    });
  });

  describe('branch coverage — metric insights', () => {
    it('generates goals vs missions gap insight', () => {
      const input = baseInput();
      input.metrics.goalProgress = 80;
      input.metrics.missionProgress = 30;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Goals vs Missions'))).toBe(true);
    });
  });

  describe('branch coverage — achievement insights', () => {
    it('generates power user day achievement', () => {
      const input = baseInput();
      input.execution.completedToday = 5;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Power User'))).toBe(true);
    });

    it('generates rich memory collection achievement', () => {
      const input = baseInput();
      input.memory.totalMemories = 100;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Rich Memory'))).toBe(true);
    });
  });

  describe('branch coverage — trend insights', () => {
    it('generates momentum vs consistency gap', () => {
      const input = baseInput();
      input.journey.momentum = 80;
      input.journey.consistency = 30;
      const insights = service.generateInsights(input);
      expect(insights.some((i) => i.title.includes('Momentum vs Consistency'))).toBe(true);
    });
  });

  describe('getActionableInsights', () => {
    it('filters actionable insights', () => {
      const insights = service.generateInsights(baseInput());
      const actionable = service.getActionableInsights(insights);
      expect(actionable.every((i) => i.actionable)).toBe(true);
    });
  });

  describe('getInsightsByType', () => {
    it('filters insights by type', () => {
      const input = baseInput();
      input.execution.blockedPlans = 2;
      const insights = service.generateInsights(input);
      const warnings = service.getInsightsByType(insights, 'warning');
      expect(warnings.every((i) => i.type === 'warning')).toBe(true);
    });

    it('returns empty array for non-existent type', () => {
      expect(service.getInsightsByType([], 'achievement')).toHaveLength(0);
    });
  });
});
