// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Application DTOs
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionEdgeType,
  ExecutionEventType,
  ExecutionGraphInput,
  ExecutionNodeStatus,
  ExecutionState,
  WorkerKind,
  WorkerStatus,
} from '../types/orchestrator-types.js';

export interface ExecutionGraphDTO {
  graphId: string;
  strategyId: string;
  goalId: string;
  goal: string;
  nodes: ExecutionNodeDTO[];
  edges: ExecutionEdgeDTO[];
  stages: ExecutionStageDTO[];
  parallelGroups: string[][];
  criticalPath: string[];
  validated: boolean;
  validation: ExecutionGraphValidationDTO;
  checkpoints: ExecutionCheckpointDTO[];
  createdAt: string;
  version: string;
}

export interface ExecutionNodeDTO {
  nodeId: string;
  capability: string;
  providerCandidates: string[];
  contextReference: string[];
  priority: number;
  dependencies: string[];
  retryPolicy: { maxRetries: number; retryDelayMs: number };
  timeoutMs: number;
  budget: { expectedTokens: number; maxCostUsd: number; expectedLatencyMs: number };
  metadata: Record<string, string | number | boolean>;
  status: ExecutionNodeStatus;
  label: string;
}

export interface ExecutionEdgeDTO {
  edgeId: string;
  from: string;
  to: string;
  type: ExecutionEdgeType;
  condition?: string;
}

export interface ExecutionStageDTO {
  stageId: string;
  name: string;
  nodeIds: string[];
  order: number;
  status: ExecutionNodeStatus;
}

export interface ExecutionCheckpointDTO {
  checkpointId: string;
  nodeId: string;
  completedNodeIds: string[];
  createdAt: string;
}

export interface ExecutionGraphValidationDTO {
  passed: boolean;
  checks: Array<{ check: string; passed: boolean; detail: string }>;
  summary: string;
}

export interface ExecutionSessionDTO {
  sessionId: string;
  strategyId: string;
  graphId: string;
  currentStage: string;
  status: ExecutionState;
  progress: number;
  results: Record<string, ExecutionResultDTO>;
  events: ExecutionEventDTO[];
  startedAt?: string;
  updatedAt: string;
  finishedAt?: string;
  checkpoints: ExecutionCheckpointDTO[];
}

export interface ExecutionResultDTO {
  nodeId: string;
  success: boolean;
  outcome: string;
  costUsd: number;
  tokensUsed: number;
  latencyMs: number;
  attempts: number;
  completedAt: string;
  error?: string;
}

export interface ExecutionEventDTO {
  eventId: string;
  sessionId: string;
  nodeId?: string;
  type: ExecutionEventType;
  timestamp: string;
  message: string;
}

export interface ExecutionWorkerDTO {
  workerId: string;
  kind: WorkerKind;
  name: string;
  capabilities: string[];
  concurrency: number;
  activeTasks: number;
  status: WorkerStatus;
  health: number;
}

export interface ExecutionQueueEntryDTO {
  entryId: string;
  nodeId: string;
  sessionId: string;
  kind: string;
  priority: number;
  availableAt: string;
  attempts: number;
}

export interface ExecutionMonitorSnapshotDTO {
  sessionId: string;
  status: ExecutionState;
  progress: number;
  runningNodes: string[];
  completedNodes: string[];
  failedNodes: string[];
  waitingNodes: string[];
  lastEvent?: ExecutionEventDTO;
}

export interface ExecutionRecoveryPlanDTO {
  action: {
    type: string;
    checkpointId?: string;
    nodeId?: string;
    nodeIds?: string[];
    stageId?: string;
  };
  description: string;
  affectedNodeIds: string[];
}

export interface ScheduleResultDTO {
  order: string[];
  entries: ExecutionQueueEntryDTO[];
  description: string;
}

export interface OrchestratorSummaryDTO {
  totalGraphs: number;
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  totalWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  statusByState: Record<string, number>;
}

export type BuildGraphInputDTO = ExecutionGraphInput;

export interface CreateSessionDTO {
  strategyId: string;
  goalId: string;
  goal: string;
  steps: BuildGraphInputDTO['steps'];
  mode: BuildGraphInputDTO['mode'];
  priority: BuildGraphInputDTO['priority'];
  maxRetries?: number;
  retryDelayMs?: number;
  maxLatencyMs?: number;
  expectedTokens?: number;
  maxCostUsd?: number;
}

export interface ExplainGraphDTO {
  graphId: string;
  goal: string;
  nodeSummary: string;
  edgeSummary: string;
  stageSummary: string;
  parallelSummary: string;
  criticalPathSummary: string;
  checkpointSummary: string;
  validationSummary: string;
}
