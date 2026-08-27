// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Work Item Contract
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// The WorkItem is the fundamental unit of work in the orchestration
// fabric. It represents ANY meaningful work unit: multi-step tasks,
// engine workflows, AI tasks, scheduled work, autonomous work,
// long-running execution, or cross-engine workflows.
//
// WorkItems are classified, prioritized, dependency-tracked, queued,
// and dispatched through the Orchestrator. They are NOT HTTP requests
// (HTTP concurrency is separate) and NOT database connections (resource
// concurrency is separate).
// ──────────────────────────────────────────────────────────────────

// ── Work Priority ─────────────────────────────────────────────────────────

/**
 * Priority levels for work items. Higher numeric value = higher priority.
 * The priority queue uses these to determine execution order.
 *
 * Priority ordering (highest first):
 *   interactive (100) > safety (90) > user_submitted (80) >
 *   autonomous (60) > scheduled (50) > background_intelligence (30) >
 *   maintenance (10)
 */
export type WorkPriority =
  | 'interactive'
  | 'safety'
  | 'user_submitted'
  | 'autonomous'
  | 'scheduled'
  | 'background_intelligence'
  | 'maintenance';

export const WORK_PRIORITIES: Record<WorkPriority, number> = {
  interactive: 100,
  safety: 90,
  user_submitted: 80,
  autonomous: 60,
  scheduled: 50,
  background_intelligence: 30,
  maintenance: 10,
} as const;

// ── Work Classification ───────────────────────────────────────────────────

/**
 * WorkType classifies the nature of a work item for routing and
 * concurrency control decisions. Different work types have different
 * resource requirements and concurrency limits.
 */
export type WorkType =
  | 'ai_inference'
  | 'ai_generation'
  | 'ai_embedding'
  | 'ai_evaluation'
  | 'engine_workflow'
  | 'multi_step_task'
  | 'knowledge_retrieval'
  | 'memory_operation'
  | 'decision_analysis'
  | 'content_generation'
  | 'factory_execution'
  | 'deployment'
  | 'discovery'
  | 'intelligence'
  | 'maintenance'
  | 'custom';

// ── Work Status ───────────────────────────────────────────────────────────

export type WorkStatus =
  | 'pending'
  | 'queued'
  | 'scheduled'
  | 'running'
  | 'waiting_dependencies'
  | 'waiting_rate_limit'
  | 'paused'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

// ── Retry Policy ──────────────────────────────────────────────────────────

export interface WorkRetryPolicy {
  /** Maximum retry attempts (0 = no retries). */
  maxRetries: number;
  /** Base delay in ms for exponential backoff. */
  baseDelayMs: number;
  /** Maximum delay in ms (caps exponential growth). */
  maxDelayMs: number;
  /** Jitter factor (0-1) to prevent thundering herd. */
  jitterFactor: number;
  /** Which failure reasons are retryable. Empty = retry all. */
  retryableReasons?: string[];
}

export const DEFAULT_RETRY_POLICY: WorkRetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.1,
};

// ── Cancellation ──────────────────────────────────────────────────────────

/**
 * Cancellation request that propagates through the work item hierarchy.
 * When a user cancels, the cancellation flows:
 *   User → Orchestrator → WorkItem → Engine → Provider
 */
export interface CancellationRequest {
  /** Who requested cancellation (userId or 'system'). */
  requestedBy: string;
  /** Reason for cancellation. */
  reason: string;
  /** ISO timestamp of the cancellation request. */
  requestedAt: string;
  /** Whether to force-cancel (skip graceful shutdown). */
  force?: boolean;
}

// ── Resource Requirements ─────────────────────────────────────────────────

/**
 * Resource requirements declared by a work item. The ConcurrencyController
 * uses these to make scheduling decisions. These are DECLARED requirements,
 * not runtime measurements.
 */
export interface ResourceRequirements {
  /** Required AI provider capability (if any). */
  aiCapability?: string;
  /** Provider families preferred (empty = any). */
  preferredProviders?: string[];
  /** Estimated token budget for AI work. */
  estimatedTokens?: number;
  /** Estimated cost in USD. */
  estimatedCostUsd?: number;
  /** Whether this work requires database access. */
  requiresDatabase: boolean;
  /** Whether this work is CPU-bound vs IO-bound. */
  resourceProfile: 'cpu_bound' | 'io_bound' | 'ai_bound' | 'mixed';
  /** Maximum time in ms before the work item expires. */
  timeoutMs: number;
}

// ── WorkItem ──────────────────────────────────────────────────────────────

/**
 * The fundamental unit of work in the orchestration fabric.
 *
 * A WorkItem represents any meaningful work that needs to be scheduled,
 * tracked, and executed. It carries all metadata needed for:
 * - Priority scheduling
 * - Dependency resolution
 * - Concurrency control
 * - Resource budgeting
 * - Cancellation propagation
 * - Retry handling
 * - Observability
 */
export interface WorkItem {
  /** Unique identifier for this work item. */
  id: string;

  /** Correlation ID for tracing across related work items. */
  correlationId: string;

  /** Parent work item ID (for hierarchical work decomposition). */
  parentWorkItemId?: string;

  /** Type classification for routing decisions. */
  workType: WorkType;

  /** Priority level for scheduling. */
  priority: WorkPriority;

  /** Human-readable description. */
  description: string;

  /** Current status. */
  status: WorkStatus;

  /** User who owns this work item. */
  ownerUserId: string;

  /** Idempotency key — duplicate submissions with the same key are deduplicated. */
  idempotencyKey?: string;

  /** Work item IDs that must complete before this item can start. */
  dependencies: string[];

  /** Resource requirements for concurrency scheduling. */
  resources: ResourceRequirements;

  /** Retry policy. */
  retryPolicy: WorkRetryPolicy;

  /** Number of attempts so far. */
  attempts: number;

  /** Cancellation state (undefined = not cancelled). */
  cancellation?: CancellationRequest;

  /** ISO timestamp when the work item was created. */
  createdAt: string;

  /** ISO timestamp when the work item was last updated. */
  updatedAt: string;

  /** ISO timestamp when the work item started executing. */
  startedAt?: string;

  /** ISO timestamp when the work item completed, failed, or was cancelled. */
  finishedAt?: string;

  /** ISO timestamp when the work item expires (auto-cancelled). */
  expiresAt?: string;

  /** ISO timestamp when the work item is eligible to be dequeued (for delayed/scheduled). */
  eligibleAt?: string;

  /** Engine/worker ID that is executing this work item. */
  assignedEngineId?: string;

  /** Engine/worker ID that is executing this work item (assigned by ConcurrencyController). */
  executingEngineId?: string;

  /** Result of the work item (set on completion). */
  result?: WorkItemResult;

  /** Error information (set on failure). */
  error?: WorkItemError;

  /** Opaque metadata for engine-specific data. */
  metadata: Record<string, unknown>;
}

// ── WorkItem Result ───────────────────────────────────────────────────────

export interface WorkItemResult {
  /** Whether the work completed successfully. */
  success: boolean;

  /** Output summary. */
  summary: string;

  /** Actual cost in USD. */
  costUsd: number;

  /** Actual tokens used. */
  tokensUsed: number;

  /** Actual latency in ms. */
  latencyMs: number;

  /** Engine that executed the work. */
  executedByEngineId: string;

  /** Provider that was used (if AI work). */
  providerName?: string;

  /** Model that was used (if AI work). */
  modelName?: string;

  /** ISO timestamp when the result was produced. */
  completedAt: string;

  /** Output artifacts (file paths, URLs, etc). */
  artifacts?: string[];
}

// ── WorkItem Error ────────────────────────────────────────────────────────

export interface WorkItemError {
  /** Error code for programmatic handling. */
  code: string;

  /** Human-readable error message. */
  message: string;

  /** Whether this error is retryable. */
  retryable: boolean;

  /** The engine/provider that failed. */
  failedAt: string;

  /** ISO timestamp of the error. */
  occurredAt: string;

  /** Stack trace (dev/test only). */
  stack?: string;
}

// ── WorkItem Creation Input ───────────────────────────────────────────────

/**
 * Input for creating a new WorkItem. The OrchestratorService fills in
 * defaults for fields that are not provided.
 */
export interface CreateWorkItemInput {
  workType: WorkType;
  priority: WorkPriority;
  description: string;
  ownerUserId: string;
  idempotencyKey?: string;
  dependencies?: string[];
  resources: Partial<ResourceRequirements> &
    Pick<ResourceRequirements, 'requiresDatabase' | 'resourceProfile' | 'timeoutMs'>;
  retryPolicy?: Partial<WorkRetryPolicy>;
  metadata?: Record<string, unknown>;
  expiresAtMs?: number;
  parentWorkItemId?: string;
}

// ── WorkItem Snapshot (for observability) ─────────────────────────────────

export interface WorkItemSnapshot {
  id: string;
  workType: WorkType;
  priority: WorkPriority;
  status: WorkStatus;
  attempts: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  description: string;
  dependencies: string[];
  assignedEngineId?: string;
}
