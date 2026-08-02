// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Router Tests
// Comprehensive tests for all 12 module routers
// BLD-016A — API Gateway & Platform Services — Quality Hardening
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';

// PR-003A: pin the process-metrics snapshot so the HealthRouter cpu/memory
// components are deterministic. cpuUsagePercent() measures process CPU over
// the sub-millisecond interval since the previous getRuntimeInfo() call, so
// in a shared/loaded vitest worker it can spuriously read >=80% (or the heap
// can sit above the 512MB threshold after heavy imports), which flips the
// overall health status to 'degraded' and makes this suite flaky. The router
// logic is what is under test here — not the host OS load.
vi.mock('@vedmoulya/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vedmoulya/core')>();
  return {
    ...actual,
    getRuntimeInfo: () => {
      const info = actual.getRuntimeInfo();
      return {
        ...info,
        cpu: { ...info.cpu, cpuUsagePercent: 0, loadAvg1m: 0 },
        memory: { ...info.memory, heapUsedBytes: 64 * 1024 * 1024 },
      };
    },
  };
});

import { getAppRouter } from '../router.js';
import { t } from '../services/RouterRegistry.js';
import { createHealthRouter } from '../routers/HealthRouter.js';
import { createLifeOSRouter } from '../routers/LifeOSRouter.js';
import { createDashboardRouter } from '../routers/DashboardRouter.js';
import { createCareerRouter } from '../routers/CareerRouter.js';
import { createLearningRouter } from '../routers/LearningRouter.js';
import { createBusinessRouter } from '../routers/BusinessRouter.js';
import { createMarketplaceRouter } from '../routers/MarketplaceRouter.js';
import { createIdentityRouter } from '../routers/IdentityRouter.js';
import { createSearchRouter } from '../routers/SearchRouter.js';
import { createNotificationRouter } from '../routers/NotificationRouter.js';
import { createConfigurationRouter } from '../routers/ConfigurationRouter.js';
import { createMetricsRouter } from '../routers/MetricsRouter.js';
import type { LifeOSApplicationService, DashboardApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';

// ── Test Context ─────────────────────────────────────────────────────────────

const testCtx: TRPCContext = { userId: 'test-user', email: 'test@vedmoulya.com', role: 'user' };

// ── Mock Service Factories ───────────────────────────────────────────────────

function createMockLifeOS(): LifeOSApplicationService {
  return {
    isHealthy: () => true,
    getLifeOS: async () => ({
      success: true,
      data: {
        id: 'snap-1',
        userId: 'test-user',
        generatedAt: new Date().toISOString(),
        ttl: 30000,
      },
      latency: 5,
    }),
    getLifeOSViewModel: async () => ({
      success: true,
      data: {
        id: 'vm-1',
        userId: 'test-user',
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
        tags: ['typescript', 'programming'],
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
      { id: 'career', label: 'Career', icon: 'Briefcase', route: '/career', priority: 2 },
    ],
    getConfig: () => ({
      userId: 'test-user',
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
      userId: 'test-user',
      enabledModules: ['dashboard', 'career', 'learning', 'business', 'marketplace'],
      timelineDefaultFilter: 'today' as const,
      notificationPriorityThreshold: 5,
      maxRecommendations: 5,
      enableCrossDomainInsights: true,
      enableGlobalSearch: true,
      cacheTTL: 30000,
      refreshInterval: 60000,
    }),
    resetConfig: () => ({
      userId: 'test-user',
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
      topQueries: ['typescript', 'react'],
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
      data: { title: 'Complete Project', description: 'Finish the current milestone' },
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

function createMockCareer() {
  return {
    getCareer: async () => ({
      success: true,
      data: { role: 'Developer', skills: ['TypeScript'] },
      latency: 5,
    }),
    getCareerViewModel: async () => ({ success: true, data: { cards: [] }, latency: 3 }),
    getConfig: () => ({ skillFocus: 'TypeScript' }),
    invalidateCache: () => {},
  };
}

function createMockLearning() {
  return {
    getLearning: async () => ({
      success: true,
      data: { paths: [], currentTopic: 'TypeScript' },
      latency: 5,
    }),
    getLearningViewModel: async () => ({ success: true, data: { cards: [] }, latency: 3 }),
    getConfig: () => ({ focusArea: 'Programming' }),
    invalidateCache: () => {},
  };
}

function createMockBusiness() {
  return {
    getBusiness: async () => ({ success: true, data: { goals: [], kpis: [] }, latency: 5 }),
    getBusinessViewModel: async () => ({ success: true, data: { cards: [] }, latency: 3 }),
    getConfig: () => ({ industry: 'Technology' }),
    invalidateCache: () => {},
  };
}

function createMockMarketplace() {
  return {
    getMarketplace: async () => ({
      success: true,
      data: { installed: [], catalog: [] },
      latency: 5,
    }),
    getMarketplaceViewModel: async () => ({ success: true, data: { cards: [] }, latency: 3 }),
    getConfig: () => ({ autoUpdate: true }),
    invalidateCache: () => {},
  };
}

function createMockIdentity() {
  return {
    getUserById: async (userId: string) => ({
      id: 'test-user',
      displayName: 'Test User',
      email: 'test@vedmoulya.com',
      role: 'Developer',
    }),
    updateProfile: async (userId: string, updates: Record<string, unknown>) => ({
      id: 'test-user',
      displayName: 'Updated User',
      email: 'test@vedmoulya.com',
      role: 'Developer',
    }),
  };
}

// Define interfaces for the mock services
interface CareerService {
  getCareer: (
    userId: string,
  ) => Promise<{ success: boolean; data?: Record<string, unknown>; latency: number }>;
  getCareerViewModel: (
    userId: string,
  ) => Promise<{ success: boolean; data?: Record<string, unknown>; latency: number }>;
  getConfig: (userId: string) => Record<string, unknown>;
  invalidateCache: (userId: string) => void;
}

interface LearningService {
  getLearning: (
    userId: string,
  ) => Promise<{ success: boolean; data?: Record<string, unknown>; latency: number }>;
  getLearningViewModel: (
    userId: string,
  ) => Promise<{ success: boolean; data?: Record<string, unknown>; latency: number }>;
  getConfig: (userId: string) => Record<string, unknown>;
  invalidateCache: (userId: string) => void;
}

interface BusinessService {
  getBusiness: (
    userId: string,
  ) => Promise<{ success: boolean; data?: Record<string, unknown>; latency: number }>;
  getBusinessViewModel: (
    userId: string,
  ) => Promise<{ success: boolean; data?: Record<string, unknown>; latency: number }>;
  getConfig: (userId: string) => Record<string, unknown>;
  invalidateCache: (userId: string) => void;
}

interface MarketplaceService {
  getMarketplace: (
    userId: string,
  ) => Promise<{ success: boolean; data?: Record<string, unknown>; latency: number }>;
  getMarketplaceViewModel: (
    userId: string,
  ) => Promise<{ success: boolean; data?: Record<string, unknown>; latency: number }>;
  getConfig: (userId: string) => Record<string, unknown>;
  invalidateCache: (userId: string) => void;
}

interface IdentityService {
  getUserById: (userId: string) => Promise<Record<string, unknown>>;
  updateProfile: (
    userId: string,
    updates: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
}

// ── Health Router ───────────────────────────────────────────────────────────

describe('HealthRouter', () => {
  const router = createHealthRouter(createMockLifeOS());

  it('check returns healthy status', async () => {
    const result = await router.check();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('healthy');
    expect(result.data.version).toBe('1.0.0');
    expect(result.data.uptime).toBeGreaterThan(0);
  });

  it('live returns alive', async () => {
    const result = await router.live();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('alive');
    expect(result.data.timestamp).toBeDefined();
  });

  it('ready returns ready', async () => {
    const result = await router.ready();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('ready');
  });

  it('version returns all 12 modules', async () => {
    const result = await router.version();
    expect(result.success).toBe(true);
    expect(result.data.version).toBe('1.0.0');
    expect(result.data.modules).toContain('life-os');
    expect(result.data.modules).toContain('career');
    expect(result.data.modules).toContain('learning');
    expect(result.data.modules).toContain('identity');
    expect(result.data.modules).toContain('dashboard');
  });

  it('check returns degraded when service unhealthy', async () => {
    const unhealthy = createMockLifeOS();
    vi.spyOn(unhealthy, 'isHealthy').mockReturnValue(false);
    const router2 = createHealthRouter(unhealthy);
    const result = await router2.check();
    expect(result.data.status).toBe('degraded');
  });
});

// ── Identity Router ─────────────────────────────────────────────────────────

describe('IdentityRouter', () => {
  const svc = createMockIdentity() as unknown as IdentityService;
  const router = createIdentityRouter(svc as never);

  it('getProfile returns user data', async () => {
    const result = await router.getProfile('test-user');
    expect(result.success).toBe(true);
    expect(result.data.displayName).toBe('Test User');
    expect(result.data.email).toBe('test@vedmoulya.com');
    expect(result.meta.version).toBe('1.0.0');
  });

  it('updateProfile returns updated user', async () => {
    const result = await router.updateProfile('test-user', { displayName: 'Updated User' });
    expect(result.success).toBe(true);
    expect(result.data.displayName).toBe('Updated User');
    expect(result.meta.version).toBe('1.0.0');
  });
});

// ── Life OS Router ──────────────────────────────────────────────────────────

describe('LifeOSRouter', () => {
  const router = createLifeOSRouter(createMockLifeOS());

  it('getSnapshot returns snapshot data', async () => {
    const result = await router.getSnapshot({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('snap-1');
  });

  it('getViewModel returns view model', async () => {
    const result = await router.getViewModel({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('vm-1');
  });

  it('globalSearch returns results without as never casts', async () => {
    const result = await router.globalSearch(
      { query: 'TypeScript', categories: ['skill'], sources: ['career'], maxResults: 10 },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.confidence).toBe(0.95);
  });

  it('globalSearch handles empty categories and sources', async () => {
    const result = await router.globalSearch({ query: 'testing' }, testCtx);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('invalidateCache returns success', async () => {
    const result = await router.invalidateCache({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.message).toBe('Cache invalidated');
  });

  it('getNavigation returns navigation items', async () => {
    const result = await router.getNavigation(undefined, testCtx);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('getConfig returns user config', async () => {
    const result = await router.getConfig({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.enabledModules).toContain('dashboard');
  });

  it('updateConfig updates and returns config', async () => {
    const result = await router.updateConfig(
      { userId: 'test-user', updates: { cacheTTL: 60000 } },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.enabledModules).toBeDefined();
  });

  it('getCacheMetrics returns metrics', async () => {
    const result = await router.getCacheMetrics(undefined, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.totalEntries).toBe(10);
    expect(result.data.hitRate).toBe(0.8);
  });
});

// ── Dashboard Router ────────────────────────────────────────────────────────

describe('DashboardRouter', () => {
  const router = createDashboardRouter(createMockDashboard() as never);

  it('getDashboard returns dashboard data', async () => {
    const result = await router.getDashboard({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.identity.displayName).toBe('Test User');
  });

  it('getViewModel returns view model', async () => {
    const result = await router.getViewModel({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
  });

  it('getIdentity returns identity card', async () => {
    const result = await router.getIdentity({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.displayName).toBe('Test User');
  });

  it('getFocus returns focus card', async () => {
    const result = await router.getFocus({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Complete Project');
  });

  it('getExecution returns execution status', async () => {
    const result = await router.getExecution({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.activePlans).toBe(3);
  });

  it('getDecisions returns decision summary', async () => {
    const result = await router.getDecisions({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.pending).toBe(2);
  });

  it('getMemory returns memory summary', async () => {
    const result = await router.getMemory({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.total).toBe(142);
  });

  it('getGrowth returns growth summary', async () => {
    const result = await router.getGrowth({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.learning).toBe(3);
  });

  it('getJourney returns journey summary', async () => {
    const result = await router.getJourney({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.day).toBe(1);
  });

  it('getInsights returns insights', async () => {
    const result = await router.getInsights({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('getRecommendations returns recommendations', async () => {
    const result = await router.getRecommendations({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data[0]?.title).toBe('Learn TypeScript');
  });

  it('getHealth returns health status', async () => {
    const result = await router.getHealth({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('healthy');
  });

  it('getMetrics returns metrics', async () => {
    const result = await router.getMetrics({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.lifeScore).toBe(76);
  });

  it('refreshSection refreshes a section', async () => {
    const result = await router.refreshSection(
      { userId: 'test-user', sectionId: 'identity' },
      testCtx,
    );
    expect(result.success).toBe(true);
  });

  it('invalidateCache returns success', async () => {
    const result = await router.invalidateCache({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.message).toBe('Cache invalidated');
  });
});

// ── Career Router ───────────────────────────────────────────────────────────

describe('CareerRouter', () => {
  const svc = createMockCareer() as unknown as CareerService;
  const router = createCareerRouter(svc as never);

  it('getCareer returns career data', async () => {
    const result = await router.getCareer({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.role).toBe('Developer');
  });

  it('getViewModel returns career view model', async () => {
    const result = await router.getViewModel({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.cards).toBeDefined();
  });

  it('getConfig returns career config', async () => {
    const result = await router.getConfig({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.skillFocus).toBe('TypeScript');
  });

  it('invalidateCache returns success', async () => {
    const result = await router.invalidateCache({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.message).toBe('Cache invalidated');
  });
});

// ── Learning Router ─────────────────────────────────────────────────────────

describe('LearningRouter', () => {
  const svc = createMockLearning() as unknown as LearningService;
  const router = createLearningRouter(svc as never);

  it('getLearning returns learning data', async () => {
    const result = await router.getLearning({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.currentTopic).toBe('TypeScript');
  });

  it('getViewModel returns view model', async () => {
    const result = await router.getViewModel({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
  });

  it('getConfig returns config', async () => {
    const result = await router.getConfig({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
  });

  it('invalidateCache returns success', async () => {
    const result = await router.invalidateCache({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
  });
});

// ── Business Router ─────────────────────────────────────────────────────────

describe('BusinessRouter', () => {
  const svc = createMockBusiness() as unknown as BusinessService;
  const router = createBusinessRouter(svc as never);

  it('getBusiness returns business data', async () => {
    const result = await router.getBusiness({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.kpis).toBeDefined();
  });

  it('getViewModel returns view model', async () => {
    const result = await router.getViewModel({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
  });

  it('getConfig returns config', async () => {
    const result = await router.getConfig({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
  });

  it('invalidateCache returns success', async () => {
    const result = await router.invalidateCache({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
  });
});

// ── Marketplace Router ──────────────────────────────────────────────────────

describe('MarketplaceRouter', () => {
  const svc = createMockMarketplace() as unknown as MarketplaceService;
  const router = createMarketplaceRouter(svc as never);

  it('getMarketplace returns marketplace data', async () => {
    const result = await router.getMarketplace({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.installed).toBeDefined();
  });

  it('getViewModel returns view model', async () => {
    const result = await router.getViewModel({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
  });

  it('getConfig returns config', async () => {
    const result = await router.getConfig({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.autoUpdate).toBe(true);
  });

  it('invalidateCache returns success', async () => {
    const result = await router.invalidateCache({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
  });
});

// ── Search Router ───────────────────────────────────────────────────────────

describe('SearchRouter', () => {
  const router = createSearchRouter(createMockLifeOS());

  it('global returns search results', async () => {
    const result = await router.global(
      { query: 'TypeScript', categories: ['skill'], sources: ['career'], maxResults: 10 },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.title).toBe('TypeScript');
  });

  it('recent returns empty array for new user', async () => {
    const result = await router.recent(
      { userId: 'new-user' },
      { userId: 'new-user', email: 'new@vedmoulya.com', role: 'user' },
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('global handles empty search gracefully', async () => {
    const emptySearchService = createMockLifeOS();
    vi.spyOn(emptySearchService, 'globalSearch').mockResolvedValue([]);
    const router2 = createSearchRouter(emptySearchService);
    const result = await router2.global({ query: 'nonexistent' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });
});

// ── Notification Router ─────────────────────────────────────────────────────

describe('NotificationRouter', () => {
  it('list returns notifications from dashboard snapshot', async () => {
    const router = createNotificationRouter(createMockDashboard() as never);
    const result = await router.list({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.title).toBe('Welcome');
  });

  it('dismiss dismisses a notification', async () => {
    const router = createNotificationRouter(createMockDashboard() as never);
    const result = await router.dismiss(
      { userId: 'test-user', notificationId: 'notif-1' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('dismiss returns error when dashboard fetch fails', async () => {
    const failingDashboard = createMockDashboard() as never;
    vi.spyOn(failingDashboard, 'getDashboard' as never).mockResolvedValue({ success: false });
    const router = createNotificationRouter(failingDashboard);
    const result = await router.dismiss(
      { userId: 'test-user', notificationId: 'notif-1' },
      testCtx,
    );
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INTERNAL_ERROR');
  });
});

// ── Configuration Router ────────────────────────────────────────────────────

describe('ConfigurationRouter', () => {
  const router = createConfigurationRouter(createMockDashboard() as never);

  it('get returns configuration', async () => {
    const result = await router.get({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.theme).toBe('dark');
    expect(result.data.notifications).toBe(true);
  });

  it('update returns updated configuration', async () => {
    const result = await router.update(
      { userId: 'test-user', updates: { theme: 'light' } },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.theme).toBe('dark');
  });
});

// ── Metrics Router ──────────────────────────────────────────────────────────

describe('MetricsRouter', () => {
  const router = createMetricsRouter(createMockDashboard() as never);

  it('dashboard returns dashboard metrics', async () => {
    const result = await router.dashboard({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.lifeScore).toBe(76);
    expect(result.data.goalProgress).toBe(60);
    expect(result.data.executionRate).toBe(80);
  });

  it('lifecycle returns lifecycle metrics', async () => {
    const result = await router.lifecycle({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.streak).toBe(5);
    expect(result.data.weeklyCompletion).toBe(4);
  });

  it('dashboard returns null data when getDashboard fails', async () => {
    const failingDashboard = createMockDashboard() as never;
    vi.spyOn(failingDashboard, 'getDashboard' as never).mockResolvedValue({
      success: true,
      data: null,
      latency: 0,
    });
    const router2 = createMetricsRouter(failingDashboard);
    const result = await router2.dashboard({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('lifecycle returns null data when getDashboard fails', async () => {
    const failingDashboard = createMockDashboard() as never;
    vi.spyOn(failingDashboard, 'getDashboard' as never).mockResolvedValue({
      success: true,
      data: null,
      latency: 0,
    });
    const router2 = createMetricsRouter(failingDashboard);
    const result = await router2.lifecycle({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});

// ── Auth Enforcement (strict, through the real tRPC pipeline) ────────────────
// BLD-016C: verifies the RouterRegistry auth + IDOR middleware actually reject
// unauthenticated and cross-user calls before any service resolver runs.

describe('Auth enforcement (strict, real pipeline)', () => {
  const createCaller = t.createCallerFactory(getAppRouter());

  it('rejects unauthenticated calls with UNAUTHORIZED', async () => {
    const caller = createCaller({ userId: 'anonymous', email: '', role: 'guest' });
    await expect(caller.lifeOS.getSnapshot({ userId: 'user-1' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects cross-user (IDOR) calls with FORBIDDEN', async () => {
    const caller = createCaller({ userId: 'user-1', email: 'u@v.com', role: 'user' });
    await expect(caller.lifeOS.getSnapshot({ userId: 'user-2' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects cross-user IDOR on nested user-scoped procedures', async () => {
    const caller = createCaller({ userId: 'user-1', email: 'u@v.com', role: 'user' });
    await expect(
      caller.notifications.dismiss({ userId: 'user-2', notificationId: 'n-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps health procedures public', async () => {
    const caller = createCaller({ userId: 'anonymous', email: '', role: 'guest' });
    const result = await caller.health.check();
    expect(result.success).toBe(true);
  });
});

// ── Rate Limiter Middleware ──────────────────────────────────────────────────

describe('RateLimiter', () => {
  it('checkRateLimitInternal exports middleware factory', async () => {
    const { checkRateLimitInternal, RateLimitTiers } = await import('../middleware/rate-limit.js');
    expect(typeof checkRateLimitInternal).toBe('function');
    expect(RateLimitTiers.standard.maxRequests).toBe(100);
    expect(RateLimitTiers.health.maxRequests).toBe(200);
    expect(RateLimitTiers.search.maxRequests).toBe(30);
    expect(RateLimitTiers.heavy.maxRequests).toBe(20);
    expect(RateLimitTiers.auth.maxRequests).toBe(10);
  });

  it('assertRateLimit allows requests under limit', async () => {
    const { assertRateLimit, RateLimitTiers } = await import('../middleware/rate-limit.js');
    // Should not throw
    expect(() => assertRateLimit('rate-test-user', RateLimitTiers.auth)).not.toThrow();
  });

  it('getRateLimitStats returns null for unknown user', async () => {
    const { getRateLimitStats, RateLimitTiers } = await import('../middleware/rate-limit.js');
    const stats = getRateLimitStats('unknown-user', RateLimitTiers.standard);
    expect(stats).toBeNull();
  });
});
