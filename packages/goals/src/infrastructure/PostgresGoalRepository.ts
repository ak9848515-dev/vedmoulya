// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Goal Repository
// Postgres-backed implementation of the GoalRepository contract.
// Stores goals as JSONB documents in a single table, indexed by
// the branded GoalId (providers pattern).
//
// EI-006 — Enterprise Goal & Task Intelligence Engine (CERT-002 C-04)
// ──────────────────────────────────────────────────────────────────

import type { Goal, GoalSearchCriteria } from '../types/goal-types.js';
import type { GoalRepository } from '../domain/repository/GoalRepository.js';
import type { GoalId } from '../domain/value-objects/Identifiers.js';
import type postgres from 'postgres';

interface GoalRow {
  id: string;
  data: unknown;
}

export class PostgresGoalRepository implements GoalRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the goal_registry table exists (IF NOT EXISTS). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS goal_registry (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  // ── Row <-> Entity serialization ──────────────────────────────────────────

  private rowToGoal(row: GoalRow): Goal {
    const raw = typeof row.data === 'string' ? (JSON.parse(row.data) as Goal) : (row.data as Goal);
    return raw;
  }

  private goalToRow(goal: Goal): Record<string, unknown> {
    return {
      id: goal.goalId,
      data: JSON.stringify(goal),
      updated_at: new Date(goal.updatedAt).toISOString(),
    };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async save(goal: Goal): Promise<void> {
    await this.sql`
      INSERT INTO goal_registry ${this.sql(this.goalToRow(goal))}
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  async findById(id: GoalId): Promise<Goal | undefined> {
    const rows = await this.sql<GoalRow[]>`SELECT id, data FROM goal_registry WHERE id = ${id}`;
    const first = rows[0];
    return first ? this.rowToGoal(first) : undefined;
  }

  async listAll(): Promise<Goal[]> {
    const rows = await this.sql<
      GoalRow[]
    >`SELECT id, data FROM goal_registry ORDER BY data->>'goalId' ASC`;
    return rows.map((r) => this.rowToGoal(r));
  }

  async search(criteria: GoalSearchCriteria): Promise<{ items: Goal[]; total: number }> {
    const conditions: string[] = [];
    const params: Array<string | string[] | number> = [];
    let paramIdx = 1;

    const q = criteria.query?.trim().toLowerCase();
    if (q) {
      conditions.push(
        `(LOWER(data->>'title') LIKE $${paramIdx} OR LOWER(data->>'description') LIKE $${paramIdx} OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'tags') t WHERE LOWER(t) LIKE $${paramIdx}))`,
      );
      params.push(`%${q}%`);
      paramIdx++;
    }
    if (criteria.categories && criteria.categories.length > 0) {
      conditions.push(`data->>'category' = ANY($${paramIdx})`);
      params.push(criteria.categories);
      paramIdx++;
    }
    if (criteria.statuses && criteria.statuses.length > 0) {
      conditions.push(`data->>'status' = ANY($${paramIdx})`);
      params.push(criteria.statuses);
      paramIdx++;
    }
    if (criteria.priorities && criteria.priorities.length > 0) {
      conditions.push(`data->>'priority' = ANY($${paramIdx})`);
      params.push(criteria.priorities);
      paramIdx++;
    }
    if (criteria.business && criteria.business.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'business') b WHERE b = ANY($${paramIdx}))`,
      );
      params.push(criteria.business);
      paramIdx++;
    }
    if (criteria.tags && criteria.tags.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'tags') t WHERE t = ANY($${paramIdx}))`,
      );
      params.push(criteria.tags);
      paramIdx++;
    }
    if (criteria.minConfidence !== undefined) {
      conditions.push(`(data->>'confidence')::numeric >= $${paramIdx}`);
      params.push(criteria.minConfidence);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRows = await this.sql.unsafe<[{ count: number }]>(
      `SELECT COUNT(*)::int AS count FROM goal_registry ${where}`,
      params as never,
    );
    const total = countRows[0].count;
    const page = Math.max(1, criteria.page ?? 1);
    const limit = Math.max(1, criteria.limit ?? 50);
    const offset = (page - 1) * limit;
    const allParams = [...params, limit, offset];
    const rows = await this.sql.unsafe<GoalRow[]>(
      `SELECT id, data FROM goal_registry ${where} ORDER BY (data->>'goalScore')::numeric DESC LIMIT $${paramIdx + params.length} OFFSET $${paramIdx + params.length + 1}`,
      allParams as never,
    );
    return {
      items: rows.map((r) => this.rowToGoal(r)),
      total,
    };
  }

  async findByCategory(category: string): Promise<Goal[]> {
    const rows = await this.sql<
      GoalRow[]
    >`SELECT id, data FROM goal_registry WHERE data->>'category' = ${category}`;
    return rows.map((r) => this.rowToGoal(r));
  }

  async findByStatus(status: string): Promise<Goal[]> {
    const rows = await this.sql<
      GoalRow[]
    >`SELECT id, data FROM goal_registry WHERE data->>'status' = ${status}`;
    return rows.map((r) => this.rowToGoal(r));
  }

  async findChildren(parentGoalId: string): Promise<Goal[]> {
    const rows = await this.sql<
      GoalRow[]
    >`SELECT id, data FROM goal_registry WHERE data->>'parentGoalId' = ${parentGoalId}`;
    return rows.map((r) => this.rowToGoal(r));
  }

  async delete(id: GoalId): Promise<boolean> {
    const rows = await this.sql<[{ deleted: boolean }]>`
      WITH removed AS (DELETE FROM goal_registry WHERE id = ${id} RETURNING id)
      SELECT EXISTS(SELECT 1 FROM removed) AS deleted
    `;
    return rows[0].deleted;
  }

  async exists(id: GoalId): Promise<boolean> {
    const rows = await this.sql<[{ exists: boolean }]>`
      SELECT EXISTS(SELECT 1 FROM goal_registry WHERE id = ${id}) AS exists
    `;
    return rows[0].exists;
  }
}
