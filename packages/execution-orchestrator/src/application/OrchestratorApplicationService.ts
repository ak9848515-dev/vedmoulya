// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Application Service
// EI-005 — Enterprise Execution Orchestrator
// Facade over the domain orchestration services. Exposes the API
// surface: build/validate/optimize graph, create/pause/resume/cancel/
// list sessions, explain graph, plus workers/queue/monitor/recovery.
// Orchestrates execution — never runs AI.
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionGraphInput,
  ExecutionSession,
  SessionCommand,
  ExecutionResult,
  ExecutionWorker,
  ExecutionQueue,
} from '../types/orchestrator-types.js';
import { ExecutionGraphBuilderService } from '../domain/services/ExecutionGraphBuilderService.js';
import { ExecutionGraphValidatorService } from '../domain/services/ExecutionGraphValidatorService.js';
import { ExecutionSchedulerService } from '../domain/services/ExecutionSchedulerService.js';
import { ExecutionStateMachineService } from '../domain/services/ExecutionStateMachineService.js';
import { ExecutionEventService } from '../domain/services/ExecutionEventService.js';
import { ExecutionMonitorService } from '../domain/services/ExecutionMonitorService.js';
import { ExecutionRecoveryService } from '../domain/services/ExecutionRecoveryService.js';
import { ExecutionSessionService } from '../domain/services/ExecutionSessionService.js';
import type { ExecutionGraphRepository } from '../domain/repository/ExecutionGraphRepository.js';
import type { ExecutionSessionRepository } from '../domain/repository/ExecutionSessionRepository.js';
import type { WorkerRegistry } from '../domain/repository/WorkerRegistry.js';
import type { ExecutionQueueRepository } from '../domain/repository/ExecutionQueueRepository.js';
import type { ExecutionHistoryRepository } from '../domain/repository/ExecutionHistoryRepository.js';
import { OrchestratorMapper } from './OrchestratorMapper.js';
import type {
  CreateSessionDTO,
  ExecutionGraphDTO,
  ExecutionSessionDTO,
  ExplainGraphDTO,
  ExecutionMonitorSnapshotDTO,
  ExecutionQueueEntryDTO,
  ExecutionRecoveryPlanDTO,
  ExecutionWorkerDTO,
  OrchestratorSummaryDTO,
  ScheduleResultDTO,
} from './OrchestratorDTO.js';

export interface OrchestratorResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Graph build input whose strategy knobs (retry/latency/token/cost) are
 * optional — the gateway zod schema marks them optional, and the service
 * normalizes them with defaults before building.
 */
export type GraphBuildInput = Omit<
  ExecutionGraphInput,
  'maxRetries' | 'retryDelayMs' | 'maxLatencyMs' | 'expectedTokens' | 'maxCostUsd'
> &
  Partial<
    Pick<
      ExecutionGraphInput,
      'maxRetries' | 'retryDelayMs' | 'maxLatencyMs' | 'expectedTokens' | 'maxCostUsd'
    >
  >;

export class OrchestratorApplicationService {
  private readonly graphBuilder: ExecutionGraphBuilderService;
  private readonly graphValidator: ExecutionGraphValidatorService;
  private readonly scheduler: ExecutionSchedulerService;
  private readonly stateMachine: ExecutionStateMachineService;
  private readonly eventService: ExecutionEventService;
  private readonly monitor: ExecutionMonitorService;
  private readonly recovery: ExecutionRecoveryService;
  private readonly sessionService: ExecutionSessionService;

  constructor(
    private readonly graphRepository: ExecutionGraphRepository,
    private readonly sessionRepository: ExecutionSessionRepository,
    private readonly workerRegistry: WorkerRegistry,
    private readonly queueRepository: ExecutionQueueRepository,
    private readonly historyRepository: ExecutionHistoryRepository,
  ) {
    this.graphBuilder = new ExecutionGraphBuilderService();
    this.graphValidator = new ExecutionGraphValidatorService();
    this.scheduler = new ExecutionSchedulerService();
    this.stateMachine = new ExecutionStateMachineService();
    this.eventService = new ExecutionEventService();
    this.monitor = new ExecutionMonitorService();
    this.recovery = new ExecutionRecoveryService();
    this.sessionService = new ExecutionSessionService(this.stateMachine, this.eventService);
  }

  // ── Graph: Build / Validate / Optimize ────────────────────────────────────

  async buildExecutionGraph(
    input: GraphBuildInput,
  ): Promise<OrchestratorResult<ExecutionGraphDTO>> {
    // Normalize optional strategy knobs (the gateway zod schema marks them
    // optional) so a bare build never produces NaN budgets/timeouts — same
    // defaults as createExecutionSession.
    const normalized: ExecutionGraphInput = {
      ...input,
      maxRetries: input.maxRetries ?? 2,
      retryDelayMs: input.retryDelayMs ?? 1000,
      maxLatencyMs: input.maxLatencyMs ?? 30000,
      expectedTokens: input.expectedTokens ?? 8000,
      maxCostUsd: input.maxCostUsd ?? 2,
    };
    const graph = this.graphBuilder.build(normalized);
    graph.validation = this.graphValidator.validate(graph);
    graph.validated = graph.validation.passed;
    await this.graphRepository.save(graph);
    return { success: true, data: OrchestratorMapper.graphToDTO(graph) };
  }

  async validateExecutionGraph(graphId: string): Promise<OrchestratorResult<ExecutionGraphDTO>> {
    const graph = await this.graphRepository.findById(graphId as never);
    if (!graph) return { success: false, error: `Execution graph not found: ${graphId}` };
    graph.validation = this.graphValidator.validate(graph);
    graph.validated = graph.validation.passed;
    await this.graphRepository.save(graph);
    return { success: true, data: OrchestratorMapper.graphToDTO(graph) };
  }

  /** Optimize = validate + recompute parallel groups/critical path + schedule. */
  async optimizeExecutionGraph(graphId: string): Promise<OrchestratorResult<ScheduleResultDTO>> {
    const graph = await this.graphRepository.findById(graphId as never);
    if (!graph) return { success: false, error: `Execution graph not found: ${graphId}` };
    graph.validation = this.graphValidator.validate(graph);
    graph.validated = graph.validation.passed;
    const schedule = this.scheduler.schedule(graph, 4, `session_${graph.graphId}`);
    await this.graphRepository.save(graph);
    return { success: true, data: OrchestratorMapper.scheduleToDTO(schedule) };
  }

  // ── Graph retrieval ───────────────────────────────────────────────────────

  async listGraphs(): Promise<OrchestratorResult<ExecutionGraphDTO[]>> {
    const graphs = await this.graphRepository.listAll();
    return { success: true, data: graphs.map((g) => OrchestratorMapper.graphToDTO(g)) };
  }

  async getGraph(graphId: string): Promise<OrchestratorResult<ExecutionGraphDTO>> {
    const graph = await this.graphRepository.findById(graphId as never);
    if (!graph) return { success: false, error: `Execution graph not found: ${graphId}` };
    return { success: true, data: OrchestratorMapper.graphToDTO(graph) };
  }

  async explainExecutionGraph(graphId: string): Promise<OrchestratorResult<ExplainGraphDTO>> {
    const graph = await this.graphRepository.findById(graphId as never);
    if (!graph) return { success: false, error: `Execution graph not found: ${graphId}` };
    return { success: true, data: OrchestratorMapper.explainToDTO(graph) };
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  async createExecutionSession(
    dto: CreateSessionDTO,
  ): Promise<OrchestratorResult<ExecutionSessionDTO>> {
    const input: ExecutionGraphInput = {
      strategyId: dto.strategyId,
      goalId: dto.goalId,
      goal: dto.goal,
      steps: dto.steps,
      mode: dto.mode,
      priority: dto.priority,
      maxRetries: dto.maxRetries ?? 2,
      retryDelayMs: dto.retryDelayMs ?? 1000,
      maxLatencyMs: dto.maxLatencyMs ?? 30000,
      expectedTokens: dto.expectedTokens ?? 8000,
      maxCostUsd: dto.maxCostUsd ?? 2,
    };
    const graph = this.graphBuilder.build(input);
    graph.validation = this.graphValidator.validate(graph);
    graph.validated = graph.validation.passed;
    if (!graph.validated) {
      return {
        success: false,
        error: `Cannot create session — graph invalid: ${graph.validation.summary}`,
      };
    }
    await this.graphRepository.save(graph);

    const session = this.sessionService.createSession(graph, dto.strategyId);
    const running = this.stateMachine.transition(session.status, { type: 'start' });
    session.status = running ?? 'ready';
    session.startedAt = new Date().toISOString();
    session.events = [...session.events, this.eventService.started(session.sessionId)];
    await this.sessionRepository.save(session);

    // Enqueue the scheduler's entries for the session.
    const schedule = this.scheduler.schedule(graph, 4, session.sessionId);
    const queue: ExecutionQueue = {
      queueId: `queue_${session.sessionId}`,
      entries: schedule.entries,
    };
    await this.queueRepository.save(queue);

    return { success: true, data: OrchestratorMapper.sessionToDTO(session) };
  }

  async pauseSession(sessionId: string): Promise<OrchestratorResult<ExecutionSessionDTO>> {
    return this.transitionSession(sessionId, { type: 'pause' });
  }

  async resumeSession(sessionId: string): Promise<OrchestratorResult<ExecutionSessionDTO>> {
    return this.transitionSession(sessionId, { type: 'resume' });
  }

  async cancelSession(sessionId: string): Promise<OrchestratorResult<ExecutionSessionDTO>> {
    return this.transitionSession(sessionId, { type: 'cancel' });
  }

  async listSessions(): Promise<OrchestratorResult<ExecutionSessionDTO[]>> {
    const sessions = await this.sessionRepository.listAll();
    return { success: true, data: sessions.map((s) => OrchestratorMapper.sessionToDTO(s)) };
  }

  async getSession(sessionId: string): Promise<OrchestratorResult<ExecutionSessionDTO>> {
    const session = await this.sessionRepository.findById(sessionId as never);
    if (!session) return { success: false, error: `Execution session not found: ${sessionId}` };
    return { success: true, data: OrchestratorMapper.sessionToDTO(session) };
  }

  /** Record a simulated/observed node result (monitoring hook). */
  async recordNodeResult(
    sessionId: string,
    graphId: string,
    result: ExecutionResult,
  ): Promise<OrchestratorResult<ExecutionSessionDTO>> {
    const session = await this.sessionRepository.findById(sessionId as never);
    if (!session) return { success: false, error: `Execution session not found: ${sessionId}` };
    const graph = await this.graphRepository.findById(graphId as never);
    if (!graph) return { success: false, error: `Execution graph not found: ${graphId}` };
    const updated = this.sessionService.recordNodeResult(session, graph, result);
    await this.sessionRepository.save(updated);
    // Persist history contracts.
    await this.writeHistory(updated);
    return { success: true, data: OrchestratorMapper.sessionToDTO(updated) };
  }

  // ── Monitor / Recovery / Queue / Workers ─────────────────────────────────

  async getMonitorSnapshot(
    sessionId: string,
  ): Promise<OrchestratorResult<ExecutionMonitorSnapshotDTO>> {
    const session = await this.sessionRepository.findById(sessionId as never);
    if (!session) return { success: false, error: `Execution session not found: ${sessionId}` };
    return { success: true, data: OrchestratorMapper.monitorToDTO(this.monitor.snapshot(session)) };
  }

  async planRecovery(
    sessionId: string,
    failedNodeId?: string,
  ): Promise<OrchestratorResult<ExecutionRecoveryPlanDTO[]>> {
    const session = await this.sessionRepository.findById(sessionId as never);
    if (!session) return { success: false, error: `Execution session not found: ${sessionId}` };
    const graph = await this.graphRepository.findById(session.graphId as never);
    if (!graph) return { success: false, error: `Execution graph not found: ${session.graphId}` };
    const plans = this.recovery.plan(graph, session, failedNodeId);
    return { success: true, data: plans.map((p) => OrchestratorMapper.recoveryToDTO(p)) };
  }

  async getQueue(sessionId: string): Promise<OrchestratorResult<ExecutionQueueEntryDTO[]>> {
    const queue = await this.queueRepository.findBySession(sessionId as never);
    if (!queue) return { success: true, data: [] };
    return { success: true, data: queue.entries.map((e) => OrchestratorMapper.queueEntryToDTO(e)) };
  }

  async scheduleGraph(graphId: string): Promise<OrchestratorResult<ScheduleResultDTO>> {
    const graph = await this.graphRepository.findById(graphId as never);
    if (!graph) return { success: false, error: `Execution graph not found: ${graphId}` };
    const schedule = this.scheduler.schedule(graph, 4, `session_${graph.graphId}`);
    return { success: true, data: OrchestratorMapper.scheduleToDTO(schedule) };
  }

  // ── Workers ───────────────────────────────────────────────────────────────

  async registerWorker(worker: ExecutionWorker): Promise<OrchestratorResult<ExecutionWorkerDTO>> {
    await this.workerRegistry.register(worker);
    return { success: true, data: OrchestratorMapper.workerToDTO(worker) };
  }

  async listWorkers(): Promise<OrchestratorResult<ExecutionWorkerDTO[]>> {
    const workers = await this.workerRegistry.listAll();
    return { success: true, data: workers.map((w) => OrchestratorMapper.workerToDTO(w)) };
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  async getSummary(): Promise<OrchestratorResult<OrchestratorSummaryDTO>> {
    const [graphs, sessions, workers] = await Promise.all([
      this.graphRepository.listAll(),
      this.sessionRepository.listAll(),
      this.workerRegistry.listAll(),
    ]);
    const statusByState: Record<string, number> = {};
    for (const s of sessions) {
      statusByState[s.status] = (statusByState[s.status] ?? 0) + 1;
    }
    return {
      success: true,
      data: OrchestratorMapper.summaryToDTO({
        totalGraphs: graphs.length,
        totalSessions: sessions.length,
        activeSessions: sessions.filter((s) => this.stateMachine.isActive(s.status)).length,
        completedSessions: sessions.filter((s) => s.status === 'completed').length,
        failedSessions: sessions.filter((s) => s.status === 'failed').length,
        totalWorkers: workers.length,
        idleWorkers: workers.filter((w) => w.status === 'idle').length,
        busyWorkers: workers.filter((w) => w.status === 'busy').length,
        statusByState,
      }),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async transitionSession(
    sessionId: string,
    command: SessionCommand,
  ): Promise<OrchestratorResult<ExecutionSessionDTO>> {
    const session = await this.sessionRepository.findById(sessionId as never);
    if (!session) return { success: false, error: `Execution session not found: ${sessionId}` };
    try {
      const updated = this.sessionService.apply(session, command);
      await this.sessionRepository.save(updated);
      await this.writeHistory(updated);
      return { success: true, data: OrchestratorMapper.sessionToDTO(updated) };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Illegal session transition.',
      };
    }
  }

  private async writeHistory(session: ExecutionSession): Promise<void> {
    const results = Object.values(session.results);
    const record = {
      sessionId: session.sessionId,
      events: session.events,
      results: session.results,
      recoveryActions: [],
      summary: {
        completed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        skipped: 0,
        totalCostUsd: Number(results.reduce((s, r) => s + r.costUsd, 0).toFixed(2)),
        totalTokens: results.reduce((s, r) => s + r.tokensUsed, 0),
        totalLatencyMs: results.reduce((s, r) => s + r.latencyMs, 0),
      },
      updatedAt: session.updatedAt,
    };
    await this.historyRepository.save(record);
  }
}
