import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CareerAssembler } from '../CareerAssembler.js';

describe('CareerAssembler', () => {
  let mockIdentity: any,
    mockMemory: any,
    mockDecision: any,
    mockExecution: any,
    mockKnowledge: any,
    mockAI: any;
  let assembler: CareerAssembler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));

    mockIdentity = { getUserById: vi.fn() };
    mockMemory = { getStats: vi.fn() };
    mockDecision = { getStats: vi.fn() };
    mockExecution = { getStats: vi.fn() };
    mockKnowledge = { searchNodes: vi.fn() };
    mockAI = { orchestrate: vi.fn() };

    assembler = new CareerAssembler(
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

  describe('assemble', () => {
    it('assembles full snapshot with all data present', async () => {
      mockIdentity.getUserById.mockResolvedValue({
        id: 'u1',
        email: 't@t.com',
        displayName: 'Test',
        statusState: 'active',
        theme: 'system',
        language: 'en',
        emailVerified: true,
        twoFactorEnabled: false,
        profileVisibility: 'public',
        entityStatus: 'active',
        createdAt: '',
        updatedAt: '',
      } as any);
      mockMemory.getStats.mockResolvedValue({
        success: true,
        data: { total: 5, byCategory: {}, byState: {}, linkedCount: 0 },
      });
      mockDecision.getStats.mockResolvedValue({
        success: true,
        data: { total: 3, byCategory: {}, byStatus: {}, linkedCount: 0 },
      });
      mockExecution.getStats.mockResolvedValue({
        success: true,
        data: {
          totalPlans: 2,
          activePlans: 1,
          completedPlans: 0,
          overduePlans: 0,
          completionRate: 50,
        },
      });
      mockKnowledge.searchNodes.mockResolvedValue({ nodes: [] });
      mockAI.orchestrate.mockResolvedValue({ success: true, data: { response: 'OK' } });

      const snapshot = await assembler.assemble('u1', 'Test User');
      expect(snapshot.userId).toBe('u1');
      expect(snapshot.profile).toBeDefined();
      expect(snapshot.skills).toBeDefined();
      expect(snapshot.gaps).toBeDefined();
      expect(snapshot.roadmap).toBeDefined();
      expect(snapshot.resume).toBeDefined();
      expect(snapshot.portfolio).toBeDefined();
      expect(snapshot.interview).toBeDefined();
      expect(snapshot.jobs).toBeDefined();
      expect(snapshot.market).toBeDefined();
      expect(snapshot.insights).toBeDefined();
      expect(snapshot.recommendations).toBeDefined();
      expect(snapshot.notifications).toBeDefined();
      expect(snapshot.quickActions).toHaveLength(8);
      expect(snapshot.metrics).toBeDefined();
      expect(snapshot.health).toBeDefined();
      expect(snapshot.aiContext).toBeDefined();
    }, 15000);

    it('handles missing identity gracefully', async () => {
      mockIdentity.getUserById.mockRejectedValue(new Error('Not found'));
      mockMemory.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockDecision.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockExecution.getStats.mockResolvedValue({ success: false, error: 'E' });
      mockKnowledge.searchNodes.mockResolvedValue({ nodes: [] });
      mockAI.orchestrate.mockRejectedValue(new Error('AI error'));

      const snapshot = await assembler.assemble('u1', 'Guest');
      expect(snapshot.profile.displayName).toBe('Guest');
    }, 15000);

    it('handles all module failures gracefully', async () => {
      mockIdentity.getUserById.mockRejectedValue(new Error('E'));
      mockMemory.getStats.mockRejectedValue(new Error('E'));
      mockDecision.getStats.mockRejectedValue(new Error('E'));
      mockExecution.getStats.mockRejectedValue(new Error('E'));
      mockKnowledge.searchNodes.mockRejectedValue(new Error('E'));
      mockAI.orchestrate.mockRejectedValue(new Error('E'));

      const snapshot = await assembler.assemble('guest_1', 'Guest');
      expect(snapshot.profile.displayName).toBe('Guest');
      expect(snapshot).toBeDefined();
    }, 15000);
  });

  describe('individual module failures', () => {
    it('handles missing Memory but others work', async () => {
      mockIdentity.getUserById.mockResolvedValue({} as any);
      mockMemory.getStats.mockRejectedValue(new Error('Memory down'));
      mockDecision.getStats.mockResolvedValue({
        success: true,
        data: { total: 0, byCategory: {}, byStatus: {}, linkedCount: 0 },
      });
      mockExecution.getStats.mockResolvedValue({ success: true, data: {} });
      mockKnowledge.searchNodes.mockResolvedValue({ nodes: [] });
      mockAI.orchestrate.mockRejectedValue(new Error('AI down'));

      const snapshot = await assembler.assemble('u1', 'User');
      expect(snapshot.profile).toBeDefined();
      expect(snapshot.jobs).toBeDefined();
    }, 15000);

    it('handles missing Knowledge but others work', async () => {
      mockIdentity.getUserById.mockResolvedValue({} as any);
      mockMemory.getStats.mockResolvedValue({
        success: true,
        data: { total: 0, byCategory: {}, byState: {}, linkedCount: 0 },
      });
      mockDecision.getStats.mockResolvedValue({
        success: true,
        data: { total: 0, byCategory: {}, byStatus: {}, linkedCount: 0 },
      });
      mockExecution.getStats.mockResolvedValue({ success: true, data: {} });
      mockKnowledge.searchNodes.mockRejectedValue(new Error('KG down'));
      mockAI.orchestrate.mockRejectedValue(new Error('AI down'));

      const snapshot = await assembler.assemble('u1', 'User');
      expect(snapshot.profile).toBeDefined();
    }, 15000);

    it('handles missing Decision', async () => {
      mockIdentity.getUserById.mockResolvedValue({} as any);
      mockMemory.getStats.mockResolvedValue({
        success: true,
        data: { total: 0, byCategory: {}, byState: {}, linkedCount: 0 },
      });
      mockDecision.getStats.mockRejectedValue(new Error('Decision down'));
      mockExecution.getStats.mockResolvedValue({ success: true, data: {} });
      mockKnowledge.searchNodes.mockResolvedValue({ nodes: [] });
      mockAI.orchestrate.mockRejectedValue(new Error('AI down'));

      const snapshot = await assembler.assemble('u1', 'User');
      expect(snapshot.profile).toBeDefined();
    }, 15000);

    it('handles missing Execution', async () => {
      mockIdentity.getUserById.mockResolvedValue({} as any);
      mockMemory.getStats.mockResolvedValue({
        success: true,
        data: { total: 0, byCategory: {}, byState: {}, linkedCount: 0 },
      });
      mockDecision.getStats.mockResolvedValue({
        success: true,
        data: { total: 0, byCategory: {}, byStatus: {}, linkedCount: 0 },
      });
      mockExecution.getStats.mockRejectedValue(new Error('Exec down'));
      mockKnowledge.searchNodes.mockResolvedValue({ nodes: [] });
      mockAI.orchestrate.mockRejectedValue(new Error('AI down'));

      const snapshot = await assembler.assemble('u1', 'User');
      expect(snapshot.profile).toBeDefined();
    }, 15000);
  });

  describe('service accessors', () => {
    it('getProfileService returns service', () => {
      expect(assembler.getProfileService()).toBeDefined();
    });
    it('getSkillsService returns service', () => {
      expect(assembler.getSkillsService()).toBeDefined();
    });
    it('getGapService returns service', () => {
      expect(assembler.getGapService()).toBeDefined();
    });
    it('getRoadmapService returns service', () => {
      expect(assembler.getRoadmapService()).toBeDefined();
    });
    it('getResumeService returns service', () => {
      expect(assembler.getResumeService()).toBeDefined();
    });
    it('getPortfolioService returns service', () => {
      expect(assembler.getPortfolioService()).toBeDefined();
    });
    it('getInterviewService returns service', () => {
      expect(assembler.getInterviewService()).toBeDefined();
    });
    it('getJobMatchingService returns service', () => {
      expect(assembler.getJobMatchingService()).toBeDefined();
    });
    it('getMarketService returns service', () => {
      expect(assembler.getMarketService()).toBeDefined();
    });
    it('getCertService returns service', () => {
      expect(assembler.getCertService()).toBeDefined();
    });
    it('getRecommendationService returns service', () => {
      expect(assembler.getRecommendationService()).toBeDefined();
    });
    it('getInsightService returns service', () => {
      expect(assembler.getInsightService()).toBeDefined();
    });
  });
});
