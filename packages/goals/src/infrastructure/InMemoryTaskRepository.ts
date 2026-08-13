// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: In-Memory Task Repository
// EI-006 — Enterprise Goal & Task Intelligence Engine
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- see InMemoryGoalRepository */

import type { Task } from '../types/goal-types.js';
import type { TaskRepository } from '../domain/repository/TaskRepository.js';
import { createTaskId, type TaskId } from '../domain/value-objects/Identifiers.js';

export class InMemoryTaskRepository implements TaskRepository {
  private readonly store = new Map<string, Task>();

  constructor(seed: Task[] = []) {
    for (const task of seed) {
      this.store.set(task.taskId, structuredClone(task));
    }
  }

  async save(task: Task): Promise<void> {
    this.store.set(task.taskId, structuredClone(task));
  }

  async saveMany(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      this.store.set(task.taskId, structuredClone(task));
    }
  }

  async findById(id: TaskId): Promise<Task | undefined> {
    const task = this.store.get(id);
    return task ? structuredClone(task) : undefined;
  }

  async findByGoal(goalId: string): Promise<Task[]> {
    return [...this.store.values()]
      .filter((t) => t.goalId === goalId)
      .map((t) => structuredClone(t));
  }

  async listAll(): Promise<Task[]> {
    return [...this.store.values()].map((t) => structuredClone(t));
  }

  async delete(id: TaskId): Promise<boolean> {
    return this.store.delete(id);
  }

  async exists(id: TaskId): Promise<boolean> {
    return this.store.has(id);
  }

  static createId(id: string): TaskId {
    return createTaskId(id);
  }
}
