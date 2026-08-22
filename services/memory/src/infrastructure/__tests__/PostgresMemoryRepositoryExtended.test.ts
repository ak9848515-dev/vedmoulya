import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mock state ─────────────────────────────────────────────────────
let mockRows: Record<string, unknown>[] = [];

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
  execute: vi.fn().mockResolvedValue(undefined),
  then: (resolve: (value: unknown) => void) => {
    resolve(mockRows);
  },
};

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
  execute: vi.fn().mockResolvedValue(undefined),
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

describe('PostgresMemoryRepository — ensureTable', () => {
  let repo: PostgresMemoryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PostgresMemoryRepository();
    mockRows = [];
    mockReconstructMemory.mockReturnValue({ id: 'mem-1', title: 'Test Memory' });
  });

  it('creates tables and indexes via raw SQL', async () => {
    await repo.ensureTable();
    // ensureTable calls db.execute() multiple times for DDL
    expect(mockDb.execute).toHaveBeenCalled();
    expect(mockDb.execute.mock.calls.length).toBeGreaterThan(5);
  });
});

describe('PostgresMemoryRepository — search with various filters', () => {
  let repo: PostgresMemoryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PostgresMemoryRepository();
    mockRows = [];
    mockReconstructMemory.mockReturnValue({ id: 'mem-1', title: 'Test Memory' });
  });

  it('searches with query only (no category/state/tags)', async () => {
    const dataBuilder = makeDataBuilder([createRow()]);
    const countB = makeCountBuilder(1);
    mockDb.select.mockReturnValueOnce(dataBuilder);
    mockDb.select.mockReturnValueOnce(countB);

    const result = await repo.search({ query: 'test' }, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('searches with categories filter', async () => {
    const dataBuilder = makeDataBuilder([createRow()]);
    const countB = makeCountBuilder(1);
    mockDb.select.mockReturnValueOnce(dataBuilder);
    mockDb.select.mockReturnValueOnce(countB);

    const result = await repo.search(
      { query: 'test', categories: ['experience', 'observation'] },
      { page: 1, limit: 20 },
    );
    expect(result.data).toHaveLength(1);
  });

  it('searches with states filter', async () => {
    const dataBuilder = makeDataBuilder([createRow()]);
    const countB = makeCountBuilder(1);
    mockDb.select.mockReturnValueOnce(dataBuilder);
    mockDb.select.mockReturnValueOnce(countB);

    const result = await repo.search({ query: 'test', states: ['active'] }, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
  });

  it('searches with tags filter', async () => {
    const dataBuilder = makeDataBuilder([createRow()]);
    const countB = makeCountBuilder(1);
    mockDb.select.mockReturnValueOnce(dataBuilder);
    mockDb.select.mockReturnValueOnce(countB);

    const result = await repo.search(
      { query: 'test', tags: ['important'] },
      { page: 1, limit: 20 },
    );
    expect(result.data).toHaveLength(1);
  });

  it('searches with knowledgeNodeId filter', async () => {
    const dataBuilder = makeDataBuilder([createRow()]);
    const countB = makeCountBuilder(1);
    mockDb.select.mockReturnValueOnce(dataBuilder);
    mockDb.select.mockReturnValueOnce(countB);

    const result = await repo.search({ knowledgeNodeId: 'kg-123' }, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
  });

  it('searches with no filters at all', async () => {
    const dataBuilder = makeDataBuilder([]);
    const countB = makeCountBuilder(0);
    mockDb.select.mockReturnValueOnce(dataBuilder);
    mockDb.select.mockReturnValueOnce(countB);

    const result = await repo.search({}, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(0);
  });
});

describe('PostgresMemoryRepository — additional coverage', () => {
  let repo: PostgresMemoryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PostgresMemoryRepository();
    mockRows = [];
    mockReconstructMemory.mockReturnValue({ id: 'mem-1', title: 'Test Memory' });
  });

  it('count returns 0 when no rows', async () => {
    mockRows = [{ count: 0 }];
    const result = await repo.count();
    expect(result).toBe(0);
  });

  it('countByCategory returns empty when no rows', async () => {
    mockRows = [];
    const result = await repo.countByCategory();
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('countByState returns empty when no rows', async () => {
    mockRows = [];
    const result = await repo.countByState();
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('countLinked returns 0 when no rows', async () => {
    mockRows = [{ count: 0 }];
    const result = await repo.countLinked();
    expect(result).toBe(0);
  });

  it('getTimeline returns empty when no rows', async () => {
    mockRows = [];
    const result = await repo.getTimeline('asc', { page: 1, limit: 20 });
    expect(result).toHaveLength(0);
  });

  it('findByKnowledgeNodeId returns empty when no rows', async () => {
    mockRows = [];
    const result = await repo.findByKnowledgeNodeId('nonexistent');
    expect(result).toHaveLength(0);
  });

  it('count returns default 0 when result is empty', async () => {
    mockRows = [];
    const result = await repo.count();
    expect(result).toBe(0);
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
