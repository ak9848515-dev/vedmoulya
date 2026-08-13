// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Task Repository Contract
// EI-006 — Enterprise Goal & Task Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { Task } from '../../types/goal-types.js';
import type { TaskId } from '../value-objects/Identifiers.js';

export interface TaskRepository {
  save(task: Task): Promise<void>;
  saveMany(tasks: Task[]): Promise<void>;
  findById(id: TaskId): Promise<Task | undefined>;
  findByGoal(goalId: string): Promise<Task[]>;
  listAll(): Promise<Task[]>;
  delete(id: TaskId): Promise<boolean>;
  exists(id: TaskId): Promise<boolean>;
}
