// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: DTO Mapper
// EI-005 — Enterprise Execution Orchestrator
// Plain-object mapper (matches the ContextMapper/StrategyMapper
// convention) — maps domain objects to API-safe DTOs.
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionGraph,
  ExecutionMonitorSnapshot,
  ExecutionSession,
  ExecutionWorker,
  ExecutionQueueEntry,
} from '../types/orchestrator-types.js';
import type { RecoveryPlan } from '../domain/services/ExecutionRecoveryService.js';
import type { ScheduleResult } from '../domain/services/ExecutionSchedulerService.js';
import type {
  ExecutionGraphDTO,
  ExecutionSessionDTO,
  ExecutionMonitorSnapshotDTO,
  ExecutionWorkerDTO,
  ExecutionQueueEntryDTO,
  ExecutionRecoveryPlanDTO,
  ScheduleResultDTO,
  ExplainGraphDTO,
  OrchestratorSummaryDTO,
} from './OrchestratorDTO.js';

export const OrchestratorMapper = {
  graphToDTO(graph: ExecutionGraph): ExecutionGraphDTO {
    return {
      graphId: graph.graphId,
      strategyId: graph.strategyId,
      goalId: graph.goalId,
      goal: graph.goal,
      nodes: graph.nodes.map((n) => ({
        nodeId: n.nodeId,
        capability: n.capability,
        providerCandidates: n.providerCandidates,
        contextReference: n.contextReference,
        priority: n.priority,
        dependencies: n.dependencies,
        retryPolicy: n.retryPolicy,
        timeoutMs: n.timeoutMs,
        budget: n.budget,
        metadata: n.metadata,
        status: n.status,
        label: n.label,
      })),
      edges: graph.edges.map((e) => ({
        edgeId: e.edgeId,
        from: e.from,
        to: e.to,
        type: e.type,
        condition: e.condition,
      })),
      stages: graph.stages.map((s) => ({
        stageId: s.stageId,
        name: s.name,
        nodeIds: s.nodeIds,
        order: s.order,
        status: s.status,
      })),
      parallelGroups: graph.parallelGroups,
      criticalPath: graph.criticalPath,
      validated: graph.validated,
      validation: graph.validation,
      checkpoints: graph.checkpoints.map((c) => ({
        checkpointId: c.checkpointId,
        nodeId: c.nodeId,
        completedNodeIds: c.completedNodeIds,
        createdAt: c.createdAt,
      })),
      createdAt: graph.createdAt,
      version: graph.version,
    };
  },

  sessionToDTO(session: ExecutionSession): ExecutionSessionDTO {
    return {
      sessionId: session.sessionId,
      strategyId: session.strategyId,
      graphId: session.graphId,
      currentStage: session.currentStage,
      status: session.status,
      progress: session.progress,
      results: session.results,
      events: session.events.map((e) => ({
        eventId: e.eventId,
        sessionId: e.sessionId,
        nodeId: e.nodeId,
        type: e.type,
        timestamp: e.timestamp,
        message: e.message,
      })),
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      finishedAt: session.finishedAt,
      checkpoints: session.checkpoints.map((c) => ({
        checkpointId: c.checkpointId,
        nodeId: c.nodeId,
        completedNodeIds: c.completedNodeIds,
        createdAt: c.createdAt,
      })),
    };
  },

  monitorToDTO(snapshot: ExecutionMonitorSnapshot): ExecutionMonitorSnapshotDTO {
    return {
      sessionId: snapshot.sessionId,
      status: snapshot.status,
      progress: snapshot.progress,
      runningNodes: snapshot.runningNodes,
      completedNodes: snapshot.completedNodes,
      failedNodes: snapshot.failedNodes,
      waitingNodes: snapshot.waitingNodes,
      lastEvent: snapshot.lastEvent
        ? {
            eventId: snapshot.lastEvent.eventId,
            sessionId: snapshot.lastEvent.sessionId,
            nodeId: snapshot.lastEvent.nodeId,
            type: snapshot.lastEvent.type,
            timestamp: snapshot.lastEvent.timestamp,
            message: snapshot.lastEvent.message,
          }
        : undefined,
    };
  },

  workerToDTO(worker: ExecutionWorker): ExecutionWorkerDTO {
    return {
      workerId: worker.workerId,
      kind: worker.kind,
      name: worker.name,
      capabilities: worker.capabilities,
      concurrency: worker.concurrency,
      activeTasks: worker.activeTasks,
      status: worker.status,
      health: worker.health,
    };
  },

  queueEntryToDTO(entry: ExecutionQueueEntry): ExecutionQueueEntryDTO {
    return {
      entryId: entry.entryId,
      nodeId: entry.nodeId,
      sessionId: entry.sessionId,
      kind: entry.kind,
      priority: entry.priority,
      availableAt: entry.availableAt,
      attempts: entry.attempts,
    };
  },

  recoveryToDTO(plan: RecoveryPlan): ExecutionRecoveryPlanDTO {
    return {
      action: plan.action,
      description: plan.description,
      affectedNodeIds: plan.affectedNodeIds,
    };
  },

  scheduleToDTO(schedule: ScheduleResult): ScheduleResultDTO {
    return {
      order: schedule.order,
      entries: schedule.entries.map((e) => ({
        entryId: e.entryId,
        nodeId: e.nodeId,
        sessionId: e.sessionId,
        kind: e.kind,
        priority: e.priority,
        availableAt: e.availableAt,
        attempts: e.attempts,
      })),
      description: schedule.description,
    };
  },

  explainToDTO(graph: ExecutionGraph): ExplainGraphDTO {
    const sequential = graph.edges.filter(
      (e) => e.type === 'sequential' || e.type === 'merge',
    ).length;
    const parallel = graph.edges.filter((e) => e.type === 'parallel').length;
    const conditional = graph.edges.filter((e) => e.type === 'conditional').length;
    const nodeLabels = graph.nodes.map((n) => `${n.label} (${n.capability})`).join(' → ');
    return {
      graphId: graph.graphId,
      goal: graph.goal,
      nodeSummary: `${String(graph.nodes.length)} node(s): ${nodeLabels}`,
      edgeSummary: `${String(graph.edges.length)} edge(s) — ${String(sequential)} sequential/merge, ${String(parallel)} parallel, ${String(conditional)} conditional.`,
      stageSummary: `${String(graph.stages.length)} stage(s): ${graph.stages.map((s) => s.name).join(' → ')}.`,
      parallelSummary:
        graph.parallelGroups.length > 0
          ? `${String(graph.parallelGroups.length)} parallel group(s): ${graph.parallelGroups.map((g) => g.join(' + ')).join('; ')}.`
          : 'No parallel groups — execution is fully sequential.',
      criticalPathSummary: `Critical path: ${graph.criticalPath.join(' → ')} (${String(graph.criticalPath.length)} node(s)).`,
      checkpointSummary: `${String(graph.checkpoints.length)} recovery checkpoint(s) inserted.`,
      validationSummary: graph.validation.summary,
    };
  },

  summaryToDTO(input: {
    totalGraphs: number;
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    failedSessions: number;
    totalWorkers: number;
    idleWorkers: number;
    busyWorkers: number;
    statusByState: Record<string, number>;
  }): OrchestratorSummaryDTO {
    return { ...input };
  },
};
