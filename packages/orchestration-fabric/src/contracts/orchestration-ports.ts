// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Ports (Contracts)
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// These are the narrow seams through which external systems integrate
// with the orchestration fabric. Engines, providers, and infrastructure
// implement these ports — the orchestrator never depends on concrete
// implementations.
// ──────────────────────────────────────────────────────────────────

import type { WorkItem, WorkItemResult, CreateWorkItemInput } from '../types/work-item.js';
import type { ConcurrencySnapshot, ProviderConcurrencyLimits } from '../types/concurrency.js';
import type { OrchestratorMetrics, WorkItemEvent } from '../types/observability.js';

/**
 * Port for submitting work to the orchestrator.
 */
export interface WorkSubmissionPort {
  submitWork(input: CreateWorkItemInput): WorkItem | null;
  submitBatch(inputs: CreateWorkItemInput[]): WorkItem[];
}

/**
 * Port for cancelling work.
 */
export interface CancellationPort {
  cancelWork(workItemId: string, requestedBy: string, reason: string): boolean;
}

/**
 * Port for querying work item status.
 */
export interface WorkQueryPort {
  getWorkItem(id: string): WorkItem | undefined;
  getWorkItemsByStatus(status: string): WorkItem[];
  getWorkItemsByOwner(userId: string): WorkItem[];
}

/**
 * Port for work item execution (implemented by engines).
 */
export interface WorkExecutionPort {
  execute(workItem: WorkItem): Promise<WorkItemResult>;
}

/**
 * Port for concurrency control observation.
 */
export interface ConcurrencyObservabilityPort {
  getConcurrencySnapshot(): ConcurrencySnapshot;
  updateProviderLimits(limits: ProviderConcurrencyLimits): void;
}

/**
 * Port for metrics collection.
 */
export interface MetricsPort {
  getMetrics(): OrchestratorMetrics;
  getEvents(limit?: number): WorkItemEvent[];
}

/**
 * Combined port for the orchestrator (facade).
 */
export interface OrchestratorPort
  extends
    WorkSubmissionPort,
    CancellationPort,
    WorkQueryPort,
    ConcurrencyObservabilityPort,
    MetricsPort {}
