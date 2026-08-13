// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Run Intelligence (PHASE 4)
// EPIC-014 — a derived VIEW over the run state (no new planning
// engine): current step, completed/failed/blocked/waiting/remaining,
// the execution boundary (where automation stops), provider/model used,
// quality results, cost/latency, failure reasons and the human-readable
// next action. Pure function of the run.
// ──────────────────────────────────────────────────────────────────

import type { ExecutionRun, RunIntelligence, StepRun } from '../types/execution-types.js';

const ACTIVE_STATES = new Set(['running', 'ready', 'pending']);

export class RunIntelligenceView {
  derive(run: ExecutionRun): RunIntelligence {
    const steps = run.steps;
    const completedSteps = steps.filter((s) => s.state === 'completed').map((s) => s.stepId);
    const failedSteps = steps.filter((s) => s.state === 'failed').map((s) => s.stepId);
    const blockedSteps = steps.filter((s) => s.state === 'blocked').map((s) => s.stepId);
    const waitingSteps = steps
      .filter((s) => s.state === 'waiting_approval' || s.state === 'waiting_input')
      .map((s) => s.stepId);
    const remainingSteps = steps.filter((s) => ACTIVE_STATES.has(s.state)).map((s) => s.stepId);
    const currentStep =
      steps.find((s) => s.state === 'running' || s.state === 'ready') ??
      steps.find((s) => s.state === 'pending');

    const providerModelUsed = steps
      .filter((s) => s.provider && s.state === 'completed')
      .map((s) => ({ stepId: s.stepId, provider: s.provider as string, model: s.model as string }));

    const qualityResults = steps
      .filter((s) => s.verification?.post)
      .map((s) => ({
        stepId: s.stepId,
        passed: s.verification?.post?.passed ?? false,
        checks: (s.verification?.post?.checks ?? []).map(
          (c) => `${c.name}:${c.passed ? 'pass' : 'fail'}`,
        ),
      }));

    const totalCostUsd = steps.reduce((sum, s) => sum + s.costUsd, 0);
    const totalLatencyMs = steps.reduce((sum, s) => sum + s.latencyMs, 0);
    const failureReasons = steps
      .filter((s) => s.failureReason)
      .map((s) => `${s.title}: ${s.failureReason as string}`);

    const executionBoundary = this.boundary(run);
    const nextAction = this.nextAction(run, executionBoundary, currentStep);

    return {
      currentStepId: currentStep?.stepId,
      completedSteps,
      failedSteps,
      blockedSteps,
      waitingSteps,
      remainingSteps,
      executionBoundary,
      providerModelUsed,
      qualityResults,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      totalLatencyMs,
      failureReasons,
      nextAction,
    };
  }

  private boundary(run: ExecutionRun): RunIntelligence['executionBoundary'] {
    if (run.status === 'BLOCKED') return 'blocked';
    if (run.status === 'WAITING_FOR_APPROVAL') return 'approval_required';
    if (run.status === 'CONFIGURE_REQUIRED') return 'configure_required';
    if (run.status === 'MANUAL_REQUIRED' || run.status === 'WAITING_FOR_INPUT')
      return 'manual_required';
    if (run.steps.some((s) => s.disposition === 'UNAVAILABLE' && s.state !== 'completed'))
      return 'unavailable_steps';
    if (run.steps.every((s) => s.state === 'completed')) return 'all_automated';
    return 'all_automated';
  }

  private nextAction(
    run: ExecutionRun,
    boundary: RunIntelligence['executionBoundary'],
    currentStep: StepRun | undefined,
  ): string | undefined {
    switch (boundary) {
      case 'approval_required': {
        const step = run.steps.find((s) => s.state === 'waiting_approval');
        return step
          ? `Approve “${step.title}” to resume execution.`
          : 'Approve the pending step to resume.';
      }
      case 'manual_required': {
        const step = run.steps.find(
          (s) => s.state === 'waiting_input' || s.state === 'manual_required',
        );
        return step
          ? `Complete “${step.title}” manually, then mark it done to resume.`
          : 'Complete the manual step to resume.';
      }
      case 'configure_required': {
        const step = run.steps.find((s) => s.state === 'configure_required');
        return step
          ? `Configure a provider for “${step.title}”, then mark it done to resume.`
          : 'Configure the required provider to resume.';
      }
      case 'blocked':
        return run.budget.failureReason
          ? `Execution blocked: ${run.budget.failureReason}.`
          : 'Execution is blocked — resolve the issue to continue.';
      default:
        return currentStep ? `Running “${currentStep.title}”.` : undefined;
    }
  }
}
