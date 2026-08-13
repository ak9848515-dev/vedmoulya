// ──────────────────────────────────────────────────────────────────
// VedMoulya — Trace Store
// EPIC-012 — Production Observability & Control Plane (Phase 1)
//
// Bounded, owner-scoped persistence for completed ExecutionTraces.
// The default in-memory implementation caps the number of retained
// traces (FIFO eviction) and optionally applies a retention TTL so
// observability can never become an unbounded memory sink (EPIC-012
// Phase 15 — "unbounded event storage" is explicitly forbidden).
// ──────────────────────────────────────────────────────────────────

import type { ExecutionTrace, TraceStatus } from './execution-trace.js';

/** Owner-scoped trace query filter. */
export interface TraceQuery {
  /** Owner scope — non-operators may only list their own traces. */
  userId?: string;
  applicationId?: string;
  executionId?: string;
  status?: TraceStatus;
  /** Newest-first cap. Default 50. */
  limit?: number;
}

/** Trace persistence contract (store implementations are swappable). */
export interface TraceStore {
  save(trace: ExecutionTrace): void;
  get(traceId: string): ExecutionTrace | undefined;
  list(query?: TraceQuery): ExecutionTrace[];
  clear(): void;
  /** Current retained count (for the ops overview). */
  size(): number;
}

export interface InMemoryTraceStoreOptions {
  /** Maximum retained traces. Default 5000. FIFO eviction beyond this. */
  maxTraces?: number;
  /** Optional TTL in ms; traces older than this are dropped on access. */
  retentionMs?: number;
  /** Deterministic clock for tests. */
  now?: () => number;
}

/**
 * In-memory trace store with a hard retention bound. Eviction is FIFO on
 * insert when `maxTraces` is exceeded; a TTL (when configured) is enforced
 * lazily on access. Owner scoping is enforced at query time: a `userId`
 * filter returns only that owner's traces — cross-user telemetry access
 * is refused by construction (EPIC-012 Phase 14).
 */
export class InMemoryTraceStore implements TraceStore {
  private readonly maxTraces: number;
  private readonly retentionMs?: number;
  private readonly now: () => number;
  private readonly traces = new Map<string, ExecutionTrace>();

  constructor(options: InMemoryTraceStoreOptions = {}) {
    this.maxTraces = options.maxTraces ?? 5000;
    this.retentionMs = options.retentionMs;
    this.now = options.now ?? ((): number => Date.now());
  }

  save(trace: ExecutionTrace): void {
    if (this.traces.has(trace.traceId)) {
      this.traces.set(trace.traceId, trace);
      return;
    }
    // FIFO eviction at the hard cap — never unbounded.
    if (this.traces.size >= this.maxTraces) {
      const oldest = this.traces.keys().next().value;
      if (oldest !== undefined) this.traces.delete(oldest);
    }
    this.traces.set(trace.traceId, trace);
  }

  get(traceId: string): ExecutionTrace | undefined {
    const trace = this.traces.get(traceId);
    if (trace === undefined) return undefined;
    if (this.isExpired(trace)) {
      this.traces.delete(traceId);
      return undefined;
    }
    return trace;
  }

  list(query: TraceQuery = {}): ExecutionTrace[] {
    const limit = query.limit ?? 50;
    const cutoff = this.retentionMs !== undefined ? this.now() - this.retentionMs : undefined;
    const out: ExecutionTrace[] = [];
    // Map preserves insertion order (oldest first) — reverse for newest-first.
    for (const trace of Array.from(this.traces.values()).reverse()) {
      if (cutoff !== undefined && trace.endedAt !== undefined && trace.endedAt < cutoff) {
        continue;
      }
      if (query.userId !== undefined && trace.userId !== query.userId) continue;
      if (query.applicationId !== undefined && trace.applicationId !== query.applicationId)
        continue;
      if (query.executionId !== undefined && trace.executionId !== query.executionId) continue;
      if (query.status !== undefined && trace.status !== query.status) continue;
      out.push(trace);
      if (out.length >= limit) break;
    }
    return out;
  }

  clear(): void {
    this.traces.clear();
  }

  size(): number {
    return this.traces.size;
  }

  private isExpired(trace: ExecutionTrace): boolean {
    if (this.retentionMs === undefined) return false;
    const ended = trace.endedAt ?? trace.startedAt;
    return this.now() - ended > this.retentionMs;
  }
}
