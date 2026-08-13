// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: In-Memory Run Store
// EPIC-014 — bounded (FIFO 500), owner-scoped. Persistence follows the
// repository convention: this is the dev/test double; a Postgres store
// for production/staging is an operator step (same convention as the
// capability plan store).
// ──────────────────────────────────────────────────────────────────

import type { ExecutionRun } from '../types/execution-types.js';
import type { ExecutionRunStore } from '../contracts/execution-ports.js';

export interface InMemoryExecutionRunStoreOptions {
  /** Bounded capacity — oldest runs are evicted first. */
  maxRuns?: number;
}

export class InMemoryExecutionRunStore implements ExecutionRunStore {
  private readonly runs = new Map<string, ExecutionRun>();
  private readonly maxRuns: number;

  constructor(options: InMemoryExecutionRunStoreOptions = {}) {
    this.maxRuns = options.maxRuns ?? 500;
  }

  save(run: ExecutionRun): void {
    this.runs.set(run.executionId, run);
    while (this.runs.size > this.maxRuns) {
      const oldest = this.runs.keys().next().value;
      if (oldest === undefined) break;
      this.runs.delete(oldest);
    }
  }

  get(executionId: string): ExecutionRun | undefined {
    return this.runs.get(executionId);
  }

  list(ownerId: string): ExecutionRun[] {
    return [...this.runs.values()]
      .filter((r) => r.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
