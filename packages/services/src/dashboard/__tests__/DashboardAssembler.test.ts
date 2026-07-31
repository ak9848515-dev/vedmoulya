import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardAssembler } from '../DashboardAssembler.js';

describe('DashboardAssembler', () => {
  let mockIdentityService: Record<string, ReturnType<typeof vi.fn>>;
  let mockMemoryService: Record<string, ReturnType<typeof vi.fn>>;
  let mockDecisionService: Record<string, ReturnType<typeof vi.fn>>;
  let mockExecutionService: Record<string, ReturnType<typeof vi.fn>>;
  let mockKnowledgeService: Record<string, ReturnType<typeof vi.fn>>;
  let mockAIService: Record<string, ReturnType<typeof vi.fn>>;
  let assembler: DashboardAssembler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));

    mockIdentityService = {
      getUserById: vi.fn(),
    };
    mockMemoryService = {
      getStats: vi.fn(),
      listMemories: vi.fn(),
    };
    mockDecisionService = {
      getStats: vi.fn(),
      listDecisions: vi.fn(),
    };
    mockExecutionService = {
      getStats: vi.fn(),
      listPlans: vi.fn(),
    };
    mockKnowledgeService = {
      searchNodes: vi.fn(),
    };
    mockAIService = {};

    assembler = new DashboardAssembler(
      mockIdentityService as never,
      mockMemoryService as never,
      mockDecisionService as never,
      mockExecutionService as never,
      mockKnowledgeService as never,
      mockAIService as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('assemble', () => {
    it('assembles full snapshot with all widgets', async () => {
      // Setup all mocks to return data
      mockIdentityService.getUserById.mockResolvedValue({
        id: 'user_1',
        email: 'test@example.com',
        displayName: 'Test User',
        givenName: 'Test',
        familyName: 'User',
        avatarUrl: undefined,
        bio: '',
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
      });

      mockMemoryService.getStats.mockResolvedValue({
        success: true,
        data: { total: 5, byCategory: {}, byState: {}, linkedCount: 0 },
      });
      mockMemoryService.listMemories.mockResolvedValue({
        success: true,
        data: { data: [], total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      mockDecisionService.getStats.mockResolvedValue({
        success: true,
        data: { total: 3, byCategory: {}, byStatus: {}, linkedCount: 0 },
      });
      mockDecisionService.listDecisions.mockResolvedValue({
        success: true,
        data: { data: [], total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      mockExecutionService.getStats.mockResolvedValue({
        success: true,
        data: {
          totalPlans: 2,
          activePlans: 1,
          completedPlans: 0,
          overduePlans: 0,
          completionRate: 50,
        },
      });
      mockExecutionService.listPlans.mockResolvedValue({
        success: true,
        data: { data: [], total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      mockKnowledgeService.searchNodes.mockResolvedValue({
        nodes: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const snapshot = await assembler.assemble('user_1');
      expect(snapshot.userId).toBe('user_1');
      expect(snapshot.id).toContain('snap_');
      expect(snapshot.identity).toBeDefined();
      expect(snapshot.identity.displayName).toBe('Test User');
      expect(snapshot.focus).toBeDefined();
      expect(snapshot.execution).toBeDefined();
      expect(snapshot.decisions).toBeDefined();
      expect(snapshot.memory).toBeDefined();
      expect(snapshot.knowledge).toBeDefined();
      expect(snapshot.growth).toBeDefined();
      expect(snapshot.journey).toBeDefined();
      expect(snapshot.timeline).toBeDefined();
      expect(snapshot.insights).toBeDefined();
      expect(snapshot.recommendations).toBeDefined();
      expect(snapshot.notifications).toBeDefined();
      expect(snapshot.quickActions).toBeDefined();
      expect(snapshot.health).toBeDefined();
      expect(snapshot.metrics).toBeDefined();
      expect(snapshot.aiContext).toBeDefined();
      expect(snapshot.widgetStates).toBeDefined();
    }, 15000);

    it('handles guest user when identity fails', async () => {
      mockIdentityService.getUserById.mockRejectedValue(new Error('User not found'));
      mockMemoryService.getStats.mockResolvedValue({ success: false, error: 'Stats error' });
      mockDecisionService.getStats.mockResolvedValue({ success: false, error: 'Stats error' });
      mockExecutionService.getStats.mockResolvedValue({ success: false, error: 'Stats error' });
      mockKnowledgeService.searchNodes.mockResolvedValue({
        nodes: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      mockMemoryService.listMemories.mockRejectedValue(new Error('Memory error'));
      mockDecisionService.listDecisions.mockRejectedValue(new Error('Decision error'));
      mockExecutionService.listPlans.mockRejectedValue(new Error('Execution error'));

      const snapshot = await assembler.assemble('guest_1');
      expect(snapshot.identity.displayName).toBe('Guest');
      expect(snapshot).toBeDefined();
    }, 15000);

    it('includes quick actions', async () => {
      mockIdentityService.getUserById.mockRejectedValue(new Error('Not found'));
      mockMemoryService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockDecisionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockExecutionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockKnowledgeService.searchNodes.mockResolvedValue({
        nodes: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mockMemoryService.listMemories.mockRejectedValue(new Error('E'));
      mockDecisionService.listDecisions.mockRejectedValue(new Error('E'));
      mockExecutionService.listPlans.mockRejectedValue(new Error('E'));

      const snapshot = await assembler.assemble('user_1');
      expect(snapshot.quickActions.length).toBeGreaterThanOrEqual(7);
      expect(snapshot.quickActions.some((a) => a.id === 'create_goal')).toBe(true);
      expect(snapshot.quickActions.some((a) => a.id === 'ask_ai')).toBe(true);
      expect(snapshot.quickActions.some((a) => a.id === 'review_decisions')).toBe(true);
    }, 15000);
  });

  describe('assembleSection', () => {
    it('refreshes execution section', async () => {
      // safeCall wraps the result, so mock returns the inner DTO list directly
      mockExecutionService.getStats.mockResolvedValue({} as never);
      mockExecutionService.listPlans.mockResolvedValue([] as never);

      const section = await assembler.assembleSection('user_1', 'execution');
      expect(section.execution).toBeDefined();
    });

    it('refreshes decisions section', async () => {
      mockDecisionService.getStats.mockResolvedValue({} as never);
      // safeCall wraps, assembleSection accesses .data?.data -> fallback to []
      mockDecisionService.listDecisions.mockResolvedValue([] as never);

      const section = await assembler.assembleSection('user_1', 'decisions');
      expect(section.decisions).toBeDefined();
    });

    it('refreshes memory section', async () => {
      mockMemoryService.getStats.mockResolvedValue({
        total: 0,
        byCategory: {},
        byState: {},
        linkedCount: 0,
      } as never);
      mockMemoryService.listMemories.mockResolvedValue([] as never);

      const section = await assembler.assembleSection('user_1', 'memory');
      expect(section.memory).toBeDefined();
      expect(section.timeline).toBeDefined();
    });

    it('refreshes journey section', async () => {
      mockExecutionService.listPlans.mockResolvedValue([] as never);

      const section = await assembler.assembleSection('user_1', 'journey');
      expect(section.journey).toBeDefined();
    });

    it('returns empty for unknown section', async () => {
      const section = await assembler.assembleSection('user_1', 'unknown');
      expect(section).toEqual({});
    });

    it('falls back to full assemble for insights', async () => {
      mockIdentityService.getUserById.mockRejectedValue(new Error('Not found'));
      mockMemoryService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockDecisionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockExecutionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockKnowledgeService.searchNodes.mockResolvedValue({
        nodes: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mockMemoryService.listMemories.mockRejectedValue(new Error('E'));
      mockDecisionService.listDecisions.mockRejectedValue(new Error('E'));
      mockExecutionService.listPlans.mockRejectedValue(new Error('E'));

      const section = await assembler.assembleSection('user_1', 'insights');
      expect(section).toBeDefined();
    }, 15000);

    it('falls back to full assemble for recommendations', async () => {
      mockIdentityService.getUserById.mockRejectedValue(new Error('Not found'));
      mockMemoryService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockDecisionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockExecutionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockKnowledgeService.searchNodes.mockResolvedValue({
        nodes: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mockMemoryService.listMemories.mockRejectedValue(new Error('E'));
      mockDecisionService.listDecisions.mockRejectedValue(new Error('E'));
      mockExecutionService.listPlans.mockRejectedValue(new Error('E'));

      const section = await assembler.assembleSection('user_1', 'recommendations');
      expect(section).toBeDefined();
    }, 15000);

    it('falls back to full assemble for notifications', async () => {
      mockIdentityService.getUserById.mockRejectedValue(new Error('Not found'));
      mockMemoryService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockDecisionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockExecutionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockKnowledgeService.searchNodes.mockResolvedValue({
        nodes: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mockMemoryService.listMemories.mockRejectedValue(new Error('E'));
      mockDecisionService.listDecisions.mockRejectedValue(new Error('E'));
      mockExecutionService.listPlans.mockRejectedValue(new Error('E'));

      const section = await assembler.assembleSection('user_1', 'notifications');
      expect(section).toBeDefined();
    }, 15000);

    it('falls back to full assemble for metrics', async () => {
      mockIdentityService.getUserById.mockRejectedValue(new Error('Not found'));
      mockMemoryService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockDecisionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockExecutionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockKnowledgeService.searchNodes.mockResolvedValue({
        nodes: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mockMemoryService.listMemories.mockRejectedValue(new Error('E'));
      mockDecisionService.listDecisions.mockRejectedValue(new Error('E'));
      mockExecutionService.listPlans.mockRejectedValue(new Error('E'));

      const section = await assembler.assembleSection('user_1', 'metrics');
      expect(section).toBeDefined();
    }, 15000);

    it('falls back to full assemble for health', async () => {
      mockIdentityService.getUserById.mockRejectedValue(new Error('Not found'));
      mockMemoryService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockDecisionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockExecutionService.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockKnowledgeService.searchNodes.mockResolvedValue({
        nodes: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      mockMemoryService.listMemories.mockRejectedValue(new Error('E'));
      mockDecisionService.listDecisions.mockRejectedValue(new Error('E'));
      mockExecutionService.listPlans.mockRejectedValue(new Error('E'));

      const section = await assembler.assembleSection('user_1', 'health');
      expect(section).toBeDefined();
    }, 15000);
  });
});
