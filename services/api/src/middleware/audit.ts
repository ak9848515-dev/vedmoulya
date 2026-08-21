// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Audit Logger Middleware
// BLD-016A — API Gateway & Platform Services
// SPRINT-027 (R-2) — durable audit logging.
//
// The gateway audit trail is now backed by an injectable AuditLogStore
// (in-memory by default; Postgres write-through in production/staging via the
// persistence bundle — see infrastructure/AuditLogStore.ts). The public API
// (logAuditEvent / getAuditLog / createRequestAudit) is unchanged so routers
// keep working; the storage backend is a wiring concern.
// ─────────────────────────────────────────────────────────────────────────────

import {
  InMemoryAuditLogStore,
  type AuditEntry,
  type AuditEventType,
  type AuditLogStore,
} from '../infrastructure/AuditLogStore.js';

export type { AuditEntry, AuditEventType } from '../infrastructure/AuditLogStore.js';

// Default: the deterministic in-memory store (dev/test). ApiApplicationService
// replaces it with the Postgres write-through store in production/staging
// (one setAuditStore call at gateway construction — the same wiring pattern
// as the persistence bundle).
let activeStore: AuditLogStore = new InMemoryAuditLogStore();

/** Swap the audit backend (gateway wiring / tests). */
export function setAuditStore(store: AuditLogStore): void {
  activeStore = store;
}

/** The currently active audit backend (tests / status). */
export function getAuditStore(): AuditLogStore {
  return activeStore;
}

/**
 * Log an API audit event. Owner-scoped, bounded (per-store retention),
 * never throws into the caller — a failed durable write is logged loudly by
 * the write-through store and the mirror keeps serving.
 */
export function logAuditEvent(entry: Omit<AuditEntry, 'id'>): void {
  const auditEntry: AuditEntry = {
    ...entry,
    id: `audit_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
  };
  activeStore.record(auditEntry);
}

/**
 * Query recent audit events (optionally for one user).
 */
export function getAuditLog(userId?: string, limit = 50): AuditEntry[] {
  return activeStore.list(userId, limit);
}

/**
 * Create an audit entry for an API request.
 */
export function createRequestAudit(
  type: AuditEventType,
  userId: string,
  path: string,
  duration: number,
  success: boolean,
  error?: string,
): void {
  logAuditEvent({
    timestamp: new Date().toISOString(),
    type,
    userId,
    path,
    duration,
    success,
    error,
  });
}
