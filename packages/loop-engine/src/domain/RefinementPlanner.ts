// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: Refinement Planner
// EPIC-006 — Phase 7. Decides WHY another iteration is necessary and
// WHAT specialist shape the next iteration needs. It never simply
// calls the same model repeatedly:
//   missing evidence  → RAG task            (retrieve_more_evidence)
//   weak reasoning    → reasoning task      (reason_deeper)
//   bad output        → regeneration        (fix_output)
//   conflicting ev.   → verification task   (verify_conflict)
//   invalid output    → structured fix      (fix_output)
//   missing requir.   → clarification       (clarification_required)
// Also maps the termination decision (Phase 12) explicitly.
// ──────────────────────────────────────────────────────────────────

import type {
  CriticAssessment,
  EvidenceState,
  LoopBudgetUsage,
  RefinementDecision,
} from '../types/loop-types.js';

export interface RefinementPlannerInput {
  critic: CriticAssessment;
  evidenceStates: EvidenceState[];
  usage: LoopBudgetUsage;
  maxIterations: number;
  /** True when the goal explicitly requires evidence (grounding). */
  groundingRequired: boolean;
  /** Whether a tool was denied during this iteration (security). */
  toolDenied?: boolean;
  /** Whether a tool failed during this iteration. */
  toolFailed?: boolean;
  /** Whether a provider call failed during this iteration. */
  providerFailed?: boolean;
}

export class RefinementPlanner {
  decide(input: RefinementPlannerInput): RefinementDecision {
    const { critic } = input;

    // 1. PASS → done (verify the answer, then complete).
    if (critic.verdict === 'PASS') {
      return {
        action: 'finish',
        reason: `Critic verdict PASS (${critic.reasons.join('; ')}) — quality/evidence criteria satisfied.`,
      };
    }

    // 2. Security / tool / provider failures → hard stops (never retried
    //    into a security hole).
    if (input.toolDenied) {
      return {
        action: 'stop',
        reason: 'A tool call was denied by the security policy. The loop refuses to continue.',
        terminationReason: 'SECURITY_BLOCK',
      };
    }
    if (input.toolFailed) {
      return {
        action: 'stop',
        reason:
          'A tool call failed (timeout/rate-limit/validation). The loop cannot complete reliably.',
        terminationReason: 'TOOL_FAILURE',
      };
    }
    if (input.providerFailed) {
      return {
        action: 'stop',
        reason: 'A specialist (provider) call failed after retries. Terminating the run.',
        terminationReason: 'PROVIDER_FAILURE',
      };
    }

    // 3. Evidence problems (Phase 6).
    const lastState = input.evidenceStates[input.evidenceStates.length - 1];
    if (input.groundingRequired && lastState === 'CONFLICTING_EVIDENCE') {
      return this.canRetry(input)
        ? {
            action: 'verify_conflict',
            reason: `Evidence is conflicting (${lastState}). Investigating the conflict before continuing.`,
          }
        : {
            action: 'stop',
            reason: 'Evidence is conflicting and no budget/iterations remain to investigate it.',
            terminationReason: 'EVIDENCE_CONFLICT',
          };
    }
    if (input.groundingRequired && lastState === 'INSUFFICIENT_EVIDENCE') {
      return this.canRetry(input)
        ? {
            action: 'retrieve_more_evidence',
            reason: `Evidence is insufficient (${lastState}). Retrieving more focused evidence (Phase 6).`,
          }
        : {
            action: 'stop',
            reason: 'Evidence is insufficient and no budget/iterations remain to retrieve more.',
            terminationReason: 'EVIDENCE_INSUFFICIENT',
          };
    }

    // 4. Missing requirements → the loop cannot guess: ask the user.
    const missingRequirement = critic.checks.some(
      (c) => c.name === 'requirement' && !c.passed && c.severity === 'critical',
    );
    if (missingRequirement) {
      return {
        action: 'clarification_required',
        reason:
          'A required input is missing and cannot be derived from the goal. Asking the user for clarification.',
        terminationReason: 'USER_CLARIFICATION_REQUIRED',
      };
    }

    // 5. Validation/format/schema defects → regenerate with the findings.
    const validationFailed =
      critic.checks.some((c) => c.name === 'schema' || c.name === 'format') &&
      critic.verdict === 'FAIL';
    if (validationFailed || critic.verdict === 'FAIL') {
      return this.canRetry(input)
        ? {
            action: 'fix_output',
            reason: `Critic verdict FAIL (${critic.reasons.join('; ')}) — regenerating the output with the findings.`,
          }
        : this.exhaustedDecision('Critic verdict FAIL and no iterations remain to refine further.');
    }

    // 6. PARTIAL → adapt by the weakest check.
    if (critic.verdict === 'PARTIAL') {
      const weakest = critic.checks
        .filter((c) => !c.passed)
        .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));
      const failedNames = new Set(weakest.map((c) => c.name));
      if (this.canRetry(input)) {
        if (failedNames.has('evidence') && input.groundingRequired) {
          return {
            action: 'retrieve_more_evidence',
            reason: 'Critic verdict PARTIAL — evidence checks failed. Retrieving more evidence.',
          };
        }
        if (failedNames.has('reasoning')) {
          return {
            action: 'reason_deeper',
            reason:
              'Critic verdict PARTIAL — reasoning checks failed. Running a deeper reasoning pass.',
          };
        }
        if (
          failedNames.has('completion') ||
          failedNames.has('constraint') ||
          failedNames.has('schema')
        ) {
          return {
            action: 'fix_output',
            reason:
              'Critic verdict PARTIAL — completion/constraint/schema checks failed. Regenerating the output.',
          };
        }
        return {
          action: 'fix_output',
          reason: `Critic verdict PARTIAL (${critic.reasons.join('; ')}) — refining the output.`,
        };
      }
      return this.exhaustedDecision('Critic verdict PARTIAL and no iterations remain to refine.');
    }

    // 7. ABSTAIN without a clear evidence signal → evidence problem.
    return {
      action: 'stop',
      reason: 'The critic abstained and no evidence path could resolve the run.',
      terminationReason:
        lastState === 'CONFLICTING_EVIDENCE' ? 'EVIDENCE_CONFLICT' : 'EVIDENCE_INSUFFICIENT',
    };
  }

  /** The iteration limit must still allow another refinement cycle. */
  private canRetry(input: RefinementPlannerInput): boolean {
    return input.usage.iterations + 1 <= input.maxIterations;
  }

  /** No iterations remain → explicit ITERATION_LIMIT (never silent). */
  private exhaustedDecision(reason: string): RefinementDecision {
    return {
      action: 'stop',
      reason,
      terminationReason: 'ITERATION_LIMIT',
    };
  }
}
