// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Monitor Service
// EI-005 — Enterprise Execution Orchestrator
// Derives a live ExecutionMonitorSnapshot from a session: running /
// completed / failed / waiting node sets + progress + last event.
// Pure observation — no mutation, no AI execution.
// ──────────────────────────────────────────────────────────────────

import type { ExecutionMonitorSnapshot, ExecutionSession } from '../../types/orchestrator-types.js';

export class ExecutionMonitorService {
  snapshot(session: ExecutionSession): ExecutionMonitorSnapshot {
    const completedNodes: string[] = [];
    const failedNodes: string[] = [];
    const runningNodes: string[] = [];
    const waitingNodes: string[] = [];

    for (const [nodeId, result] of Object.entries(session.results)) {
      if (result.success) completedNodes.push(nodeId);
      else failedNodes.push(nodeId);
    }

    // Without live per-node state in the session, running/waiting are
    // derived from node events (started without a completed/failed result).
    const terminal = new Set([...completedNodes, ...failedNodes]);
    const started = session.events
      .filter((e) => e.type === 'started' && e.nodeId)
      .map((e) => e.nodeId as string);
    const startedSet = new Set(started);
    for (const nodeId of startedSet) {
      if (!terminal.has(nodeId)) runningNodes.push(nodeId);
    }

    return {
      sessionId: session.sessionId,
      status: session.status,
      progress: session.progress,
      runningNodes,
      completedNodes,
      failedNodes,
      waitingNodes,
      lastEvent: session.events[session.events.length - 1],
    };
  }
}
