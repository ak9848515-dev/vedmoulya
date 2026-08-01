import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFindByState = vi.hoisted(() => vi.fn());
const mockSearch = vi.hoisted(() => vi.fn());
const mockCount = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockFindMemoriesNeedingReinforcement = vi.hoisted(() => vi.fn());
const mockApplyDecay = vi.hoisted(() => vi.fn());
const mockApplyRetentionPolicies = vi.hoisted(() => vi.fn());
const mockSuggestConsolidation = vi.hoisted(() => vi.fn());

vi.mock('@vedmoulya/domain', async () => {
  const actual = await vi.importActual('@vedmoulya/domain');
  return {
    ...(actual as Record<string, unknown>),
    MemoryRepository: vi.fn(),
    // Vitest 4: `new MemoryDomainService(repo)` constructs the mock — arrow
    // functions are not constructible, so use a regular function.
    MemoryDomainService: vi.fn().mockImplementation(function () {
      return {
        applyDecay: mockApplyDecay,
        applyRetentionPolicies: mockApplyRetentionPolicies,
        suggestConsolidation: mockSuggestConsolidation,
      };
    }),
  };
});

const mockToDecayResults = vi.hoisted(() => vi.fn());
const mockToRetentionResult = vi.hoisted(() => vi.fn());
const mockToConsolidationSuggestions = vi.hoisted(() => vi.fn());
const mockToListDTO = vi.hoisted(() => vi.fn());

vi.mock('../MemoryMapper.js', () => ({
  MemoryMapper: {
    toDecayResults: mockToDecayResults,
    toRetentionResult: mockToRetentionResult,
    toConsolidationSuggestions: mockToConsolidationSuggestions,
    toListDTO: mockToListDTO,
  },
}));

import { MemoryRetentionService } from '../MemoryRetentionService.js';

describe('MemoryRetentionService', () => {
  let service: MemoryRetentionService;
  let mockRepository: Record<string, vi.Mock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = {
      findByState: mockFindByState,
      search: mockSearch,
      count: mockCount,
      update: mockUpdate,
      findMemoriesNeedingReinforcement: mockFindMemoriesNeedingReinforcement,
    } as never;

    service = new MemoryRetentionService(mockRepository as never);
  });

  describe('applyDecay', () => {
    it('applies decay and returns results', async () => {
      mockApplyDecay.mockResolvedValue({
        success: true,
        data: [
          {
            memoryId: 'mem-1',
            previousStrength: 0.5,
            newStrength: 0.3,
            transitioned: true,
            newState: 'decaying',
          },
        ],
      });
      mockToDecayResults.mockReturnValue([
        {
          memoryId: 'mem-1',
          previousStrength: 0.5,
          newStrength: 0.3,
          transitioned: true,
          newState: 'decaying',
        },
      ]);

      const result = await service.applyDecay();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0]!.memoryId).toBe('mem-1');
    });

    it('handles decay errors', async () => {
      mockApplyDecay.mockResolvedValue({ success: false, error: 'Decay failed' });
      const result = await service.applyDecay();
      expect(result.success).toBe(false);
    });
  });

  describe('applyRetentionPolicies', () => {
    it('applies retention and returns counts', async () => {
      mockApplyRetentionPolicies.mockResolvedValue({
        success: true,
        data: { archived: 5, forgotten: 3 },
      });
      mockToRetentionResult.mockReturnValue({ archived: 5, forgotten: 3 });

      const result = await service.applyRetentionPolicies();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.archived).toBe(5);
        expect(result.data.forgotten).toBe(3);
      }
    });

    it('handles retention errors', async () => {
      mockApplyRetentionPolicies.mockResolvedValue({ success: false, error: 'Retention failed' });
      const result = await service.applyRetentionPolicies();
      expect(result.success).toBe(false);
    });
  });

  describe('getConsolidationSuggestions', () => {
    it('returns consolidation suggestions', async () => {
      mockSuggestConsolidation.mockResolvedValue({
        success: true,
        data: [
          { sourceId: 'mem-1', targetId: 'mem-2', reason: 'Similar content', confidence: 0.85 },
        ],
      });
      mockToConsolidationSuggestions.mockReturnValue([
        { sourceId: 'mem-1', targetId: 'mem-2', reason: 'Similar content', confidence: 0.85 },
      ]);

      const result = await service.getConsolidationSuggestions();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('filters by category', async () => {
      mockSuggestConsolidation.mockResolvedValue({ success: true, data: [] });
      mockToConsolidationSuggestions.mockReturnValue([]);

      await service.getConsolidationSuggestions('experience');
      expect(mockSuggestConsolidation).toHaveBeenCalledWith('experience');
    });

    it('handles consolidation errors', async () => {
      mockSuggestConsolidation.mockResolvedValue({ success: false, error: 'Consolidation error' });
      const result = await service.getConsolidationSuggestions();
      expect(result.success).toBe(false);
    });
  });

  describe('getMemoriesNeedingReinforcement', () => {
    it('returns memories needing reinforcement', async () => {
      mockFindMemoriesNeedingReinforcement.mockResolvedValue({
        data: [{ id: 'mem-1' }, { id: 'mem-2' }],
        total: 10,
      });
      mockCount.mockResolvedValue(100);
      mockToListDTO.mockReturnValue({
        data: [{ id: 'mem-1' }, { id: 'mem-2' }],
        total: 100,
        page: 1,
        limit: 20,
        totalPages: 5,
      });

      const result = await service.getMemoriesNeedingReinforcement(1, 20);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('handles reinforcement errors', async () => {
      mockFindMemoriesNeedingReinforcement.mockRejectedValue(new Error('Reinforcement error'));
      const result = await service.getMemoriesNeedingReinforcement();
      expect(result.success).toBe(false);
    });
  });
});
