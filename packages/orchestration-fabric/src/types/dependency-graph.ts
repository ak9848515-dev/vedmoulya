// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Dependency Graph
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// The DependencyGraph represents the dependency relationships between
// work items. It supports:
//   Task A → Task B → Task C (sequential)
//   Task A ─────┐
//   Task B ─────┼──→ Task D (fan-in / merge)
//   Task C ─────┘
//   Task D ─────┐
//   Task E ─────┘──→ Task F (fan-out / split)
//
// Independent tasks execute concurrently. Dependent tasks wait.
// The graph prevents: cycles, duplicate execution, deadlocks,
// starvation, uncontrolled fan-out.
// ──────────────────────────────────────────────────────────────────

import type { WorkItem, WorkStatus } from './work-item.js';

// ── Graph Node ────────────────────────────────────────────────────────────

export interface DependencyNode {
  /** Work item ID. */
  workItemId: string;

  /** Work item status snapshot. */
  status: WorkStatus;

  /** IDs of work items that must complete before this one. */
  upstream: string[];

  /** IDs of work items that depend on this one. */
  downstream: string[];

  /** Depth in the dependency chain (0 = no dependencies). */
  depth: number;

  /** Whether this node is on the critical path. */
  onCriticalPath: boolean;
}

// ── Graph Edge ────────────────────────────────────────────────────────────

export interface DependencyEdge {
  /** Source work item ID. */
  from: string;

  /** Target work item ID. */
  to: string;

  /** Edge type. */
  type: 'dependency' | 'trigger' | 'conditional';
}

// ── Dependency Graph ──────────────────────────────────────────────────────

export interface DependencyGraph {
  /** Graph identifier. */
  graphId: string;

  /** All nodes in the graph. */
  nodes: Map<string, DependencyNode>;

  /** All edges. */
  edges: DependencyEdge[];

  /** Whether the graph is acyclic (validated). */
  isAcyclic: boolean;

  /** Cycle path if one exists (empty array if acyclic). */
  cyclePath: string[];

  /** Graph validation result. */
  validation: GraphValidationResult;

  /** Nodes with no dependencies (can execute immediately). */
  rootNodes: string[];

  /** Nodes with no dependents (leaf nodes). */
  leafNodes: string[];

  /** Critical path (longest dependency chain). */
  criticalPath: string[];

  /** Maximum parallelism possible at any point. */
  maxParallelism: number;

  /** Topological order of execution. */
  executionOrder: string[];

  /** Timestamps. */
  createdAt: string;
  updatedAt: string;
}

// ── Graph Validation Result ───────────────────────────────────────────────

export interface GraphValidationResult {
  /** Whether the graph is valid. */
  valid: boolean;

  /** Validation checks performed. */
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;

  /** Summary message. */
  summary: string;
}

// ── Graph Build Input ─────────────────────────────────────────────────────

export interface DependencyGraphInput {
  /** Work items to include in the graph. */
  workItems: WorkItem[];

  /** Additional edges (beyond the work item dependencies). */
  additionalEdges?: DependencyEdge[];
}

// ── Ready Work Items ──────────────────────────────────────────────────────

/**
 * Snapshot of work items that are ready to execute (all dependencies satisfied).
 */
export interface ReadyWorkSnapshot {
  /** Work items that are ready for immediate execution. */
  readyItems: WorkItem[];

  /** Work items still waiting for dependencies. */
  waitingItems: Array<{
    workItemId: string;
    waitingFor: string[];
  }>;

  /** Maximum number of items that can run in parallel given the dependency structure. */
  maxParallelism: number;

  /** Timestamp of this snapshot. */
  snapshotAt: string;
}
