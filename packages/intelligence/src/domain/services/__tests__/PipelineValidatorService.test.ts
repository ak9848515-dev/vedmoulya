// ──────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Pipeline Tests: PipelineValidatorService
// EI-006 / INT-001
// Verifies the seven INT-001 checks: capabilities exist, providers
// exist, context available, strategy valid, graph valid, session
// created — and that failures are explained per stage.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PipelineBuilderService } from '../PipelineBuilderService.js';
import { PipelineValidatorService } from '../PipelineValidatorService.js';
import { createTestEngines } from '../../../application/__tests__/test-engines.js';

describe('PipelineValidatorService', () => {
  it('passes a fully built pipeline with all seven checks', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);
    const validator = new PipelineValidatorService();

    const pipeline = await builder.build({ goalId: 'goal_blog_seed' });
    const validation = validator.validate(pipeline);

    expect(validation.passed).toBe(true);
    expect(validation.checks).toHaveLength(7);
    for (const check of validation.checks) {
      expect(check.passed).toBe(true);
    }
    expect(validation.summary).toContain('ready for execution');
  });

  it('fails the capabilities check when no capabilities are resolved', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);
    const validator = new PipelineValidatorService();

    const pipeline = await builder.build({ goalId: 'goal_blog_seed' });
    pipeline.artifacts.capabilities = [];
    pipeline.steps = pipeline.steps.map((s) =>
      s.stage === 'capabilities' ? { ...s, status: 'failed' as const } : s,
    );

    const validation = validator.validate(pipeline);
    expect(validation.passed).toBe(false);
    const check = validation.checks.find((c) => c.stage === 'capabilities');
    expect(check?.passed).toBe(false);
    expect(check?.detail).toContain('No capabilities');
  });

  it('explains a missing session as a failure', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);
    const validator = new PipelineValidatorService();

    const pipeline = await builder.build({ goalId: 'goal_career_seed' });
    pipeline.artifacts.sessionId = undefined;
    pipeline.steps = pipeline.steps.map((s) =>
      s.stage === 'execution-session' ? { ...s, status: 'failed' as const } : s,
    );

    const validation = validator.validate(pipeline);
    expect(validation.passed).toBe(false);
    const check = validation.checks.find((c) => c.stage === 'execution-session');
    expect(check?.passed).toBe(false);
    expect(validation.summary).toContain('1 INT-001 stage(s) failed');
  });
});
