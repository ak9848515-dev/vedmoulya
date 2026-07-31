// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Audit Logger Middleware
// Logs API requests for observability and compliance
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

// ── Audit Event Types ───────────────────────────────────────────────────────

export type AuditEventType =
  | 'api.request'
  | 'api.error'
  | 'auth.login'
  | 'auth.logout'
  | 'config.update'
  | 'notification.dismiss'
  | 'cache.invalidate'
  | 'search.perform';

// ── Audit Entry ─────────────────────────────────────────────────────────────

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

// ── Audit Logger ────────────────────────────────────────────────────────────

const auditLog: AuditEntry[] = [];
const MAX_LOG_SIZE = 10_000;

/**
 * Log an API audit event.
 * Stores in memory for now — will be wired to persistent storage in production.
 */
export function logAuditEvent(entry: Omit<AuditEntry, 'id'>): void {
  const auditEntry: AuditEntry = {
    ...entry,
    id: `audit_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
  };

  auditLog.push(auditEntry);

  // Prevent unbounded memory growth
  if (auditLog.length > MAX_LOG_SIZE) {
    auditLog.shift();
  }
}

/**
 * Query recent audit events for a user.
 */
export function getAuditLog(userId?: string, limit = 50): AuditEntry[] {
  let entries = auditLog;

  if (userId) {
    entries = entries.filter((e) => e.userId === userId);
  }

  return entries.slice(-limit).reverse();
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
