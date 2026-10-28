// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: durable WORKSPACE lease (WORKSPACE-01)
//
// WHAT THIS IS
// ------------
// A cross-process, token-checked, expiring claim on ONE authorized workspace
// (normalized path). Its only job is to make "two attempts mutate the same
// repository at the same time" impossible — including across processes, which
// an in-memory lock cannot do.
//
// WHY IT REUSES THE MISSION TABLE
// -------------------------------
// The estate's convention is one generic JSONB document table per store, and
// `mission_controller_missions` already exists with PRIMARY KEY (owner, key).
// Workspace rows live under a RESERVED owner (`mission-controller-workspace`),
// so they never appear in `PostgresMissionStore.listByUserId` / `listActive`
// (which read only the `mission-controller` owner). No new table, no migration,
// no second persistence mechanism — exactly the same reasoning SPRINT-022 used
// for every other store.
//
// ATOMICITY
// ---------
// Acquisition is ONE statement (`INSERT … ON CONFLICT … DO UPDATE … WHERE`)
// that succeeds only when the existing row is this token's OR already expired;
// PostgreSQL evaluates the condition and the write under the same row lock, so
// two concurrent workers can never both win. Release is token-checked, so a
// stale attempt can never free the lease of the execution that replaced it.
//
// The lease EXPIRES, so a process that dies while holding it cannot block a
// workspace forever (the same recovery premise as the objective lease). The
// controller renews it on every confirmed objective renewal.
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import type { JSONValue } from 'postgres';
import { logger } from '@vedmoulya/core';
import type { WorkspaceLeasePort, WorkspaceLeaseRequest } from '@vedmoulya/mission-controller';

/** Reserved owner for workspace lease rows (never a mission owner). */
export const WORKSPACE_LEASE_OWNER = 'mission-controller-workspace';

/** The document persisted for one workspace claim (bounded, no secrets). */
export interface WorkspaceLeaseDocument {
  workspaceKey: string;
  missionId: string;
  objectiveId: string;
  token: string;
  acquiredAt: string;
  expiresAt: string;
}

type Sql = postgres.Sql;

export class PostgresWorkspaceLeaseStore implements WorkspaceLeasePort {
  constructor(
    private readonly sql: Sql,
    private readonly table: string = 'mission_controller_missions',
  ) {}

  /**
   * Idempotent DDL for the shared document table (same shape the mission store
   * creates): owner/key TEXT, doc JSONB, PRIMARY KEY (owner, key). Safe to run
   * on every boot and by the schema-bootstrap command.
   */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS ${this.sql(this.table)} (
        owner TEXT NOT NULL,
        key TEXT NOT NULL,
        doc JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (owner, key)
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS ${this.sql(`${this.table}_owner_updated_idx`)}
      ON ${this.sql(this.table)} (owner, updated_at DESC)
    `;
  }

  async acquire(workspaceKey: string, request: WorkspaceLeaseRequest): Promise<boolean> {
    // Acquire with bounded retries for transient PostgreSQL contention.
    // The idempotent INSERT ... ON CONFLICT is naturally safe against
    // concurrent workers; we only retry on serialization failures.
    const MAX_RETRIES = 3;
    const doc: WorkspaceLeaseDocument = {
      workspaceKey,
      missionId: request.missionId,
      objectiveId: request.objectiveId,
      token: request.token,
      acquiredAt: new Date(request.nowMs).toISOString(),
      expiresAt: request.expiresAt,
    };
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const rows = await this.sql<Array<{ doc: string }>>`
          INSERT INTO ${this.sql(this.table)} (owner, key, doc)
          VALUES (
            ${WORKSPACE_LEASE_OWNER},
            ${workspaceKey},
            ${this.sql.json(doc as unknown as JSONValue)}
          )
          ON CONFLICT (owner, key) DO UPDATE
            SET doc = EXCLUDED.doc, updated_at = now()
            WHERE ${this.sql(this.table)}.doc->>'token' = ${request.token}
               OR (${this.sql(this.table)}.doc->>'expiresAt')::timestamptz
                   <= to_timestamp(${request.nowMs} / 1000.0)
          RETURNING doc::text AS doc
        `;
        if (rows.length === 1) {
          return true;
        }
        // `RETURNING` cannot tell the two no-row outcomes apart: the statement
        // returns no row BOTH when someone else holds a live lease (refused)
        // AND when the upsert matched but PostgreSQL cannot return the incoming
        // row (the reported no-op on this Docker image). In the latter case the
        // write DID happen, so report success only when this exact token now
        // holds the row — never claim an acquisition we cannot prove.
        const [current] = await this.sql<Array<{ token: string }>>`
          SELECT doc->>'token' AS token
          FROM ${this.sql(this.table)}
          WHERE owner = ${WORKSPACE_LEASE_OWNER}
            AND key = ${workspaceKey}
          LIMIT 1
        `;
        return current?.token === request.token;
      } catch (error) {
        // Transient PostgreSQL contention (serialization failure, lock timeout)
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
          continue;
        }
        logger.warn('Workspace lease acquire failed after retries', {
          workspaceKey,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }
    return false;
  }

  async renew(
    workspaceKey: string,
    renewal: { token: string; nowMs: number; expiresAt: string },
  ): Promise<boolean> {
    // Retry loop: only attempt renewal while the lease is still valid (not expired).
    // Each iteration re-reads the current document to guard against a concurrent
    // renewal that already extended the expiry — if the token no longer matches
    // or the lease has been pre-emptively released, we stop rather than looping
    // indefinitely.
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const rows = await this.sql<Array<{ doc: string }>>`
        UPDATE ${this.sql(this.table)}
        SET doc = jsonb_set(doc, '{expiresAt}', to_jsonb(${renewal.expiresAt}::text)),
            updated_at = now()
        WHERE owner = ${WORKSPACE_LEASE_OWNER}
          AND key = ${workspaceKey}
          AND doc->>'token' = ${renewal.token}
          AND (doc->>'expiresAt')::timestamptz > to_timestamp(${renewal.nowMs} / 1000.0)
        RETURNING doc::text AS doc
      `;
      if (rows.length === 1) {
        return true;
      }
      // Renewal failed — the lease may have been released or expired.
      // Do not blindly retry; instead, re-read the current state to decide.
      const current = await this.held(workspaceKey, renewal.token);
      if (!current) {
        // Lease was released or never held — stop retrying.
        return false;
      }
      // Lease still held but perhaps expired; stop retrying to avoid
      // cascading contention.
      return false;
    }
    return false;
  }

  async release(workspaceKey: string, token: string): Promise<void> {
    await this.sql`
      DELETE FROM ${this.sql(this.table)}
      WHERE owner = ${WORKSPACE_LEASE_OWNER}
        AND key = ${workspaceKey}
        AND doc->>'token' = ${token}
    `;
  }

  async held(workspaceKey: string, token: string): Promise<boolean> {
    const rows = await this.sql<Array<{ doc: string }>>`
      SELECT doc::text AS doc
      FROM ${this.sql(this.table)}
      WHERE owner = ${WORKSPACE_LEASE_OWNER}
        AND key = ${workspaceKey}
        AND doc->>'token' = ${token}
      LIMIT 1
    `;
    return rows.length === 1;
  }
}
