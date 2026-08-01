// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Decision Repository Tests
// Covers all repository CRUD/search/statistics methods against a mocked
// drizzle database, plus the row<->entity mapping helpers.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PostgresDecisionRepository } from '../PostgresDecisionRepository.js';
import { Decision, DecisionConfidence, DecisionReasoning, DecisionStatus } from '@vedmoulya/domain';
import type { DecisionId, DecisionOption } from '@vedmoulya/domain';
import type { DecisionRow } from '../../../schema/decision.js';

// Mock getDatabase() so no real pool is touched.
const { getDatabaseMock } = vi.hoisted(() => ({
  getDatabaseMock: vi.fn(),
}));

vi.mock('../DatabaseConnection.js', () => ({
  getDatabase: getDatabaseMock,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: 'dec_1',
    title: 'Choose a framework',
    description: 'Select the best framework',
    metadata: {},
    tags: ['tech'],
    category: 'technical',
    initiator: 'user',
    status: 'decided',
    statusReason: null,
    priorityLevel: 'high',
    priorityScore: 8,
    confidenceLevel: 'high',
    confidenceScore: 0.8,
    versionMajor: 1,
    versionMinor: 1,
    versionPatch: 0,
    requester: null,
    requestReason: null,
    requestContext: null,
    selectedOptionId: 'opt_a',
    reasoningMethod: 'analytical',
    reasoningSummary: 'Best balance',
    reasoningAssumptions: [],
    reasoningPros: ['Cheap'],
    reasoningCons: [],
    outcomeResult: null,
    outcomeDescription: null,
    outcomeActualImpact: null,
    outcomeLessons: [],
    knowledgeNodeIds: ['kn-1'],
    memoryIds: ['mem-1'],
    options: [],
    evidence: [],
    constraints: [],
    entityStatus: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    completedAt: new Date('2026-01-03T00:00:00Z'),
    ...overrides,
  };
}

type Builder = {
  from: () => Builder;
  where: () => Builder;
  limit: () => Builder;
  offset: () => Builder;
  orderBy: () => Builder;
  groupBy: () => Builder;
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
};

/** Build a chainable select query that resolves to `result`. */
function makeBuilder(result: unknown): Builder {
  const builder = {} as Builder;
  const self = (): Builder => builder;
  builder.from = self;
  builder.where = self;
  builder.limit = self;
  builder.offset = self;
  builder.orderBy = self;
  builder.groupBy = self;
  builder.then = (resolve: (value: unknown) => unknown): Promise<unknown> =>
    Promise.resolve(result).then(resolve);
  return builder;
}

/** Mock db with select/insert/update/delete. select resolves per-call results. */
function makeDb(results: unknown[]): {
  db: Record<string, unknown>;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
} {
  const select = vi.fn();
  results.forEach((r) => select.mockImplementationOnce(() => makeBuilder(r)));
  const insert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  const update = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  });
  const remove = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  return {
    db: { select, insert, update, delete: remove },
    select,
    insert,
    update,
    remove,
  };
}

function makeDecision(): Decision {
  return new Decision({
    id: 'dec_1' as DecisionId,
    title: 'Choose a framework',
    description: 'Select the best framework',
    category: 'technical',
    status: DecisionStatus.evaluating(),
    confidence: DecisionConfidence.high(),
    options: [
      {
        id: 'opt_a',
        label: 'Option A',
        description: 'desc',
        pros: ['Cheap'],
        cons: [],
        score: { overall: 8, criteria: [] },
      },
    ],
    knowledgeNodeIds: ['kn-1'],
    memoryIds: ['mem-1'],
    tags: ['tech'],
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PostgresDecisionRepository', () => {
  let repository: PostgresDecisionRepository;

  beforeEach(() => {
    getDatabaseMock.mockReset();
    repository = new PostgresDecisionRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('findById returns the reconstructed decision', async () => {
    const { db } = makeDb([[makeRow()]]);
    getDatabaseMock.mockReturnValue(db);

    const decision = await repository.findById('dec_1' as DecisionId);

    expect(decision).not.toBeNull();
    expect(decision?.id).toBe('dec_1');
    expect(decision?.title).toBe('Choose a framework');
    expect(decision?.status.toString()).toBe('decided');
    expect(decision?.version.label).toBe('v1.1.0');
    expect(decision?.knowledgeNodeIds).toEqual(['kn-1']);
    expect(decision?.memoryIds).toEqual(['mem-1']);
  });

  it('findById returns null when no row matches', async () => {
    const { db } = makeDb([[]]);
    getDatabaseMock.mockReturnValue(db);

    await expect(repository.findById('dec_x' as DecisionId)).resolves.toBeNull();
  });

  it('findByCategory returns a paginated result', async () => {
    const rows = [makeRow(), makeRow({ id: 'dec_2' })];
    const { db } = makeDb([rows, [{ count: 5 }]]);
    getDatabaseMock.mockReturnValue(db);

    const result = await repository.findByCategory('technical', { page: 2, limit: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(1);
  });

  it('findByStatus returns a paginated result', async () => {
    const { db } = makeDb([[makeRow()], [{ count: 0 }]]);
    getDatabaseMock.mockReturnValue(db);

    const result = await repository.findByStatus('decided', { page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('save inserts the mapped row', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: valuesMock });
    const { db } = makeDb([]);
    db.insert = insert;
    getDatabaseMock.mockReturnValue(db);

    const decision = makeDecision();
    await repository.save(decision);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledTimes(1);
  });

  it('update sets the mapped row with a where clause', async () => {
    const { db, update } = makeDb([]);
    getDatabaseMock.mockReturnValue(db);

    await repository.update(makeDecision());

    expect(update).toHaveBeenCalledTimes(1);
    const setMock = (update.mock.results[0] as { value: { set: ReturnType<typeof vi.fn> } }).value
      .set;
    expect(setMock).toHaveBeenCalled();
  });

  it('delete removes the row', async () => {
    const { db, remove } = makeDb([]);
    getDatabaseMock.mockReturnValue(db);

    await repository.delete('dec_1' as DecisionId);

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('exists returns true when a count row is present', async () => {
    const { db } = makeDb([[{ count: 3 }]]);
    getDatabaseMock.mockReturnValue(db);

    await expect(repository.exists('dec_1' as DecisionId)).resolves.toBe(true);
  });

  it('exists returns false when no rows match', async () => {
    const { db } = makeDb([[{ count: 0 }]]);
    getDatabaseMock.mockReturnValue(db);

    await expect(repository.exists('dec_1' as DecisionId)).resolves.toBe(false);
  });

  it('search applies every condition when all are present', async () => {
    const { db } = makeDb([[makeRow()], [{ count: 1 }]]);
    getDatabaseMock.mockReturnValue(db);

    const result = await repository.search(
      {
        query: 'framework',
        categories: ['technical', 'strategic'],
        statuses: ['decided', 'completed'],
        tags: ['tech'],
        priorityMin: 5,
        priorityMax: 9,
        knowledgeNodeId: 'kn-1',
        memoryId: 'mem-1',
      },
      { page: 1, limit: 20 },
    );

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('search works with an empty filter set', async () => {
    const { db } = makeDb([[makeRow()], [{ count: 1 }]]);
    getDatabaseMock.mockReturnValue(db);

    const result = await repository.search({}, { page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
  });

  it('findByKnowledgeNodeId returns decisions for the node', async () => {
    const { db } = makeDb([[makeRow()]]);
    getDatabaseMock.mockReturnValue(db);

    const decisions = await repository.findByKnowledgeNodeId('kn-1');

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.id).toBe('dec_1');
  });

  it('findByMemoryId returns decisions referencing the memory', async () => {
    const { db } = makeDb([[makeRow()]]);
    getDatabaseMock.mockReturnValue(db);

    const decisions = await repository.findByMemoryId('mem-1');

    expect(decisions).toHaveLength(1);
  });

  it('findPendingDecisions returns a paginated result of pending decisions', async () => {
    const { db } = makeDb([[makeRow()], [{ count: 2 }]]);
    getDatabaseMock.mockReturnValue(db);

    const result = await repository.findPendingDecisions({ page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(2);
  });

  it('findRecentlyCompleted returns recent completed decisions', async () => {
    const { db } = makeDb([[makeRow()]]);
    getDatabaseMock.mockReturnValue(db);

    const decisions = await repository.findRecentlyCompleted(5);

    expect(decisions).toHaveLength(1);
  });

  it('count returns the total rows', async () => {
    const { db } = makeDb([[{ count: 12 }]]);
    getDatabaseMock.mockReturnValue(db);

    await expect(repository.count()).resolves.toBe(12);
  });

  it('countByCategory aggregates per category', async () => {
    const { db } = makeDb([
      [
        { category: 'technical', count: 3 },
        { category: 'career', count: 2 },
      ],
    ]);
    getDatabaseMock.mockReturnValue(db);

    const result = await repository.countByCategory();

    expect(result.technical).toBe(3);
    expect(result.career).toBe(2);
  });

  it('countByStatus aggregates per status', async () => {
    const { db } = makeDb([
      [
        { status: 'decided', count: 4 },
        { status: 'requested', count: 1 },
      ],
    ]);
    getDatabaseMock.mockReturnValue(db);

    const result = await repository.countByStatus();

    expect(result.decided).toBe(4);
    expect(result.requested).toBe(1);
  });

  it('countLinked counts decisions with knowledge links', async () => {
    const { db } = makeDb([[{ count: 7 }]]);
    getDatabaseMock.mockReturnValue(db);

    await expect(repository.countLinked()).resolves.toBe(7);
  });
});
