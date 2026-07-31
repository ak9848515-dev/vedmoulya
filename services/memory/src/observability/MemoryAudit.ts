// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Audit Events
// Structured audit logging with correlation IDs for all memory operations
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';

export type MemoryAuditAction =
  | 'memory.captured'
  | 'memory.recalled'
  | 'memory.updated'
  | 'memory.strengthened'
  | 'memory.weakened'
  | 'memory.merged'
  | 'memory.archived'
  | 'memory.restored'
  | 'memory.forgotten'
  | 'memory.decayed'
  | 'memory.timeline.retrieved'
  | 'memory.search.executed'
  | 'memory.reflection.generated'
  | 'memory.retention.executed'
  | 'memory.context.assembled';

export interface AuditEntry {
  id: string;
  correlationId: string;
  action: MemoryAuditAction;
  actorId: string;
  targetId?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
  success: boolean;
}

export class MemoryAuditor {
  private readonly serviceName = 'memory';

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

  /** Convenience: record memory capture */
  recordMemoryCaptured(
    actorId: string,
    memoryId: string,
    category: string,
    correlationId: string,
  ): void {
    this.record({
      action: 'memory.captured',
      actorId,
      targetId: memoryId,
      correlationId,
      details: { category },
      success: true,
    });
  }

  /** Convenience: record memory recall */
  recordMemoryRecalled(actorId: string, memoryId: string, correlationId: string): void {
    this.record({
      action: 'memory.recalled',
      actorId,
      targetId: memoryId,
      correlationId,
      success: true,
    });
  }

  /** Convenience: record memory archive */
  recordMemoryArchived(actorId: string, memoryId: string, correlationId: string): void {
    this.record({
      action: 'memory.archived',
      actorId,
      targetId: memoryId,
      correlationId,
      success: true,
    });
  }

  /** Convenience: record memory forget */
  recordMemoryForgotten(actorId: string, memoryId: string, correlationId: string): void {
    this.record({
      action: 'memory.forgotten',
      actorId,
      targetId: memoryId,
      correlationId,
      success: true,
    });
  }

  /** Convenience: record search */
  recordSearch(actorId: string, query: string, resultCount: number, correlationId: string): void {
    this.record({
      action: 'memory.search.executed',
      actorId,
      correlationId,
      details: { query, resultCount },
      success: true,
    });
  }

  /** Convenience: record retention execution */
  recordRetentionExecuted(
    actorId: string,
    expiredCount: number,
    decayedCount: number,
    correlationId: string,
  ): void {
    this.record({
      action: 'memory.retention.executed',
      actorId,
      correlationId,
      details: { expiredCount, decayedCount },
      success: true,
    });
  }
}
