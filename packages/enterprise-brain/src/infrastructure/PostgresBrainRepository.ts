// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Enterprise Brain Repository
// Postgres-backed implementation of the BrainRepository contract.
// Stores decision plans + decisions as JSONB documents in a single
// `brain_registry` table keyed by (collection, id) — the same
// JSONB-document pattern as every other Enterprise Intelligence store.
// Migration ready: `ensureTable()` creates the table if it does not
// exist (IF NOT EXISTS).
//
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type postgres from 'postgres';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];
import type { BrainDecision, BrainDecisionPlan } from '../types/brain-types.js';
import type { BrainDecisionSearch, BrainRepository } from '../domain/repository/BrainRepository.js';

interface RegistryRow {
  id: string;
  data: unknown;
}

type Collection = 'decision' | 'plan';

const DECISIONS_COLLECTION = 'decision';
const PLANS_COLLECTION = 'plan';

export class PostgresBrainRepository implements BrainRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the brain_registry table exists (IF NOT EXISTS). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS brain_registry (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection, id)
      )
    `;
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  private rowToDecision(row: RegistryRow): BrainDecision {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as Record<string, unknown>)
        : (row.data as Record<string, unknown>);
    return raw as unknown as BrainDecision;
  }

  private rowToPlan(row: RegistryRow): BrainDecisionPlan {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as Record<string, unknown>)
        : (row.data as Record<string, unknown>);
    return raw as unknown as BrainDecisionPlan;
  }

  private async findRow(collection: Collection, id: string): Promise<RegistryRow | null> {
    const rows = await this.sql<
      RegistryRow[]
    >`SELECT id, data FROM brain_registry WHERE collection = ${collection} AND id = ${id}`;
    return rows[0] ?? null;
  }

  private async upsert(
    collection: Collection,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Bind via sql.json(data): serializes exactly once for jsonb OID 3802.
    // JSON.stringify(data)::jsonb DOUBLE-encodes — a real-DB corruption bug.
    await this.sql`
      INSERT INTO brain_registry (collection, id, data, updated_at)
      VALUES (${collection}, ${id}, ${this.sql.json(data as unknown as JsonParam)}, ${new Date().toISOString()}::timestamptz)
      ON CONFLICT (collection, id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  private async deleteRow(collection: Collection, id: string): Promise<void> {
    await this.sql`DELETE FROM brain_registry WHERE collection = ${collection} AND id = ${id}`;
  }

  // ── Decisions ────────────────────────────────────────────────────────────

  async saveDecision(decision: BrainDecision): Promise<void> {
    await this.upsert(
      DECISIONS_COLLECTION,
      decision.decisionId,
      decision as unknown as Record<string, unknown>,
    );
  }

  async findDecisionById(decisionId: string): Promise<BrainDecision | null> {
    const row = await this.findRow(DECISIONS_COLLECTION, decisionId);
    return row ? this.rowToDecision(row) : null;
  }

  async listDecisions(
    search: BrainDecisionSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<BrainDecision>> {
    const conditions: string[] = [`collection = '${DECISIONS_COLLECTION}'`];
    const params: Array<string | number> = [];
    let paramIdx = 1;

    if (search.type) {
      conditions.push(`data->>'type' = $${paramIdx}`);
      params.push(search.type);
      paramIdx += 1;
    }
    if (search.status) {
      conditions.push(`data->>'status' = $${paramIdx}`);
      params.push(search.status);
      paramIdx += 1;
    }
    if (search.goalId) {
      conditions.push(`data->>'goalId' = $${paramIdx}`);
      params.push(search.goalId);
      paramIdx += 1;
    }

    const where = conditions.join(' AND ');
    const countRows = await this.sql.unsafe<[{ count: number }]>(
      `SELECT COUNT(*)::int AS count FROM brain_registry WHERE ${where}`,
      params as never,
    );
    const total = countRows[0].count;
    const offset = (pagination.page - 1) * pagination.limit;
    const allParams = [...params, pagination.limit, offset];
    const rows = await this.sql.unsafe<RegistryRow[]>(
      `SELECT id, data FROM brain_registry WHERE ${where}
       ORDER BY (data->>'createdAt') DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      allParams as never,
    );
    return {
      data: rows.map((r) => this.rowToDecision(r)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async listAllDecisions(): Promise<BrainDecision[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM brain_registry
      WHERE collection = ${DECISIONS_COLLECTION}
      ORDER BY (data->>'createdAt') DESC
    `;
    return rows.map((r) => this.rowToDecision(r));
  }

  async listDecisionsByGoal(goalId: string): Promise<BrainDecision[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM brain_registry
      WHERE collection = ${DECISIONS_COLLECTION} AND data->>'goalId' = ${goalId}
      ORDER BY (data->>'createdAt') DESC
    `;
    return rows.map((r) => this.rowToDecision(r));
  }

  async listDecisionsByPlan(planId: string): Promise<BrainDecision[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM brain_registry
      WHERE collection = ${DECISIONS_COLLECTION} AND data->>'planId' = ${planId}
      ORDER BY (data->>'createdAt') DESC
    `;
    return rows.map((r) => this.rowToDecision(r));
  }

  async deleteDecision(decisionId: string): Promise<void> {
    await this.deleteRow(DECISIONS_COLLECTION, decisionId);
  }

  async countDecisions(): Promise<number> {
    const rows = await this.sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM brain_registry WHERE collection = ${DECISIONS_COLLECTION}
    `;
    return rows[0].count;
  }

  // ── Plans ────────────────────────────────────────────────────────────────

  async savePlan(plan: BrainDecisionPlan): Promise<void> {
    await this.upsert(PLANS_COLLECTION, plan.planId, plan as unknown as Record<string, unknown>);
  }

  async findPlanById(planId: string): Promise<BrainDecisionPlan | null> {
    const row = await this.findRow(PLANS_COLLECTION, planId);
    return row ? this.rowToPlan(row) : null;
  }

  async listPlans(goalId?: string): Promise<BrainDecisionPlan[]> {
    const rows = goalId
      ? await this.sql<RegistryRow[]>`
          SELECT id, data FROM brain_registry
          WHERE collection = ${PLANS_COLLECTION} AND data->>'goalId' = ${goalId}
          ORDER BY (data->>'createdAt') DESC
        `
      : await this.sql<RegistryRow[]>`
          SELECT id, data FROM brain_registry
          WHERE collection = ${PLANS_COLLECTION}
          ORDER BY (data->>'createdAt') DESC
        `;
    return rows.map((r) => this.rowToPlan(r));
  }

  async deletePlan(planId: string): Promise<void> {
    await this.deleteRow(PLANS_COLLECTION, planId);
  }

  async countPlans(): Promise<number> {
    const rows = await this.sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM brain_registry WHERE collection = ${PLANS_COLLECTION}
    `;
    return rows[0].count;
  }
}
