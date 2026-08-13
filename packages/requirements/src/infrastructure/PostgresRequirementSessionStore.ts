// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Postgres Session Store
// EPIC-009 — production persistence for requirement sessions. Stores
// the full RequirementSession document as JSONB in
// `requirement_sessions`, keyed by session_id with owner/phase/
// updated_at columns for owner-scoped listing. Follows the established
// gateway convention (lazy postgres.js pool, idempotent ensureTable,
// JSONB documents — the same pattern as every EI engine repository).
// Ownership is enforced by the engine, never by the UI.
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import type { RequirementSession } from '../types/requirement-types.js';
import type { RequirementSessionStore } from '../contracts/requirement-ports.js';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];

interface RequirementSessionRow {
  session_id: string;
  owner: string;
  phase: string;
  updated_at: string;
  document: string;
}

export class PostgresRequirementSessionStore implements RequirementSessionStore {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the requirement_sessions table exists (idempotent). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS requirement_sessions (
        session_id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        phase TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        document JSONB NOT NULL
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS requirement_sessions_owner_updated_idx
      ON requirement_sessions (owner, updated_at DESC)
    `;
  }

  async save(session: RequirementSession): Promise<void> {
    await this.sql`
      INSERT INTO requirement_sessions (session_id, owner, phase, updated_at, document)
      VALUES (
        ${session.sessionId},
        ${session.owner},
        ${session.phase},
        ${session.updatedAt},
        ${this.sql.json(session as unknown as JsonParam)}
      )
      ON CONFLICT (session_id) DO UPDATE SET
        owner = EXCLUDED.owner,
        phase = EXCLUDED.phase,
        updated_at = EXCLUDED.updated_at,
        document = EXCLUDED.document
    `;
  }

  async get(sessionId: string): Promise<RequirementSession | undefined> {
    const rows = await this.sql<RequirementSessionRow[]>`
      SELECT session_id, owner, phase, updated_at, document::text AS document
      FROM requirement_sessions
      WHERE session_id = ${sessionId}
    `;
    const row = rows[0];
    return row ? (JSON.parse(row.document) as RequirementSession) : undefined;
  }

  async list(owner?: string): Promise<RequirementSession[]> {
    const rows = owner
      ? await this.sql<RequirementSessionRow[]>`
          SELECT session_id, owner, phase, updated_at, document::text AS document
          FROM requirement_sessions
          WHERE owner = ${owner}
          ORDER BY updated_at DESC
        `
      : await this.sql<RequirementSessionRow[]>`
          SELECT session_id, owner, phase, updated_at, document::text AS document
          FROM requirement_sessions
          ORDER BY updated_at DESC
        `;
    return rows.map((row) => JSON.parse(row.document) as RequirementSession);
  }

  async delete(sessionId: string): Promise<boolean> {
    const result = await this.sql`
      DELETE FROM requirement_sessions
      WHERE session_id = ${sessionId}
    `;
    return result.count > 0;
  }
}
