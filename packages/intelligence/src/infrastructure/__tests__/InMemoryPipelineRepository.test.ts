// ──────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Pipeline Tests: InMemoryPipelineRepository
// EI-006 / INT-001
// Covers every repository method (save/findById/findByGoal/listAll/
// exists/delete) plus seeding — the in-memory persistence backing the
// application service (coverage gate).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryPipelineRepository } from '../InMemoryPipelineRepository.js';
import { createPipelineId } from '../../domain/value-objects/PipelineId.js';
import type { EnterprisePipeline } from '../../types/pipeline-types.js';

function makePipeline(goalId: string, createdAt = '2026-01-01T00:00:00.000Z'): EnterprisePipeline {
  return {
    pipelineId: `pipeline_${goalId}`,
    goalId,
    goal: `Goal ${goalId}`,
    status: 'ready',
    steps: [],
    validation: { passed: true, checks: [], summary: '' },
    artifacts: { capabilities: [], providers: [], contextItems: 0 },
    createdAt,
    updatedAt: createdAt,
  };
}

describe('InMemoryPipelineRepository', () => {
  it('seeds from the constructor and clones stored pipelines', async () => {
    const seeded = makePipeline('goal_seed');
    const repo = new InMemoryPipelineRepository([seeded]);

    const found = await repo.findById(createPipelineId(seeded.pipelineId));
    expect(found?.goalId).toBe('goal_seed');

    // Mutation of the returned clone must not leak into the store.
    if (found) found.artifacts.capabilities.push('mutated');
    const again = await repo.findById(createPipelineId(seeded.pipelineId));
    expect(again?.artifacts.capabilities).toHaveLength(0);
  });

  it('returns undefined for an unknown pipeline id', async () => {
    const repo = new InMemoryPipelineRepository();
    expect(await repo.findById(createPipelineId('pipeline_missing'))).toBeUndefined();
  });

  it('saves and overwrites by id', async () => {
    const repo = new InMemoryPipelineRepository();
    const pipeline = makePipeline('goal_a');
    await repo.save(pipeline);

    const updated = { ...pipeline, goal: 'Renamed goal' };
    await repo.save(updated);

    const found = await repo.findById(createPipelineId(pipeline.pipelineId));
    expect(found?.goal).toBe('Renamed goal');
  });

  it('finds by goal, most recent first', async () => {
    const repo = new InMemoryPipelineRepository();
    await repo.save(makePipeline('goal_b', '2026-02-01T00:00:00.000Z'));
    const newest = makePipeline('goal_b', '2026-03-01T00:00:00.000Z');
    newest.pipelineId = 'pipeline_goal_b_newest';
    await repo.save(newest);
    await repo.save(makePipeline('goal_other', '2026-01-01T00:00:00.000Z'));

    const forGoal = await repo.findByGoal('goal_b');
    expect(forGoal).toHaveLength(2);
    expect(forGoal[0]?.createdAt).toBe('2026-03-01T00:00:00.000Z');

    const none = await repo.findByGoal('goal_none');
    expect(none).toHaveLength(0);
  });

  it('lists all pipelines sorted newest first', async () => {
    const repo = new InMemoryPipelineRepository();
    await repo.save(makePipeline('goal_a', '2026-01-01T00:00:00.000Z'));
    await repo.save(makePipeline('goal_b', '2026-02-01T00:00:00.000Z'));

    const all = await repo.listAll();
    expect(all.map((p) => p.goalId)).toEqual(['goal_b', 'goal_a']);
  });

  it('reports existence and deletes pipelines', async () => {
    const repo = new InMemoryPipelineRepository();
    const pipeline = makePipeline('goal_x');
    await repo.save(pipeline);

    expect(await repo.exists(createPipelineId(pipeline.pipelineId))).toBe(true);
    expect(await repo.exists(createPipelineId('pipeline_missing'))).toBe(false);

    expect(await repo.delete(createPipelineId(pipeline.pipelineId))).toBe(true);
    expect(await repo.exists(createPipelineId(pipeline.pipelineId))).toBe(false);
    // Deleting a missing id returns false.
    expect(await repo.delete(createPipelineId('pipeline_missing'))).toBe(false);
  });

  it('creates typed ids through the static factory', () => {
    const id = InMemoryPipelineRepository.createId('pipeline_static');
    expect(id).toBe('pipeline_static');
  });
});
