// ──────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem: In-Memory Workflow Execution Store
// SPRINT-051 — Agent & Workflow Execution Foundation
//
// Owner-scoped in-memory store for workflow executions.
// Follows the estate convention (in-memory for dev/test).
// ──────────────────────────────────────────────────────────────────

import type { WorkflowExecution } from '../types/execution-types.js';
import type { WorkflowExecutionStore } from '../application/WorkflowExecutionService.js';

export class InMemoryWorkflowExecutionStore implements WorkflowExecutionStore {
  private readonly executions = new Map<string, WorkflowExecution>();

  save(execution: WorkflowExecution): void {
    this.executions.set(execution.executionId, execution);
  }

  get(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  list(ownerId: string): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .filter((e) => e.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Clear all executions (for testing). */
  clear(): void {
    this.executions.clear();
  }

  /** Count of stored executions. */
  get size(): number {
    return this.executions.size;
  }
}
