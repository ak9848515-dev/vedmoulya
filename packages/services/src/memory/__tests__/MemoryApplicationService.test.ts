import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSave = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockFindById = vi.hoisted(() => vi.fn());
const mockCount = vi.hoisted(() => vi.fn());
const mockSearch = vi.hoisted(() => vi.fn());
const mockCountByCategory = vi.hoisted(() => vi.fn());
const mockCountByState = vi.hoisted(() => vi.fn());
const mockCountLinked = vi.hoisted(() => vi.fn());
const mockGetTimeline = vi.hoisted(() => vi.fn());
const mockFindByCategory = vi.hoisted(() => vi.fn());
const mockFindByState = vi.hoisted(() => vi.fn());
const mockFindByKnowledgeNodeId = vi.hoisted(() => vi.fn());
const mockFindDecayingMemories = vi.hoisted(() => vi.fn());
const mockFindMemoriesNeedingReinforcement = vi.hoisted(() => vi.fn());
const mockFindRelatedMemories = vi.hoisted(() => vi.fn());
const mockExists = vi.hoisted(() => vi.fn());
const mockValidate = vi.hoisted(() => vi.fn().mockReturnValue({ valid: true }));

vi.mock('@vedmoulya/domain', async () => {
  const actual = await vi.importActual('@vedmoulya/domain');
  return {
    ...(actual as Record<string, unknown>),
    MemoryRepository: vi.fn(),
    // Vitest 4: `new MemoryFactory(repo)` invokes the mockImplementation as a
    // constructor — arrow functions are not constructible, so use a regular
    // function (TypeError: ... is not a constructor otherwise).
    MemoryFactory: vi.fn().mockImplementation(function () {
      return { createMemory: vi.fn() };
    }),
    MemoryDomainService: vi.fn().mockImplementation(function () {
      return {
        applyDecay: vi.fn(),
        applyRetentionPolicies: vi.fn(),
        suggestConsolidation: vi.fn(),
      };
    }),
    memoryContentRule: { validate: vi.fn() },
    importanceConstraintRule: { validate: vi.fn() },
    retentionPolicyRule: { validate: vi.fn() },
    validate: mockValidate,
  };
});

vi.mock('../MemoryMapper.js', () => ({
  MemoryMapper: {
    toDTO: vi.fn((m) => ({
      id: m.id ?? 'mem-1',
      category: 'experience',
      title: m.title ?? 'Test',
      content: m.content ?? 'Content',
      importance: { level: 'medium', score: 5 },
      confidence: { level: 'medium', score: 0.6 },
      strength: { value: 0.5, interval: 24, easeFactor: 2.5 },
      state: 'active',
      source: { type: 'system_generated', detail: 'test' },
      version: 'v1.0.0',
      retentionPolicy: 'short_term',
      tags: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-06-01T00:00:00.000Z',
    })),
    toListDTO: vi.fn((data, total, page, limit) => ({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })),
    toStatsDTO: vi.fn((s) => s),
  },
}));

import { MemoryApplicationService } from '../MemoryApplicationService.js';

describe('MemoryApplicationService', () => {
  let service: MemoryApplicationService;
  let mockRepository: Record<string, vi.Mock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = {
      save: mockSave,
      update: mockUpdate,
      delete: mockDelete,
      findById: mockFindById,
      count: mockCount,
      search: mockSearch,
      countByCategory: mockCountByCategory,
      countByState: mockCountByState,
      countLinked: mockCountLinked,
      getTimeline: mockGetTimeline,
      findByCategory: mockFindByCategory,
      findByState: mockFindByState,
      findByKnowledgeNodeId: mockFindByKnowledgeNodeId,
      findDecayingMemories: mockFindDecayingMemories,
      findMemoriesNeedingReinforcement: mockFindMemoriesNeedingReinforcement,
      findRelatedMemories: mockFindRelatedMemories,
      exists: mockExists,
    } as unknown as Record<string, vi.Mock>;

    service = new MemoryApplicationService(mockRepository as never);

    // Setup factory.createMemory default mock
    const factoryCreateMemory = (service as unknown as Record<string, { createMemory: vi.Mock }>)
      .factory?.createMemory as vi.Mock | undefined;
    if (factoryCreateMemory) {
      factoryCreateMemory.mockResolvedValue({
        success: true,
        data: createMockMemoryEntity(),
      });
    }
  });

  function mockMemory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'mem-1',
      title: 'Test Memory',
      content: 'Test content',
      category: { value: 'experience' },
      importance: { level: 'medium', score: 5 },
      confidence: { level: 'medium', score: 0.6 },
      strength: { value: 0.5, interval: 24, easeFactor: 2.5 },
      state: { state: 'active', reason: null },
      source: { type: 'system_generated', detail: 'test' },
      version: { major: 1, minor: 0, patch: 0, label: 'v1.0.0' },
      retentionPolicy: { retentionClass: 'short_term', ttlDays: 30 },
      tags: [],
      metadata: {},
      entityStatus: 'active',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-06-01'),
      lastRecalledAt: undefined,
      knowledgeNodeId: undefined,
      pullEvents: () => [],
      recall: vi.fn(),
      failedRecall: vi.fn(),
      update: vi.fn(),
      addTag: vi.fn(),
      updateMetadata: vi.fn(),
      increaseImportance: vi.fn(),
      decreaseImportance: vi.fn(),
      strengthenConfidence: vi.fn(),
      weakenConfidence: vi.fn(),
      merge: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
      forget: vi.fn(),
      ...overrides,
    };
  }

  // ── captureMemory ──────────────────────────────────────────────────────

  describe('captureMemory', () => {
    it('captures a memory successfully', async () => {
      const dto = { category: 'experience', title: 'Test', content: 'Content' };
      mockFindById.mockResolvedValue(null);
      mockSave.mockResolvedValue(undefined);

      const result = await service.captureMemory(dto as never);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.title).toBe('Test Memory');
      }
    });

    it('returns error when factory fails', async () => {
      const serviceAny = service as unknown as Record<string, { createMemory: vi.Mock }>;
      const factory = serviceAny.factory;
      if (factory?.createMemory) {
        factory.createMemory.mockResolvedValue({ success: false, error: 'Invalid category' });
      }

      const dto = { category: 'invalid', title: 'Test', content: 'Content' };
      const result = await service.captureMemory(dto as never);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error when validation fails', async () => {
      mockValidate.mockReturnValueOnce({ valid: false, message: 'Content too short' });

      const dto = { category: 'experience', title: 'Test', content: 'Abc' };
      const result = await service.captureMemory(dto as never);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Content too short');
    });
  });

  // ── recallMemory ───────────────────────────────────────────────────────

  describe('recallMemory', () => {
    it('recalls and strengthens a memory on success', async () => {
      const memory = mockMemory();
      const recallFn = vi.fn();
      mockFindById.mockResolvedValue(memory);
      mockUpdate.mockResolvedValue(undefined);

      const result = await service.recallMemory('mem-1', true);
      expect(result.success).toBe(true);
      expect(mockFindById).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('returns error when memory not found', async () => {
      mockFindById.mockResolvedValue(null);
      const result = await service.recallMemory('nonexistent', true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ── updateMemory ────────────────────────────────────────────────────────

  describe('updateMemory', () => {
    it('updates title and content', async () => {
      const memory = mockMemory();
      mockFindById.mockResolvedValue(memory);
      mockUpdate.mockResolvedValue(undefined);

      const result = await service.updateMemory('mem-1', {
        title: 'New',
        content: 'New content',
      } as never);
      expect(result.success).toBe(true);
    });

    it('returns error when memory not found', async () => {
      mockFindById.mockResolvedValue(null);
      const result = await service.updateMemory('nonexistent', {} as never);
      expect(result.success).toBe(false);
    });
  });

  // ── strengthenMemory ────────────────────────────────────────────────────

  describe('strengthenMemory', () => {
    it('strengthens a memory', async () => {
      const memory = mockMemory();
      mockFindById.mockResolvedValue(memory);
      mockUpdate.mockResolvedValue(undefined);

      const result = await service.strengthenMemory('mem-1');
      expect(result.success).toBe(true);
    });
  });

  // ── weakenMemory ────────────────────────────────────────────────────────

  describe('weakenMemory', () => {
    it('weakens a memory', async () => {
      const memory = mockMemory();
      mockFindById.mockResolvedValue(memory);
      mockUpdate.mockResolvedValue(undefined);

      const result = await service.weakenMemory('mem-1');
      expect(result.success).toBe(true);
    });
  });

  // ── mergeMemories ───────────────────────────────────────────────────────

  describe('mergeMemories', () => {
    it('merges two memories', async () => {
      const source = mockMemory({ id: 'mem-1' });
      const target = mockMemory({ id: 'mem-2' });
      mockFindById.mockResolvedValueOnce(source).mockResolvedValueOnce(target);
      mockUpdate.mockResolvedValue(undefined);
      mockDelete.mockResolvedValue(undefined);

      const result = await service.mergeMemories('mem-1', 'mem-2');
      expect(result.success).toBe(true);
    });

    it('returns error when source not found', async () => {
      mockFindById.mockResolvedValueOnce(null);
      const result = await service.mergeMemories('nonexistent', 'mem-2');
      expect(result.success).toBe(false);
    });
  });

  // ── archiveMemory ────────────────────────────────────────────────────────

  describe('archiveMemory', () => {
    it('archives a memory', async () => {
      const memory = mockMemory();
      mockFindById.mockResolvedValue(memory);
      mockUpdate.mockResolvedValue(undefined);

      const result = await service.archiveMemory('mem-1');
      expect(result.success).toBe(true);
    });
  });

  // ── restoreMemory ──────────────────────────────────────────────────────

  describe('restoreMemory', () => {
    it('restores an archived memory', async () => {
      const memory = mockMemory();
      mockFindById.mockResolvedValue(memory);
      mockUpdate.mockResolvedValue(undefined);

      const result = await service.restoreMemory('mem-1');
      expect(result.success).toBe(true);
    });
  });

  // ── forgetMemory ────────────────────────────────────────────────────────

  describe('forgetMemory', () => {
    it('forgets a memory', async () => {
      const memory = mockMemory();
      mockFindById.mockResolvedValue(memory);
      mockUpdate.mockResolvedValue(undefined);

      const result = await service.forgetMemory('mem-1');
      expect(result.success).toBe(true);
    });

    it('returns error when memory not found', async () => {
      mockFindById.mockResolvedValue(null);
      const result = await service.forgetMemory('nonexistent');
      expect(result.success).toBe(false);
    });
  });

  // ── getMemory ──────────────────────────────────────────────────────────

  describe('getMemory', () => {
    it('returns a memory by id', async () => {
      const memory = mockMemory();
      mockFindById.mockResolvedValue(memory);

      const result = await service.getMemory('mem-1');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  // ── listMemories ────────────────────────────────────────────────────────

  describe('listMemories', () => {
    it('lists memories with pagination', async () => {
      mockCount.mockResolvedValue(50);
      mockSearch.mockResolvedValue({
        data: [mockMemory(), mockMemory()],
        total: 50,
      });

      const result = await service.listMemories(1, 20);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('handles list errors', async () => {
      mockCount.mockRejectedValue(new Error('DB error'));
      const result = await service.listMemories(1, 20);
      expect(result.success).toBe(false);
    });
  });

  // ── searchMemories ─────────────────────────────────────────────────────

  describe('searchMemories', () => {
    it('searches with filters', async () => {
      mockSearch.mockResolvedValue({
        data: [mockMemory()],
        total: 5,
      });

      const result = await service.searchMemories({
        query: 'test',
        categories: ['experience'],
        states: ['active'],
        page: 1,
        limit: 20,
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('handles search errors', async () => {
      mockSearch.mockRejectedValue(new Error('Search error'));
      const result = await service.searchMemories({ query: 'test' });
      expect(result.success).toBe(false);
    });
  });

  // ── getStats ─────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns memory statistics', async () => {
      mockCount.mockResolvedValue(100);
      mockCountByCategory.mockResolvedValue({ experience: 40, observation: 30 });
      mockCountByState.mockResolvedValue({ active: 80, archived: 20 });
      mockCountLinked.mockResolvedValue(15);

      const result = await service.getStats();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.total).toBe(100);
        expect(result.data.byCategory).toBeDefined();
      }
    });

    it('handles stats errors', async () => {
      mockCount.mockRejectedValue(new Error('Stats error'));
      const result = await service.getStats();
      expect(result.success).toBe(false);
    });
  });
});

function createMockMemoryEntity(): Record<string, unknown> {
  return {
    id: 'mem-1',
    title: 'Test Memory',
    content: 'Test content',
    category: { value: 'experience' },
    importance: { level: 'medium', score: 5 },
    confidence: { level: 'medium', score: 0.6 },
    strength: { value: 0.5, interval: 24, easeFactor: 2.5 },
    state: { state: 'active', reason: null },
    source: { type: 'system_generated', detail: 'test' },
    version: { major: 1, minor: 0, patch: 0, label: 'v1.0.0' },
    retentionPolicy: { retentionClass: 'short_term', ttlDays: 30 },
    tags: [],
    metadata: {},
    entityStatus: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    lastRecalledAt: undefined,
    knowledgeNodeId: undefined,
    pullEvents: () => [],
    recall: vi.fn(),
    failedRecall: vi.fn(),
    update: vi.fn(),
    addTag: vi.fn(),
    updateMetadata: vi.fn(),
    increaseImportance: vi.fn(),
    decreaseImportance: vi.fn(),
    strengthenConfidence: vi.fn(),
    weakenConfidence: vi.fn(),
    merge: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    forget: vi.fn(),
  };
}
