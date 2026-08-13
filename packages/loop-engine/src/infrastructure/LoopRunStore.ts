// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: Run Store
// EPIC-006 — Phase 14. Persistence seam for loop runs (in-memory now;
// a Postgres store can replace it without touching the engine).
// ──────────────────────────────────────────────────────────────────

import type { LoopRun } from '../types/loop-types.js';

export interface LoopRunStore {
  save(run: LoopRun): void;
  get(runId: string): LoopRun | undefined;
  list(userId?: string): LoopRun[];
  delete(runId: string): boolean;
}

export class InMemoryLoopRunStore implements LoopRunStore {
  private readonly runs = new Map<string, LoopRun>();

  save(run: LoopRun): void {
    this.runs.set(run.runId, run);
  }

  get(runId: string): LoopRun | undefined {
    return this.runs.get(runId);
  }

  list(userId?: string): LoopRun[] {
    const all = Array.from(this.runs.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return userId ? all.filter((r) => r.userId === userId) : all;
  }

  delete(runId: string): boolean {
    return this.runs.delete(runId);
  }
}
