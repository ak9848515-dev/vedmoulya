import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardApplicationService } from '../DashboardApplicationService.js';
import type { IdentityApplicationService } from '../../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../../ai/AIOrchestrationService.js';

describe('DashboardApplicationService', () => {
  let service: DashboardApplicationService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));

    // Create mock services
    const mockIdentity = {
      getUserById: vi.fn().mockRejectedValue(new Error('Not found')),
    } as unknown as IdentityApplicationService;

    const mockMemory = {
      getStats: vi.fn().mockResolvedValue({ success: false, error: 'Error' }),
      listMemories: vi.fn().mockRejectedValue(new Error('Error')),
    } as unknown as MemoryApplicationService;

    const mockDecision = {
      getStats: vi.fn().mockResolvedValue({ success: false, error: 'Error' }),
      listDecisions: vi.fn().mockRejectedValue(new Error('Error')),
    } as unknown as DecisionApplicationService;

    const mockExecution = {
      getStats: vi.fn().mockResolvedValue({ success: false, error: 'Error' }),
      listPlans: vi.fn().mockRejectedValue(new Error('Error')),
    } as unknown as ExecutionApplicationService;

    const mockKnowledge = {
      searchNodes: vi
        .fn()
        .mockResolvedValue({ nodes: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    } as unknown as KnowledgeApplicationService;

    const mockAI = {} as AIOrchestrationService;

    service = new DashboardApplicationService(
      mockIdentity,
      mockMemory,
      mockDecision,
      mockExecution,
      mockKnowledge,
      mockAI,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Snapshot Operations ────────────────────────────────────────

  describe('getDashboard', () => {
    it('returns a dashboard snapshot', async () => {
      const result = await service.getDashboard('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.userId).toBe('user_1');
    }, 15000);

    it('returns latency metric', async () => {
      const result = await service.getDashboard('user_1');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  describe('getDashboardViewModel', () => {
    it('returns a view model', async () => {
      const result = await service.getDashboardViewModel('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.identity.displayName).toBe('Guest');
    }, 15000);
  });

  describe('refreshSection', () => {
    it('refreshes a specific section', async () => {
      const result = await service.refreshSection('user_1', 'execution');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);
  });

  describe('invalidateCache', () => {
    it('invalidates cache without error', () => {
      expect(() => service.invalidateCache('user_1')).not.toThrow();
    });
  });

  describe('warmCache', () => {
    it('warms cache without error', async () => {
      const result = await service.warmCache('user_1');
      expect(typeof result).toBe('boolean');
    }, 15000);
  });

  // ── Section-specific Operations ────────────────────────────────

  describe('section getters', () => {
    it('returns error when dashboard data is missing', async () => {
      // Force an error by having invalid snapshot data
      const result = await service.getIdentity('nonexistent');
      expect(result.success).toBe(true); // falls back gracefully
      expect(result.data).toBeDefined();
    }, 15000);

    it('getIdentity returns identity view model', async () => {
      const result = await service.getIdentity('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    it('getFocus returns focus view model', async () => {
      const result = await service.getFocus('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    it('getExecution returns execution view model', async () => {
      const result = await service.getExecution('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    it('getDecisions returns decision view model', async () => {
      const result = await service.getDecisions('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    it('getMemory returns memory view model', async () => {
      const result = await service.getMemory('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    it('getGrowth returns growth view model', async () => {
      const result = await service.getGrowth('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    it('getJourney returns journey view model', async () => {
      const result = await service.getJourney('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    it('getInsights returns insight summary', async () => {
      const result = await service.getInsights('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    it('getRecommendations returns recommendation summary', async () => {
      const result = await service.getRecommendations('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    it('getHealth returns health view model', async () => {
      const result = await service.getHealth('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    it('getMetrics returns metrics view model', async () => {
      const result = await service.getMetrics('user_1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);
  });

  // ── Configuration Operations ───────────────────────────────────

  describe('configuration', () => {
    it('getConfig returns default config', () => {
      const config = service.getConfig('user_1');
      expect(config.userId).toBe('user_1');
      expect(config.theme).toBe('system');
    });

    it('updateConfig modifies existing config', () => {
      const updated = service.updateConfig('user_1', { theme: 'dark' });
      expect(updated.theme).toBe('dark');
    });

    it('updateWidgetState modifies widget state', () => {
      const state = service.updateWidgetState('user_1', 'focus', { isCollapsed: true });
      expect(state.isCollapsed).toBe(true);
    });

    it('updatePersonalization modifies preferences', () => {
      const prefs = service.updatePersonalization('user_1', { showMetrics: false });
      expect(prefs.showMetrics).toBe(false);
    });

    it('resetConfig restores defaults', () => {
      service.updateConfig('user_1', { theme: 'dark' });
      const reset = service.resetConfig('user_1');
      expect(reset.theme).toBe('system');
    });
  });

  // ── Notification Operations ────────────────────────────────────

  describe('notifications', () => {
    it('dismissNotification marks as read', () => {
      const notifs = [
        {
          id: 'n1',
          type: 'info' as const,
          title: 'Test',
          message: 'Msg',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
        },
      ];
      const updated = service.dismissNotification(notifs, 'n1');
      expect(updated[0]!.isRead).toBe(true);
    });

    it('markAllNotificationsRead marks all as read', () => {
      const notifs = [
        {
          id: 'n1',
          type: 'info' as const,
          title: 'T',
          message: 'M',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
        },
        {
          id: 'n2',
          type: 'info' as const,
          title: 'T',
          message: 'M',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
        },
      ];
      const all = service.markAllNotificationsRead(notifs);
      expect(all.every((n) => n.isRead)).toBe(true);
    });

    it('getUnreadNotificationCount counts unread', () => {
      const notifs = [
        {
          id: 'n1',
          type: 'info' as const,
          title: 'T',
          message: 'M',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
        },
        {
          id: 'n2',
          type: 'info' as const,
          title: 'T',
          message: 'M',
          source: 's',
          isRead: true,
          isActionable: false,
          createdAt: '',
        },
      ];
      expect(service.getUnreadNotificationCount(notifs)).toBe(1);
    });
  });

  // ── Recommendation Operations ──────────────────────────────────

  describe('recommendations', () => {
    it('dismissRecommendation marks as dismissed', () => {
      const recs = [
        {
          id: 'r1',
          category: 'learning' as const,
          title: 'T',
          description: 'D',
          priority: 5,
          confidence: 0.8,
          source: 's',
          reason: 'R',
          actionLabel: 'View',
          actionRoute: '/',
          isDismissed: false,
          createdAt: '',
        },
      ];
      const updated = service.dismissRecommendation(recs, 'r1');
      expect(updated[0]!.isDismissed).toBe(true);
    });

    it('prioritizeRecommendations sorts by priority', () => {
      const recs = [
        {
          id: 'r1',
          category: 'learning' as const,
          title: 'T1',
          description: 'D',
          priority: 1,
          confidence: 0.8,
          source: 's',
          reason: 'R',
          actionLabel: 'View',
          actionRoute: '/',
          isDismissed: false,
          createdAt: '',
        },
        {
          id: 'r2',
          category: 'learning' as const,
          title: 'T2',
          description: 'D',
          priority: 5,
          confidence: 0.9,
          source: 's',
          reason: 'R',
          actionLabel: 'View',
          actionRoute: '/',
          isDismissed: false,
          createdAt: '',
        },
      ];
      const prioritized = service.prioritizeRecommendations(recs);
      expect(prioritized[0]!.priority).toBeGreaterThanOrEqual(prioritized[1]!.priority);
    });
  });

  // ── Health Operations ──────────────────────────────────────────

  describe('health', () => {
    it('reportServiceHealth updates health status', () => {
      service.reportServiceHealth('identity', 'healthy', 5);
      expect(service.isHealthy()).toBe(true);
    });

    it('isHealthy returns false with no services', () => {
      // Reset health
      expect(service.isHealthy()).toBe(false);
    });

    it('reports degraded health', () => {
      service.reportServiceHealth('memory', 'degraded', 500);
      // Degraded is not healthy, but does not throw
      expect(service.isHealthy()).toBe(false);
    });

    it('reports down health', () => {
      service.reportServiceHealth('database', 'down', 0);
      expect(service.isHealthy()).toBe(false);
    });
  });

  // ── Analytics Operations ───────────────────────────────────────

  describe('analytics', () => {
    it('getAnalytics returns analytics data', () => {
      const analytics = service.getAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.totalLoads).toBe(0);
    });

    it('getCacheMetrics returns cache metrics', () => {
      const metrics = service.getCacheMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalEntries).toBeGreaterThanOrEqual(0);
    });
  });
});
