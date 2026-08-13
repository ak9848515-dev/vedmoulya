// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain: OutcomeVerdict tests
// SPRINT-024 — HONEST OUTCOME STATE (Phase 2)
//
// The six outcome states must be distinguishable, and UNKNOWN /
// FAILED / AWAITING_APPROVAL / BUDGET_EXHAUSTED must NEVER be silently
// converted into SUCCESS. A definitive verification FAIL (malformed /
// contradictory / expected-artifact missing) is FAILED — never SUCCESS,
// never masked as UNKNOWN.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  deriveOutcomeVerdict,
  OUTCOME_VERDICT_LABELS,
  OUTCOME_VERDICTS,
} from '../domain/OutcomeVerdict.js';
import type { OutcomeVerdictInput } from '../domain/OutcomeVerdict.js';

function input(overrides: Partial<OutcomeVerdictInput>): OutcomeVerdictInput {
  return {
    status: 'PARTIAL',
    verificationPassed: undefined,
    hasBudgetDecision: false,
    hasFailedProvider: false,
    ...overrides,
  };
}

describe('deriveOutcomeVerdict — the six honest states', () => {
  it('SUCCESS only when COMPLETED AND verification passed', () => {
    expect(deriveOutcomeVerdict(input({ status: 'COMPLETED', verificationPassed: true }))).toBe(
      'SUCCESS',
    );
  });

  it('COMPLETED without verification is UNKNOWN (never SUCCESS)', () => {
    expect(deriveOutcomeVerdict(input({ status: 'COMPLETED' }))).toBe('UNKNOWN');
  });

  it('COMPLETED with a definitive verification FAIL is FAILED (verification wins)', () => {
    expect(
      deriveOutcomeVerdict(
        input({ status: 'COMPLETED', verificationPassed: false, verificationFailed: true }),
      ),
    ).toBe('FAILED');
  });

  it('COMPLETED with inconclusive verification evidence stays UNKNOWN', () => {
    expect(
      deriveOutcomeVerdict(
        input({ status: 'COMPLETED', verificationPassed: false, verificationFailed: false }),
      ),
    ).toBe('UNKNOWN');
  });

  it('AWAITING_APPROVAL is preserved (never upgraded to SUCCESS)', () => {
    expect(
      deriveOutcomeVerdict(input({ status: 'AWAITING_APPROVAL', verificationPassed: true })),
    ).toBe('AWAITING_APPROVAL');
  });

  it('CANCELLED is preserved', () => {
    expect(deriveOutcomeVerdict(input({ status: 'CANCELLED' }))).toBe('CANCELLED');
  });

  it('BUDGET_EXHAUSTED wins over every other signal (fail-closed first)', () => {
    expect(
      deriveOutcomeVerdict(
        input({ status: 'COMPLETED', verificationPassed: true, hasBudgetDecision: true }),
      ),
    ).toBe('BUDGET_EXHAUSTED');
  });

  it('FAILED status is FAILED', () => {
    expect(deriveOutcomeVerdict(input({ status: 'FAILED' }))).toBe('FAILED');
  });

  it('a failed provider on a partial run is FAILED', () => {
    expect(deriveOutcomeVerdict(input({ status: 'PARTIAL', hasFailedProvider: true }))).toBe(
      'FAILED',
    );
  });

  it('a partial run with no evidence is UNKNOWN', () => {
    expect(deriveOutcomeVerdict(input({ status: 'PARTIAL' }))).toBe('UNKNOWN');
  });

  it('PARTIAL with INCONCLUSIVE verification is UNKNOWN (same evidence, same verdict as COMPLETED)', () => {
    expect(
      deriveOutcomeVerdict(
        input({ status: 'PARTIAL', verificationPassed: false, verificationFailed: false }),
      ),
    ).toBe('UNKNOWN');
  });

  it('PARTIAL with a definitive verification FAIL is FAILED', () => {
    expect(
      deriveOutcomeVerdict(
        input({ status: 'PARTIAL', verificationPassed: false, verificationFailed: true }),
      ),
    ).toBe('FAILED');
  });

  it('the closed verdict vocabulary covers the six required states', () => {
    for (const v of [
      'SUCCESS',
      'FAILED',
      'UNKNOWN',
      'AWAITING_APPROVAL',
      'CANCELLED',
      'BUDGET_EXHAUSTED',
    ]) {
      expect(OUTCOME_VERDICTS).toContain(v);
      expect(OUTCOME_VERDICT_LABELS[v as (typeof OUTCOME_VERDICTS)[number]]).toBeTruthy();
    }
  });
});
