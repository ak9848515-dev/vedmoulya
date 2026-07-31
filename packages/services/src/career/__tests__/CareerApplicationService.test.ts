import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CareerApplicationService } from '../CareerApplicationService.js';

describe('CareerApplicationService', () => {
  let service: CareerApplicationService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));

    const mockIdentity = { getUserById: vi.fn().mockRejectedValue(new Error('Not found')) } as any;
    const mockMemory = {
      getStats: vi.fn().mockResolvedValue({ success: false, error: 'E' }),
    } as any;
    const mockDecision = {
      getStats: vi.fn().mockResolvedValue({ success: false, error: 'E' }),
    } as any;
    const mockExecution = {
      getStats: vi.fn().mockResolvedValue({ success: false, error: 'E' }),
    } as any;
    const mockKnowledge = { searchNodes: vi.fn().mockResolvedValue({ nodes: [] }) } as any;
    const mockAI = { orchestrate: vi.fn().mockRejectedValue(new Error('AI error')) } as any;

    service = new CareerApplicationService(
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

  describe('getCareer', () => {
    it('returns a career snapshot', async () => {
      const result = await service.getCareer('user_1', 'Test');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.userId).toBe('user_1');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('returns cached snapshot on second call', async () => {
      await service.getCareer('user_1', 'Test');
      const result = await service.getCareer('user_1', 'Test');
      expect(result.success).toBe(true);
    }, 15000);
  });

  describe('getCareerViewModel', () => {
    it('returns a career dashboard view model', async () => {
      const result = await service.getCareerViewModel('user_1', 'Test');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.profile.displayName).toBe('Test');
    }, 15000);
  });

  describe('configuration', () => {
    it('getConfig returns default config', () => {
      const config = service.getConfig('user_1');
      expect(config.userId).toBe('user_1');
      expect(config.jobSearchActive).toBe(false);
    });

    it('updateConfig modifies config', () => {
      const updated = service.updateConfig('user_1', { jobSearchActive: true });
      expect(updated.jobSearchActive).toBe(true);
    });

    it('resetConfig restores defaults', () => {
      service.updateConfig('user_1', { jobSearchActive: true });
      const reset = service.resetConfig('user_1');
      expect(reset.jobSearchActive).toBe(false);
    });
  });

  describe('cache', () => {
    it('invalidateCache does not throw', () => {
      expect(() => service.invalidateCache('user_1')).not.toThrow();
    });
  });

  describe('health', () => {
    it('reportServiceHealth and isHealthy', () => {
      service.reportServiceHealth('career', 'healthy', 5);
      expect(service.isHealthy()).toBe(true);
    });

    it('isHealthy returns false with no services', () => {
      expect(service.isHealthy()).toBe(false);
    });
  });

  describe('analytics', () => {
    it('getAnalytics returns analytics data', () => {
      const a = service.getAnalytics();
      expect(a.totalLoads).toBeGreaterThanOrEqual(0);
    });
  });
});
