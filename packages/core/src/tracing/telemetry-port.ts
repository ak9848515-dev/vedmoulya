// ──────────────────────────────────────────────────────────────────
// VedMoulya — Telemetry Port
// EPIC-012 — Production Observability & Control Plane (Phase 3)
//
// The single narrow seam business engines use to emit observability.
// Architecture mandated by the epic:
//
//   Business Engine
//        ↓
//   TelemetryPort   ← engines depend ONLY on this interface
//        ↓
//   ExecutionTraceProvider → TraceStore / OTel / Langfuse adapters
//
// The default implementation is a zero-overhead NOOP, so every engine
// can be wired without changing behavior when observability is off, and
// every existing engine test keeps passing untouched. Engines never
// import vendor SDKs — they only ever see this port.
// ──────────────────────────────────────────────────────────────────

import type { TraceSpanError, TraceStatus } from './execution-trace.js';

/** Attribute values are structured primitives only (never objects). */
export type TelemetryAttribute = string | number | boolean;

export interface TelemetrySpanInput {
  /** Stable span name, e.g. 'factory.build', 'rag.search'. */
  name: string;
  /** Span kind: 'engine' | 'ai' | 'rag' | 'gateway' | 'control'. */
  kind?: string;
  attributes?: Record<string, TelemetryAttribute>;
  /** Stable execution identifier shared across the whole flow. */
  executionId?: string;
  /** Owner scope — non-operators may only read their own traces. */
  userId?: string;
  applicationId?: string;
}

/** Handle returned by `startSpan` for attribute/event/status updates. */
export interface TelemetrySpanHandle {
  /** The span's stable identifiers — needed for ambient parenting. */
  readonly spanId: string;
  readonly traceId: string;
  setAttribute(key: string, value: TelemetryAttribute): void;
  addEvent(name: string, attributes?: Record<string, TelemetryAttribute>): void;
  end(status?: TraceStatus, error?: TraceSpanError): void;
}

/**
 * The ONLY telemetry surface business engines depend on. Implementations
 * must be non-blocking and must NEVER throw into engine code — telemetry
 * failure must never break a request (EPIC-012 Phase 15).
 */
export interface TelemetryPort {
  /** Start a span; end it explicitly via the handle. */
  startSpan(input: TelemetrySpanInput): TelemetrySpanHandle;
  /**
   * Run `fn` inside a new span. Nested telemetry started within `fn`
   * (e.g. AI runtime spans, RAG retrieval) is automatically parented
   * under this span when the implementation supports ambient context.
   * The span ends when `fn` settles (or earlier via an explicit end).
   */
  withSpan<T>(
    input: TelemetrySpanInput,
    fn: (span: TelemetrySpanHandle) => T | Promise<T>,
  ): Promise<T>;
  /** Whether the port actually records telemetry (cheap noop check). */
  isEnabled(): boolean;
}

// ── Zero-overhead default ────────────────────────────────────────────────────

const NOOP_HANDLE: TelemetrySpanHandle = {
  spanId: 'noop-span',
  traceId: 'noop-trace',
  setAttribute(): void {
    // Intentionally empty.
  },
  addEvent(): void {
    // Intentionally empty.
  },
  end(): void {
    // Intentionally empty.
  },
};

/** Default port: every engine option defaults to this — zero overhead. */
export class NoopTelemetryPort implements TelemetryPort {
  startSpan(): TelemetrySpanHandle {
    return NOOP_HANDLE;
  }

  async withSpan<T>(
    _input: TelemetrySpanInput,
    fn: (span: TelemetrySpanHandle) => T | Promise<T>,
  ): Promise<T> {
    return fn(NOOP_HANDLE);
  }

  isEnabled(): boolean {
    return false;
  }
}

/** Shared singleton so engine defaults never allocate per-instance. */
export const NOOP_TELEMETRY = new NoopTelemetryPort();
