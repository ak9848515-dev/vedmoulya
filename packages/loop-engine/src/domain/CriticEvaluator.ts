// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: Critic / Evaluator
// EPIC-006 — Phase 5. Every complex goal has an explicit evaluation
// stage. The critic checks: task completion, evidence sufficiency,
// correctness signals, contradictions, unsupported claims, constraint
// satisfaction, output schema, security and requested format — and
// returns PASS | FAIL | PARTIAL | ABSTAIN.
//
// The critic is DETERMINISTIC (no LLM) by default: it measures what
// the EvidenceEvaluator measured and what the output demonstrably
// contains. A model critique (a different capability/model through the
// runtime) is an optional Phase 5 enhancement recorded in the trace —
// the loop never lets the same model blindly declare its own answer
// correct, because the deterministic gate always runs first.
// ──────────────────────────────────────────────────────────────────

import { StructuredOutputValidator } from '@vedmoulya/services';
import type { EvidenceState } from '@vedmoulya/services';
import type {
  CriticAssessment,
  CriticCheck,
  CriticVerdict,
  SuccessCriterion,
} from '../types/loop-types.js';

export interface CriticEvaluatorInput {
  /** The accumulated output being evaluated. */
  output: string;
  /** Success criteria with deterministic section checks. */
  successCriteria: SuccessCriterion[];
  /** Evidence state measured by the runtime (when grounding was required). */
  evidenceState?: EvidenceState;
  groundingRequired?: boolean;
  /** Optional expected JSON schema (checked via StructuredOutputValidator). */
  expectedSchema?: Record<string, unknown>;
  /** Optional max output tokens (constraint check). */
  maxOutputTokens?: number;
  /** Optional expected format. */
  format?: 'text' | 'markdown' | 'code' | 'json';
  /** Whether a tool was denied (security check). */
  toolDenied?: boolean;
}

/** Rough deterministic token estimate (matches the runtime's 4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class CriticEvaluator {
  private readonly validator = new StructuredOutputValidator();

  evaluate(input: CriticEvaluatorInput): CriticAssessment {
    const checks: CriticCheck[] = [];
    const output = input.output;
    const groundingRequired = input.groundingRequired === true;

    // 1. Task completion — an empty deliverable can never pass.
    checks.push(
      this.check(
        'completion',
        output.trim().length > 0,
        output.trim().length > 0 ? 'output is non-empty' : 'output is empty',
        'critical',
      ),
    );

    // 2. Evidence sufficiency + unsupported claims (Phase 6).
    const state = input.evidenceState;
    if (groundingRequired) {
      if (state === 'SUFFICIENT_EVIDENCE' || state === 'PARTIAL_EVIDENCE') {
        checks.push(this.check('evidence', true, `evidence ${state} — grounded`, 'critical'));
        checks.push(
          this.check(
            'unsupported_claims',
            true,
            'claims are supported by retrieved evidence',
            'critical',
          ),
        );
      } else if (state === 'CONFLICTING_EVIDENCE') {
        checks.push(
          this.check(
            'evidence',
            false,
            'evidence is CONFLICTING — cannot answer confidently',
            'critical',
          ),
        );
        checks.push(
          this.check(
            'unsupported_claims',
            false,
            'conflicting sources leave claims unsupported',
            'critical',
          ),
        );
      } else if (state === 'INSUFFICIENT_EVIDENCE') {
        checks.push(
          this.check(
            'evidence',
            false,
            'evidence is INSUFFICIENT — claims would be unsupported',
            'critical',
          ),
        );
        checks.push(
          this.check(
            'unsupported_claims',
            false,
            'no sufficient evidence — claims are unsupported',
            'critical',
          ),
        );
      } else {
        checks.push(
          this.check(
            'evidence',
            false,
            'no evidence state reported for a grounding-required task',
            'critical',
          ),
        );
        checks.push(
          this.check(
            'unsupported_claims',
            false,
            'no evidence — claims are unsupported',
            'critical',
          ),
        );
      }
    } else {
      checks.push(this.check('evidence', true, 'grounding not required for this task', 'minor'));
      checks.push(
        this.check(
          'unsupported_claims',
          true,
          'no grounding contract — claim support is model-verified',
          'minor',
        ),
      );
    }

    // 3. Constraint satisfaction — required sections (deterministic).
    const requiredSections = input.successCriteria.flatMap((c) => c.requiredSections ?? []);
    if (requiredSections.length > 0) {
      const missing = requiredSections.filter(
        (section) => !output.toLowerCase().includes(section.toLowerCase()),
      );
      checks.push(
        this.check(
          'constraint',
          missing.length === 0,
          missing.length === 0
            ? `all required sections present (${requiredSections.join(', ')})`
            : `missing required sections: ${missing.join(', ')}`,
          'critical',
        ),
      );
    } else {
      checks.push(this.check('constraint', true, 'no section constraints declared', 'minor'));
    }

    // 4. Minimum length per success criterion.
    const minLength = Math.max(...input.successCriteria.map((c) => c.minLength ?? 0), 0);
    checks.push(
      this.check(
        'completion',
        output.trim().length >= minLength,
        `output length ${String(output.trim().length)} >= ${String(minLength)}`,
        'minor',
      ),
    );

    // 5. Output schema validation (reuses the frozen validator).
    if (input.expectedSchema && Object.keys(input.expectedSchema).length > 0) {
      const result = this.validator.validate(input.expectedSchema, output);
      checks.push(
        this.check(
          'schema',
          result.ok,
          result.ok
            ? 'output matches the expected schema'
            : `schema mismatch: ${result.errors.join('; ')}`,
          'critical',
        ),
      );
    } else {
      checks.push(this.check('schema', true, 'no structured schema expected', 'minor'));
    }

    // 6. Format check.
    if (input.format === 'json') {
      let jsonOk = false;
      try {
        const parsed = JSON.parse(output) as unknown;
        jsonOk = parsed !== null && typeof parsed === 'object';
      } catch {
        jsonOk = false;
      }
      checks.push(
        this.check(
          'format',
          jsonOk,
          jsonOk ? 'output is valid JSON' : 'output is not valid JSON',
          'critical',
        ),
      );
    } else if (input.format === 'code') {
      const codeOk =
        output.includes('```') ||
        /\b(?:function|class|const|let|public|private|METHOD|FUNCTION)\b/.test(output);
      checks.push(
        this.check(
          'format',
          codeOk,
          codeOk ? 'output contains code markers' : 'output does not look like code',
          'minor',
        ),
      );
    } else {
      checks.push(this.check('format', true, 'no explicit format constraint', 'minor'));
    }

    // 7. Token constraint.
    if (input.maxOutputTokens !== undefined) {
      const tokens = estimateTokens(output);
      checks.push(
        this.check(
          'constraint',
          tokens <= input.maxOutputTokens,
          `estimated ${String(tokens)} tokens <= ${String(input.maxOutputTokens)}`,
          'minor',
        ),
      );
    }

    // 8. Security — a tool denial is a hard critical failure.
    checks.push(
      this.check(
        'security',
        input.toolDenied !== true,
        input.toolDenied === true
          ? 'a tool call was denied by the security policy'
          : 'no security violations',
        'critical',
      ),
    );

    return this.aggregate(checks);
  }

  private check(
    name: string,
    passed: boolean,
    detail: string,
    severity: 'critical' | 'minor',
  ): CriticCheck {
    return { name, passed, detail, severity };
  }

  /**
   * Aggregate the checks into PASS | FAIL | PARTIAL | ABSTAIN.
   *   - any failed critical + evidence failure → ABSTAIN (never fabricate)
   *   - any other failed critical → FAIL
   *   - all passed → PASS
   *   - only minor failures → PARTIAL
   */
  private aggregate(checks: CriticCheck[]): CriticAssessment {
    const failedCritical = checks.filter((c) => !c.passed && c.severity === 'critical');
    const failedMinor = checks.filter((c) => !c.passed && c.severity === 'minor');
    const evidenceFailed = failedCritical.some(
      (c) => c.name === 'evidence' || c.name === 'unsupported_claims',
    );

    let verdict: CriticVerdict;
    if (failedCritical.length === 0 && failedMinor.length === 0) {
      verdict = 'PASS';
    } else if (evidenceFailed) {
      verdict = 'ABSTAIN';
    } else if (failedCritical.length > 0) {
      verdict = 'FAIL';
    } else {
      verdict = 'PARTIAL';
    }

    const reasons = checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail}`);

    return {
      verdict,
      score: checks.length === 0 ? 0 : checks.filter((c) => c.passed).length / checks.length,
      checks,
      reasons,
    };
  }
}
