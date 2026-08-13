// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Pipeline Repository
// Postgres-backed implementation of the PipelineRepository contract.
// Stores enterprise pipelines as JSONB documents in a single table,
// indexed by the branded PipelineId (same pattern as
// PostgresProviderRepository). The JSONB approach keeps the rich
// nested entity (steps, validation, artifacts) atomic on read/write.
//
// EI-006 / INT-001 — Enterprise Intelligence Pipeline (CERT-002 C-04)
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import type { EnterprisePipeline } from '../types/pipeline-types.js';
import type { PipelineId } from '../domain/value-objects/PipelineId.js';
import type { PipelineRepository } from '../domain/repository/PipelineRepository.js';

interface PipelineRow {
  id: string;
  data: unknown;
}

export class PostgresPipelineRepository implements PipelineRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the enterprise_pipeline table exists (IF NOT EXISTS). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS enterprise_pipeline (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  // ── Row <-> Entity serialization ──────────────────────────────────────────

  private rowToPipeline(row: PipelineRow): EnterprisePipeline {
    const raw =
      typeof row.data === 'string'
        ? (JSON.parse(row.data) as EnterprisePipeline)
        : (row.data as EnterprisePipeline);
    return {
      ...raw,
      createdAt: new Date(raw.createdAt).toISOString(),
      updatedAt: new Date(raw.updatedAt).toISOString(),
    };
  }

  private pipelineToRow(pipeline: EnterprisePipeline): Record<string, unknown> {
    return {
      id: pipeline.pipelineId,
      goal_id: pipeline.goalId,
      data: JSON.stringify(pipeline),
      updated_at: new Date(pipeline.updatedAt).toISOString(),
    };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async save(pipeline: EnterprisePipeline): Promise<void> {
    await this.sql`
      INSERT INTO enterprise_pipeline ${this.sql(this.pipelineToRow(pipeline))}
      ON CONFLICT (id) DO UPDATE SET
        goal_id = EXCLUDED.goal_id,
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at
    `;
  }

  async findById(id: PipelineId): Promise<EnterprisePipeline | undefined> {
    const rows = await this.sql<
      PipelineRow[]
    >`SELECT id, data FROM enterprise_pipeline WHERE id = ${id}`;
    const first = rows[0];
    return first ? this.rowToPipeline(first) : undefined;
  }

  async findByGoal(goalId: string): Promise<EnterprisePipeline[]> {
    const rows = await this.sql<PipelineRow[]>`
      SELECT id, data FROM enterprise_pipeline
      WHERE goal_id = ${goalId}
      ORDER BY data->>'createdAt' DESC
    `;
    return rows.map((r) => this.rowToPipeline(r));
  }

  async listAll(): Promise<EnterprisePipeline[]> {
    const rows = await this.sql<PipelineRow[]>`
      SELECT id, data FROM enterprise_pipeline
      ORDER BY data->>'createdAt' DESC
    `;
    return rows.map((r) => this.rowToPipeline(r));
  }

  async exists(id: PipelineId): Promise<boolean> {
    const rows = await this.sql<[{ exists: boolean }]>`
      SELECT EXISTS(SELECT 1 FROM enterprise_pipeline WHERE id = ${id}) AS exists
    `;
    return rows[0].exists;
  }

  async delete(id: PipelineId): Promise<boolean> {
    const rows = await this.sql<{ deleted: boolean }[]>`
      DELETE FROM enterprise_pipeline WHERE id = ${id} RETURNING true AS deleted
    `;
    return rows.length > 0;
  }
}
