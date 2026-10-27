// ──────────────────────────────────────────────────────────────────
// VedMoulya — PostgreSQL Payment Settlement
// MISSION 002 (2026-10-26) — atomic, idempotent, evidence-gated payments.
//
// ONE database transaction performs the whole unit of work:
//
//   1. `SELECT … FOR UPDATE` the invoice row  (serializes settlement per invoice)
//   2. resolve the idempotency key            (retry → original payment)
//   3. validate invoice currency + state
//   4. INSERT the payment (unique key enforced by the database, not by us)
//   5. recompute verified/recorded totals    (SUM over persisted rows only)
//   6. UPDATE the invoice to `paid`           (only from the recomputed total)
//
// If any step throws, PostgreSQL rolls back BOTH the payment insert and the
// invoice update — there is no application-level compensation anywhere.
//
// Money never touches binary floating point here: amounts are integer minor
// units (`amount_minor`), summed by PostgreSQL. The legacy `amount` float is
// written as a display mirror only.
// ──────────────────────────────────────────────────────────────────

import { and, eq, sql } from 'drizzle-orm';
import type {
  PaymentEvidenceKind,
  PaymentSettlementCommand,
  PaymentSettlementPort,
  PaymentSettlementRecord,
  PaymentSettlementResult,
  PaymentStatus,
  PaymentVerificationCommand,
} from '@vedmoulya/domain';
import { getDatabase } from '../persistence/DatabaseConnection.js';
import { clientOpsPayments, contentAgencyInvoices } from '../../schema/content-agency.js';

type InvoiceRow = typeof contentAgencyInvoices.$inferSelect;
type PaymentRow = typeof clientOpsPayments.$inferSelect;

/** Duplicate-key error code from PostgreSQL. */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ((error as { code?: unknown }).code === UNIQUE_VIOLATION ||
      (error as { cause?: { code?: unknown } }).cause?.code === UNIQUE_VIOLATION)
  );
}

function invoiceMinor(invoice: Pick<InvoiceRow, 'amount' | 'amountMinor'>): number {
  if (typeof invoice.amountMinor === 'number') return invoice.amountMinor;
  return Math.round((invoice.amount ?? 0) * 100);
}

function toSettlementRecord(row: PaymentRow): PaymentSettlementRecord {
  const minor =
    typeof row.amountMinor === 'number' ? row.amountMinor : Math.round(row.amount * 100);
  return {
    id: row.id,
    userId: row.userId,
    invoiceId: row.invoiceId,
    clientId: row.clientId,
    amountMinor: minor,
    currency: row.currency ?? 'USD',
    method: row.method ?? '',
    receivedAt: row.receivedAt,
    note: row.note ?? '',
    createdAt: row.createdAt.toISOString(),
    idempotencyKey: row.idempotencyKey,
    detailsFingerprint: row.detailsFingerprint,
    evidenceKind: row.evidenceKind as PaymentEvidenceKind | null,
    evidenceReference: row.evidenceReference,
    evidenceReviewedBy: row.evidenceReviewedBy,
    evidenceReviewedAt: row.evidenceReviewedAt ? row.evidenceReviewedAt.toISOString() : null,
    status: row.status as PaymentStatus,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  };
}

/**
 * `amount_minor` when present, otherwise the legacy float column converted
 * inside PostgreSQL (`(amount * 100)::bigint` rounds). Pre-migration rows are
 * therefore still counted correctly without JS float arithmetic.
 */
const minorAmountSql = sql`COALESCE(${clientOpsPayments.amountMinor}, (${clientOpsPayments.amount} * 100)::bigint)`;

export class PostgresPaymentSettlement implements PaymentSettlementPort {
  async settle(command: PaymentSettlementCommand): Promise<PaymentSettlementResult> {
    try {
      return await getDatabase().transaction(async (tx) => {
        // 1. Lock the invoice. Concurrent payments for the same invoice queue
        //    here, so two requests can never both read the same old total.
        const invoices = await tx
          .select()
          .from(contentAgencyInvoices)
          .where(
            and(
              eq(contentAgencyInvoices.id, command.invoiceId),
              eq(contentAgencyInvoices.userId, command.userId),
            ),
          )
          .for('update')
          .limit(1);
        const invoice = invoices[0];
        if (!invoice) {
          return {
            ok: false as const,
            code: 'INVOICE_NOT_FOUND' as const,
            error: 'Invoice not found.',
          };
        }

        // 2. Idempotency — a retry resolves to the ORIGINAL row, whether or
        //    not the invoice has been settled in the meantime.
        const existing = await tx
          .select()
          .from(clientOpsPayments)
          .where(
            and(
              eq(clientOpsPayments.userId, command.userId),
              eq(clientOpsPayments.idempotencyKey, command.idempotencyKey),
            ),
          )
          .limit(1);
        if (existing[0]) {
          const record = toSettlementRecord(existing[0]);
          if (!sameDetails(record, command)) {
            return {
              ok: false as const,
              code: 'IDEMPOTENCY_CONFLICT' as const,
              error:
                'This idempotency key was already used for a payment with different details. Retry with the original payload or use a new key.',
              payment: record,
            };
          }
          return this.totals(tx, invoice, record, command.userId, 'duplicate');
        }

        // The evidence reference is independently unique per user: the same
        // receipt or processor transaction can never back two payments.
        const sameReference = await tx
          .select()
          .from(clientOpsPayments)
          .where(
            and(
              eq(clientOpsPayments.userId, command.userId),
              eq(clientOpsPayments.evidenceReference, command.evidenceReference),
            ),
          )
          .limit(1);
        if (sameReference[0]) {
          const record = toSettlementRecord(sameReference[0]);
          return {
            ok: false as const,
            code: 'IDEMPOTENCY_CONFLICT' as const,
            error: 'This payment evidence reference is already recorded on another payment.',
            payment: record,
          };
        }

        // 3. Invoice state.
        const currency = (invoice.currency ?? 'USD').toUpperCase();
        if (currency !== command.currency) {
          return {
            ok: false as const,
            code: 'CURRENCY_MISMATCH' as const,
            error: `Invoice is denominated in ${currency}; the payment is in ${command.currency}.`,
          };
        }
        if (invoice.status === 'paid') {
          return {
            ok: false as const,
            code: 'INVOICE_ALREADY_SETTLED' as const,
            error: 'Invoice is already settled — a further payment would double-count revenue.',
          };
        }

        // 4. Insert. The unique indexes are the real guarantee; the checks
        //    above only turn the common cases into good error messages.
        const inserted = await tx
          .insert(clientOpsPayments)
          .values({
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
            createdAt: new Date(command.createdAt),
            status: command.status,
            idempotencyKey: command.idempotencyKey,
            detailsFingerprint: command.detailsFingerprint,
            evidenceKind: command.evidenceKind,
            evidenceReference: command.evidenceReference,
            evidenceReviewedBy: command.evidenceReviewedBy,
            evidenceReviewedAt: command.evidenceReviewedAt
              ? new Date(command.evidenceReviewedAt)
              : null,
            verifiedAt: command.status === 'verified' ? new Date(command.createdAt) : null,
          })
          .returning();
        const row = inserted[0];
        if (!row) {
          return {
            ok: false as const,
            code: 'SETTLEMENT_FAILED' as const,
            error: 'Payment insert returned no row; nothing was committed.',
          };
        }

        // 5 + 6. Totals from persisted rows, then settle the invoice.
        return this.totals(tx, invoice, toSettlementRecord(row), command.userId, 'inserted');
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Lost a race against an identical concurrent request: the other
        // transaction won, nothing here was written. Resolve it as a retry.
        const winner = await this.findByIdempotencyKey(command.userId, command.idempotencyKey);
        if (winner) {
          if (!sameDetails(winner, command)) {
            return {
              ok: false,
              code: 'IDEMPOTENCY_CONFLICT',
              error: 'This idempotency key was already used for a payment with different details.',
              payment: winner,
            };
          }
          return this.replay(winner, command.userId);
        }
        return {
          ok: false,
          code: 'IDEMPOTENCY_CONFLICT',
          error:
            'This payment evidence reference is already recorded on another payment (concurrent duplicate).',
        };
      }
      throw error;
    }
  }

  async verify(command: PaymentVerificationCommand): Promise<PaymentSettlementResult> {
    return getDatabase().transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(clientOpsPayments)
        .where(
          and(
            eq(clientOpsPayments.id, command.paymentId),
            eq(clientOpsPayments.userId, command.userId),
          ),
        )
        .for('update')
        .limit(1);
      const payment = rows[0];
      if (!payment) {
        return {
          ok: false as const,
          code: 'PAYMENT_NOT_FOUND' as const,
          error: 'Payment not found.',
        };
      }
      if (payment.status === 'verified') {
        return {
          ok: false as const,
          code: 'PAYMENT_ALREADY_VERIFIED' as const,
          error: 'Payment is already verified.',
          payment: toSettlementRecord(payment),
        };
      }
      if (!payment.evidenceReference) {
        return {
          ok: false as const,
          code: 'PAYMENT_EVIDENCE_MISSING' as const,
          error: 'A payment cannot be verified without evidence on record.',
          payment: toSettlementRecord(payment),
        };
      }

      const updated = await tx
        .update(clientOpsPayments)
        .set({
          status: 'verified',
          evidenceReviewedBy: command.reviewerId,
          evidenceReviewedAt: new Date(command.verifiedAt),
          verifiedAt: new Date(command.verifiedAt),
        })
        .where(eq(clientOpsPayments.id, command.paymentId))
        .returning();
      const row = updated[0];
      if (!row) {
        return {
          ok: false as const,
          code: 'SETTLEMENT_FAILED' as const,
          error: 'Payment verification wrote no row.',
        };
      }

      const invoices = await tx
        .select()
        .from(contentAgencyInvoices)
        .where(
          and(
            eq(contentAgencyInvoices.id, row.invoiceId),
            eq(contentAgencyInvoices.userId, command.userId),
          ),
        )
        .for('update')
        .limit(1);
      const invoice = invoices[0];
      if (!invoice) {
        return {
          ok: false as const,
          code: 'INVOICE_NOT_FOUND' as const,
          error: 'Invoice for this payment no longer exists.',
        };
      }
      return this.totals(tx, invoice, toSettlementRecord(row), command.userId, 'inserted');
    });
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async totals(
    tx: Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0],
    invoice: InvoiceRow,
    payment: PaymentSettlementRecord,
    userId: string,
    outcome: 'inserted' | 'duplicate',
  ): Promise<PaymentSettlementResult> {
    const totals = await tx
      .select({
        verified: sql<string>`COALESCE(SUM(${minorAmountSql}) FILTER (WHERE ${clientOpsPayments.status} = 'verified'), 0)`,
        recorded: sql<string>`COALESCE(SUM(${minorAmountSql}), 0)`,
      })
      .from(clientOpsPayments)
      .where(
        and(
          eq(clientOpsPayments.invoiceId, payment.invoiceId),
          eq(clientOpsPayments.userId, userId),
        ),
      );
    const verifiedTotalMinor = Number(totals[0]?.verified ?? 0);
    const recordedTotalMinor = Number(totals[0]?.recorded ?? 0);
    const invoiceAmountMinor = invoiceMinor(invoice);
    const settled = invoiceAmountMinor > 0 && verifiedTotalMinor >= invoiceAmountMinor;

    let invoiceStatus = invoice.status as 'draft' | 'sent' | 'paid';
    if (settled && invoiceStatus !== 'paid') {
      await tx
        .update(contentAgencyInvoices)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(
          and(eq(contentAgencyInvoices.id, invoice.id), eq(contentAgencyInvoices.userId, userId)),
        );
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

  /** Re-read an already-committed payment after losing an insert race. */
  private async replay(
    payment: PaymentSettlementRecord,
    userId: string,
  ): Promise<PaymentSettlementResult> {
    const invoices = await getDatabase()
      .select()
      .from(contentAgencyInvoices)
      .where(
        and(
          eq(contentAgencyInvoices.id, payment.invoiceId),
          eq(contentAgencyInvoices.userId, userId),
        ),
      )
      .limit(1);
    const invoice = invoices[0];
    if (!invoice) {
      return { ok: false, code: 'INVOICE_NOT_FOUND', error: 'Invoice not found.' };
    }
    const totals = await getDatabase()
      .select({
        verified: sql<string>`COALESCE(SUM(${minorAmountSql}) FILTER (WHERE ${clientOpsPayments.status} = 'verified'), 0)`,
        recorded: sql<string>`COALESCE(SUM(${minorAmountSql}), 0)`,
      })
      .from(clientOpsPayments)
      .where(
        and(
          eq(clientOpsPayments.invoiceId, payment.invoiceId),
          eq(clientOpsPayments.userId, userId),
        ),
      );
    const invoiceAmountMinor = invoiceMinor(invoice);
    const verifiedTotalMinor = Number(totals[0]?.verified ?? 0);
    return {
      ok: true,
      outcome: 'duplicate',
      payment,
      invoiceStatus: invoice.status as 'draft' | 'sent' | 'paid',
      verifiedTotalMinor,
      recordedTotalMinor: Number(totals[0]?.recorded ?? 0),
      invoiceAmountMinor,
      settled: invoiceAmountMinor > 0 && verifiedTotalMinor >= invoiceAmountMinor,
    };
  }

  private async findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<PaymentSettlementRecord | null> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsPayments)
      .where(
        and(
          eq(clientOpsPayments.userId, userId),
          eq(clientOpsPayments.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    return rows[0] ? toSettlementRecord(rows[0]) : null;
  }
}

function sameDetails(stored: PaymentSettlementRecord, command: PaymentSettlementCommand): boolean {
  return (
    stored.invoiceId === command.invoiceId &&
    stored.amountMinor === command.amountMinor &&
    stored.currency === command.currency &&
    stored.method === command.method &&
    stored.receivedAt === command.receivedAt
  );
}
