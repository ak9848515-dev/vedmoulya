// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Execution Repository Tests
// Covers every repository method with a mocked chainable Drizzle query builder.
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ExecutionFactory,
  ExecutionTimeline,
  ExecutionContext,
  ExecutionMission,
  ExecutionTask,
} from '@vedmoulya/domain';
import type { ExecutionPlan } from '@vedmoulya/domain';
import type { ExecutionPlanRow } from '../../../schema/execution.js';

const getDatabaseMock = vi.hoisted(() => vi.fn());

vi.mock('../DatabaseConnection.js', () => ({
  getDatabase: getDatabaseMock,
}));

const { PostgresExecutionRepository } = await import('../PostgresExecutionRepository.js');

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<ExecutionPlanRow> = {}): ExecutionPlanRow {
  return {
    id: 'plan_1',
    title: 'Launch plan',
    description: 'Launch the platform',
    planningLevel: 'operational',
    status: 'pending',
    statusReason: null,
    priorityLevel: 'medium',
    priorityScore: 5,
    progressCompleted: 0,
    progressTotal: 1,
    goalReferences: [],
    decisionReferences: [],
    knowledgeNodeIds: [],
    memoryIds: [],
    missions: [],
    tasks: [],
    timeline: { entries: [] },
    context: {},
    tags: ['work'],
    metadata: {},
    entityStatus: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    completedAt: null,
    ...overrides,
  };
}

function makePlan(): ExecutionPlan {
  return ExecutionFactory.reconstructPlan({
    id: 'plan_1',
    title: 'Launch plan',
    description: 'Launch the platform',
    planningLevel: 'operational',
    status: 'pending',
    priorityScore: 5,
    completedCount: 0,
    totalCount: 1,
    goalReferences: [{ goalId: 'g1', label: 'Goal', description: 'A goal' }],
    decisionReferences: [{ decisionId: 'd1', title: 'Decision', selectedOption: 'opt_a' }],
    knowledgeNodeIds: ['kn1'],
    memoryIds: ['m1'],
    missions: [],
    tasks: [],
    timeline: ExecutionTimeline.empty(),
    context: new ExecutionContext({ energyLevel: 7 }),
    tags: ['work'],
    metadata: { recoveryAttempts: 0 },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });
}

type Builder = {
  then: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

type Db = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

/** Build a chainable query builder whose await resolves, in order, the given results. */
function makeBuilder(results: unknown[]): Builder {
  const builder = {} as Builder;
  const then = vi.fn();
  for (const r of results) {
    then.mockImplementationOnce((resolve: (v: unknown) => void) => {
      resolve(r);
    });
  }
  builder.then = then;
  for (const key of [
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'groupBy',
    'values',
    'set',
  ] as const) {
    builder[key] = vi.fn(() => builder);
  }
  return builder;
}

function makeDb(): Db {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function repo(): PostgresExecutionRepository {
  return new PostgresExecutionRepository();
}

describe('PostgresExecutionRepository', () => {
  let db: Db;
  let repository: PostgresExecutionRepository;

  beforeEach(() => {
    db = makeDb();
    getDatabaseMock.mockReturnValue(db);
    repository = repo();
  });

  it('findById returns a reconstructed plan when found', async () => {
    const builder = makeBuilder([[makeRow()]]);
    db.select.mockReturnValue(builder);

    const plan = await repository.findById('plan_1');

    expect(plan).not.toBeNull();
    expect(plan?.id).toBe('plan_1');
    expect(plan?.title).toBe('Launch plan');
    expect(db.select).toHaveBeenCalled();
  });

  it('findById returns null when not found', async () => {
    db.select.mockReturnValue(makeBuilder([[]]));

    await expect(repository.findById('nope')).resolves.toBeNull();
  });

  it('findByPlanningLevel paginates and counts', async () => {
    const builder = makeBuilder([[makeRow()], [{ count: 1 }]]);
    db.select.mockReturnValue(builder);

    const result = await repository.findByPlanningLevel('operational', { page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it('findByStatus paginates and counts', async () => {
    const builder = makeBuilder([[makeRow()], [{ count: 1 }]]);
    db.select.mockReturnValue(builder);

    const result = await repository.findByStatus('pending', { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('save inserts the mapped row', async () => {
    const builder = makeBuilder([undefined]);
    db.insert.mockReturnValue(builder);

    await expect(repository.save(makePlan())).resolves.toBeUndefined();

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(builder.values).toHaveBeenCalledTimes(1);
  });

  it('update sets the mapped row and filters by id', async () => {
    const builder = makeBuilder([undefined]);
    db.update.mockReturnValue(builder);

    await expect(repository.update(makePlan())).resolves.toBeUndefined();

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(builder.set).toHaveBeenCalledTimes(1);
    expect(builder.where).toHaveBeenCalledTimes(1);
  });

  it('planToRow maps missions, tasks, timeline, and context', async () => {
    const builder = makeBuilder([undefined]);
    db.insert.mockReturnValue(builder);

    const plan = ExecutionFactory.reconstructPlan({
      id: 'plan_1',
      title: 'Launch plan',
      description: 'Launch the platform',
      planningLevel: 'operational',
      status: 'in_progress',
      priorityScore: 5,
      completedCount: 1,
      totalCount: 2,
      goalReferences: [],
      decisionReferences: [],
      knowledgeNodeIds: [],
      memoryIds: [],
      missions: [
        new ExecutionMission({
          id: 'mis_1',
          label: 'Mission',
          description: 'M',
          planId: 'plan_1',
          tags: ['a'],
        }),
      ],
      tasks: [
        new ExecutionTask({
          id: 'task_1',
          label: 'Task',
          description: 'T',
          estimatedDuration: 30,
          missionId: 'mis_1',
          tags: ['b'],
        }),
      ],
      timeline: ExecutionTimeline.empty().addEntry('created', 'Created', 'plan_1', 'plan'),
      context: new ExecutionContext({ energyLevel: 7, resources: ['laptop'] }),
      tags: ['work'],
      metadata: { recoveryAttempts: 0 },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await repository.save(plan);

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(builder.values).toHaveBeenCalledTimes(1);
    const row = (builder.values.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
    expect(row.missions).toHaveLength(1);
    expect(row.tasks).toHaveLength(1);
    expect(row.timeline).toMatchObject({ entries: [{ eventType: 'created' }] });
    expect(row.context).toMatchObject({ energyLevel: 7, resources: ['laptop'] });
  });

  it('delete filters by id', async () => {
    const builder = makeBuilder([undefined]);
    db.delete.mockReturnValue(builder);

    await expect(repository.delete('plan_1')).resolves.toBeUndefined();

    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(builder.where).toHaveBeenCalledTimes(1);
  });

  it('exists returns true when a row is counted', async () => {
    db.select.mockReturnValue(makeBuilder([[{ count: 1 }]]));

    await expect(repository.exists('plan_1')).resolves.toBe(true);
  });

  it('exists returns false when nothing is counted', async () => {
    db.select.mockReturnValue(makeBuilder([[{ count: 0 }]]));

    await expect(repository.exists('plan_1')).resolves.toBe(false);
  });

  it('search builds conditions for query, levels, statuses, priorities, tags, goalId, decisionId', async () => {
    const builder = makeBuilder([[makeRow()], [{ count: 1 }]]);
    db.select.mockReturnValue(builder);

    const result = await repository.search(
      {
        query: 'launch',
        planningLevels: ['operational'],
        statuses: ['pending'],
        priorityMin: 3,
        priorityMax: 9,
        tags: ['work'],
        goalId: 'g1',
        decisionId: 'd1',
      },
      { page: 1, limit: 10 },
    );

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    // The where() was called with a combined condition (and(...) of many).
    expect(builder.where).toHaveBeenCalled();
  });

  it('search with no filters passes an undefined where clause', async () => {
    const builder = makeBuilder([[makeRow()], [{ count: 1 }]]);
    db.select.mockReturnValue(builder);

    const result = await repository.search({}, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(builder.where).toHaveBeenCalledWith(undefined);
  });

  it('findByGoalId filters by goal reference', async () => {
    db.select.mockReturnValue(makeBuilder([[makeRow()]]));

    const plans = await repository.findByGoalId('g1');

    expect(plans).toHaveLength(1);
    expect(plans[0]?.id).toBe('plan_1');
  });

  it('findByDecisionId filters by decision reference', async () => {
    db.select.mockReturnValue(makeBuilder([[makeRow()]]));

    const plans = await repository.findByDecisionId('d1');

    expect(plans).toHaveLength(1);
    expect(plans[0]?.id).toBe('plan_1');
  });

  it('findActivePlans paginates active statuses', async () => {
    const builder = makeBuilder([[makeRow({ status: 'ready' })], [{ count: 1 }]]);
    db.select.mockReturnValue(builder);

    const result = await repository.findActivePlans({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('findRecentlyCompleted returns limited completed plans', async () => {
    db.select.mockReturnValue(makeBuilder([[makeRow({ status: 'completed' })]]));

    const plans = await repository.findRecentlyCompleted(5);

    expect(plans).toHaveLength(1);
    expect(plans[0]?.status.isCompleted).toBe(true);
  });

  it('count returns the total row count', async () => {
    db.select.mockReturnValue(makeBuilder([[{ count: 7 }]]));

    await expect(repository.count()).resolves.toBe(7);
  });

  it('countByPlanningLevel groups by level', async () => {
    db.select.mockReturnValue(
      makeBuilder([
        [
          { level: 'operational', count: 3 },
          { level: 'daily', count: 1 },
        ],
      ]),
    );

    const result = await repository.countByPlanningLevel();

    expect(result.operational).toBe(3);
    expect(result.daily).toBe(1);
  });

  it('countByStatus groups by status', async () => {
    db.select.mockReturnValue(makeBuilder([[{ status: 'pending', count: 2 }]]));

    const result = await repository.countByStatus();

    expect(result.pending).toBe(2);
  });

  it('countActive counts ready and in_progress plans', async () => {
    db.select.mockReturnValue(makeBuilder([[{ count: 2 }]]));

    await expect(repository.countActive()).resolves.toBe(2);
  });

  it('countOverdue counts stale in-progress/ready plans', async () => {
    db.select.mockReturnValue(makeBuilder([[{ count: 1 }]]));

    await expect(repository.countOverdue()).resolves.toBe(1);
  });

  it('rowToPlan reconstructs missions, tasks, timeline, context, and references', async () => {
    const row = makeRow({
      status: 'in_progress',
      progressCompleted: 1,
      progressTotal: 2,
      missions: [
        {
          id: 'mis_1',
          label: 'Mission',
          description: 'M',
          status: 'pending',
          priorityLevel: 'high',
          planId: 'plan_1',
          tags: ['a'],
        },
      ],
      tasks: [
        {
          id: 'task_1',
          label: 'Task',
          description: 'T',
          status: 'pending',
          priorityLevel: 'high',
          estimatedDuration: 30,
          missionId: 'mis_1',
          tags: ['b'],
        },
      ],
      timeline: {
        entries: [
          { eventType: 'created', description: 'Created', entityId: 'plan_1', entityType: 'plan' },
        ],
      },
      context: {
        energyLevel: 7,
        timeAvailable: 60,
        location: 'home',
        resources: ['laptop'],
        interruptions: ['x'],
        focusScore: 4,
      },
      goalReferences: [{ goalId: 'g1', label: 'Goal', description: 'D' }],
      decisionReferences: [{ decisionId: 'd1', title: 'Decision', selectedOption: 'opt_a' }],
      knowledgeNodeIds: ['kn1'],
      memoryIds: ['m1'],
      tags: ['work'],
    });
    db.select.mockReturnValue(makeBuilder([[row]]));

    const plan = await repository.findById('plan_1');

    expect(plan?.missions).toHaveLength(1);
    expect(plan?.tasks).toHaveLength(1);
    expect(plan?.timeline.entries).toHaveLength(1);
    expect(plan?.context.energyLevel).toBe(7);
    expect(plan?.goalReferences).toHaveLength(1);
    expect(plan?.decisionReferences).toHaveLength(1);
    expect(plan?.knowledgeNodeIds).toEqual(['kn1']);
    expect(plan?.memoryIds).toEqual(['m1']);
    expect(plan?.tags).toEqual(['work']);
  });

  it('rowToPlan handles empty collections as undefined', async () => {
    db.select.mockReturnValue(makeBuilder([[makeRow()]]));

    const plan = await repository.findById('plan_1');

    expect(plan?.missions).toEqual([]);
    expect(plan?.tasks).toEqual([]);
    expect(plan?.timeline.entries).toHaveLength(0);
    expect(plan?.status.isPending).toBe(true);
  });
});
