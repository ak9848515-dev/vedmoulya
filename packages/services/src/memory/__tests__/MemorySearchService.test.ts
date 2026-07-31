import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSearch = vi.hoisted(() => vi.fn());
const mockCount = vi.hoisted(() => vi.fn());
const mockFindRelatedMemories = vi.hoisted(() => vi.fn());
const mockFindByKnowledgeNodeId = vi.hoisted(() => vi.fn());
const mockToDTO = vi.hoisted(() => vi.fn());
const mockToListDTO = vi.hoisted(() => vi.fn());

vi.mock('../MemoryMapper.js', () => ({
  MemoryMapper: {
    toDTO: mockToDTO,
    toListDTO: mockToListDTO,
  },
}));

import { MemorySearchService } from '../MemorySearchService.js';

describe('MemorySearchService', () => {
  let service: MemorySearchService;
  let mockRepository: Record<string, vi.Mock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = {
      search: mockSearch,
      count: mockCount,
      findRelatedMemories: mockFindRelatedMemories,
      findByKnowledgeNodeId: mockFindByKnowledgeNodeId,
    } as never;

    service = new MemorySearchService(mockRepository as never);

    mockToDTO.mockReturnValue({
      id: 'mem-1',
      title: 'Test',
      category: 'experience',
      importance: { level: 'medium', score: 5 },
      confidence: { level: 'medium', score: 0.6 },
      state: 'active',
    });

    mockToListDTO.mockReturnValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  describe('search', () => {
    it('performs search with query filter', async () => {
      mockSearch.mockResolvedValue({ data: [], total: 0 });
      mockCount.mockResolvedValue(0);

      const result = await service.search({ query: 'test' });
      expect(result.success).toBe(true);
      expect(mockSearch).toHaveBeenCalled();
    });

    it('performs search with categories filter', async () => {
      mockSearch.mockResolvedValue({ data: [{}], total: 5 });
      mockCount.mockResolvedValue(5);
      mockToListDTO.mockReturnValue({
        data: [{ id: 'mem-1' }],
        total: 5,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await service.search({
        categories: ['experience', 'observation'],
        page: 1,
        limit: 20,
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('handles search errors', async () => {
      mockSearch.mockRejectedValue(new Error('Search failed'));
      const result = await service.search({ query: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('passes date range filters', async () => {
      mockSearch.mockResolvedValue({ data: [], total: 0 });
      mockCount.mockResolvedValue(0);

      await service.search({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      });

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: expect.any(Date),
          dateTo: expect.any(Date),
        }),
        expect.any(Object),
      );
    });

    it('passes importance range and tags', async () => {
      mockSearch.mockResolvedValue({ data: [], total: 0 });
      mockCount.mockResolvedValue(0);

      await service.search({
        importanceMin: 5,
        importanceMax: 10,
        tags: ['important'],
        knowledgeNodeId: 'kg-1',
      });

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          importanceMin: 5,
          importanceMax: 10,
          tags: ['important'],
          knowledgeNodeId: 'kg-1',
        }),
        expect.any(Object),
      );
    });
  });

  describe('findRelated', () => {
    it('finds related memories by category', async () => {
      mockFindRelatedMemories.mockResolvedValue({ data: [{ id: 'mem-1' }], total: 1 });
      mockToDTO.mockReturnValue({ id: 'mem-1' });

      const result = await service.findRelated('experience');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('handles related errors', async () => {
      mockFindRelatedMemories.mockRejectedValue(new Error('Related error'));
      const result = await service.findRelated('experience');
      expect(result.success).toBe(false);
    });
  });

  describe('findByKnowledgeNode', () => {
    it('finds memories by knowledge node id', async () => {
      mockFindByKnowledgeNodeId.mockResolvedValue([{ id: 'mem-1' }]);
      mockToDTO.mockReturnValue({ id: 'mem-1' });

      const result = await service.findByKnowledgeNode('kg-1');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('returns empty array when no memories linked', async () => {
      mockFindByKnowledgeNodeId.mockResolvedValue([]);
      const result = await service.findByKnowledgeNode('kg-999');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('handles knowledge node errors', async () => {
      mockFindByKnowledgeNodeId.mockRejectedValue(new Error('DB error'));
      const result = await service.findByKnowledgeNode('kg-1');
      expect(result.success).toBe(false);
    });
  });
});
