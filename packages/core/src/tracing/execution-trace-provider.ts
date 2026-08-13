// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Trace Provider
// EPIC-012 — Production Observability & Control Plane (Phases 1–2)
//
// Implements the TelemetryPort over the ExecutionTrace model:
//   - `withSpan` runs work inside an AsyncLocalStorage context so every
//     nested span (AI runtime spans via the OtelBridge, RAG retrieval,
//     nested engines) is automatically parented — a single trace
//     reconstructs USER → REQUIREMENTS → FACTORY → LOOP → AI → RAG →
//     PROVIDER → QUALITY → REFINEMENT → DEPLOYMENT.
//   - `startSpan` creates a root or child span (children inherit the
//     ambient trace/span when called inside a `withSpan`/started span).
//   - Completed traces are persisted to an injected TraceStore (bounded
//     + owner-scoped). Telemetry never throws into engine code.
// ──────────────────────────────────────────────────────────────────

import { AsyncLocalStorage } from 'node:async_hooks';
import {
  createSpanId,
  createTraceId,
  type ExecutionTrace,
  type TraceSpan,
  type TraceStatus,
} from './execution-trace.js';
import { InMemoryTraceStore, type TraceStore, type TraceQuery } from './trace-store.js';
import type {
  TelemetryAttribute,
  TelemetryPort,
  TelemetrySpanHandle,
  TelemetrySpanInput,
} from './telemetry-port.js';

/** Ambient context: the active trace + span for automatic parenting. */
interface AmbientContext {
  traceId: string;
  spanId: string;
}

/** Map a raw engine status to the fixed TraceStatus vocabulary. */
export function normalizeTraceStatus(status?: string): TraceStatus {
  switch (status?.toUpperCase()) {
    case 'OK':
    case 'SUCCESS':
    case 'READY':
    case 'DEPLOYED':
      return 'OK';
    case 'ABSTAINED':
      return 'ABSTAINED';
    case 'BUDGET_EXCEEDED':
      return 'BUDGET_EXCEEDED';
    case 'TIMEOUT':
      return 'TIMEOUT';
    case 'PROVIDER_FAILURE':
      return 'PROVIDER_FAILURE';
    case 'VALIDATION_FAILURE':
    case 'VALIDATION':
      return 'VALIDATION_FAILURE';
    case 'SECURITY_BLOCK':
      return 'SECURITY_BLOCK';
    case 'USER_CANCELLED':
    case 'CANCELLED':
    case 'CANCELED':
      return 'USER_CANCELLED';
    case 'FAILED':
      return 'FAILED';
    case 'ERROR':
      return 'ERROR';
    default:
      // Unknown/typo'd statuses must NOT silently become success (the epic's
      // "never silent" rule) — an unrecognized outcome is conservatively FAILED.
      return 'FAILED';
  }
}

export interface ExecutionTraceProviderOptions {
  store?: TraceStore;
  /** Max open spans tracked before completing (guard against leaks). */
  maxOpenSpans?: number;
  /** Max in-flight trace records (guard against leak growth). */
  maxOpenTraces?: number;
  /** Optional attribute redactor (e.g. the runtime's redactSecrets) applied to
   *  every string attribute/event value so user-derived data can never leak
   *  secrets into a trace. Engines stay redaction-agnostic. */
  redact?: (value: string) => string;
  now?: () => number;
}

/**
 * The production trace spine. Engines receive it as a `TelemetryPort`;
 * the ops control plane queries completed traces through it.
 */
export class ExecutionTraceProvider implements TelemetryPort {
  private readonly storage = new AsyncLocalStorage<AmbientContext>();
  private readonly store: TraceStore;
  private readonly maxOpenSpans: number;
  private readonly maxOpenTraces: number;
  private readonly redact?: (value: string) => string;
  private readonly now: () => number;
  /** In-flight spans (ended spans move into the persisted trace). */
  private readonly openSpans = new Map<string, TraceSpan>();
  /** Trace record materialized per traceId (completed → store). */
  private readonly openTraces = new Map<string, ExecutionTrace>();

  constructor(options: ExecutionTraceProviderOptions = {}) {
    this.store = options.store ?? new InMemoryTraceStore();
    this.maxOpenSpans = options.maxOpenSpans ?? 10_000;
    this.maxOpenTraces = options.maxOpenTraces ?? 10_000;
    this.redact = options.redact;
    this.now = options.now ?? ((): number => Date.now());
  }

  // ── TelemetryPort ─────────────────────────────────────────────────────────

  isEnabled(): boolean {
    return true;
  }

  startSpan(input: TelemetrySpanInput): TelemetrySpanHandle {
    const ambient = this.storage.getStore();
    const traceId = ambient?.traceId ?? createTraceId();
    const parentSpanId = ambient?.spanId;
    const spanId = createSpanId();
    const startedAt = this.now();

    const span: TraceSpan = {
      spanId,
      traceId,
      parentSpanId,
      name: input.name,
      kind: input.kind ?? 'engine',
      status: 'OK',
      startedAt,
      attributes: this.redactAttributes(input.attributes),
      events: [],
    };
    this.openSpans.set(spanId, span);
    // Hard guard against span leaks (never unbounded).
    if (this.openSpans.size > this.maxOpenSpans) {
      const oldest = this.openSpans.keys().next().value;
      if (oldest !== undefined) this.openSpans.delete(oldest);
    }

    if (ambient === undefined) {
      // Root span — create the trace record carrying stable identifiers.
      // Cap in-flight traces: evict the oldest with a FAILED finalization so a
      // leaked root span can never grow openTraces without bound (Phase 15).
      if (this.openTraces.size >= this.maxOpenTraces) {
        this.evictOldestTrace();
      }
      this.openTraces.set(traceId, {
        traceId,
        name: input.name,
        status: 'OK',
        startedAt,
        executionId: input.executionId,
        userId: input.userId,
        applicationId: input.applicationId,
        attributes: { ...input.attributes },
        spans: [],
      });
    } else {
      // Child span — inherit execution metadata onto the trace when absent.
      const trace = this.openTraces.get(traceId);
      if (trace !== undefined) {
        if (trace.executionId === undefined && input.executionId !== undefined) {
          trace.executionId = input.executionId;
        }
        if (trace.userId === undefined && input.userId !== undefined) {
          trace.userId = input.userId;
        }
        if (trace.applicationId === undefined && input.applicationId !== undefined) {
          trace.applicationId = input.applicationId;
        }
        if (trace.startedAt > startedAt) trace.startedAt = startedAt;
      }
    }

    return this.createHandle(span);
  }

  /** Evict the oldest open trace, finalizing it as FAILED (leak guard). */
  private evictOldestTrace(): void {
    const oldestId = this.openTraces.keys().next().value;
    if (oldestId === undefined) return;
    const trace = this.openTraces.get(oldestId);
    this.openTraces.delete(oldestId);
    if (trace === undefined) return;
    trace.status = 'FAILED';
    trace.endedAt = this.now();
    trace.attributes.termination = 'trace_evicted_open';
    // Drop any still-open spans that belonged to the evicted trace.
    for (const [spanId, span] of this.openSpans) {
      if (span.traceId === oldestId) this.openSpans.delete(spanId);
    }
    try {
      this.store.save(trace);
    } catch {
      // Best-effort persistence — telemetry never breaks the request.
    }
  }

  async withSpan<T>(
    input: TelemetrySpanInput,
    fn: (span: TelemetrySpanHandle) => T | Promise<T>,
  ): Promise<T> {
    const handle = this.startSpan(input);
    const ambient: AmbientContext = { traceId: handle.traceId, spanId: handle.spanId };
    try {
      return await this.storage.run(ambient, async () => await fn(handle));
    } catch (error) {
      // A thrown callback MUST NOT be recorded as a success — end the span as
      // FAILED with the redacted reason, then rethrow (end() is idempotent).
      const message = error instanceof Error ? error.message : String(error);
      handle.end('FAILED', {
        code: 'SPAN_CALLBACK_ERROR',
        message: message.slice(0, 300),
      });
      throw error;
    } finally {
      // Safe no-op when the caller already ended the span explicitly.
      handle.end();
    }
  }

  // ── Trace queries (ops control plane) ─────────────────────────────────────

  getTrace(traceId: string): ExecutionTrace | undefined {
    const stored = this.store.get(traceId);
    if (stored !== undefined) return stored;
    const open = this.openTraces.get(traceId);
    if (open === undefined) return undefined;
    // Materialize any still-open spans into the returned snapshot.
    return { ...open, spans: [...open.spans] };
  }

  listTraces(query: TraceQuery = {}): ExecutionTrace[] {
    return this.store.list(query);
  }

  /** Raw spans for a trace (operator diagnostics). */
  getSpans(traceId: string): TraceSpan[] {
    const trace = this.getTrace(traceId);
    return trace?.spans ?? [];
  }

  getStore(): TraceStore {
    return this.store;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private createHandle(span: TraceSpan): TelemetrySpanHandle {
    return {
      spanId: span.spanId,
      traceId: span.traceId,
      setAttribute: (key: string, value: TelemetryAttribute): void => {
        // Attribute keys come from engine code, never from user input.
        // eslint-disable-next-line security/detect-object-injection
        span.attributes[key] = this.redactValue(value);
      },
      addEvent: (name: string, attributes?: Record<string, TelemetryAttribute>): void => {
        span.events.push({
          name,
          timestamp: this.now(),
          attributes: this.redactAttributes(attributes),
        });
      },
      end: (status: TraceStatus = 'OK', error?: { code: string; message: string }): void => {
        this.completeSpan(span, status, error);
      },
    };
  }

  private redactAttributes(
    attributes?: Record<string, TelemetryAttribute>,
  ): Record<string, TelemetryAttribute> {
    if (attributes === undefined) return {};
    if (this.redact === undefined) return { ...attributes };
    const out: Record<string, TelemetryAttribute> = {};
    for (const [key, value] of Object.entries(attributes)) {
      // Keys come from engine code, never from user input.
      // eslint-disable-next-line security/detect-object-injection
      out[key] = this.redactValue(value);
    }
    return out;
  }

  private redactValue(value: TelemetryAttribute): TelemetryAttribute {
    return typeof value === 'string' && this.redact !== undefined ? this.redact(value) : value;
  }

  private completeSpan(
    span: TraceSpan,
    status: TraceStatus,
    error?: { code: string; message: string },
  ): void {
    if (span.endedAt !== undefined) return; // idempotent
    const endedAt = this.now();
    span.endedAt = endedAt;
    span.durationMs = endedAt - span.startedAt;
    span.status = status;
    if (error !== undefined) {
      span.error = { code: error.code, message: error.message };
    }
    this.openSpans.delete(span.spanId);

    const trace = this.openTraces.get(span.traceId);
    if (trace === undefined) return;
    if (!trace.spans.some((s) => s.spanId === span.spanId)) {
      trace.spans.push(span);
    }
    trace.endedAt = endedAt;
    if (span.parentSpanId === undefined) {
      // Root span completed — finalize the trace and persist it. An OK root
      // end NEVER downgrades an already-failed trace (withSpan ends the root
      // implicitly with OK; a child failure must still surface). A non-OK
      // root end is always authoritative.
      if (status !== 'OK' || trace.status === 'OK') {
        trace.status = status;
      }
      this.openTraces.delete(span.traceId);
      try {
        this.store.save(trace);
      } catch {
        // Best-effort persistence — telemetry never breaks the request.
      }
    } else if (status !== 'OK') {
      // A child failure propagates to the trace-level status.
      trace.status = status;
    }
  }
}
