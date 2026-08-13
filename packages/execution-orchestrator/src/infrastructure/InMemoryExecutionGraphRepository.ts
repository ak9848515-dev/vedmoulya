// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: In-Memory Graph Repository
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { ExecutionGraph } from '../types/orchestrator-types.js';
import type { ExecutionGraphRepository } from '../domain/repository/ExecutionGraphRepository.js';
import { createGraphId, type GraphId } from '../domain/value-objects/Identifiers.js';

export class InMemoryExecutionGraphRepository implements ExecutionGraphRepository {
  private readonly store = new Map<string, ExecutionGraph>();

  async save(graph: ExecutionGraph): Promise<void> {
    this.store.set(graph.graphId, structuredClone(graph));
  }

  async findById(id: GraphId): Promise<ExecutionGraph | undefined> {
    const graph = this.store.get(id);
    return graph ? structuredClone(graph) : undefined;
  }

  async findByStrategy(strategyId: string): Promise<ExecutionGraph[]> {
    return [...this.store.values()]
      .filter((g) => g.strategyId === strategyId)
      .map((g) => structuredClone(g));
  }

  async listAll(): Promise<ExecutionGraph[]> {
    return [...this.store.values()].map((g) => structuredClone(g));
  }

  async delete(id: GraphId): Promise<boolean> {
    return this.store.delete(id);
  }

  async exists(id: GraphId): Promise<boolean> {
    return this.store.has(id);
  }

  static createId(id: string): GraphId {
    return createGraphId(id);
  }
}
