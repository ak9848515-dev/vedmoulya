// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.1 human commercial action + outcome reconciliation
//
// Proves the association/reconciliation boundary over the EXISTING canonical
// invoice/payment records:
//   • only the canonical invoice status decides the outcome status
//   • "invoice exists" never implies "paid"; a recorded payment is never
//     upgraded to proof of receipt on its own
//   • outcome / invoice / payment ownership is enforced (owner-scoped reads)
//   • the invoice client must match the delivered client
//   • repeated and concurrent reconciliation converge on ONE record
//   • no invoice/payment is created, no money moves, no secrets are stored
//   • S6.0 behavior is intact (a fresh outcome is COMMERCIAL_PENDING)
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentRecord } from '@vedmoulya/domain';
import { InMemoryCommercialOutcomeStore } from '@vedmoulya/control-plane';
import {
  CommercialOutcomeService,
  commercialOutcomeId,
  type CommercialInvoiceLookup,
  type CommercialInvoiceView,
  type CommercialPaymentLookup,
  type CommercialPaymentView,
} from '../services/CommercialOutcomeService.js';
import {
  handoffDocumentId,
  type ClientOpsDocumentStore,
  type HandoffMissionView,
  type MissionLookup,
} from '../services/MissionClientOpsHandoff.js';

const NOW = new Date('2026-10-06T09:00:00.000Z');
const USER = 'u-1';
const MISSION = 'm-1';
const OBJECTIVE = 'o-1';
const CLIENT = 'client-1';

function mission(owner = USER): HandoffMissionView {
  return {
    missionId: MISSION,
    userId: owner,
    title: 'Ship the landing page',
    objectives: [
      {
        objectiveId: OBJECTIVE,
        state: 'VERIFIED',
        title: 'Build the page',
        verifiedOutcome: { outcome: 'delivered', method: 'process-exit', evidence: ['exit 0'] },
      },
    ],
  };
}

function deliverable(userId = USER): DocumentRecord {
  const documentId = handoffDocumentId(userId, MISSION, OBJECTIVE);
  return {
    id: documentId,
    userId,
    clientId: CLIENT,
    name: 'landing-page.md',
    kind: 'other',
    mime: 'text/markdown',
    size: 42,
    storageKey: documentId,
    metadata: {},
    currentVersion: 1,
    versions: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

class Documents implements ClientOpsDocumentStore {
  readonly documents: DocumentRecord[] = [deliverable()];
  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    return this.documents.filter((d) => d.userId === userId);
  }
  async saveDocument(document: DocumentRecord): Promise<void> {
    this.documents.push(document);
  }
}

/** Owner-scoped in-memory canonical commercial records. */
class InvoiceStore implements CommercialInvoiceLookup {
  private readonly rows: Array<{ userId: string; invoice: CommercialInvoiceView }> = [];
  add(userId: string, invoice: CommercialInvoiceView): void {
    this.rows.push({ userId, invoice });
  }
  /** Simulate a human advancing the canonical invoice status. */
  setStatus(userId: string, invoiceId: string, status: CommercialInvoiceView['status']): void {
    const row = this.rows.find((r) => r.userId === userId && r.invoice.id === invoiceId);
    if (row) row.invoice = { ...row.invoice, status };
  }
  async getInvoice(userId: string, invoiceId: string): Promise<CommercialInvoiceView | undefined> {
    return this.rows.find((r) => r.userId === userId && r.invoice.id === invoiceId)?.invoice;
  }
}

class PaymentStore implements CommercialPaymentLookup {
  private readonly rows: Array<{ userId: string; payment: CommercialPaymentView }> = [];
  add(userId: string, payment: CommercialPaymentView): void {
    this.rows.push({ userId, payment });
  }
  async getPayment(userId: string, paymentId: string): Promise<CommercialPaymentView | undefined> {
    return this.rows.find((r) => r.userId === userId && r.payment.id === paymentId)?.payment;
  }
}

function build(
  overrides: { invoices?: CommercialInvoiceLookup; payments?: CommercialPaymentLookup } = {},
) {
  const outcomes = new InMemoryCommercialOutcomeStore();
  const documents = new Documents();
  const lookup: MissionLookup = { get: async () => mission() };
  const service = new CommercialOutcomeService({
    missions: lookup,
    clientOps: documents,
    outcomes,
    invoices: overrides.invoices,
    payments: overrides.payments,
    now: () => NOW,
  });
  return { service, outcomes };
}

/** Deliver + record the S6.0 outcome, returning its deterministic id. */
async function pending(service: CommercialOutcomeService): Promise<string> {
  const result = await service.recordCommercialOutcome({
    userId: USER,
    missionId: MISSION,
    objectiveId: OBJECTIVE,
  });
  if (!result.ok) throw new Error('setup failed');
  return result.outcomeId;
}

describe('S6.1 — commercial outcome reconciliation', () => {
  let invoices: InvoiceStore;
  let payments: PaymentStore;

  beforeEach(() => {
    invoices = new InvoiceStore();
    payments = new PaymentStore();
  });

  // ── 1. A pending outcome reconciles against the canonical invoice ───────
  it('reconciles COMMERCIAL_PENDING from the canonical invoice status', async () => {
    const { service, outcomes } = build({ invoices, payments });
    const outcomeId = await pending(service);
    // Before reconciliation S6.0's state is intact.
    expect(outcomes.get(USER, outcomeId)!.status).toBe('COMMERCIAL_PENDING');

    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'sent' });
    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reconciled).toBe(true);
    expect(result.status).toBe('INVOICE_PENDING');
    const record = outcomes.get(USER, outcomeId)!;
    expect(record.invoiceId).toBe('inv-1');
    expect(record.reconciledAt).toBe(NOW.toISOString());
  });

  // ── 6/8. Invoice status is respected and does not imply payment ─────────
  it('maps draft → MANUAL_REVIEW (invoice exists is NOT paid)', async () => {
    const { service } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'draft' });
    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
    });
    expect(result.ok && result.status).toBe('MANUAL_REVIEW');
  });

  it('maps paid → PAID only from the canonical paid status', async () => {
    const { service, outcomes } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'paid' });
    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
    });
    expect(result.ok && result.status).toBe('PAID');
    expect(outcomes.get(USER, outcomeId)!.status).toBe('PAID');
  });

  it('re-reconciles when the human advances the canonical invoice', async () => {
    const { service, outcomes } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'sent' });
    await service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' });
    expect(outcomes.get(USER, outcomeId)!.status).toBe('INVOICE_PENDING');

    // A human (or the existing addPayment flow) marks the canonical invoice paid.
    invoices.setStatus(USER, 'inv-1', 'paid');
    const again = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
    });
    expect(again.ok && again.status).toBe('PAID');
    expect(again.ok && again.reconciled).toBe(true);
    expect(outcomes.get(USER, outcomeId)!.status).toBe('PAID');
  });

  // ── 7. A recorded payment does not fabricate receipt ────────────────────
  it('a linked payment does NOT prove receipt — invoice status still decides', async () => {
    const { service, outcomes } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'sent' });
    payments.add(USER, { id: 'pay-1', invoiceId: 'inv-1' });

    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
      paymentId: 'pay-1',
    });
    expect(result.ok && result.status).toBe('INVOICE_PENDING');
    // The reference is recorded, but no receipt/amount is fabricated.
    const record = outcomes.get(USER, outcomeId)!;
    expect(record.paymentId).toBe('pay-1');
    expect(record).not.toHaveProperty('amount');
    expect(record).not.toHaveProperty('paidAt');
  });

  // ── 2/3. Outcome ownership + existence ──────────────────────────────────
  it('rejects reconciling an unknown outcome', async () => {
    const { service } = build({ invoices, payments });
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'sent' });
    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId: 'co_missing',
      invoiceId: 'inv-1',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('OUTCOME_NOT_FOUND');
  });

  it('rejects a wrong owner (another user’s outcome is invisible)', async () => {
    const { service } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add('u-2', { id: 'inv-2', clientId: CLIENT, status: 'sent' });
    const result = await service.reconcileCommercialOutcome({
      userId: 'u-2',
      outcomeId, // u-1's outcome
      invoiceId: 'inv-2',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('OUTCOME_NOT_FOUND');
  });

  // ── 4. Cross-user invoice association rejected ──────────────────────────
  it('rejects a cross-user invoice', async () => {
    const { service } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add('u-2', { id: 'inv-2', clientId: CLIENT, status: 'sent' });
    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-2',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('INVOICE_NOT_FOUND');
  });

  // ── 5. Cross-user payment association rejected ──────────────────────────
  it('rejects a cross-user payment', async () => {
    const { service } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'sent' });
    payments.add('u-2', { id: 'pay-2', invoiceId: 'inv-1' });
    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
      paymentId: 'pay-2',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('PAYMENT_NOT_FOUND');
  });

  // ── Client match + payment/invoice consistency ──────────────────────────
  it('rejects an invoice for a different client', async () => {
    const { service } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-x', clientId: 'client-other', status: 'sent' });
    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-x',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('CLIENT_MISMATCH');
  });

  it('rejects a payment that does not belong to the associated invoice', async () => {
    const { service } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'sent' });
    payments.add(USER, { id: 'pay-1', invoiceId: 'inv-OTHER' });
    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
      paymentId: 'pay-1',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('PAYMENT_MISMATCH');
  });

  it('requires a canonical invoice, and reports unavailable lookups honestly', async () => {
    const withLookups = build({ invoices, payments });
    const outcomeId = await pending(withLookups.service);
    const required = await withLookups.service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
    });
    expect(required.ok).toBe(false);
    if (!required.ok) expect(required.reason).toBe('INVOICE_REQUIRED');

    const noLookups = build();
    const outcome2 = await pending(noLookups.service);
    const unavailable = await noLookups.service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId: outcome2,
      invoiceId: 'inv-1',
    });
    expect(unavailable.ok).toBe(false);
    if (!unavailable.ok) expect(unavailable.reason).toBe('INVOICE_LOOKUP_UNAVAILABLE');
  });

  // ── 10. Idempotency ─────────────────────────────────────────────────────
  it('is idempotent — a repeated reconciliation writes nothing new', async () => {
    const { service, outcomes } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'sent' });

    const first = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
    });
    const second = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
    });

    expect(first.ok && first.reconciled).toBe(true);
    expect(second.ok && second.reconciled).toBe(false);
    expect(outcomes.list(USER)).toHaveLength(1);
    expect(outcomes.get(USER, outcomeId)!.status).toBe('INVOICE_PENDING');
  });

  // ── 11. Concurrency ─────────────────────────────────────────────────────
  it('concurrent reconciliation converges on ONE record', async () => {
    const { service, outcomes } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'paid' });

    await Promise.all([
      service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' }),
      service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' }),
    ]);

    expect(outcomes.list(USER)).toHaveLength(1);
    expect(outcomes.get(USER, outcomeId)!.status).toBe('PAID');
  });

  // ── 12/13. No external action, no leakage ───────────────────────────────
  it('takes no external action and stores references only', async () => {
    const { service, outcomes } = build({ invoices, payments });
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'paid' });
    payments.add(USER, { id: 'pay-1', invoiceId: 'inv-1' });
    await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
      paymentId: 'pay-1',
    });

    const record = outcomes.get(USER, outcomeId)!;
    const serialized = JSON.stringify(record).toLowerCase();
    for (const forbidden of [
      'password',
      'api_key',
      'apikey',
      'secret',
      'token',
      'prompt',
      'sk-',
      'amount',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    // The canonical invoice status is what produced PAID — not a payment record.
    expect(record.status).toBe('PAID');
    expect(record.reconciledAt).toBe(NOW.toISOString());
  });

  // ── 14. S6.0 intact ─────────────────────────────────────────────────────
  it('leaves S6.0 intact: a fresh outcome is COMMERCIAL_PENDING, and its key is stable', async () => {
    const { service, outcomes } = build({ invoices, payments });
    const outcomeId = await pending(service);
    expect(outcomeId).toBe(commercialOutcomeId(USER, MISSION, OBJECTIVE));
    expect(outcomes.get(USER, outcomeId)!.status).toBe('COMMERCIAL_PENDING');
    expect(outcomes.get(USER, outcomeId)!.invoiceId).toBeUndefined();
  });
});
