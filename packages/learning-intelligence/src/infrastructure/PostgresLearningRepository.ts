// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Learning Repository
// Postgres-backed implementation of the LearningRepository contract.
// Stores learning events + safety decisions as JSONB documents in a
// single `learning_registry` table keyed by (collection, id) — the same
// JSONB-document pattern as the other Enterprise Intelligence stores
// (capabilities, providers, context, goals, pipeline). Migration ready:
// `ensureTable()` creates the table if it does not exist (IF NOT EXISTS).
//
// EI-007 — Enterprise Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type postgres from 'postgres';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];
import type {
  LearningCategory,
  LearningDecision,
  LearningEvent,
  LearningOutcome,
} from '../types/learning-types.js';
import { LEARNING_CATEGORIES, LEARNING_OUTCOMES } from '../types/learning-types.js';
import type {
  LearningEventSearch,
  LearningRepository,
} from '../domain/repository/LearningRepository.js';

interface RegistryRow {
  id: string;
  data: unknown;
}

type Collection = 'event' | 'decision';

const EVENTS_COLLECTION = 'event';
const DECISIONS_COLLECTION = 'decision';

export class PostgresLearningRepository implements LearningRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the learning_registry table exists (IF NOT EXISTS). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS learning_registry (
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

  private rowToEvent(row: RegistryRow): LearningEvent {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as Record<string, unknown>)
        : (row.data as Record<string, unknown>);
    return raw as unknown as LearningEvent;
  }

  private rowToDecision(row: RegistryRow): LearningDecision {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as Record<string, unknown>)
        : (row.data as Record<string, unknown>);
    return raw as unknown as LearningDecision;
  }

  private async findRow(collection: Collection, id: string): Promise<RegistryRow | null> {
    const rows = await this.sql<
      RegistryRow[]
    >`SELECT id, data FROM learning_registry WHERE collection = ${collection} AND id = ${id}`;
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
      INSERT INTO learning_registry (collection, id, data, updated_at)
      VALUES (${collection}, ${id}, ${this.sql.json(data as unknown as JsonParam)}, ${new Date().toISOString()}::timestamptz)
      ON CONFLICT (collection, id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  private async deleteRow(collection: Collection, id: string): Promise<void> {
    await this.sql`DELETE FROM learning_registry WHERE collection = ${collection} AND id = ${id}`;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async saveEvent(event: LearningEvent): Promise<void> {
    await this.upsert(
      EVENTS_COLLECTION,
      event.eventId,
      event as unknown as Record<string, unknown>,
    );
  }

  async findEventById(eventId: string): Promise<LearningEvent | null> {
    const row = await this.findRow(EVENTS_COLLECTION, eventId);
    return row ? this.rowToEvent(row) : null;
  }

  async listEvents(
    search: LearningEventSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LearningEvent>> {
    const conditions: string[] = [`collection = '${EVENTS_COLLECTION}'`];
    const params: Array<string | number> = [];
    let paramIdx = 1;

    if (search.category) {
      conditions.push(`data->>'category' = $${paramIdx}`);
      params.push(search.category);
      paramIdx += 1;
    }
    if (search.outcome) {
      conditions.push(`data->>'outcome' = $${paramIdx}`);
      params.push(search.outcome);
      paramIdx += 1;
    }
    if (search.entityId) {
      conditions.push(`data->>'entityId' = $${paramIdx}`);
      params.push(search.entityId);
      paramIdx += 1;
    }

    const where = conditions.join(' AND ');
    const countRows = await this.sql.unsafe<[{ count: number }]>(
      `SELECT COUNT(*)::int AS count FROM learning_registry WHERE ${where}`,
      params as never,
    );
    const total = countRows[0].count;
    const offset = (pagination.page - 1) * pagination.limit;
    const allParams = [...params, pagination.limit, offset];
    const rows = await this.sql.unsafe<RegistryRow[]>(
      `SELECT id, data FROM learning_registry WHERE ${where}
       ORDER BY (data->>'occurredAt') DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      allParams as never,
    );
    return {
      data: rows.map((r) => this.rowToEvent(r)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async listAllEvents(): Promise<LearningEvent[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM learning_registry
      WHERE collection = ${EVENTS_COLLECTION}
      ORDER BY (data->>'occurredAt') DESC
    `;
    return rows.map((r) => this.rowToEvent(r));
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.deleteRow(EVENTS_COLLECTION, eventId);
  }

  async countEvents(): Promise<number> {
    const rows = await this.sql<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM learning_registry WHERE collection = ${EVENTS_COLLECTION}
    `;
    return rows[0].count;
  }

  async countEventsByCategory(): Promise<Record<LearningCategory, number>> {
    const rows = await this.sql<{ category: string; count: number }[]>`
      SELECT data->>'category' AS category, COUNT(*)::int AS count
      FROM learning_registry WHERE collection = ${EVENTS_COLLECTION}
      GROUP BY data->>'category'
    `;
    const result: Record<LearningCategory, number> = Object.fromEntries(
      LEARNING_CATEGORIES.map((c) => [c, 0]),
    ) as Record<LearningCategory, number>;
    for (const row of rows) {
      if (row.category in result) result[row.category as LearningCategory] = row.count;
    }
    return result;
  }

  async countEventsByOutcome(): Promise<Record<LearningOutcome, number>> {
    const rows = await this.sql<{ outcome: string; count: number }[]>`
      SELECT data->>'outcome' AS outcome, COUNT(*)::int AS count
      FROM learning_registry WHERE collection = ${EVENTS_COLLECTION}
      GROUP BY data->>'outcome'
    `;
    const result: Record<LearningOutcome, number> = Object.fromEntries(
      LEARNING_OUTCOMES.map((o) => [o, 0]),
    ) as Record<LearningOutcome, number>;
    for (const row of rows) {
      if (row.outcome in result) result[row.outcome as LearningOutcome] = row.count;
    }
    return result;
  }

  // ── Safety decisions ──────────────────────────────────────────────────────

  async saveDecision(decision: LearningDecision): Promise<void> {
    await this.upsert(
      DECISIONS_COLLECTION,
      decision.decisionId,
      decision as unknown as Record<string, unknown>,
    );
  }

  async findDecisionById(decisionId: string): Promise<LearningDecision | null> {
    const row = await this.findRow(DECISIONS_COLLECTION, decisionId);
    return row ? this.rowToDecision(row) : null;
  }

  async findDecisionByRecommendation(recommendationId: string): Promise<LearningDecision | null> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM learning_registry
      WHERE collection = ${DECISIONS_COLLECTION} AND data->>'recommendationId' = ${recommendationId}
      LIMIT 1
    `;
    const row = rows[0];
    return row ? this.rowToDecision(row) : null;
  }

  async listDecisions(): Promise<LearningDecision[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM learning_registry
      WHERE collection = ${DECISIONS_COLLECTION}
      ORDER BY (data->>'updatedAt') DESC
    `;
    return rows.map((r) => this.rowToDecision(r));
  }

  async listDecisionsByStatus(status: LearningDecision['status']): Promise<LearningDecision[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM learning_registry
      WHERE collection = ${DECISIONS_COLLECTION} AND data->>'status' = ${status}
      ORDER BY (data->>'updatedAt') DESC
    `;
    return rows.map((r) => this.rowToDecision(r));
  }

  async deleteDecision(decisionId: string): Promise<void> {
    await this.deleteRow(DECISIONS_COLLECTION, decisionId);
  }
}
