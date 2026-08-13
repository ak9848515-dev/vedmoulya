// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane: Operator Gate & Audit Trail
// EPIC-012 — Production Observability & Control Plane (Phase 11/14)
//
// Every control-plane ACTION is authenticated (tRPC), authorized
// (OperatorGate — an explicit allowlist, NEVER open), audited (bounded
// AuditTrail with actor + action + target + detail) and idempotent where
// the underlying engine supports it. No dangerous unrestricted controls
// exist; the operator list comes from OPS_OPERATOR_IDS (comma-separated
// user ids) and defaults to empty (deny-all).
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditRecord {
  id: string;
  /** Actor userId who performed the action. */
  actor: string;
  action: string;
  target?: string;
  detail?: string;
  /** True when the action succeeded. */
  ok: boolean;
  createdAt: number;
}

/** Operator allowlist gate. Empty list = deny-all (fail closed). */
export class OperatorGate {
  private readonly operatorIds: Set<string>;

  constructor(operatorIds: string[] = parseOperatorIds()) {
    this.operatorIds = new Set(operatorIds);
  }

  isOperator(userId: string): boolean {
    return this.operatorIds.has(userId);
  }

  /** Bounded recent alert history access requires an operator. */
  requireOperator(userId: string): void {
    if (!this.isOperator(userId)) {
      const error = new Error('Operator privileges required for this control action');
      (error as Error & { code?: string }).code = 'OPS_FORBIDDEN';
      throw error;
    }
  }
}

/** Parse OPS_OPERATOR_IDS env (comma-separated). Absent = deny-all. */
export function parseOperatorIds(): string[] {
  const raw = process.env.OPS_OPERATOR_IDS?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Bounded ring-buffer audit log for operator control actions. */
export class AuditTrail {
  private readonly records: AuditRecord[] = [];
  private readonly maxRecords: number;
  private readonly now: () => number;
  private seq = 0;

  constructor(options: { maxRecords?: number; now?: () => number } = {}) {
    this.maxRecords = options.maxRecords ?? 500;
    this.now = options.now ?? ((): number => Date.now());
  }

  record(input: {
    actor: string;
    action: string;
    target?: string;
    detail?: string;
    ok: boolean;
  }): AuditRecord {
    this.seq += 1;
    const record: AuditRecord = {
      id: `audit-${this.seq}`,
      actor: input.actor,
      action: input.action,
      target: input.target,
      detail: input.detail,
      ok: input.ok,
      createdAt: this.now(),
    };
    this.records.push(record);
    if (this.records.length > this.maxRecords) this.records.shift();
    return record;
  }

  list(limit = 100): AuditRecord[] {
    return this.records.slice(-limit).reverse();
  }
}
