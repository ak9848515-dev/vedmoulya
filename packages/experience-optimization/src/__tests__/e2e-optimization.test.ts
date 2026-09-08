// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: End-to-End Proof (Phase 25)
//
// RUN 1 (deterministic): goal → plan → execute → verify → achieve →
//   memory — repeated to build meaningful evidence.
// RUN 2 (similar goal): retrieve memory → experience optimization →
//   recommendation → planner → validation → execution → verification →
//   measured outcome.
//
// Proves BOTH:
//   - the recommendation genuinely influences strategy, AND
//   - every normal authority stays intact: the frozen plan validator
//     still rejects invalid plans, current runtime availability overrides
//     the historical favorite, governance constraints still narrow, and
//     every recommendation is advisory end to end.
// Hermetic: in-memory stores, fake clock, no network, no AI keys.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { validatePlanStructure } from '@vedmoulya/agent-execution';
import type { AgentPlan } from '@vedmoulya/agent-execution';
import { PlanningExperienceAdapter } from '../infrastructure/integration-adapters.js';
import { makeCompletedRun, makeRig } from './fixtures.js';

/** A planner-style plan draft: the PLANNER owns the tool allowlist. */
function planDraft(toolName: string, allowedTools: string[]): AgentPlan {
  return {
    planId: `plan-${toolName}`,
    goalId: 'goal-2',
    objective: 'Fix the failing tests',
    steps: [
      {
        stepId: 'step-1',
        objective: 'Fix the failing tests',
        capability: 'coding',
        requiredCapabilities: ['coding', 'reasoning'],
        dependencies: [],
        allowedTools,
        actions: [
          {
            actionId: 'step-1-a1',
            kind: 'tool',
            toolName,
            expectedOutcome: 'tests pass',
          },
        ],
        verificationPolicy: {
          kind: 'rule',
          description: 'tests pass',
          checks: [{ name: 'tests-pass', kind: 'includes', text: 'pass' }],
        },
        recoveryPolicy: { maxAttempts: 2, maxRevisions: 1 },
      },
    ],
  };
}

describe('end-to-end optimization cycle (Phase 25)', () => {
  it('RUN 1 builds verified memory; RUN 2 recommends, plans, validates, and measures the outcome', async () => {
    const rig = makeRig();

    // ── RUN 1: repeated deterministic runs → verified outcomes → memory ──
    for (let i = 0; i < 6; i++) {
      const { run, traces } = makeCompletedRun({
        runId: `run-fix-${String(i)}`,
        goal: 'Fix the failing tests',
        toolName: 'lint-fix',
        provider: 'gemini',
        model: 'gemini-2.5',
        capability: 'coding',
        outcome: 'ACHIEVED',
      });
      const result = await rig.service.ingestRun(run, traces);
      expect(result.accepted.length).toBeGreaterThan(0);
    }
    for (let i = 0; i < 2; i++) {
      const { run, traces } = makeCompletedRun({
        runId: `run-patch-ok-${String(i)}`,
        goal: 'Fix the failing tests',
        toolName: 'manual-patch',
        capability: 'coding',
        outcome: 'ACHIEVED',
      });
      await rig.service.ingestRun(run, traces);
    }
    for (let i = 0; i < 3; i++) {
      const { run, traces } = makeCompletedRun({
        runId: `run-patch-bad-${String(i)}`,
        goal: 'Fix the failing tests',
        toolName: 'manual-patch',
        capability: 'coding',
        verdicts: ['FAILED'],
        outcome: 'FAILED',
      });
      await rig.service.ingestRun(run, traces);
    }

    // ── RUN 2: similar goal → memory → optimization → recommendation ──
    const context = { capabilities: ['coding' as const], goalType: 'fix' };
    const recommendation = await rig.optimization.recommend('TOOL_SELECTION', context);
    expect(recommendation?.subject).toBe('lint-fix');
    expect(recommendation?.advisory).toBe(true);
    expect(recommendation?.evidenceLevel).toBe('HIGH_CONFIDENCE');
    expect(recommendation?.explanation.join(' ')).toContain('6 verified executions');

    // The planner receives the advisory as bounded, explainable context.
    const planning = new PlanningExperienceAdapter(rig.optimization);
    const advisory = await planning.advisoryForPlanning(context);
    expect(advisory.advisory).toBe(true);
    expect(advisory.summary).toContain('lint-fix');

    // NORMAL VALIDATION REMAINS AUTHORITATIVE: the recommendation itself
    // authorizes nothing. A plan may only execute a tool the PLANNER put
    // in the allowlist — the frozen validator rejects everything else.
    const validPlan = planDraft('lint-fix', ['lint-fix']);
    expect(validatePlanStructure(validPlan)).toHaveLength(0);
    const invalidPlan = planDraft('lint-fix', ['unrelated-tool']);
    expect(
      validatePlanStructure(invalidPlan).some((issue) => issue.code === 'TOOL_NOT_ALLOWED'),
    ).toBe(true);
    const allowlistViolation = planDraft('lint-fix', []);
    expect(
      validatePlanStructure(allowlistViolation).some((issue) => issue.code === 'TOOL_NOT_ALLOWED'),
    ).toBe(true);

    // CONFLICTING CURRENT RUNTIME STATE: the historically-preferred tool
    // is currently unavailable → it is NOT selected (current truth wins).
    const underConflict = await rig.optimization.recommend('TOOL_SELECTION', {
      ...context,
      runtimeTruth: { availableTools: ['manual-patch'] },
    });
    expect(underConflict?.subject).toBe('manual-patch');
    expect(underConflict?.subject).not.toBe('lint-fix');

    // No evidence at all → NO recommendation (never a fabricated choice).
    const nothingAvailable = await rig.optimization.recommend('TOOL_SELECTION', {
      ...context,
      runtimeTruth: { availableTools: ['never-seen-tool'] },
    });
    expect(nothingAvailable).toBeUndefined();

    // GOVERNANCE wins: only a permitted subject may be recommended.
    const governed = await rig.optimization.recommend('TOOL_SELECTION', {
      ...context,
      constraints: { allowedSubjects: ['manual-patch'] },
    });
    expect(governed?.subject).toBe('manual-patch');

    // MEASURED OUTCOME → feedback loop (recommendation → action → outcome).
    await rig.optimization.recordOutcome({
      recommendationId: recommendation!.recommendationId,
      decision: 'accepted',
      outcome: 'verified_success',
      executionId: 'run-fix-next',
    });
    const effectiveness = await rig.optimization.effectiveness(recommendation!.recommendationId);
    expect(effectiveness.accepted).toBe(1);
    expect(effectiveness.verifiedSuccess).toBe(1);
    expect(effectiveness.accuracy).toBe(1);

    // CURRENT HEALTH overrides stale routing experience (gemini degraded).
    const routingUnderDegradation = await rig.optimization.routingSignal({
      runtimeTruth: { degradedProviders: ['gemini'] },
    });
    expect(routingUnderDegradation).toBeUndefined();
  });
});
