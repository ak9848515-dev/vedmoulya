// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Audit Events
// Structured audit logging with correlation IDs for all decision operations
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';

export type DecisionAuditAction =
  | 'decision.created'
  | 'decision.made'
  | 'decision.completed'
  | 'decision.archived'
  | 'decision.cancelled'
  | 'decision.updated'
  | 'decision.option.added'
  | 'decision.option.scored'
  | 'decision.risk.assessed'
  | 'decision.opportunity.assessed'
  | 'decision.ranked'
  | 'decision.recommended'
  | 'decision.search.executed'
  | 'decision.constraint.evaluated';

export interface AuditEntry {
  id: string;
  correlationId: string;
  action: DecisionAuditAction;
  actorId: string;
  targetId?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
  success: boolean;
}

export class DecisionAuditor {
  private readonly serviceName = 'decision';

  /** Record an audit event with structured logging */
  record(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    const auditEntry: AuditEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    logger.info('Audit event', {
      audit: true,
      service: this.serviceName,
      ...auditEntry,
    });
  }

  /** Convenience: record decision creation */
  recordDecisionCreated(
    actorId: string,
    decisionId: string,
    title: string,
    correlationId: string,
  ): void {
    this.record({
      action: 'decision.created',
      actorId,
      targetId: decisionId,
      correlationId,
      details: { title },
      success: true,
    });
  }

  /** Convenience: record decision made */
  recordDecisionMade(
    actorId: string,
    decisionId: string,
    optionId: string,
    correlationId: string,
  ): void {
    this.record({
      action: 'decision.made',
      actorId,
      targetId: decisionId,
      correlationId,
      details: { optionId },
      success: true,
    });
  }

  /** Convenience: record decision completed */
  recordDecisionCompleted(
    actorId: string,
    decisionId: string,
    result: string,
    correlationId: string,
  ): void {
    this.record({
      action: 'decision.completed',
      actorId,
      targetId: decisionId,
      correlationId,
      details: { result },
      success: true,
    });
  }

  /** Convenience: record search */
  recordSearch(actorId: string, query: string, resultCount: number, correlationId: string): void {
    this.record({
      action: 'decision.search.executed',
      actorId,
      correlationId,
      details: { query, resultCount },
      success: true,
    });
  }
}
