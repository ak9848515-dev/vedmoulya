// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Orchestration Test
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { LifeOSDTOMapper } from '../LifeOSDTOMapper.js';
import { LifeOSViewModelFactory } from '../LifeOSViewModelFactory.js';
import { LifeOSSnapshotService } from '../LifeOSSnapshotService.js';
import { LifeOSApplicationService } from '../LifeOSApplicationService.js';
import { LifeOSAssembler } from '../LifeOSAssembler.js';
import type { LifeOSSnapshotDTO, LifeOSTimelineEntryDTO } from '../LifeOSDTO.js';

function createMockModuleServices() {
  return {
    dashboard: {
      getDashboard: vi.fn().mockResolvedValue({
        data: {
          identity: {
            displayName: 'Test User',
            email: 'test@test.com',
            role: 'Developer',
            purpose: 'Build',
            primaryGoal: 'Success',
            currentJourney: 'Growth',
            avatarUrl: '',
          },
          focus: {
            missionLabel: 'Ship Feature',
            missionDescription: 'Complete the feature',
            isBlocked: false,
          },
          execution: {
            activePlans: 2,
            blockedPlans: 0,
            completedToday: 3,
            totalEstimatedMinutes: 120,
            recoverySuggestions: [],
          },
          decisions: { pendingDecisions: 2, averageConfidence: 0.8, highRiskDecisions: 0 },
          quickActions: [],
          notifications: [],
        },
      }),
    },
    career: {
      getCareer: vi.fn().mockResolvedValue({
        data: {
          currentRole: 'Senior Dev',
          roadmap: { progress: 70 },
          skillGaps: [{ skill: 'AWS' }],
        },
      }),
    },
    learning: {
      getLearning: vi
        .fn()
        .mockResolvedValue({ data: { activePaths: [{ name: 'React', progress: 80 }] } }),
    },
    business: {
      getBusiness: vi.fn().mockResolvedValue({
        data: {
          goals: [{ title: 'Increase Revenue' }],
          risks: [],
          kpis: [{ currentValue: 50, targetValue: 100 }],
          projects: [],
          metrics: { businessScore: 80 },
        },
      }),
    },
    marketplace: { getMarketplace: vi.fn().mockResolvedValue({ data: { availableUpdates: [] } }) },
    identity: { getUserById: vi.fn().mockResolvedValue({ id: 'u1' }) },
    memory: { getStats: vi.fn().mockResolvedValue({}) },
    decision: { getStats: vi.fn().mockResolvedValue({}) },
    execution: { getStats: vi.fn().mockResolvedValue({}) },
    knowledge: { getStats: vi.fn().mockResolvedValue({}) },
    ai: { orchestrate: vi.fn().mockResolvedValue({ success: true, data: {} }) },
  };
}

describe('LifeOSDTOMapper', () => {
  it('toUnifiedTimeline returns correct DTO', () => {
    const mapper = new LifeOSDTOMapper();
    const timeline = mapper.toUnifiedTimeline([], 'today');
    expect(timeline.totalEntries).toBe(0);
    expect(timeline.hasMore).toBe(false);
    expect(timeline.filter).toBe('today');
  });
  it('toUnifiedTimeline hasMore true for 50+ entries', () => {
    const mapper = new LifeOSDTOMapper();
    const entries: LifeOSTimelineEntryDTO[] = Array.from({ length: 50 }, (_, i) => ({
      id: `${i}`,
      type: 'milestone',
      title: `E${i}`,
      description: '',
      timestamp: new Date().toISOString(),
      importance: 5,
      icon: 'star',
      source: 'dashboard' as any,
    }));
    expect(mapper.toUnifiedTimeline(entries).hasMore).toBe(true);
  });
  it('createPlatformHealth sets overall based on module status', () => {
    const mapper = new LifeOSDTOMapper();
    const health = mapper.createPlatformHealth([
      {
        name: 'dashboard' as any,
        status: 'healthy',
        latency: 10,
        lastChecked: new Date().toISOString(),
      },
      { name: 'career' as any, status: 'down', latency: 0, lastChecked: new Date().toISOString() },
    ]);
    expect(health.overall).toBe('critical');
    expect(health.integrationStatus.failedModules).toBe(1);
  });
  it('createPlatformHealth handles degraded', () => {
    const mapper = new LifeOSDTOMapper();
    const health = mapper.createPlatformHealth([
      {
        name: 'dashboard' as any,
        status: 'degraded',
        latency: 500,
        lastChecked: new Date().toISOString(),
      },
    ]);
    expect(health.overall).toBe('degraded');
  });
  it('createPriority creates priority DTO', () => {
    const mapper = new LifeOSDTOMapper();
    const p = mapper.createPriority('p1', 'Test', 'Desc', 'dashboard', 1, 'goal', true);
    expect(p.id).toBe('p1');
    expect(p.isBlocked).toBe(true);
    expect(p.source).toBe('dashboard');
  });
  it('createPriority without blocked defaults', () => {
    const mapper = new LifeOSDTOMapper();
    const p = mapper.createPriority('p2', 'Test', 'Desc', 'career', 2, 'career');
    expect(p.isBlocked).toBe(false);
  });
});

describe('LifeOSViewModelFactory', () => {
  it('createModuleCardViewModel extracts module summary', () => {
    const factory = new LifeOSViewModelFactory();
    const card = factory.createModuleCardViewModel({
      module: 'dashboard',
      status: 'available',
      summary: 'OK',
      metrics: { tasks: 5 },
      lastUpdated: new Date().toISOString(),
      hasNotifications: true,
      notificationCount: 2,
    });
    expect(card.module).toBe('dashboard');
    expect(card.hasNotifications).toBe(true);
  });
  it('createPriorityListViewModel sorts by priority', () => {
    const factory = new LifeOSViewModelFactory();
    const list = factory.createPriorityListViewModel([
      {
        id: 'p2',
        title: 'B',
        description: '',
        source: 'dashboard' as any,
        priority: 2,
        isBlocked: false,
        category: 'goal',
      },
      {
        id: 'p1',
        title: 'A',
        description: '',
        source: 'career' as any,
        priority: 1,
        isBlocked: true,
        category: 'career',
      },
    ]);
    expect(list.items[0].id).toBe('p1');
    expect(list.blockedCount).toBe(1);
    expect(list.totalCount).toBe(2);
  });
  it('createSearchSummaryViewModel extracts categories', () => {
    const factory = new LifeOSViewModelFactory();
    const results = [
      {
        id: '1',
        category: 'skill' as any,
        title: 'TS',
        description: '',
        confidence: 0.9,
        source: 'learning' as any,
        deepLink: '/a',
        timestamp: '',
        tags: [],
      },
      {
        id: '2',
        category: 'goal' as any,
        title: 'Rev',
        description: '',
        confidence: 0.8,
        source: 'business' as any,
        deepLink: '/b',
        timestamp: '',
        tags: [],
      },
    ];
    const summary = factory.createSearchSummaryViewModel(results);
    expect(summary.totalResults).toBe(2);
    expect(summary.categories).toContain('skill');
    expect(summary.topResult?.id).toBe('1');
  });
  it('createDashboardViewModel creates view model from snapshot', () => {
    const factory = new LifeOSViewModelFactory();
    const snapshot = {
      id: 's1',
      userId: 'u1',
      generatedAt: new Date().toISOString(),
      ttl: 300_000,
      identity: {
        displayName: 'Test',
        email: '',
        role: '',
        purpose: '',
        primaryGoal: '',
        currentJourney: '',
        greeting: 'Hi!',
        avatarUrl: '',
      },
      dashboard: {
        module: 'dashboard' as any,
        status: 'available',
        summary: 'OK',
        metrics: {},
        lastUpdated: '',
        hasNotifications: false,
        notificationCount: 0,
      },
      career: {
        module: 'career' as any,
        status: 'available',
        summary: 'OK',
        metrics: {},
        lastUpdated: '',
        hasNotifications: false,
        notificationCount: 0,
      },
      learning: {
        module: 'learning' as any,
        status: 'available',
        summary: 'OK',
        metrics: {},
        lastUpdated: '',
        hasNotifications: false,
        notificationCount: 0,
      },
      business: {
        module: 'business' as any,
        status: 'available',
        summary: 'OK',
        metrics: {},
        lastUpdated: '',
        hasNotifications: false,
        notificationCount: 0,
      },
      marketplace: {
        module: 'marketplace' as any,
        status: 'available',
        summary: 'OK',
        metrics: {},
        lastUpdated: '',
        hasNotifications: false,
        notificationCount: 0,
      },
      memory: {
        totalMemories: 0,
        recentCount: 0,
        importantEvents: 0,
        aiObservations: [],
        reflectionPrompts: [],
      },
      decisions: {
        pendingDecisions: 0,
        decisionsToday: 0,
        averageConfidence: 0,
        highRiskCount: 0,
        topPending: [],
      },
      execution: {
        activePlans: 0,
        blockedPlans: 0,
        completedToday: 0,
        totalEstimatedMinutes: 0,
        recoverySuggestions: [],
      },
      knowledge: { totalNodes: 0, recentNodes: 0, topCategories: [], lastUpdated: undefined },
      priorities: [],
      unifiedTimeline: { entries: [], totalEntries: 0, hasMore: false, filter: 'all' },
      crossDomainRecommendations: [],
      globalNotifications: [],
      quickActions: [],
      searchResults: [],
      platformHealth: {
        overall: 'healthy' as any,
        modules: [],
        cacheStatus: { totalEntries: 0, hitRate: 0, memoryUsage: 0 },
        performance: {
          snapshotGeneration: 0,
          searchLatency: 0,
          timelineMerge: 0,
          recommendationLatency: 0,
        },
        integrationStatus: { totalModules: 0, connectedModules: 0, failedModules: 0 },
        providerStatus: { total: 0, active: 0, errorRate: 0 },
      },
      metrics: {
        lifeScore: 0,
        moduleEngagement: {},
        totalNotifications: 0,
        unreadNotifications: 0,
        totalRecommendations: 0,
        activeRecommendations: 0,
        searchPerformed: 0,
        timelineEntries: 0,
        quickActionsUsed: 0,
      },
      aiContext: {
        currentFocus: '',
        recentActivity: [],
        suggestedQuestions: [],
        contextSummary: '',
        topPriorities: [],
        crossDomainInsights: [],
      },
    } as unknown as LifeOSSnapshotDTO;
    const vm = factory.createDashboardViewModel(snapshot);
    expect(vm.greeting).toContain('Test');
    expect(vm.moduleCards.length).toBe(5);
  });
});

describe('LifeOSAssembler', () => {
  it('assemble returns complete snapshot', async () => {
    const mocks = createMockModuleServices();
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1');
    expect(snapshot.id).toContain('losnap_');
    expect(snapshot.userId).toBe('u1');
    expect(snapshot.identity.displayName).toBe('Test User');
    expect(snapshot.dashboard.status).toBe('available');
    expect(snapshot.career.status).toBe('available');
    expect(snapshot.learning.status).toBe('available');
    expect(snapshot.business.status).toBe('available');
    expect(snapshot.marketplace.status).toBe('available');
    expect(snapshot.platformHealth.overall).toBe('healthy');
  });

  it('assemble handles module failures gracefully', async () => {
    const mocks = createMockModuleServices();
    mocks.business.getBusiness.mockRejectedValue(new Error('Down'));
    mocks.marketplace.getMarketplace.mockRejectedValue(new Error('Down'));
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1');
    expect(snapshot.business.status).toBe('unavailable');
    expect(snapshot.marketplace.status).toBe('unavailable');
    expect(snapshot.identity.displayName).toBe('Test User');
  });

  it('safeCall handles non-Error thrown values', async () => {
    const mocks = createMockModuleServices();
    mocks.dashboard.getDashboard.mockRejectedValue('String error'); // non-Error throw
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1');
    expect(snapshot.dashboard.status).toBe('unavailable');
    expect(snapshot.career.status).toBe('available');
  });

  it('assemble handles critical risks', async () => {
    const mocks = createMockModuleServices();
    mocks.business.getBusiness.mockResolvedValue({
      data: {
        goals: [{ title: 'Ship' }],
        risks: [{ riskScore: 20, description: 'Major risk' }],
        kpis: [],
        projects: [],
        skillGaps: [],
        activePaths: [],
        currentRole: 'Dev',
        metrics: { businessScore: 50 },
      },
    });
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1');
    expect(
      snapshot.crossDomainRecommendations.some((r) => r.category === 'Decision + Dashboard'),
    ).toBe(true);
  });

  it('assemble handles blocked projects', async () => {
    const mocks = createMockModuleServices();
    mocks.career.getCareer.mockResolvedValue({
      data: { currentRole: 'Senior Dev', roadmap: { progress: 70 }, skillGaps: [] },
    });
    mocks.business.getBusiness.mockResolvedValue({
      data: {
        goals: [{ title: 'Ship' }],
        projects: [{ name: 'Project X', status: 'blocked' }],
        risks: [],
        kpis: [],
        skillGaps: [],
        metrics: { businessScore: 80 },
      },
    });
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1');
    expect(
      snapshot.crossDomainRecommendations.some((r) => r.category === 'Career + Projects'),
    ).toBe(true);
  });

  it('assemble handles learning with empty paths', async () => {
    const mocks = createMockModuleServices();
    mocks.learning.getLearning.mockResolvedValue({ data: { activePaths: [] } });
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1');
    expect(snapshot.learning.status).toBe('available');
  });

  it('service accessors return correct instances', () => {
    const mocks = createMockModuleServices();
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    expect(assembler.getNavigationService()).toBeDefined();
    expect(assembler.getSearchService()).toBeDefined();
    expect(assembler.getTimelineService()).toBeDefined();
    expect(assembler.getRecommendationService()).toBeDefined();
    expect(assembler.getNotificationService()).toBeDefined();
    expect(assembler.getQuickActionService()).toBeDefined();
    expect(assembler.getInsightService()).toBeDefined();
  });
});

describe('LifeOSSnapshotService — Edge Cases', () => {
  it('warmCache returns true on success', async () => {
    const mocks = createMockModuleServices();
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const { LifeOSCacheService } = await import('../LifeOSCacheService.js');
    const { LifeOSConfigurationService } = await import('../LifeOSConfigurationService.js');
    const { LifeOSAnalyticsService } = await import('../LifeOSAnalyticsService.js');
    const svc = new LifeOSSnapshotService(
      assembler,
      new LifeOSCacheService(),
      new LifeOSConfigurationService(),
      new LifeOSAnalyticsService(),
    );
    expect(await svc.warmCache('u1')).toBe(true);
  });

  it('refreshModule re-fetches snapshot', async () => {
    const mocks = createMockModuleServices();
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const { LifeOSCacheService } = await import('../LifeOSCacheService.js');
    const { LifeOSConfigurationService } = await import('../LifeOSConfigurationService.js');
    const { LifeOSAnalyticsService } = await import('../LifeOSAnalyticsService.js');
    const svc = new LifeOSSnapshotService(
      assembler,
      new LifeOSCacheService(),
      new LifeOSConfigurationService(),
      new LifeOSAnalyticsService(),
    );
    const result = await svc.refreshModule('u1', 'dashboard');
    expect(result.success).toBe(true);
  });

  it('getCacheMetrics returns cache stats', async () => {
    const mocks = createMockModuleServices();
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const { LifeOSCacheService } = await import('../LifeOSCacheService.js');
    const { LifeOSConfigurationService } = await import('../LifeOSConfigurationService.js');
    const { LifeOSAnalyticsService } = await import('../LifeOSAnalyticsService.js');
    const svc = new LifeOSSnapshotService(
      assembler,
      new LifeOSCacheService(),
      new LifeOSConfigurationService(),
      new LifeOSAnalyticsService(),
    );
    const metrics = svc.getCacheMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.totalEntries).toBe(0);
  });

  // ── SnapshotService error path tests (mock assembler throws) ─────
  it('getSnapshot catches assembler error and returns failure', async () => {
    const { LifeOSCacheService } = await import('../LifeOSCacheService.js');
    const { LifeOSConfigurationService } = await import('../LifeOSConfigurationService.js');
    const { LifeOSAnalyticsService } = await import('../LifeOSAnalyticsService.js');
    const mockAssembler = {
      assemble: vi.fn().mockRejectedValue(new Error('Assembler crashed')),
    } as any;
    const svc = new LifeOSSnapshotService(
      mockAssembler,
      new LifeOSCacheService(),
      new LifeOSConfigurationService(),
      new LifeOSAnalyticsService(),
    );
    const result = await svc.getSnapshot('u1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Assembler crashed');
  });

  // warmCache catch is architecturally unreachable: getSnapshot() has its own
  // try/catch that catches all errors before warmCache sees them. Classified D.
  // See warmCache returns true even when assembler fails (getSnapshot handles it)
  it('warmCache returns true even with failed assembler', async () => {
    const { LifeOSCacheService } = await import('../LifeOSCacheService.js');
    const { LifeOSConfigurationService } = await import('../LifeOSConfigurationService.js');
    const { LifeOSAnalyticsService } = await import('../LifeOSAnalyticsService.js');
    const mockAssembler = { assemble: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    const svc = new LifeOSSnapshotService(
      mockAssembler,
      new LifeOSCacheService(),
      new LifeOSConfigurationService(),
      new LifeOSAnalyticsService(),
    );
    // getSnapshot catches error internally, returns { success: false }, no throw → warmCache sees success
    expect(await svc.warmCache('u1')).toBe(true);
  });

  // ── Assembler edge-case branch tests ─────────────────────────────
  // ── All-modules-failure test ──────────────────────────────────────
  // Exercises ALL `success ? data : undefined` false branches, ALL
  // `businessData ? helper(data) : default` else branches, ALL health
  // 'degraded' branches, and the priorities/insight fallbacks
  it('assemble uses all fallback branches when all modules fail', async () => {
    const mocks = createMockModuleServices();
    mocks.dashboard.getDashboard.mockRejectedValue(new Error('fail'));
    mocks.career.getCareer.mockRejectedValue(new Error('fail'));
    mocks.learning.getLearning.mockRejectedValue(new Error('fail'));
    mocks.business.getBusiness.mockRejectedValue(new Error('fail'));
    mocks.marketplace.getMarketplace.mockRejectedValue(new Error('fail'));
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1');
    // All modules unavailable (data undefined → buildModuleSummary returns 'unavailable')
    expect(snapshot.dashboard.status).toBe('unavailable');
    expect(snapshot.career.status).toBe('unavailable');
    expect(snapshot.learning.status).toBe('unavailable');
    expect(snapshot.business.status).toBe('unavailable');
    expect(snapshot.marketplace.status).toBe('unavailable');
    // Health reports degraded for all (success false → 'degraded')
    expect(snapshot.platformHealth.overall).toBe('degraded');
    // Identity uses all fallback values
    expect(snapshot.identity.displayName).toBe('User');
    expect(snapshot.identity.email).toBe('');
    expect(snapshot.identity.greeting).toContain('User');
    // All decision/execution stats default to 0
    expect(snapshot.decisions.pendingDecisions).toBe(0);
    expect(snapshot.execution.activePlans).toBe(0);
    expect(snapshot.execution.completedToday).toBe(0);
    // Priorities empty (no data to build from)
    expect(snapshot.priorities.length).toBe(0);
    // AI context uses fallback focus
    expect(snapshot.aiContext.currentFocus).toBe('Getting started with Life OS');
  });

  // ── Null sub-fields test ───────────────────────────────────────────
  // Exercises `??` and `?.` fallbacks for nested optional chaining
  // that are NOT hit when all modules fail (different code paths)
  it('assemble uses sub-field fallbacks when nested properties are missing', async () => {
    const mocks = createMockModuleServices();
    mocks.dashboard.getDashboard.mockResolvedValue({
      data: {
        identity: { displayName: 'Test User' }, // only displayName, no other fields
        focus: {},
        execution: {},
        decisions: {}, // empty objects → optional chains fail
        quickActions: [],
        notifications: [],
      },
    });
    mocks.career.getCareer.mockResolvedValue({ data: {} } as any); // no roadmap, currentRole, skillGaps
    mocks.learning.getLearning.mockResolvedValue({ data: {} } as any); // no activePaths
    mocks.business.getBusiness.mockResolvedValue({ data: {} } as any);
    mocks.marketplace.getMarketplace.mockResolvedValue({ data: {} } as any);
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1');
    // Sub-field fallbacks
    expect(snapshot.identity.email).toBe('');
    expect(snapshot.identity.role).toBe('');
    expect(snapshot.identity.purpose).toBe('');
    expect(snapshot.decisions.pendingDecisions).toBe(0);
    expect(snapshot.execution.activePlans).toBe(0);
    expect(snapshot.priorities.length).toBe(0);
    expect(snapshot.aiContext.currentFocus).toBe('Getting started with Life OS');
  });

  it('assemble uses fallback displayName when identity fields are null', async () => {
    const mocks = createMockModuleServices();
    mocks.dashboard.getDashboard.mockResolvedValue({
      data: {
        identity: null,
        focus: null,
        execution: null,
        decisions: null,
        quickActions: [],
        notifications: [],
      },
    });
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1');
    expect(snapshot.identity.displayName).toBe('User');
    expect(snapshot.identity.greeting).toContain('User');
    expect(snapshot.decisions.pendingDecisions).toBe(0);
    expect(snapshot.execution.activePlans).toBe(0);
  });
});

describe('LifeOSSnapshotService', () => {
  it('getSnapshot returns snapshot from assembler', async () => {
    const mocks = createMockModuleServices();
    const assembler = new LifeOSAssembler(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const { LifeOSCacheService } = await import('../LifeOSCacheService.js');
    const { LifeOSConfigurationService } = await import('../LifeOSConfigurationService.js');
    const { LifeOSAnalyticsService } = await import('../LifeOSAnalyticsService.js');
    const svc = new LifeOSSnapshotService(
      assembler,
      new LifeOSCacheService(),
      new LifeOSConfigurationService(),
      new LifeOSAnalyticsService(),
    );
    const result = await svc.getSnapshot('u1');
    expect(result.success).toBe(true);
    expect(result.data?.userId).toBe('u1');
  });
});

describe('LifeOSApplicationService', () => {
  it('getLifeOS returns snapshot', async () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const result = await svc.getLifeOS('u1');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('getLifeOSViewModel returns view model', async () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const result = await svc.getLifeOSViewModel('u1');
    expect(result.success).toBe(true);
    expect(result.data?.moduleCards.length).toBe(5);
  });

  it('caches second snapshot call', async () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    await svc.getLifeOS('u1');
    await svc.getLifeOS('u1');
    expect(mocks.dashboard.getDashboard).toHaveBeenCalledTimes(1);
  });

  it('invalidateCache clears cache', async () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    await svc.getLifeOS('u1');
    svc.invalidateCache('u1');
    await svc.getLifeOS('u1');
    expect(mocks.dashboard.getDashboard).toHaveBeenCalledTimes(2);
  });

  it('globalSearch returns results', async () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    svc.indexSearchItems([
      {
        id: '1',
        category: 'skill',
        title: 'TypeScript',
        description: 'Lang',
        confidence: 0.9,
        source: 'learning',
        deepLink: '/learn',
        timestamp: new Date().toISOString(),
        tags: ['ts'],
      },
    ]);
    const results = await svc.globalSearch('typescript');
    expect(results.length).toBe(1);
  });

  it('getConfig returns configuration', () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const config = svc.getConfig('u1');
    expect(config.enabledModules).toContain('dashboard');
  });

  it('getNavigation returns nav items', () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const nav = svc.getNavigation({ dashboard: 3 });
    expect(nav.length).toBe(5);
    expect(nav[0].badge).toBe(3);
  });

  it('indexSearchItems indexes items for later search', async () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    svc.indexSearchItems([
      {
        id: 'test',
        category: 'skill' as any,
        title: 'Testing',
        description: '',
        confidence: 0.9,
        source: 'learning' as any,
        deepLink: '/test',
        timestamp: new Date().toISOString(),
        tags: [],
      },
    ]);
    const results = await svc.globalSearch('testing');
    expect(results.length).toBe(1);
  });

  it('updateConfig and resetConfig work correctly', () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    svc.getConfig('u1');
    const updated = svc.updateConfig('u1', { enableGlobalSearch: false });
    expect(updated.enableGlobalSearch).toBe(false);
    const reset = svc.resetConfig('u1');
    expect(reset.enableGlobalSearch).toBe(true);
  });

  it('reportModuleHealth and isHealthy work', () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    svc.reportModuleHealth('dashboard', 'healthy', 10);
    expect(svc.isHealthy()).toBe(true);
    svc.reportModuleHealth('career', 'degraded', 200);
    expect(svc.isHealthy()).toBe(false);
  });

  it('getAnalytics and getCacheMetrics return data', () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    expect(svc.getAnalytics()).toBeDefined();
    expect(svc.getCacheMetrics()).toBeDefined();
  });

  // ── Performance Benchmarks ───────────────────────────────────────

  it('performance: snapshot generation completes under 500ms', async () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const start = performance.now();
    await svc.getLifeOS('u1');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('performance: cached snapshot completes under 150ms', async () => {
    const mocks = createMockModuleServices();
    const svc = new LifeOSApplicationService(
      mocks.dashboard as any,
      mocks.career as any,
      mocks.learning as any,
      mocks.business as any,
      mocks.marketplace as any,
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    // Prime the cache
    await svc.getLifeOS('u1');
    // Measure cached hit
    const start = performance.now();
    await svc.getLifeOS('u1');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(150);
  });
});
