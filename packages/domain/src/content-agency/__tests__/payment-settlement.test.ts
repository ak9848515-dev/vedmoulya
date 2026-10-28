// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Payment Settlement Port Helpers
// MISSION 002 — projection of stored payments and retry comparison
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  settlementRecordFromPayment,
  isSamePaymentDetails,
  type PaymentSettlementCommand,
} from '../payment-settlement.js';
import type { PaymentRecord } from '../ops-types.js';

function legacyPayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'pay-1',
    userId: 'usr-1',
    invoiceId: 'inv-1',
    clientId: 'cl-1',
    amount: 1234.56,
    currency: 'USD',
    method: 'card',
    receivedAt: '2026-10-26T09:00:00.000Z',
    note: 'October retainer',
    createdAt: '2026-10-26T09:00:00.000Z',
    ...overrides,
  };
}

function command(overrides: Partial<PaymentSettlementCommand> = {}): PaymentSettlementCommand {
  return {
    paymentId: 'pay-2',
    userId: 'usr-1',
    invoiceId: 'inv-1',
    clientId: 'cl-1',
    amountMinor: 123456,
    currency: 'USD',
    method: 'card',
    receivedAt: '2026-10-26T10:00:00.000Z',
    note: '',
    createdAt: '2026-10-26T10:00:00.000Z',
    idempotencyKey: 'processor_reference:txn88412026',
    detailsFingerprint: 'deadbeefdeadbeef0004',
    evidenceKind: 'processor_reference',
    evidenceReference: 'TXN-8841-2026',
    evidenceReviewedBy: null,
    evidenceReviewedAt: null,
    status: 'recorded',
    ...overrides,
  };
}

describe('settlementRecordFromPayment', () => {
  it('projects a pre-migration row, deriving minor units from the legacy float', () => {
    const record = settlementRecordFromPayment(legacyPayment());

    expect(record.amountMinor).toBe(123456);
    expect(record.status).toBe('recorded');
    expect(record.idempotencyKey).toBeNull();
    expect(record.detailsFingerprint).toBeNull();
    expect(record.evidenceKind).toBeNull();
    expect(record.evidenceReference).toBeNull();
    expect(record.evidenceReviewedBy).toBeNull();
    expect(record.evidenceReviewedAt).toBeNull();
    expect(record.verifiedAt).toBeNull();
  });

  it('prefers the authoritative integer amount over the float mirror', () => {
    const record = settlementRecordFromPayment(
      legacyPayment({ amount: 999.99, amountMinor: 123456 }),
    );
    expect(record.amountMinor).toBe(123456);
  });

  it('passes through a verified, fully-populated row unchanged', () => {
    const payment = legacyPayment({
      amountMinor: 123456,
      status: 'verified',
      idempotencyKey: 'processor_reference:txn88412026',
      detailsFingerprint: 'deadbeefdeadbeef0004',
      evidenceKind: 'processor_reference',
      evidenceReference: 'TXN-8841-2026',
      evidenceReviewedBy: 'Priya Raman',
      evidenceReviewedAt: '2026-10-26T09:30:00.000Z',
      verifiedAt: '2026-10-26T09:30:00.000Z',
    });

    expect(settlementRecordFromPayment(payment)).toEqual({
      id: 'pay-1',
      userId: 'usr-1',
      invoiceId: 'inv-1',
      clientId: 'cl-1',
      amountMinor: 123456,
      currency: 'USD',
      method: 'card',
      receivedAt: '2026-10-26T09:00:00.000Z',
      note: 'October retainer',
      createdAt: '2026-10-26T09:00:00.000Z',
      idempotencyKey: 'processor_reference:txn88412026',
      detailsFingerprint: 'deadbeefdeadbeef0004',
      evidenceKind: 'processor_reference',
      evidenceReference: 'TXN-8841-2026',
      evidenceReviewedBy: 'Priya Raman',
      evidenceReviewedAt: '2026-10-26T09:30:00.000Z',
      status: 'verified',
      verifiedAt: '2026-10-26T09:30:00.000Z',
    });
  });
});

describe('isSamePaymentDetails', () => {
  const stored = settlementRecordFromPayment(legacyPayment({ amountMinor: 123456 }));

  it('treats a replay with identical money details as the same payment', () => {
    expect(isSamePaymentDetails(stored, command())).toBe(true);
  });

  it('detects a different invoice', () => {
    expect(isSamePaymentDetails(stored, command({ invoiceId: 'inv-2' }))).toBe(false);
  });

  it('detects a different amount for the same idempotency key', () => {
    expect(isSamePaymentDetails(stored, command({ amountMinor: 123457 }))).toBe(false);
  });

  it('detects a different currency', () => {
    expect(isSamePaymentDetails(stored, command({ currency: 'EUR' }))).toBe(false);
  });

  it('detects a different payment method', () => {
    expect(isSamePaymentDetails(stored, command({ method: 'cash' }))).toBe(false);
  });

  it('ignores fields that are not part of the payment identity', () => {
    expect(isSamePaymentDetails(stored, command({ note: 'different note', userId: 'usr-9' }))).toBe(
      true,
    );
  });
});
