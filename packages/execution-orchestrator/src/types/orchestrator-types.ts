// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Domain Types
// EI-005 — Enterprise Execution Orchestrator
// Converts an Execution Strategy (EI-004) into an executable workflow:
// graph, planner, scheduler, workers, queue, sessions, state machine,
// monitor, events, recovery, validation, history. Orchestrates — it
// never executes AI. Runtime engines (Hatchet, LangGraph) are adapters.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { ProviderFamily } from '@vedmoulya/ai';

// ── Execution States (State Machine) ────────────────────────────────────────

export type ExecutionState =
  | 'created'
  | 'validated'
  | 'ready'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const EXECUTION_STATES: readonly ExecutionState[] = [
  'created',
  'validated',
  'ready',
  'running',
  'waiting',
  'paused',
  'retrying',
  'completed',
  'failed',
  'cancelled',
] as const;

// ── Node Status ─────────────────────────────────────────────────────────────

export type ExecutionNodeStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'retrying'
  | 'blocked'
  | 'cancelled';

export const EXECUTION_NODE_STATUSES: readonly ExecutionNodeStatus[] = [
  'pending',
  'ready',
  'running',
  'completed',
  'failed',
  'skipped',
  'retrying',
  'blocked',
  'cancelled',
] as const;

// ── Edge Types ──────────────────────────────────────────────────────────────

export type ExecutionEdgeType =
  'sequential' | 'parallel' | 'conditional' | 'merge' | 'split' | 'retry' | 'failure';

export const EXECUTION_EDGE_TYPES: readonly ExecutionEdgeType[] = [
  'sequential',
  'parallel',
  'conditional',
  'merge',
  'split',
  'retry',
  'failure',
] as const;

// ── Node ────────────────────────────────────────────────────────────────────

export interface ExecutionNode {
  nodeId: string;
  capability: CapabilityType;
  /** Provider families eligible for this node (empty = any). */
  providerCandidates: ProviderFamily[];
  /** Context reference (sources to assemble before this node runs). */
  contextReference: string[];
  /** 1 = highest priority; scheduler drains the ready set by this. */
  priority: number;
  /** NodeIds that must complete before this node can start. */
  dependencies: string[];
  /** Per-node retry policy (max attempts + backoff ms). */
  retryPolicy: { maxRetries: number; retryDelayMs: number };
  /** Deadline in ms; exceeded → abort + recovery. */
  timeoutMs: number;
  /** Budget envelope for this node. */
  budget: { expectedTokens: number; maxCostUsd: number; expectedLatencyMs: number };
  /** Opaque metadata (labels, approvals, tags). */
  metadata: Record<string, string | number | boolean>;
  status: ExecutionNodeStatus;
  /** Human-readable node label (e.g. "Research"). */
  label: string;
}

// ── Edge ────────────────────────────────────────────────────────────────────

export interface ExecutionEdge {
  edgeId: string;
  from: string;
  to: string;
  type: ExecutionEdgeType;
  /** Optional condition expression for conditional edges. */
  condition?: string;
  metadata: Record<string, string | number | boolean>;
}

// ── Execution Graph ─────────────────────────────────────────────────────────

export interface ExecutionGraph {
  graphId: string;
  strategyId: string;
  goalId: string;
  goal: string;
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
  /** Stage ordering — nodes grouped into execution stages. */
  stages: ExecutionStage[];
  /** Parallel groups (nodeIds allowed to run concurrently). */
  parallelGroups: string[][];
  /** Critical path nodeIds (longest dependency chain). */
  criticalPath: string[];
  /** Whether the graph passed validation (DAG, no cycles, budgets OK). */
  validated: boolean;
  validation: ExecutionGraphValidation;
  /** Checkpoints inserted for recovery (nodeIds where state can resume). */
  checkpoints: ExecutionCheckpoint[];
  createdAt: string;
  version: string;
}

// ── Execution Stage ─────────────────────────────────────────────────────────

export interface ExecutionStage {
  stageId: string;
  name: string;
  /** NodeIds that belong to this stage. */
  nodeIds: string[];
  /** Stage ordering within the graph. */
  order: number;
  status: ExecutionNodeStatus;
}

// ── Execution Checkpoint ────────────────────────────────────────────────────

export interface ExecutionCheckpoint {
  checkpointId: string;
  nodeId: string;
  /** Snapshot of completed results up to this point. */
  completedNodeIds: string[];
  /** ISO timestamp when the checkpoint was taken. */
  createdAt: string;
  metadata: Record<string, string | number | boolean>;
}

// ── Execution Result ────────────────────────────────────────────────────────

export interface ExecutionResult {
  nodeId: string;
  success: boolean;
  /** Output summary (not AI output — execution never runs AI). */
  outcome: string;
  /** Actual/estimated cost used. */
  costUsd: number;
  /** Actual/estimated tokens used. */
  tokensUsed: number;
  /** Actual/estimated latency. */
  latencyMs: number;
  /** Attempts made (retries counted). */
  attempts: number;
  /** ISO timestamp when the node finished. */
  completedAt: string;
  error?: string;
}

// ── Execution Event ─────────────────────────────────────────────────────────

export type ExecutionEventType =
  | 'created'
  | 'started'
  | 'completed'
  | 'failed'
  | 'retry'
  | 'timeout'
  | 'cancelled'
  | 'checkpoint'
  | 'paused'
  | 'resumed';

export const EXECUTION_EVENT_TYPES: readonly ExecutionEventType[] = [
  'created',
  'started',
  'completed',
  'failed',
  'retry',
  'timeout',
  'cancelled',
  'checkpoint',
  'paused',
  'resumed',
] as const;

export interface ExecutionEvent {
  eventId: string;
  sessionId: string;
  nodeId?: string;
  type: ExecutionEventType;
  /** ISO timestamp. */
  timestamp: string;
  message: string;
  metadata: Record<string, string | number | boolean>;
}

// ── Worker ──────────────────────────────────────────────────────────────────

export type WorkerKind =
  | 'research'
  | 'writing'
  | 'review'
  | 'seo'
  | 'publishing'
  | 'translation'
  | 'ocr'
  | 'vision'
  | 'memory'
  | 'knowledge'
  | 'custom';

export const WORKER_KINDS: readonly WorkerKind[] = [
  'research',
  'writing',
  'review',
  'seo',
  'publishing',
  'translation',
  'ocr',
  'vision',
  'memory',
  'knowledge',
  'custom',
] as const;

export type WorkerStatus = 'idle' | 'busy' | 'offline' | 'paused';

export interface ExecutionWorker {
  workerId: string;
  kind: WorkerKind;
  name: string;
  /** Capabilities this worker can run. */
  capabilities: CapabilityType[];
  /** Max concurrent tasks. */
  concurrency: number;
  /** Active task count. */
  activeTasks: number;
  status: WorkerStatus;
  /** Health score 0–1. */
  health: number;
  metadata: Record<string, string | number | boolean>;
}

// ── Queue ───────────────────────────────────────────────────────────────────

export type QueueEntryKind =
  'priority' | 'delayed' | 'retry' | 'scheduled' | 'parallel' | 'sequential';

export const QUEUE_ENTRY_KINDS: readonly QueueEntryKind[] = [
  'priority',
  'delayed',
  'retry',
  'scheduled',
  'parallel',
  'sequential',
] as const;

export interface ExecutionQueueEntry {
  entryId: string;
  nodeId: string;
  sessionId: string;
  kind: QueueEntryKind;
  /** Higher = runs first. */
  priority: number;
  /** ISO timestamp when the entry may be dequeued (scheduled/delayed). */
  availableAt: string;
  /** Attempts so far. */
  attempts: number;
  metadata: Record<string, string | number | boolean>;
}

export interface ExecutionQueue {
  queueId: string;
  entries: ExecutionQueueEntry[];
}

// ── Execution Session ───────────────────────────────────────────────────────

export interface ExecutionSession {
  sessionId: string;
  strategyId: string;
  graphId: string;
  /** Current execution stage. */
  currentStage: string;
  status: ExecutionState;
  /** 0–1 completion progress. */
  progress: number;
  /** Results per nodeId (history contracts). */
  results: Record<string, ExecutionResult>;
  events: ExecutionEvent[];
  startedAt?: string;
  updatedAt: string;
  finishedAt?: string;
  /** Checkpoints taken during this session. */
  checkpoints: ExecutionCheckpoint[];
}

// ── Graph Validation ────────────────────────────────────────────────────────

export interface ExecutionGraphValidationCheck {
  check: string;
  passed: boolean;
  detail: string;
}

export interface ExecutionGraphValidation {
  passed: boolean;
  checks: ExecutionGraphValidationCheck[];
  summary: string;
}

// ── Graph Build Input (from an Execution Strategy) ──────────────────────────

export interface ExecutionGraphInput {
  strategyId: string;
  goalId: string;
  goal: string;
  /** Capability plan steps: ordered stepId → capability + flowType. */
  steps: Array<{
    stepId: string;
    capability: CapabilityType;
    label: string;
    flowType: 'sequential' | 'parallel' | 'optional' | 'conditional';
    weight: number;
    eligibleFamilies: ProviderFamily[];
  }>;
  /** Execution mode from the strategy. */
  mode: 'sequential' | 'parallel' | 'hybrid' | 'pipeline';
  priority: 'critical' | 'high' | 'medium' | 'low' | 'background';
  /** Strategy retry policy to apply per node. */
  maxRetries: number;
  retryDelayMs: number;
  /** Strategy latency budget to derive per-node timeouts. */
  maxLatencyMs: number;
  /** Strategy token budget to derive per-node budget envelopes. */
  expectedTokens: number;
  maxCostUsd: number;
}

// ── Session Commands (state machine transitions) ────────────────────────────

export type SessionCommand =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'cancel' }
  | { type: 'fail'; reason: string }
  | { type: 'retry' }
  | { type: 'complete' };

// ── Recovery Actions ────────────────────────────────────────────────────────

export type RecoveryAction =
  | { type: 'resume'; checkpointId?: string }
  | { type: 'retry'; nodeId: string }
  | { type: 'rollback'; nodeIds: string[] }
  | { type: 'restart-stage'; stageId: string }
  | { type: 'restart-session' };

// ── Monitor Snapshot ────────────────────────────────────────────────────────

export interface ExecutionMonitorSnapshot {
  sessionId: string;
  status: ExecutionState;
  progress: number;
  runningNodes: string[];
  completedNodes: string[];
  failedNodes: string[];
  waitingNodes: string[];
  lastEvent?: ExecutionEvent;
}
