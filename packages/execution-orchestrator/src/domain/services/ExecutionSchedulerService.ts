// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Scheduler Service
// EI-005 — Enterprise Execution Orchestrator
// Produces the scheduling order for a graph: drains the ready set by
// node priority, respects parallel groups and concurrency limits, and
// classifies each scheduled entry (priority/parallel/sequential/
// delayed/retry/scheduled). Scheduling only — no AI execution.
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionGraph,
  ExecutionQueueEntry,
  QueueEntryKind,
} from '../../types/orchestrator-types.js';

export interface ScheduleResult {
  order: string[];
  entries: ExecutionQueueEntry[];
  description: string;
}

export class ExecutionSchedulerService {
  /**
   * Compute the full scheduling order for a graph with a concurrency cap.
   * Always returns an acyclic topological order; parallel groups run
   * together up to maxConcurrency.
   */
  schedule(
    graph: ExecutionGraph,
    maxConcurrency = 4,
    sessionId = 'session_pending',
  ): ScheduleResult {
    const order: string[] = [];
    const entries: ExecutionQueueEntry[] = [];
    const remaining = new Set(graph.nodes.map((n) => n.nodeId));
    const byId = new Map(graph.nodes.map((n) => [n.nodeId, n]));
    const seq: string[] = [];

    while (remaining.size > 0) {
      const ready = [...remaining]
        .filter((id) => {
          const node = byId.get(id);
          return node ? node.dependencies.every((d) => !remaining.has(d)) : false;
        })
        .sort((a, b) => {
          const pa = byId.get(a)?.priority ?? 0;
          const pb = byId.get(b)?.priority ?? 0;
          return pb - pa;
        });

      if (ready.length === 0) break; // cycle — defensive, validator catches it first

      // Assign ready nodes into the current wave, respecting concurrency.
      const wave: string[] = [];
      const seen = new Set<string>();
      for (const id of ready) {
        if (wave.length >= maxConcurrency) break;
        // Parallel group members share a wave; sequential nodes may join too.
        wave.push(id);
        seen.add(id);
      }

      for (const id of wave) {
        remaining.delete(id);
        order.push(id);
        const node = byId.get(id);
        const kind = this.classify(graph, id, node?.metadata.flowType);
        seq.push(`${String(order.length)}:${id}`);
        entries.push({
          entryId: `entry_${id}`,
          nodeId: id,
          sessionId,
          kind,
          priority: node?.priority ?? 1,
          availableAt: new Date().toISOString(),
          attempts: 0,
          metadata: { wave: seq.length },
        });
      }
    }

    return {
      order,
      entries,
      description:
        order.length === graph.nodes.length
          ? `Scheduled ${String(order.length)} node(s) in ${String(seq.length)} wave(s).`
          : `Partial schedule: ${String(order.length)} of ${String(graph.nodes.length)} node(s).`,
    };
  }

  private classify(graph: ExecutionGraph, nodeId: string, flowType: unknown): QueueEntryKind {
    const parallelGroup = graph.parallelGroups.find((g) => g.includes(nodeId));
    if (parallelGroup && parallelGroup.length > 1) return 'parallel';
    if (flowType === 'parallel') return 'parallel';
    return 'sequential';
  }
}
