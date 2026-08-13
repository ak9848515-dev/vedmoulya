// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · LearningSignals
// SPRINT-025 — Continuous Learning, Outcome Memory & Adaptive Improvement
//
// PURE, deterministic derivation of structured learning signals from a
// REAL, VERIFIED outcome. There is no new engine here: this composes
// the frozen outcome model (BrainTask) with the SPRINT-024 honest
// verdict into the FACT / INFERENCE / UNKNOWN vocabulary.
//
// Honesty invariants:
//   - FACT     = an observation backed by execution AND verification
//                evidence (verification passed / definitive failure).
//   - INFERENCE= a pattern drawn from observations — low confidence,
//                never promoted to a permanent belief.
//   - UNKNOWN  = insufficient/contradictory evidence — recorded so the
//                feed can honestly show "cannot learn from this yet".
//   - UNKNOWN verdict NEVER yields a FACT signal.
//   - Provider text output is NEVER trusted as user fact — signals are
//     evidence-gated and advisory only.
// ──────────────────────────────────────────────────────────────────

import type { BrainTask } from '../types/brain-types.js';
import type { LearningSignal, LearningSignalKind } from '../types/continuous-types.js';
import type { OutcomeVerdict } from './OutcomeVerdict.js';

/** Bounds applied by the pure deriver (defense in depth, not policy). */
export const MAX_SIGNALS_PER_OUTCOME = 12;
export const INFERRED_SIGNAL_CONFIDENCE = 0.4;
export const FACT_SIGNAL_CONFIDENCE = 0.9;

export interface DeriveSignalsInput {
  task: BrainTask;
  verdict: OutcomeVerdict;
  /** Whether the SPRINT-024 independent verification passed (optional). */
  verificationPassed?: boolean;
  /** Whether verification produced a definitive FAIL. */
  verificationFailed?: boolean;
  capturedAt: string;
}

/** One provider outcome row reduced to a signal fact (no sensitive content). */
interface ProviderSignalRow {
  providerId: string;
  capability: string;
  role: string;
  succeeded: boolean;
}

function providerRows(task: BrainTask): ProviderSignalRow[] {
  return task.providerOutputs.map((o) => ({
    providerId: o.providerId,
    capability: o.capability,
    role: o.role,
    succeeded: o.output.length > 0 && o.output !== 'ABSTAINED',
  }));
}

/**
 * Derive the deterministic learning signals for one REAL outcome.
 * The verdict (SPRINT-024) gates what may become a FACT:
 *   - SUCCESS + verificationPassed   → verified FACTs about what worked.
 *   - FAILED (definitive)            → verified FACTs about what failed.
 *   - UNKNOWN                        → UNKNOWN signal only — never a FACT,
 *                                       never an optimistic INFERENCE.
 *   - AWAITING_APPROVAL / CANCELLED / BUDGET_EXHAUSTED → UNKNOWN/neutral
 *     signals (no outcome evidence exists yet).
 */
export function deriveLearningSignals(input: DeriveSignalsInput): LearningSignal[] {
  const { task, verdict, verificationPassed, verificationFailed, capturedAt } = input;
  // NOTE (SPRINT-025, deliberate semantic): the CALLER decides what counts as
  // a definitive verification failure. BrainApplicationService maps
  // verification.passed === false → verificationFailed, because the Brain's
  // own verify() checks (execution completed / no abstention / evidence /
  // conflicts) are each DEFINITIVE gate failures — an abstention or missing
  // output is a definitive execution failure, not merely inconclusive.
  // Artifact-level inconclusive evidence (SPRINT-024) stays UNKNOWN via the
  // verdict, never reaching the FAILED path here.
  const signals: LearningSignal[] = [];
  const push = (fact: string, kind: LearningSignalKind, confidence: number, evidence: string[]): void => {
    if (signals.length >= MAX_SIGNALS_PER_OUTCOME) return;
    signals.push({
      fact,
      kind,
      source: 'INFERRED',
      confidence,
      evidence: evidence.slice(0, 4),
      provenance: `task:${task.id}`,
      capturedAt,
    });
  };

  const verifiedOk = verdict === 'SUCCESS' && verificationPassed === true;
  const verifiedFailed = verdict === 'FAILED' && verificationFailed === true;

  if (verdict === 'UNKNOWN' || verdict === 'AWAITING_APPROVAL' || verdict === 'CANCELLED') {
    push(
      verdict === 'UNKNOWN'
        ? 'Outcome could not be verified — no learning signal can be drawn from this task yet.'
        : `Task is ${verdict} — no completed outcome evidence to learn from.`,
      'UNKNOWN',
      0.5,
      ['verdict is ' + verdict],
    );
    return signals;
  }

  if (verdict === 'BUDGET_EXHAUSTED') {
    push(
      'Task stopped at the execution budget — the run was bounded, no success claim is made.',
      'UNKNOWN',
      0.7,
      ['budget stop recorded'],
    );
    return signals;
  }

  const rows = providerRows(task);

  // Verified FACTs — evidence-gated (execution + verification).
  if (verifiedOk) {
    for (const row of rows) {
      if (!row.succeeded) continue;
      push(
        `${row.providerId} succeeded for ${row.capability} (${row.role}) with independent verification.`,
        'FACT',
        FACT_SIGNAL_CONFIDENCE,
        ['verification passed', 'output recorded'],
      );
    }
  } else if (verifiedFailed) {
    for (const row of rows) {
      if (row.succeeded) continue;
      push(
        `${row.providerId} failed for ${row.capability} (${row.role}) and verification confirmed the failure.`,
        'FACT',
        FACT_SIGNAL_CONFIDENCE,
        ['verification failed', 'output missing or invalid'],
      );
    }
  }

  // Weak INFERENCEs — one observation, low confidence, never a belief.
  for (const row of rows) {
    if (verifiedOk && row.succeeded) {
      push(
        `${row.providerId} may be a good fit for future ${row.capability} tasks.`,
        'INFERENCE',
        INFERRED_SIGNAL_CONFIDENCE,
        ['single verified success'],
      );
    } else if (verifiedFailed && !row.succeeded) {
      push(
        `${row.providerId} may need an alternative for ${row.capability} — consider other providers.`,
        'INFERENCE',
        INFERRED_SIGNAL_CONFIDENCE,
        ['single verified failure'],
      );
    }
  }

  // Failover occurrence is a FACT when recorded (bounded evidence).
  for (const event of task.failoverEvents.slice(0, 3)) {
    push(
      `${event.failedProviderId} failed and failed over to ${event.fallbackProviderId} for ${event.capability}.`,
      'FACT',
      0.85,
      [`failure class: ${event.failureClass}`],
    );
  }

  if (signals.length === 0) {
    push(
      'No provider evidence produced a learning signal for this outcome.',
      'UNKNOWN',
      0.5,
      ['no executable provider outputs'],
    );
  }

  return signals;
}

/** Corrections are EXPLICIT user input — the ONLY signal source that is never inferred. */
export function correctionSignal(correction: {
  statement: string;
  target: 'approach' | 'provider' | 'result' | 'preference';
  providerId?: string;
  confidence: number;
  capturedAt: string;
  provenance: string;
}): LearningSignal {
  const scope =
    correction.target === 'provider' && correction.providerId
      ? ` regarding ${correction.providerId}`
      : '';
  return {
    fact: `${correction.target} correction${scope}: ${correction.statement}`,
    kind: 'FACT',
    source: 'EXPLICIT',
    confidence: correction.confidence,
    evidence: ['explicit user correction'],
    provenance: correction.provenance,
    capturedAt: correction.capturedAt,
  };
}
