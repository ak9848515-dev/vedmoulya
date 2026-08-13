// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: Summary Service
// EI-006 / INT-001
// Compact per-pipeline summaries + aggregate stats for the dashboard.
// ──────────────────────────────────────────────────────────────────

import type { EnterprisePipeline, PipelineSummary } from '../../types/pipeline-types.js';

export class PipelineSummaryService {
  summarize(pipeline: EnterprisePipeline): PipelineSummary {
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
  }

  aggregate(pipelines: EnterprisePipeline[]): {
    total: number;
    ready: number;
    failed: number;
  } {
    const ready = pipelines.filter((p) => p.status === 'ready').length;
    return {
      total: pipelines.length,
      ready,
      failed: pipelines.length - ready,
    };
  }
}
