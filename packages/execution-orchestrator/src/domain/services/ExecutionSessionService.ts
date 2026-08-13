// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Session Service
// EI-005 — Enterprise Execution Orchestrator
// Owns the session lifecycle: create from a validated graph, apply
// session commands through the state machine, record node results and
// events, and compute progress. No AI execution — this only tracks the
// execution workflow state.
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionEvent,
  ExecutionGraph,
  ExecutionResult,
  ExecutionSession,
  SessionCommand,
} from '../../types/orchestrator-types.js';
import { ExecutionStateMachineService } from './ExecutionStateMachineService.js';
import { ExecutionEventService } from './ExecutionEventService.js';

export class ExecutionSessionService {
  constructor(
    private readonly stateMachine: ExecutionStateMachineService,
    private readonly events: ExecutionEventService,
  ) {}

  createSession(graph: ExecutionGraph, strategyId: string): ExecutionSession {
    const now = new Date().toISOString();
    const session: ExecutionSession = {
      sessionId: `session_${graph.graphId.replace('graph_', '')}`,
      strategyId,
      graphId: graph.graphId,
      currentStage: graph.stages[0]?.stageId ?? '',
      status: 'created',
      progress: 0,
      results: {},
      events: [this.events.created(`session_${graph.graphId.replace('graph_', '')}`)],
      updatedAt: now,
      // Sessions inherit the graph's recovery checkpoints so resume/rollback
      // recovery planning works against real state from the very first node.
      checkpoints: structuredClone(graph.checkpoints),
    };
    return session;
  }

  /** Apply a command to a session; throws on illegal transitions. */
  apply(session: ExecutionSession, command: SessionCommand): ExecutionSession {
    const next = this.stateMachine.transition(session.status, command);
    if (!next) {
      throw new Error(
        `Illegal transition ${session.status} → ${command.type} for session ${session.sessionId}.`,
      );
    }
    const now = new Date().toISOString();
    const updated: ExecutionSession = {
      ...session,
      status: next,
      updatedAt: now,
    };
    switch (command.type) {
      case 'start':
        updated.events = [...session.events, this.events.started(session.sessionId)];
        updated.startedAt = session.startedAt ?? now;
        break;
      case 'pause':
        updated.events = [...session.events, this.events.paused(session.sessionId)];
        break;
      case 'resume':
        updated.events = [...session.events, this.events.resumed(session.sessionId)];
        break;
      case 'cancel':
        updated.events = [...session.events, this.events.cancelled(session.sessionId)];
        updated.finishedAt = now;
        break;
      case 'complete':
        updated.events = [...session.events, this.events.completed(session.sessionId)];
        updated.progress = 1;
        updated.finishedAt = now;
        break;
      case 'fail':
        updated.events = [...session.events, this.events.failed(session.sessionId, command.reason)];
        updated.finishedAt = now;
        break;
      case 'retry':
        updated.events = [...session.events, this.events.retry(session.sessionId, 'session', 1)];
        break;
    }
    return updated;
  }

  /** Record a node result and update progress/events. */
  recordNodeResult(
    session: ExecutionSession,
    graph: ExecutionGraph,
    result: ExecutionResult,
  ): ExecutionSession {
    const now = new Date().toISOString();
    const results = { ...session.results, [result.nodeId]: result };
    const completed =
      graph.nodes.length > 0
        ? Object.values(results).filter((r) => r.success).length / graph.nodes.length
        : 0;
    const progress = Math.min(1, Math.max(0, completed));
    const event: ExecutionEvent = result.success
      ? this.events.completed(session.sessionId, result.nodeId)
      : this.events.failed(
          session.sessionId,
          result.error ?? `Node ${result.nodeId} failed.`,
          result.nodeId,
        );

    const updated: ExecutionSession = {
      ...session,
      results,
      progress,
      events: [...session.events, event],
      updatedAt: now,
    };
    if (progress >= 1) {
      updated.status = 'completed';
      updated.finishedAt = now;
    }
    return updated;
  }
}
