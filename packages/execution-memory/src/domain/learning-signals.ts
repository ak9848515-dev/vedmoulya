// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Learning Signal Extraction (PHASE 4)
//
// Signals are derived DETERMINISTICALLY from actual execution evidence.
// Rules are hard-coded — never model-chosen:
//
//   - GOAL_* signals come ONLY from the frozen run outcome.
//   - SUCCESSFUL_PLAN requires the frozen outcome ACHIEVED **and**
//     at least one VERIFIED verification record (never model claims,
//     never unverified output, never UNKNOWN verdicts).
//   - TOOL_SUCCESS requires the action to have succeeded AND its step's
//     frozen verification verdict to be VERIFIED. An action that
//     succeeded but failed verification produces VERIFICATION_FAILURE —
//     NEVER TOOL_SUCCESS (Phase 17: ACTION_SUCCESS ≠ GOAL_SUCCESS).
//   - UNKNOWN verification NEVER produces a positive signal.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type {
  ExecutionRecord,
  LearningSignal,
  LearningSignalKind,
} from '../types/execution-memory-types.js';
import { LEARNING_SIGNALS } from '../types/execution-memory-types.js';

export const DEFAULT_TOOL_TIMEOUT_MS = 60_000;

export interface LearningSignalOptions {
  /** Latency above this marks a failed tool call TOOL_TIMEOUT. */
  toolTimeoutMs?: number;
}

function signal(
  kind: LearningSignalKind,
  record: ExecutionRecord,
  detail: string,
  observedAt: string,
): LearningSignal {
  return {
    signalId: `signal-${generateId()}`,
    kind,
    executionIds: [record.executionId],
    detail,
    observedAt,
  };
}

/** Deterministic interpretation of one execution record. */
export function extractLearningSignals(
  records: ExecutionRecord[],
  options: LearningSignalOptions = {},
): LearningSignal[] {
  const timeoutMs = options.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
  const signals: LearningSignal[] = [];
  const runRecord = records.find((r) => r.stepId === undefined) ?? records[0];
  if (runRecord === undefined) return signals;
  const observedAt = runRecord.observedAt;

  // ── Run-level signals (final outcome is the ONLY source) ─────────
  switch (runRecord.finalOutcome) {
    case 'ACHIEVED':
      signals.push(
        signal(
          'GOAL_ACHIEVED',
          runRecord,
          'run outcome ACHIEVED with frozen verification evidence',
          observedAt,
        ),
      );
      break;
    case 'BLOCKED':
      signals.push(
        signal('GOAL_BLOCKED', runRecord, runRecord.error ?? 'run outcome BLOCKED', observedAt),
      );
      break;
    case 'FAILED':
      signals.push(
        signal('GOAL_FAILED', runRecord, runRecord.error ?? 'run outcome FAILED', observedAt),
      );
      break;
    case 'PARTIALLY_ACHIEVED':
      signals.push(signal('PARTIAL_PLAN', runRecord, 'run outcome PARTIALLY_ACHIEVED', observedAt));
      break;
    default:
      break;
  }

  // ── Plan-level signals (verified evidence required) ─────────────
  if (runRecord.finalOutcome === 'ACHIEVED' && runRecord.verifiedEvidenceCount > 0) {
    signals.push(
      signal('SUCCESSFUL_PLAN', runRecord, 'goal achieved with VERIFIED step evidence', observedAt),
    );
  } else if (runRecord.finalOutcome === 'FAILED') {
    signals.push(
      signal(
        'FAILED_PLAN',
        runRecord,
        runRecord.error ?? 'plan failed after bounded execution',
        observedAt,
      ),
    );
  }

  // Replan evidence (bounded; caller-provided count).
  if (runRecord.replanCount > 0) {
    if (runRecord.finalOutcome === 'ACHIEVED') {
      signals.push(
        signal(
          'REPLAN_SUCCESS',
          runRecord,
          'replan led to a verified ACHIEVED outcome',
          observedAt,
        ),
      );
    } else if (runRecord.finalOutcome === 'FAILED' || runRecord.finalOutcome === 'BLOCKED') {
      signals.push(
        signal('REPLAN_FAILURE', runRecord, 'replan did not achieve the goal', observedAt),
      );
    }
  }

  // Recovery evidence at run level (attempts include bounded retries).
  if (runRecord.attempts > 0) {
    if (runRecord.finalOutcome === 'ACHIEVED') {
      signals.push(
        signal(
          'RECOVERY_SUCCESS',
          runRecord,
          `bounded recovery (${String(runRecord.attempts)} attempt(s)) reached a verified ACHIEVED outcome`,
          observedAt,
        ),
      );
    } else if (runRecord.finalOutcome === 'FAILED' || runRecord.finalOutcome === 'BLOCKED') {
      signals.push(
        signal(
          'RECOVERY_FAILURE',
          runRecord,
          `bounded recovery (${String(runRecord.attempts)} attempt(s)) did not achieve the goal`,
          observedAt,
        ),
      );
    }
  }

  if (runRecord.error !== undefined && runRecord.error.includes('LOOP_DETECTED')) {
    signals.push(
      signal(
        'LOOP_DETECTED',
        runRecord,
        'deterministic loop detection terminated the run',
        observedAt,
      ),
    );
  }

  // ── Action-level signals ─────────────────────────────────────────
  for (const record of records) {
    if (record.stepId === undefined) continue;

    // Verification evidence — verbatim from the frozen verdict.
    if (record.verificationVerdict === 'VERIFIED') {
      signals.push(
        signal(
          'VERIFICATION_SUCCESS',
          record,
          `step ${record.stepId} verified by frozen verification`,
          observedAt,
        ),
      );
    } else if (record.verificationVerdict === 'FAILED') {
      signals.push(
        signal(
          'VERIFICATION_FAILURE',
          record,
          `step ${record.stepId} failed frozen verification`,
          observedAt,
        ),
      );
    }
    // UNKNOWN → NO positive signal, NO negative signal from the verdict.

    // Tool evidence — TOOL_SUCCESS requires VERIFIED evidence.
    if (record.tool !== undefined) {
      if (record.actionStatus === 'denied') {
        signals.push(
          signal(
            'TOOL_PERMISSION_DENIED',
            record,
            `tool "${record.tool}" denied by the security policy`,
            observedAt,
          ),
        );
      } else if (record.actionStatus === 'failed') {
        if (record.latencyMs > timeoutMs) {
          signals.push(
            signal(
              'TOOL_TIMEOUT',
              record,
              `tool "${record.tool}" timed out after ${String(record.latencyMs)}ms`,
              observedAt,
            ),
          );
        } else {
          signals.push(signal('TOOL_FAILURE', record, `tool "${record.tool}" failed`, observedAt));
        }
      } else if (record.actionStatus === 'succeeded' && record.verificationVerdict === 'VERIFIED') {
        signals.push(
          signal(
            'TOOL_SUCCESS',
            record,
            `tool "${record.tool}" succeeded and its step was VERIFIED`,
            observedAt,
          ),
        );
      }
      // succeeded but not VERIFIED → no TOOL_SUCCESS (Phase 17).
    }

    // Model evidence — never from claims, only from recorded results.
    if (record.provider !== undefined || record.model !== undefined) {
      if (record.actionStatus === 'succeeded' && record.verificationVerdict === 'VERIFIED') {
        if (record.fallbackUsed) {
          signals.push(
            signal(
              'MODEL_FALLBACK_SUCCESS',
              record,
              'fallback model produced a VERIFIED outcome',
              observedAt,
            ),
          );
        } else {
          signals.push(
            signal(
              'MODEL_SUCCESS',
              record,
              `model ${record.model ?? record.provider} produced a VERIFIED outcome`,
              observedAt,
            ),
          );
        }
      } else if (record.actionStatus === 'failed' || record.actionStatus === 'blocked') {
        signals.push(
          signal(
            'MODEL_FAILURE',
            record,
            `model ${record.model ?? record.provider} failed`,
            observedAt,
          ),
        );
      }
    }

    // Recovery evidence at action level.
    if (record.recoveryStrategy !== undefined) {
      if (record.verificationVerdict === 'VERIFIED') {
        signals.push(
          signal(
            'RECOVERY_SUCCESS',
            record,
            `recovery strategy ${record.recoveryStrategy} led to a VERIFIED step`,
            observedAt,
          ),
        );
      } else if (record.verificationVerdict === 'FAILED') {
        signals.push(
          signal(
            'RECOVERY_FAILURE',
            record,
            `recovery strategy ${record.recoveryStrategy} did not verify the step`,
            observedAt,
          ),
        );
      }
    }
  }

  return signals;
}

export function isLearningSignalKind(value: string): value is LearningSignalKind {
  return (LEARNING_SIGNALS as readonly string[]).includes(value);
}
