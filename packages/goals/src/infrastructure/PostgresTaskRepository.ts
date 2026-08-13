// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Task Repository
// Postgres-backed implementation of the TaskRepository contract.
// Stores tasks as JSONB documents in a single table, indexed by
// the branded TaskId (providers pattern).
//
// EI-006 — Enterprise Goal & Task Intelligence Engine (CERT-002 C-04)
// ──────────────────────────────────────────────────────────────────

import type { Task } from '../types/goal-types.js';
import type { TaskRepository } from '../domain/repository/TaskRepository.js';
import type { TaskId } from '../domain/value-objects/Identifiers.js';
import type postgres from 'postgres';

interface TaskRow {
  id: string;
  data: unknown;
}

export class PostgresTaskRepository implements TaskRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the task_registry table exists (IF NOT EXISTS). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS task_registry (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  // ── Row <-> Entity serialization ──────────────────────────────────────────

  private rowToTask(row: TaskRow): Task {
    const raw = typeof row.data === 'string' ? (JSON.parse(row.data) as Task) : (row.data as Task);
    return raw;
  }

  private taskToRow(task: Task): Record<string, unknown> {
    return {
      id: task.taskId,
      data: JSON.stringify(task),
      updated_at: new Date(task.updatedAt).toISOString(),
    };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async save(task: Task): Promise<void> {
    await this.sql`
      INSERT INTO task_registry ${this.sql(this.taskToRow(task))}
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  async saveMany(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await this.save(task);
    }
  }

  async findById(id: TaskId): Promise<Task | undefined> {
    const rows = await this.sql<TaskRow[]>`SELECT id, data FROM task_registry WHERE id = ${id}`;
    const first = rows[0];
    return first ? this.rowToTask(first) : undefined;
  }

  async findByGoal(goalId: string): Promise<Task[]> {
    const rows = await this.sql<
      TaskRow[]
    >`SELECT id, data FROM task_registry WHERE data->>'goalId' = ${goalId}`;
    return rows.map((r) => this.rowToTask(r));
  }

  async listAll(): Promise<Task[]> {
    const rows = await this.sql<
      TaskRow[]
    >`SELECT id, data FROM task_registry ORDER BY data->>'taskId' ASC`;
    return rows.map((r) => this.rowToTask(r));
  }

  async delete(id: TaskId): Promise<boolean> {
    const rows = await this.sql<[{ deleted: boolean }]>`
      WITH removed AS (DELETE FROM task_registry WHERE id = ${id} RETURNING id)
      SELECT EXISTS(SELECT 1 FROM removed) AS deleted
    `;
    return rows[0].deleted;
  }

  async exists(id: TaskId): Promise<boolean> {
    const rows = await this.sql<[{ exists: boolean }]>`
      SELECT EXISTS(SELECT 1 FROM task_registry WHERE id = ${id}) AS exists
    `;
    return rows[0].exists;
  }
}
