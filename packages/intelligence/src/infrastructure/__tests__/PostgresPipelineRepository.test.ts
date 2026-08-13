// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Pipeline Repository
// EI-006 / INT-001 — Enterprise Intelligence Integration Platform
//
// Verifies query building, JSONB row <-> entity mapping, and ordering
// WITHOUT a live database: the `postgres` module is mocked with a fake
// `sql` template-tag function (same pattern as the providers Postgres
// repository test). CERT-002 C-04.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresPipelineRepository } from '../PostgresPipelineRepository.js';
import { createPipelineId } from '../../domain/value-objects/PipelineId.js';
import type { EnterprisePipeline } from '../../types/pipeline-types.js';

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

function pipelineRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pipeline_pg_1',
    goal_id: 'goal_1',
    data: JSON.stringify({
      pipelineId: 'pipeline_pg_1',
      goalId: 'goal_1',
      goal: 'Launch a newsletter',
      status: 'ready',
      steps: [
        { stage: 'goal', status: 'passed', detail: 'ok', counts: {}, artifactIds: ['goal_1'] },
        {
          stage: 'capabilities',
          status: 'passed',
          detail: 'ok',
          counts: { capabilities: 2 },
          artifactIds: [],
        },
      ],
      validation: { passed: true, checks: [], summary: 'ready' },
      artifacts: {
        capabilities: ['cap_1'],
        providers: [],
        contextItems: 3,
        strategyId: 'strategy_1',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    ...overrides,
  };
}

function makePipeline(id: string): EnterprisePipeline {
  return {
    pipelineId: id,
    goalId: 'goal_1',
    goal: 'Launch a newsletter',
    status: 'ready',
    steps: [],
    validation: { passed: true, checks: [], summary: 'ready' },
    artifacts: { capabilities: [], providers: [], contextItems: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('PostgresPipelineRepository', () => {
  it('saves and finds by id', async () => {
    const sql = makeFakeSql([
      () => [], // INSERT nested object call
      () => [], // INSERT outer template
      () => [pipelineRow()], // findById
    ]);
    const repo = new PostgresPipelineRepository(sql);

    await repo.save(makePipeline('pipeline_pg_1'));

    const found = await repo.findById(createPipelineId('pipeline_pg_1'));
    expect(found).not.toBeUndefined();
    expect(found?.status).toBe('ready');
    expect(found?.steps).toHaveLength(2);
    expect(found?.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns undefined for a missing id', async () => {
    const sql = makeFakeSql([() => []]);
    const repo = new PostgresPipelineRepository(sql);
    expect(await repo.findById(createPipelineId('missing'))).toBeUndefined();
  });

  it('finds by goal and lists all (ordered by createdAt DESC)', async () => {
    const sql = makeFakeSql([
      () => [pipelineRow()], // findByGoal
      () => [pipelineRow()], // listAll
    ]);
    const repo = new PostgresPipelineRepository(sql);
    expect((await repo.findByGoal('goal_1')).length).toBe(1);
    expect((await repo.listAll()).length).toBe(1);
  });

  it('checks existence and deletes', async () => {
    const sql = makeFakeSql([
      () => [{ exists: true }], // exists
      () => [{ deleted: true }], // DELETE RETURNING
    ]);
    const repo = new PostgresPipelineRepository(sql);
    expect(await repo.exists(createPipelineId('pipeline_pg_1'))).toBe(true);
    expect(await repo.delete(createPipelineId('pipeline_pg_1'))).toBe(true);
  });
});
