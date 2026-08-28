// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Orchestrator Service
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// The OrchestratorService is the central coordination point:
//
//   Incoming work
//       ↓
//   API/Gateway
//       ↓
//   request classification
//       ↓
//   OrchestratorService ← YOU ARE HERE
//       ↓
//   dependency graph
//       ↓
//   priority + scheduling + concurrency control
//       ↓
//   engines
//       ↓
//   ProviderRouter
//       ↓
//   AI providers
//       ↓
//   result aggregation
//       ↓
//   response/event/state
//
// The Orchestrator prevents uncontrolled concurrency while preserving
// maximum useful parallelism.
//
// THREE CONCURRENCY DOMAINS:
//   1. HTTP concurrency  — API/Gateway (fast reads stay fast)
//   2. WORK concurrency  — THIS SERVICE (meaningful work units)
//   3. RESOURCE concurrency — DatabaseManager, ProviderRouter, Redis
//
// CRITICAL: WORK CONCURRENCY must NOT be confused with DATABASE CONNECTION COUNT.
// ──────────────────────────────────────────────────────────────────

import { logger, metrics } from '@vedmoulya/core';
import type {
  WorkItem,
  WorkStatus,
  WorkType,
  CreateWorkItemInput,
  ResourceRequirements,
} from '../types/work-item.js';
import { DEFAULT_RETRY_POLICY } from '../types/work-item.js';
import type { DependencyGraph, ReadyWorkSnapshot } from '../types/dependency-graph.js';
import type { QueueState } from '../types/priority-queue.js';
import type { ConcurrencySnapshot } from '../types/concurrency.js';
import type { ProviderSelection } from '../types/provider-router.js';
import type {
  OrchestratorMetrics,
  WorkItemEvent,
  WorkItemEventType,
} from '../types/observability.js';
import { DependencyGraphService } from './DependencyGraphService.js';
import { PriorityScheduler } from './PriorityScheduler.js';
import { ConcurrencyController } from './ConcurrencyController.js';
import { ProviderRouter } from './ProviderRouter.js';

// ── Configuration ─────────────────────────────────────────────────────────

export interface OrchestratorConfig {
  /** Maximum time in ms for the orchestrator tick loop. */
  tickIntervalMs: number;

  /** Maximum work items to process per tick. */
  maxItemsPerTick: number;

  /** Whether to enable dependency graph tracking. */
  enableDependencyGraph: boolean;

  /** Whether to enable provider routing. */
  enableProviderRouting: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  tickIntervalMs: 100,
  maxItemsPerTick: 50,
  enableDependencyGraph: true,
  enableProviderRouting: true,
};

// ── Work Item Handler ─────────────────────────────────────────────────────

/**
 * Interface for work item execution handlers. Engines implement this
 * to handle specific work types.
 */
export interface WorkItemHandler {
  /** Work types this handler can execute. */
  supportedWorkTypes: WorkType[];

  /** Execute a work item. */
  execute(workItem: WorkItem, selection?: ProviderSelection): Promise<WorkItemResult>;
}

export interface WorkItemResult {
  success: boolean;
  summary: string;
  costUsd: number;
  tokensUsed: number;
  latencyMs: number;
  providerName?: string;
  modelName?: string;
  artifacts?: string[];
}

// ── Orchestrator Service ──────────────────────────────────────────────────

export class OrchestratorService {
  /** All work items tracked by the orchestrator. */
  private readonly workItems = new Map<string, WorkItem>();

  /** Dependency graph (built when items have dependencies). */
  private dependencyGraph: DependencyGraph | null = null;

  /** Whether the dependency graph needs rebuilding. */
  private graphDirty = false;

  /** Domain services. */
  private readonly graphService = new DependencyGraphService();
  private readonly scheduler: PriorityScheduler;
  private readonly concurrency: ConcurrencyController;
  private readonly providerRouter: ProviderRouter;

  /** Registered work item handlers. */
  private readonly handlers = new Map<string, WorkItemHandler>();

  /** Work item events (for observability). */
  private readonly events: WorkItemEvent[] = [];

  /** Tick interval handle. */
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  private readonly config: OrchestratorConfig;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scheduler = new PriorityScheduler();
    this.concurrency = new ConcurrencyController();
    this.providerRouter = new ProviderRouter();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Start the orchestrator tick loop.
   */
  start(): void {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => {
      this.tick().catch((err: unknown) => {
        logger.error('Orchestrator tick failed', { error: String(err) });
      });
    }, this.config.tickIntervalMs);
    logger.info('OrchestratorService started', { tickIntervalMs: this.config.tickIntervalMs });
  }

  /**
   * Stop the orchestrator tick loop.
   */
  stop(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    logger.info('OrchestratorService stopped');
  }

  // ── Work Item Submission ────────────────────────────────────────────────

  /**
   * Submit a new work item to the orchestrator.
   * Returns the created work item, or null if rejected (backpressure).
   */
  submitWork(input: CreateWorkItemInput): WorkItem | null {
    const id = `work_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const retryPolicy = { ...DEFAULT_RETRY_POLICY, ...input.retryPolicy };

    const resources: ResourceRequirements = {
      requiresDatabase: input.resources.requiresDatabase,
      resourceProfile: input.resources.resourceProfile,
      timeoutMs: input.resources.timeoutMs,
      aiCapability: input.resources.aiCapability,
      preferredProviders: input.resources.preferredProviders,
      estimatedTokens: input.resources.estimatedTokens,
      estimatedCostUsd: input.resources.estimatedCostUsd,
    };

    const workItem: WorkItem = {
      id,
      correlationId: `corr_${id}`,
      parentWorkItemId: input.parentWorkItemId,
      workType: input.workType,
      priority: input.priority,
      description: input.description,
      status: 'pending',
      ownerUserId: input.ownerUserId,
      idempotencyKey: input.idempotencyKey,
      dependencies: input.dependencies ?? [],
      resources,
      retryPolicy,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAtMs
        ? new Date(Date.now() + input.expiresAtMs).toISOString()
        : undefined,
      metadata: input.metadata ?? {},
    };

    // Idempotency check
    if (workItem.idempotencyKey) {
      const existing = this.findWorkItemByIdempotencyKey(workItem.idempotencyKey);
      if (existing) {
        logger.info('Work item deduplicated', {
          idempotencyKey: workItem.idempotencyKey,
          existingId: existing.id,
        });
        return existing;
      }
    }

    // Store the work item
    this.workItems.set(id, workItem);

    // Enqueue in the priority scheduler
    workItem.status = 'queued';
    const enqueued = this.scheduler.enqueue(workItem);
    if (!enqueued) {
      // Backpressure — drop the work item
      workItem.status = 'failed';
      workItem.error = {
        code: 'BACKPRESSURE',
        message: 'Queue is at capacity — work item dropped',
        retryable: true,
        failedAt: 'orchestrator',
        occurredAt: now,
      };
      this.emitEvent('dropped', workItem, 'Queue capacity exceeded');
      metrics.increment('orchestration.work.dropped');
      return null;
    }

    this.emitEvent('created', workItem, `Work item created: ${input.description}`);
    this.emitEvent('enqueued', workItem, `Enqueued at priority ${input.priority}`);

    // Mark dependency graph as dirty if this item has dependencies
    if (this.config.enableDependencyGraph && workItem.dependencies.length > 0) {
      this.graphDirty = true;
    }

    metrics.increment('orchestration.work.submitted');
    logger.info('Work item submitted', { id, workType: input.workType, priority: input.priority });

    return workItem;
  }

  /**
   * Submit multiple work items with dependencies.
   */
  submitBatch(inputs: CreateWorkItemInput[]): WorkItem[] {
    const results: WorkItem[] = [];
    for (const input of inputs) {
      const item = this.submitWork(input);
      if (item) results.push(item);
    }
    return results;
  }

  // ── Cancellation ────────────────────────────────────────────────────────

  /**
   * Cancel a work item and propagate cancellation to dependent items.
   */
  cancelWork(workItemId: string, requestedBy: string, reason: string): boolean {
    const workItem = this.workItems.get(workItemId);
    if (!workItem) return false;

    const now = new Date().toISOString();
    workItem.cancellation = {
      requestedBy,
      reason,
      requestedAt: now,
    };

    // Cancel from scheduler
    this.scheduler.remove(workItemId);

    // Update status
    if (workItem.status === 'running') {
      workItem.status = 'cancelled';
      workItem.finishedAt = now;
      this.concurrency.complete(workItem);
    } else {
      workItem.status = 'cancelled';
      workItem.finishedAt = now;
    }

    this.emitEvent('cancelled', workItem, `Cancelled by ${requestedBy}: ${reason}`);

    // Propagate cancellation to dependent items
    // Rebuild graph if dirty to ensure we have current dependency info
    if (this.graphDirty && this.config.enableDependencyGraph) {
      this.rebuildDependencyGraph();
      this.graphDirty = false;
    }
    if (this.dependencyGraph) {
      const node = this.dependencyGraph.nodes.get(workItemId);
      if (node) {
        for (const downstreamId of node.downstream) {
          const downstreamItem = this.workItems.get(downstreamId);
          if (downstreamItem && !downstreamItem.cancellation) {
            this.cancelWork(downstreamId, requestedBy, `Dependency ${workItemId} cancelled`);
          }
        }
      }
    }

    metrics.increment('orchestration.work.cancelled');
    logger.info('Work item cancelled', { id: workItemId, requestedBy, reason });

    return true;
  }

  // ── Status & Queries ────────────────────────────────────────────────────

  /**
   * Get a work item by ID.
   */
  getWorkItem(id: string): WorkItem | undefined {
    return this.workItems.get(id);
  }

  /**
   * Get all work items matching a status.
   */
  getWorkItemsByStatus(status: WorkStatus): WorkItem[] {
    return Array.from(this.workItems.values()).filter((w) => w.status === status);
  }

  /**
   * Get work items by owner.
   */
  getWorkItemsByOwner(userId: string): WorkItem[] {
    return Array.from(this.workItems.values()).filter((w) => w.ownerUserId === userId);
  }

  /**
   * Get the queue state.
   */
  getQueueState(): QueueState {
    return this.scheduler.getState();
  }

  /**
   * Get the concurrency snapshot.
   */
  getConcurrencySnapshot(): ConcurrencySnapshot {
    return this.concurrency.getSnapshot();
  }

  /**
   * Get the ready work items (all dependencies satisfied).
   */
  getReadyWorkItems(): ReadyWorkSnapshot | null {
    if (!this.dependencyGraph) return null;
    return this.graphService.getReadyWorkItems(this.dependencyGraph, this.workItems);
  }

  /**
   * Get orchestrator metrics.
   */
  getMetrics(): OrchestratorMetrics {
    const queueState = this.scheduler.getState();
    const concurrencySnapshot = this.concurrency.getSnapshot();

    // Compute execution metrics from work items
    const allItems = Array.from(this.workItems.values());
    const completedItems = allItems.filter((w) => w.status === 'completed');
    const failedItems = allItems.filter((w) => w.status === 'failed');
    const cancelledItems = allItems.filter((w) => w.status === 'cancelled');

    const latencies = completedItems.map((w) => w.result?.latencyMs ?? 0).filter((l) => l > 0);

    const successRate =
      completedItems.length + failedItems.length > 0
        ? completedItems.length / (completedItems.length + failedItems.length)
        : 1;

    return {
      queue: {
        depth: queueState.depth,
        enqueueRate: queueState.totalEnqueued, // Simplified — in production, compute per-minute
        dequeueRate: queueState.totalDequeued,
        dropRate: queueState.totalDropped,
        expireRate: queueState.totalExpired,
        averageWaitTimeMs: 0, // Would need to track per-item wait times
        p95WaitTimeMs: 0,
        p99WaitTimeMs: 0,
        measuredAt: new Date().toISOString(),
      },
      execution: {
        activeCount: concurrencySnapshot.activeCount,
        completedPerMinute: completedItems.length,
        failedPerMinute: failedItems.length,
        cancelledPerMinute: cancelledItems.length,
        averageLatencyMs:
          latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        p95LatencyMs: this.percentile(latencies, 0.95),
        p99LatencyMs: this.percentile(latencies, 0.99),
        successRate,
        measuredAt: new Date().toISOString(),
      },
      providers: [], // Would be populated from ProviderRouter
      database: {
        inFlightQueries: 0,
        peakInFlightQueries: 0,
        totalQueries: 0,
        poolMax: 10,
        utilization: 0,
        averageLatencyMs: 0,
        measuredAt: new Date().toISOString(),
      },
      peakConcurrency: concurrencySnapshot.peakConcurrency,
      totalProcessed: allItems.length,
      measuredAt: new Date().toISOString(),
    };
  }

  /**
   * Get events (for observability).
   */
  getEvents(limit: number = 100): WorkItemEvent[] {
    return this.events.slice(-limit);
  }

  // ── Handler Registration ────────────────────────────────────────────────

  /**
   * Register a work item handler.
   */
  registerHandler(handler: WorkItemHandler): void {
    for (const workType of handler.supportedWorkTypes) {
      this.handlers.set(workType, handler);
    }
    logger.info('Work item handler registered', {
      workTypes: handler.supportedWorkTypes,
    });
  }

  // ── Provider Router Integration ─────────────────────────────────────────

  /**
   * Register a provider with the router.
   */
  registerProvider(info: {
    name: string;
    capabilities: string[];
    models?: string[];
    costPer1kTokens?: number;
    averageLatencyMs?: number;
  }): void {
    this.providerRouter.registerProvider(info);
  }

  // ── Tick Loop ───────────────────────────────────────────────────────────

  /**
   * Single orchestrator tick. Called periodically by the tick loop.
   */
  async tick(): Promise<void> {
    // 1. Check for expired work items
    this.checkExpired();

    // 2. Dequeue ready items from the priority scheduler
    const dequeueResult = this.scheduler.dequeue(this.config.maxItemsPerTick);

    // 3. Handle expired items
    for (const expiredId of dequeueResult.expired) {
      const item = this.workItems.get(expiredId);
      if (item) {
        item.status = 'expired';
        item.finishedAt = new Date().toISOString();
        this.emitEvent('expired', item, 'Work item expired');
      }
    }

    // 4. Handle promoted items
    for (const promotedId of dequeueResult.promoted) {
      const item = this.workItems.get(promotedId);
      if (item) {
        this.emitEvent('promoted', item, 'Work item promoted by fairness');
      }
    }

    // 5. Dispatch ready items
    for (const workItem of dequeueResult.dequeued) {
      await this.dispatchWorkItem(workItem);
    }

    // 6. Process dependency completions
    if (this.graphDirty && this.config.enableDependencyGraph) {
      this.rebuildDependencyGraph();
      this.graphDirty = false;
    }
    if (this.dependencyGraph) {
      this.processDependencyCompletions();
    }
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  private async dispatchWorkItem(workItem: WorkItem): Promise<void> {
    // Check concurrency gate
    const gate = this.concurrency.gate(workItem);
    if (!gate.canDispatch) {
      // Re-enqueue with delay
      workItem.eligibleAt = new Date(Date.now() + (gate.waitMs ?? 1000)).toISOString();
      this.scheduler.enqueue(workItem);
      this.concurrency.recordWait(gate.waitMs ?? 1000);
      return;
    }

    // Select provider if AI work
    let selection: ProviderSelection | undefined;
    if (this.config.enableProviderRouting && workItem.resources.aiCapability) {
      const providerSelection = this.providerRouter.selectProvider(workItem);
      if (providerSelection) {
        selection = providerSelection;
      }
    }

    // Find handler
    const handler = this.handlers.get(workItem.workType);
    if (!handler) {
      workItem.status = 'failed';
      workItem.error = {
        code: 'NO_HANDLER',
        message: `No handler registered for work type '${workItem.workType}'`,
        retryable: false,
        failedAt: 'orchestrator',
        occurredAt: new Date().toISOString(),
      };
      this.emitEvent('failed', workItem, `No handler for ${workItem.workType}`);
      metrics.increment('orchestration.work.failed');
      return;
    }

    // Dispatch
    workItem.status = 'running';
    workItem.startedAt = new Date().toISOString();
    workItem.attempts++;
    workItem.assignedEngineId = selection?.selectedProvider ?? 'local';
    this.concurrency.dispatch(workItem);

    this.emitEvent('dispatched', workItem, `Dispatched to ${workItem.assignedEngineId}`);
    this.emitEvent('started', workItem, `Execution started (attempt ${workItem.attempts})`);

    try {
      const result = await handler.execute(workItem, selection);

      workItem.status = 'completed';
      workItem.finishedAt = new Date().toISOString();
      workItem.result = {
        success: result.success,
        summary: result.summary,
        costUsd: result.costUsd,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
        executedByEngineId: workItem.assignedEngineId ?? 'unknown',
        providerName: result.providerName,
        modelName: result.modelName,
        completedAt: new Date().toISOString(),
        artifacts: result.artifacts,
      };

      this.concurrency.complete(workItem);
      this.emitEvent('completed', workItem, `Completed: ${result.summary}`);
      metrics.increment('orchestration.work.completed');

      // Process dependency completions
      if (this.dependencyGraph) {
        const newlyReady = this.graphService.onWorkItemCompleted(
          this.dependencyGraph,
          workItem.id,
          this.workItems,
        );
        for (const readyItem of newlyReady) {
          readyItem.status = 'queued';
          this.scheduler.enqueue(readyItem);
          this.emitEvent('dependency_satisfied', readyItem, `Dependency ${workItem.id} completed`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if retryable
      const isRetryable =
        workItem.attempts < workItem.retryPolicy.maxRetries &&
        ((workItem.retryPolicy.retryableReasons?.length ?? 0) === 0 ||
          workItem.retryPolicy.retryableReasons?.some((r) => errorMsg.includes(r)) ||
          !workItem.retryPolicy.retryableReasons);

      if (isRetryable) {
        // Calculate backoff
        const backoff = this.calculateBackoff(
          workItem.attempts,
          workItem.retryPolicy.baseDelayMs,
          workItem.retryPolicy.maxDelayMs,
          workItem.retryPolicy.jitterFactor,
        );

        workItem.status = 'retrying';
        workItem.eligibleAt = new Date(Date.now() + backoff).toISOString();
        this.concurrency.complete(workItem);
        this.scheduler.enqueue(workItem);
        this.emitEvent(
          'retry',
          workItem,
          `Retry ${workItem.attempts}/${workItem.retryPolicy.maxRetries} in ${backoff}ms`,
        );
        metrics.increment('orchestration.work.retried');
      } else {
        workItem.status = 'failed';
        workItem.finishedAt = new Date().toISOString();
        workItem.error = {
          code: 'EXECUTION_FAILED',
          message: errorMsg,
          retryable: false,
          failedAt: workItem.assignedEngineId ?? 'unknown',
          occurredAt: new Date().toISOString(),
        };
        this.concurrency.complete(workItem);
        this.emitEvent('failed', workItem, `Failed: ${errorMsg}`);
        metrics.increment('orchestration.work.failed');
      }
    }
  }

  private checkExpired(): void {
    const now = new Date();
    for (const workItem of this.workItems.values()) {
      if (workItem.expiresAt && !workItem.finishedAt) {
        if (new Date(workItem.expiresAt) < now) {
          workItem.status = 'expired';
          workItem.finishedAt = now.toISOString();
          this.scheduler.remove(workItem.id);
          if (this.concurrency.isActive(workItem.id)) {
            this.concurrency.complete(workItem);
          }
          this.emitEvent('expired', workItem, 'Work item expired');
        }
      }
    }
  }

  private processDependencyCompletions(): void {
    if (!this.dependencyGraph) return;

    // Find completed items and check their downstream
    for (const workItem of this.workItems.values()) {
      if (workItem.status === 'completed') {
        const newlyReady = this.graphService.onWorkItemCompleted(
          this.dependencyGraph,
          workItem.id,
          this.workItems,
        );
        for (const readyItem of newlyReady) {
          if (readyItem.status === 'pending' || readyItem.status === 'waiting_dependencies') {
            readyItem.status = 'queued';
            this.scheduler.enqueue(readyItem);
            this.emitEvent(
              'dependency_satisfied',
              readyItem,
              `Dependency ${workItem.id} completed`,
            );
          }
        }
      }
    }
  }

  private rebuildDependencyGraph(): void {
    // Include ALL active work items so dependency edges are properly tracked
    const activeItems = Array.from(this.workItems.values()).filter(
      (w) => !['completed', 'failed', 'cancelled', 'expired'].includes(w.status),
    );

    if (activeItems.length > 0) {
      this.dependencyGraph = this.graphService.buildGraph({
        workItems: activeItems,
      });
    }
  }

  private findWorkItemByIdempotencyKey(key: string): WorkItem | undefined {
    for (const item of this.workItems.values()) {
      if (item.idempotencyKey === key) return item;
    }
    return undefined;
  }

  private calculateBackoff(
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number,
    jitterFactor: number,
  ): number {
    const exponential = baseDelayMs * Math.pow(2, attempt - 1);
    const jitter = exponential * jitterFactor * Math.random();
    return Math.min(exponential + jitter, maxDelayMs);
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  private emitEvent(type: WorkItemEventType, workItem: WorkItem, message: string): void {
    const event: WorkItemEvent = {
      type,
      workItemId: workItem.id,
      correlationId: workItem.correlationId,
      timestamp: new Date().toISOString(),
      message,
      metadata: {
        workType: workItem.workType,
        priority: workItem.priority,
        ownerUserId: workItem.ownerUserId,
      },
    };
    this.events.push(event);

    // Keep events bounded
    if (this.events.length > 10000) {
      this.events.splice(0, this.events.length - 5000);
    }
  }
}
