// ──────────────────────────────────────────────────────────────────
// VedMoulya — Sequential Payment Settlement (TEST DOUBLE, NOT ATOMIC)
//
// MISSION 002 (2026-10-26).
//
// This is the in-memory implementation of PaymentSettlementPort. It runs the
// same *sequence* of steps as the PostgreSQL settlement but with plain awaits
// against the in-memory repositories, so it is NOT atomic: it exists so unit
// tests can exercise the application service without a database.
//
// PRODUCTION NEVER USES THIS FILE. `ClientOperationsApplicationService`
// refuses to construct without an explicit settlement port when
// NODE_ENV=production, and the production composition root injects
// `PostgresPaymentSettlement` (single `db.transaction` + `SELECT … FOR UPDATE`).
//
// The ordering here still mirrors the real implementation so a test that
// passes here is meaningful: dedupe BEFORE insert, recompute the total from
// persisted rows AFTER insert, settle from the recomputed total.
// ──────────────────────────────────────────────────────────────────

import {
  isSamePaymentDetails,
  settlementRecordFromPayment,
  toMinorUnits,
  type PaymentRecord,
  type PaymentSettlementCommand,
  type PaymentSettlementPort,
  type PaymentSettlementRecord,
  type PaymentSettlementResult,
  type PaymentVerificationCommand,
} from '@vedmoulya/domain';
import type { ClientOpsRepository } from '@vedmoulya/domain';
import type { ContentAgencyApplicationService } from './ContentAgencyApplicationService.js';

interface InvoiceSnapshot {
  id: string;
  clientId: string;
  amount: number;
  currency: string;
  status?: string;
}

export class SequentialPaymentSettlement implements PaymentSettlementPort {
  constructor(
    private readonly repo: ClientOpsRepository,
    private readonly contentAgency: Pick<
      ContentAgencyApplicationService,
      'getInvoice' | 'updateInvoiceStatus'
    >,
  ) {}

  async settle(command: PaymentSettlementCommand): Promise<PaymentSettlementResult> {
    // 1. Idempotency — resolve before any write.
    const existing = await this.repo.findPaymentByIdempotencyKey(
      command.userId,
      command.idempotencyKey,
    );
    if (existing) {
      const record = settlementRecordFromPayment(existing);
      if (!isSamePaymentDetails(record, command)) {
        return {
          ok: false,
          code: 'IDEMPOTENCY_CONFLICT',
          error:
            'This idempotency key was already used for a payment with different details. Retry with the original payload or use a new key.',
          payment: record,
        };
      }
      return this.success('duplicate', record, command.userId);
    }

    // 2. Invoice state.
    const invoice = await this.loadInvoice(command.userId, command.invoiceId);
    if (!invoice.ok) return invoice.failure;
    if (invoice.value.status === 'paid') {
      return {
        ok: false,
        code: 'INVOICE_ALREADY_SETTLED',
        error: 'Invoice is already settled — a further payment would double-count revenue.',
      };
    }
    const invoiceCurrency = (invoice.value.currency || 'USD').toUpperCase();
    if (invoiceCurrency !== command.currency) {
      return {
        ok: false,
        code: 'CURRENCY_MISMATCH',
        error: `Invoice is denominated in ${invoiceCurrency}; the payment is in ${command.currency}.`,
      };
    }

    // 3. Persist.
    await this.repo.savePayment(this.toRecord(command));

    // 4. Totals recomputed from persisted rows.
    return this.success(
      'inserted',
      settlementRecordFromPayment(this.toRecord(command)),
      command.userId,
    );
  }

  async verify(command: PaymentVerificationCommand): Promise<PaymentSettlementResult> {
    const payment = await this.repo.findPaymentById(command.paymentId, command.userId);
    if (!payment || payment.userId !== command.userId) {
      return { ok: false, code: 'PAYMENT_NOT_FOUND', error: 'Payment not found.' };
    }
    if ((payment.status ?? 'recorded') === 'verified') {
      return {
        ok: false,
        code: 'PAYMENT_ALREADY_VERIFIED',
        error: 'Payment is already verified.',
        payment: settlementRecordFromPayment(payment),
      };
    }
    if (!payment.evidenceReference) {
      return {
        ok: false,
        code: 'PAYMENT_EVIDENCE_MISSING',
        error: 'A payment cannot be verified without evidence on record.',
        payment: settlementRecordFromPayment(payment),
      };
    }
    const updated: PaymentRecord = {
      ...payment,
      status: 'verified',
      verifiedAt: command.verifiedAt,
      evidenceReviewedBy: command.reviewerId,
      evidenceReviewedAt: command.verifiedAt,
    };
    await this.repo.savePayment(updated);
    return this.success('inserted', settlementRecordFromPayment(updated), command.userId);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private toRecord(command: PaymentSettlementCommand): PaymentRecord {
    return {
      id: command.paymentId,
      userId: command.userId,
      invoiceId: command.invoiceId,
      clientId: command.clientId,
      amount: command.amountMinor / 100,
      amountMinor: command.amountMinor,
      currency: command.currency,
      method: command.method,
      receivedAt: command.receivedAt,
      note: command.note,
      createdAt: command.createdAt,
      status: command.status,
      idempotencyKey: command.idempotencyKey,
      detailsFingerprint: command.detailsFingerprint,
      evidenceKind: command.evidenceKind,
      evidenceReference: command.evidenceReference,
      evidenceReviewedBy: command.evidenceReviewedBy,
      evidenceReviewedAt: command.evidenceReviewedAt,
      verifiedAt: command.status === 'verified' ? command.evidenceReviewedAt : null,
    };
  }

  private async loadInvoice(
    userId: string,
    invoiceId: string,
  ): Promise<
    { ok: true; value: InvoiceSnapshot } | { ok: false; failure: PaymentSettlementResult }
  > {
    const result = await this.contentAgency.getInvoice(userId, invoiceId);
    if (!result.success || !result.data) {
      return {
        ok: false,
        failure: { ok: false, code: 'INVOICE_NOT_FOUND', error: 'Invoice not found.' },
      };
    }
    return { ok: true, value: result.data as unknown as InvoiceSnapshot };
  }

  private async success(
    outcome: 'inserted' | 'duplicate',
    payment: PaymentSettlementRecord,
    userId: string,
  ): Promise<PaymentSettlementResult> {
    const invoice = await this.loadInvoice(userId, payment.invoiceId);
    if (!invoice.ok) return invoice.failure;

    const invoiceMinor = toMinorUnits(invoice.value.amount);
    const invoiceAmountMinor = invoiceMinor.ok ? invoiceMinor.minor : 0;
    const persisted = await this.repo.listPaymentsByInvoice(payment.invoiceId, userId);
    let verifiedTotalMinor = 0;
    let recordedTotalMinor = 0;
    for (const row of persisted) {
      const minor = row.amountMinor ?? Math.round(row.amount * 100);
      const status = row.status ?? 'recorded';
      recordedTotalMinor += minor;
      if (status === 'verified') verifiedTotalMinor += minor;
    }
    const settled = invoiceAmountMinor > 0 && verifiedTotalMinor >= invoiceAmountMinor;
    let invoiceStatus = (invoice.value.status ?? 'sent') as 'draft' | 'sent' | 'paid';
    if (settled && invoiceStatus !== 'paid') {
      const updated = await this.contentAgency.updateInvoiceStatus(
        userId,
        payment.invoiceId,
        'paid',
      );
      // The double cannot roll back a written row, so it reports the failure
      // instead of pretending the invoice settled. The PostgreSQL settlement
      // does not need this branch: the whole unit of work rolls back.
      if (!updated.success) {
        return {
          ok: false,
          code: 'SETTLEMENT_FAILED',
          error: 'Payment was recorded but the invoice could not be marked paid.',
          payment,
        };
      }
      invoiceStatus = 'paid';
    }
    return {
      ok: true,
      outcome,
      payment,
      invoiceStatus,
      verifiedTotalMinor,
      recordedTotalMinor,
      invoiceAmountMinor,
      settled,
    };
  }
}
