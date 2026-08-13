// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Postgres Application Repository
// EPIC-008 — Phase 1. Production persistence for application projects.
// Stores the full AppProject document as JSONB in `application_projects`,
// keyed by application_id with owner/status/updated_at columns for
// owner-scoped listing. Follows the established gateway convention
// (lazy postgres.js pool, idempotent ensureTable, JSONB documents —
// same pattern as every EI engine repository).
//
// The repository NEVER trusts the caller: `list` is always owner-scoped
// by the engine, and `get` returns the raw document for the engine's
// own ownership check — cross-user access is prevented by the engine +
// auth middleware, not by the UI.
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import type { AppProject } from '../types/app-types.js';
import type { ApplicationProjectRepository } from '../contracts/application-repository.js';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];

interface ApplicationProjectRow {
  application_id: string;
  owner: string;
  status: string;
  updated_at: string;
  document: string;
}

/**
 * Postgres-backed ApplicationProjectRepository. JSONB documents in
 * `application_projects`; ensureTable() creates the table if missing.
 * The document column is round-tripped as ::text + JSON.parse (postgres.js
 * returns JSONB columns as strings) — identical to the other engine
 * repositories.
 */
export class PostgresApplicationRepository implements ApplicationProjectRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the application_projects table exists (idempotent). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS application_projects (
        application_id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        document JSONB NOT NULL
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS application_projects_owner_updated_idx
      ON application_projects (owner, updated_at DESC)
    `;
  }

  async save(project: AppProject): Promise<void> {
    await this.sql`
      INSERT INTO application_projects (application_id, owner, status, updated_at, document)
      VALUES (
        ${project.applicationId},
        ${project.owner},
        ${project.status},
        ${project.updatedAt},
        ${this.sql.json(project as unknown as JsonParam)}
      )
      ON CONFLICT (application_id) DO UPDATE SET
        owner = EXCLUDED.owner,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at,
        document = EXCLUDED.document
    `;
  }

  async get(applicationId: string): Promise<AppProject | undefined> {
    const rows = await this.sql<ApplicationProjectRow[]>`
      SELECT application_id, owner, status, updated_at, document::text AS document
      FROM application_projects
      WHERE application_id = ${applicationId}
    `;
    const row = rows[0];
    return row ? (JSON.parse(row.document) as AppProject) : undefined;
  }

  async list(owner?: string): Promise<AppProject[]> {
    const rows = owner
      ? await this.sql<ApplicationProjectRow[]>`
          SELECT application_id, owner, status, updated_at, document::text AS document
          FROM application_projects
          WHERE owner = ${owner}
          ORDER BY updated_at DESC
        `
      : await this.sql<ApplicationProjectRow[]>`
          SELECT application_id, owner, status, updated_at, document::text AS document
          FROM application_projects
          ORDER BY updated_at DESC
        `;
    return rows.map((row) => JSON.parse(row.document) as AppProject);
  }

  async delete(applicationId: string): Promise<boolean> {
    const result = await this.sql`
      DELETE FROM application_projects
      WHERE application_id = ${applicationId}
    `;
    return result.count > 0;
  }
}
