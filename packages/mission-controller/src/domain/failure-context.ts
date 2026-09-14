// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: Failure Context for Replanning
// BLD-021A — AUTONOMY-02 — Failure-Informed Objective Replanning
//
// Structured, bounded, serializable failure context carried from a
// failed execution into the next planning attempt. Keeps the replanning
// loop informed about WHY the previous attempt failed without dumping
// arbitrary execution state, secrets, or unbounded output.
//
// This module re-exports FailureContext from mission-types and provides
// a factory function to create instances from classification results.
// ──────────────────────────────────────────────────────────────────

import type { MissionFailureClassification } from '../types/mission-types.js';
import type { FailureContext } from '../types/mission-types.js';
export type { FailureContext } from '../types/mission-types.js';

/**
 * Create a FailureContext from a classification and execution result.
 * Applies truncation to keep the context bounded.
 */
export function createFailureContext(
  classification: MissionFailureClassification,
  executionResult: {
    error?: string;
    output?: string;
    failureClass?: string;
    runId?: string;
    success: boolean;
    verified: boolean;
  },
  objective: {
    objectiveId: string;
    title: string;
    goalId?: string;
    planId?: string;
  },
  previousGoalId: string | undefined,
  revisionAttempt: number,
  clockNow: string,
  options?: {
    /** Maximum length for execution error. */
    maxErrorLength?: number;
    /** Maximum length for execution output. */
    maxOutputLength?: number;
    /** Maximum number of evidence items to keep. */
    maxEvidenceItems?: number;
  },
): FailureContext {
  const maxErrorLength = options?.maxErrorLength ?? 500;
  const maxOutputLength = options?.maxOutputLength ?? 1000;
  const maxEvidenceItems = options?.maxEvidenceItems ?? 10;

  return {
    failureClass: classification.failureClass,
    reason: classification.reason,
    suggestedAction: classification.suggestedAction,
    evidence: classification.evidence.slice(0, maxEvidenceItems),
    executionError:
      executionResult.error !== undefined
        ? executionResult.error.slice(0, maxErrorLength)
        : undefined,
    executionOutput:
      executionResult.output !== undefined
        ? executionResult.output.slice(0, maxOutputLength)
        : undefined,
    failedObjectiveId: objective.objectiveId,
    failedObjectiveTitle: objective.title,
    previousPlanId: objective.planId,
    previousGoalId: objective.goalId ?? previousGoalId,
    revisionAttempt,
    failedAt: clockNow,
    verificationResult: {
      verified: executionResult.verified,
      evidence: [],
      method: 'execution_verification',
    },
  };
}
