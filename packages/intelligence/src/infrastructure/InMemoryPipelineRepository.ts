// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: In-Memory Repository
// EI-006 / INT-001
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { EnterprisePipeline } from '../types/pipeline-types.js';
import type { PipelineRepository } from '../domain/repository/PipelineRepository.js';
import { createPipelineId, type PipelineId } from '../domain/value-objects/PipelineId.js';

export class InMemoryPipelineRepository implements PipelineRepository {
  private readonly store = new Map<string, EnterprisePipeline>();

  constructor(seed: EnterprisePipeline[] = []) {
    for (const pipeline of seed) {
      this.store.set(pipeline.pipelineId, structuredClone(pipeline));
    }
  }

  async save(pipeline: EnterprisePipeline): Promise<void> {
    this.store.set(pipeline.pipelineId, structuredClone(pipeline));
  }

  async findById(id: PipelineId): Promise<EnterprisePipeline | undefined> {
    const pipeline = this.store.get(id);
    return pipeline ? structuredClone(pipeline) : undefined;
  }

  async findByGoal(goalId: string): Promise<EnterprisePipeline[]> {
    return [...this.store.values()]
      .filter((p) => p.goalId === goalId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => structuredClone(p));
  }

  async listAll(): Promise<EnterprisePipeline[]> {
    return [...this.store.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => structuredClone(p));
  }

  async exists(id: PipelineId): Promise<boolean> {
    return this.store.has(id);
  }

  async delete(id: PipelineId): Promise<boolean> {
    return this.store.delete(id);
  }

  static createId(id: string): PipelineId {
    return createPipelineId(id);
  }
}
