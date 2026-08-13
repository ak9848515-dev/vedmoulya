// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Event Service
// EI-005 — Enterprise Execution Orchestrator
// Creates typed ExecutionEvents for sessions. Events feed the monitor,
// history contracts, and (future) dashboards — never AI execution.
// ──────────────────────────────────────────────────────────────────

import type { ExecutionEvent, ExecutionEventType } from '../../types/orchestrator-types.js';

export class ExecutionEventService {
  private sequence = 0;

  emit(
    sessionId: string,
    type: ExecutionEventType,
    message: string,
    nodeId?: string,
    metadata: Record<string, string | number | boolean> = {},
  ): ExecutionEvent {
    this.sequence += 1;
    return {
      eventId: `event_${String(Date.now())}_${String(this.sequence)}`,
      sessionId,
      nodeId,
      type,
      timestamp: new Date().toISOString(),
      message,
      metadata,
    };
  }

  created(sessionId: string): ExecutionEvent {
    return this.emit(sessionId, 'created', 'Execution session created.');
  }

  started(sessionId: string, nodeId?: string): ExecutionEvent {
    return this.emit(
      sessionId,
      'started',
      nodeId ? `Node ${nodeId} started.` : 'Execution session started.',
      nodeId,
    );
  }

  completed(sessionId: string, nodeId?: string): ExecutionEvent {
    return this.emit(
      sessionId,
      'completed',
      nodeId ? `Node ${nodeId} completed.` : 'Execution session completed.',
      nodeId,
    );
  }

  failed(sessionId: string, message: string, nodeId?: string): ExecutionEvent {
    return this.emit(sessionId, 'failed', message, nodeId);
  }

  retry(sessionId: string, nodeId: string, attempt: number): ExecutionEvent {
    return this.emit(
      sessionId,
      'retry',
      `Node ${nodeId} retrying (attempt ${String(attempt)}).`,
      nodeId,
      { attempt },
    );
  }

  timeout(sessionId: string, nodeId: string, timeoutMs: number): ExecutionEvent {
    return this.emit(
      sessionId,
      'timeout',
      `Node ${nodeId} exceeded its ${String(timeoutMs)}ms deadline.`,
      nodeId,
      { timeoutMs },
    );
  }

  cancelled(sessionId: string): ExecutionEvent {
    return this.emit(sessionId, 'cancelled', 'Execution session cancelled.');
  }

  checkpoint(sessionId: string, checkpointId: string, nodeId: string): ExecutionEvent {
    return this.emit(
      sessionId,
      'checkpoint',
      `Checkpoint ${checkpointId} taken after ${nodeId}.`,
      nodeId,
      { checkpointId },
    );
  }

  paused(sessionId: string): ExecutionEvent {
    return this.emit(sessionId, 'paused', 'Execution session paused.');
  }

  resumed(sessionId: string): ExecutionEvent {
    return this.emit(sessionId, 'resumed', 'Execution session resumed.');
  }
}
