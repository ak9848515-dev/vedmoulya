// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: Validator Service
// EI-006 / INT-001
// Verifies the INT-001 contract end-to-end:
//   • capabilities exist
//   • providers exist
//   • context is available
//   • strategy is valid
//   • execution graph is valid
//   • execution session was created
// Explains failures per stage. Never executes.
// ──────────────────────────────────────────────────────────────────

import type {
  EnterprisePipeline,
  PipelineValidation,
  PipelineValidationCheck,
} from '../../types/pipeline-types.js';

export class PipelineValidatorService {
  /**
   * Validate a built pipeline. Checks are derived from the artifacts each
   * engine stage recorded, so a failure pinpoints the exact engine gap.
   */
  validate(pipeline: EnterprisePipeline): PipelineValidation {
    const checks: PipelineValidationCheck[] = [];
    const byStage = new Map(pipeline.steps.map((s) => [s.stage, s]));

    // 1. Goal resolved.
    const goalStep = byStage.get('goal');
    checks.push({
      stage: 'goal',
      check: 'Goal exists',
      passed: goalStep?.status === 'passed',
      detail:
        goalStep?.status === 'passed'
          ? `Goal resolved (${pipeline.goal}).`
          : `Goal could not be resolved (${pipeline.goalId}).`,
    });

    // 2. Capabilities exist.
    checks.push({
      stage: 'capabilities',
      check: 'Capabilities exist',
      passed: pipeline.artifacts.capabilities.length > 0,
      detail:
        pipeline.artifacts.capabilities.length > 0
          ? `${String(pipeline.artifacts.capabilities.length)} capability/capabilities registered.`
          : 'No capabilities were resolved for the goal.',
    });

    // 3. Providers exist.
    checks.push({
      stage: 'providers',
      check: 'Providers exist',
      passed: pipeline.artifacts.providers.length > 0,
      detail:
        pipeline.artifacts.providers.length > 0
          ? `${String(pipeline.artifacts.providers.length)} provider candidate(s) registered.`
          : 'No provider candidates were found for the required capabilities.',
    });

    // 4. Context available.
    checks.push({
      stage: 'context',
      check: 'Context available',
      passed: pipeline.artifacts.contextItems > 0,
      detail:
        pipeline.artifacts.contextItems > 0
          ? `${String(pipeline.artifacts.contextItems)} context item(s) available.`
          : 'No context items available for assembly.',
    });

    // 5. Strategy valid.
    const strategyValid =
      pipeline.artifacts.strategyId !== undefined && byStage.get('strategy')?.status === 'passed';
    checks.push({
      stage: 'strategy',
      check: 'Strategy valid',
      passed: strategyValid,
      detail: strategyValid
        ? `Execution strategy ${String(pipeline.artifacts.strategyId)} created and validated.`
        : 'No valid execution strategy was produced.',
    });

    // 6. Execution graph valid.
    const graphValid =
      pipeline.artifacts.graphId !== undefined &&
      byStage.get('execution-graph')?.status === 'passed';
    checks.push({
      stage: 'execution-graph',
      check: 'Execution graph valid',
      passed: graphValid,
      detail: graphValid
        ? `Execution graph ${String(pipeline.artifacts.graphId)} validated.`
        : 'No valid execution graph was produced.',
    });

    // 7. Session created.
    const sessionCreated =
      pipeline.artifacts.sessionId !== undefined &&
      byStage.get('execution-session')?.status === 'passed';
    checks.push({
      stage: 'execution-session',
      check: 'Session created',
      passed: sessionCreated,
      detail: sessionCreated
        ? `Execution session ${String(pipeline.artifacts.sessionId)} created (ready, not running).`
        : 'No execution session was created.',
    });

    const passed = checks.every((c) => c.passed);
    const failedCount = checks.filter((c) => !c.passed).length;
    const summary = passed
      ? 'All INT-001 stages passed — the goal is ready for execution.'
      : `${String(failedCount)} INT-001 stage(s) failed: ${checks
          .filter((c) => !c.passed)
          .map((c) => c.check)
          .join(', ')}.`;

    return { passed, checks, summary };
  }
}
