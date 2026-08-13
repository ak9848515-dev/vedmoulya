// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/execution-orchestrator
// Enterprise Execution Orchestrator (EI-005)
// Converts an Execution Strategy (EI-004) into an executable workflow:
// execution graph, planner, scheduler, worker registry, execution
// queue, sessions, state machine, monitor, events, recovery,
// validation, and history contracts. Orchestrates execution — it never
// runs AI. Runtime engines (Hatchet, LangGraph, Temporal) are adapters.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────
export type {
  ExecutionState,
  ExecutionNodeStatus,
  ExecutionEdgeType,
  ExecutionNode,
  ExecutionEdge,
  ExecutionGraph,
  ExecutionStage,
  ExecutionCheckpoint,
  ExecutionResult,
  ExecutionEventType,
  ExecutionEvent,
  WorkerKind,
  WorkerStatus,
  ExecutionWorker,
  QueueEntryKind,
  ExecutionQueueEntry,
  ExecutionQueue,
  ExecutionSession,
  ExecutionGraphValidationCheck,
  ExecutionGraphValidation,
  ExecutionGraphInput,
  SessionCommand,
  RecoveryAction,
  ExecutionMonitorSnapshot,
} from './types/orchestrator-types.js';
export {
  EXECUTION_STATES,
  EXECUTION_NODE_STATUSES,
  EXECUTION_EDGE_TYPES,
  EXECUTION_EVENT_TYPES,
  WORKER_KINDS,
  QUEUE_ENTRY_KINDS,
} from './types/orchestrator-types.js';

// ── Domain ────────────────────────────────────────────────────────────────
export {
  createGraphId,
  generateGraphId,
  createSessionId,
  generateSessionId,
  createNodeId,
  createWorkerId,
} from './domain/value-objects/Identifiers.js';
export type { GraphId, SessionId, NodeId, WorkerId } from './domain/value-objects/Identifiers.js';
export type { ExecutionGraphRepository } from './domain/repository/ExecutionGraphRepository.js';
export type { ExecutionSessionRepository } from './domain/repository/ExecutionSessionRepository.js';
export type { WorkerRegistry } from './domain/repository/WorkerRegistry.js';
export type { ExecutionQueueRepository } from './domain/repository/ExecutionQueueRepository.js';
export type {
  ExecutionHistoryRepository,
  ExecutionHistoryRecord,
} from './domain/repository/ExecutionHistoryRepository.js';
export { ExecutionGraphBuilderService } from './domain/services/ExecutionGraphBuilderService.js';
export { ExecutionGraphValidatorService } from './domain/services/ExecutionGraphValidatorService.js';
export { ExecutionSchedulerService } from './domain/services/ExecutionSchedulerService.js';
export type { ScheduleResult } from './domain/services/ExecutionSchedulerService.js';
export { ExecutionStateMachineService } from './domain/services/ExecutionStateMachineService.js';
export { ExecutionEventService } from './domain/services/ExecutionEventService.js';
export { ExecutionMonitorService } from './domain/services/ExecutionMonitorService.js';
export { ExecutionRecoveryService } from './domain/services/ExecutionRecoveryService.js';
export type { RecoveryPlan } from './domain/services/ExecutionRecoveryService.js';
export { ExecutionSessionService } from './domain/services/ExecutionSessionService.js';

// ── Infrastructure ────────────────────────────────────────────────────────
export { InMemoryExecutionGraphRepository } from './infrastructure/InMemoryExecutionGraphRepository.js';
export { InMemoryExecutionSessionRepository } from './infrastructure/InMemoryExecutionSessionRepository.js';
export { InMemoryExecutionQueueRepository } from './infrastructure/InMemoryExecutionQueueRepository.js';
export { InMemoryWorkerRegistry } from './infrastructure/InMemoryWorkerRegistry.js';
export { InMemoryExecutionHistoryRepository } from './infrastructure/InMemoryExecutionHistoryRepository.js';

// ── Contracts ─────────────────────────────────────────────────────────────
export type {
  RuntimeAdapter,
  RuntimeWorkItem,
  HatchetAdapter,
  LangGraphAdapter,
  FutureRuntimeAdapter,
  RuntimeAdapterRegistry,
} from './contracts/runtime-adapters.js';

// ── Application ───────────────────────────────────────────────────────────
export { OrchestratorApplicationService } from './application/OrchestratorApplicationService.js';
export type { OrchestratorResult } from './application/OrchestratorApplicationService.js';
export { OrchestratorMapper } from './application/OrchestratorMapper.js';
export type {
  ExecutionGraphDTO,
  ExecutionNodeDTO,
  ExecutionEdgeDTO,
  ExecutionStageDTO,
  ExecutionCheckpointDTO,
  ExecutionGraphValidationDTO,
  ExecutionSessionDTO,
  ExecutionResultDTO,
  ExecutionEventDTO,
  ExecutionWorkerDTO,
  ExecutionQueueEntryDTO,
  ExecutionMonitorSnapshotDTO,
  ExecutionRecoveryPlanDTO,
  ScheduleResultDTO,
  OrchestratorSummaryDTO,
  BuildGraphInputDTO,
  CreateSessionDTO,
  ExplainGraphDTO,
} from './application/OrchestratorDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────────────
export {
  createCatalogWorkers,
  createBlogGraphInput,
  createNewsletterGraphInput,
  SEED_WORKER_COUNT,
} from './catalog/orchestrator-catalog.js';
