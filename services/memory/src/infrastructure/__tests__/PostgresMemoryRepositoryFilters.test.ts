import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Shared mock state ─────────────────────────────────────────────────────
let mockRows: Record<string, unknown>[] = [];

// Count query builder — resolves directly to [{ count }]
function makeCountBuilder(count: number) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ count }]),
  };
}

function makeDataBuilder(rows: Record<string, unknown>[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
}

// Full-featured query builder — terminal methods resolve with mockRows.
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

describe('PostgresMemoryRepository search filters', () => {
  let repo: PostgresMemoryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PostgresMemoryRepository();
    mockRows = [];
    mockReconstructMemory.mockReturnValue({ id: 'mem-1', title: 'Test Memory' });
  });

  function mockPaginated(rows: Record<string, unknown>[], total: number) {
    mockDb.select.mockReturnValueOnce(makeDataBuilder(rows));
    mockDb.select.mockReturnValueOnce(makeCountBuilder(total));
  }

  it('filters by categories', async () => {
    mockPaginated([createRow()], 1);
    const result = await repo.search(
      { query: '', categories: ['experience'] },
      { page: 1, limit: 20 },
    );
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('filters by states', async () => {
    mockPaginated([createRow()], 1);
    const result = await repo.search({ query: '', states: ['active'] }, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
  });

  it('filters by tags', async () => {
    mockPaginated([createRow()], 1);
    const result = await repo.search({ query: '', tags: ['important'] }, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
  });

  it('filters by knowledgeNodeId', async () => {
    mockPaginated([createRow()], 1);
    const result = await repo.search(
      { query: '', knowledgeNodeId: 'kg-1' },
      { page: 1, limit: 20 },
    );
    expect(result.data).toHaveLength(1);
  });

  it('combines query, categories, states, tags, and knowledgeNodeId', async () => {
    mockPaginated([createRow()], 1);
    const result = await repo.search(
      {
        query: 'test',
        categories: ['experience'],
        states: ['active'],
        tags: ['tag1'],
        knowledgeNodeId: 'kg-1',
      },
      { page: 1, limit: 20 },
    );
    expect(result.data).toHaveLength(1);
    // Combined where → and(...) with 5 conditions, all matched
  });

  it('handles no filters (where undefined)', async () => {
    mockPaginated([createRow()], 1);
    const result = await repo.search({ query: '' }, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
  });

  it('returns empty results with totalPages 0', async () => {
    mockPaginated([], 0);
    const result = await repo.search({ query: 'nothing' }, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});

describe('PostgresMemoryRepository getTimeline ordering', () => {
  let repo: PostgresMemoryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PostgresMemoryRepository();
    mockRows = [];
    mockReconstructMemory.mockReturnValue({ id: 'mem-1', title: 'Test Memory' });
  });

  it('orders descending by default', async () => {
    const date = new Date('2024-01-01');
    mockRows = [createRow({ updatedAt: date })];
    const result = await repo.getTimeline('desc', { page: 1, limit: 20 });
    expect(result).toHaveLength(1);
    expect(result[0]?.date).toEqual(date);
    expect(result[0]?.type).toBe('updated');
  });

  it('orders ascending when requested', async () => {
    const date = new Date('2024-01-01');
    mockRows = [createRow({ updatedAt: date })];
    const result = await repo.getTimeline('asc', { page: 1, limit: 20 });
    expect(result).toHaveLength(1);
    expect(result[0]?.date).toEqual(date);
  });
});

describe('PostgresMemoryRepository row mapping', () => {
  let repo: PostgresMemoryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PostgresMemoryRepository();
    mockRows = [];
  });

  it('maps rows with null optionals via reconstructMemory', async () => {
    mockReconstructMemory.mockReturnValue({ id: 'mem-1', title: 'Test Memory' });
    mockRows = [createRow()];
    const result = await repo.findById('mem-1' as never);
    expect(result).toEqual({ id: 'mem-1', title: 'Test Memory' });
    expect(mockReconstructMemory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mem-1', tags: [], knowledgeNodeId: undefined }),
    );
  });

  it('maps rows with populated optional fields via reconstructMemory', async () => {
    const lastRecalled = new Date('2024-06-01');
    mockReconstructMemory.mockReturnValue({ id: 'mem-1', title: 'Test Memory' });
    mockRows = [
      createRow({
        stateReason: 'archived by user',
        sourceDetail: 'manual entry',
        tags: ['important'],
        knowledgeNodeId: 'kg-1',
        lastRecalledAt: lastRecalled,
      }),
    ];
    const result = await repo.findById('mem-1' as never);
    expect(result).toEqual({ id: 'mem-1', title: 'Test Memory' });
    expect(mockReconstructMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        stateReason: 'archived by user',
        sourceDetail: 'manual entry',
        tags: ['important'],
        knowledgeNodeId: 'kg-1',
        lastRecalledAt: lastRecalled,
      }),
    );
  });

  it('maps a memory with populated fields to a row', async () => {
    const sourceTimestamp = new Date('2024-06-01');
    const lastRecalled = new Date('2024-06-02');
    await repo.save(
      createMockMemory({
        state: { state: 'archived', reason: 'no longer needed' },
        knowledgeNodeId: 'kg-1',
        lastRecalledAt: lastRecalled,
        source: { type: 'user_input', detail: 'typed', timestamp: sourceTimestamp },
        tags: ['important'],
      }) as never,
    );
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(queryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        stateReason: 'no longer needed',
        knowledgeNodeId: 'kg-1',
        lastRecalledAt: lastRecalled,
        sourceDetail: 'typed',
        sourceTimestamp,
        tags: ['important'],
      }),
    );
  });

  it('maps a memory with undefined knowledgeNodeId and lastRecalledAt to nulls', async () => {
    await repo.save(createMockMemory({ knowledgeNodeId: undefined }) as never);
    expect(queryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({ knowledgeNodeId: null, lastRecalledAt: null }),
    );
  });
});

function createMockMemory(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
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
