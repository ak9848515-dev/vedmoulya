// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Identifier Value Objects
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

const SYMBOL_GRAPH_ID = Symbol('GraphId');
const SYMBOL_SESSION_ID = Symbol('SessionId');
const SYMBOL_NODE_ID = Symbol('NodeId');
const SYMBOL_WORKER_ID = Symbol('WorkerId');

export type GraphId = string & { readonly [SYMBOL_GRAPH_ID]: true };
export type SessionId = string & { readonly [SYMBOL_SESSION_ID]: true };
export type NodeId = string & { readonly [SYMBOL_NODE_ID]: true };
export type WorkerId = string & { readonly [SYMBOL_WORKER_ID]: true };

export function createGraphId(id: string): GraphId {
  return id as GraphId;
}

export function generateGraphId(): GraphId {
  return `graph_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}` as GraphId;
}

export function createSessionId(id: string): SessionId {
  return id as SessionId;
}

export function generateSessionId(): SessionId {
  return `session_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}` as SessionId;
}

export function createNodeId(id: string): NodeId {
  return id as NodeId;
}

export function generateNodeId(): NodeId {
  return `node_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}` as NodeId;
}

export function createWorkerId(id: string): WorkerId {
  return id as WorkerId;
}

export function generateWorkerId(): WorkerId {
  return `worker_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}` as WorkerId;
}
