// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Recovery Tests
// Covers classification (transient · permission · unavailable ·
// verification · budget · abstraction) and bounded decisions
// (retry · alternate model · alternate tool · revised step ·
// block · fail) — no infinite loops by construction.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { classifyFailure, decideRecovery } from '../domain/recovery.js';
import type { StepAttemptFailure } from '../domain/recovery.js';

function failure(overrides: Partial<StepAttemptFailure>): StepAttemptFailure {
  return {
    hasAi: false,
    hasTools: false,
    attempts: 0,
    revisions: 0,
    maxAttempts: 2,
    maxRevisions: 1,
    ...overrides,
  };
}

describe('classifyFailure', () => {
  it('classifies budget exceed as BUDGET_EXCEEDED', () => {
    expect(classifyFailure(failure({ budgetExceeded: true }))).toBe('BUDGET_EXCEEDED');
  });

  it('classifies tool denial as PERMISSION_DENIED (never bypassed)', () => {
    expect(classifyFailure(failure({ toolDenied: true }))).toBe('PERMISSION_DENIED');
  });

  it('classifies an unavailable tool', () => {
    expect(classifyFailure(failure({ toolUnavailable: true }))).toBe('TOOL_UNAVAILABLE');
  });

  it('classifies AI errors and tool errors as TRANSIENT', () => {
    expect(classifyFailure(failure({ aiFailed: true }))).toBe('TRANSIENT');
    expect(classifyFailure(failure({ toolFailed: true }))).toBe('TRANSIENT');
  });

  it('classifies abstention as ABSTRACTION (evidence-first, never fabricated)', () => {
    expect(classifyFailure(failure({ abstained: true }))).toBe('ABSTRACTION');
  });

  it('classifies non-verified verdicts as VERIFICATION_FAILED', () => {
    expect(classifyFailure(failure({ verdict: 'FAILED' }))).toBe('VERIFICATION_FAILED');
    expect(classifyFailure(failure({ verdict: 'PARTIAL' }))).toBe('VERIFICATION_FAILED');
    expect(classifyFailure(failure({ verdict: 'UNKNOWN' }))).toBe('VERIFICATION_FAILED');
  });

  it('classifies a BLOCKED verification as PERMISSION_DENIED', () => {
    expect(classifyFailure(failure({ verdict: 'BLOCKED' }))).toBe('PERMISSION_DENIED');
  });

  it('classifies everything else honestly as UNKNOWN_FAILURE', () => {
    expect(classifyFailure(failure({}))).toBe('UNKNOWN_FAILURE');
  });
});

describe('decideRecovery — bounded by construction', () => {
  it('blocks on budget exceed — never continues past a hard bound', () => {
    const decision = decideRecovery(failure({ budgetExceeded: true }));
    expect(decision.strategy).toBe('block_step');
  });

  it('blocks on permission denial — a model request is NOT authorization', () => {
    const decision = decideRecovery(failure({ toolDenied: true }));
    expect(decision.strategy).toBe('block_step');
  });

  it('tries a declared alternate tool when the primary tool is unavailable', () => {
    const decision = decideRecovery(
      failure({
        toolUnavailable: true,
        failedToolName: 'gh',
        hasTools: true,
        policy: { alternateTools: ['gh-cli'] },
      }),
    );
    expect(decision.strategy).toBe('alternate_tool');
  });

  it('blocks when an unavailable tool has no declared alternate', () => {
    const decision = decideRecovery(
      failure({ toolUnavailable: true, failedToolName: 'gh', hasTools: true }),
    );
    expect(decision.strategy).toBe('block_step');
  });

  it('routes the FIRST AI retry through alternate_model (runtime fallback)', () => {
    const decision = decideRecovery(
      failure({ aiFailed: true, hasAi: true, attempts: 0, maxAttempts: 2 }),
    );
    expect(decision.strategy).toBe('alternate_model');
  });

  it('plain-retries later transient failures while attempts remain', () => {
    const decision = decideRecovery(
      failure({ aiFailed: true, hasAi: true, attempts: 1, maxAttempts: 3, aiFallbackUsed: true }),
    );
    expect(decision.strategy).toBe('retry');
  });

  it('fails the step when transient failures exhaust the attempt budget', () => {
    const decision = decideRecovery(
      failure({ aiFailed: true, hasAi: true, attempts: 2, maxAttempts: 2 }),
    );
    expect(decision.strategy).toBe('fail_step');
  });

  it('revises the step approach on verification failure (bounded revision)', () => {
    const decision = decideRecovery(
      failure({
        verdict: 'FAILED',
        hasAi: true,
        attempts: 1,
        revisions: 0,
        maxRevisions: 1,
      }),
    );
    expect(decision.strategy).toBe('revise_step');
  });

  it('never retries the identical action forever after revisions are exhausted', () => {
    const decision = decideRecovery(
      failure({
        verdict: 'FAILED',
        hasAi: true,
        attempts: 2,
        revisions: 1,
        maxRevisions: 1,
      }),
    );
    expect(decision.strategy).toBe('fail_step');
  });

  it('switches to a declared alternate tool after a tool verification failure', () => {
    const decision = decideRecovery(
      failure({
        verdict: 'FAILED',
        hasTools: true,
        failedToolName: 'readerA',
        policy: { alternateTools: ['readerB'] },
      }),
    );
    expect(decision.strategy).toBe('alternate_tool');
    expect(decision.reason).toContain('readerB');
  });

  it('fails the step when verification fails and no approach change is possible', () => {
    const decision = decideRecovery(
      failure({
        verdict: 'FAILED',
        attempts: 1,
        revisions: 1,
        maxRevisions: 1,
        maxAttempts: 2,
      }),
    );
    expect(decision.strategy).toBe('fail_step');
  });

  it('retries an UNKNOWN verdict while attempts remain (UNKNOWN is not success)', () => {
    const decision = decideRecovery(failure({ verdict: 'UNKNOWN', attempts: 0, maxAttempts: 2 }));
    expect(decision.strategy).toBe('retry');
  });

  it('fails honestly when nothing can change an UNKNOWN verdict', () => {
    const decision = decideRecovery(
      failure({ verdict: 'UNKNOWN', attempts: 1, revisions: 1, maxRevisions: 1, maxAttempts: 1 }),
    );
    expect(decision.strategy).toBe('fail_step');
  });

  it('treats abstention with revision budget as a revise_step, else bounded retry, else fail', () => {
    const revise = decideRecovery(failure({ abstained: true, hasAi: true, revisions: 0 }));
    expect(revise.strategy).toBe('revise_step');

    const retry = decideRecovery(failure({ abstained: true, attempts: 0, maxAttempts: 2 }));
    expect(retry.strategy).toBe('retry');

    const exhausted = decideRecovery(failure({ abstained: true, attempts: 2, maxAttempts: 2 }));
    expect(exhausted.strategy).toBe('fail_step');
  });
});
