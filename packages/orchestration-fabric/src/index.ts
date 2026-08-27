// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/orchestration-fabric
// SPRINT-093 — Intelligent Request Queuing + Engine/Provider Concurrency
//
// The orchestration fabric is the central coordination layer that:
// - Classifies incoming work
// - Builds dependency graphs
// - Applies priority scheduling with fairness
// - Controls work concurrency (NOT database connections)
// - Routes to providers with intelligent selection
// - Provides backpressure, cancellation, and observability
//
// THREE CONCURRENCY DOMAINS:
//   1. HTTP concurrency  — API/Gateway (fast reads stay fast)
//   2. WORK concurrency  — THIS PACKAGE (meaningful work units)
//   3. RESOURCE concurrency — DatabaseManager, ProviderRouter, Redis
//
// CRITICAL: WORK CONCURRENCY must NOT be confused with DATABASE CONNECTION COUNT.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  WorkPriority,
  WorkType,
  WorkStatus,
  WorkItem,
  WorkItemResult,
  WorkItemError,
  CreateWorkItemInput,
  ResourceRequirements,
  WorkRetryPolicy,
  CancellationRequest,
  WorkItemSnapshot,
} from './types/work-item.js';

export { WORK_PRIORITIES, DEFAULT_RETRY_POLICY } from './types/work-item.js';

export type {
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  GraphValidationResult,
  DependencyGraphInput,
  ReadyWorkSnapshot,
} from './types/dependency-graph.js';

export type {
  QueueEntry,
  PriorityQueueConfig,
  QueueState,
  DequeueResult,
} from './types/priority-queue.js';

export { DEFAULT_PRIORITY_QUEUE_CONFIG } from './types/priority-queue.js';

export type {
  ConcurrencyPolicy,
  ConcurrencySnapshot,
  ConcurrencyGateResult,
  ProviderConcurrencyLimits,
} from './types/concurrency.js';

export { CONCURRENCY_POLICIES } from './types/concurrency.js';

export type {
  ProviderSelection,
  ProviderCandidate,
  ProviderHealthStatus,
  ProviderRouterConfig,
  RoutingDecision,
} from './types/provider-router.js';

export type {
  QueueMetrics,
  ExecutionMetrics,
  ProviderUtilizationMetrics,
  DatabaseUtilizationMetrics,
  OrchestratorMetrics,
  WorkItemEvent,
  WorkItemEventType,
} from './types/observability.js';

// ── Domain ────────────────────────────────────────────────────────────────
export { DependencyGraphService } from './domain/DependencyGraphService.js';
export { PriorityScheduler } from './domain/PriorityScheduler.js';
export { ConcurrencyController } from './domain/ConcurrencyController.js';
export { ProviderRouter } from './domain/ProviderRouter.js';
export { OrchestratorService } from './domain/OrchestratorService.js';
export type { OrchestratorConfig, WorkItemHandler } from './domain/OrchestratorService.js';

// ── Contracts (Ports) ─────────────────────────────────────────────────────
export type {
  WorkSubmissionPort,
  CancellationPort,
  WorkQueryPort,
  WorkExecutionPort,
  ConcurrencyObservabilityPort,
  MetricsPort,
  OrchestratorPort,
} from './contracts/orchestration-ports.js';

// ── Adapters ─────────────────────────────────────────────────────────────
export {
  EngineAdapter,
  ProviderHealthBridge,
  MetricsBridge,
  EventLoggerBridge,
} from './adapters/index.js';
export {
  EngineHandlerRegistry,
  defaultEngineHandlerRegistry,
} from './adapters/EngineHandlerRegistry.js';
export { ProviderBridge } from './adapters/ProviderBridge.js';
export type { ExistingProviderPort, AIExecutionPort } from './adapters/ProviderBridge.js';
