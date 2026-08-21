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
import { createCapabilitiesRouter } from '../routers/CapabilitiesRouter.js';
import { createProvidersRouter } from '../routers/ProvidersRouter.js';
import { createExecutionStrategyRouter } from '../routers/ExecutionStrategyRouter.js';
import { createOrchestratorRouter } from '../routers/OrchestratorRouter.js';
import { createGoalsRouter } from '../routers/GoalsRouter.js';
import { createIdentityRouter } from '../routers/IdentityRouter.js';
import { createIntelligenceRouter } from '../routers/IntelligenceRouter.js';
import { createLearningIntelligenceRouter } from '../routers/LearningIntelligenceRouter.js';
import { createEnterpriseBrainRouter } from '../routers/BrainRouter.js';
import {
  BrainApplicationService,
  InMemoryBrainRepository,
  createCatalogBrainPlan,
} from '@vedmoulya/enterprise-brain';
import {
  CapabilityApplicationService,
  InMemoryCapabilityRepository,
  createCatalogCapabilities,
} from '@vedmoulya/capabilities';
import {
  InMemoryProviderRepository,
  ProviderApplicationService,
  createCatalogProviders,
} from '@vedmoulya/providers';
import {
  ContextApplicationService,
  InMemoryContextRepository,
  createCatalogContext,
} from '@vedmoulya/context';
import {
  ExecutionStrategyApplicationService,
  InMemoryExecutionStrategyRepository,
  createCatalogStrategies,
} from '@vedmoulya/execution-strategy';
import {
  InMemoryExecutionGraphRepository,
  InMemoryExecutionHistoryRepository,
  InMemoryExecutionQueueRepository,
  InMemoryExecutionSessionRepository,
  InMemoryWorkerRegistry,
  OrchestratorApplicationService,
  createBlogGraphInput,
} from '@vedmoulya/execution-orchestrator';
import {
  GoalsApplicationService,
  InMemoryGoalRepository,
  InMemoryTaskRepository,
  createCatalogGoals,
} from '@vedmoulya/goals';
import {
  IntelligenceApplicationService,
  InMemoryPipelineRepository,
} from '@vedmoulya/intelligence';
import {
  LearningIntelligenceApplicationService,
  InMemoryLearningRepository,
  createCatalogLearningEvents,
} from '@vedmoulya/learning-intelligence';
import { createOSRouter } from '../routers/OSRouter.js';
import { OSApplicationService, InMemoryOSRepository } from '@vedmoulya/os-intelligence';
import {
  KnowledgeApplicationService,
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeGraph,
  createCatalogKnowledgeItems,
  createCatalogKnowledgeRelationships,
  type KnowledgeEngines,
} from '@vedmoulya/knowledge-intelligence';
import {
  MemoryApplicationService,
  InMemoryMemoryRepository,
  InMemoryMemoryGraph,
  createCatalogMemoryItems,
  createCatalogMemoryRelationships,
  type MemoryEngines,
} from '@vedmoulya/memory-intelligence';
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

// ── Capabilities Router (EPIC-004 / EI-001) ─────────────────────────────────

describe('CapabilitiesRouter', () => {
  const svc = new CapabilityApplicationService(
    new InMemoryCapabilityRepository(createCatalogCapabilities()),
  );
  const router = createCapabilitiesRouter(svc);

  it('getMarketplace returns the seeded catalog', async () => {
    const result = await router.getMarketplace({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.total).toBeGreaterThan(0);
    expect(result.data.compositionCount).toBe(1); // content_generation
  });

  it('search finds capabilities by query and composition filter', async () => {
    const result = await router.search({ userId: 'test-user', query: 'translation' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.items[0]?.id).toBe('translation');

    const compositions = await router.search(
      { userId: 'test-user', onlyCompositions: true },
      testCtx,
    );
    expect(compositions.data.items).toHaveLength(1);
  });

  it('getCapability returns a single capability', async () => {
    const result = await router.getCapability({ userId: 'test-user', id: 'writing' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Writing');
  });

  it('getCompositionTree resolves research + writing + review', async () => {
    const result = await router.getCompositionTree(
      { userId: 'test-user', id: 'content_generation' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.leaves).toEqual(['research', 'writing', 'review']);
  });

  it('getGraph returns a clean DAG', async () => {
    const result = await router.getGraph({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.cycles).toHaveLength(0);
    expect(result.data.dangling).toHaveLength(0);
  });

  it('listByBusinessModule returns content-agency capabilities', async () => {
    const result = await router.listByBusinessModule(
      { userId: 'test-user', module: 'content-agency' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.some((c) => c.id === 'content_generation')).toBe(true);
  });

  it('createCapability registers a new capability', async () => {
    const result = await router.createCapability(
      {
        userId: 'test-user',
        id: 'cap_router_test',
        name: 'Router Test Capability',
        category: 'content',
        description: 'Created through the router',
        owner: 'test-owner',
        requiredAIFeatures: ['reasoning'],
        businessModules: ['content-agency'],
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.version).toBe('1.0.0');
  });

  it('transitionStatus walks the lifecycle through the router', async () => {
    const result = await router.transitionStatus(
      { userId: 'test-user', id: 'cap_router_test', to: 'draft' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('draft');
  });

  it('createVersion bumps the version through the router', async () => {
    const result = await router.createVersion(
      { userId: 'test-user', id: 'cap_router_test', type: 'minor' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.version).toBe('1.1.0');
  });

  it('deleteCapability removes an unreferenced capability', async () => {
    const result = await router.deleteCapability(
      { userId: 'test-user', id: 'cap_router_test' },
      testCtx,
    );
    expect(result.success).toBe(true);
  });
});

// ── Providers Router (EPIC-004 / EI-002) ────────────────────────────────────

describe('ProvidersRouter', () => {
  const svc = new ProviderApplicationService(
    new InMemoryProviderRepository(createCatalogProviders()),
  );
  const router = createProvidersRouter(svc);

  it('getMarketplace returns the seeded provider fleet', async () => {
    const result = await router.getMarketplace({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.total).toBeGreaterThan(0);
    expect(result.data.activeCount).toBeGreaterThan(0);
  });

  it('getProvider returns a single provider with models and matrix', async () => {
    const result = await router.getProvider({ userId: 'test-user', id: 'openai' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('OpenAI');
    expect(result.data.models.length).toBeGreaterThan(0);
    expect(result.data.matrix.length).toBeGreaterThan(0);
  });

  it('search finds providers by query and family filter', async () => {
    const byQuery = await router.search({ userId: 'test-user', query: 'DeepSeek' }, testCtx);
    expect(byQuery.success).toBe(true);
    expect(byQuery.data.items.some((p: { family: string }) => p.family === 'deepseek')).toBe(true);

    const byFamily = await router.search({ userId: 'test-user', families: ['ollama'] }, testCtx);
    expect(byFamily.data.items).toHaveLength(1);
  });

  it('getCapabilityMatrix returns ranked capability rows', async () => {
    const result = await router.getCapabilityMatrix({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    const contentRow = result.data.rows.find(
      (r: { capability: string }) => r.capability === 'content_generation',
    );
    expect(contentRow.bestProviderId).toBeDefined();
    expect(contentRow.rankings.length).toBeGreaterThan(3);
  });

  it('getProvidersForCapability discovers embeddings providers', async () => {
    const result = await router.getProvidersForCapability(
      { userId: 'test-user', capability: 'embeddings' },
      testCtx,
    );
    expect(result.success).toBe(true);
    const ids = result.data.map((r: { providerId: string }) => r.providerId);
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
  });

  it('getFleetHealth aggregates the fleet', async () => {
    const result = await router.getFleetHealth({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.totalCount).toBeGreaterThan(0);
    expect(result.data.healthyCount).toBeGreaterThan(0);
  });

  it('getAvailabilityTier classifies a ready provider', async () => {
    const result = await router.getAvailabilityTier({ userId: 'test-user', id: 'openai' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.tier).toBe('ready');
  });

  it('registerProvider registers a new provider', async () => {
    const result = await router.registerProvider(
      {
        userId: 'test-user',
        id: 'prov_router_test',
        family: 'mock',
        name: 'Router Test Provider',
        description: 'Registered through the router',
        owner: 'test-owner',
        models: [
          {
            id: 'rt-model-1',
            name: 'Router Model',
            contextLength: 131072,
            maxOutputTokens: 8192,
            streaming: true,
            vision: true,
            functionCalling: true,
            embeddings: false,
            reasoning: true,
            coding: true,
            creativeWriting: true,
            translation: true,
            image: false,
            audio: false,
            video: false,
            modalities: ['text-in', 'text-out'],
            capabilities: ['content_generation'],
          },
        ],
        capabilities: ['content_generation'],
        supportedModalities: ['text-in', 'text-out'],
        availability: 0.99,
        tags: ['router-test'],
        matrix: [
          {
            capability: 'content_generation',
            quality: 0.85,
            expectedCostUsd: 0.01,
            expectedLatencyMs: 500,
            expectedInputTokens: 6000,
            expectedOutputTokens: 4000,
            confidence: 0.9,
            historicalSuccess: 0.95,
            qualityTier: 'economy',
          },
        ],
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.version).toBe('1.0.0');
  });

  it('transitionLifecycle walks the lifecycle through the router', async () => {
    const result = await router.transitionLifecycle(
      { userId: 'test-user', id: 'prov_router_test', to: 'testing' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.lifecycleStatus).toBe('testing');
  });

  it('recordHealthSample records a health sample through the router', async () => {
    const result = await router.recordHealthSample(
      {
        userId: 'test-user',
        id: 'prov_router_test',
        ok: true,
        latencyMs: 120,
        quotaUsedPercent: 20,
        rateLimitRemaining: 900,
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.health.successCount).toBeGreaterThan(0);
  });

  it('createVersion bumps the version through the router', async () => {
    const result = await router.createVersion(
      { userId: 'test-user', id: 'prov_router_test', type: 'minor' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.version).toBe('1.1.0');
  });

  it('setCapabilityMatrix replaces the matrix and bumps minor through the router', async () => {
    const result = await router.setCapabilityMatrix(
      {
        userId: 'test-user',
        id: 'prov_router_test',
        matrix: [
          {
            capability: 'content_generation',
            quality: 0.97,
            expectedCostUsd: 0.02,
            expectedLatencyMs: 400,
            expectedInputTokens: 6000,
            expectedOutputTokens: 4000,
            confidence: 0.95,
            historicalSuccess: 0.98,
            qualityTier: 'premium',
          },
        ],
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.matrix).toHaveLength(1);
    expect(result.data.version).toBe('1.2.0');
  });

  it('deleteProvider removes a provider', async () => {
    const result = await router.deleteProvider(
      { userId: 'test-user', id: 'prov_router_test' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.deleted).toBe(true);
  });

  it('getBenchmarkDatasets returns dataset definitions', async () => {
    const result = await router.getBenchmarkDatasets({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.total).toBeGreaterThan(0);
    expect(result.data.items[0]?.benchmarkId).toMatch(/^B-\d{3}$/);
  });

  it('getModelRegistry returns every model across the fleet', async () => {
    const result = await router.getModelRegistry({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.total).toBeGreaterThan(0);
    const openaiModels = result.data.models.filter(
      (m: { providerId: string }) => m.providerId === 'openai',
    );
    expect(openaiModels.length).toBe(3);
  });
});

// ── Execution Strategy Router (EPIC-004 / EI-004) ───────────────────────────

describe('ExecutionStrategyRouter', () => {
  const svc = new ExecutionStrategyApplicationService(
    new InMemoryExecutionStrategyRepository(createCatalogStrategies()),
  );
  const router = createExecutionStrategyRouter(svc);

  it('getSummary aggregates the seeded catalog', async () => {
    const result = await router.getSummary({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.total).toBeGreaterThanOrEqual(4);
    expect(result.data.averageConfidence).toBeGreaterThan(0);
  });

  it('list returns the seeded strategies', async () => {
    const result = await router.list({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(4);
  });

  it('search finds strategies by goal text', async () => {
    const result = await router.search({ userId: 'test-user', query: 'microservices' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.total).toBe(1);
    expect(result.data.items[0]?.goalId).toBe('goal_blog_001');

    const byPriority = await router.search({ userId: 'test-user', priority: 'high' }, testCtx);
    expect(byPriority.data.total).toBeGreaterThanOrEqual(2);
  });

  it('listByGoal returns the matching seeded strategy', async () => {
    const result = await router.listByGoal(
      { userId: 'test-user', goalId: 'goal_summary_001' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.goal).toContain('quarterly business report');
  });

  it('createStrategy → getStrategy → validateStrategy → explainStrategy lifecycle', async () => {
    const created = await router.createStrategy(
      {
        userId: 'test-user',
        goalId: 'goal_router_test',
        goal: 'Generate a blog post about event-driven architecture',
        business: ['content-agency', 'platform'],
        priority: 'high',
        qualityTier: 'premium',
      },
      testCtx,
    );
    expect(created.success).toBe(true);
    const strategyId = created.data.strategyId;

    const fetched = await router.getStrategy({ userId: 'test-user', id: strategyId }, testCtx);
    expect(fetched.success).toBe(true);
    expect(fetched.data.capabilityPlan.requiredCapabilities).toContain('content_generation');

    const validated = await router.validateStrategy(
      { userId: 'test-user', id: strategyId },
      testCtx,
    );
    expect(validated.success).toBe(true);
    expect(validated.data.validation.passed).toBe(true);

    const explained = await router.explain({ userId: 'test-user', id: strategyId }, testCtx);
    expect(explained.success).toBe(true);
    expect(explained.data.capabilitySummary).toBeTruthy();
    expect(explained.data.providerSummary).toBeTruthy();
  });

  it('estimateTokens/Cost/Latency return budgets without persisting', async () => {
    const tokens = await router.estimateTokens(
      { userId: 'test-user', goal: 'Summarize a contract for a client', tier: 'standard' },
      testCtx,
    );
    expect(tokens.success).toBe(true);
    expect(tokens.data.expectedTokens).toBeGreaterThan(0);

    const cost = await router.estimateCost(
      { userId: 'test-user', goal: 'Summarize a contract for a client', tier: 'standard' },
      testCtx,
    );
    expect(cost.success).toBe(true);
    expect(cost.data.expectedCostUsd).toBeGreaterThan(0);

    const latency = await router.estimateLatency(
      { userId: 'test-user', goal: 'Summarize a contract for a client', tier: 'standard' },
      testCtx,
    );
    expect(latency.success).toBe(true);
    expect(latency.data.expectedTimeMs).toBeGreaterThan(0);
  });

  it('listByPriority / listByExecutionMode / listByCapability filter correctly', async () => {
    const critical = await router.listByPriority(
      { userId: 'test-user', priority: 'critical' },
      testCtx,
    );
    expect(critical.success).toBe(true);
    expect(critical.data.length).toBeGreaterThanOrEqual(1);
    expect(critical.data.every((s: { priority: string }) => s.priority === 'critical')).toBe(true);

    const sequential = await router.listByExecutionMode(
      { userId: 'test-user', mode: 'sequential' },
      testCtx,
    );
    expect(sequential.success).toBe(true);
    expect(sequential.data.length).toBeGreaterThanOrEqual(1);
    expect(
      sequential.data.every((s: { executionMode: string }) => s.executionMode === 'sequential'),
    ).toBe(true);

    const content = await router.listByCapability(
      { userId: 'test-user', capability: 'content_generation' },
      testCtx,
    );
    expect(content.success).toBe(true);
    expect(content.data.length).toBeGreaterThanOrEqual(1);
  });

  it('deleteStrategy removes a strategy', async () => {
    const created = await router.createStrategy(
      {
        userId: 'test-user',
        goalId: 'goal_router_delete',
        goal: 'Generate a monthly newsletter for clients',
        business: ['content-agency'],
        priority: 'low',
        qualityTier: 'economy',
      },
      testCtx,
    );
    const strategyId = created.data.strategyId;

    const deleted = await router.deleteStrategy({ userId: 'test-user', id: strategyId }, testCtx);
    expect(deleted.success).toBe(true);
    expect(deleted.data.deleted).toBe(true);

    const after = await router.getStrategy({ userId: 'test-user', id: strategyId }, testCtx);
    expect(after.success).toBe(false);
    expect(after.error.message).toContain('not found');
  });
});

// ── Execution Orchestrator Router (EPIC-004 / EI-005) ───────────────────────

describe('ExecutionOrchestratorRouter', () => {
  const svc = new OrchestratorApplicationService(
    new InMemoryExecutionGraphRepository(),
    new InMemoryExecutionSessionRepository(),
    new InMemoryWorkerRegistry(),
    new InMemoryExecutionQueueRepository(),
    new InMemoryExecutionHistoryRepository(),
  );
  const router = createOrchestratorRouter(svc);

  it('buildExecutionGraph returns a validated graph', async () => {
    const result = await router.buildExecutionGraph(
      {
        userId: 'test-user',
        ...createBlogGraphInput(),
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.validated).toBe(true);
    expect(result.data.nodes).toHaveLength(5);
  });

  it('validateExecutionGraph re-validates a stored graph', async () => {
    const built = await router.buildExecutionGraph(
      { userId: 'test-user', ...createBlogGraphInput() },
      testCtx,
    );
    const validated = await router.validateExecutionGraph(
      { userId: 'test-user', graphId: built.data.graphId },
      testCtx,
    );
    expect(validated.success).toBe(true);
    expect(validated.data.validation.passed).toBe(true);
  });

  it('optimizeExecutionGraph returns a full schedule', async () => {
    const built = await router.buildExecutionGraph(
      { userId: 'test-user', ...createBlogGraphInput() },
      testCtx,
    );
    const optimized = await router.optimizeExecutionGraph(
      { userId: 'test-user', graphId: built.data.graphId },
      testCtx,
    );
    expect(optimized.success).toBe(true);
    expect(optimized.data.order).toHaveLength(5);
    expect(optimized.data.entries.some((e: { kind: string }) => e.kind === 'parallel')).toBe(true);
  });

  it('explainExecutionGraph returns summaries', async () => {
    const built = await router.buildExecutionGraph(
      { userId: 'test-user', ...createBlogGraphInput() },
      testCtx,
    );
    const explained = await router.explainExecutionGraph(
      { userId: 'test-user', graphId: built.data.graphId },
      testCtx,
    );
    expect(explained.success).toBe(true);
    expect(explained.data.nodeSummary).toContain('5 node(s)');
  });

  it('createExecutionSession creates a scheduled session', async () => {
    const created = await router.createExecutionSession(
      { userId: 'test-user', ...createBlogGraphInput() },
      testCtx,
    );
    expect(created.success).toBe(true);
    expect(created.data.status).toBe('validated');
    const sessionId = created.data.sessionId;

    const sessions = await router.listSessions({ userId: 'test-user' }, testCtx);
    expect(sessions.data.length).toBe(1);

    const queue = await router.getQueue({ userId: 'test-user', sessionId }, testCtx);
    expect(queue.success).toBe(true);
    expect(queue.data.length).toBe(5);
  });

  it('pause/resume/cancel enforce the state machine', async () => {
    const created = await router.createExecutionSession(
      { userId: 'test-user', ...createBlogGraphInput() },
      testCtx,
    );
    const sessionId = created.data.sessionId;

    // From 'validated', pause is illegal → error envelope.
    const paused = await router.pauseSession({ userId: 'test-user', sessionId }, testCtx);
    expect(paused.success).toBe(false);
    expect(paused.error.message).toContain('Illegal transition');
  });

  it('getSummary aggregates orchestrator state', async () => {
    await router.buildExecutionGraph({ userId: 'test-user', ...createBlogGraphInput() }, testCtx);
    const summary = await router.getSummary({ userId: 'test-user' }, testCtx);
    expect(summary.success).toBe(true);
    expect(summary.data.totalGraphs).toBeGreaterThanOrEqual(1);
  });

  it('listWorkers returns the registered fleet', async () => {
    const workers = await router.listWorkers({ userId: 'test-user' }, testCtx);
    expect(workers.success).toBe(true);
    expect(Array.isArray(workers.data)).toBe(true);
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
    // Should not throw (async contract)
    await expect(assertRateLimit('rate-test-user', RateLimitTiers.auth)).resolves.toBeUndefined();
  });

  it('getRateLimitStats returns null for unknown user', async () => {
    const { getRateLimitStats, RateLimitTiers } = await import('../middleware/rate-limit.js');
    const stats = await getRateLimitStats('unknown-user', RateLimitTiers.standard);
    expect(stats).toBeNull();
  });
});

// ── Goal & Task Intelligence Router (EPIC-004 / EI-006) ────────────────────

describe('GoalsRouter', () => {
  const svc = new GoalsApplicationService(
    new InMemoryGoalRepository(createCatalogGoals()),
    new InMemoryTaskRepository(),
  );
  const router = createGoalsRouter(svc);

  it('createGoal returns an analyzed, classified goal', async () => {
    const result = await router.createGoal(
      {
        userId: 'test-user',
        title: 'Grow recurring revenue by 25%',
        description: 'Analyze the sales pipeline and increase retainers this quarter.',
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('proposed');
    expect(result.data.category).toBe('revenue');
    expect(result.data.successCriteria.length).toBeGreaterThan(0);
    expect(result.data.classification).toBeDefined();
  });

  it('generateTasks returns a DAG with critical path and milestones', async () => {
    const created = await router.createGoal(
      {
        userId: 'test-user',
        title: 'Ship the analytics dashboard MVP',
        description: 'Launch the internal analytics dashboard for the platform team.',
        category: 'project',
      },
      testCtx,
    );
    const goalId = created.data.goalId;
    const result = await router.generateTasks({ userId: 'test-user', goalId }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.tasks.length).toBeGreaterThan(0);
    expect(result.data.criticalPath.length).toBeGreaterThan(0);
    expect(result.data.milestones.length).toBeGreaterThan(0);
    expect(result.data.totalEstimatedTokens).toBeGreaterThan(0);
  });

  it('validateGoal passes all eight checks after generation', async () => {
    const created = await router.createGoal(
      {
        userId: 'test-user',
        title: 'Improve health',
        description: 'Build a sustainable fitness and nutrition routine.',
      },
      testCtx,
    );
    const goalId = created.data.goalId;
    await router.generateTasks({ userId: 'test-user', goalId }, testCtx);
    const result = await router.validateGoal({ userId: 'test-user', goalId }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.passed).toBe(true);
    expect(result.data.checks).toHaveLength(8);
  });

  it('walks the lifecycle through the state machine', async () => {
    const created = await router.createGoal(
      {
        userId: 'test-user',
        title: 'Personal learning goal',
        description: 'Master a new skill through a structured path.',
      },
      testCtx,
    );
    const goalId = created.data.goalId;
    const scored = await router.transitionGoal(
      { userId: 'test-user', goalId, command: { type: 'score' } },
      testCtx,
    );
    expect(scored.data.status).toBe('scored');
    const accepted = await router.transitionGoal(
      { userId: 'test-user', goalId, command: { type: 'accept' } },
      testCtx,
    );
    expect(accepted.data.status).toBe('accepted');
    const activated = await router.transitionGoal(
      { userId: 'test-user', goalId, command: { type: 'activate' } },
      testCtx,
    );
    expect(activated.data.status).toBe('active');
  });

  it('buildStrategyHandoff converts the task plan for EI-004', async () => {
    const created = await router.createGoal(
      {
        userId: 'test-user',
        title: 'Grow recurring revenue by 25%',
        description: 'Analyze the sales pipeline and increase retainers this quarter.',
      },
      testCtx,
    );
    const goalId = created.data.goalId;
    await router.generateTasks({ userId: 'test-user', goalId }, testCtx);
    const result = await router.buildStrategyHandoff({ userId: 'test-user', goalId }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.steps.length).toBeGreaterThan(0);
    expect(result.data.mode).toMatch(/sequential|hybrid|parallel|pipeline/);
  });

  it('searches, lists, explains, and summarizes the registry', async () => {
    const list = await router.listGoals({ userId: 'test-user' }, testCtx);
    expect(list.success).toBe(true);
    expect(list.data.length).toBeGreaterThan(0);
    const search = await router.searchGoals(
      { userId: 'test-user', query: 'revenue', categories: ['revenue'] },
      testCtx,
    );
    expect(search.success).toBe(true);
    expect(search.data.items.length).toBeGreaterThan(0);
    const goalId = list.data[0].goalId;
    const explained = await router.explainGoal({ userId: 'test-user', goalId }, testCtx);
    expect(explained.success).toBe(true);
    expect(explained.data.goalId).toBe(goalId);
    const summary = await router.getSummary({ userId: 'test-user' }, testCtx);
    expect(summary.success).toBe(true);
    // 5 seeded + goals created by earlier tests in this shared-service suite.
    expect(summary.data.totalGoals).toBeGreaterThanOrEqual(5);
  });

  it('returns errors for missing goals', async () => {
    const result = await router.getGoal({ userId: 'test-user', goalId: 'goal_missing' }, testCtx);
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('not found');
  });
});

// ── Enterprise Intelligence Integration Router (EPIC-004 / EI-006 / INT-001) ─

describe('IntelligenceRouter', () => {
  const goals = new GoalsApplicationService(
    new InMemoryGoalRepository(createCatalogGoals()),
    new InMemoryTaskRepository(),
  );
  const capabilities = new CapabilityApplicationService(
    new InMemoryCapabilityRepository(createCatalogCapabilities()),
  );
  const providers = new ProviderApplicationService(
    new InMemoryProviderRepository(createCatalogProviders()),
  );
  const context = new ContextApplicationService(
    new InMemoryContextRepository(createCatalogContext()),
  );
  const strategies = new ExecutionStrategyApplicationService(
    new InMemoryExecutionStrategyRepository(createCatalogStrategies()),
  );
  const orchestrator = new OrchestratorApplicationService(
    new InMemoryExecutionGraphRepository(),
    new InMemoryExecutionSessionRepository(),
    new InMemoryWorkerRegistry(),
    new InMemoryExecutionQueueRepository(),
    new InMemoryExecutionHistoryRepository(),
  );
  const svc = new IntelligenceApplicationService(new InMemoryPipelineRepository(), {
    goals,
    capabilities,
    providers,
    context,
    strategies,
    orchestrator,
  });
  const router = createIntelligenceRouter(svc);

  it('buildPipeline composes all six engines into a ready pipeline', async () => {
    const result = await router.buildPipeline(
      { userId: 'test-user', goalId: 'goal_blog_seed' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('ready');
    expect(result.data.validation.passed).toBe(true);
    expect(result.data.steps).toHaveLength(7);
    expect(result.data.artifacts.strategyId).toBeDefined();
    expect(result.data.artifacts.graphId).toBeDefined();
    expect(result.data.artifacts.sessionId).toBeDefined();
  });

  it('validatePipeline re-validates a persisted pipeline', async () => {
    const built = await router.buildPipeline(
      { userId: 'test-user', goalId: 'goal_learning_seed' },
      testCtx,
    );
    const validated = await router.validatePipeline(
      { userId: 'test-user', pipelineId: built.data.pipelineId },
      testCtx,
    );
    expect(validated.success).toBe(true);
    expect(validated.data.passed).toBe(true);
    expect(validated.data.checks).toHaveLength(7);
  });

  it('explainPipeline returns the counts headline', async () => {
    const built = await router.buildPipeline(
      { userId: 'test-user', goalId: 'goal_project_seed' },
      testCtx,
    );
    const explained = await router.explainPipeline(
      { userId: 'test-user', pipelineId: built.data.pipelineId },
      testCtx,
    );
    expect(explained.success).toBe(true);
    expect(explained.data.ready).toBe(true);
    expect(explained.data.headline).toContain('ready for execution');
  });

  it('getPipeline returns a persisted pipeline', async () => {
    const built = await router.buildPipeline(
      { userId: 'test-user', goalId: 'goal_revenue_seed' },
      testCtx,
    );
    const fetched = await router.getPipeline(
      { userId: 'test-user', pipelineId: built.data.pipelineId },
      testCtx,
    );
    expect(fetched.success).toBe(true);
    expect(fetched.data.goalId).toBe('goal_revenue_seed');
  });

  it('listPipelines returns all built pipelines', async () => {
    await router.buildPipeline({ userId: 'test-user', goalId: 'goal_blog_seed' }, testCtx);
    const listed = await router.listPipelines({ userId: 'test-user' }, testCtx);
    expect(listed.success).toBe(true);
    expect(listed.data.length).toBeGreaterThanOrEqual(1);
  });

  it('getDashboard aggregates engine statuses and summaries', async () => {
    const dashboard = await router.getDashboard({ userId: 'test-user' }, testCtx);
    expect(dashboard.success).toBe(true);
    expect(dashboard.data.engineStatus).toHaveLength(6);
    expect(dashboard.data.goals.totalGoals).toBeGreaterThanOrEqual(5);
    expect(dashboard.data.capabilities.total).toBeGreaterThan(0);
    expect(dashboard.data.providers.total).toBeGreaterThan(0);
    expect(dashboard.data.context.total).toBeGreaterThan(0);
  });

  it('returns typed errors for unknown pipelines', async () => {
    const fetched = await router.getPipeline(
      { userId: 'test-user', pipelineId: 'pipeline_missing' },
      testCtx,
    );
    expect(fetched.success).toBe(false);
    expect(fetched.error.message).toContain('not found');
  });
});

describe('LearningIntelligenceRouter', () => {
  const goals = new GoalsApplicationService(
    new InMemoryGoalRepository(createCatalogGoals()),
    new InMemoryTaskRepository(),
  );
  const capabilities = new CapabilityApplicationService(
    new InMemoryCapabilityRepository(createCatalogCapabilities()),
  );
  const providers = new ProviderApplicationService(
    new InMemoryProviderRepository(createCatalogProviders()),
  );
  const context = new ContextApplicationService(
    new InMemoryContextRepository(createCatalogContext()),
  );
  const strategies = new ExecutionStrategyApplicationService(
    new InMemoryExecutionStrategyRepository(createCatalogStrategies()),
  );
  const orchestrator = new OrchestratorApplicationService(
    new InMemoryExecutionGraphRepository(),
    new InMemoryExecutionSessionRepository(),
    new InMemoryWorkerRegistry(),
    new InMemoryExecutionQueueRepository(),
    new InMemoryExecutionHistoryRepository(),
  );
  const svc = new LearningIntelligenceApplicationService(
    new InMemoryLearningRepository(createCatalogLearningEvents()),
    { goals, capabilities, providers, context, strategies, orchestrator },
  );
  const router = createLearningIntelligenceRouter(svc);

  it('recordEvent persists a learning event', async () => {
    const result = await router.recordEvent(
      {
        userId: 'test-user',
        category: 'provider',
        entityType: 'provider',
        entityId: 'openai',
        outcome: 'success',
        confidence: 0.9,
        costUsd: 0.01,
        latencyMs: 400,
        accuracy: 0.95,
        retries: 0,
        quality: 0.92,
      },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.eventId).toBeDefined();
    expect(result.data.category).toBe('provider');
  });

  it('listEvents returns seeded + recorded events with filters', async () => {
    const listed = await router.listEvents({ userId: 'test-user', category: 'provider' }, testCtx);
    expect(listed.success).toBe(true);
    expect(listed.data.total).toBeGreaterThan(0);
    const failures = await router.listEvents({ userId: 'test-user', outcome: 'failure' }, testCtx);
    expect(failures.data.total).toBeGreaterThan(0);
  });

  it('getTimeline returns recent events newest first', async () => {
    const timeline = await router.getTimeline({ userId: 'test-user', limit: 10 }, testCtx);
    expect(timeline.success).toBe(true);
    expect(timeline.data.length).toBeGreaterThan(0);
  });

  it('getModels and getInsights derive aggregates from the seed', async () => {
    const models = await router.getModels({ userId: 'test-user', category: 'provider' }, testCtx);
    expect(models.success).toBe(true);
    expect(models.data.length).toBeGreaterThan(0);
    const insights = await router.getInsights({ userId: 'test-user' }, testCtx);
    expect(insights.success).toBe(true);
    expect(insights.data.length).toBeGreaterThan(0);
  });

  it('getRecommendations produces pending recommendations from seed data', async () => {
    const recommendations = await router.getRecommendations({ userId: 'test-user' }, testCtx);
    expect(recommendations.success).toBe(true);
    expect(recommendations.data.length).toBeGreaterThanOrEqual(4);
    for (const recommendation of recommendations.data) {
      expect(recommendation.status).toBe('pending');
    }
  });

  it('approveRecommendation enforces the human-approval safety gate', async () => {
    const recommendations = await router.getRecommendations({ userId: 'test-user' }, testCtx);
    const providerRec = recommendations.data.find(
      (r: { type: string }) => r.type === 'best_provider',
    );
    expect(providerRec).toBeDefined();
    // Seed openai provider has 5 samples — below the approval threshold
    // (samples >= 5 but confidence 0.2375 < 0.6), so approval is blocked.
    const blocked = await router.approveRecommendation(
      {
        userId: 'test-user',
        recommendationId: providerRec.recommendationId,
        actor: 'human-owner',
      },
      testCtx,
    );
    expect(blocked.success).toBe(false);
    expect(blocked.error.message).toContain('safety gate');
  });

  it('rejectRecommendation and rollbackRecommendation maintain the audit trail', async () => {
    // Record enough openai successes to clear the approval gate (13 runs).
    for (let i = 0; i < 13; i += 1) {
      await router.recordEvent(
        {
          userId: 'test-user',
          category: 'provider',
          entityType: 'provider',
          entityId: 'openai',
          outcome: 'success',
          confidence: 0.95,
          costUsd: 0.01,
          latencyMs: 400,
          accuracy: 0.96,
          retries: 0,
          quality: 0.95,
        },
        testCtx,
      );
    }
    const recommendations = await router.getRecommendations({ userId: 'test-user' }, testCtx);
    const providerRec = recommendations.data.find(
      (r: { type: string }) => r.type === 'best_provider',
    );

    const approved = await router.approveRecommendation(
      {
        userId: 'test-user',
        recommendationId: providerRec.recommendationId,
        actor: 'owner',
        note: 'approved',
      },
      testCtx,
    );
    expect(approved.success).toBe(true);
    expect(approved.data.status).toBe('approved');
    expect(approved.data.version).toBe(2);

    const rolled = await router.rollbackRecommendation(
      { userId: 'test-user', recommendationId: providerRec.recommendationId, actor: 'reviewer' },
      testCtx,
    );
    expect(rolled.success).toBe(true);
    expect(rolled.data.status).toBe('rolled_back');
    expect(rolled.data.audit.length).toBe(3);
  });

  it('getAnalytics and getReports aggregate category data', async () => {
    const analytics = await router.getAnalytics({ userId: 'test-user' }, testCtx);
    expect(analytics.success).toBe(true);
    expect(analytics.data.trend.length).toBe(14);
    const reports = await router.getReports({ userId: 'test-user', category: 'provider' }, testCtx);
    expect(reports.success).toBe(true);
    expect(reports.data.some((r: { category: string }) => r.category === 'provider')).toBe(true);
  });

  it('getDashboard aggregates the full learning platform', async () => {
    const dashboard = await router.getDashboard({ userId: 'test-user' }, testCtx);
    expect(dashboard.success).toBe(true);
    expect(dashboard.data.totals.events).toBeGreaterThanOrEqual(38);
    expect(dashboard.data.byCategory.provider).toBeDefined();
    expect(dashboard.data.recentEvents.length).toBeGreaterThan(0);
  });

  it('returns typed errors for unknown events and recommendations', async () => {
    const missingEvent = await router.getEvent(
      { userId: 'test-user', eventId: 'levent_missing' },
      testCtx,
    );
    expect(missingEvent.success).toBe(false);
    const missingRec = await router.getRecommendation(
      { userId: 'test-user', recommendationId: 'rec_x' },
      testCtx,
    );
    expect(missingRec.success).toBe(false);
  });
});

describe('EnterpriseBrainRouter', () => {
  // The Brain consumes every engine exactly as the gateway wires it.
  const goals = new GoalsApplicationService(
    new InMemoryGoalRepository(createCatalogGoals()),
    new InMemoryTaskRepository(),
  );
  const capabilities = new CapabilityApplicationService(
    new InMemoryCapabilityRepository(createCatalogCapabilities()),
  );
  const providers = new ProviderApplicationService(
    new InMemoryProviderRepository(createCatalogProviders()),
  );
  const context = new ContextApplicationService(
    new InMemoryContextRepository(createCatalogContext()),
  );
  const strategies = new ExecutionStrategyApplicationService(
    new InMemoryExecutionStrategyRepository(createCatalogStrategies()),
  );
  const orchestrator = new OrchestratorApplicationService(
    new InMemoryExecutionGraphRepository(),
    new InMemoryExecutionSessionRepository(),
    new InMemoryWorkerRegistry(),
    new InMemoryExecutionQueueRepository(),
    new InMemoryExecutionHistoryRepository(),
  );
  const learning = new LearningIntelligenceApplicationService(
    new InMemoryLearningRepository(createCatalogLearningEvents()),
    { goals, capabilities, providers, context, strategies, orchestrator },
  );
  const svc = new BrainApplicationService(new InMemoryBrainRepository(), {
    goals,
    learning,
    capabilities,
    providers,
    context,
    strategies,
    orchestrator,
  });
  const router = createEnterpriseBrainRouter(svc);

  // Tests that assert exact store counts use a fresh repository so the shared
  // suite state (plans/decisions persisted by earlier tests) cannot leak in.
  const freshRouter = createEnterpriseBrainRouter(
    new BrainApplicationService(new InMemoryBrainRepository(), {
      goals,
      learning,
      capabilities,
      providers,
      context,
      strategies,
      orchestrator,
    }),
  );

  it('decideGoal produces a fully explained decision plan', async () => {
    const result = await router.decideGoal(
      { userId: 'test-user', goalId: 'goal_blog_seed' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect(result.data.decisions).toHaveLength(14);
    expect(result.data.pipeline).toHaveLength(11);
    for (const decision of result.data.decisions) {
      expect(decision.reason.why.length).toBeGreaterThan(0);
      expect(decision.confidence.score).toBeGreaterThan(0);
    }
  });

  it('decideGoal honors an operator budget', async () => {
    const result = await router.decideGoal(
      { userId: 'test-user', goalId: 'goal_blog_seed', budgetUsd: 2.5 },
      testCtx,
    );
    expect(result.success).toBe(true);
    const budget = result.data.decisions.find(
      (d: { type: string }) => d.type === 'budget_strategy',
    );
    expect(budget.recommendation.params.budgetMaxUsd).toBe(2.5);
  });

  it('listDecisions, getDecision, getTimeline, and getHistory expose the store', async () => {
    await freshRouter.decideGoal({ userId: 'test-user', goalId: 'goal_blog_seed' }, testCtx);

    const listed = await freshRouter.listDecisions(
      { userId: 'test-user', type: 'provider_selection' },
      testCtx,
    );
    expect(listed.success).toBe(true);
    expect(listed.data.total).toBe(1);

    const decisionId = listed.data.items[0].decisionId;
    const fetched = await freshRouter.getDecision({ userId: 'test-user', decisionId }, testCtx);
    expect(fetched.data.decisionId).toBe(decisionId);

    const timeline = await freshRouter.getTimeline({ userId: 'test-user', limit: 10 }, testCtx);
    expect(timeline.data.length).toBe(10);

    const history = await freshRouter.getHistory({ userId: 'test-user' }, testCtx);
    expect(history.data.length).toBeGreaterThanOrEqual(14);
  });

  it('getPlan and listPlans work after deciding', async () => {
    const decided = await router.decideGoal(
      { userId: 'test-user', goalId: 'goal_blog_seed' },
      testCtx,
    );
    const plan = await router.getPlan(
      { userId: 'test-user', planId: decided.data.planId },
      testCtx,
    );
    expect(plan.data.planId).toBe(decided.data.planId);
    const plans = await router.listPlans(
      { userId: 'test-user', goalId: 'goal_blog_seed' },
      testCtx,
    );
    expect(plans.data.length).toBeGreaterThanOrEqual(1);
  });

  it('approveDecision gates on the human-approval lifecycle', async () => {
    await router.decideGoal({ userId: 'test-user', goalId: 'goal_blog_seed' }, testCtx);
    const decisions = await router.listDecisions({ userId: 'test-user' }, testCtx);
    const decisionId = decisions.data.items[0].decisionId;

    const approved = await router.approveDecision(
      { userId: 'test-user', decisionId, actor: 'owner', note: 'ok' },
      testCtx,
    );
    expect(approved.success).toBe(true);
    expect(approved.data.status).toBe('approved');
    expect(approved.data.version).toBe(2);

    // Rejecting an approved decision is blocked by the state machine.
    const double = await router.rejectDecision(
      { userId: 'test-user', decisionId, actor: 'owner' },
      testCtx,
    );
    expect(double.success).toBe(false);
  });

  it('approvePlan then handOffPlan passes the plan to the orchestrator', async () => {
    const decided = await router.decideGoal(
      { userId: 'test-user', goalId: 'goal_blog_seed' },
      testCtx,
    );
    const planId = decided.data.planId;

    const premature = await router.handOffPlan(
      { userId: 'test-user', planId, actor: 'owner' },
      testCtx,
    );
    expect(premature.success).toBe(false);

    const approved = await router.approvePlan(
      { userId: 'test-user', planId, actor: 'owner' },
      testCtx,
    );
    expect(approved.success).toBe(true);
    expect(approved.data.status).toBe('approved');

    const handed = await router.handOffPlan(
      { userId: 'test-user', planId, actor: 'owner' },
      testCtx,
    );
    expect(handed.success).toBe(true);
    expect(handed.data.status).toBe('handed_off');
  });

  it('getMetrics and getDashboard aggregate the decision store', async () => {
    // A private instance so the exact store counts hold regardless of suite order.
    const isolatedRouter = createEnterpriseBrainRouter(
      new BrainApplicationService(new InMemoryBrainRepository(), {
        goals,
        learning,
        capabilities,
        providers,
        context,
        strategies,
        orchestrator,
      }),
    );
    await isolatedRouter.decideGoal({ userId: 'test-user', goalId: 'goal_blog_seed' }, testCtx);
    const metrics = await isolatedRouter.getMetrics({ userId: 'test-user' }, testCtx);
    expect(metrics.data.totals.decisions).toBe(14);
    expect(metrics.data.byType.goal_priority.count).toBe(1);
    const dashboard = await isolatedRouter.getDashboard({ userId: 'test-user' }, testCtx);
    expect(dashboard.data.totals.decisions).toBe(14);
    expect(dashboard.data.trend).toHaveLength(14);
  });

  it('serves the seed catalog through the router', async () => {
    const { plan, decisions } = createCatalogBrainPlan();
    const seededSvc = new BrainApplicationService(
      new InMemoryBrainRepository({ plans: [plan], decisions }),
      { goals, learning, capabilities, providers, context, strategies, orchestrator },
    );
    const seededRouter = createEnterpriseBrainRouter(seededSvc);
    const planResult = await seededRouter.getPlan(
      { userId: 'test-user', planId: plan.planId },
      testCtx,
    );
    expect(planResult.success).toBe(true);
    expect(planResult.data.overallConfidence).toBe(0.78);
  });

  it('returns typed errors for unknown plans and decisions', async () => {
    const missingPlan = await router.getPlan(
      { userId: 'test-user', planId: 'plan_missing' },
      testCtx,
    );
    expect(missingPlan.success).toBe(false);
    const missingDecision = await router.getDecision(
      { userId: 'test-user', decisionId: 'bd_missing' },
      testCtx,
    );
    expect(missingDecision.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enterprise Operating System Integration (EPIC-005 / OS-001)
// ─────────────────────────────────────────────────────────────────────────────

describe('OSRouter (EPIC-005 / OS-001)', () => {
  // The OS Integration Layer consumes every engine exactly as the gateway wires
  // it — the real seeded application services end to end. No mocked ports:
  // the seeded catalogs (goals/providers/capabilities/context/strategies/
  // learning/brain/knowledge/memory) answer every consultation.
  const goals = new GoalsApplicationService(
    new InMemoryGoalRepository(createCatalogGoals()),
    new InMemoryTaskRepository(),
  );
  const capabilities = new CapabilityApplicationService(
    new InMemoryCapabilityRepository(createCatalogCapabilities()),
  );
  const providers = new ProviderApplicationService(
    new InMemoryProviderRepository(createCatalogProviders()),
  );
  const context = new ContextApplicationService(
    new InMemoryContextRepository(createCatalogContext()),
  );
  const strategies = new ExecutionStrategyApplicationService(
    new InMemoryExecutionStrategyRepository(createCatalogStrategies()),
  );
  const orchestrator = new OrchestratorApplicationService(
    new InMemoryExecutionGraphRepository(),
    new InMemoryExecutionSessionRepository(),
    new InMemoryWorkerRegistry(),
    new InMemoryExecutionQueueRepository(),
    new InMemoryExecutionHistoryRepository(),
  );
  const learning = new LearningIntelligenceApplicationService(
    new InMemoryLearningRepository(createCatalogLearningEvents()),
    { goals, capabilities, providers, context, strategies, orchestrator },
  );
  const intelligence = new IntelligenceApplicationService(new InMemoryPipelineRepository(), {
    goals,
    capabilities,
    providers,
    context,
    strategies,
    orchestrator,
  });
  const brain = new BrainApplicationService(new InMemoryBrainRepository(), {
    goals,
    learning,
    capabilities,
    providers,
    context,
    strategies,
    orchestrator,
  });
  const knowledgeRepo = new InMemoryKnowledgeRepository({
    items: createCatalogKnowledgeItems(),
    relationships: createCatalogKnowledgeRelationships(),
  });
  const knowledge = new KnowledgeApplicationService(
    knowledgeRepo,
    new InMemoryKnowledgeGraph(knowledgeRepo),
    {} as KnowledgeEngines,
  );
  const memoryRepo = new InMemoryMemoryRepository({
    items: createCatalogMemoryItems(),
    relationships: createCatalogMemoryRelationships(),
  });
  const memory = new MemoryApplicationService(
    memoryRepo,
    new InMemoryMemoryGraph(memoryRepo),
    {} as MemoryEngines,
  );

  const router = createOSRouter(
    new OSApplicationService(new InMemoryOSRepository(), {
      goals,
      capabilities,
      providers,
      context,
      strategies,
      orchestrator,
      intelligence,
      learning,
      brain,
      knowledge,
      memory,
    }),
  );

  it('systemHealth assembles the full OS health report', async () => {
    const result = await router.systemHealth({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.engines).toHaveLength(11);
    expect(result.data.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.data.dependencies.acyclic).toBe(true);
    expect(result.data.pipeline.stages).toHaveLength(15);
    expect(result.data.crossEngine).toHaveLength(9);
  });

  it('pipelineHealth validates the 15-stage event flow', async () => {
    const result = await router.pipelineHealth({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.stages).toHaveLength(15);
    expect(result.data.valid).toBe(true);
    // Not-started stages are tolerated but keep the pipeline "degraded"
    // (they stay "ready" only when every stage is passed).
    expect(result.data.failedStages).toBe(0);
    expect(['ready', 'degraded']).toContain(result.data.overallStatus);
  });

  it('validatePlatform runs the certification gate', async () => {
    const result = await router.validatePlatform({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('runDiagnostics produces the diagnostics battery', async () => {
    const result = await router.runDiagnostics({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data.findings)).toBe(true);
  });

  it('engineStatus reports all 11 engines', async () => {
    const result = await router.engineStatus({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(11);
  });

  it('dependencyGraph is acyclic with all engines + consultation edges', async () => {
    const result = await router.dependencyGraph({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.nodes).toHaveLength(11);
    expect(result.data.packageEdges.length).toBeGreaterThan(0);
    expect(result.data.consultationEdges.length).toBeGreaterThan(0);
    expect(result.data.acyclic).toBe(true);
  });

  it('performanceMetrics measures the OS pass', async () => {
    const result = await router.performanceMetrics({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('dashboard persists snapshots and returns OS totals', async () => {
    const result = await router.dashboard({ userId: 'test-user' }, testCtx);
    expect(result.success).toBe(true);
    expect(result.data.latestSnapshot?.engineCount).toBe(11);
    const history = await router.snapshots({ userId: 'test-user', limit: 10 }, testCtx);
    expect(history.success).toBe(true);
    expect(history.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Lazy Singleton (router.ts) ────────────────────────────────────────────────
// getAppRouter() / getServices() cache their instances after first use; the
// cached-return branch only runs on a repeated call, so the walker and the
// single getAppRouter() reference above cannot cover it on their own.

describe('getAppRouter / getServices lazy singletons', () => {
  it('returns the same cached router on repeated calls', () => {
    const first = getAppRouter();
    const second = getAppRouter();
    expect(second).toBe(first);
  });
});
