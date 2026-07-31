import { describe, it, expect } from 'vitest';
import { DashboardRecommendationService } from '../DashboardRecommendationService.js';

describe('DashboardRecommendationService', () => {
  let service: DashboardRecommendationService;

  beforeEach(() => {
    service = new DashboardRecommendationService();
  });

  const defaultInput = () => ({
    identity: {
      userId: 'u1',
      displayName: 'Test',
      email: 't@t.com',
      role: 'active',
      purpose: '',
      avatarUrl: undefined,
      currentJourney: '',
      primaryGoal: '',
      motivationalInsight: '',
      greeting: { text: 'Hi', timeOfDay: 'morning' as const, emoji: '🌅', personalized: true },
    },
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
  });

  describe('generateRecommendations', () => {
    it('generates recommendations for blocked plans', () => {
      const input = defaultInput();
      input.execution.blockedPlans = 2;
      const recs = service.generateRecommendations(input);
      expect(recs.some((r) => r.title.includes('Unblock'))).toBe(true);
    });

    it('generates recommendations for recovery', () => {
      const input = defaultInput();
      input.execution.recoverySuggestions = ['Focus on quick wins'];
      const recs = service.generateRecommendations(input);
      expect(recs.some((r) => r.title.includes('Recovery'))).toBe(true);
    });

    it('generates recommendations for pending decisions', () => {
      const input = defaultInput();
      input.decisions.pendingDecisions = 5;
      const recs = service.generateRecommendations(input);
      expect(recs.some((r) => r.title.includes('Pending'))).toBe(true);
    });

    it('generates recommendations for high risk decisions', () => {
      const input = defaultInput();
      input.decisions.highRiskDecisions = 2;
      const recs = service.generateRecommendations(input);
      expect(recs.some((r) => r.title.includes('High Risk'))).toBe(true);
    });

    it('generates recommendations for low consistency', () => {
      const input = defaultInput();
      input.journey.consistency = 30;
      const recs = service.generateRecommendations(input);
      expect(recs.some((r) => r.title.includes('Consistency'))).toBe(true);
    });

    it('generates recommendations for low momentum', () => {
      const input = defaultInput();
      input.journey.momentum = 20;
      const recs = service.generateRecommendations(input);
      expect(recs.some((r) => r.title.includes('Momentum'))).toBe(true);
    });

    it('generates recommendations for overloaded schedule', () => {
      const input = defaultInput();
      input.execution.totalEstimatedMinutes = 500;
      const recs = service.generateRecommendations(input);
      expect(recs.some((r) => r.title.includes('Burnout'))).toBe(true);
    });

    it('generates default recommendations for empty state', () => {
      const recs = service.generateRecommendations(defaultInput());
      expect(recs.length).toBeGreaterThanOrEqual(2);
    });

    it('assigns correct categories', () => {
      const input = defaultInput();
      input.execution.blockedPlans = 1;
      const recs = service.generateRecommendations(input);
      const blockedRec = recs.find((r) => r.title.includes('Unblock'));
      expect(blockedRec?.category).toBe('productivity');
    });
  });

  describe('prioritizeRecommendations', () => {
    it('sorts by priority then confidence', () => {
      const recs = service.generateRecommendations(defaultInput());
      const sorted = service.prioritizeRecommendations(recs, 5);
      expect(sorted.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i - 1]!.priority).toBeGreaterThanOrEqual(sorted[i]!.priority);
      }
    });

    it('filters dismissed recommendations', () => {
      const recs = service.generateRecommendations(defaultInput());
      recs[0]!.isDismissed = true;
      const sorted = service.prioritizeRecommendations(recs);
      expect(sorted.some((r) => r.id === recs[0]!.id)).toBe(false);
    });
  });

  describe('dismissRecommendation', () => {
    it('marks a recommendation as dismissed', () => {
      const recs = service.generateRecommendations(defaultInput());
      const dismissed = service.dismissRecommendation(recs, recs[0]!.id);
      expect(dismissed.find((r) => r.id === recs[0]!.id)?.isDismissed).toBe(true);
    });
  });

  describe('duplicate elimination', () => {
    it('ignores dismissed recommendations in prioritization', () => {
      const recs = service.generateRecommendations(defaultInput());
      // Mark all as dismissed
      const dismissed = recs.map((r) => ({ ...r, isDismissed: true }));
      const prioritized = service.prioritizeRecommendations(dismissed);
      expect(prioritized).toHaveLength(0);
    });

    it('handles repeated dismiss calls gracefully', () => {
      const recs = service.generateRecommendations(defaultInput());
      const once = service.dismissRecommendation(recs, recs[0]!.id);
      const twice = service.dismissRecommendation(once, recs[0]!.id);
      expect(twice.find((r) => r.id === recs[0]!.id)?.isDismissed).toBe(true);
    });
  });
});
