// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Integration Platform: Domain Types
// EI-006 / INT-001 — Enterprise Intelligence Pipeline
// The pipeline integrates every Enterprise Intelligence engine into one
// orchestrated flow:
//   Goal → Capabilities → Providers → Context → Strategy →
//   Execution Graph → Execution Session
// The pipeline PLANS and VALIDATES end-to-end readiness — it never
// executes. No AI calls. Every artifact is produced by the owning
// engine (goals, capabilities, providers, context, execution-strategy,
// execution-orchestrator) and merely composed here.
// ──────────────────────────────────────────────────────────────────

// ── Pipeline Stages (the INT-001 flow, in order) ───────────────────────────

export type PipelineStage =
  | 'goal'
  | 'capabilities'
  | 'providers'
  | 'context'
  | 'strategy'
  | 'execution-graph'
  | 'execution-session';

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'goal',
  'capabilities',
  'providers',
  'context',
  'strategy',
  'execution-graph',
  'execution-session',
] as const;

/** Human labels for each stage (used by the explainer + dashboard). */
export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  goal: 'Goal',
  capabilities: 'Capabilities',
  providers: 'Providers',
  context: 'Context',
  strategy: 'Execution Strategy',
  'execution-graph': 'Execution Graph',
  'execution-session': 'Execution Session',
};

// ── Step / Pipeline Status ─────────────────────────────────────────────────

export type PipelineStepStatus = 'passed' | 'failed' | 'skipped';

export type PipelineStatus = 'ready' | 'failed' | 'building';

// ── A single pipeline stage result ─────────────────────────────────────────

export interface EnterprisePipelineStep {
  /** Which engine stage this step covers. */
  stage: PipelineStage;
  status: PipelineStepStatus;
  /** Human-readable outcome for this step. */
  detail: string;
  /** Counts produced at this stage (e.g. capabilities: 4, providers: 3). */
  counts: Record<string, number>;
  /** Artifact ids resolved at this stage (capability ids, strategy id, …). */
  artifactIds: string[];
}

// ── Pipeline Validation ────────────────────────────────────────────────────

export interface PipelineValidationCheck {
  stage: PipelineStage;
  check: string;
  passed: boolean;
  detail: string;
}

export interface PipelineValidation {
  passed: boolean;
  checks: PipelineValidationCheck[];
  summary: string;
}

// ── The Enterprise Pipeline entity ─────────────────────────────────────────

export interface EnterprisePipelineArtifacts {
  /** Capability ids resolved during capability discovery. */
  capabilities: string[];
  /** Provider ids resolved during provider discovery. */
  providers: string[];
  /** Context items available at assembly time. */
  contextItems: number;
  /** Strategy id produced by the strategy stage. */
  strategyId?: string;
  /** Execution graph id produced by the graph stage. */
  graphId?: string;
  /** Execution session id produced by the session stage (never run). */
  sessionId?: string;
}

export interface EnterprisePipeline {
  pipelineId: string;
  goalId: string;
  /** Goal title snapshot. */
  goal: string;
  status: PipelineStatus;
  /** Ordered stage results (PIPELINE_STAGES order). */
  steps: EnterprisePipelineStep[];
  validation: PipelineValidation;
  artifacts: EnterprisePipelineArtifacts;
  createdAt: string;
  updatedAt: string;
}

// ── Build Input ────────────────────────────────────────────────────────────

export interface PipelineBuildInput {
  /** A goal known to the Goal & Task Intelligence Engine (EI-006/goals). */
  goalId: string;
}

// ── Explanation (PipelineExplainer output) ─────────────────────────────────

export interface PipelineStepExplanation {
  stage: PipelineStage;
  summary: string;
}

export interface PipelineExplanation {
  pipelineId: string;
  goal: string;
  /** One-line human sentence, e.g.
   *  "Goal requires 4 Capabilities, 3 Provider Candidates, 18 Context
   *   Items, 1 Execution Strategy, 1 Execution Graph — ready for execution." */
  headline: string;
  steps: PipelineStepExplanation[];
  ready: boolean;
}

// ── Summary (PipelineSummary output) ───────────────────────────────────────

export interface PipelineSummary {
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

// ── Engine Status (dashboard) ──────────────────────────────────────────────

export type IntelligenceEngine =
  | 'goals'
  | 'capabilities'
  | 'providers'
  | 'context'
  | 'execution-strategy'
  | 'execution-orchestrator';

export interface EngineStatus {
  engine: IntelligenceEngine;
  label: string;
  status: 'ready' | 'degraded' | 'unknown';
  summary: string;
  counts: Record<string, number>;
}
