// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Trace Model
// EPIC-012 — Production Observability & Control Plane (Phases 1–2)
//
// A single ExecutionTrace connects USER REQUEST → APPLICATION →
// REQUIREMENTS → LOOP EXECUTION → AI ORCHESTRATION → RAG → PROVIDER →
// MODEL → OUTPUT VALIDATION → QUALITY REVIEW → REFINEMENT → DEPLOYMENT
// under stable identifiers (traceId / spanId / executionId / userId /
// applicationId) so an operator can reconstruct exactly what happened
// inside the system, why, what it cost, and what finally reached the
// user.
//
// This model is deliberately orthogonal to the pre-existing lightweight
// `Span`/`Tracer` hooks in `./index.ts` (BLP-002/D09). The existing
// hooks remain for the OtelExporter compatibility surface; the
// ExecutionTrace is the correlated, owner-scoped production spine.
// ──────────────────────────────────────────────────────────────────

/** Terminal span/trace outcome — a superset of the loop-engine
 *  termination reasons so every engine's outcome maps 1:1. */
export type TraceStatus =
  | 'OK'
  | 'ERROR'
  | 'ABSTAINED'
  | 'BUDGET_EXCEEDED'
  | 'TIMEOUT'
  | 'PROVIDER_FAILURE'
  | 'VALIDATION_FAILURE'
  | 'SECURITY_BLOCK'
  | 'USER_CANCELLED'
  | 'FAILED';

/** A single timestamped event inside a span (e.g. 'loop.step', 'retry'). */
export interface TraceEvent {
  name: string;
  /** Epoch ms. */
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

/** Structured error attached to a failed span (never raw stack traces). */
export interface TraceSpanError {
  /** Stable machine code (e.g. 'PROVIDER_TIMEOUT', 'VALIDATION_FAILURE'). */
  code: string;
  /** Redacted, human-readable summary. */
  message: string;
}

/** One unit of work inside a trace. */
export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  /** Stable span name, e.g. 'factory.build', 'ai.run', 'rag.search'. */
  name: string;
  /** Engine that owns the span: 'engine' | 'ai' | 'rag' | 'gateway' | 'control'. */
  kind: string;
  status: TraceStatus;
  /** Epoch ms. */
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  /** Structured, redacted attributes (never secrets, never raw prompts). */
  attributes: Record<string, string | number | boolean>;
  events: TraceEvent[];
  error?: TraceSpanError;
}

/** The correlated execution record reconstructed from its spans. */
export interface ExecutionTrace {
  traceId: string;
  /** Root span name (e.g. 'factory.build'). */
  name: string;
  status: TraceStatus;
  /** Epoch ms. */
  startedAt: number;
  endedAt?: number;
  /** Stable execution identifier shared across the whole flow. */
  executionId?: string;
  /** Owner — the ONLY scope through which non-operators may read it. */
  userId?: string;
  applicationId?: string;
  /** Request correlation ID from the gateway (when present). */
  correlationId?: string;
  attributes: Record<string, string | number | boolean>;
  spans: TraceSpan[];
}

import { randomUUID } from 'node:crypto';

/** Generate a stable trace/span identifier (UUID prefix, log-friendly). */
export function createTraceId(): string {
  return `trace-${createIdSuffix()}`;
}

export function createSpanId(): string {
  return `span-${createIdSuffix()}`;
}

function createIdSuffix(): string {
  return randomUUID().slice(0, 13);
}
