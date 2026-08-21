// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Audit Log Store
// SPRINT-027 (R-2) — durable, owner-scoped gateway audit logging.
//
// The gateway audit trail was previously an in-memory, bounded array in
// middleware/audit.ts (lost on restart). This store makes it durable through
// the SAME WriteThroughDocumentStore pattern the Persistent Intelligence
// Foundation uses (sync mirror + async idempotent write-through + boot
// hydrate + shutdown flush + FIFO retention) — no new infrastructure.
//
//   • in-memory  — dev/test (the documented hermetic convention);
//   • Postgres   — production/staging (table `gateway_audit_logs`).
//
// Stored entries are TRANSPORT-level metadata (path, duration, success,
// error code) — never bodies, never secrets, never tokens. Owner-scoped by
// query construction (PRIMARY KEY (owner, key)); a foreign owner can never
// read another user's entries.
// ─────────────────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';

// ── Audit Entry Types (kept here so middleware + routers share one shape) ────

export type AuditEventType =
  | 'api.request'
  | 'api.error'
  | 'auth.login'
  | 'auth.logout'
  | 'config.update'
  | 'notification.dismiss'
  | 'cache.invalidate'
  | 'search.perform';

export interface AuditEntry {
  id: string;
  timestamp: string;
  type: AuditEventType;
  userId: string;
  path: string;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/** Owner-scoped audit log seam (synchronous contract; write-through backend). */
export interface AuditLogStore {
  record(entry: AuditEntry): void;
  list(userId?: string, limit?: number): AuditEntry[];
}

/** Retention bounds (match the in-memory convention — never an unbounded sink). */
export const AUDIT_ENTRIES_PER_OWNER = 1000;
export const IN_MEMORY_AUDIT_CAP = 10_000;

// ── In-memory backend (dev/test + the pre-persistence default) ───────────────

export class InMemoryAuditLogStore implements AuditLogStore {
  private readonly entries: AuditEntry[] = [];

  record(entry: AuditEntry): void {
    this.entries.push(entry);
    if (this.entries.length > IN_MEMORY_AUDIT_CAP) {
      this.entries.splice(0, this.entries.length - IN_MEMORY_AUDIT_CAP);
    }
  }

  list(userId?: string, limit = 50): AuditEntry[] {
    const filtered = userId ? this.entries.filter((e) => e.userId === userId) : [...this.entries];
    return filtered.slice(-Math.max(0, limit)).reverse();
  }
}

// ── Postgres write-through backend (production/staging) ──────────────────────

/** Owner-scoped audit entries — keyed (userId, entry.id), FIFO retention. */
export class PostgresAuditLogStore
  extends WriteThroughDocumentStore<AuditEntry>
  implements AuditLogStore
{
  constructor(sql: postgres.Sql, table = 'gateway_audit_logs') {
    super(sql, table);
  }

  record(entry: AuditEntry): void {
    this.write(entry.userId, entry.id, entry);
    this.prune(
      entry.userId,
      AUDIT_ENTRIES_PER_OWNER,
      (e) => e.timestamp,
      (e) => e.id,
    );
  }

  list(userId?: string, limit = 50): AuditEntry[] {
    let entries: AuditEntry[];
    if (userId) {
      entries = this.all(userId);
    } else {
      // Operator-wide view across the mirror (bounded by per-owner retention).
      entries = [];
      for (const doc of this.mirror.values()) entries.push(structuredClone(doc));
    }
    entries.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return entries.slice(0, Math.max(0, limit));
  }
}
