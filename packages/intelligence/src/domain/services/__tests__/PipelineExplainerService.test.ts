// ──────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Pipeline Tests: PipelineExplainerService
// EI-006 / INT-001
// Verifies the human-readable explanation ("Goal requires 4
// Capabilities, 3 Provider Candidates, 18 Context Items, 1 Execution
// Strategy, 1 Execution Graph — ready for execution.").
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PipelineBuilderService } from '../PipelineBuilderService.js';
import { PipelineValidatorService } from '../PipelineValidatorService.js';
import { PipelineExplainerService } from '../PipelineExplainerService.js';
import { PIPELINE_STAGE_LABELS } from '../../../types/pipeline-types.js';
import { createTestEngines } from '../../../application/__tests__/test-engines.js';

describe('PipelineExplainerService', () => {
  it('generates the expected counts headline for a ready pipeline', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);
    const validator = new PipelineValidatorService();
    const explainer = new PipelineExplainerService();

    const pipeline = await builder.build({ goalId: 'goal_project_seed' });
    pipeline.validation = validator.validate(pipeline);
    const explanation = explainer.explain(pipeline);

    expect(explanation.ready).toBe(true);
    expect(explanation.goal).toContain('analytics dashboard');
    expect(explanation.headline).toContain(
      `${String(pipeline.artifacts.capabilities.length)} Capabilit`,
    );
    expect(explanation.headline).toContain(
      `${String(pipeline.artifacts.providers.length)} Provider Candidate`,
    );
    expect(explanation.headline).toContain(
      `${String(pipeline.artifacts.contextItems)} Context Item`,
    );
    expect(explanation.headline).toContain('1 Execution Strateg');
    expect(explanation.headline).toContain('1 Execution Graph');
    expect(explanation.headline).toContain('1 Session');
    expect(explanation.headline).toContain('ready for execution');
  });

  it('lists one summary line per pipeline stage', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);
    const explainer = new PipelineExplainerService();

    const pipeline = await builder.build({ goalId: 'goal_blog_seed' });
    const explanation = explainer.explain(pipeline);

    expect(explanation.steps).toHaveLength(7);
    for (const step of explanation.steps) {
      // Summaries are human-readable: `"<Stage label>: <status> — …"`.
      expect(step.summary).toContain(PIPELINE_STAGE_LABELS[step.stage]);
    }
  });

  it('reports not ready when validation failed', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);
    const validator = new PipelineValidatorService();
    const explainer = new PipelineExplainerService();

    const pipeline = await builder.build({ goalId: 'goal_learning_seed' });
    pipeline.artifacts.graphId = undefined;
    pipeline.steps = pipeline.steps.map((s) =>
      s.stage === 'execution-graph' ? { ...s, status: 'failed' as const } : s,
    );
    pipeline.validation = validator.validate(pipeline);

    const explanation = explainer.explain(pipeline);
    expect(explanation.ready).toBe(false);
    expect(explanation.headline).toContain('Pipeline incomplete');
  });

  it('marks absent strategy/graph/session artifacts as zero counts', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);
    const explainer = new PipelineExplainerService();

    const pipeline = await builder.build({ goalId: 'goal_career_seed' });
    // Strip the strategy/graph/session artifacts (pre-creation pipeline).
    delete pipeline.artifacts.strategyId;
    delete pipeline.artifacts.graphId;
    delete pipeline.artifacts.sessionId;

    const explanation = explainer.explain(pipeline);
    expect(explanation.headline).toContain('0 Execution Strateg');
    expect(explanation.headline).toContain('0 Execution Graph');
    expect(explanation.headline).toContain('0 Session');
  });

  it('renders a not-run summary for stages missing from the steps list', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);
    const explainer = new PipelineExplainerService();

    const pipeline = await builder.build({ goalId: 'goal_blog_seed' });
    // Keep only the first stage — the remaining six must render "not run".
    pipeline.steps = pipeline.steps.slice(0, 1);

    const explanation = explainer.explain(pipeline);
    expect(explanation.steps).toHaveLength(7);
    const notRun = explanation.steps.filter((s) => s.summary.endsWith('not run'));
    expect(notRun).toHaveLength(6);
  });
});
