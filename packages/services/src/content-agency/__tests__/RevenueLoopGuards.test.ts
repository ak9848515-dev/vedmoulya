// ──────────────────────────────────────────────────────────────────
// VedMoulya — Revenue loop guards
// EPIC-003 / SPRINT AC-002, hardened by MISSION 002 (2026-10-26).
//
// These tests run the REAL application services over the REAL in-memory
// repositories (no stubbed getInvoice), so invoice state actually flows:
//   createClient → createInvoice → addPayment → reviewPayment → status
//
// MISSION 001 pinned two gaps as "current behaviour": duplicate payments
// double-counted revenue, and a payment needed no evidence at all. Both are
// CLOSED now, so this suite asserts the hardened contract instead:
//   • evidence is mandatory and validated against the payment method;
//   • only an operator-reviewed (verified) payment counts as revenue or
//     settles an invoice;
//   • a retried payment resolves to the original row.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PaymentEvidence } from '@vedmoulya/domain';
import { InMemoryClientOpsRepository } from '../InMemoryClientOpsRepository.js';
import { InMemoryContentAgencyRepository } from '../InMemoryContentAgencyRepository.js';
import { ClientOperationsApplicationService } from '../ClientOperationsApplicationService.js';
import { ContentAgencyApplicationService } from '../ContentAgencyApplicationService.js';
import type { ClientOpsAIService } from '../ClientOpsAIService.js';
import type { ContentAgencyAIService } from '../ContentAgencyAIService.js';
import type { ClientOpsRepository } from '../ClientOpsRepository.js';

const USER = 'guard_user';
const REVIEWER = 'operator-ana';

const aiStub = new Proxy(
  {},
  {
    get: () => () => Promise.reject(new Error('AI is not part of this test')),
  },
) as unknown as ContentAgencyAIService;

interface Harness {
  contentAgency: ContentAgencyApplicationService;
  clientOps: ClientOperationsApplicationService;
  clientOpsRepo: InMemoryClientOpsRepository;
}

function makeHarness(clientOpsRepo = new InMemoryClientOpsRepository()): Harness {
  const contentAgency = new ContentAgencyApplicationService(
    new InMemoryContentAgencyRepository(),
    aiStub,
  );
  const clientOpsAi = {
    generateProposal: vi.fn().mockRejectedValue(new Error('AI is not part of this test')),
  } as unknown as ClientOpsAIService;
  return {
    contentAgency,
    clientOps: new ClientOperationsApplicationService(clientOpsRepo, contentAgency, clientOpsAi),
    clientOpsRepo,
  };
}

async function seedInvoice(
  harness: Harness,
  amount: number,
  description = 'guard fixture',
): Promise<{ clientId: string; invoiceId: string }> {
  const client = await harness.contentAgency.createClient(USER, {
    company: 'Guard Fixture Co',
  });
  if (!client.success || !client.data) throw new Error('client creation failed');
  const clientId = client.data.id;

  const invoice = await harness.contentAgency.createInvoice(USER, {
    clientId,
    description,
    amount,
    currency: 'USD',
    status: 'sent',
  });
  if (!invoice.success || !invoice.data) throw new Error('invoice creation failed');
  return { clientId, invoiceId: invoice.data.id };
}

let referenceSeq = 0;
/** Unique, plausible processor reference (the evidence doubles as the key). */
function processorEvidence(reviewed = true): PaymentEvidence {
  referenceSeq += 1;
  const reference = `TXN-2026-${String(referenceSeq).padStart(6, '0')}`;
  return reviewed
    ? { kind: 'processor_reference', reference, reviewedBy: REVIEWER }
    : { kind: 'processor_reference', reference };
}

describe('invoice persistence through the real service chain', () => {
  it('creates an invoice that can be read back with its exact amount and currency', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 1234.56);

    const read = await harness.contentAgency.getInvoice(USER, invoiceId);
    expect(read.success).toBe(true);
    expect(read.data?.amount).toBe(1234.56);
    expect(read.data?.currency).toBe('USD');
    expect(read.data?.status).toBe('sent');
  });

  it('scopes invoices to their owner', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    const other = await harness.contentAgency.getInvoice('someone_else', invoiceId);
    expect(other.success).toBe(false);
  });
});

describe('payment coverage (verified payments only)', () => {
  it('does not settle an invoice on a partial payment', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 500);

    const payment = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 200,
      method: 'bank_transfer',
      evidence: processorEvidence(),
    });
    expect(payment.success).toBe(true);
    expect(payment.data?.status).toBe('verified');

    const invoice = await harness.contentAgency.getInvoice(USER, invoiceId);
    expect(invoice.data?.status).toBe('sent');
  });

  it('settles the invoice once verified payments cover the amount', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 500);

    await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 200,
      evidence: processorEvidence(),
    });
    await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 300,
      evidence: processorEvidence(),
    });

    const invoice = await harness.contentAgency.getInvoice(USER, invoiceId);
    expect(invoice.data?.status).toBe('paid');
  });

  it('does not settle an invoice that is one cent short', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 99.99,
      evidence: processorEvidence(),
    });

    const invoice = await harness.contentAgency.getInvoice(USER, invoiceId);
    expect(invoice.data?.status).toBe('sent');
  });

  it('settles a coin-level split without float drift (0.10 + 0.20 on 0.30)', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 0.3);

    await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 0.1,
      evidence: processorEvidence(),
    });
    await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 0.2,
      evidence: processorEvidence(),
    });

    const invoice = await harness.contentAgency.getInvoice(USER, invoiceId);
    expect(invoice.data?.status).toBe('paid');

    const overview = await harness.clientOps.getRevenueOverview(USER);
    expect(overview.data?.paidTotal).toBe(0.3);
  });

  it('refuses a zero or negative payment', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    const zero = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 0,
      evidence: processorEvidence(),
    });
    const negative = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: -5,
      evidence: processorEvidence(),
    });

    expect(zero.success).toBe(false);
    expect(negative.success).toBe(false);
    const payments = await harness.clientOps.listPayments(USER);
    expect(payments.data ?? []).toHaveLength(0);
  });

  it('refuses a payment against an invoice that does not exist', async () => {
    const harness = makeHarness();
    const result = await harness.clientOps.addPayment(USER, {
      invoiceId: 'inv_missing',
      amount: 10,
      evidence: processorEvidence(),
    });
    expect(result.success).toBe(false);
  });

  it('refuses an amount with more precision than the currency scale', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    const result = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 10.005,
      evidence: processorEvidence(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/decimal places/i);
    expect((await harness.clientOps.listPayments(USER)).data ?? []).toHaveLength(0);
  });
});

describe('payment evidence is mandatory and method-appropriate', () => {
  it('rejects a payment with no evidence at all', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    const result = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      // @ts-expect-error — the contract requires evidence; this proves the
      // runtime guard refuses a caller that bypasses the types.
      evidence: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/evidence is required/i);
    expect((await harness.clientOps.listPayments(USER)).data ?? []).toHaveLength(0);
  });

  it('rejects placeholder and payload-echoing references', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    const placeholder = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      evidence: { kind: 'processor_reference', reference: 'test', reviewedBy: REVIEWER },
    });
    const echo = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      evidence: { kind: 'processor_reference', reference: invoiceId, reviewedBy: REVIEWER },
    });

    expect(placeholder.success).toBe(false);
    expect(echo.success).toBe(false);
    expect((await harness.clientOps.listPayments(USER)).data ?? []).toHaveLength(0);
  });

  it('rejects a cash payment with a processor reference', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    const result = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      method: 'cash',
      evidence: processorEvidence(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/manual receipt/i);
  });

  it('requires an operator to have reviewed a manual receipt', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    const unreviewed = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      method: 'cash',
      evidence: { kind: 'manual_receipt', reference: 'RECEIPT-2026-0042' },
    });
    expect(unreviewed.success).toBe(false);
    expect(unreviewed.error).toMatch(/reviewed/i);

    const reviewed = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      method: 'cash',
      evidence: {
        kind: 'manual_receipt',
        reference: 'RECEIPT-2026-0042',
        reviewedBy: REVIEWER,
      },
    });
    expect(reviewed.success).toBe(true);
    expect(reviewed.data?.status).toBe('verified');
  });

  it('rejects a payment in a different currency from the invoice', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    const result = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      currency: 'EUR',
      evidence: processorEvidence(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/denominated in USD/i);
  });
});

describe('recorded vs verified: unsupported revenue is never claimed', () => {
  it('records unreviewed evidence without settling the invoice or counting revenue', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    const recorded = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      evidence: processorEvidence(false),
    });
    expect(recorded.success).toBe(true);
    expect(recorded.data?.status).toBe('recorded');

    const invoice = await harness.contentAgency.getInvoice(USER, invoiceId);
    expect(invoice.data?.status).toBe('sent');

    const overview = await harness.clientOps.getRevenueOverview(USER);
    expect(overview.data?.paidTotal).toBe(0);
    expect(overview.data?.recordedTotal).toBe(100);
    expect(overview.data?.unverifiedTotal).toBe(100);

    const reviewed = await harness.clientOps.reviewPayment(USER, {
      paymentId: recorded.data?.id ?? '',
      reviewerId: REVIEWER,
    });
    expect(reviewed.success).toBe(true);
    expect(reviewed.data?.status).toBe('verified');

    const settled = await harness.contentAgency.getInvoice(USER, invoiceId);
    expect(settled.data?.status).toBe('paid');

    const after = await harness.clientOps.getRevenueOverview(USER);
    expect(after.data?.paidTotal).toBe(100);
    expect(after.data?.unverifiedTotal).toBe(0);
  });

  it('refuses to verify the same payment twice', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);
    const recorded = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      evidence: processorEvidence(false),
    });
    const paymentId = recorded.data?.id ?? '';

    await harness.clientOps.reviewPayment(USER, { paymentId, reviewerId: REVIEWER });
    const again = await harness.clientOps.reviewPayment(USER, { paymentId, reviewerId: REVIEWER });

    expect(again.success).toBe(false);
    expect(again.error).toMatch(/already verified/i);
  });

  it('refuses an anonymous reviewer', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);
    const recorded = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      evidence: processorEvidence(false),
    });

    const result = await harness.clientOps.reviewPayment(USER, {
      paymentId: recorded.data?.id ?? '',
      reviewerId: 'n/a',
    });
    expect(result.success).toBe(false);
  });
});

describe('idempotency — a retried payment is recorded once', () => {
  it('returns the original payment for a sequential retry', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);
    const evidence = processorEvidence();
    const payload = { invoiceId, amount: 100, evidence };

    const first = await harness.clientOps.addPayment(USER, payload);
    const second = await harness.clientOps.addPayment(USER, payload);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.data?.id).toBe(first.data?.id);
    expect(second.data?.duplicate).toBe(true);

    const payments = (await harness.clientOps.listPayments(USER)).data ?? [];
    expect(payments.filter((p) => p.invoiceId === invoiceId)).toHaveLength(1);

    const overview = await harness.clientOps.getRevenueOverview(USER);
    expect(overview.data?.paidTotal).toBe(100);
  });

  it('honours an explicit idempotency key across differing evidence text', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    const first = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      idempotencyKey: 'client-retry-0001',
      evidence: { kind: 'processor_reference', reference: 'TXN-RETRY-AAA1', reviewedBy: REVIEWER },
    });
    const second = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      idempotencyKey: 'client-retry-0001',
      evidence: { kind: 'processor_reference', reference: 'TXN-RETRY-AAA1', reviewedBy: REVIEWER },
    });

    expect(second.success).toBe(true);
    expect(second.data?.id).toBe(first.data?.id);
    expect((await harness.clientOps.listPayments(USER)).data ?? []).toHaveLength(1);
  });

  it('rejects reuse of a key with conflicting payment details', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);

    await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 40,
      idempotencyKey: 'client-retry-0002',
      evidence: processorEvidence(),
    });
    const conflicting = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 60,
      idempotencyKey: 'client-retry-0002',
      evidence: processorEvidence(),
    });

    expect(conflicting.success).toBe(false);
    expect(conflicting.error).toMatch(/different details/i);
    expect((await harness.clientOps.listPayments(USER)).data ?? []).toHaveLength(1);
  });
});

describe('failure handling never reports false success', () => {
  it('returns a failure and leaves the invoice unsettled when the payment write throws', async () => {
    const repo = new InMemoryClientOpsRepository();
    vi.spyOn(repo, 'savePayment').mockRejectedValue(new Error('database is down'));
    const harness = makeHarness(repo);
    const { invoiceId } = await seedInvoice(harness, 100);

    await expect(
      harness.clientOps.addPayment(USER, {
        invoiceId,
        amount: 100,
        evidence: processorEvidence(),
      }),
    ).rejects.toThrow();

    const invoice = await harness.contentAgency.getInvoice(USER, invoiceId);
    expect(invoice.data?.status).toBe('sent');
  });

  it('reports failure when the invoice status cannot be updated', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 100);
    vi.spyOn(harness.contentAgency, 'updateInvoiceStatus').mockResolvedValue({
      success: false,
      error: 'invoice update failed',
    });

    const result = await harness.clientOps.addPayment(USER, {
      invoiceId,
      amount: 100,
      evidence: processorEvidence(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('could not be marked paid');
    const invoice = await harness.contentAgency.getInvoice(USER, invoiceId);
    expect(invoice.data?.status).toBe('sent');
  });
});

describe('revenue overview reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts verified payments as revenue and leaves the rest outstanding', async () => {
    const harness = makeHarness();
    const paidInvoice = await seedInvoice(harness, 400, 'fully paid');
    const partialInvoice = await seedInvoice(harness, 500, 'partially paid');

    await harness.clientOps.addPayment(USER, {
      invoiceId: paidInvoice.invoiceId,
      amount: 400,
      evidence: processorEvidence(),
    });
    await harness.clientOps.addPayment(USER, {
      invoiceId: partialInvoice.invoiceId,
      amount: 200,
      evidence: processorEvidence(),
    });

    const overview = await harness.clientOps.getRevenueOverview(USER);

    expect(overview.success).toBe(true);
    expect(overview.data?.paidTotal).toBe(600);
    expect(overview.data?.outstanding).toBe(500);
    expect(overview.data?.paidCount).toBe(1);
    expect(overview.data?.pendingCount).toBe(1);
    expect(overview.data?.reconciliationDrift).toBe(0);
  });

  it('surfaces an invoice marked paid with no verified payment as reconciliation drift', async () => {
    const harness = makeHarness();
    const { invoiceId } = await seedInvoice(harness, 400);

    // A status flip that records no payment: the invoice claims paid, revenue
    // has no verified money behind it.
    await harness.contentAgency.updateInvoiceStatus(USER, invoiceId, 'paid');

    const overview = await harness.clientOps.getRevenueOverview(USER);
    expect(overview.data?.paidTotal).toBe(0);
    expect(overview.data?.reconciliationDrift).toBe(400);
  });

  it('reports zero revenue for a user with no payments', async () => {
    const harness = makeHarness();
    const overview = await harness.clientOps.getRevenueOverview(USER);

    expect(overview.success).toBe(true);
    expect(overview.data?.paidTotal).toBe(0);
    expect(overview.data?.outstanding).toBe(0);
  });
});

describe('production refuses the non-atomic settlement', () => {
  it('throws when constructed without an atomic settlement port', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const contentAgency = new ContentAgencyApplicationService(
        new InMemoryContentAgencyRepository(),
        aiStub,
      );
      const ai = {
        generateProposal: vi.fn(),
      } as unknown as ClientOpsAIService;
      expect(
        () =>
          new ClientOperationsApplicationService(
            new InMemoryClientOpsRepository(),
            contentAgency,
            ai,
          ),
      ).toThrow(/atomic PaymentSettlementPort/);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('accepts an explicitly injected settlement port in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const contentAgency = new ContentAgencyApplicationService(
        new InMemoryContentAgencyRepository(),
        aiStub,
      );
      const repo = new InMemoryClientOpsRepository();
      const ai = { generateProposal: vi.fn() } as unknown as ClientOpsAIService;
      const settlement = {
        settle: vi.fn(),
        verify: vi.fn(),
      };
      expect(
        () => new ClientOperationsApplicationService(repo, contentAgency, ai, settlement),
      ).not.toThrow();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

// Type-check the port shape this suite depends on (a repository that fails
// writes must be expressible without touching production code).
const _portShape: Pick<ClientOpsRepository, 'savePayment' | 'listPaymentsByInvoice'> = {
  savePayment: async () => undefined,
  listPaymentsByInvoice: async () => [],
};
void _portShape;
