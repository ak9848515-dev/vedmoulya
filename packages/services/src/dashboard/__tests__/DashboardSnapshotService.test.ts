import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardSnapshotService } from '../DashboardSnapshotService.js';
import { DashboardCacheService } from '../DashboardCacheService.js';
import { DashboardConfigurationService } from '../DashboardConfigurationService.js';
import { DashboardAssembler } from '../DashboardAssembler.js';

describe('DashboardSnapshotService', () => {
  let cache: DashboardCacheService;
  let config: DashboardConfigurationService;
  let mockAssembler: {
    assemble: ReturnType<typeof vi.fn>;
    assembleSection: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new DashboardCacheService(1000);
    config = new DashboardConfigurationService();
    mockAssembler = {
      assemble: vi.fn(),
      assembleSection: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockSnapshot = {
    id: 'snap_1',
    userId: 'user_1',
    generatedAt: new Date().toISOString(),
    ttl: 300000,
    identity: {
      userId: 'u1',
      displayName: 'Test',
      email: 't@t.com',
      role: 'active',
      purpose: '',
      currentJourney: '',
      primaryGoal: '',
      motivationalInsight: '',
      greeting: { text: 'Hi', timeOfDay: 'morning' as const, emoji: '🌅', personalized: true },
    },
    focus: {
      missionLabel: 'Mission',
      missionDescription: '',
      completionPercentage: 0,
      estimatedTimeMinutes: 0,
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
    timeline: { entries: [], totalEntries: 0, hasMore: false },
    insights: [],
    recommendations: [],
    notifications: [],
    quickActions: [],
    health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
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
      contextSummary: '',
    },
    widgetStates: {},
  };

  describe('getSnapshot', () => {
    it('returns fresh snapshot when cache misses', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      const result = await service.getSnapshot('user_1');
      expect(result.source).toBe('fresh');
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBe('snap_1');
      expect(mockAssembler.assemble).toHaveBeenCalledWith('user_1');
    });

    it('returns cached snapshot on subsequent calls', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      await service.getSnapshot('user_1');
      const result = await service.getSnapshot('user_1');
      expect(result.source).toBe('cache');
      expect(mockAssembler.assemble).toHaveBeenCalledTimes(1);
    });

    it('returns error when assembler fails', async () => {
      mockAssembler.assemble.mockRejectedValue(new Error('Assembly failed'));
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      const result = await service.getSnapshot('user_1');
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('refreshSection', () => {
    it('refreshes a specific section', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      mockAssembler.assembleSection.mockResolvedValue({ execution: mockSnapshot.execution });
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      const result = await service.refreshSection('user_1', 'execution');
      expect(result.data).toBeDefined();
      expect(result.data!.execution).toBeDefined();
    });

    it('returns error when section refresh fails', async () => {
      mockAssembler.assembleSection.mockRejectedValue(new Error('Section failed'));
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      const result = await service.refreshSection('user_1', 'execution');
      expect(result.error).toBeDefined();
    });
  });

  describe('invalidateSnapshot', () => {
    it('invalidates cached snapshot', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      await service.getSnapshot('user_1');
      service.invalidateSnapshot('user_1');

      const result = await service.getSnapshot('user_1');
      expect(result.source).toBe('fresh');
    });
  });

  describe('warmCache', () => {
    it('warms cache for a user', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      const success = await service.warmCache('user_1');
      expect(success).toBe(true);

      const result = await service.getSnapshot('user_1');
      expect(result.source).toBe('cache');
    });

    it('returns false on failure', async () => {
      mockAssembler.assemble.mockRejectedValue(new Error('Fail'));
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      const success = await service.warmCache('user_1');
      expect(success).toBe(false);
    });
  });

  describe('getSnapshotWithPartialRefresh', () => {
    it('serves stale data when cache age exceeds 300s threshold', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      // Cache a snapshot with a generatedAt time in the past
      const oldSnapshot = {
        ...mockSnapshot,
        generatedAt: new Date(Date.now() - 600_000).toISOString(), // 10 minutes old, exceeds 300s
      };
      cache.set('snapshot_user_1', oldSnapshot);

      const result = await service.getSnapshotWithPartialRefresh('user_1');
      expect(result.source).toBe('stale');
      expect(result.data).toBeDefined();
      expect(result.latency).toBe(0);
      // Background refresh should have been triggered
      expect(mockAssembler.assemble).toHaveBeenCalledWith('user_1');
    });

    it('triggers background refresh fire-and-forget on stale cache', async () => {
      // This test verifies the background refresh is fire-and-forget
      // by checking that the stale response is returned immediately
      mockAssembler.assemble.mockImplementation(async () => {
        // Simulate a slow background refresh
        await new Promise((r) => setTimeout(r, 1000));
        return mockSnapshot;
      });

      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      const oldSnapshot = {
        ...mockSnapshot,
        generatedAt: new Date(Date.now() - 600_000).toISOString(),
      };
      cache.set('snapshot_user_1', oldSnapshot);

      // Should return stale data immediately, not wait for background refresh
      const start = Date.now();
      const result = await service.getSnapshotWithPartialRefresh('user_1');
      const elapsed = Date.now() - start;

      expect(result.source).toBe('stale');
      expect(elapsed).toBeLessThan(50); // Should be near-instant, not waiting 1s
    });

    it('handles background refresh failure gracefully', async () => {
      mockAssembler.assemble.mockRejectedValue(new Error('Background refresh failed'));
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      const oldSnapshot = {
        ...mockSnapshot,
        generatedAt: new Date(Date.now() - 600_000).toISOString(),
      };
      cache.set('snapshot_user_1', oldSnapshot);

      // Should still return stale data even if background refresh fails
      const result = await service.getSnapshotWithPartialRefresh('user_1');
      expect(result.source).toBe('stale');
      expect(result.data).toBeDefined();
      expect(mockAssembler.assemble).toHaveBeenCalled();
    });

    it('returns fresh data when staleWhileRefresh is false', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      const result = await service.getSnapshotWithPartialRefresh('user_1', false);
      expect(result.source).toBe('fresh');
    });

    it('returns fresh data when cache is not stale (<300s old)', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      // Cache a fresh snapshot (just a few seconds old)
      const freshSnapshot = {
        ...mockSnapshot,
        generatedAt: new Date(Date.now() - 10_000).toISOString(), // 10 seconds old
      };
      cache.set('snapshot_user_1', freshSnapshot);

      const result = await service.getSnapshotWithPartialRefresh('user_1');
      expect(result.source).toBe('cache'); // Not stale
      expect(result.data).toBeDefined();
    });
  });

  describe('getCacheMetrics', () => {
    it('returns cache metrics', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      await service.getSnapshot('user_1');
      await service.getSnapshot('user_1');

      const metrics = service.getCacheMetrics();
      expect(metrics.totalEntries).toBe(1);
      expect(metrics.hitRate).toBeGreaterThan(0);
    });
  });

  describe('invalidateSection', () => {
    it('invalidates cache and forces fresh fetch', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      await service.getSnapshot('user_1');
      service.invalidateSection('user_1', 'execution');

      const result = await service.getSnapshot('user_1');
      expect(result.source).toBe('fresh');
    });
  });

  describe('getAnalytics', () => {
    it('returns analytics data after operations', async () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never, cache, config);

      await service.getSnapshot('user_1');

      const analytics = service.getAnalytics();
      expect(analytics.totalLoads).toBeGreaterThan(0);
      expect(typeof analytics.cacheHitRate).toBe('number');
      expect(analytics.sectionAnalytics).toBeDefined();
      expect(analytics.averageLoadTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('constructor with defaults', () => {
    it('creates service with only assembler', () => {
      mockAssembler.assemble.mockResolvedValue(mockSnapshot);
      const service = new DashboardSnapshotService(mockAssembler as never);
      expect(service).toBeDefined();
      expect(service.getCacheMetrics).toBeDefined();
      expect(service.getAnalytics).toBeDefined();
    });
  });
});
