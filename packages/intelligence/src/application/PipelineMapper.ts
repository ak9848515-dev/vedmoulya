// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: DTO Mapper
// EI-006 / INT-001
// Plain-object mapper (matches the StrategyMapper/OrchestratorMapper
// convention) — maps domain pipelines to API-safe DTOs and assembles
// the dashboard engine-status aggregate from engine summaries.
// ──────────────────────────────────────────────────────────────────

import type { GoalSummaryDTO } from '@vedmoulya/goals';
import type { CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';
import type { ProviderMarketplaceDTO } from '@vedmoulya/providers';
import type { ContextRegistrySummaryDTO } from '@vedmoulya/context';
import type { StrategySummaryDTO } from '@vedmoulya/execution-strategy';
import type { OrchestratorSummaryDTO } from '@vedmoulya/execution-orchestrator';
import type { EnterprisePipeline, EngineStatus } from '../types/pipeline-types.js';
import type {
  EngineStatusDTO,
  IntelligenceDashboardDTO,
  PipelineDTO,
  PipelineSummaryDTO,
} from './PipelineDTO.js';

export const PipelineMapper = {
  toDTO(pipeline: EnterprisePipeline): PipelineDTO {
    return {
      pipelineId: pipeline.pipelineId,
      goalId: pipeline.goalId,
      goal: pipeline.goal,
      status: pipeline.status,
      steps: pipeline.steps.map((s) => ({
        stage: s.stage,
        status: s.status,
        detail: s.detail,
        counts: s.counts,
        artifactIds: s.artifactIds,
      })),
      validation: {
        passed: pipeline.validation.passed,
        checks: pipeline.validation.checks.map((c) => ({
          stage: c.stage,
          check: c.check,
          passed: c.passed,
          detail: c.detail,
        })),
        summary: pipeline.validation.summary,
      },
      artifacts: {
        capabilities: pipeline.artifacts.capabilities,
        providers: pipeline.artifacts.providers,
        contextItems: pipeline.artifacts.contextItems,
        strategyId: pipeline.artifacts.strategyId,
        graphId: pipeline.artifacts.graphId,
        sessionId: pipeline.artifacts.sessionId,
      },
      createdAt: pipeline.createdAt,
      updatedAt: pipeline.updatedAt,
    };
  },

  summaryToDTO(pipeline: EnterprisePipeline): PipelineSummaryDTO {
    return {
      pipelineId: pipeline.pipelineId,
      goal: pipeline.goal,
      goalId: pipeline.goalId,
      status: pipeline.status,
      validated: pipeline.validation.passed,
      capabilityCount: pipeline.artifacts.capabilities.length,
      providerCount: pipeline.artifacts.providers.length,
      contextItemCount: pipeline.artifacts.contextItems,
      hasStrategy: pipeline.artifacts.strategyId !== undefined,
      hasGraph: pipeline.artifacts.graphId !== undefined,
      hasSession: pipeline.artifacts.sessionId !== undefined,
      createdAt: pipeline.createdAt,
    };
  },

  dashboardToDTO(input: {
    engineStatus: EngineStatus[];
    pipelineSummary: { total: number; ready: number; failed: number };
    pipelines: PipelineSummaryDTO[];
    goals: GoalSummaryDTO;
    capabilities: CapabilityMarketplaceDTO;
    providers: ProviderMarketplaceDTO;
    context: ContextRegistrySummaryDTO;
    strategies: StrategySummaryDTO;
    orchestrator: OrchestratorSummaryDTO;
  }): IntelligenceDashboardDTO {
    return {
      engineStatus: input.engineStatus.map((e) => this.engineStatusToDTO(e)),
      pipelineSummary: input.pipelineSummary,
      pipelines: input.pipelines,
      goals: input.goals,
      capabilities: input.capabilities,
      providers: input.providers,
      context: input.context,
      strategies: input.strategies,
      orchestrator: input.orchestrator,
    };
  },

  engineStatusToDTO(status: EngineStatus): EngineStatusDTO {
    return { ...status };
  },
};
