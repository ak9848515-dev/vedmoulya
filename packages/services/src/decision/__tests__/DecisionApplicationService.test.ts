import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DecisionApplicationService } from '../DecisionApplicationService.js';

const mockRepository = {
  findById: vi.fn(),
  findByCategory: vi.fn(),
  findByStatus: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  search: vi.fn(),
  findByKnowledgeNodeId: vi.fn(),
  findByMemoryId: vi.fn(),
  findPendingDecisions: vi.fn(),
  findRecentlyCompleted: vi.fn(),
  count: vi.fn(),
  countByCategory: vi.fn(),
  countByStatus: vi.fn(),
  countLinked: vi.fn(),
};

describe('DecisionApplicationService', () => {
  let service: DecisionApplicationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DecisionApplicationService(mockRepository);
    mockRepository.save.mockResolvedValue(undefined);
    mockRepository.update.mockResolvedValue(undefined);
    mockRepository.count.mockResolvedValue(0);
    mockRepository.countByCategory.mockResolvedValue({});
    mockRepository.countByStatus.mockResolvedValue({});
    mockRepository.countLinked.mockResolvedValue(0);
    mockRepository.search.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  describe('createDecision', () => {
    it('creates a decision successfully', async () => {
      const result = await service.createDecision({
        title: 'Test Decision',
        description: 'Test description',
        category: 'strategic',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe('Test Decision');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('fails with empty title', async () => {
      const result = await service.createDecision({
        title: '',
        description: 'Test',
        category: 'strategic',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('getDecision', () => {
    it('returns not found for missing decision', async () => {
      mockRepository.findById.mockResolvedValue(null);
      const result = await service.getDecision('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('listDecisions', () => {
    it('lists decisions with pagination', async () => {
      const result = await service.listDecisions(1, 20);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockRepository.count).toHaveBeenCalled();
      expect(mockRepository.search).toHaveBeenCalledWith({ query: '' }, { page: 1, limit: 20 });
    });
  });

  describe('searchDecisions', () => {
    it('searches with query and filters', async () => {
      const result = await service.searchDecisions({
        query: 'test',
        categories: ['strategic'],
      });

      expect(result.success).toBe(true);
      expect(mockRepository.search).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('returns statistics', async () => {
      const result = await service.getStats();
      expect(result.success).toBe(true);
      expect(mockRepository.count).toHaveBeenCalled();
      expect(mockRepository.countByCategory).toHaveBeenCalled();
      expect(mockRepository.countByStatus).toHaveBeenCalled();
      expect(mockRepository.countLinked).toHaveBeenCalled();
    });
  });
});
