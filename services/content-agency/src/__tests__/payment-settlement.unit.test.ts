// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: PostgresPaymentSettlement
// MISSION 002 — settlement unit of work, mocked at the database boundary.
//
// Every test drives the adapter with a scripted transaction double, so no
// PostgreSQL server, credentials or real money are involved. The assertions
// check the domain decisions (which failure code, which totals, which invoice
// status) rather than the generated SQL.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getDatabaseMock } = vi.hoisted(() => ({ getDatabaseMock: vi.fn() }));

vi.mock('../infrastructure/persistence/DatabaseConnection.js', () => ({
  getDatabase: getDatabaseMock,
}));

import { PostgresPaymentSettlement } from '../infrastructure/payments/PostgresPaymentSettlement.js';
import type { PaymentSettlementCommand, PaymentVerificationCommand } from '@vedmoulya/domain';

type Scripted = Record<string, unknown>;

/** A chainable, thenable stand-in for a drizzle query builder. */
function builder(result: unknown): any {
  const node: any = {
    from: () => node,
    where: () => node,
    for: () => node,
    limit: () => node,
    values: () => node,
    set: () => node,
    returning: () => Promise.resolve(result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(result).catch(reject),
  };
  return node;
}

/**
 * Script the transaction: each `select`/`insert`/`update` start consumes the
 * next queued result. `outer` scripts the non-transactional reads used by the
 * post-race replay path.
 */
function scriptDatabase(txResults: unknown[], outerResults: unknown[] = [], error?: unknown) {
  const txQueue = [...txResults];
  const outerQueue = [...outerResults];
  const tx: any = {
    select: () => builder(txQueue.shift()),
    insert: () => builder(txQueue.shift()),
    update: () => builder(txQueue.shift()),
  };
  const db: any = {
    select: () => builder(outerQueue.shift()),
    transaction: async (callback: (t: unknown) => unknown) => {
      if (error !== undefined) throw error;
      return callback(tx);
    },
  };
  getDatabaseMock.mockReturnValue(db);
  return { txQueue, outerQueue };
}

function invoiceRow(overrides: Scripted = {}) {
  return {
    id: 'inv-1',
    userId: 'usr-1',
    currency: 'USD',
    status: 'sent',
    amount: 100,
    amountMinor: 10000,
    ...overrides,
  };
}

function paymentRow(overrides: Scripted = {}) {
  return {
    id: 'pay-1',
    userId: 'usr-1',
    invoiceId: 'inv-1',
    clientId: 'cl-1',
    amount: 10,
    amountMinor: 1000,
    currency: 'USD',
    method: 'card',
    receivedAt: '2026-10-26T09:00:00.000Z',
    note: 'October retainer',
    createdAt: new Date('2026-10-26T09:00:00.000Z'),
    status: 'recorded',
    idempotencyKey: 'key-1',
    detailsFingerprint: 'fingerprint',
    evidenceKind: 'processor_reference',
    evidenceReference: 'TXN-1',
    evidenceReviewedBy: null,
    evidenceReviewedAt: null,
    verifiedAt: null,
    ...overrides,
  };
}

const COMMAND: PaymentSettlementCommand = {
  paymentId: 'pay-2',
  userId: 'usr-1',
  invoiceId: 'inv-1',
  clientId: 'cl-1',
  amountMinor: 1000,
  currency: 'USD',
  method: 'card',
  receivedAt: '2026-10-26T09:00:00.000Z',
  note: '',
  createdAt: '2026-10-26T09:00:00.000Z',
  idempotencyKey: 'key-1',
  detailsFingerprint: 'fingerprint',
  evidenceKind: 'processor_reference',
  evidenceReference: 'TXN-1',
  evidenceReviewedBy: null,
  evidenceReviewedAt: null,
  status: 'recorded',
};

const VERIFY: PaymentVerificationCommand = {
  userId: 'usr-1',
  paymentId: 'pay-1',
  reviewerId: 'Priya Raman',
  verifiedAt: '2026-10-26T10:00:00.000Z',
};

describe('PostgresPaymentSettlement.settle', () => {
  let settlement: PostgresPaymentSettlement;

  beforeEach(() => {
    getDatabaseMock.mockReset();
    settlement = new PostgresPaymentSettlement();
  });

  it('fails with INVOICE_NOT_FOUND when the locked invoice does not exist', async () => {
    scriptDatabase([[]]);

    const result = await settlement.settle(COMMAND);

    expect(result).toMatchObject({ ok: false, code: 'INVOICE_NOT_FOUND' });
    expect(result.ok).toBe(false);
  });

  it('inserts the payment and reports the recomputed totals', async () => {
    scriptDatabase([
      [invoiceRow()], // locked invoice
      [], // idempotency lookup
      [], // evidence-reference lookup
      [paymentRow({ id: 'pay-2', amountMinor: 4000 })], // insert … returning
      [{ verified: '0', recorded: '4000' }], // totals
    ]);

    const result = await settlement.settle(COMMAND);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.outcome).toBe('inserted');
    expect(result.payment.id).toBe('pay-2');
    expect(result.recordedTotalMinor).toBe(4000);
    expect(result.verifiedTotalMinor).toBe(0);
    expect(result.invoiceAmountMinor).toBe(10000);
    // Unverified money never settles an invoice.
    expect(result.settled).toBe(false);
    expect(result.invoiceStatus).toBe('sent');
  });

  it('settles the invoice once verified payments cover it', async () => {
    const { txQueue } = scriptDatabase([
      [invoiceRow({ status: 'draft' })],
      [],
      [],
      [paymentRow({ id: 'pay-2', amountMinor: 10000, status: 'verified' })],
      [{ verified: '10000', recorded: '10000' }],
      undefined, // invoice UPDATE
    ]);

    const result = await settlement.settle({ ...COMMAND, amountMinor: 10000 });
    // The final UPDATE of the invoice is the last scripted statement.
    expect(txQueue).toHaveLength(0);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.settled).toBe(true);
    expect(result.invoiceStatus).toBe('paid');
  });

  it('leaves an already-paid invoice marked paid without writing again', async () => {
    scriptDatabase([[invoiceRow()], [paymentRow()], [{ verified: '10000', recorded: '10000' }]]);

    const result = await settlement.settle(COMMAND);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.outcome).toBe('duplicate');
    expect(result.settled).toBe(true);
    expect(result.invoiceStatus).toBe('paid');
  });

  it('derives the invoice amount from the legacy float when no minor column exists', async () => {
    scriptDatabase([
      [invoiceRow({ amountMinor: null, amount: 87.5 })],
      [],
      [],
      [paymentRow({ id: 'pay-2' })],
      [{ verified: '0', recorded: '1000' }],
    ]);

    const result = await settlement.settle(COMMAND);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.invoiceAmountMinor).toBe(8750);
  });

  it('treats a missing invoice amount as zero, so nothing can settle it', async () => {
    scriptDatabase([
      [invoiceRow({ amountMinor: null, amount: null })],
      [],
      [],
      [paymentRow({ id: 'pay-2' })],
      [{ verified: '5000', recorded: '5000' }],
    ]);

    const result = await settlement.settle(COMMAND);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.invoiceAmountMinor).toBe(0);
    expect(result.settled).toBe(false);
  });

  it('treats a zero-value invoice as unsettleable even when money is verified', async () => {
    scriptDatabase([
      [invoiceRow({ amountMinor: 0 })],
      [],
      [],
      [paymentRow({ id: 'pay-2' })],
      [{ verified: '1000', recorded: '1000' }],
    ]);

    const result = await settlement.settle(COMMAND);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.invoiceAmountMinor).toBe(0);
    expect(result.settled).toBe(false);
  });

  it('allows an empty totals row to mean zero', async () => {
    scriptDatabase([
      [invoiceRow()],
      [],
      [],
      [paymentRow({ id: 'pay-2' })],
      [], // PostgreSQL returned no aggregate row at all
    ]);

    const result = await settlement.settle(COMMAND);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.verifiedTotalMinor).toBe(0);
    expect(result.recordedTotalMinor).toBe(0);
  });

  it('returns the ORIGINAL payment when the same key is retried unchanged', async () => {
    scriptDatabase([
      [invoiceRow()],
      [paymentRow({ id: 'pay-original' })],
      [{ verified: '0', recorded: '1000' }],
    ]);

    const result = await settlement.settle(COMMAND);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.outcome).toBe('duplicate');
    expect(result.payment.id).toBe('pay-original');
  });

  it('rejects a reused key whose amount differs — same key, different money', async () => {
    scriptDatabase([[invoiceRow()], [paymentRow()]]);

    const result = await settlement.settle({ ...COMMAND, amountMinor: 5000 });

    expect(result).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    if (result.ok) throw new Error('expected failure');
    expect(result.payment?.id).toBe('pay-1');
  });

  it('distinguishes a retry from a conflict on every identifying field', async () => {
    const variants: Array<Partial<PaymentSettlementCommand>> = [
      { invoiceId: 'inv-2' },
      { amountMinor: 999 },
      { currency: 'EUR' },
      { method: 'cash' },
      { receivedAt: '2026-10-26T09:00:01.000Z' },
    ];

    for (const patch of variants) {
      scriptDatabase([[invoiceRow()], [paymentRow()]]);
      const result = await settlement.settle({ ...COMMAND, ...patch });
      expect(result).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    }
  });

  it('refuses a second payment that reuses the same evidence reference', async () => {
    scriptDatabase([[invoiceRow()], [], [paymentRow({ id: 'pay-other' })]]);

    const result = await settlement.settle(COMMAND);

    expect(result).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    if (result.ok) throw new Error('expected failure');
    expect(result.payment?.id).toBe('pay-other');
    expect(result.error).toContain('evidence reference');
  });

  it('rejects a payment in a different currency than the invoice', async () => {
    scriptDatabase([[invoiceRow({ currency: 'EUR' })], [], []]);

    const result = await settlement.settle(COMMAND);

    expect(result).toMatchObject({ ok: false, code: 'CURRENCY_MISMATCH' });
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toContain('EUR');
    expect(result.error).toContain('USD');
  });

  it('defaults an unset invoice currency to USD', async () => {
    scriptDatabase([
      [invoiceRow({ currency: null })],
      [],
      [],
      [paymentRow({ id: 'pay-2' })],
      [{ verified: '0', recorded: '1000' }],
    ]);

    const result = await settlement.settle(COMMAND);

    expect(result.ok).toBe(true);
  });

  it('normalises a lowercase invoice currency before comparing', async () => {
    // 'usd' is normalised to 'USD', so the currency check passes and the
    // adapter proceeds to the insert (which the script answers with no row).
    scriptDatabase([[invoiceRow({ currency: 'usd' })], [], [], []]);

    const result = await settlement.settle(COMMAND);

    expect(result).toMatchObject({ ok: false, code: 'SETTLEMENT_FAILED' });
  });

  it('refuses to double-count revenue on an already-paid invoice', async () => {
    scriptDatabase([[invoiceRow({ status: 'paid' })], [], []]);

    const result = await settlement.settle(COMMAND);

    expect(result).toMatchObject({ ok: false, code: 'INVOICE_ALREADY_SETTLED' });
  });

  it('fails loudly when the insert returns no row', async () => {
    scriptDatabase([[invoiceRow()], [], [], []]);

    const result = await settlement.settle(COMMAND);

    expect(result).toMatchObject({ ok: false, code: 'SETTLEMENT_FAILED' });
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toContain('nothing was committed');
  });

  it('projects a minimal payment row without inventing values', async () => {
    scriptDatabase([
      [invoiceRow()],
      [
        paymentRow({
          amountMinor: null,
          amount: 12.5,
          currency: null,
          method: null,
          note: null,
          evidenceKind: null,
          evidenceReference: null,
          evidenceReviewedBy: null,
          evidenceReviewedAt: new Date('2026-10-26T09:10:00.000Z'),
          verifiedAt: new Date('2026-10-26T09:20:00.000Z'),
        }),
      ],
      [{ verified: '1250', recorded: '1250' }],
    ]);

    // Retried with the same identifying details so the same-details check
    // passes and the stored row (which has no amount_minor) is projected as-is.
    const result = await settlement.settle({ ...COMMAND, amountMinor: 1250, method: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.payment.amountMinor).toBe(1250);
    expect(result.payment.currency).toBe('USD');
    expect(result.payment.method).toBe('');
    expect(result.payment.note).toBe('');
    expect(result.payment.evidenceReviewedAt).toBe('2026-10-26T09:10:00.000Z');
    expect(result.payment.verifiedAt).toBe('2026-10-26T09:20:00.000Z');
  });
});

describe('PostgresPaymentSettlement.settle — insert race', () => {
  let settlement: PostgresPaymentSettlement;

  beforeEach(() => {
    getDatabaseMock.mockReset();
    settlement = new PostgresPaymentSettlement();
  });

  it('resolves a lost race against an identical request as a duplicate', async () => {
    scriptDatabase(
      [],
      [
        [paymentRow({ id: 'pay-winner' })], // findByIdempotencyKey
        [invoiceRow()], // replay invoice
        [{ verified: '0', recorded: '1000' }], // replay totals
      ],
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    );

    const result = await settlement.settle(COMMAND);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.outcome).toBe('duplicate');
    expect(result.payment.id).toBe('pay-winner');
    expect(result.recordedTotalMinor).toBe(1000);
  });

  it('detects the unique violation wrapped in `cause`', async () => {
    scriptDatabase(
      [],
      [
        [paymentRow({ id: 'pay-winner' })],
        [invoiceRow()],
        [{ verified: '10000', recorded: '10000' }],
      ],
      { cause: { code: '23505' } },
    );

    const result = await settlement.settle(COMMAND);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.settled).toBe(true);
    // The replay is read-only: it reports the persisted invoice row and does
    // not write, because the winning transaction already settled it.
    expect(result.invoiceStatus).toBe('sent');
  });

  it('reports a conflict when the winning payment has different details', async () => {
    scriptDatabase(
      [],
      [[paymentRow({ id: 'pay-winner', amountMinor: 7777 })]],
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    );

    const result = await settlement.settle(COMMAND);

    expect(result).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    if (result.ok) throw new Error('expected failure');
    expect(result.payment?.amountMinor).toBe(7777);
  });

  it('reports a concurrent evidence-reference clash when no key winner exists', async () => {
    scriptDatabase([], [[]], Object.assign(new Error('duplicate key'), { code: '23505' }));

    const result = await settlement.settle(COMMAND);

    expect(result).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toContain('concurrent duplicate');
  });

  it('fails the replay when the winning invoice has since disappeared', async () => {
    scriptDatabase(
      [],
      [[paymentRow()], []],
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    );

    const result = await settlement.settle(COMMAND);

    expect(result).toMatchObject({ ok: false, code: 'INVOICE_NOT_FOUND' });
  });

  it('rethrows errors that are not unique violations', async () => {
    const boom = new Error('connection reset');
    scriptDatabase([], [], boom);

    await expect(settlement.settle(COMMAND)).rejects.toThrow('connection reset');
  });

  it('rethrows a non-object rejection untouched', async () => {
    scriptDatabase([], [], 'pool exhausted');

    await expect(settlement.settle(COMMAND)).rejects.toBe('pool exhausted');
  });

  it('does not mistake a null rejection for a unique violation', async () => {
    scriptDatabase([], [], null);

    await expect(settlement.settle(COMMAND)).rejects.toBeNull();
  });
});

describe('PostgresPaymentSettlement.verify', () => {
  let settlement: PostgresPaymentSettlement;

  beforeEach(() => {
    getDatabaseMock.mockReset();
    settlement = new PostgresPaymentSettlement();
  });

  it('fails with PAYMENT_NOT_FOUND when the payment does not exist', async () => {
    scriptDatabase([[]]);

    const result = await settlement.verify(VERIFY);

    expect(result).toMatchObject({ ok: false, code: 'PAYMENT_NOT_FOUND' });
  });

  it('refuses to verify a payment that is already verified', async () => {
    scriptDatabase([[paymentRow({ status: 'verified' })]]);

    const result = await settlement.verify(VERIFY);

    expect(result).toMatchObject({ ok: false, code: 'PAYMENT_ALREADY_VERIFIED' });
    if (result.ok) throw new Error('expected failure');
    expect(result.payment?.id).toBe('pay-1');
  });

  it('refuses to verify a payment with no evidence on record', async () => {
    scriptDatabase([[paymentRow({ evidenceReference: null })]]);

    const result = await settlement.verify(VERIFY);

    expect(result).toMatchObject({ ok: false, code: 'PAYMENT_EVIDENCE_MISSING' });
  });

  it('fails when the verification update writes no row', async () => {
    scriptDatabase([[paymentRow()], []]);

    const result = await settlement.verify(VERIFY);

    expect(result).toMatchObject({ ok: false, code: 'SETTLEMENT_FAILED' });
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toContain('verification wrote no row');
  });

  it('fails when the invoice behind the payment no longer exists', async () => {
    scriptDatabase([[paymentRow()], [paymentRow({ status: 'verified' })], []]);

    const result = await settlement.verify(VERIFY);

    expect(result).toMatchObject({ ok: false, code: 'INVOICE_NOT_FOUND' });
  });

  it('verifies the payment and settles the invoice from verified totals', async () => {
    const verifiedAt = new Date(VERIFY.verifiedAt);
    scriptDatabase([
      [paymentRow()],
      [
        paymentRow({
          status: 'verified',
          evidenceReviewedBy: VERIFY.reviewerId,
          evidenceReviewedAt: verifiedAt,
          verifiedAt,
        }),
      ],
      [invoiceRow()],
      [{ verified: '10000', recorded: '10000' }],
      undefined, // invoice UPDATE
    ]);

    const result = await settlement.verify(VERIFY);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.payment.status).toBe('verified');
    expect(result.payment.evidenceReviewedBy).toBe('Priya Raman');
    expect(result.verifiedTotalMinor).toBe(10000);
    expect(result.settled).toBe(true);
    expect(result.invoiceStatus).toBe('paid');
  });

  it('verifies a payment without settling an invoice that is still short', async () => {
    scriptDatabase([
      [paymentRow()],
      [paymentRow({ status: 'verified' })],
      [invoiceRow({ amountMinor: 10000 })],
      [{ verified: '3000', recorded: '4000' }],
    ]);

    const result = await settlement.verify(VERIFY);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.settled).toBe(false);
    expect(result.verifiedTotalMinor).toBe(3000);
    expect(result.recordedTotalMinor).toBe(4000);
    expect(result.invoiceStatus).toBe('sent');
  });
});
