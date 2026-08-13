// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Enterprise OS Repository
// Postgres-backed implementation of the OSRepository contract.
// Stores OS health snapshots as JSONB documents in the
// `os_health_registry` table keyed by (collection, id) — the same
// JSONB-document pattern as every Enterprise Intelligence store.
// Migration ready: `ensureTable()` creates the table if it does not
// exist (IF NOT EXISTS) and creates an index on the snapshot date.
//
// OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import type { OSHealthSnapshot } from '../types/os-types.js';
import type { OSRepository } from '../domain/repository/OSRepository.js';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];

interface RegistryRow {
  id: string;
  data: unknown;
}

const SNAPSHOTS_COLLECTION = 'snapshot';

export class PostgresOSRepository implements OSRepository {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Ensure the os_health_registry table exists (IF NOT EXISTS) + index. */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS os_health_registry (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection, id)
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS os_health_registry_checked_idx
      ON os_health_registry ((data->>'checkedAt')) WHERE collection = 'snapshot'
    `;
  }

  async saveSnapshot(snapshot: OSHealthSnapshot): Promise<void> {
    // Bind via sql.json(snapshot): serializes exactly once for jsonb OID 3802.
    // JSON.stringify(snapshot)::jsonb DOUBLE-encodes — a real-DB corruption bug.
    await this.sql`
      INSERT INTO os_health_registry (collection, id, data, updated_at)
      VALUES (${SNAPSHOTS_COLLECTION}, ${snapshot.snapshotId}, ${this.sql.json(snapshot as unknown as JsonParam)}, ${new Date().toISOString()}::timestamptz)
      ON CONFLICT (collection, id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
  }

  async listSnapshots(limit?: number): Promise<OSHealthSnapshot[]> {
    const rows = await this.sql<RegistryRow[]>`
      SELECT id, data FROM os_health_registry
      WHERE collection = ${SNAPSHOTS_COLLECTION}
      ORDER BY (data->>'checkedAt') DESC
      ${limit !== undefined ? this.sql`LIMIT ${limit}` : this.sql``}
    `;
    return rows.map((row) => {
      const raw =
        typeof row.data === 'string'
          ? (JSON.parse(row.data) as Record<string, unknown>)
          : (row.data as Record<string, unknown>);
      return raw as unknown as OSHealthSnapshot;
    });
  }

  async countSnapshots(): Promise<number> {
    const rows = await this.sql<Array<{ count: string }>>`
      SELECT COUNT(*) AS count FROM os_health_registry WHERE collection = ${SNAPSHOTS_COLLECTION}
    `;
    return Number(rows[0]?.count ?? 0);
  }
}
