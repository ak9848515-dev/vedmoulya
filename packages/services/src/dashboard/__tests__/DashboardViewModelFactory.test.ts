import { describe, it, expect } from 'vitest';
import { DashboardViewModelFactory } from '../DashboardViewModelFactory.js';
import type { DashboardSnapshotDTO } from '../DashboardDTO.js';

describe('DashboardViewModelFactory', () => {
  const factory = new DashboardViewModelFactory();

  // ── Identity ViewModel ─────────────────────────────────────────

  describe('createIdentityViewModel', () => {
    const identity = {
      userId: 'user_1',
      displayName: 'Test User',
      email: 'test@example.com',
      role: 'active',
      purpose: 'Personal growth',
      avatarUrl: 'https://example.com/avatar.png',
      currentJourney: 'Growth path',
      primaryGoal: 'Finish project',
      motivationalInsight: 'Keep going',
      greeting: {
        text: 'Good morning!',
        timeOfDay: 'morning' as const,
        emoji: '🌅',
        personalized: true,
      },
    };

    it('maps identity to view model', () => {
      const vm = factory.createIdentityViewModel(identity);
      expect(vm.displayName).toBe('Test User');
      expect(vm.greeting).toBe('Good morning!');
      expect(vm.timeOfDay).toBe('morning');
      expect(vm.emoji).toBe('🌅');
      expect(vm.purpose).toBe('Personal growth');
      expect(vm.primaryGoal).toBe('Finish project');
      expect(vm.motivationalInsight).toBe('Keep going');
    });

    it('handles missing avatar', () => {
      const withoutAvatar = { ...identity, avatarUrl: undefined };
      const vm = factory.createIdentityViewModel(withoutAvatar);
      expect(vm.avatarUrl).toBeUndefined();
    });
  });

  // ── Focus ViewModel ────────────────────────────────────────────

  describe('createFocusViewModel', () => {
    it('creates focus view model from active mission', () => {
      const focus = {
        missionId: 'mis_1',
        missionLabel: 'Complete Sprint',
        missionDescription: 'Finish all stories',
        completionPercentage: 60,
        estimatedTimeMinutes: 120,
        nextMilestone: 'Code Review',
        isBlocked: false,
        aiRecommendation: 'Focus on high-priority tasks first',
        priority: 'high',
      };

      const vm = factory.createFocusViewModel(focus);
      expect(vm.missionLabel).toBe('Complete Sprint');
      expect(vm.completionPercentage).toBe(60);
      expect(vm.progressBar).toBe(60);
      expect(vm.urgencyLabel).toBe('Urgent');
      expect(vm.nextMilestone).toBe('Code Review');
      expect(vm.aiRecommendation).toBe('Focus on high-priority tasks first');
    });

    it('marks blocked missions', () => {
      const focus = {
        missionLabel: 'Blocked Mission',
        missionDescription: 'Stuck',
        completionPercentage: 20,
        estimatedTimeMinutes: 0,
        isBlocked: true,
        blockReason: 'Waiting for approval',
        priority: 'high',
      };

      const vm = factory.createFocusViewModel(focus);
      expect(vm.isBlocked).toBe(true);
      expect(vm.blockReason).toBe('Waiting for approval');
      expect(vm.urgencyLabel).toBe('Blocked');
    });

    it('handles low priority', () => {
      const focus = {
        missionLabel: 'Low Priority',
        missionDescription: 'Not urgent',
        completionPercentage: 0,
        estimatedTimeMinutes: 0,
        isBlocked: false,
        priority: 'low',
      };

      const vm = factory.createFocusViewModel(focus);
      expect(vm.urgencyLabel).toBe('Upcoming');
    });

    it('clamps progress between 0 and 100', () => {
      const over = {
        missionLabel: 'Test',
        missionDescription: '',
        completionPercentage: 150,
        estimatedTimeMinutes: 0,
        isBlocked: false,
        priority: 'medium',
      };
      expect(factory.createFocusViewModel(over).progressBar).toBe(100);

      const under = {
        missionLabel: 'Test',
        missionDescription: '',
        completionPercentage: -10,
        estimatedTimeMinutes: 0,
        isBlocked: false,
        priority: 'medium',
      };
      expect(factory.createFocusViewModel(under).progressBar).toBe(0);
    });
  });

  // ── Execution ViewModel ────────────────────────────────────────

  describe('createExecutionViewModel', () => {
    it('creates execution view model', () => {
      const execution = {
        todayTasks: [
          {
            taskId: 't1',
            label: 'Task 1',
            status: 'completed',
            estimatedDuration: 30,
            priority: 'high',
          },
          {
            taskId: 't2',
            label: 'Task 2',
            status: 'completed',
            estimatedDuration: 45,
            priority: 'medium',
          },
          {
            taskId: 't3',
            label: 'Task 3',
            status: 'pending',
            estimatedDuration: 60,
            priority: 'low',
          },
        ],
        activePlans: 2,
        blockedPlans: 0,
        completedToday: 2,
        upcomingSchedule: [
          {
            taskId: 't3',
            label: 'Task 3',
            scheduledStart: '2026-06-01T10:00:00Z',
            scheduledEnd: '2026-06-01T11:00:00Z',
          },
        ],
        recoverySuggestions: [],
        totalEstimatedMinutes: 135,
      };

      const vm = factory.createExecutionViewModel(execution);
      expect(vm.todayTasks).toBe(3);
      expect(vm.completedToday).toBe(2);
      expect(vm.isOnTrack).toBe(true);
      expect(vm.productivityScore).toBe(67); // 2/3 = 67% rounded
      expect(vm.scheduleSummary).toContain('Task 3');
    });

    it('detects off-track execution', () => {
      const offTrack = {
        todayTasks: [
          {
            taskId: 't1',
            label: 'Task 1',
            status: 'pending',
            estimatedDuration: 30,
            priority: 'high',
          },
        ],
        activePlans: 1,
        blockedPlans: 2,
        completedToday: 0,
        upcomingSchedule: [],
        recoverySuggestions: ['Focus on critical path'],
        totalEstimatedMinutes: 30,
      };

      const vm = factory.createExecutionViewModel(offTrack);
      expect(vm.isOnTrack).toBe(false);
      expect(vm.productivityScore).toBe(0);
    });

    it('handles empty tasks', () => {
      const empty = {
        todayTasks: [],
        activePlans: 0,
        blockedPlans: 0,
        completedToday: 0,
        upcomingSchedule: [],
        recoverySuggestions: [],
        totalEstimatedMinutes: 0,
      };

      const vm = factory.createExecutionViewModel(empty);
      expect(vm.scheduleSummary).toBe('No upcoming tasks');
    });
  });

  // ── Decision ViewModel ─────────────────────────────────────────

  describe('createDecisionViewModel', () => {
    it('creates decision view model', () => {
      const decision = {
        pendingDecisions: 5,
        recommendedDecisions: [
          { decisionId: 'd1', title: 'Choose Stack', confidence: 0.8, priority: 'high' },
        ],
        averageConfidence: 0.75,
        highRiskDecisions: 1,
        lastDecisionDate: '2026-05-01T00:00:00Z',
      };

      const vm = factory.createDecisionViewModel(decision);
      expect(vm.pendingDecisions).toBe(5);
      expect(vm.averageConfidence).toBe(75);
      expect(vm.needsAttention).toBe(true);
      expect(vm.topDecision).toBe('Choose Stack');
    });

    it('handles empty recommendations', () => {
      const empty = {
        pendingDecisions: 0,
        recommendedDecisions: [],
        averageConfidence: 0,
        highRiskDecisions: 0,
      };

      const vm = factory.createDecisionViewModel(empty);
      expect(vm.needsAttention).toBe(false);
      expect(vm.topDecision).toBe('No decisions pending');
    });
  });

  // ── Growth ViewModel ───────────────────────────────────────────

  describe('createGrowthViewModel', () => {
    it('creates growth view model', () => {
      const growth = {
        learning: {
          activeCourses: 2,
          completedCourses: 3,
          totalHours: 40,
          recentAchievements: ['Completed React'],
          recommendedNext: ['Node.js'],
          learningStreak: 5,
        },
        career: {
          currentRole: 'Developer',
          careerScore: 75,
          skillsGained: 8,
          certifications: 2,
          nextMilestone: 'Senior',
          opportunities: [],
        },
        knowledge: {
          recentNodes: 10,
          totalNodes: 50,
          recentEdges: 5,
          topCategories: [],
          lastUpdated: '2026-06-01',
        },
        skills: [{ name: 'TypeScript', level: 8, category: 'programming' }],
        achievements: [{ id: 'a1', title: 'Completed Course', date: '2026-05-01', icon: 'trophy' }],
      };

      const vm = factory.createGrowthViewModel(growth);
      expect(vm.learningHours).toBe(40);
      expect(vm.careerScore).toBe(75);
      expect(vm.skillsCount).toBe(1);
      expect(vm.achievementsCount).toBe(1);
      expect(vm.learningStreak).toBe(5);
    });
  });

  // ── Metrics ViewModel ──────────────────────────────────────────

  describe('createMetricsViewModel', () => {
    it('assigns life score label based on score', () => {
      expect(
        factory.createMetricsViewModel({
          lifeScore: 95,
          goalProgress: 80,
          executionRate: 70,
          consistency: 85,
          momentum: 75,
          streak: 10,
          weeklyCompletion: 70,
          monthlyCompletion: 75,
          decisionQuality: 80,
          learningHours: 30,
          careerGrowth: 60,
        }).lifeScoreLabel,
      ).toBe('Exceptional');
      expect(
        factory.createMetricsViewModel({
          lifeScore: 80,
          goalProgress: 80,
          executionRate: 70,
          consistency: 85,
          momentum: 75,
          streak: 10,
          weeklyCompletion: 70,
          monthlyCompletion: 75,
          decisionQuality: 80,
          learningHours: 30,
          careerGrowth: 60,
        }).lifeScoreLabel,
      ).toBe('Thriving');
      expect(
        factory.createMetricsViewModel({
          lifeScore: 65,
          goalProgress: 60,
          executionRate: 50,
          consistency: 60,
          momentum: 55,
          streak: 3,
          weeklyCompletion: 55,
          monthlyCompletion: 60,
          decisionQuality: 60,
          learningHours: 15,
          careerGrowth: 40,
        }).lifeScoreLabel,
      ).toBe('Flourishing');
      expect(
        factory.createMetricsViewModel({
          lifeScore: 50,
          goalProgress: 40,
          executionRate: 30,
          consistency: 30,
          momentum: 25,
          streak: 1,
          weeklyCompletion: 30,
          monthlyCompletion: 40,
          decisionQuality: 40,
          learningHours: 10,
          careerGrowth: 20,
        }).lifeScoreLabel,
      ).toBe('Growing');
      expect(
        factory.createMetricsViewModel({
          lifeScore: 35,
          goalProgress: 30,
          executionRate: 20,
          consistency: 20,
          momentum: 15,
          streak: 0,
          weeklyCompletion: 15,
          monthlyCompletion: 20,
          decisionQuality: 20,
          learningHours: 5,
          careerGrowth: 10,
        }).lifeScoreLabel,
      ).toBe('Developing');
      expect(
        factory.createMetricsViewModel({
          lifeScore: 20,
          goalProgress: 10,
          executionRate: 10,
          consistency: 10,
          momentum: 5,
          streak: 0,
          weeklyCompletion: 5,
          monthlyCompletion: 10,
          decisionQuality: 10,
          learningHours: 2,
          careerGrowth: 5,
        }).lifeScoreLabel,
      ).toBe('Emerging');
      expect(
        factory.createMetricsViewModel({
          lifeScore: 5,
          goalProgress: 0,
          executionRate: 0,
          consistency: 0,
          momentum: 0,
          streak: 0,
          weeklyCompletion: 0,
          monthlyCompletion: 0,
          decisionQuality: 0,
          learningHours: 0,
          careerGrowth: 0,
        }).lifeScoreLabel,
      ).toBe('Beginning');
    });
  });

  // ── Full Dashboard ViewModel ───────────────────────────────────

  describe('createDashboardViewModel', () => {
    it('creates full dashboard view model from snapshot', () => {
      const snapshot: DashboardSnapshotDTO = {
        id: 'snap_1',
        userId: 'user_1',
        generatedAt: '2026-06-01T12:00:00Z',
        ttl: 300000,
        identity: {
          userId: 'user_1',
          displayName: 'Test',
          email: 't@t.com',
          role: 'active',
          purpose: 'Grow',
          avatarUrl: undefined,
          currentJourney: 'Path',
          primaryGoal: 'Goal',
          motivationalInsight: 'Keep going',
          greeting: { text: 'Hi!', timeOfDay: 'afternoon', emoji: '☀️', personalized: true },
        },
        focus: {
          missionLabel: 'Mission',
          missionDescription: 'Desc',
          completionPercentage: 50,
          estimatedTimeMinutes: 60,
          isBlocked: false,
          priority: 'medium',
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
          pendingDecisions: 2,
          recommendedDecisions: [],
          averageConfidence: 0.5,
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
        knowledge: { recentNodes: 0, totalNodes: 0, recentEdges: 0, topCategories: [] },
        growth: {
          learning: {
            activeCourses: 0,
            completedCourses: 0,
            totalHours: 0,
            recentAchievements: [],
            recommendedNext: [],
            learningStreak: 0,
          },
          career: {
            currentRole: 'Member',
            careerScore: 50,
            skillsGained: 0,
            certifications: 0,
            opportunities: [],
          },
          knowledge: { recentNodes: 0, totalNodes: 0, recentEdges: 0, topCategories: [] },
          skills: [],
          achievements: [],
        },
        journey: {
          today: {
            date: '2026-06-01',
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
            trend: 'stable',
          },
          month: {
            startDate: '',
            endDate: '',
            completedTasks: 0,
            totalTasks: 0,
            completionRate: 0,
            completedMissions: 0,
            totalMissions: 0,
            trend: 'stable',
          },
          momentum: 50,
          consistency: 50,
          streak: 0,
        },
        timeline: { entries: [], totalEntries: 0, hasMore: false },
        insights: [],
        recommendations: [],
        notifications: [],
        quickActions: [],
        health: {
          overall: 'healthy',
          services: [],
          lastChecked: '2026-06-01T12:00:00Z',
          warnings: [],
        },
        metrics: {
          lifeScore: 50,
          goalProgress: 0,
          missionProgress: 0,
          executionRate: 0,
          decisionQuality: 0,
          learningHours: 0,
          careerGrowth: 0,
          consistency: 50,
          momentum: 50,
          streak: 0,
          weeklyCompletion: 0,
          monthlyCompletion: 0,
        },
        aiContext: {
          currentFocus: 'Mission',
          recentActivity: [],
          suggestedQuestions: [],
          contextSummary: 'Summary',
        },
        widgetStates: {},
      };

      const vm = factory.createDashboardViewModel(snapshot);
      expect(vm.identity.displayName).toBe('Test');
      expect(vm.focus.missionLabel).toBe('Mission');
      expect(vm.sections).toHaveLength(11);
      expect(vm.lastRefreshed).toBe('2026-06-01T12:00:00Z');
    });
  });
});
