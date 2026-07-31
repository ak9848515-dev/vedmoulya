// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Audit Events
// Structured audit logging with correlation IDs for all knowledge operations
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';

export type KnowledgeAuditAction =
  | 'knowledge.node.created'
  | 'knowledge.node.updated'
  | 'knowledge.node.deleted'
  | 'knowledge.node.merged'
  | 'knowledge.node.split'
  | 'knowledge.edge.created'
  | 'knowledge.edge.deleted'
  | 'knowledge.graph.created'
  | 'knowledge.graph.deleted'
  | 'knowledge.graph.archived'
  | 'knowledge.search.executed'
  | 'knowledge.traversal.executed'
  | 'knowledge.impact.analyzed'
  | 'knowledge.cycle.detected'
  | 'knowledge.context.assembled'
  | 'knowledge.recommendation.prepared';

export interface AuditEntry {
  id: string;
  correlationId: string;
  action: KnowledgeAuditAction;
  actorId: string;
  targetId?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
  success: boolean;
}

export class KnowledgeAuditor {
  private readonly serviceName = 'knowledge';

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

  /** Convenience: record node creation */
  recordNodeCreated(
    actorId: string,
    nodeId: string,
    category: string,
    correlationId: string,
  ): void {
    this.record({
      action: 'knowledge.node.created',
      actorId,
      targetId: nodeId,
      correlationId,
      details: { category },
      success: true,
    });
  }

  /** Convenience: record node deletion */
  recordNodeDeleted(actorId: string, nodeId: string, correlationId: string): void {
    this.record({
      action: 'knowledge.node.deleted',
      actorId,
      targetId: nodeId,
      correlationId,
      success: true,
    });
  }

  /** Convenience: record edge creation */
  recordEdgeCreated(
    actorId: string,
    edgeId: string,
    sourceId: string,
    targetId: string,
    correlationId: string,
  ): void {
    this.record({
      action: 'knowledge.edge.created',
      actorId,
      targetId: edgeId,
      correlationId,
      details: { sourceId, targetId },
      success: true,
    });
  }

  /** Convenience: record graph creation */
  recordGraphCreated(actorId: string, graphId: string, label: string, correlationId: string): void {
    this.record({
      action: 'knowledge.graph.created',
      actorId,
      targetId: graphId,
      correlationId,
      details: { label },
      success: true,
    });
  }

  /** Convenience: record search */
  recordSearch(actorId: string, query: string, resultCount: number, correlationId: string): void {
    this.record({
      action: 'knowledge.search.executed',
      actorId,
      correlationId,
      details: { query, resultCount },
      success: true,
    });
  }
}
