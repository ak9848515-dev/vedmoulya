import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Shared mock state ─────────────────────────────────────────────────────
let mockRows: Record<string, unknown>[] = [];
let mockCount = 0;

// Full-featured query builder — all methods return this for chaining.
// Terminal methods (orderBy, groupBy) resolve with the shared mock state.
// The `then` method makes the builder thenable so `await` resolves to mocks.
const queryBuilder = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockRows)),
  groupBy: vi.fn().mockImplementation(() => Promise.resolve(mockRows)),
  values: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockImplementation(() => Promise.resolve(mockRows)),
  then: (resolve: (value: unknown) => void) => {
    resolve(mockRows);
  },
};

// Count query builder — resolves directly to [{ count }]
function makeCountBuilder(count: number) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ count }]),
  };
}

const mockDb = {
  select: vi.fn().mockImplementation(() => queryBuilder),
  insert: vi.fn().mockReturnValue(queryBuilder),
  update: vi.fn().mockReturnValue(queryBuilder),
  delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
};

vi.mock('../persistence/DatabaseConnection.js', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

const mockReconstructMemory = vi.hoisted(() => vi.fn());

vi.mock('@vedmoulya/domain', async () => {
  const actual = await vi.importActual('@vedmoulya/domain');
  return {
    ...(actual as Record<string, unknown>),
    MemoryFactory: {
      reconstructMemory: mockReconstructMemory,
    },
  };
});

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@vedmoulya/core', async () => {
  const actual = await vi.importActual('@vedmoulya/core');
  return {
    ...(actual as Record<string, unknown>),
    logger: mockLogger,
  };
});

import { PostgresMemoryRepository } from '../persistence/PostgresMemoryRepository.js';

describe('PostgresMemoryRepository', () => {
  let repo: PostgresMemoryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PostgresMemoryRepository();
    mockRows = [];
    mockCount = 0;
    mockReconstructMemory.mockReturnValue({ id: 'mem-1', title: 'Test Memory' });
  });

  // ── CRUD ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns a memory when found', async () => {
      mockRows = [createRow()];
      const result = await repo.findById('mem-1' as never);
      expect(result).toBeDefined();
      expect(mockReconstructMemory).toHaveBeenCalled();
    });

    it('returns null when memory not found', async () => {
      const result = await repo.findById('nonexistent' as never);
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('inserts a memory into the database', async () => {
      await repo.save(createMockMemory() as never);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(queryBuilder.values).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('updates a memory in the database', async () => {
      await repo.update(createMockMemory() as never);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(queryBuilder.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    it('deletes a memory by id', async () => {
      await repo.delete('mem-1' as never);
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('exists', () => {
    it('returns true when memory exists', async () => {
      mockRows = [{ count: 1 }];
      const result = await repo.exists('mem-1' as never);
      expect(result).toBe(true);
    });

    it('returns false when memory does not exist', async () => {
      const result = await repo.exists('nonexistent' as never);
      expect(result).toBe(false);
    });
  });

  // ── Simple Statistics ──────────────────────────────────────────────────

  describe('count', () => {
    it('returns total memory count', async () => {
      mockRows = [{ count: 42 }];
      const result = await repo.count();
      expect(result).toBe(42);
    });
  });

  describe('countByCategory', () => {
    it('returns category distribution', async () => {
      mockRows = [
        { category: 'experience', count: 10 },
        { category: 'observation', count: 5 },
      ];
      const result = await repo.countByCategory();
      expect(result.experience).toBe(10);
      expect(result.observation).toBe(5);
    });
  });

  describe('countByState', () => {
    it('returns state distribution', async () => {
      mockRows = [
        { state: 'active', count: 20 },
        { state: 'archived', count: 3 },
      ];
      const result = await repo.countByState();
      expect(result.active).toBe(20);
      expect(result.archived).toBe(3);
    });
  });

  describe('countLinked', () => {
    it('returns count of linked memories', async () => {
      mockRows = [{ count: 7 }];
      const result = await repo.countLinked();
      expect(result).toBe(7);
    });
  });

  // ── Promise.all Queries (need per-test mock overrides) ─────────────────

  describe('findByCategory', () => {
    it('returns paginated memories by category', async () => {
      const dataBuilder = makeDataBuilder([createRow()]);
      const countB = makeCountBuilder(1);
      mockDb.select.mockReturnValueOnce(dataBuilder);
      mockDb.select.mockReturnValueOnce(countB);

      const result = await repo.findByCategory('experience', { page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findByState', () => {
    it('returns paginated memories by state', async () => {
      const dataBuilder = makeDataBuilder([createRow()]);
      const countB = makeCountBuilder(1);
      mockDb.select.mockReturnValueOnce(dataBuilder);
      mockDb.select.mockReturnValueOnce(countB);

      const result = await repo.findByState('active', { page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('search', () => {
    it('returns search results with query filter', async () => {
      const dataBuilder = makeDataBuilder([createRow()]);
      const countB = makeCountBuilder(1);
      mockDb.select.mockReturnValueOnce(dataBuilder);
      mockDb.select.mockReturnValueOnce(countB);

      const result = await repo.search({ query: 'test' }, { page: 1, limit: 20 });
      expect(result.data).toBeDefined();
      expect(result.total).toBe(1);
    });

    it('handles empty search results', async () => {
      const dataBuilder = makeDataBuilder([]);
      const countB = makeCountBuilder(0);
      mockDb.select.mockReturnValueOnce(dataBuilder);
      mockDb.select.mockReturnValueOnce(countB);

      const result = await repo.search({ query: 'nonexistent' }, { page: 1, limit: 20 });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findDecayingMemories', () => {
    it('returns decaying memories', async () => {
      const dataBuilder = makeDataBuilder([createRow()]);
      const countB = makeCountBuilder(1);
      mockDb.select.mockReturnValueOnce(dataBuilder);
      mockDb.select.mockReturnValueOnce(countB);

      const result = await repo.findDecayingMemories({ page: 1, limit: 20 });
      expect(result.data).toBeDefined();
    });
  });

  describe('findMemoriesNeedingReinforcement', () => {
    it('returns memories that need reinforcement', async () => {
      const dataBuilder = makeDataBuilder([createRow()]);
      const countB = makeCountBuilder(1);
      mockDb.select.mockReturnValueOnce(dataBuilder);
      mockDb.select.mockReturnValueOnce(countB);

      const result = await repo.findMemoriesNeedingReinforcement({ page: 1, limit: 20 });
      expect(result.data).toBeDefined();
    });
  });

  describe('findRelatedMemories', () => {
    it('returns related memories by category', async () => {
      const dataBuilder = makeDataBuilder([createRow()]);
      const countB = makeCountBuilder(1);
      mockDb.select.mockReturnValueOnce(dataBuilder);
      mockDb.select.mockReturnValueOnce(countB);

      const result = await repo.findRelatedMemories('experience', { page: 1, limit: 20 });
      expect(result.data).toBeDefined();
    });
  });

  // ── Single-chain Queries (use shared queryBuilder) ────────────────────

  describe('getTimeline', () => {
    it('returns timeline entries ordered by date', async () => {
      const testDate = new Date('2024-01-01');
      mockRows = [createRow({ updatedAt: testDate })];
      const result = await repo.getTimeline('desc', { page: 1, limit: 20 });
      expect(result).toHaveLength(1);
      expect(result[0]?.date).toEqual(testDate);
    });
  });

  describe('findByKnowledgeNodeId', () => {
    it('returns memories linked to a knowledge node', async () => {
      mockRows = [createRow()];
      const result = await repo.findByKnowledgeNodeId('kg-node-1');
      expect(result).toHaveLength(1);
    });
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────

function makeDataBuilder(rows: Record<string, unknown>[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
}

function createRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mem-1',
    category: 'experience',
    label: 'Test Memory',
    content: 'Test content',
    importanceLevel: 'medium',
    importanceScore: 5,
    confidenceLevel: 'medium',
    confidenceScore: 0.6,
    strengthScore: 0.3,
    freshnessScore: 0.5,
    state: 'active',
    stateReason: null,
    sourceType: 'system_generated',
    sourceDetail: 'test',
    sourceTimestamp: new Date(),
    versionMajor: 1,
    versionMinor: 0,
    versionPatch: 0,
    retentionClass: 'short_term',
    retentionTtlDays: 30,
    knowledgeNodeId: null,
    knowledgeEdgeId: null,
    tags: [],
    metadata: {},
    entityStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastRecalledAt: null,
    description: null,
    ...overrides,
  };
}

function createMockMemory() {
  return {
    id: 'mem-1',
    category: { value: 'experience' },
    title: 'Test Memory',
    content: 'Test content',
    importance: { level: 'medium', score: 5 },
    confidence: { level: 'medium', score: 0.6 },
    strength: { value: 0.3 },
    state: { state: 'active', reason: null },
    source: { type: 'system_generated', detail: 'test', timestamp: new Date() },
    version: { major: 1, minor: 0, patch: 0 },
    retentionPolicy: { retentionClass: 'short_term', ttlDays: 30 },
    tags: [],
    metadata: {},
    entityStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastRecalledAt: null,
    knowledgeNodeId: undefined,
    description: undefined,
  };
}
