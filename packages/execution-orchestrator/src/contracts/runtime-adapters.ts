// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Runtime Adapter Contracts
// EI-005 — Enterprise Execution Orchestrator
// VedMoulya owns orchestration logic (strategy → graph → session →
// state). Hatchet, LangGraph, Temporal and future engines plug in as
// runtime adapters behind these interfaces — no direct dependency on
// any engine. Adapters translate our graph/session model to the engine
// and back; they never own decisions.
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionGraph,
  ExecutionSession,
  ExecutionEvent,
} from '../types/orchestrator-types.js';

/** A unit of work handed to a runtime engine for durable scheduling. */
export interface RuntimeWorkItem {
  graphId: string;
  sessionId: string;
  nodeId: string;
  capability: string;
  timeoutMs: number;
  maxRetries: number;
  metadata: Record<string, string | number | boolean>;
}

/** Generic runtime adapter interface implemented by engine adapters. */
export interface RuntimeAdapter {
  readonly name: string;
  /** Register a graph with the engine (idempotent). */
  registerGraph(graph: ExecutionGraph): Promise<string>;
  /** Enqueue one or more work items for execution. */
  scheduleWork(items: RuntimeWorkItem[]): Promise<void>;
  /** Pause a session's queued work. */
  pause(sessionId: string): Promise<void>;
  /** Resume a session's queued work. */
  resume(sessionId: string): Promise<void>;
  /** Cancel a session's queued work. */
  cancel(sessionId: string): Promise<void>;
  /** Pull the latest execution events from the engine (poll adapter). */
  pollEvents(sessionId: string): Promise<ExecutionEvent[]>;
}

/**
 * Hatchet adapter contract — maps our graph/session model to Hatchet
 * workflows. Implementation lives in the deployment layer (never a
 * hard dependency of this package).
 */
export interface HatchetAdapter extends RuntimeAdapter {
  readonly name: 'hatchet';
  /** Hatchet workflow name for a capability. */
  workflowName(capability: string): string;
}

/**
 * LangGraph adapter contract — maps our graph/session model to a
 * LangGraph StateGraph. Implementation lives in the deployment layer.
 */
export interface LangGraphAdapter extends RuntimeAdapter {
  readonly name: 'langgraph';
  /** Compiled StateGraph reference key (adapter-specific). */
  graphKey(sessionId: string): string;
}

/** Future runtime engines (Temporal, etc.) implement RuntimeAdapter. */
export type { RuntimeAdapter as FutureRuntimeAdapter };

/** Registry of runtime adapters (VedMoulya remains engine-agnostic). */
export interface RuntimeAdapterRegistry {
  register(adapter: RuntimeAdapter): void;
  get(name: string): RuntimeAdapter | undefined;
  list(): RuntimeAdapter[];
  /** Track which adapter a session is dispatched to. */
  assign(session: ExecutionSession, adapterName: string): void;
}
