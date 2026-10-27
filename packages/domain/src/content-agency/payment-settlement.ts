// ──────────────────────────────────────────────────────────────────
// VedMoulya — Payment Settlement Port
// MISSION 002 (2026-10-26) — atomic, idempotent payment recording.
//
// A settlement implementation owns ONE unit of work:
//
//   1. lock/read the invoice and validate currency + state,
//   2. insert the payment at most once per (user, idempotency key),
//   3. recompute the paid total from the AUTHORITATIVE persisted rows,
//   4. settle the invoice when the verified total covers its amount.
//
// Steps 1-4 must be atomic. The PostgreSQL implementation does this in a
// single `db.transaction` with `SELECT … FOR UPDATE`; the in-memory
// implementation used by unit tests is a single-threaded `Map` double and is
// explicitly NOT a production transaction.
//
// Nothing in this file touches a database — it is the port only.
// ──────────────────────────────────────────────────────────────────

import type { PaymentEvidenceKind, PaymentStatus } from './payments.js';
import type { PaymentRecord } from './ops-types.js';

export interface PaymentSettlementCommand {
  paymentId: string;
  userId: string;
  invoiceId: string;
  clientId: string;
  /** Amount in integer minor units — never a float. */
  amountMinor: number;
  currency: string;
  method: string;
  receivedAt: string;
  note: string;
  createdAt: string;
  idempotencyKey: string;
  detailsFingerprint: string;
  evidenceKind: PaymentEvidenceKind;
  evidenceReference: string;
  evidenceReviewedBy: string | null;
  evidenceReviewedAt: string | null;
  /** `recorded` when the evidence is unreviewed, `verified` otherwise. */
  status: PaymentStatus;
}

export interface PaymentVerificationCommand {
  userId: string;
  paymentId: string;
  reviewerId: string;
  verifiedAt: string;
}

export type PaymentSettlementFailureCode =
  | 'INVOICE_NOT_FOUND'
  | 'INVOICE_ALREADY_SETTLED'
  | 'CURRENCY_MISMATCH'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_ALREADY_VERIFIED'
  | 'PAYMENT_EVIDENCE_MISSING'
  | 'SETTLEMENT_FAILED';

export interface PaymentSettlementRecord {
  id: string;
  userId: string;
  invoiceId: string;
  clientId: string;
  amountMinor: number;
  currency: string;
  method: string;
  receivedAt: string;
  note: string;
  createdAt: string;
  idempotencyKey: string | null;
  detailsFingerprint: string | null;
  evidenceKind: PaymentEvidenceKind | null;
  evidenceReference: string | null;
  evidenceReviewedBy: string | null;
  evidenceReviewedAt: string | null;
  status: PaymentStatus;
  verifiedAt: string | null;
}

export interface PaymentSettlementSuccess {
  ok: true;
  /**
   * `inserted`  — this call created the payment.
   * `duplicate` — the same idempotency key was retried with identical details;
   *               the ORIGINAL payment is returned and nothing was written.
   */
  outcome: 'inserted' | 'duplicate';
  payment: PaymentSettlementRecord;
  /** Invoice status after the unit of work committed. */
  invoiceStatus: 'draft' | 'sent' | 'paid';
  /** Verified payments only — the money that may be called received. */
  verifiedTotalMinor: number;
  /** All payments including unreviewed ones. */
  recordedTotalMinor: number;
  invoiceAmountMinor: number;
  /** True when verifiedTotalMinor >= invoiceAmountMinor. */
  settled: boolean;
}

export interface PaymentSettlementFailure {
  ok: false;
  code: PaymentSettlementFailureCode;
  error: string;
  /** Present when a conflicting/duplicate payment row was found. */
  payment?: PaymentSettlementRecord;
  actionable?: boolean;
}

export type PaymentSettlementResult = PaymentSettlementSuccess | PaymentSettlementFailure;

export interface PaymentSettlementPort {
  settle(command: PaymentSettlementCommand): Promise<PaymentSettlementResult>;
  verify(command: PaymentVerificationCommand): Promise<PaymentSettlementResult>;
}

/** Project a stored payment onto the settlement view (plain data, no I/O). */
export function settlementRecordFromPayment(payment: PaymentRecord): PaymentSettlementRecord {
  return {
    id: payment.id,
    userId: payment.userId,
    invoiceId: payment.invoiceId,
    clientId: payment.clientId,
    amountMinor: payment.amountMinor ?? Math.round(payment.amount * 100),
    currency: payment.currency,
    method: payment.method,
    receivedAt: payment.receivedAt,
    note: payment.note,
    createdAt: payment.createdAt,
    idempotencyKey: payment.idempotencyKey ?? null,
    detailsFingerprint: payment.detailsFingerprint ?? null,
    evidenceKind: payment.evidenceKind ?? null,
    evidenceReference: payment.evidenceReference ?? null,
    evidenceReviewedBy: payment.evidenceReviewedBy ?? null,
    evidenceReviewedAt: payment.evidenceReviewedAt ?? null,
    status: payment.status ?? 'recorded',
    verifiedAt: payment.verifiedAt ?? null,
  };
}

/** True when two stored payments describe the same logical payment. */
export function isSamePaymentDetails(
  stored: PaymentSettlementRecord,
  command: PaymentSettlementCommand,
): boolean {
  return (
    stored.invoiceId === command.invoiceId &&
    stored.amountMinor === command.amountMinor &&
    stored.currency === command.currency &&
    stored.method === command.method
  );
}
