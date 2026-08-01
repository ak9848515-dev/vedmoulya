import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryReflectionService } from '../MemoryReflectionService.js';
import { MemoryMapper } from '../MemoryMapper.js';

const mockFindByCategory = vi.hoisted(() => vi.fn());
const mockSearch = vi.hoisted(() => vi.fn());

function createMockMemory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    title: 'Test Memory',
    content: 'Test content about important things',
    category: { value: 'experience', toString: () => 'experience' },
    importance: { level: 'medium', score: 5 },
    confidence: { level: 'medium', score: 0.6 },
    strength: { value: 0.5, interval: 24, easeFactor: 2.5, isWeak: () => false },
    state: { state: 'active' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  };
}

describe('MemoryReflectionService', () => {
  let service: MemoryReflectionService;
  let mockRepository: Record<string, ReturnType<typeof vi.fn>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let toDTOSpy: ReturnType<typeof vi.spyOn<any, any>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = {
      findByCategory: mockFindByCategory,
      search: mockSearch,
    } as never;

    service = new MemoryReflectionService(mockRepository as never);

    toDTOSpy = vi.spyOn(MemoryMapper, 'toDTO').mockImplementation(
      (m: Record<string, unknown>) =>
        ({
          id: m.id,
          title: m.title,
          content: m.content,
          category: 'experience',
          importance: m.importance,
        }) as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reflectOnCategory', () => {
    it('returns reflection data for a category with memories', async () => {
      const memories = [
        createMockMemory({
          id: 'mem-1',
          title: 'Important meeting',
          importance: { level: 'high', score: 8 },
        }),
        createMockMemory({
          id: 'mem-2',
          title: 'Team discussion',
          importance: { level: 'medium', score: 5 },
        }),
        createMockMemory({
          id: 'mem-3',
          title: 'Project review',
          importance: { level: 'high', score: 7 },
        }),
      ];

      mockFindByCategory.mockResolvedValue({
        data: memories,
        total: 3,
      });

      toDTOSpy.mockImplementation(
        (m: Record<string, unknown>) =>
          ({
            id: m.id,
            title: m.title,
            content: m.content,
            category: 'experience',
            importance: m.importance,
          }) as never,
      );

      const result = await service.reflectOnCategory('experience' as never);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.memoryCount).toBe(3);
        expect(result.data.category).toBe('experience');
        expect(result.data.averageImportance).toBeGreaterThan(0);
        expect(result.data.keyTopics).toBeDefined();
        expect(result.data.patterns).toBeDefined();
      }
    });

    it('returns empty reflection for category with no memories', async () => {
      mockFindByCategory.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await service.reflectOnCategory('experience' as never);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.memoryCount).toBe(0);
        expect(result.data.patterns).toContain('No memories recorded yet in this category');
      }
    });

    it('detects high-importance pattern', async () => {
      const mockMemory = () => ({
        ...createMockMemory(),
        importance: { score: 8, level: 'high' },
      });
      const memories = [mockMemory(), mockMemory(), mockMemory()];

      mockFindByCategory.mockResolvedValue({ data: memories, total: 3 });

      const result = await service.reflectOnCategory('experience' as never);
      expect(result.success).toBe(true);
      if (result.data) {
        const hasHighImportance = result.data.patterns.some((p) => p.includes('high-importance'));
        expect(hasHighImportance).toBe(true);
      }
    });

    it('detects weak memories pattern', async () => {
      const memories = [];
      for (let i = 0; i < 5; i++) {
        memories.push({
          ...createMockMemory(),
          strength: { value: 0.1, interval: 1, easeFactor: 1.3, isWeak: () => true },
        });
      }

      mockFindByCategory.mockResolvedValue({ data: memories, total: 5 });

      const result = await service.reflectOnCategory('experience' as never);
      expect(result.success).toBe(true);
      if (result.data) {
        const hasWeakPattern = result.data.patterns.some((p) => p.includes('reinforcement'));
        expect(hasWeakPattern).toBe(true);
      }
    });

    it('handles reflection errors', async () => {
      mockFindByCategory.mockRejectedValue(new Error('Reflection error'));
      const result = await service.reflectOnCategory('experience' as never);
      expect(result.success).toBe(false);
    });
  });

  describe('prepareAIContext', () => {
    it('prepares context data for AI orchestrator', async () => {
      const memories = [
        createMockMemory({ id: 'mem-1', title: 'Important', content: 'Key insight discovered' }),
        createMockMemory({ id: 'mem-2', title: 'Observation', content: 'Noticed pattern in data' }),
      ];

      mockSearch.mockResolvedValue({ data: memories, total: 2 });

      const result = await service.prepareAIContext({
        maxMemories: 10,
        categories: ['experience' as never],
        importanceMin: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.context).toBeDefined();
        expect(result.data.memories).toHaveLength(2);
        expect(result.data.memories[0]!.id).toBeDefined();
        expect(result.data.memories[0]!.importance).toBeDefined();
      }
    });

    it('handles AI context errors', async () => {
      mockSearch.mockRejectedValue(new Error('Search error'));
      const result = await service.prepareAIContext({});
      expect(result.success).toBe(false);
    });
  });
});
