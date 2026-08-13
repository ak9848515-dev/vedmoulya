// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: Application Service
// EI-006 / INT-001
// Facade over the INT-001 pipeline domain services. Exposes the API
// surface: build / validate / explain / get / list pipelines, plus the
// Enterprise Intelligence Dashboard aggregate (engine statuses + each
// engine's own summary). Everything composes the six engines — no AI.
// ──────────────────────────────────────────────────────────────────

import type { PipelineRepository } from '../domain/repository/PipelineRepository.js';
import { PipelineBuilderService } from '../domain/services/PipelineBuilderService.js';
import { PipelineValidatorService } from '../domain/services/PipelineValidatorService.js';
import { PipelineExplainerService } from '../domain/services/PipelineExplainerService.js';
import { PipelineSummaryService } from '../domain/services/PipelineSummaryService.js';
import type { IntelligenceEngines } from '../contracts/pipeline-engines.js';
import type { EngineStatus } from '../types/pipeline-types.js';
import type { GoalSummaryDTO } from '@vedmoulya/goals';
import { GOAL_STATUSES, GOAL_CATEGORIES, GOAL_PRIORITIES } from '@vedmoulya/goals';
import type { CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';
import {
  CAPABILITY_STATUSES,
  CAPABILITY_CATEGORIES,
  BUSINESS_MODULES,
} from '@vedmoulya/capabilities';
import type { ProviderMarketplaceDTO } from '@vedmoulya/providers';
import { PROVIDER_LIFECYCLE_STATUSES } from '@vedmoulya/providers';
import { CAPABILITY_TYPES } from '@vedmoulya/ai';
import type { ContextRegistrySummaryDTO } from '@vedmoulya/context';
import { CONTEXT_SOURCES, CONTEXT_CATEGORIES, CONTEXT_PRIORITIES } from '@vedmoulya/context';
import type { StrategySummaryDTO } from '@vedmoulya/execution-strategy';
import type { OrchestratorSummaryDTO } from '@vedmoulya/execution-orchestrator';
import { PipelineMapper } from './PipelineMapper.js';
import type {
  IntelligenceDashboardDTO,
  PipelineDTO,
  PipelineExplanationDTO,
  PipelineValidationDTO,
} from './PipelineDTO.js';

export interface IntelligenceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class IntelligenceApplicationService {
  private readonly builder: PipelineBuilderService;
  private readonly validator: PipelineValidatorService;
  private readonly explainer: PipelineExplainerService;
  private readonly summaryService: PipelineSummaryService;

  constructor(
    private readonly pipelineRepository: PipelineRepository,
    private readonly engines: IntelligenceEngines,
  ) {
    this.builder = new PipelineBuilderService(engines);
    this.validator = new PipelineValidatorService();
    this.explainer = new PipelineExplainerService();
    this.summaryService = new PipelineSummaryService();
  }

  // ── BuildPipeline ────────────────────────────────────────────────────────

  /** Build a full pipeline for a goal and persist it (validated, never run). */
  async buildPipeline(dto: { goalId: string }): Promise<IntelligenceResult<PipelineDTO>> {
    const pipeline = await this.builder.build({ goalId: dto.goalId });
    pipeline.validation = this.validator.validate(pipeline);
    pipeline.updatedAt = new Date().toISOString();
    await this.pipelineRepository.save(pipeline);
    return { success: true, data: PipelineMapper.toDTO(pipeline) };
  }

  // ── ValidatePipeline ─────────────────────────────────────────────────────

  /** Re-validate a persisted pipeline and refresh its stored validation. */
  async validatePipeline(pipelineId: string): Promise<IntelligenceResult<PipelineValidationDTO>> {
    const pipeline = await this.pipelineRepository.findById(pipelineId as never);
    if (!pipeline) return { success: false, error: `Pipeline not found: ${pipelineId}` };
    pipeline.validation = this.validator.validate(pipeline);
    pipeline.updatedAt = new Date().toISOString();
    await this.pipelineRepository.save(pipeline);
    return {
      success: true,
      data: {
        passed: pipeline.validation.passed,
        checks: pipeline.validation.checks.map((c) => ({
          stage: c.stage,
          check: c.check,
          passed: c.passed,
          detail: c.detail,
        })),
        summary: pipeline.validation.summary,
      },
    };
  }

  // ── ExplainPipeline ──────────────────────────────────────────────────────

  /** Human-readable explanation of a pipeline (no engine calls). */
  async explainPipeline(pipelineId: string): Promise<IntelligenceResult<PipelineExplanationDTO>> {
    const pipeline = await this.pipelineRepository.findById(pipelineId as never);
    if (!pipeline) return { success: false, error: `Pipeline not found: ${pipelineId}` };
    return { success: true, data: this.explainer.explain(pipeline) };
  }

  // ── GetPipeline / ListPipelines ──────────────────────────────────────────

  async getPipeline(pipelineId: string): Promise<IntelligenceResult<PipelineDTO>> {
    const pipeline = await this.pipelineRepository.findById(pipelineId as never);
    if (!pipeline) return { success: false, error: `Pipeline not found: ${pipelineId}` };
    return { success: true, data: PipelineMapper.toDTO(pipeline) };
  }

  async listPipelines(): Promise<IntelligenceResult<PipelineDTO[]>> {
    const pipelines = await this.pipelineRepository.listAll();
    return { success: true, data: pipelines.map((p) => PipelineMapper.toDTO(p)) };
  }

  // ── Dashboard ────────────────────────────────────────────────────────────

  /**
   * The Enterprise Intelligence Dashboard: engine statuses + pipeline
   * aggregate + each engine's own summary (reused verbatim from the
   * engines' public summaries — no duplicate aggregation logic).
   */
  async getDashboard(): Promise<IntelligenceResult<IntelligenceDashboardDTO>> {
    const [
      pipelines,
      goalSummary,
      capabilityMarketplace,
      providerMarketplace,
      contextSummary,
      strategySummary,
      orchestratorSummary,
    ] = await Promise.all([
      this.pipelineRepository.listAll(),
      this.engines.goals.getSummary(),
      this.engines.capabilities.getMarketplace(),
      this.engines.providers.getMarketplace(),
      this.engines.context.getContextSummary(),
      this.engines.strategies.getSummary(),
      this.engines.orchestrator.getSummary(),
    ]);

    const engineStatus: EngineStatus[] = [
      this.goalEngineStatus(goalSummary),
      this.capabilityEngineStatus(capabilityMarketplace),
      this.providerEngineStatus(providerMarketplace),
      this.contextEngineStatus(contextSummary),
      this.strategyEngineStatus(strategySummary),
      this.orchestratorEngineStatus(orchestratorSummary),
    ];

    return {
      success: true,
      data: PipelineMapper.dashboardToDTO({
        engineStatus,
        pipelineSummary: this.summaryService.aggregate(pipelines),
        pipelines: pipelines.map((p) => PipelineMapper.summaryToDTO(p)),
        goals: goalSummary.data ?? emptyGoalSummary(),
        capabilities: capabilityMarketplace.data ?? emptyCapabilityMarketplace(),
        providers: providerMarketplace.data ?? emptyProviderMarketplace(),
        context: contextSummary.data ?? emptyContextSummary(),
        strategies: strategySummary.data ?? emptyStrategySummary(),
        orchestrator: orchestratorSummary.data ?? emptyOrchestratorSummary(),
      }),
    };
  }

  // ── Engine status helpers ────────────────────────────────────────────────

  private goalEngineStatus(summary: {
    success: boolean;
    data?: { totalGoals?: number; activeGoals?: number };
  }): EngineStatus {
    const d = summary.data;
    return {
      engine: 'goals',

      label: 'Goal & Task Intelligence',
      status: d ? 'ready' : 'unknown',
      summary: d ? `${String(d.totalGoals ?? 0)} goal(s) registered.` : 'Summary unavailable.',
      counts: { goals: d?.totalGoals ?? 0, active: d?.activeGoals ?? 0 },
    };
  }

  private capabilityEngineStatus(marketplace: {
    success: boolean;
    data?: { total?: number; activeCount?: number };
  }): EngineStatus {
    const d = marketplace.data;
    return {
      engine: 'capabilities',

      label: 'Enterprise Capability Registry',
      status: d ? 'ready' : 'unknown',
      summary: d
        ? `${String(d.total ?? 0)} capabilit${(d.total ?? 0) === 1 ? 'y' : 'ies'} (${String(d.activeCount ?? 0)} active).`
        : 'Summary unavailable.',
      counts: { total: d?.total ?? 0, active: d?.activeCount ?? 0 },
    };
  }

  private providerEngineStatus(marketplace: {
    success: boolean;
    data?: { total?: number; healthyCount?: number };
  }): EngineStatus {
    const d = marketplace.data;
    return {
      engine: 'providers',

      label: 'Enterprise Provider Registry',
      status: d ? 'ready' : 'unknown',
      summary: d
        ? `${String(d.total ?? 0)} provider(s) (${String(d.healthyCount ?? 0)} healthy).`
        : 'Summary unavailable.',
      counts: { total: d?.total ?? 0, healthy: d?.healthyCount ?? 0 },
    };
  }

  private contextEngineStatus(summary: {
    success: boolean;
    data?: { total?: number };
  }): EngineStatus {
    const d = summary.data;
    return {
      engine: 'context',

      label: 'Enterprise Context Intelligence',
      status: d ? 'ready' : 'unknown',
      summary: d ? `${String(d.total ?? 0)} context item(s) available.` : 'Summary unavailable.',
      counts: { items: d?.total ?? 0 },
    };
  }

  private strategyEngineStatus(summary: {
    success: boolean;
    data?: { total?: number };
  }): EngineStatus {
    const d = summary.data;
    return {
      engine: 'execution-strategy',

      label: 'Enterprise Execution Strategy',
      status: d ? 'ready' : 'unknown',
      summary: d
        ? `${String(d.total ?? 0)} strateg${(d.total ?? 0) === 1 ? 'y' : 'ies'} planned.`
        : 'Summary unavailable.',
      counts: { strategies: d?.total ?? 0 },
    };
  }

  private orchestratorEngineStatus(summary: {
    success: boolean;
    data?: { totalGraphs?: number; totalSessions?: number };
  }): EngineStatus {
    const d = summary.data;
    return {
      engine: 'execution-orchestrator',

      label: 'Enterprise Execution Orchestrator',
      status: d ? 'ready' : 'unknown',
      summary: d
        ? `${String(d.totalGraphs ?? 0)} graph(s), ${String(d.totalSessions ?? 0)} session(s).`
        : 'Summary unavailable.',
      counts: { graphs: d?.totalGraphs ?? 0, sessions: d?.totalSessions ?? 0 },
    };
  }
}

// ── Empty fallbacks (never throw on a missing engine summary) ──────────────

/** Build a Record<K, number> with every union key present and 0. */
function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

function emptyGoalSummary(): GoalSummaryDTO {
  return {
    totalGoals: 0,
    activeGoals: 0,
    completedGoals: 0,
    blockedGoals: 0,
    byCategory: zeroRecord(GOAL_CATEGORIES),
    byStatus: zeroRecord(GOAL_STATUSES),
    byPriority: zeroRecord(GOAL_PRIORITIES),
    avgConfidence: 0,
    avgGoalScore: 0,
    totalTasks: 0,
  };
}

function emptyCapabilityMarketplace(): CapabilityMarketplaceDTO {
  return {
    capabilities: [],
    total: 0,
    activeCount: 0,
    compositionCount: 0,
    countByStatus: zeroRecord(CAPABILITY_STATUSES),
    countByCategory: zeroRecord(CAPABILITY_CATEGORIES),
    countByBusinessModule: zeroRecord(BUSINESS_MODULES),
  };
}

function emptyProviderMarketplace(): ProviderMarketplaceDTO {
  return {
    providers: [],
    total: 0,
    activeCount: 0,
    healthyCount: 0,
    countByLifecycleStatus: zeroRecord(PROVIDER_LIFECYCLE_STATUSES),
    // Must mirror the ProviderFamily union in @vedmoulya/ai (no exported
    // const array exists for it). Keep in sync when the union changes.
    countByFamily: zeroRecord([
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'openrouter',
      'ollama',
      'mock',
    ] as const),
    countByCapability: zeroRecord(CAPABILITY_TYPES),
  };
}

function emptyContextSummary(): ContextRegistrySummaryDTO {
  return {
    total: 0,
    totalTokens: 0,
    countBySource: zeroRecord(CONTEXT_SOURCES),
    countByCategory: zeroRecord(CONTEXT_CATEGORIES),
    countByPriority: zeroRecord(CONTEXT_PRIORITIES),
  };
}

function emptyStrategySummary(): StrategySummaryDTO {
  return {
    total: 0,
    averageConfidence: 0,
    countByPriority: {} as Record<string, number>,
    countByExecutionMode: {} as Record<string, number>,
  };
}

function emptyOrchestratorSummary(): OrchestratorSummaryDTO {
  return {
    totalGraphs: 0,
    totalSessions: 0,
    activeSessions: 0,
    completedSessions: 0,
    failedSessions: 0,
    totalWorkers: 0,
    idleWorkers: 0,
    busyWorkers: 0,
    statusByState: {},
  };
}
