// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Domain Events
// All domain events emitted by the Execution Intelligence Engine
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export type ExecutionEventType =
  | 'plan.created'
  | 'plan.activated'
  | 'plan.started'
  | 'plan.paused'
  | 'plan.resumed'
  | 'plan.completed'
  | 'plan.cancelled'
  | 'plan.failed'
  | 'plan.status_changed'
  | 'plan.mission_added'
  | 'plan.task_added'
  | 'plan.task_completed'
  | 'plan.decision_linked'
  | 'mission.created'
  | 'mission.completed'
  | 'mission.failed'
  | 'task.created'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'step.completed'
  | 'step.failed';

export interface ExecutionEvent {
  type: ExecutionEventType;
  planId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export function createExecutionEvent(
  type: ExecutionEventType,
  planId: string,
  data: Record<string, unknown> = {},
): ExecutionEvent {
  return { type, planId, timestamp: new Date(), data };
}
