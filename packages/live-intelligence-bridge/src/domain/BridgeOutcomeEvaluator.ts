// ──────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge · BridgeOutcomeEvaluator
// EPIC-017 § Phase 9 — RESULT EVALUATION.
//
// Converts the EPIC-014 execution run (steps, verification, budget,
// provider outputs) into STRUCTURED outcome evidence — task
// completion, quality, accuracy, validation, failures, provider
// performance, latency, cost, reliability, user approval. No hidden
// chain-of-thought; no fabricated quality claims (UNKNOWN first-class).
// ──────────────────────────────────────────────────────────────────

import type { ExecutionRun } from '@vedmoulya/execution-bridge';
import type { BridgeOutcomeEvaluation } from '../types/bridge-types.js';

export interface OutcomeInput {
  run: ExecutionRun;
  userApproval: 'GRANTED' | 'REJECTED' | 'NOT_REQUIRED';
  /** Whether the recommended capability was the one that executed. */
  recommendedCapabilityUsed: boolean;
  evaluatedAt: string;
}

export type OutcomeResult = BridgeOutcomeEvaluation & {
  _summary: {
    completed: number;
    failed: number;
    blocked: number;
    manualOrGated: number;
    budgetExceeded: boolean;
    executionState: string;
  };
};

export class BridgeOutcomeEvaluator {
  evaluate(input: OutcomeInput): OutcomeResult {
    const { run } = input;
    const steps = run.steps;

    const completed = steps.filter((s) => s.state === 'completed');
    const failed = steps.filter((s) => s.state === 'failed');
    const blocked = steps.filter((s) => s.state === 'blocked');
    // Blocked steps (budget/dependency/security gates) are honest failures —
    // never hidden behind a partial-completion label.
    const failures = [
      ...failed.map((s) => `${s.title}: ${s.failureReason ?? 'failed'}`),
      ...blocked.map((s) => `${s.title}: ${s.failureReason ?? 'blocked'}`),
    ];
    const manual = steps.filter(
      (s) =>
        s.state === 'manual_required' ||
        s.state === 'configure_required' ||
        s.state === 'waiting_approval',
    );

    const totalLatency = steps.reduce((sum, s) => sum + s.latencyMs, 0);
    const totalCost = steps.reduce((sum, s) => sum + s.costUsd, 0);

    const taskCompleted = run.status === 'COMPLETED' && failed.length === 0;

    // Verification evidence: a step with verification.post.passed is verified.
    const verified = steps.filter((s) => s.verification?.post?.passed === true);
    const validationFailed = steps.some((s) => s.verification?.post?.passed === false);
    const validation = validationFailed
      ? 'FAILED'
      : verified.length > 0
        ? 'PASSED'
        : steps.length === 0
          ? 'NOT_RUN'
          : 'UNKNOWN';

    const quality: 'EXCELLENT' | 'GOOD' | 'ADEQUATE' | 'POOR' | 'UNKNOWN' =
      taskCompleted && verified.length === completed.length && failed.length === 0
        ? 'GOOD'
        : taskCompleted
          ? 'ADEQUATE'
          : failed.length > 0 || blocked.length > 0
            ? 'POOR'
            : 'UNKNOWN';

    const accuracy: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' =
      validation === 'PASSED' ? 'HIGH' : validation === 'FAILED' ? 'LOW' : 'UNKNOWN';

    const reliability: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' =
      failed.length === 0 && blocked.length === 0
        ? run.budget.exceeded
          ? 'MEDIUM'
          : 'HIGH'
        : failed.length > 0
          ? 'LOW'
          : 'UNKNOWN';

    return {
      taskCompleted,
      quality,
      accuracy,
      validation,
      failures,
      providerPerformance: completed.map((s) => ({
        provider: s.provider ?? 'unknown',
        role: s.title,
        succeeded: true,
        latencyMs: s.latencyMs,
        costUsd: s.costUsd,
      })),
      latencyMs: totalLatency,
      costUsd: totalCost,
      reliability,
      userApproval: input.userApproval,
      chosenCapabilityPerformedBetter:
        input.recommendedCapabilityUsed && taskCompleted && verified.length === completed.length
          ? true
          : input.recommendedCapabilityUsed && !taskCompleted
            ? false
            : 'UNKNOWN',
      evaluatedAt: input.evaluatedAt,
      _summary: {
        completed: completed.length,
        failed: failed.length,
        blocked: blocked.length,
        manualOrGated: manual.length,
        budgetExceeded: run.budget.exceeded,
        executionState: run.status,
      },
    };
  }
}
