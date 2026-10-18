// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Identifier Value Objects
// EI-005 — Enterprise Execution Orchestrator
//
// S14 CodeQL remediation — js/insecure-randomness (CWE-338):
// ids were previously minted with `Math.random()`, whose output is
// predictable from a few observed values. Execution ids flow into event
// streams, session records and (through ExecutionEventService /
// ExecutionSessionService) into anything that treats them as a handle, so
// they are minted from the CSPRNG instead. The `prefix_<timestamp>_<token>`
// shape is unchanged — only the token source is.
// ──────────────────────────────────────────────────────────────────

import { randomBytes } from 'node:crypto';

const SYMBOL_GRAPH_ID = Symbol('GraphId');
const SYMBOL_SESSION_ID = Symbol('SessionId');
const SYMBOL_NODE_ID = Symbol('NodeId');
const SYMBOL_WORKER_ID = Symbol('WorkerId');

export type GraphId = string & { readonly [SYMBOL_GRAPH_ID]: true };
export type SessionId = string & { readonly [SYMBOL_SESSION_ID]: true };
export type NodeId = string & { readonly [SYMBOL_NODE_ID]: true };
export type WorkerId = string & { readonly [SYMBOL_WORKER_ID]: true };

/** 48 bits of CSPRNG entropy, hex-encoded (12 chars) — collision-safe and unpredictable. */
function randomToken(): string {
  return randomBytes(6).toString('hex');
}

export function createGraphId(id: string): GraphId {
  return id as GraphId;
}

export function generateGraphId(): GraphId {
  return `graph_${String(Date.now())}_${randomToken()}` as GraphId;
}

export function createSessionId(id: string): SessionId {
  return id as SessionId;
}

export function generateSessionId(): SessionId {
  return `session_${String(Date.now())}_${randomToken()}` as SessionId;
}

export function createNodeId(id: string): NodeId {
  return id as NodeId;
}

export function generateNodeId(): NodeId {
  return `node_${String(Date.now())}_${randomToken()}` as NodeId;
}

export function createWorkerId(id: string): WorkerId {
  return id as WorkerId;
}

export function generateWorkerId(): WorkerId {
  return `worker_${String(Date.now())}_${randomToken()}` as WorkerId;
}
