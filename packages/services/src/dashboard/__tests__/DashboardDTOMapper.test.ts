import { describe, it, expect } from 'vitest';
import { DashboardDTOMapper } from '../DashboardDTOMapper.js';
import type { UserDTO } from '../../identity/UserDTO.js';
import type { GreetingDTO } from '../DashboardDTO.js';

describe('DashboardDTOMapper', () => {
  const mapper = new DashboardDTOMapper();

  const mockGreeting: GreetingDTO = {
    text: 'Good morning, Test User!',
    timeOfDay: 'morning',
    emoji: '🌅',
    personalized: true,
  };

  const mockUser: UserDTO = {
    id: 'user_1',
    email: 'test@example.com',
    displayName: 'Test User',
    givenName: 'Test',
    familyName: 'User',
    avatarUrl: 'https://example.com/avatar.png',
    bio: 'A test user',
    timezone: 'UTC',
    locale: 'en-US',
    theme: 'system',
    language: 'en',
    statusState: 'active',
    emailVerified: true,
    twoFactorEnabled: false,
    profileVisibility: 'public',
    entityStatus: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };

  // ── Identity Card ──────────────────────────────────────────────

  describe('toIdentityCard', () => {
    it('maps user to identity card with all fields', () => {
      const card = mapper.toIdentityCard(
        mockUser,
        mockGreeting,
        'Personal growth',
        'Finish the project',
        'Keep moving forward',
      );

      expect(card.userId).toBe('user_1');
      expect(card.displayName).toBe('Test User');
      expect(card.email).toBe('test@example.com');
      expect(card.role).toBe('active');
      expect(card.purpose).toBe('Personal growth');
      expect(card.avatarUrl).toBe('https://example.com/avatar.png');
      expect(card.currentJourney).toBe('Personal growth');
      expect(card.primaryGoal).toBe('Finish the project');
      expect(card.motivationalInsight).toBe('Keep moving forward');
      expect(card.greeting.text).toBe('Good morning, Test User!');
      expect(card.greeting.timeOfDay).toBe('morning');
    });

    it('handles missing optional fields', () => {
      const minimalUser: UserDTO = {
        ...mockUser,
        avatarUrl: undefined,
        givenName: undefined,
        familyName: undefined,
        bio: undefined,
        timezone: undefined,
        locale: undefined,
      };

      const card = mapper.toIdentityCard(minimalUser, mockGreeting, 'Purpose', 'Goal', 'Insight');

      expect(card.userId).toBe('user_1');
      expect(card.displayName).toBe('Test User');
      expect(card.avatarUrl).toBeUndefined();
    });
  });

  // ── Focus Card ─────────────────────────────────────────────────

  describe('toFocusCard', () => {
    it('maps mission to focus card', () => {
      const mission = {
        id: 'mis_1',
        label: 'Complete Project',
        description: 'Finish the roadmap',
        status: 'active',
        priority: { level: 'high', score: 7 },
        progress: { completed: 3, total: 10, percentage: 30 },
        tasks: [
          {
            id: 't1',
            label: 'Task 1',
            description: '',
            status: 'pending',
            priority: { level: 'high', score: 7 },
            estimatedDuration: 60,
            progress: { completed: 0, total: 1, percentage: 0 },
            steps: [],
            tags: [],
          },
          {
            id: 't2',
            label: 'Task 2',
            description: '',
            status: 'in_progress',
            priority: { level: 'medium', score: 5 },
            estimatedDuration: 30,
            progress: { completed: 0, total: 1, percentage: 0 },
            steps: [],
            tags: [],
          },
        ],
        planId: 'plan_1',
        tags: ['test'],
        targetDate: '2026-12-31T00:00:00Z',
      };

      const card = mapper.toFocusCard(mission);
      expect(card.missionId).toBe('mis_1');
      expect(card.missionLabel).toBe('Complete Project');
      expect(card.completionPercentage).toBe(30);
      expect(card.estimatedTimeMinutes).toBe(90);
      expect(card.nextMilestone).toBe('Task 1');
      expect(card.isBlocked).toBe(false);
      expect(card.priority).toBe('high');
    });

    it('handles undefined mission', () => {
      const card = mapper.toFocusCard(undefined);
      expect(card.missionLabel).toBe('No active mission');
      expect(card.completionPercentage).toBe(0);
      expect(card.estimatedTimeMinutes).toBe(0);
      expect(card.nextMilestone).toBeUndefined();
      expect(card.isBlocked).toBe(false);
    });

    it('passes through aiRecommendation', () => {
      const mission = {
        id: 'mis_3',
        label: 'Test',
        description: '',
        status: 'active',
        priority: { level: 'low', score: 3 },
        progress: { completed: 0, total: 1, percentage: 0 },
        tasks: [],
        planId: 'p1',
        tags: [],
      };
      const card = mapper.toFocusCard(mission, 'Try breaking it down');
      expect(card.aiRecommendation).toBe('Try breaking it down');
    });

    it('detects blocked mission', () => {
      const blockedMission = {
        id: 'mis_2',
        label: 'Blocked Mission',
        description: 'Stuck',
        status: 'blocked',
        priority: { level: 'high', score: 7 },
        progress: { completed: 1, total: 5, percentage: 20 },
        tasks: [],
        planId: 'plan_1',
        tags: [],
      };

      const card = mapper.toFocusCard(blockedMission);
      expect(card.isBlocked).toBe(true);
      expect(card.blockReason).toBe('Mission is blocked');
    });
  });

  // ── Execution Card ─────────────────────────────────────────────

  describe('toExecutionCard', () => {
    it('maps plans and daily plan to execution card', () => {
      const plans = [
        {
          id: 'plan_1',
          title: 'Active Plan',
          description: '',
          planningLevel: 'strategic',
          status: 'active',
          priority: { level: 'high', score: 8 },
          progress: { completed: 2, total: 5, percentage: 40 },
          missions: [],
          tasks: [
            {
              id: 't1',
              label: 'Task 1',
              description: '',
              status: 'completed',
              priority: { level: 'high', score: 7 },
              estimatedDuration: 30,
              progress: { completed: 1, total: 1, percentage: 100 },
              steps: [],
              tags: [],
            },
          ],
          timeline: { entryCount: 0 },
          context: {},
          goalReferences: [],
          decisionReferences: [],
          knowledgeNodeIds: [],
          memoryIds: [],
          tags: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        },
        {
          id: 'plan_2',
          title: 'Blocked Plan',
          description: '',
          planningLevel: 'tactical',
          status: 'blocked',
          priority: { level: 'medium', score: 5 },
          progress: { completed: 0, total: 3, percentage: 0 },
          missions: [],
          tasks: [],
          timeline: { entryCount: 0 },
          context: {},
          goalReferences: [],
          decisionReferences: [],
          knowledgeNodeIds: [],
          memoryIds: [],
          tags: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        },
      ];

      const dailyPlan = {
        planId: 'plan_1',
        tasks: [
          { taskId: 't1', label: 'Task 1', estimatedDuration: 30, priority: 'high' },
          { taskId: 't2', label: 'Task 2', estimatedDuration: 45, priority: 'medium' },
        ],
        totalEstimatedMinutes: 75,
        priority: 'high',
      };

      const card = mapper.toExecutionCard(plans, dailyPlan, ['Focus on quick wins']);
      expect(card.activePlans).toBe(1);
      expect(card.blockedPlans).toBe(1);
      expect(card.todayTasks).toHaveLength(2);
      expect(card.totalEstimatedMinutes).toBe(75);
      expect(card.recoverySuggestions).toContain('Focus on quick wins');
    });

    it('handles empty plans', () => {
      const card = mapper.toExecutionCard([]);
      expect(card.activePlans).toBe(0);
      expect(card.blockedPlans).toBe(0);
      expect(card.todayTasks).toHaveLength(0);
      expect(card.recoverySuggestions).toHaveLength(0);
    });
  });

  // ── Decision Card ──────────────────────────────────────────────

  describe('toDecisionCard', () => {
    it('maps decisions to decision card', () => {
      const decisions = [
        {
          id: 'dec_1',
          title: 'Strategic Decision',
          description: '',
          category: 'strategic',
          status: 'open',
          priority: { level: 'high', score: 8 },
          confidence: { level: 'medium', score: 0.65 },
          version: '1',
          initiator: 'user',
          options: [],
          evidence: [],
          constraints: [],
          knowledgeNodeIds: [],
          memoryIds: [],
          tags: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        },
      ];

      const stats = {
        total: 1,
        byCategory: { strategic: 1 },
        byStatus: { open: 1 },
        linkedCount: 0,
      };
      const card = mapper.toDecisionCard(decisions, stats);
      expect(card.pendingDecisions).toBe(1);
      expect(card.averageConfidence).toBe(0.65);
      expect(card.highRiskDecisions).toBe(0);
    });

    it('handles empty decisions', () => {
      const stats = { total: 0, byCategory: {}, byStatus: {}, linkedCount: 0 };
      const card = mapper.toDecisionCard([], stats);
      expect(card.pendingDecisions).toBe(0);
      expect(card.averageConfidence).toBe(0);
      expect(card.recommendedDecisions).toHaveLength(0);
    });

    it('populates lastDecisionDate from completed decisions', () => {
      const completedDecisions = [
        {
          id: 'dec_3',
          title: 'Completed Decision',
          description: '',
          category: 'strategic',
          status: 'completed',
          priority: { level: 'high', score: 8 },
          confidence: { level: 'high', score: 0.85 },
          version: '1',
          initiator: 'user',
          options: [],
          evidence: [],
          constraints: [],
          knowledgeNodeIds: [],
          memoryIds: [],
          tags: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
          completedAt: '2026-06-01T12:00:00Z',
        },
      ];
      const stats = {
        total: 1,
        byCategory: { strategic: 1 },
        byStatus: { completed: 1 },
        linkedCount: 0,
      };
      const card = mapper.toDecisionCard(completedDecisions, stats);
      expect(card.lastDecisionDate).toBe('2026-06-01T12:00:00Z');
    });

    it('detects high risk decisions', () => {
      const highRiskDecisions = [
        {
          id: 'dec_2',
          title: 'Risky Decision',
          description: '',
          category: 'financial',
          status: 'analyzing',
          priority: { level: 'high', score: 9 },
          confidence: { level: 'medium', score: 0.55 },
          version: '1',
          initiator: 'user',
          options: [
            {
              id: 'opt_1',
              label: 'Option A',
              description: '',
              risk: { level: 'high', score: 8, factors: ['Market volatility'] },
              confidence: { level: 'low', score: 0.4 },
              impacts: [],
              tradeoffs: [],
              tags: [],
            },
            {
              id: 'opt_2',
              label: 'Option B',
              description: '',
              confidence: { level: 'high', score: 0.8 },
              impacts: [],
              tradeoffs: [],
              tags: [],
            },
          ],
          evidence: [],
          constraints: [],
          knowledgeNodeIds: [],
          memoryIds: [],
          tags: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        },
      ];

      const stats = {
        total: 1,
        byCategory: { financial: 1 },
        byStatus: { analyzing: 1 },
        linkedCount: 0,
      };
      const card = mapper.toDecisionCard(highRiskDecisions, stats);
      expect(card.highRiskDecisions).toBe(1);
      expect(card.pendingDecisions).toBe(1);
    });
  });

  // ── Memory Card ────────────────────────────────────────────────

  describe('toMemoryCard', () => {
    it('maps memories to memory card', () => {
      const memories = [
        {
          id: 'mem_1',
          title: 'Important Event',
          content: 'Something important happened',
          category: 'milestone',
          importance: { level: 'high', score: 9 },
          confidence: { level: 'high', score: 0.9 },
          strength: { value: 1, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'manual', detail: 'user' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: '2026-06-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        },
        {
          id: 'mem_2',
          title: 'Learning Memory',
          content: 'Learned something new',
          category: 'learning',
          importance: { level: 'medium', score: 5 },
          confidence: { level: 'medium', score: 0.7 },
          strength: { value: 0.5, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'ai', detail: 'assistant' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        },
      ];

      const stats = {
        total: 2,
        byCategory: { milestone: 1, learning: 1 },
        byState: { active: 2 },
        linkedCount: 0,
      };
      const card = mapper.toMemoryCard(memories, stats);
      expect(card.totalMemories).toBe(2);
      expect(card.recentMemories).toHaveLength(2);
      expect(card.importantEvents).toHaveLength(1);
      expect(card.lifeMilestones).toHaveLength(1);
      // Reflection prompts always have defaults
      expect(card.reflectionPrompts.length).toBeGreaterThanOrEqual(1);
    });

    it('handles empty memories', () => {
      const stats = { total: 0, byCategory: {}, byState: {}, linkedCount: 0 };
      const card = mapper.toMemoryCard([], stats);
      expect(card.totalMemories).toBe(0);
      expect(card.recentMemories).toHaveLength(0);
    });
  });

  // ── Knowledge Card ─────────────────────────────────────────────

  describe('toKnowledgeCard', () => {
    it('maps knowledge nodes to knowledge card', () => {
      const nodes = [
        {
          id: 'n1',
          graphId: 'g1',
          label: 'Node 1',
          description: '',
          category: 'concept',
          tags: [],
          metadata: {},
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        },
        {
          id: 'n2',
          graphId: 'g1',
          label: 'Node 2',
          description: '',
          category: 'skill',
          tags: [],
          metadata: {},
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        },
      ];

      const card = mapper.toKnowledgeCard(nodes);
      expect(card.recentNodes).toBe(2);
      expect(card.topCategories).toHaveLength(2);
    });

    it('handles empty nodes', () => {
      const card = mapper.toKnowledgeCard([]);
      expect(card.recentNodes).toBe(0);
      expect(card.topCategories).toHaveLength(0);
    });

    it('accepts optional graph statistics', () => {
      const nodes = [
        {
          id: 'n1',
          graphId: 'g1',
          label: 'N1',
          description: '',
          category: 'concept',
          tags: [],
          metadata: {},
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'n2',
          graphId: 'g1',
          label: 'N2',
          description: '',
          category: 'concept',
          tags: [],
          metadata: {},
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'n3',
          graphId: 'g1',
          label: 'N3',
          description: '',
          category: 'skill',
          tags: [],
          metadata: {},
          createdAt: '',
          updatedAt: '',
        },
      ];
      const stats = { nodeCount: 100, edgeCount: 50 };

      const card = mapper.toKnowledgeCard(nodes, stats);
      expect(card.totalNodes).toBe(100);
      expect(card.recentEdges).toBe(50);
      expect(card.topCategories).toHaveLength(2);
      expect(card.topCategories[0]!.category).toBe('concept');
      expect(card.topCategories[0]!.count).toBe(2);
    });
  });

  // ── Growth Section ─────────────────────────────────────────────

  describe('toGrowthSection', () => {
    it('maps all sub-cards to growth section', () => {
      const learning = {
        activeCourses: 2,
        completedCourses: 5,
        totalHours: 120,
        recentAchievements: ['A1'],
        recommendedNext: ['N1'],
        learningStreak: 7,
      };
      const career = {
        currentRole: 'Engineer',
        careerScore: 80,
        skillsGained: 10,
        certifications: 3,
        nextMilestone: 'Senior',
        opportunities: [{ id: 'o1', title: 'Lead', relevance: 0.9 }],
      };
      const knowledge = {
        recentNodes: 10,
        totalNodes: 100,
        recentEdges: 5,
        topCategories: [{ category: 'tech', count: 50 }],
        lastUpdated: '2026-06-01',
      };
      const business = {
        activeProjects: 3,
        completedProjects: 2,
        milestones: [{ id: 'm1', label: 'Launch', status: 'completed' }],
        healthScore: 85,
      };
      const marketplace = {
        activeListings: 5,
        completedTransactions: 20,
        rating: 4.8,
        recentActivity: ['Sold item'],
      };

      const section = mapper.toGrowthSection(learning, career, knowledge, business, marketplace);
      expect(section.learning.activeCourses).toBe(2);
      expect(section.career.careerScore).toBe(80);
      expect(section.knowledge.totalNodes).toBe(100);
      expect(section.skills).toHaveLength(0);
      expect(section.achievements).toHaveLength(0);
    });

    it('handles minimal input', () => {
      const empty = {
        activeCourses: 0,
        completedCourses: 0,
        totalHours: 0,
        recentAchievements: [],
        recommendedNext: [],
        learningStreak: 0,
      };
      const career = {
        currentRole: '',
        careerScore: 0,
        skillsGained: 0,
        certifications: 0,
        opportunities: [],
      };
      const knowledge = { recentNodes: 0, totalNodes: 0, recentEdges: 0, topCategories: [] };
      const business = { activeProjects: 0, completedProjects: 0, milestones: [], healthScore: 0 };
      const marketplace = {
        activeListings: 0,
        completedTransactions: 0,
        rating: 0,
        recentActivity: [],
      };

      const section = mapper.toGrowthSection(empty, career, knowledge, business, marketplace);
      expect(section.learning.totalHours).toBe(0);
      expect(section.career.skillsGained).toBe(0);
    });
  });

  // ── Timeline ───────────────────────────────────────────────────

  describe('toTimeline', () => {
    it('maps entries to timeline DTO', () => {
      const entries = [
        {
          id: 'e1',
          type: 'task' as const,
          title: 'Task',
          description: 'Desc',
          timestamp: '',
          importance: 5,
          icon: 'circle',
        },
      ];
      const timeline = mapper.toTimeline(entries);
      expect(timeline.entries).toHaveLength(1);
      expect(timeline.totalEntries).toBe(1);
      expect(timeline.hasMore).toBe(false);
    });

    it('marks hasMore when >= 20 entries', () => {
      const entries = Array.from({ length: 20 }, (_, i) => ({
        id: `e${i}`,
        type: 'task' as const,
        title: `Task ${i}`,
        description: '',
        timestamp: '',
        importance: 5,
        icon: 'circle',
      }));
      const timeline = mapper.toTimeline(entries);
      expect(timeline.hasMore).toBe(true);
    });

    it('handles empty entries', () => {
      const timeline = mapper.toTimeline([]);
      expect(timeline.entries).toHaveLength(0);
      expect(timeline.totalEntries).toBe(0);
      expect(timeline.hasMore).toBe(false);
    });
  });

  // ── Quick Actions ──────────────────────────────────────────────

  describe('createQuickAction', () => {
    it('creates quick action with all fields', () => {
      const action = mapper.createQuickAction(
        'qa_1',
        'Continue Mission',
        'Resume work',
        'play',
        '/execution',
        1,
        'execution',
        true,
      );
      expect(action.id).toBe('qa_1');
      expect(action.label).toBe('Continue Mission');
      expect(action.isAvailable).toBe(true);
    });

    it('creates disabled quick action', () => {
      const action = mapper.createQuickAction(
        'qa_2',
        'Blocked',
        'Cannot proceed',
        'x',
        '/blocked',
        1,
        'execution',
        false,
        'Blocked by dependency',
      );
      expect(action.isAvailable).toBe(false);
      expect(action.disabledReason).toBe('Blocked by dependency');
    });
  });

  // ── Health Indicator ───────────────────────────────────────────

  describe('createHealthIndicator', () => {
    it('returns healthy when all services are healthy', () => {
      const health = mapper.createHealthIndicator([
        { name: 'identity', status: 'healthy', latency: 5 },
        { name: 'memory', status: 'healthy', latency: 10 },
      ]);
      expect(health.overall).toBe('healthy');
      expect(health.warnings).toHaveLength(0);
    });

    it('returns critical when a service is down', () => {
      const health = mapper.createHealthIndicator([
        { name: 'identity', status: 'healthy', latency: 5 },
        { name: 'memory', status: 'down', latency: 0 },
      ]);
      expect(health.overall).toBe('critical');
      expect(health.warnings).toHaveLength(1);
      expect(health.warnings[0]).toContain('memory is down');
    });

    it('returns degraded when services are slow', () => {
      const health = mapper.createHealthIndicator([
        { name: 'identity', status: 'healthy', latency: 5 },
        { name: 'memory', status: 'degraded', latency: 500 },
      ]);
      expect(health.overall).toBe('degraded');
      expect(health.warnings).toHaveLength(1);
    });

    it('handles empty services', () => {
      const health = mapper.createHealthIndicator([]);
      expect(health.overall).toBe('healthy');
      expect(health.warnings).toHaveLength(0);
    });
  });

  // ── Aggregate Metrics ──────────────────────────────────────────

  describe('aggregateMetrics', () => {
    it('aggregates all metrics into DTO', () => {
      const metrics = mapper.aggregateMetrics(
        {
          goalProgress: 50,
          missionProgress: 40,
          executionRate: 60,
          decisionQuality: 70,
          learningHours: 20,
          careerGrowth: 50,
          weeklyCompletion: 55,
          monthlyCompletion: 60,
          previousWeeklyCompletion: 50,
          dailyCompletionRates: [50, 60, 55],
          dailyCompletions: [{ date: '2026-06-01', completed: 3, total: 5 }],
          consistency: 65,
          momentum: 55,
          streak: 3,
        },
        65,
      );

      expect(metrics.goalProgress).toBe(50);
      expect(metrics.executionRate).toBe(60);
      expect(metrics.lifeScore).toBe(65);
      expect(metrics.consistency).toBe(65);
      expect(metrics.streak).toBe(3);
    });
  });

  // ── Private: generateMemoryObservations ────────────────────────

  describe('memory observations (private via toMemoryCard)', () => {
    it('generates observations for 3+ high importance memories', () => {
      const memories = Array.from({ length: 3 }, (_, i) => ({
        id: `mem_h${i}`,
        title: `Important ${i}`,
        content: '',
        category: 'learning',
        importance: { level: 'high', score: 8 + i },
        confidence: { level: 'high', score: 0.85 },
        strength: { value: 1, interval: 0, easeFactor: 2.5 },
        state: 'active',
        source: { type: 'manual', detail: 'user' },
        version: '1',
        retentionPolicy: 'standard',
        tags: [],
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z',
      }));
      const stats = {
        total: 3,
        byCategory: { learning: 3 },
        byState: { active: 3 },
        linkedCount: 0,
      };
      const card = mapper.toMemoryCard(memories, stats);
      const hasSignificantObs = card.aiObservations.some((o) => o.includes('significant memories'));
      expect(hasSignificantObs).toBe(true);
    });

    it('generates observations for diverse categories', () => {
      const memories = [
        {
          id: 'm1',
          title: 'A',
          content: '',
          category: 'personal',
          importance: { level: 'low', score: 5 },
          confidence: { level: 'medium', score: 0.6 },
          strength: { value: 0.5, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'manual', detail: 'user' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'm2',
          title: 'B',
          content: '',
          category: 'work',
          importance: { level: 'low', score: 5 },
          confidence: { level: 'medium', score: 0.6 },
          strength: { value: 0.5, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'manual', detail: 'user' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'm3',
          title: 'C',
          content: '',
          category: 'learning',
          importance: { level: 'low', score: 5 },
          confidence: { level: 'medium', score: 0.6 },
          strength: { value: 0.5, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'manual', detail: 'user' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: '',
          updatedAt: '',
        },
      ];
      const stats = {
        total: 3,
        byCategory: { personal: 1, work: 1, learning: 1 },
        byState: { active: 3 },
        linkedCount: 0,
      };
      const card = mapper.toMemoryCard(memories, stats);
      const hasDiverseObs = card.aiObservations.some((o) => o.includes('diverse areas'));
      expect(hasDiverseObs).toBe(true);
    });

    it('generates observations for recent strong memories', () => {
      const recentDate = new Date();
      const recentStr = recentDate.toISOString();
      const memories = [
        {
          id: 'm1',
          title: 'Recent Strong',
          content: '',
          category: 'learning',
          importance: { level: 'high', score: 8 },
          confidence: { level: 'high', score: 0.8 },
          strength: { value: 0.8, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'ai', detail: '' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: recentStr,
          updatedAt: recentStr,
        },
        {
          id: 'm2',
          title: 'Recent Strong 2',
          content: '',
          category: 'work',
          importance: { level: 'high', score: 8 },
          confidence: { level: 'high', score: 0.9 },
          strength: { value: 0.8, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'ai', detail: '' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: recentStr,
          updatedAt: recentStr,
        },
      ];
      const stats = {
        total: 2,
        byCategory: { learning: 1, work: 1 },
        byState: { active: 2 },
        linkedCount: 0,
      };
      const card = mapper.toMemoryCard(memories, stats);
      const hasRetentionObs = card.aiObservations.some((o) => o.includes('retention strength'));
      expect(hasRetentionObs).toBe(true);
    });
  });

  // ── Private: generateReflectionPrompts ──────────────────────────

  describe('reflection prompts (private via toMemoryCard)', () => {
    it('includes pattern prompt when >10 memories exist', () => {
      const memories = Array.from({ length: 11 }, (_, i) => ({
        id: `mem_${i}`,
        title: `M${i}`,
        content: '',
        category: 'personal',
        importance: { level: 'low', score: 3 },
        confidence: { level: 'high', score: 0.85 },
        strength: { value: 0.5, interval: 0, easeFactor: 2.5 },
        state: 'active',
        source: { type: 'manual', detail: 'user' },
        version: '1',
        retentionPolicy: 'standard',
        tags: [],
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z',
      }));
      const stats = {
        total: 11,
        byCategory: { personal: 11 },
        byState: { active: 11 },
        linkedCount: 0,
      };
      const card = mapper.toMemoryCard(memories, stats);
      expect(card.reflectionPrompts.some((p) => p.includes('patterns'))).toBe(true);
    });

    it('includes milestone prompt when milestones present', () => {
      const memories = [
        {
          id: 'm1',
          title: 'Milestone',
          content: '',
          category: 'milestone',
          importance: { level: 'high', score: 9 },
          confidence: { level: 'high', score: 0.9 },
          strength: { value: 1, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'manual', detail: 'user' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: '2026-06-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        },
        {
          id: 'm2',
          title: 'Regular',
          content: '',
          category: 'personal',
          importance: { level: 'low', score: 3 },
          confidence: { level: 'high', score: 0.85 },
          strength: { value: 0.5, interval: 0, easeFactor: 2.5 },
          state: 'active',
          source: { type: 'manual', detail: 'user' },
          version: '1',
          retentionPolicy: 'standard',
          tags: [],
          createdAt: '2026-06-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z',
        },
      ];
      const stats = {
        total: 2,
        byCategory: { milestone: 1, personal: 1 },
        byState: { active: 2 },
        linkedCount: 0,
      };
      const card = mapper.toMemoryCard(memories, stats);
      expect(card.reflectionPrompts.some((p) => p.includes('milestones'))).toBe(true);
    });

    it('always includes default prompts', () => {
      const stats = { total: 0, byCategory: {}, byState: {}, linkedCount: 0 };
      const card = mapper.toMemoryCard([], stats);
      expect(card.reflectionPrompts.some((p) => p.includes('grateful'))).toBe(true);
      expect(card.reflectionPrompts.some((p) => p.includes('accomplish'))).toBe(true);
    });
  });

  // ── Weekly/Monthly Summary ─────────────────────────────────────

  describe('toWeeklySummary', () => {
    it('creates weekly summary DTO', () => {
      const weekJourney = {
        startDate: '2026-06-01T00:00:00Z',
        endDate: '2026-06-07T00:00:00Z',
        completedTasks: 15,
        totalTasks: 20,
        completionRate: 75,
        completedMissions: 2,
        totalMissions: 3,
        trend: 'improving' as const,
      };

      const summary = mapper.toWeeklySummary(weekJourney, []);
      expect(summary.weekStart).toBe('2026-06-01T00:00:00Z');
      expect(summary.completionRate).toBe(75);
      expect(summary.trend).toBe('improving');
    });
  });

  describe('toMonthlySummary', () => {
    it('creates monthly summary DTO', () => {
      const monthJourney = {
        startDate: '2026-06-01T00:00:00Z',
        endDate: '2026-06-30T00:00:00Z',
        completedTasks: 50,
        totalTasks: 60,
        completionRate: 83,
        completedMissions: 5,
        totalMissions: 7,
        trend: 'stable' as const,
      };

      const summary = mapper.toMonthlySummary(monthJourney, []);
      expect(summary.completionRate).toBe(83);
      expect(summary.missionCount).toBe(5);
    });
  });
});
