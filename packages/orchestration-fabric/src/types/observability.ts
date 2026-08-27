// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Observability
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// Safe metrics that expose orchestration health without leaking:
// - JWT, passwords, API keys, provider secrets, DB credentials
// - Private user data
// ──────────────────────────────────────────────────────────────────

// ── Queue Metrics ─────────────────────────────────────────────────────────

export interface QueueMetrics {
  /** Current queue depth. */
  depth: number;

  /** Items enqueued per minute. */
  enqueueRate: number;

  /** Items dequeued per minute. */
  dequeueRate: number;

  /** Items dropped per minute (capacity exceeded). */
  dropRate: number;

  /** Items expired per minute. */
  expireRate: number;

  /** Average time an item spends in the queue (ms). */
  averageWaitTimeMs: number;

  /** P95 wait time (ms). */
  p95WaitTimeMs: number;

  /** P99 wait time (ms). */
  p99WaitTimeMs: number;

  /** Timestamp. */
  measuredAt: string;
}

// ── Execution Metrics ─────────────────────────────────────────────────────

export interface ExecutionMetrics {
  /** Active work items being executed. */
  activeCount: number;

  /** Work items completed in the last minute. */
  completedPerMinute: number;

  /** Work items failed in the last minute. */
  failedPerMinute: number;

  /** Work items cancelled in the last minute. */
  cancelledPerMinute: number;

  /** Average execution latency (ms). */
  averageLatencyMs: number;

  /** P95 execution latency (ms). */
  p95LatencyMs: number;

  /** P99 execution latency (ms). */
  p99LatencyMs: number;

  /** Success rate (0-1). */
  successRate: number;

  /** Timestamp. */
  measuredAt: string;
}

// ── Provider Utilization ──────────────────────────────────────────────────

export interface ProviderUtilizationMetrics {
  /** Provider name. */
  providerName: string;

  /** Current active requests. */
  activeRequests: number;

  /** Max concurrent requests. */
  maxConcurrent: number;

  /** Utilization ratio (0-1). */
  utilization: number;

  /** Requests per minute. */
  requestsPerMinute: number;

  /** Average latency (ms). */
  averageLatencyMs: number;

  /** Error rate (0-1). */
  errorRate: number;

  /** Timestamp. */
  measuredAt: string;
}

// ── Database Utilization ──────────────────────────────────────────────────

export interface DatabaseUtilizationMetrics {
  /** Current in-flight queries. */
  inFlightQueries: number;

  /** Peak in-flight queries since startup. */
  peakInFlightQueries: number;

  /** Total queries since startup. */
  totalQueries: number;

  /** Pool max (connection budget). */
  poolMax: number;

  /** Utilization ratio (0-1). */
  utilization: number;

  /** Average query latency (ms). */
  averageLatencyMs: number;

  /** Timestamp. */
  measuredAt: string;
}

// ── Orchestrator Metrics (aggregate) ──────────────────────────────────────

export interface OrchestratorMetrics {
  /** Queue metrics. */
  queue: QueueMetrics;

  /** Execution metrics. */
  execution: ExecutionMetrics;

  /** Per-provider utilization. */
  providers: ProviderUtilizationMetrics[];

  /** Database utilization. */
  database: DatabaseUtilizationMetrics;

  /** Peak concurrency observed since startup. */
  peakConcurrency: number;

  /** Total work items processed since startup. */
  totalProcessed: number;

  /** Timestamp. */
  measuredAt: string;
}

// ── Work Item Event (for observability) ───────────────────────────────────

export type WorkItemEventType =
  | 'created'
  | 'enqueued'
  | 'dequeued'
  | 'scheduled'
  | 'dispatched'
  | 'started'
  | 'completed'
  | 'failed'
  | 'retry'
  | 'cancelled'
  | 'expired'
  | 'dependency_satisfied'
  | 'promoted'
  | 'dropped';

export interface WorkItemEvent {
  /** Event type. */
  type: WorkItemEventType;

  /** Work item ID. */
  workItemId: string;

  /** Correlation ID. */
  correlationId: string;

  /** ISO timestamp. */
  timestamp: string;

  /** Human-readable message. */
  message: string;

  /** Additional metadata. */
  metadata: Record<string, unknown>;
}
