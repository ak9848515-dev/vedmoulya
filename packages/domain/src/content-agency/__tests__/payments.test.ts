// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Payment Money & Evidence Primitives
// MISSION 002 — revenue safety rules (minor units, evidence, idempotency)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  MONEY_MINOR_MAX,
  IDEMPOTENCY_KEY_MAX,
  toMinorUnits,
  fromMinorUnits,
  formatMinorUnits,
  normalizeCurrency,
  isValidCurrency,
  isManualPaymentMethod,
  validateReviewerIdentity,
  validatePaymentEvidence,
  resolveIdempotencyKey,
  paymentDetailsFingerprint,
  type PaymentEvidence,
} from '../payments.js';

describe('toMinorUnits', () => {
  it('converts exact major units to integer minor units', () => {
    expect(toMinorUnits(0)).toEqual({ ok: true, minor: 0 });
    expect(toMinorUnits(1234.56)).toEqual({ ok: true, minor: 123456 });
    expect(toMinorUnits(0.01)).toEqual({ ok: true, minor: 1 });
  });

  it('accepts a floating point artefact that is exact at scale 2', () => {
    // 1234.56 * 100 === 123456.00000000001 in IEEE-754; that is not a
    // precision loss, so it must be accepted and normalised to the integer.
    expect(toMinorUnits(1234.56)).toEqual({ ok: true, minor: 123456 });
    expect(toMinorUnits(0.1 + 0.2)).toEqual({ ok: true, minor: 30 });
  });

  it('rejects non-finite and non-number input', () => {
    expect(toMinorUnits(Number.NaN)).toMatchObject({ ok: false, code: 'AMOUNT_INVALID' });
    expect(toMinorUnits(Number.POSITIVE_INFINITY)).toMatchObject({
      ok: false,
      code: 'AMOUNT_INVALID',
    });
    expect(toMinorUnits('12.00' as unknown as number)).toMatchObject({
      ok: false,
      code: 'AMOUNT_INVALID',
    });
  });

  it('rejects negative amounts rather than round-tripping the sign', () => {
    expect(toMinorUnits(-0.01)).toMatchObject({ ok: false, code: 'AMOUNT_INVALID' });
    expect(toMinorUnits(-100)).toMatchObject({ ok: false, code: 'AMOUNT_INVALID' });
  });

  it('refuses to silently round sub-cent precision', () => {
    const result = toMinorUnits(10.005);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, code: 'AMOUNT_PRECISION' });
    if (!result.ok) expect(result.error).toContain('never silently rounded');
  });

  it('enforces the maximum supported amount', () => {
    expect(toMinorUnits(MONEY_MINOR_MAX / 100)).toEqual({ ok: true, minor: MONEY_MINOR_MAX });
    expect(toMinorUnits(MONEY_MINOR_MAX / 100 + 1)).toMatchObject({
      ok: false,
      code: 'AMOUNT_OUT_OF_RANGE',
    });
  });
});

describe('minor unit display helpers', () => {
  it('converts minor units back to major units', () => {
    expect(fromMinorUnits(123456)).toBe(1234.56);
    expect(fromMinorUnits(0)).toBe(0);
  });

  it('formats minor units as a fixed-scale decimal string', () => {
    expect(formatMinorUnits(123456)).toBe('1234.56');
    expect(formatMinorUnits(5)).toBe('0.05');
    expect(formatMinorUnits(0)).toBe('0.00');
    expect(formatMinorUnits(-5)).toBe('-0.05');
    expect(formatMinorUnits(-123456)).toBe('-1234.56');
  });
});

describe('currency helpers', () => {
  it('normalises case and whitespace', () => {
    expect(normalizeCurrency(' eur ')).toBe('EUR');
    expect(normalizeCurrency('usd')).toBe('USD');
  });

  it('defaults to USD when the currency is absent or blank', () => {
    expect(normalizeCurrency(undefined)).toBe('USD');
    expect(normalizeCurrency(null)).toBe('USD');
    expect(normalizeCurrency('   ')).toBe('USD');
  });

  it('validates ISO-4217-shaped codes only', () => {
    expect(isValidCurrency('USD')).toBe(true);
    expect(isValidCurrency('EUR')).toBe(true);
    expect(isValidCurrency('usd')).toBe(false);
    expect(isValidCurrency('US')).toBe(false);
    expect(isValidCurrency('USDD')).toBe(false);
    expect(isValidCurrency('US1')).toBe(false);
  });
});

describe('isManualPaymentMethod', () => {
  it('treats cash/cheque/manual/other as methods with no processor', () => {
    expect(isManualPaymentMethod('cash')).toBe(true);
    expect(isManualPaymentMethod('  Cheque ')).toBe(true);
    expect(isManualPaymentMethod('check')).toBe(true);
    expect(isManualPaymentMethod('manual')).toBe(true);
    expect(isManualPaymentMethod('other')).toBe(true);
  });

  it('treats processor-backed methods as non-manual', () => {
    expect(isManualPaymentMethod('card')).toBe(false);
    expect(isManualPaymentMethod('stripe')).toBe(false);
    expect(isManualPaymentMethod('bank_transfer')).toBe(false);
  });
});

describe('validateReviewerIdentity', () => {
  it('accepts a plausible operator identity', () => {
    expect(validateReviewerIdentity('  Priya Raman ')).toEqual({
      ok: true,
      reviewerId: 'Priya Raman',
    });
  });

  it('rejects missing, too-short and too-long identities', () => {
    expect(validateReviewerIdentity(undefined)).toMatchObject({ ok: false });
    expect(validateReviewerIdentity(null)).toMatchObject({ ok: false });
    expect(validateReviewerIdentity('x')).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REVIEWER_INVALID',
    });
    expect(validateReviewerIdentity('a'.repeat(121))).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REVIEWER_INVALID',
    });
  });

  it('rejects placeholder identities, including punctuation variants', () => {
    expect(validateReviewerIdentity('test')).toMatchObject({ ok: false });
    expect(validateReviewerIdentity('N/A')).toMatchObject({ ok: false });
    expect(validateReviewerIdentity('--')).toMatchObject({ ok: false });
    expect(validateReviewerIdentity('unassigned yet')).not.toMatchObject({ ok: false });
    expect(validateReviewerIdentity('operator 7')).toMatchObject({ ok: true });
  });
});

const PROCESSOR_EVIDENCE: PaymentEvidence = {
  kind: 'processor_reference',
  reference: 'TXN-8841-2026',
};

const MANUAL_EVIDENCE: PaymentEvidence = {
  kind: 'manual_receipt',
  reference: 'REC-2026-0031',
  reviewedBy: 'Priya Raman',
};

function validate(
  evidence: PaymentEvidence | undefined,
  method = 'card',
  reserved: readonly string[] = [],
) {
  return validatePaymentEvidence({ evidence, method, reserved });
}

describe('validatePaymentEvidence', () => {
  it('requires evidence at all — a bare amount is never a payment', () => {
    const result = validate(undefined);
    expect(result).toMatchObject({ ok: false, code: 'PAYMENT_EVIDENCE_REQUIRED' });
    expect(validate(null as unknown as PaymentEvidence)).toMatchObject({
      ok: false,
      code: 'PAYMENT_EVIDENCE_REQUIRED',
    });
    expect(validate('TXN-8841' as unknown as PaymentEvidence)).toMatchObject({
      ok: false,
      code: 'PAYMENT_EVIDENCE_REQUIRED',
    });
  });

  it('rejects an unknown evidence kind from the untyped JSON boundary', () => {
    expect(
      validate({ kind: 'screenshot', reference: 'TXN-8841-2026' } as unknown as PaymentEvidence),
    ).toMatchObject({ ok: false, code: 'EVIDENCE_KIND_INVALID' });
    expect(validate({ reference: 'TXN-8841-2026' } as unknown as PaymentEvidence)).toMatchObject({
      ok: false,
      code: 'EVIDENCE_KIND_INVALID',
    });
  });

  it('requires a manual receipt for methods with no processor behind them', () => {
    expect(validate(PROCESSOR_EVIDENCE, 'cash')).toMatchObject({
      ok: false,
      code: 'EVIDENCE_KIND_METHOD_MISMATCH',
    });
    expect(validate(PROCESSOR_EVIDENCE, ' CHEQUE ')).toMatchObject({
      ok: false,
      code: 'EVIDENCE_KIND_METHOD_MISMATCH',
    });
  });

  it('requires a processor reference for processor-backed methods', () => {
    expect(validate(MANUAL_EVIDENCE, 'card')).toMatchObject({
      ok: false,
      code: 'EVIDENCE_KIND_METHOD_MISMATCH',
    });
  });

  it('requires a non-empty reference', () => {
    expect(validate({ kind: 'processor_reference' } as PaymentEvidence)).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REFERENCE_REQUIRED',
    });
    expect(validate({ kind: 'processor_reference', reference: '   ' })).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REFERENCE_REQUIRED',
    });
    expect(
      validate({ kind: 'processor_reference', reference: 42 } as unknown as PaymentEvidence),
    ).toMatchObject({ ok: false, code: 'EVIDENCE_REFERENCE_REQUIRED' });
  });

  it('rejects malformed references', () => {
    expect(validate({ kind: 'processor_reference', reference: 'ab1' })).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REFERENCE_INVALID',
    });
    expect(validate({ kind: 'processor_reference', reference: 'TXN-8841<script>' })).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REFERENCE_INVALID',
    });
    expect(validate({ kind: 'processor_reference', reference: ' aaaaaa ' })).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REFERENCE_INVALID',
    });
  });

  it('collapses internal whitespace before validating', () => {
    const result = validate({ kind: 'processor_reference', reference: 'TXN   8841  2026' });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.evidence.reference).toBe('TXN 8841 2026');
  });

  it('rejects placeholder references', () => {
    expect(validate({ kind: 'processor_reference', reference: 'EXAMPLE' })).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REFERENCE_PLACEHOLDER',
    });
    expect(validate({ kind: 'processor_reference', reference: 'pending' })).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REFERENCE_PLACEHOLDER',
    });
  });

  it('rejects a reference that merely echoes the payload', () => {
    expect(
      validate({ kind: 'processor_reference', reference: 'INV-2026-0042' }, 'card', [
        'INV-2026-0042',
      ]),
    ).toMatchObject({ ok: false, code: 'EVIDENCE_REFERENCE_ECHOES_PAYLOAD' });
    // Punctuation differences do not hide an echo.
    expect(
      validate({ kind: 'processor_reference', reference: 'INV 2026 0042' }, 'card', [
        'inv20260042',
      ]),
    ).toMatchObject({ ok: false, code: 'EVIDENCE_REFERENCE_ECHOES_PAYLOAD' });
  });

  it('ignores blank reserved values and accepts an independent reference', () => {
    const result = validate(PROCESSOR_EVIDENCE, 'card', ['', '   ', 'client-9']);
    expect(result).toMatchObject({ ok: true });
  });

  it('validates the reviewer when one is supplied', () => {
    expect(validate({ ...PROCESSOR_EVIDENCE, reviewedBy: 'test' })).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REVIEWER_INVALID',
    });
  });

  it('will not accept a manual receipt that nobody reviewed', () => {
    expect(validate({ kind: 'manual_receipt', reference: 'REC-2026-0031' }, 'cash')).toMatchObject({
      ok: false,
      code: 'EVIDENCE_REVIEW_REQUIRED',
    });
    expect(
      validate({ kind: 'manual_receipt', reference: 'REC-2026-0031', reviewedBy: '  ' }, 'cash'),
    ).toMatchObject({ ok: false, code: 'EVIDENCE_REVIEW_REQUIRED' });
  });

  it('records unreviewed processor evidence as claimed, not received', () => {
    const result = validate(PROCESSOR_EVIDENCE);
    expect(result).toEqual({
      ok: true,
      evidence: {
        kind: 'processor_reference',
        reference: 'TXN-8841-2026',
        reviewedBy: null,
        reviewedAt: null,
        status: 'recorded',
      },
    });
  });

  it('verifies evidence that an operator attested, keeping the review time', () => {
    const result = validate(
      {
        ...PROCESSOR_EVIDENCE,
        reviewedBy: ' Priya Raman ',
        reviewedAt: '2026-10-26T09:00:00.000Z',
      },
      'stripe',
    );
    expect(result).toEqual({
      ok: true,
      evidence: {
        kind: 'processor_reference',
        reference: 'TXN-8841-2026',
        reviewedBy: 'Priya Raman',
        reviewedAt: '2026-10-26T09:00:00.000Z',
        status: 'verified',
      },
    });
  });

  it('leaves reviewedAt null when the attestation carries no timestamp', () => {
    const result = validate(MANUAL_EVIDENCE, 'cash');
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.evidence.status).toBe('verified');
      expect(result.evidence.reviewedBy).toBe('Priya Raman');
      expect(result.evidence.reviewedAt).toBeNull();
    }
  });
});

describe('resolveIdempotencyKey', () => {
  const base = { evidenceReference: 'TXN-8841-2026', evidenceKind: 'processor_reference' as const };

  it('uses an explicit key verbatim so retries match', () => {
    expect(resolveIdempotencyKey({ ...base, idempotencyKey: ' req-7f3a ' })).toEqual({
      ok: true,
      key: 'req-7f3a',
      derived: false,
    });
  });

  it('rejects explicit keys with spaces, control characters or excessive length', () => {
    expect(resolveIdempotencyKey({ ...base, idempotencyKey: 'req 7f3a' })).toMatchObject({
      ok: false,
      code: 'IDEMPOTENCY_KEY_INVALID',
    });
    expect(resolveIdempotencyKey({ ...base, idempotencyKey: 'req\n7f3a' })).toMatchObject({
      ok: false,
      code: 'IDEMPOTENCY_KEY_INVALID',
    });
    expect(
      resolveIdempotencyKey({ ...base, idempotencyKey: 'k'.repeat(IDEMPOTENCY_KEY_MAX + 1) }),
    ).toMatchObject({ ok: false, code: 'IDEMPOTENCY_KEY_INVALID' });
  });

  it('derives the key from the evidence when none is supplied', () => {
    expect(resolveIdempotencyKey({ ...base, idempotencyKey: '   ' })).toEqual({
      ok: true,
      key: 'processor_reference:txn88412026',
      derived: true,
    });
  });

  it('rejects a derived key that is too long', () => {
    expect(
      resolveIdempotencyKey({
        evidenceReference: `TXN-${'9'.repeat(IDEMPOTENCY_KEY_MAX)}`,
        evidenceKind: 'manual_receipt',
      }),
    ).toMatchObject({ ok: false, code: 'IDEMPOTENCY_KEY_INVALID' });
  });
});

describe('paymentDetailsFingerprint', () => {
  it('is deterministic for identical details', () => {
    const parts = ['inv-1', '123456', 'USD', 'card'];
    expect(paymentDetailsFingerprint(parts)).toBe(paymentDetailsFingerprint([...parts]));
  });

  it('differs when any identifying detail differs', () => {
    const base = paymentDetailsFingerprint(['inv-1', '123456', 'USD', 'card']);
    expect(paymentDetailsFingerprint(['inv-2', '123456', 'USD', 'card'])).not.toBe(base);
    expect(paymentDetailsFingerprint(['inv-1', '123457', 'USD', 'card'])).not.toBe(base);
    expect(paymentDetailsFingerprint(['inv-1', '123456', 'EUR', 'card'])).not.toBe(base);
    expect(paymentDetailsFingerprint(['inv-1', '123456', 'USD', 'cash'])).not.toBe(base);
  });

  it('separates adjacent fields so concatenation is not ambiguous', () => {
    expect(paymentDetailsFingerprint(['inv123', '456'])).not.toBe(
      paymentDetailsFingerprint(['inv', '123456']),
    );
  });

  it('handles an empty parts list', () => {
    expect(paymentDetailsFingerprint([])).toMatch(/^[0-9a-f]{16}0000$/);
  });
});
