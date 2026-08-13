// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · In-memory stores
// EPIC-016
// Bounded (FIFO) + owner-scoped. Postgres stores follow the same
// interface in production (operator step, unchanged convention).
// ──────────────────────────────────────────────────────────────────

import type { BrainTask, BrainDecisionRecord } from '../types/brain-types.js';
import type { BrainTaskStore, BrainDecisionStore } from '../contracts/brain-ports.js';

export class InMemoryBrainTaskStore implements BrainTaskStore {
  private readonly tasks = new Map<string, BrainTask>(); // taskId → task
  private readonly byOwner = new Map<string, string[]>(); // userId → taskIds (FIFO)

  constructor(private readonly maxPerOwner = 50) {}

  save(task: BrainTask): void {
    this.tasks.set(task.id, task);
    const ids = this.byOwner.get(task.userId) ?? [];
    if (!ids.includes(task.id)) {
      ids.push(task.id);
    }
    while (ids.length > this.maxPerOwner) {
      const evicted = ids.shift();
      if (evicted !== undefined) this.tasks.delete(evicted);
    }
    this.byOwner.set(task.userId, ids);
  }

  get(userId: string, taskId: string): BrainTask | undefined {
    const task = this.tasks.get(taskId);
    // Owner-scoped: a foreign task is indistinguishable from absent.
    return task && task.userId === userId ? task : undefined;
  }

  list(userId: string): BrainTask[] {
    const ids = this.byOwner.get(userId) ?? [];
    return ids.map((id) => this.tasks.get(id)).filter((t): t is BrainTask => t !== undefined);
  }
}

export class InMemoryBrainDecisionStore implements BrainDecisionStore {
  private readonly byTask = new Map<string, BrainDecisionRecord[]>();

  save(record: BrainDecisionRecord): void {
    const key = `${record.userId}:${record.taskId}`;
    const list = this.byTask.get(key) ?? [];
    list.push(record);
    // Bounded: keep the most recent 200 decisions per task.
    this.byTask.set(key, list.slice(-200));
  }

  get(userId: string, taskId: string): BrainDecisionRecord[] {
    // Owner-scoped: foreign keys return empty.
    return this.byTask.get(`${userId}:${taskId}`) ?? [];
  }
}
