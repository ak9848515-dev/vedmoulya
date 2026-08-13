// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: Application DTOs
// EI-006 / INT-001
// ──────────────────────────────────────────────────────────────────

import type { GoalSummaryDTO } from '@vedmoulya/goals';
import type { CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';
import type { ProviderMarketplaceDTO } from '@vedmoulya/providers';
import type { ContextRegistrySummaryDTO } from '@vedmoulya/context';
import type { StrategySummaryDTO } from '@vedmoulya/execution-strategy';
import type { OrchestratorSummaryDTO } from '@vedmoulya/execution-orchestrator';
import type {
  EnterprisePipeline,
  PipelineStage,
  PipelineStepStatus,
  PipelineStatus,
  IntelligenceEngine,
} from '../types/pipeline-types.js';

// ── Pipeline DTOs ─────────────────────────────────────────────────────────

export interface PipelineStepDTO {
  stage: PipelineStage;
  status: PipelineStepStatus;
  detail: string;
  counts: Record<string, number>;
  artifactIds: string[];
}

export interface PipelineValidationDTO {
  passed: boolean;
  checks: Array<{ stage: PipelineStage; check: string; passed: boolean; detail: string }>;
  summary: string;
}

export interface PipelineArtifactsDTO {
  capabilities: string[];
  providers: string[];
  contextItems: number;
  strategyId?: string;
  graphId?: string;
  sessionId?: string;
}

export interface PipelineDTO {
  pipelineId: string;
  goalId: string;
  goal: string;
  status: PipelineStatus;
  steps: PipelineStepDTO[];
  validation: PipelineValidationDTO;
  artifacts: PipelineArtifactsDTO;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineExplanationDTO {
  pipelineId: string;
  goal: string;
  headline: string;
  steps: Array<{ stage: PipelineStage; summary: string }>;
  ready: boolean;
}

export interface PipelineSummaryDTO {
  pipelineId: string;
  goal: string;
  goalId: string;
  status: PipelineStatus;
  validated: boolean;
  capabilityCount: number;
  providerCount: number;
  contextItemCount: number;
  hasStrategy: boolean;
  hasGraph: boolean;
  hasSession: boolean;
  createdAt: string;
}

// ── Dashboard DTOs ────────────────────────────────────────────────────────

export interface EngineStatusDTO {
  engine: IntelligenceEngine;
  label: string;
  status: 'ready' | 'degraded' | 'unknown';
  summary: string;
  counts: Record<string, number>;
}

export interface IntelligenceDashboardDTO {
  engineStatus: EngineStatusDTO[];
  pipelineSummary: { total: number; ready: number; failed: number };
  pipelines: PipelineSummaryDTO[];
  goals: GoalSummaryDTO;
  capabilities: CapabilityMarketplaceDTO;
  providers: ProviderMarketplaceDTO;
  context: ContextRegistrySummaryDTO;
  strategies: StrategySummaryDTO;
  orchestrator: OrchestratorSummaryDTO;
}

// Re-exported entity type alias for convenience (keeps the public surface clean).
export type { EnterprisePipeline };
