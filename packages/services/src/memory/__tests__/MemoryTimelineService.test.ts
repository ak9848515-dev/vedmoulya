import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGetTimeline = vi.hoisted(() => vi.fn());
const mockSearch = vi.hoisted(() => vi.fn());
const mockCount = vi.hoisted(() => vi.fn());
const mockCountByCategory = vi.hoisted(() => vi.fn());
const mockToDTO = vi.hoisted(() => vi.fn());
const mockToTimelineEntries = vi.hoisted(() => vi.fn());

vi.mock('../MemoryMapper.js', () => ({
  MemoryMapper: {
    toDTO: mockToDTO,
    toTimelineEntries: mockToTimelineEntries,
  },
}));

import { MemoryTimelineService } from '../MemoryTimelineService.js';

describe('MemoryTimelineService', () => {
  let service: MemoryTimelineService;
  let mockRepository: Record<string, vi.Mock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = {
      getTimeline: mockGetTimeline,
      search: mockSearch,
      count: mockCount,
      countByCategory: mockCountByCategory,
    } as never;

    service = new MemoryTimelineService(mockRepository as never);

    mockToDTO.mockReturnValue({
      id: 'mem-1',
      title: 'Test',
      category: 'experience',
    });

    mockToTimelineEntries.mockReturnValue([]);
  });

  describe('getTimeline', () => {
    it('returns timeline entries in descending order', async () => {
      mockGetTimeline.mockResolvedValue([
        { memory: { id: 'mem-1' }, date: new Date(), type: 'created' },
      ]);
      mockToTimelineEntries.mockReturnValue([
        {
          memory: { id: 'mem-1' },
          date: new Date().toISOString(),
          type: 'created',
        },
      ]);

      const result = await service.getTimeline('desc');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('returns timeline entries in ascending order', async () => {
      mockGetTimeline.mockResolvedValue([]);

      const result = await service.getTimeline('asc');
      expect(result.success).toBe(true);
    });

    it('handles timeline errors', async () => {
      mockGetTimeline.mockRejectedValue(new Error('Timeline error'));
      const result = await service.getTimeline();
      expect(result.success).toBe(false);
    });

    it('uses default pagination when not specified', async () => {
      mockGetTimeline.mockResolvedValue([]);
      await service.getTimeline();

      expect(mockGetTimeline).toHaveBeenCalledWith('desc', { page: 1, limit: 50 });
    });

    it('passes custom pagination', async () => {
      mockGetTimeline.mockResolvedValue([]);
      await service.getTimeline('desc', 2, 10);

      expect(mockGetTimeline).toHaveBeenCalledWith('desc', { page: 2, limit: 10 });
    });
  });

  describe('getMemoriesByDateRange', () => {
    it('returns memories within date range', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      mockSearch.mockResolvedValue({ data: [{ id: 'mem-1' }], total: 1 });
      mockToDTO.mockReturnValue({ id: 'mem-1' });

      const result = await service.getMemoriesByDateRange(from, to);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('handles date range errors', async () => {
      mockSearch.mockRejectedValue(new Error('Date error'));
      const result = await service.getMemoriesByDateRange(new Date(), new Date());
      expect(result.success).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('returns timeline summary with date range', async () => {
      mockCount.mockResolvedValue(42);
      mockCountByCategory.mockResolvedValue({ experience: 20, observation: 22 });

      const recentDate = new Date('2024-06-01');
      const oldestDate = new Date('2024-01-01');
      mockGetTimeline
        .mockResolvedValueOnce([{ memory: { id: 'mem-2' }, date: recentDate, type: 'created' }])
        .mockResolvedValueOnce([{ memory: { id: 'mem-1' }, date: oldestDate, type: 'created' }]);

      const result = await service.getSummary();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.total).toBe(42);
        expect(result.data.dateRange.from).toBeDefined();
        expect(result.data.dateRange.to).toBeDefined();
        expect(result.data.categories).toBeDefined();
      }
    });

    it('handles empty timeline', async () => {
      mockCount.mockResolvedValue(0);
      mockCountByCategory.mockResolvedValue({});
      mockGetTimeline.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.getSummary();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('handles summary errors', async () => {
      mockCount.mockRejectedValue(new Error('Count error'));
      const result = await service.getSummary();
      expect(result.success).toBe(false);
    });
  });
});
