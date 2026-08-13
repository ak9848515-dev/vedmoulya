// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Execution Strategy Repository
// Postgres-backed implementation of the ExecutionStrategyRepository
// contract. Stores strategies as JSONB documents in a single table,
// indexed by the branded StrategyId (providers pattern).
//
// EI-004 — Enterprise Execution Strategy Engine (CERT-002 C-04)
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  ExecutionMode,
  ExecutionStrategy,
  StrategyPriority,
  StrategySearchCriteria,
} from '../types/strategy-types.js';
import { EXECUTION_MODES, STRATEGY_PRIORITIES } from '../types/strategy-types.js';
import type { ExecutionStrategyRepository } from '../domain/repository/ExecutionStrategyRepository.js';
import type { StrategyId } from '../domain/value-objects/StrategyId.js';
import type postgres from 'postgres';

interface StrategyRow {
  id: string;
  data: unknown;
}

export class PostgresExecutionStrategyRepository implements ExecutionStrategyRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the execution_strategy_registry table exists (IF NOT EXISTS). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS execution_strategy_registry (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  // ── Row <-> Entity serialization ──────────────────────────────────────────

  private rowToStrategy(row: StrategyRow): ExecutionStrategy {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as ExecutionStrategy)
        : (row.data as ExecutionStrategy);
    return raw;
  }

  private strategyToRow(strategy: ExecutionStrategy): Record<string, unknown> {
    return {
      id: strategy.strategyId,
      data: JSON.stringify(strategy),
      updated_at: new Date(strategy.updatedAt).toISOString(),
    };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async findById(id: StrategyId): Promise<ExecutionStrategy | null> {
    const rows = await this.sql<
      StrategyRow[]
    >`SELECT id, data FROM execution_strategy_registry WHERE id = ${id}`;
    const first = rows[0];
    return first ? this.rowToStrategy(first) : null;
  }

  async findByIds(ids: StrategyId[]): Promise<ExecutionStrategy[]> {
    if (ids.length === 0) return [];
    const rows = await this.sql<
      StrategyRow[]
    >`SELECT id, data FROM execution_strategy_registry WHERE id = ANY(${ids})`;
    return rows.map((r) => this.rowToStrategy(r));
  }

  async save(strategy: ExecutionStrategy): Promise<void> {
    await this.sql`
      INSERT INTO execution_strategy_registry ${this.sql(this.strategyToRow(strategy))}
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  async saveMany(strategies: ExecutionStrategy[]): Promise<void> {
    for (const strategy of strategies) {
      await this.save(strategy);
    }
  }

  async delete(id: StrategyId): Promise<void> {
    await this.sql`DELETE FROM execution_strategy_registry WHERE id = ${id}`;
  }

  async exists(id: StrategyId): Promise<boolean> {
    const rows = await this.sql<[{ exists: boolean }]>`
      SELECT EXISTS(SELECT 1 FROM execution_strategy_registry WHERE id = ${id}) AS exists
    `;
    return rows[0].exists;
  }

  // ── Search & Discovery ───────────────────────────────────────────────────

  async search(
    criteria: StrategySearchCriteria,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    const conditions: string[] = [];
    const params: Array<string | string[] | number> = [];
    let paramIdx = 1;

    const q = criteria.query?.trim().toLowerCase();
    if (q) {
      conditions.push(
        `(LOWER(data->>'goal') LIKE $${paramIdx} OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'business') b WHERE LOWER(b) LIKE $${paramIdx}) OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'capabilityPlan'->'requiredCapabilities') c WHERE LOWER(c) LIKE $${paramIdx}))`,
      );
      params.push(`%${q}%`);
      paramIdx++;
    }
    if (criteria.priority) {
      conditions.push(`data->>'priority' = $${paramIdx}`);
      params.push(criteria.priority);
      paramIdx++;
    }
    if (criteria.executionMode) {
      conditions.push(`data->>'executionMode' = $${paramIdx}`);
      params.push(criteria.executionMode);
      paramIdx++;
    }
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'capabilityPlan'->'requiredCapabilities') c WHERE c = ANY($${paramIdx}))`,
      );
      params.push(criteria.capabilities);
      paramIdx++;
    }
    if (criteria.business && criteria.business.length > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(data->'business') b WHERE b = ANY($${paramIdx}))`,
      );
      params.push(criteria.business);
      paramIdx++;
    }
    if (criteria.minConfidence !== undefined) {
      conditions.push(`(data->>'confidence')::numeric >= $${paramIdx}`);
      params.push(criteria.minConfidence);
      paramIdx++;
    }

    return this.paginateWhere(conditions.join(' AND '), params, pagination, paramIdx);
  }

  async listAll(): Promise<ExecutionStrategy[]> {
    const rows = await this.sql<
      StrategyRow[]
    >`SELECT id, data FROM execution_strategy_registry ORDER BY data->>'strategyId' ASC`;
    return rows.map((r) => this.rowToStrategy(r));
  }

  async listByPriority(
    priority: StrategyPriority,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    return this.paginateWhere(`data->>'priority' = $1`, [priority], params);
  }

  async listByExecutionMode(
    mode: ExecutionMode,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    return this.paginateWhere(`data->>'executionMode' = $1`, [mode], params);
  }

  async listByCapability(
    capability: CapabilityType,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    return this.paginateWhere(
      `data->'capabilityPlan'->'requiredCapabilities' @> $1::jsonb`,
      [JSON.stringify([capability])],
      params,
    );
  }

  async listByGoal(
    goalId: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    return this.paginateWhere(`data->>'goalId' = $1`, [goalId], params);
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  async count(): Promise<number> {
    const rows = await this.sql<
      [{ count: number }]
    >`SELECT COUNT(*)::int AS count FROM execution_strategy_registry`;
    return rows[0].count;
  }

  async countByPriority(): Promise<Record<StrategyPriority, number>> {
    const rows = await this.sql<{ priority: string; count: number }[]>`
      SELECT data->>'priority' AS priority, COUNT(*)::int AS count
      FROM execution_strategy_registry GROUP BY data->>'priority'
    `;
    const counts = new Map<StrategyPriority, number>(
      STRATEGY_PRIORITIES.map((priority) => [priority, 0]),
    );
    for (const row of rows) {
      counts.set(row.priority as StrategyPriority, row.count);
    }
    return Object.fromEntries(counts) as Record<StrategyPriority, number>;
  }

  async countByExecutionMode(): Promise<Record<ExecutionMode, number>> {
    const rows = await this.sql<{ mode: string; count: number }[]>`
      SELECT data->>'executionMode' AS mode, COUNT(*)::int AS count
      FROM execution_strategy_registry GROUP BY data->>'executionMode'
    `;
    const counts = new Map<ExecutionMode, number>(EXECUTION_MODES.map((mode) => [mode, 0]));
    for (const row of rows) {
      counts.set(row.mode as ExecutionMode, row.count);
    }
    return Object.fromEntries(counts) as Record<ExecutionMode, number>;
  }

  async averageConfidence(): Promise<number> {
    const rows = await this.sql<[{ avg: number | null }]>`
      SELECT AVG((data->>'confidence')::numeric)::real AS avg FROM execution_strategy_registry
    `;
    return rows[0].avg ?? 0;
  }

  // ── Shared pagination helper ─────────────────────────────────────────────

  private async paginateWhere(
    whereClause: string,
    params: Array<string | string[] | number>,
    pagination: PaginationParams,
    baseIdx = 1,
  ): Promise<PaginatedResult<ExecutionStrategy>> {
    const where = whereClause ? `WHERE ${whereClause}` : '';
    const countRows = await this.sql.unsafe<[{ count: number }]>(
      `SELECT COUNT(*)::int AS count FROM execution_strategy_registry ${where}`,
      params as never,
    );
    const total = countRows[0].count;
    const offset = (pagination.page - 1) * pagination.limit;
    const allParams = [...params, pagination.limit, offset];
    const rows = await this.sql.unsafe<StrategyRow[]>(
      `SELECT id, data FROM execution_strategy_registry ${where} ORDER BY (data->>'confidence')::numeric DESC LIMIT $${baseIdx + params.length} OFFSET $${baseIdx + params.length + 1}`,
      allParams as never,
    );
    return {
      data: rows.map((r) => this.rowToStrategy(r)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }
}
