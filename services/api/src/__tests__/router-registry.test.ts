// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Router Registry & Application Service Tests
// Covers createAppRouter happy-paths through the real tRPC pipeline
// (auth + rate-limit middleware + every handler), rate-limit rejection,
// the ApiApplicationService wiring, and the MetricsRouter snapshot.
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { createAppRouter, t } from '../services/RouterRegistry.js';
import { ApiApplicationService } from '../services/ApiApplicationService.js';
import { createMetricsRouter } from '../routers/MetricsRouter.js';
import { metrics, metricsSnapshotJson } from '@vedmoulya/core';
import type { LifeOSApplicationService, DashboardApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';

// NOTE: userIds are namespaced (rr-*) so they never collide with the module-level
// GLOBAL_LIMITS map in middleware/rate-limit.ts used by other test files.
const testCtx: TRPCContext = { userId: 'rr-t-user', email: 'rr@vedmoulya.com', role: 'user' };

// ── Mock Service Factories (mirror routers.test.ts proven shapes) ───────────

function createMockLifeOS(): LifeOSApplicationService {
  return {
    isHealthy: () => true,
    getLifeOS: async () => ({
      success: true,
      data: {
        id: 'snap-1',
        userId: 'rr-t-user',
        generatedAt: new Date().toISOString(),
        ttl: 30000,
      },
      latency: 5,
    }),
    getLifeOSViewModel: async () => ({
      success: true,
      data: {
        id: 'vm-1',
        userId: 'rr-t-user',
        generatedAt: new Date().toISOString(),
        sections: [],
      },
      latency: 3,
    }),
    globalSearch: async () => [
      {
        id: 'result-1',
        category: 'skill' as const,
        title: 'TypeScript',
        description: 'TypeScript skill match',
        confidence: 0.95,
        source: 'career' as const,
        deepLink: '/career/skills/typescript',
        timestamp: new Date().toISOString(),
        tags: ['typescript'],
      },
    ],
    getCacheMetrics: () => ({
      totalEntries: 10,
      hitRate: 0.8,
      missRate: 0.2,
      averageLatency: 2,
      memoryUsage: 1024,
    }),
    invalidateCache: () => {},
    getNavigation: () => [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        route: '/dashboard',
        priority: 1,
      },
    ],
    getConfig: () => ({
      userId: 'rr-t-user',
      enabledModules: ['dashboard', 'career', 'learning', 'business', 'marketplace'],
      timelineDefaultFilter: 'today' as const,
      notificationPriorityThreshold: 5,
      maxRecommendations: 5,
      enableCrossDomainInsights: true,
      enableGlobalSearch: true,
      cacheTTL: 30000,
      refreshInterval: 60000,
    }),
    updateConfig: () => ({
      userId: 'rr-t-user',
      enabledModules: ['dashboard', 'career', 'learning', 'business', 'marketplace'],
      timelineDefaultFilter: 'today' as const,
      notificationPriorityThreshold: 5,
      maxRecommendations: 5,
      enableCrossDomainInsights: true,
      enableGlobalSearch: true,
      cacheTTL: 60000,
      refreshInterval: 60000,
    }),
    resetConfig: () => ({
      userId: 'rr-t-user',
      enabledModules: ['dashboard', 'career', 'learning', 'business', 'marketplace'],
      timelineDefaultFilter: 'today' as const,
      notificationPriorityThreshold: 5,
      maxRecommendations: 5,
      enableCrossDomainInsights: true,
      enableGlobalSearch: true,
      cacheTTL: 30000,
      refreshInterval: 60000,
    }),
    reportModuleHealth: () => {},
    getAnalytics: () => ({
      totalSearches: 42,
      averageResponseTime: 15,
      topQueries: ['typescript'],
    }),
    indexSearchItems: () => {},
  } as LifeOSApplicationService;
}

function createMockDashboard(): DashboardApplicationService {
  return {
    getDashboard: async () => ({
      success: true,
      data: {
        identity: { displayName: 'Test User', role: 'Developer', greeting: 'Hello' },
        metrics: {
          lifeScore: 76,
          goalProgress: 60,
          executionRate: 80,
          consistency: 70,
          momentum: 65,
          streak: 5,
          weeklyCompletion: 4,
          monthlyCompletion: 15,
        },
        notifications: [
          {
            id: 'notif-1',
            type: 'info' as const,
            title: 'Welcome',
            message: 'Welcome back',
            isRead: false,
            priority: 5,
            createdAt: new Date().toISOString(),
          },
        ],
        decisions: { pending: 2, confidence: 78, highRisk: 1 },
      },
      latency: 10,
    }),
    getDashboardViewModel: async () => ({ success: true, data: {}, latency: 3 }),
    getIdentity: async () => ({
      success: true,
      data: { displayName: 'Test User', role: 'Developer' },
      latency: 2,
    }),
    getFocus: async () => ({
      success: true,
      data: { title: 'Complete Project', description: 'Finish the milestone' },
      latency: 2,
    }),
    getExecution: async () => ({
      success: true,
      data: { activePlans: 3, completedToday: 2, blockedPlans: 0 },
      latency: 3,
    }),
    getDecisions: async () => ({
      success: true,
      data: { pending: 2, confidence: 78, highRisk: 1 },
      latency: 2,
    }),
    getMemory: async () => ({ success: true, data: { total: 142, recent: 5 }, latency: 2 }),
    getGrowth: async () => ({ success: true, data: { learning: 3, career: 2 }, latency: 2 }),
    getJourney: async () => ({ success: true, data: { day: 1, week: 5 }, latency: 2 }),
    getInsights: async () => ({
      success: true,
      data: [{ id: 'i-1', type: 'achievement', message: 'Completed 5 tasks' }],
      latency: 3,
    }),
    getRecommendations: async () => ({
      success: true,
      data: [{ id: 'r-1', title: 'Learn TypeScript', priority: 8 }],
      latency: 3,
    }),
    getHealth: async () => ({ success: true, data: { status: 'healthy' }, latency: 2 }),
    getMetrics: async () => ({
      success: true,
      data: { lifeScore: 76, goalProgress: 60, executionRate: 80 },
      latency: 2,
    }),
    refreshSection: async () => ({ success: true, data: {}, latency: 5 }),
    invalidateCache: () => {},
    getConfig: () => ({ theme: 'dark', notifications: true }),
    updateConfig: () => ({ theme: 'dark', notifications: true }),
    dismissNotification: () => [],
  } as unknown as DashboardApplicationService;
}

function createMockIdentity() {
  return {
    getUserById: async (userId: string) => ({
      id: userId,
      displayName: 'Test User',
      email: 't@vedmoulya.com',
      role: 'Developer',
    }),
    updateProfile: async (userId: string) => ({
      id: userId,
      displayName: 'Updated User',
      email: 't@vedmoulya.com',
      role: 'Developer',
    }),
  };
}

function createMockModule() {
  return {
    getCareer: async () => ({
      success: true,
      data: { role: 'Developer', skills: ['TypeScript'] },
      latency: 5,
    }),
    getCareerViewModel: async () => ({ success: true, data: { cards: [] }, latency: 3 }),
    getLearning: async () => ({
      success: true,
      data: { paths: [], currentTopic: 'TypeScript' },
      latency: 5,
    }),
    getLearningViewModel: async () => ({ success: true, data: { cards: [] }, latency: 3 }),
    getBusiness: async () => ({ success: true, data: { goals: [], kpis: [] }, latency: 5 }),
    getBusinessViewModel: async () => ({ success: true, data: { cards: [] }, latency: 3 }),
    getMarketplace: async () => ({
      success: true,
      data: { installed: [], catalog: [] },
      latency: 5,
    }),
    getMarketplaceViewModel: async () => ({ success: true, data: { cards: [] }, latency: 3 }),
    getConfig: () => ({ skillFocus: 'TypeScript' }),
    invalidateCache: () => {},
  };
}

/** Full mock ApiApplicationService shape consumed by createAppRouter. */
function createMockServices() {
  const identity = createMockIdentity();
  const module = createMockModule();
  return {
    identity,
    dashboard: createMockDashboard(),
    career: module,
    learning: module,
    business: module,
    marketplace: module,
    lifeOS: createMockLifeOS(),
    infrastructureHealth: {
      checkDatabase: async () => ({ name: 'database', status: 'not_configured', message: 'probe' }),
      checkRedis: async () => ({ name: 'redis', status: 'not_configured', message: 'probe' }),
    },
    isHealthy: () => true,
  };
}

// ── createAppRouter — real tRPC pipeline happy paths ─────────────────────────

describe('createAppRouter — real pipeline (auth + rate limit + handlers)', () => {
  const router = createAppRouter(createMockServices() as unknown as ApiApplicationService);
  const createCaller = t.createCallerFactory(router);
  const caller = createCaller(testCtx);

  it('exposes all top-level namespaces', () => {
    for (const ns of [
      'health',
      'identity',
      'lifeOS',
      'dashboard',
      'career',
      'learning',
      'business',
      'marketplace',
      'search',
      'notifications',
      'config',
      'metrics',
    ]) {
      expect(router[ns as keyof typeof router]).toBeDefined();
    }
  });

  it('health.check runs the platform health assembly', async () => {
    const result = await caller.health.check();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('healthy');
    expect(result.data.components.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'application',
        'memory',
        'cpu',
        'cache',
        'lifeos',
        'database',
        'redis',
        'ai',
        'queue',
      ]),
    );
    expect(result.data.readiness).toBe('ready');
  });

  it('health.live/ready/version succeed through the pipeline', async () => {
    const live = await caller.health.live();
    expect(live.data.status).toBe('alive');
    const ready = await caller.health.ready();
    expect(ready.data.status).toBe('ready');
    const version = await caller.health.version();
    expect(version.data.modules).toContain('life-os');
  });

  it('identity.getProfile and updateProfile succeed', async () => {
    const profile = await caller.identity.getProfile({ userId: 'rr-t-user' });
    expect(profile.success).toBe(true);
    expect(profile.data.displayName).toBe('Test User');
    const updated = await caller.identity.updateProfile({
      userId: 'rr-t-user',
      updates: { displayName: 'Updated User' },
    });
    expect(updated.success).toBe(true);
  });

  it('lifeOS procedures succeed', async () => {
    const snap = await caller.lifeOS.getSnapshot({ userId: 'rr-t-user' });
    expect(snap.success).toBe(true);
    const vm = await caller.lifeOS.getViewModel({ userId: 'rr-t-user' });
    expect(vm.success).toBe(true);
    const search = await caller.lifeOS.globalSearch({ query: 'TypeScript' });
    expect(search.success).toBe(true);
    expect(search.data).toHaveLength(1);
    const invalidated = await caller.lifeOS.invalidateCache({ userId: 'rr-t-user' });
    expect(invalidated.success).toBe(true);
    const nav = await caller.lifeOS.getNavigation();
    expect(nav.success).toBe(true);
    const config = await caller.lifeOS.updateConfig({
      userId: 'rr-t-user',
      updates: { cacheTTL: 60000 },
    });
    expect(config.success).toBe(true);
    const cache = await caller.lifeOS.getCacheMetrics();
    expect(cache.data.totalEntries).toBe(10);
  });

  it('dashboard procedures succeed', async () => {
    expect((await caller.dashboard.getDashboard({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.dashboard.getViewModel({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.dashboard.getIdentity({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.dashboard.getFocus({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.dashboard.getExecution({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.dashboard.getDecisions({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.dashboard.getInsights({ userId: 'rr-t-user' })).success).toBe(true);
    expect(
      (await caller.dashboard.refreshSection({ userId: 'rr-t-user', sectionId: 'identity' }))
        .success,
    ).toBe(true);
    expect((await caller.dashboard.invalidateCache({ userId: 'rr-t-user' })).success).toBe(true);
  });

  it('module routers (career/learning/business/marketplace) succeed', async () => {
    expect((await caller.career.getCareer({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.career.getConfig({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.learning.getLearning({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.business.getBusiness({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.marketplace.getMarketplace({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.marketplace.invalidateCache({ userId: 'rr-t-user' })).success).toBe(true);
  });

  it('search/notifications/config/metrics procedures succeed', async () => {
    expect((await caller.search.global({ query: 'TypeScript' })).success).toBe(true);
    expect((await caller.search.recent({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.notifications.list({ userId: 'rr-t-user' })).success).toBe(true);
    expect(
      (await caller.notifications.dismiss({ userId: 'rr-t-user', notificationId: 'notif-1' }))
        .success,
    ).toBe(true);
    expect((await caller.config.get({ userId: 'rr-t-user' })).success).toBe(true);
    expect(
      (await caller.config.update({ userId: 'rr-t-user', updates: { theme: 'light' } })).success,
    ).toBe(true);
    expect((await caller.metrics.dashboard({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.metrics.lifecycle({ userId: 'rr-t-user' })).success).toBe(true);
    expect((await caller.metrics.snapshot()).success).toBe(true);
  });
});

// ── Rate Limit Rejection (auth tier: 10 req/min) ────────────────────────────

describe('createAppRouter — rate limit enforcement', () => {
  it('rejects with TOO_MANY_REQUESTS after exhausting the auth tier', async () => {
    const router = createAppRouter(createMockServices() as unknown as ApiApplicationService);
    const createCaller = t.createCallerFactory(router);
    const ctx: TRPCContext = { userId: 'rr-rl-user', email: 'rl@v.com', role: 'user' };
    const caller = createCaller(ctx);

    for (let i = 0; i < 10; i++) {
      const result = await caller.identity.getProfile({ userId: 'rr-rl-user' });
      expect(result.success).toBe(true);
    }
    await expect(caller.identity.getProfile({ userId: 'rr-rl-user' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });
});

// ── ApiApplicationService wiring ─────────────────────────────────────────────

describe('ApiApplicationService', () => {
  it('constructs all infrastructure and domain module services', () => {
    const svc = new ApiApplicationService();
    expect(svc.identity).toBeDefined();
    expect(svc.memory).toBeDefined();
    expect(svc.decision).toBeDefined();
    expect(svc.execution).toBeDefined();
    expect(svc.knowledge).toBeDefined();
    expect(svc.ai).toBeDefined();
    expect(svc.dashboard).toBeDefined();
    expect(svc.career).toBeDefined();
    expect(svc.learning).toBeDefined();
    expect(svc.business).toBeDefined();
    expect(svc.marketplace).toBeDefined();
    expect(svc.lifeOS).toBeDefined();
    expect(svc.infrastructureHealth).toBeDefined();
  });

  it('isHealthy returns true for the dev wiring', () => {
    const svc = new ApiApplicationService();
    expect(svc.isHealthy()).toBe(true);
  });
});

// ── MetricsRouter snapshot (raw registry JSON) ──────────────────────────────

describe('MetricsRouter.snapshot', () => {
  it('returns a serializable snapshot of the metrics registry', () => {
    metrics.increment('api.metrics.snapshot.test');
    metrics.observe('api.metrics.snapshot.latency_ms', 1.5);
    const router = createMetricsRouter(createMockDashboard() as never);
    const result = router.snapshot();
    expect(result.success).toBe(true);
    expect(result.meta.version).toBe('1.0.0');
    // metricsSnapshotJson must produce a JSON-safe structure
    expect(() => JSON.stringify(metricsSnapshotJson(metrics))).not.toThrow();
  });
});
