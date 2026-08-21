// SPRINT-034 — OutcomeEvidence (revenue → outcome feedback)
// Verified-only evidence discipline + bounded score adjustments. Actuals are
// NEVER inferred; one outcome never rewrites policy (FEEDBACK_DELTA_MAX).

import { describe, expect, it } from 'vitest';
import { OutcomeEvidenceModel, FEEDBACK_DELTA_MAX } from '../domain/OutcomeEvidence.js';

const now = (): string => '2026-08-15T10:00:00.000Z';

describe('OutcomeEvidenceModel', () => {
  it('records verified outcome evidence with stable-key idempotency', () => {
    const model = new OutcomeEvidenceModel();
    const input = {
      ownerId: 'alice',
      kind: 'REVENUE' as const,
      opportunityId: 'opp-1',
      category: 'saas',
      actual: { value: 500, status: 'VERIFIED' as const, evidence: ['invoice-2026-08'] },
      verificationStatus: 'VERIFIED' as const,
      evidence: ['invoice-2026-08 shows $500 collected'],
      source: 'invoice-2026-08',
    };
    const first = model.record(input, now);
    expect(first.success).toBe(true);
    if (!first.success) return;
    const second = model.record(input, now);
    expect(second.success).toBe(true);
    if (!second.success) return;
    // Stable key identical → same dedup key (the store upserts).
    expect(second.data.stableKey).toBe(first.data.stableKey);
    expect(second.data.stableKey).toContain('REVENUE');
    expect(second.data.stableKey).toContain('opp-1');
  });

  it('REFUSES unverified actuals — actuals are VERIFIED-only', () => {
    const model = new OutcomeEvidenceModel();
    const result = model.record(
      {
        ownerId: 'alice',
        kind: 'REVENUE',
        opportunityId: 'opp-1',
        actual: { value: 999, status: 'ESTIMATED', evidence: ['guess'] },
        verificationStatus: 'VERIFIED',
        evidence: ['guess'],
      },
      now,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('ACTUAL_UNVERIFIED');
  });

  it('REFUSES records without a verification-status VERIFIED', () => {
    const model = new OutcomeEvidenceModel();
    const result = model.record(
      {
        ownerId: 'alice',
        kind: 'COST',
        opportunityId: 'opp-1',
        actual: { value: 10, status: 'VERIFIED', evidence: ['ledger'] },
        verificationStatus: 'UNVERIFIED',
        evidence: ['ledger'],
      },
      now,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('NOT_VERIFIED');
  });

  it('REFUSES records without any evidence trail — no fabricated facts', () => {
    const model = new OutcomeEvidenceModel();
    const result = model.record(
      {
        ownerId: 'alice',
        kind: 'REVENUE',
        opportunityId: 'opp-1',
        verificationStatus: 'VERIFIED',
        evidence: [],
      },
      now,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('NO_EVIDENCE');
  });

  it('applies bounded feedback toward the observed direction (clamped)', () => {
    const model = new OutcomeEvidenceModel();
    const record = model.record(
      {
        ownerId: 'alice',
        kind: 'MARGIN',
        opportunityId: 'opp-1',
        category: 'saas',
        actual: { value: 0.9, status: 'VERIFIED', evidence: ['actuals'] },
        verificationStatus: 'VERIFIED',
        evidence: ['verified margin 0.9'],
      },
      now,
    );
    if (!record.success) throw new Error('record failed');
    const result = model.applyFeedback(record.data, [{ key: 'expectedMargin', value: 0.5 }], now);
    expect(result.applied).toBe(true);
    expect(result.adjustments).toHaveLength(1);
    const adjustment = result.adjustments[0];
    if (!adjustment) throw new Error('no adjustment');
    expect(adjustment.factor).toBe('expectedMargin');
    // Clamped: never more than FEEDBACK_DELTA_MAX per single outcome.
    expect(adjustment.delta).toBeLessThanOrEqual(FEEDBACK_DELTA_MAX + 1e-9);
    expect(adjustment.next).toBeLessThanOrEqual(0.5 + FEEDBACK_DELTA_MAX + 1e-9);
    expect(adjustment.evidence.length).toBeGreaterThan(0);
  });

  it('refuses feedback when the record is not VERIFIED', () => {
    const model = new OutcomeEvidenceModel();
    const result = model.applyFeedback(
      {
        id: 'oe-1',
        ownerId: 'alice',
        stableKey: 'alice:REVENUE:opp-1',
        kind: 'REVENUE',
        opportunityId: 'opp-1',
        verificationStatus: 'UNVERIFIED',
        evidence: ['unverified'],
        recordedAt: now(),
      },
      [{ key: 'expectedMargin', value: 0.5 }],
      now,
    );
    expect(result.applied).toBe(false);
    expect(result.adjustments).toHaveLength(0);
  });

  it('a single outcome can never rewrite a factor by more than the clamp', () => {
    const model = new OutcomeEvidenceModel();
    const record = model.record(
      {
        ownerId: 'alice',
        kind: 'MARGIN',
        opportunityId: 'opp-1',
        category: 'saas',
        actual: { value: 0.0, status: 'VERIFIED', evidence: ['actuals'] },
        verificationStatus: 'VERIFIED',
        evidence: ['verified margin 0.0'],
      },
      now,
    );
    if (!record.success) throw new Error('record failed');
    // Repeated single-outcome applications can accumulate, but each is clamped.
    let current = 0.9;
    for (let i = 0; i < 20; i++) {
      const result = model.applyFeedback(
        record.data,
        [{ key: 'expectedMargin', value: current }],
        now,
      );
      const adjustment = result.adjustments[0];
      if (!adjustment) throw new Error('no adjustment');
      current = adjustment.next;
      expect(adjustment.delta).toBeLessThanOrEqual(FEEDBACK_DELTA_MAX + 1e-9);
    }
    // Even after 20 applications the total movement is bounded (each ≤ clamp).
    expect(0.9 - current).toBeLessThanOrEqual(20 * FEEDBACK_DELTA_MAX + 1e-9);
  });
});
