import { logger } from '@vedmoulya/core';

export type ExecutionAuditAction =
  | 'plan.created'
  | 'plan.activated'
  | 'plan.started'
  | 'plan.paused'
  | 'plan.resumed'
  | 'plan.completed'
  | 'plan.failed'
  | 'plan.cancelled'
  | 'plan.updated'
  | 'plan.mission_added'
  | 'plan.task_added'
  | 'plan.task_completed'
  | 'plan.decision_linked'
  | 'plan.recovery_initiated'
  | 'plan.escalated'
  | 'execution.scheduled'
  | 'execution.recovered'
  | 'execution.progress_tracked';

export interface AuditEntry {
  id: string;
  correlationId: string;
  action: ExecutionAuditAction;
  actorId: string;
  targetId?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
  success: boolean;
}

export class ExecutionAuditor {
  private readonly serviceName = 'execution';

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

  recordPlanCreated(actorId: string, planId: string, title: string, correlationId: string): void {
    this.record({
      action: 'plan.created',
      actorId,
      targetId: planId,
      correlationId,
      details: { title },
      success: true,
    });
  }

  recordPlanStarted(actorId: string, planId: string, correlationId: string): void {
    this.record({
      action: 'plan.started',
      actorId,
      targetId: planId,
      correlationId,
      success: true,
    });
  }

  recordPlanCompleted(
    actorId: string,
    planId: string,
    result: string,
    correlationId: string,
  ): void {
    this.record({
      action: 'plan.completed',
      actorId,
      targetId: planId,
      correlationId,
      details: { result },
      success: true,
    });
  }

  recordPlanFailed(actorId: string, planId: string, reason: string, correlationId: string): void {
    this.record({
      action: 'plan.failed',
      actorId,
      targetId: planId,
      correlationId,
      details: { reason },
      success: false,
    });
  }

  recordRecovery(actorId: string, planId: string, correlationId: string): void {
    this.record({
      action: 'execution.recovered',
      actorId,
      targetId: planId,
      correlationId,
      success: true,
    });
  }
}
