// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Goal & Task Repositories
// EI-006 — Enterprise Goal & Task Intelligence Engine
//
// Verifies query building, JSONB row <-> entity mapping, and
// pagination WITHOUT a live database: the `postgres` module is mocked
// with a fake `sql` template-tag function (same pattern as the
// providers Postgres repository test). CERT-002 C-04.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresGoalRepository } from '../PostgresGoalRepository.js';
import { PostgresTaskRepository } from '../PostgresTaskRepository.js';
import { createGoalId, createTaskId } from '../../domain/value-objects/Identifiers.js';
import type { Goal, Task } from '../../types/goal-types.js';

// ── Fake postgres `sql` ─────────────────────────────────────────────────────

function makeFakeSql(results: Array<() => unknown>): postgres.Sql {
  let idx = 0;
  const next = (): Promise<unknown> => {
    const r = results[idx] ? results[idx]() : [];
    idx += 1;
    return Promise.resolve(r);
  };
  const sql = vi.fn(() => next()) as unknown as postgres.Sql;
  sql.unsafe = vi.fn(() => next());
  return sql;
}

function goalRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'goal_pg_1',
    data: JSON.stringify({
      goalId: 'goal_pg_1',
      title: 'Launch a newsletter',
      description: 'Build a weekly newsletter',
      category: 'business',
      business: ['content-agency'],
      priority: 'high',
      urgency: 0.7,
      importance: 0.9,
      complexity: 'medium',
      estimatedEffort: 40,
      status: 'active',
      confidence: 0.85,
      goalScore: 0.88,
      successCriteria: [],
      milestones: [],
      dependencies: [],
      childGoalIds: [],
      tags: ['newsletter'],
      metadata: {},
      events: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    ...overrides,
  };
}

function taskRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'task_pg_1',
    data: JSON.stringify({
      taskId: 'task_pg_1',
      goalId: 'goal_pg_1',
      title: 'Research topics',
      capability: 'content_generation',
      priority: 80,
      businessValue: 0.8,
      urgency: 0.6,
      importance: 0.8,
      risk: 0.2,
      confidence: 0.8,
      estimatedTokens: 1000,
      estimatedCostUsd: 0.01,
      estimatedTimeMs: 600000,
      dependencies: [],
      parallelEligible: true,
      flowType: 'sequential',
      retryPolicy: { maxRetries: 2 },
      validationRules: [],
      status: 'planned',
      subTaskIds: [],
      order: 1,
      critical: true,
      slack: 0,
      metadata: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    ...overrides,
  };
}

function makeGoal(id: string): Goal {
  return {
    goalId: id,
    title: 'Launch a newsletter',
    description: 'Build a weekly newsletter',
    category: 'business',
    business: ['content-agency'],
    priority: 'high',
    urgency: 0.7,
    importance: 0.9,
    complexity: 'medium',
    estimatedEffort: 40,
    status: 'active',
    confidence: 0.85,
    goalScore: 0.88,
    successCriteria: [],
    milestones: [],
    dependencies: [],
    childGoalIds: [],
    tags: ['newsletter'],
    metadata: {},
    events: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeTask(id: string): Task {
  return {
    taskId: id,
    goalId: 'goal_pg_1',
    title: 'Research topics',
    capability: 'content_generation',
    priority: 80,
    businessValue: 0.8,
    urgency: 0.6,
    importance: 0.8,
    risk: 0.2,
    confidence: 0.8,
    estimatedTokens: 1000,
    estimatedCostUsd: 0.01,
    estimatedTimeMs: 600000,
    dependencies: [],
    parallelEligible: true,
    flowType: 'sequential',
    retryPolicy: { maxRetries: 2 },
    validationRules: [],
    status: 'planned',
    subTaskIds: [],
    order: 1,
    critical: true,
    slack: 0,
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('PostgresGoalRepository', () => {
  it('saves and finds by id', async () => {
    const sql = makeFakeSql([
      () => [], // INSERT nested object call
      () => [], // INSERT outer template
      () => [goalRow()], // SELECT by id
    ]);
    const repo = new PostgresGoalRepository(sql);

    await repo.save(makeGoal('goal_pg_1'));

    const found = await repo.findById(createGoalId('goal_pg_1'));
    expect(found).not.toBeUndefined();
    expect(found?.title).toBe('Launch a newsletter');
    expect(found?.status).toBe('active');
  });

  it('returns undefined for a missing id', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresGoalRepository(sql);
    expect(await repo.findById(createGoalId('missing'))).toBeUndefined();
  });

  it('searches with filters and pagination', async () => {
    const sql = makeFakeSql([
      () => [{ count: 1 }], // COUNT
      () => [goalRow()], // rows
    ]);
    const repo = new PostgresGoalRepository(sql);

    const result = await repo.search({
      query: 'newsletter',
      categories: ['business'],
      statuses: ['active'],
      page: 1,
      limit: 10,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].goalScore).toBeCloseTo(0.88);
  });

  it('finds by category, status, and children', async () => {
    const sql = makeFakeSql([
      () => [goalRow()], // findByCategory
      () => [goalRow()], // findByStatus
      () => [goalRow()], // findChildren
    ]);
    const repo = new PostgresGoalRepository(sql);
    expect((await repo.findByCategory('business')).length).toBe(1);
    expect((await repo.findByStatus('active')).length).toBe(1);
    expect((await repo.findChildren('parent_1')).length).toBe(1);
  });

  it('deletes and checks existence', async () => {
    const sql = makeFakeSql([
      () => [{ deleted: true }], // DELETE
      () => [{ exists: false }],
    ]);
    const repo = new PostgresGoalRepository(sql);
    expect(await repo.delete(createGoalId('goal_pg_1'))).toBe(true);
    expect(await repo.exists(createGoalId('goal_pg_1'))).toBe(false);
  });
});

describe('PostgresTaskRepository', () => {
  it('saves and finds by id / goal', async () => {
    const sql = makeFakeSql([
      () => [], // INSERT nested object call
      () => [], // INSERT outer template
      () => [taskRow()], // findById
      () => [taskRow()], // findByGoal
    ]);
    const repo = new PostgresTaskRepository(sql);

    await repo.save(makeTask('task_pg_1'));

    const found = await repo.findById(createTaskId('task_pg_1'));
    expect(found?.title).toBe('Research topics');
    expect((await repo.findByGoal('goal_pg_1')).length).toBe(1);
  });

  it('lists, deletes, and checks existence', async () => {
    const sql = makeFakeSql([
      () => [taskRow()], // listAll
      () => [{ deleted: true }], // DELETE
      () => [{ exists: true }],
    ]);
    const repo = new PostgresTaskRepository(sql);
    expect((await repo.listAll()).length).toBe(1);
    expect(await repo.delete(createTaskId('task_pg_1'))).toBe(true);
    expect(await repo.exists(createTaskId('task_pg_1'))).toBe(true);
  });
});
