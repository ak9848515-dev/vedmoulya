import { describe, it, expect, vi } from 'vitest';
import { MemoryDomainService } from '../services/MemoryDomainService.js';
import type { MemoryRepository } from '../repository/MemoryRepository.js';
import type { Memory } from '../entities/Memory.js';
import { MemoryCategory } from '../value-objects/MemoryCategory.js';
import { MemoryImportance } from '../value-objects/MemoryImportance.js';
import { MemoryConfidence } from '../value-objects/MemoryConfidence.js';
import { generateMemoryId } from '../value-objects/MemoryId.js';

function createMockMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: generateMemoryId(),
    category: MemoryCategory.experience(),
    title: 'Mock Memory',
    content: 'Mock content',
    importance: MemoryImportance.medium(),
    confidence: MemoryConfidence.medium(),
    strength: {
      value: 0.5,
      interval: 24,
      easeFactor: 2.5,
      isStrong: () => false,
      isWeak: () => false,
      equals: () => false,
      toString: () => '',
      successfulRecall: () => null as never,
      failedRecall: () => null as never,
      decay: () => null as never,
      predictStrength: () => 0,
    },
    freshness: {
      state: 'recent' as const,
      hoursSinceRecall: 12,
      recallCount: 3,
      isVivid: () => false,
      isStale: () => false,
      lastRecalledAt: new Date(),
      equals: () => false,
      toString: () => '',
      recall: () => null as never,
    },
    state: {
      state: 'active' as const,
      isActive: true,
      isDecaying: false,
      isArchived: false,
      isForgotten: false,
      isRecalled: false,
      isStrengthened: false,
      isMerged: false,
      reason: undefined,
      canTransitionTo: () => false,
      equals: () => false,
      toString: () => '',
    },
    source: {
      type: 'system_generated' as const,
      detail: 'test',
      timestamp: new Date(),
      equals: () => false,
      toString: () => '',
    },
    version: {
      major: 1,
      minor: 0,
      patch: 0,
      label: 'v1.0.0',
      isNewerThan: () => false,
      equals: () => false,
      toString: () => '',
      bumpPatch: () => null as never,
      bumpMinor: () => null as never,
      bumpMajor: () => null as never,
    },
    retentionPolicy: {
      retentionClass: 'short_term' as const,
      ttlDays: 30,
      minImportanceScore: 3,
      requireReinforcement: true,
      isPermanent: false,
      shouldRetain: () => true,
      equals: () => false,
      toString: () => '',
    },
    entityStatus: 'active' as const,
    tags: [] as readonly string[],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    lastRecalledAt: undefined,
    knowledgeNodeId: undefined,
    pullEvents: () => [],
    update: vi.fn(),
    recall: vi.fn(),
    failedRecall: vi.fn(),
    increaseImportance: vi.fn(),
    decreaseImportance: vi.fn(),
    strengthenConfidence: vi.fn(),
    weakenConfidence: vi.fn(),
    applyDecay: vi.fn(),
    linkToKnowledgeNode: vi.fn(),
    unlinkFromKnowledgeNode: vi.fn(),
    merge: vi.fn(),
    changeCategory: vi.fn(),
    changeRetentionPolicy: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    forget: vi.fn(),
    addTag: vi.fn(),
    removeTag: vi.fn(),
    updateMetadata: vi.fn(),
    ...overrides,
  } as unknown as Memory;
}

describe('MemoryDomainService', () => {
  let service: MemoryDomainService;
  let mockRepository: MemoryRepository;

  beforeEach(() => {
    mockRepository = {
      count: vi.fn().mockResolvedValue(0),
      countByCategory: vi.fn().mockResolvedValue({}),
      countByState: vi.fn().mockResolvedValue({}),
      countLinked: vi.fn().mockResolvedValue(0),
      findById: vi.fn(),
      findByCategory: vi.fn(),
      findByState: vi.fn(),
      search: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      getTimeline: vi.fn().mockResolvedValue([]),
      findByKnowledgeNodeId: vi.fn().mockResolvedValue([]),
      findDecayingMemories: vi
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      findMemoriesNeedingReinforcement: vi
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      findRelatedMemories: vi
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    } as unknown as MemoryRepository;
    service = new MemoryDomainService(mockRepository);
  });

  describe('calculateImportance', () => {
    it('calculates base importance from recall frequency', () => {
      const imp = MemoryDomainService.calculateImportance({
        recallFrequency: 0,
        timeSpan: 100,
        relevanceScore: 0,
      });
      expect(imp.score).toBeGreaterThanOrEqual(1);
    });

    it('boosts importance for recent memories', () => {
      const recent = MemoryDomainService.calculateImportance({
        recallFrequency: 0,
        timeSpan: 1,
        relevanceScore: 0,
      });
      const old = MemoryDomainService.calculateImportance({
        recallFrequency: 0,
        timeSpan: 100,
        relevanceScore: 0,
      });
      expect(recent.score).toBeGreaterThan(old.score);
    });

    it('boosts importance for high relevance', () => {
      const relevant = MemoryDomainService.calculateImportance({
        recallFrequency: 0,
        timeSpan: 30,
        relevanceScore: 1.0,
      });
      const notRelevant = MemoryDomainService.calculateImportance({
        recallFrequency: 0,
        timeSpan: 30,
        relevanceScore: 0,
      });
      expect(relevant.score).toBeGreaterThan(notRelevant.score);
    });

    it('includes user feedback in calculation', () => {
      const imp = MemoryDomainService.calculateImportance({
        recallFrequency: 0,
        timeSpan: 30,
        relevanceScore: 0,
        userFeedback: 10,
      });
      expect(imp.score).toBeGreaterThan(3);
    });

    it('boosts for knowledge graph connection', () => {
      const connected = MemoryDomainService.calculateImportance({
        recallFrequency: 0,
        timeSpan: 30,
        relevanceScore: 0,
        connectedToKnowledge: true,
      });
      const notConnected = MemoryDomainService.calculateImportance({
        recallFrequency: 0,
        timeSpan: 30,
        relevanceScore: 0,
      });
      expect(connected.score).toBeGreaterThan(notConnected.score);
    });
  });

  describe('calculateConfidence', () => {
    it('computes confidence from source reliability', () => {
      const conf = MemoryDomainService.calculateConfidence({
        sourceReliability: 1.0,
        corroborationCount: 0,
        timeSinceCreation: 1,
        recallSuccessRate: 1.0,
      });
      expect(conf.score).toBeGreaterThan(0.5);
    });

    it('increases confidence with corroboration', () => {
      const high = MemoryDomainService.calculateConfidence({
        sourceReliability: 0,
        corroborationCount: 10,
        timeSinceCreation: 1,
        recallSuccessRate: 0,
      });
      expect(high.score).toBeGreaterThan(0.3);
    });

    it('reduces confidence for very old memories', () => {
      const old = MemoryDomainService.calculateConfidence({
        sourceReliability: 0,
        corroborationCount: 0,
        timeSinceCreation: 400,
        recallSuccessRate: 0,
      });
      expect(old.score).toBeLessThanOrEqual(0.3);
    });

    it('clamps score between 0 and 1', () => {
      const maxed = MemoryDomainService.calculateConfidence({
        sourceReliability: 1.0,
        corroborationCount: 10,
        timeSinceCreation: 1,
        recallSuccessRate: 1.0,
      });
      expect(maxed.score).toBeLessThanOrEqual(1);
      expect(maxed.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('suggestConsolidation', () => {
    it('returns empty suggestions when no memories exist', async () => {
      mockRepository.search = vi
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 });
      const result = await service.suggestConsolidation();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('suggests consolidation for similar memories', async () => {
      const mem1 = createMockMemory({
        id: generateMemoryId(),
        category: MemoryCategory.insight(),
        importance: MemoryImportance.medium(),
      });
      const mem2 = createMockMemory({
        id: generateMemoryId(),
        category: MemoryCategory.insight(),
        importance: MemoryImportance.high(),
      });

      mockRepository.search = vi.fn().mockResolvedValue({
        data: [mem1, mem2],
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      const result = await service.suggestConsolidation();
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('handles repository errors gracefully', async () => {
      mockRepository.search = vi.fn().mockRejectedValue(new Error('DB error'));
      const result = await service.suggestConsolidation();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getTimelineSummary', () => {
    it('returns timeline summary with zero memories', async () => {
      const result = await service.getTimelineSummary();
      expect(result.success).toBe(true);
      expect(result.data!.total).toBe(0);
    });

    it('handles repository errors', async () => {
      mockRepository.count = vi.fn().mockRejectedValue(new Error('Count error'));
      const result = await service.getTimelineSummary();
      expect(result.success).toBe(false);
    });
  });
});
