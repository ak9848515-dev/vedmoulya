// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: Explainer Service
// EI-006 / INT-001
// Generates human-readable explanations of a pipeline:
//   "Goal requires 4 Capabilities, 3 Provider Candidates, 18 Context
//    Items, 1 Execution Strategy, 1 Execution Graph — ready for execution."
// ──────────────────────────────────────────────────────────────────

import type {
  EnterprisePipeline,
  PipelineExplanation,
  PipelineStage,
} from '../../types/pipeline-types.js';
import { PIPELINE_STAGE_LABELS } from '../../types/pipeline-types.js';

export class PipelineExplainerService {
  explain(pipeline: EnterprisePipeline): PipelineExplanation {
    const byStage = new Map(pipeline.steps.map((s) => [s.stage, s]));

    const capabilityCount = pipeline.artifacts.capabilities.length;
    const providerCount = pipeline.artifacts.providers.length;
    const contextCount = pipeline.artifacts.contextItems;
    const strategyCount = pipeline.artifacts.strategyId ? 1 : 0;
    const graphCount = pipeline.artifacts.graphId ? 1 : 0;
    const sessionCount = pipeline.artifacts.sessionId ? 1 : 0;

    const ready = pipeline.validation.passed;

    const headline = ready
      ? `Goal requires ${String(capabilityCount)} Capabilit${capabilityCount === 1 ? 'y' : 'ies'}, ${String(providerCount)} Provider Candidate${providerCount === 1 ? '' : 's'}, ${String(contextCount)} Context Item${contextCount === 1 ? '' : 's'}, ${String(strategyCount)} Execution Strateg${strategyCount === 1 ? 'y' : 'ies'}, ${String(graphCount)} Execution Graph${graphCount === 1 ? '' : 's'}, ${String(sessionCount)} Session${sessionCount === 1 ? '' : 's'} — ready for execution.`
      : `Pipeline incomplete: ${pipeline.validation.summary}`;

    const steps = (Object.keys(PIPELINE_STAGE_LABELS) as PipelineStage[]).map((stage) => {
      const step = byStage.get(stage);
      return {
        stage,
        summary: step
          ? `${PIPELINE_STAGE_LABELS[stage]}: ${step.status} — ${step.detail}`
          : `${PIPELINE_STAGE_LABELS[stage]}: not run`,
      };
    });

    return {
      pipelineId: pipeline.pipelineId,
      goal: pipeline.goal,
      headline,
      steps,
      ready,
    };
  }
}
