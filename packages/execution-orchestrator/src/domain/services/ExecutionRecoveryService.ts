// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Recovery Service
// EI-005 — Enterprise Execution Orchestrator
// Plans recovery for failed/cancelled executions: resume from a
// checkpoint, retry a node, rollback a branch, restart a stage, or
// restart the whole session. Recovery planning is pure — the plan is
// recorded and returned; nothing executes.
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionCheckpoint,
  ExecutionGraph,
  ExecutionSession,
  RecoveryAction,
} from '../../types/orchestrator-types.js';

export interface RecoveryPlan {
  action: RecoveryAction;
  description: string;
  /** NodeIds that will be re-run. */
  affectedNodeIds: string[];
}

export class ExecutionRecoveryService {
  /** Latest checkpoint before a failed node (for resume). */
  latestCheckpointBefore(
    session: ExecutionSession,
    nodeId: string,
  ): ExecutionCheckpoint | undefined {
    const failedIndex = Object.keys(session.results).indexOf(nodeId);
    const checkpoints = [...session.checkpoints].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    if (failedIndex < 0) return checkpoints[checkpoints.length - 1];
    return checkpoints.slice(0, failedIndex + 1)[checkpoints.length - 1] ?? checkpoints[0];
  }

  plan(graph: ExecutionGraph, session: ExecutionSession, failedNodeId?: string): RecoveryPlan[] {
    const plans: RecoveryPlan[] = [];

    // 1. Resume from the latest checkpoint (when available).
    const checkpoint = failedNodeId
      ? this.latestCheckpointBefore(session, failedNodeId)
      : session.checkpoints[session.checkpoints.length - 1];
    if (checkpoint) {
      plans.push({
        action: { type: 'resume', checkpointId: checkpoint.checkpointId },
        description: `Resume from checkpoint ${checkpoint.checkpointId} (after ${checkpoint.nodeId}).`,
        affectedNodeIds: checkpoint.completedNodeIds,
      });
    }

    // 2. Retry the failed node.
    if (failedNodeId) {
      const node = graph.nodes.find((n) => n.nodeId === failedNodeId);
      const result = session.results[failedNodeId];
      const attempts = result?.attempts ?? 0;
      const max = node?.retryPolicy.maxRetries ?? 0;
      if (node && attempts <= max) {
        plans.push({
          action: { type: 'retry', nodeId: failedNodeId },
          description: `Retry ${failedNodeId} (attempt ${String(attempts + 1)} of ${String(max + 1)}).`,
          affectedNodeIds: [failedNodeId],
        });
      }
    }

    // 3. Roll back the branch containing the failed node (dependents).
    if (failedNodeId) {
      const dependents = graph.nodes
        .filter((n) => n.dependencies.includes(failedNodeId))
        .map((n) => n.nodeId);
      if (dependents.length > 0) {
        plans.push({
          action: { type: 'rollback', nodeIds: dependents },
          description: `Roll back dependents of ${failedNodeId}: ${dependents.join(', ')}.`,
          affectedNodeIds: dependents,
        });
      }
    }

    // 4. Restart the stage containing the failed node.
    const stage = graph.stages.find((s) => s.nodeIds.includes(failedNodeId ?? ''));
    if (stage) {
      plans.push({
        action: { type: 'restart-stage', stageId: stage.stageId },
        description: `Restart stage ${stage.name} (${stage.stageId}).`,
        affectedNodeIds: stage.nodeIds,
      });
    }

    // 5. Restart the whole session (last resort).
    plans.push({
      action: { type: 'restart-session' },
      description: 'Restart the entire execution session from the beginning.',
      affectedNodeIds: graph.nodes.map((n) => n.nodeId),
    });

    return plans;
  }
}
