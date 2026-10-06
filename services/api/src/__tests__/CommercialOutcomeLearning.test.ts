// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.2 commercial outcome → truthful learning signal
//
// Proves the guarantees of the learning boundary:
//   • only the CANONICAL commercial state produces a signal — draft →
//     MANUAL_REVIEW, sent → INVOICE_PENDING, paid → PAID; nothing else is ever
//     treated as success
//   • commercial success is asserted ONLY by canonical PAID (a payment/invoice
//     alone never does)
//   • idempotent: a replay reaffirms ONE entry; a state change adds exactly one
//     new entry; a PAID replay never duplicates
//   • concurrent reconciliation produces no duplicate record
//   • owner isolation end to end (outcome/invoice/payment), and retrieval is
//     owner-scoped through the EXISTING execution-memory ranking
//   • a learning persistence failure is an HONEST partial — the commercial
//     outcome is never rolled back and success is never fabricated
//   • references only — no amount, no invoice/payment payload, no secrets
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentRecord } from '@vedmoulya/domain';
import {
  InMemoryExecutionMemoryStore,
  MemoryIntelligenceStoreAdapter,
  rankEvidence,
  type ExecutionMemoryStore,
} from '@vedmoulya/execution-memory';
import { InMemoryMemoryRepository } from '@vedmoulya/memory-intelligence';
import { InMemoryCommercialOutcomeStore } from '@vedmoulya/control-plane';
import {
  CommercialOutcomeLearning,
  type CommercialLearningSignal,
  type CommercialOutcomeLearningPort,
} from '../services/CommercialOutcomeLearning.js';
import {
  CommercialOutcomeService,
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
const NOW_ISO = NOW.toISOString();
const USER = 'u-1';
const MISSION = 'm-1';
const OBJECTIVE = 'o-1';
const CLIENT = 'client-1';

function signal(overrides: Partial<CommercialLearningSignal> = {}): CommercialLearningSignal {
  return {
    userId: USER,
    outcomeId: 'co_aaa',
    missionId: MISSION,
    objectiveId: OBJECTIVE,
    status: 'COMMERCIAL_PENDING',
    occurredAt: NOW_ISO,
    clientId: CLIENT,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. The bridge itself
// ─────────────────────────────────────────────────────────────────────────────

describe('S6.2 — CommercialOutcomeLearning (bridge)', () => {
  let store: InMemoryExecutionMemoryStore;
  let learning: CommercialOutcomeLearning;

  beforeEach(() => {
    store = new InMemoryExecutionMemoryStore();
    learning = new CommercialOutcomeLearning({ store });
  });

  it('records a DELIVERY_OUTCOME learning entry, never a USER_PREFERENCE', async () => {
    await learning.record(signal());

    const entries = await store.list();
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.category).toBe('DELIVERY_OUTCOME');
    expect(entry.category).not.toBe('USER_PREFERENCE');
    expect(entry.scope).toBe('USER');
    expect(entry.userId).toBe(USER);
    expect(entry.subject).toBe('commercialOutcome:co_aaa');
    expect(entry.predicate).toBe('COMMERCIAL_PENDING');
    // A pending outcome is NOT a success.
    expect(entry.value).toBe(0);
    expect(entry.successCount).toBe(0);
  });

  it('asserts commercial success ONLY for the canonical PAID state', async () => {
    await learning.record(signal({ status: 'PAID' }));
    const entry = (await store.list())[0]!;
    expect(entry.predicate).toBe('COMMERCIAL_PAID');
    expect(entry.value).toBe(1);
    expect(entry.successCount).toBe(1);
    expect(entry.verifiedCount).toBe(1);
  });

  it('never marks a cancelled or unknown state as success/PAID', async () => {
    for (const status of ['MANUAL_REVIEW', 'INVOICE_PENDING', 'CLOSED', 'CANCELLED'] as const) {
      const local = new InMemoryExecutionMemoryStore();
      await new CommercialOutcomeLearning({ store: local }).record(signal({ status }));
      const entry = (await local.list())[0]!;
      expect(entry.value).toBe(0);
      expect(entry.successCount).toBe(0);
      expect(entry.predicate).toBe(`COMMERCIAL_${status}`);
      expect(entry.predicate).not.toBe('COMMERCIAL_PAID');
    }
  });

  it('is idempotent: a replay of the SAME state writes ONE entry', async () => {
    await learning.record(signal({ status: 'MANUAL_REVIEW' }));
    await learning.record(signal({ status: 'MANUAL_REVIEW' }));
    await learning.record(signal({ status: 'MANUAL_REVIEW' }));

    const entries = await store.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.predicate).toBe('COMMERCIAL_MANUAL_REVIEW');
  });

  it('creates exactly one new entry per state transition, and no PAID duplicate', async () => {
    await learning.record(signal({ status: 'MANUAL_REVIEW' }));
    await learning.record(signal({ status: 'MANUAL_REVIEW' }));
    await learning.record(signal({ status: 'INVOICE_PENDING' }));
    await learning.record(signal({ status: 'PAID' }));
    await learning.record(signal({ status: 'PAID' }));

    const entries = await store.list();
    expect(entries).toHaveLength(3);
    expect(new Set(entries.map((e) => e.predicate))).toEqual(
      new Set(['COMMERCIAL_MANUAL_REVIEW', 'COMMERCIAL_INVOICE_PENDING', 'COMMERCIAL_PAID']),
    );
  });

  it('isolates the learning signal per owner', async () => {
    await learning.record(signal({ status: 'PAID' }));
    await learning.record(signal({ status: 'PAID', userId: 'u-2' }));

    const entries = await store.list();
    expect(entries).toHaveLength(2);
    expect(entries.filter((e) => e.userId === USER)).toHaveLength(1);
    expect(entries.filter((e) => e.userId === 'u-2')).toHaveLength(1);
    expect(entries[0]!.fingerprint).not.toBe(entries[1]!.fingerprint);
  });

  it('is retrievable by the EXISTING ranking, and never leaks across owners', async () => {
    await learning.record(signal({ status: 'PAID' }));
    const entries = await store.list();

    const mine = rankEvidence(entries, { userId: USER }, NOW.getTime());
    expect(mine).toHaveLength(1);
    expect(mine[0]!.category).toBe('DELIVERY_OUTCOME');

    const theirs = rankEvidence(entries, { userId: 'u-2' }, NOW.getTime());
    expect(theirs).toHaveLength(0);
  });

  it('de-duplicates across the platform persistence (stable xmem id)', async () => {
    const repository = new InMemoryMemoryRepository();
    const adapted = new CommercialOutcomeLearning({
      store: new MemoryIntelligenceStoreAdapter(repository),
    });

    await adapted.record(signal({ status: 'PAID' }));
    await adapted.record(signal({ status: 'PAID' }));
    await adapted.record(signal({ status: 'INVOICE_PENDING' }));

    // Two distinct states → two platform items, never a duplicate of PAID.
    expect(await repository.countItems()).toBe(2);
  });

  it('stores references only — no amount, no invoice/payment payload, no secrets', async () => {
    await learning.record(
      signal({ status: 'PAID', invoiceId: 'inv-1', paymentId: 'pay-1', opportunityId: 'opp-9' }),
    );
    const entry = (await store.list())[0]!;
    const serialized = JSON.stringify(entry);

    // The durable reference is the outcome + governed state, not the ledger.
    expect(entry.subject).toBe('commercialOutcome:co_aaa');
    expect(serialized).toContain('co_aaa');
    // No invoice/payment payload and no secrets are copied into memory.
    for (const forbidden of [
      'amount',
      'description',
      'dueDate',
      'inv-1',
      'pay-1',
      'password',
      'api_key',
      'apikey',
      'secret',
      'bearer',
      'sk-',
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('propagates a store failure so the caller can report an honest partial', async () => {
    const failing: ExecutionMemoryStore = {
      save: async () => {
        throw new Error('memory unavailable');
      },
      get: async () => undefined,
      getByFingerprint: async () => undefined,
      list: async () => [],
      delete: async () => undefined,
    };
    await expect(
      new CommercialOutcomeLearning({ store: failing }).record(signal()),
    ).rejects.toThrow();
  });

  it('concurrent writes of the same signal converge on ONE record', async () => {
    const local = new InMemoryExecutionMemoryStore();
    const bridge = new CommercialOutcomeLearning({ store: local });
    await Promise.all([
      bridge.record(signal({ status: 'PAID' })),
      bridge.record(signal({ status: 'PAID' })),
    ]);
    expect(await local.list()).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Service integration over the real S6.0/S6.1 flow
// ─────────────────────────────────────────────────────────────────────────────

class Documents implements ClientOpsDocumentStore {
  readonly documents: DocumentRecord[] = [deliverable()];
  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    return this.documents.filter((d) => d.userId === userId);
  }
  async saveDocument(document: DocumentRecord): Promise<void> {
    this.documents.push(document);
  }
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
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}

class InvoiceStore implements CommercialInvoiceLookup {
  private readonly rows: Array<{ userId: string; invoice: CommercialInvoiceView }> = [];
  add(userId: string, invoice: CommercialInvoiceView): void {
    this.rows.push({ userId, invoice });
  }
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

function mission(owner = USER): HandoffMissionView {
  return {
    missionId: MISSION,
    userId: owner,
    title: 'Ship the landing page',
    objectives: [{ objectiveId: OBJECTIVE, state: 'VERIFIED', title: 'Build the page' }],
  };
}

function build(learning: CommercialOutcomeLearningPort | undefined) {
  const outcomes = new InMemoryCommercialOutcomeStore();
  const documents = new Documents();
  const invoices = new InvoiceStore();
  const payments = new PaymentStore();
  const lookup: MissionLookup = { get: async () => mission() };
  const service = new CommercialOutcomeService({
    missions: lookup,
    clientOps: documents,
    outcomes,
    invoices,
    payments,
    ...(learning !== undefined ? { learning } : {}),
    now: () => NOW,
  });
  return { service, outcomes, invoices, payments };
}

async function pending(service: CommercialOutcomeService): Promise<string> {
  const result = await service.recordCommercialOutcome({
    userId: USER,
    missionId: MISSION,
    objectiveId: OBJECTIVE,
  });
  if (!result.ok) throw new Error('setup failed');
  return result.outcomeId;
}

describe('S6.2 — commercial learning signal through record + reconcile', () => {
  let memory: InMemoryExecutionMemoryStore;
  let learning: CommercialOutcomeLearning;

  beforeEach(() => {
    memory = new InMemoryExecutionMemoryStore();
    learning = new CommercialOutcomeLearning({ store: memory });
  });

  it('a verified delivery produces the initial COMMERCIAL_PENDING learning signal', async () => {
    const { service } = build(learning);
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });

    expect(result.ok && result.learningRecorded).toBe(true);
    const entries = await memory.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.predicate).toBe('COMMERCIAL_PENDING');
  });

  it('draft invoice → MANUAL_REVIEW learning state', async () => {
    const { service, invoices } = build(learning);
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'draft' });

    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
    });
    expect(result.ok && result.status).toBe('MANUAL_REVIEW');
    expect(result.ok && result.learningRecorded).toBe(true);

    const predicates = (await memory.list()).map((e) => e.predicate);
    expect(predicates).toContain('COMMERCIAL_MANUAL_REVIEW');
  });

  it('sent invoice → INVOICE_PENDING learning state', async () => {
    const { service, invoices } = build(learning);
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'sent' });

    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
    });
    expect(result.ok && result.status).toBe('INVOICE_PENDING');
    expect((await memory.list()).map((e) => e.predicate)).toContain('COMMERCIAL_INVOICE_PENDING');
  });

  it('paid invoice → PAID learning state with success asserted', async () => {
    const { service, invoices } = build(learning);
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'paid' });

    await service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' });
    const paid = (await memory.list()).find((e) => e.predicate === 'COMMERCIAL_PAID');
    expect(paid).toBeDefined();
    expect(paid!.value).toBe(1);
    expect(paid!.successCount).toBe(1);
  });

  it('a recorded payment alone never proves PAID', async () => {
    const { service, invoices, payments } = build(learning);
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
    expect((await memory.list()).some((e) => e.predicate === 'COMMERCIAL_PAID')).toBe(false);
  });

  it('state transition creates exactly one new signal and a PAID replay does not duplicate', async () => {
    const { service, invoices } = build(learning);
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'draft' });

    await service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' });
    await service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' });
    invoices.setStatus(USER, 'inv-1', 'sent');
    await service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' });
    invoices.setStatus(USER, 'inv-1', 'paid');
    await service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' });
    await service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' });

    const predicates = (await memory.list()).map((e) => e.predicate).sort();
    expect(predicates).toEqual([
      'COMMERCIAL_INVOICE_PENDING',
      'COMMERCIAL_MANUAL_REVIEW',
      'COMMERCIAL_PAID',
      'COMMERCIAL_PENDING',
    ]);
  });

  it('concurrent reconciliation does not duplicate the learning record', async () => {
    const { service, invoices } = build(learning);
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'paid' });

    await Promise.all([
      service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' }),
      service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' }),
    ]);

    expect((await memory.list()).filter((e) => e.predicate === 'COMMERCIAL_PAID')).toHaveLength(1);
  });

  it('rejects a wrong owner without writing a learning signal', async () => {
    const { service } = build(learning);
    const outcomeId = await pending(service);
    const before = (await memory.list()).length;

    const result = await service.reconcileCommercialOutcome({
      userId: 'u-2',
      outcomeId,
      invoiceId: 'inv-1',
    });
    expect(result.ok).toBe(false);
    expect((await memory.list()).length).toBe(before);
  });

  it('rejects a cross-user invoice without writing a learning signal', async () => {
    const { service, invoices } = build(learning);
    const outcomeId = await pending(service);
    invoices.add('u-2', { id: 'inv-2', clientId: CLIENT, status: 'paid' });
    const before = (await memory.list()).length;

    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-2',
    });
    expect(result.ok).toBe(false);
    expect((await memory.list()).length).toBe(before);
  });

  it('rejects a cross-user payment without writing a learning signal', async () => {
    const { service, invoices, payments } = build(learning);
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'paid' });
    payments.add('u-2', { id: 'pay-2', invoiceId: 'inv-1' });
    const before = (await memory.list()).length;

    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
      paymentId: 'pay-2',
    });
    expect(result.ok).toBe(false);
    expect((await memory.list()).length).toBe(before);
  });

  it('reports an honest partial when learning persistence fails — no rollback', async () => {
    const failing: CommercialOutcomeLearningPort = {
      record: async () => {
        throw new Error('memory unavailable');
      },
    };
    const { service, outcomes, invoices } = build(failing);
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'paid' });

    const result = await service.reconcileCommercialOutcome({
      userId: USER,
      outcomeId,
      invoiceId: 'inv-1',
    });
    // Reconciliation succeeded and is NOT rolled back; only learning is absent.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.learningRecorded).toBe(false);
    expect(result.reconciled).toBe(true);
    expect(outcomes.get(USER, outcomeId)!.status).toBe('PAID');
  });

  it('reports learning not recorded (honestly) when no learning port is wired', async () => {
    const { service, outcomes } = build(undefined);
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.learningRecorded).toBe(false);
    // The commercial outcome is still recorded — nothing was fabricated away.
    expect(outcomes.get(USER, result.outcomeId)!.status).toBe('COMMERCIAL_PENDING');
  });

  it('leaves S6.0/S6.1 intact: status still derives only from the canonical invoice', async () => {
    const { service, invoices } = build(learning);
    const outcomeId = await pending(service);
    invoices.add(USER, { id: 'inv-1', clientId: CLIENT, status: 'paid' });
    await service.reconcileCommercialOutcome({ userId: USER, outcomeId, invoiceId: 'inv-1' });

    // The learning entry references the outcome but never copies the invoice.
    const entry = (await memory.list()).find((e) => e.predicate === 'COMMERCIAL_PAID')!;
    expect(entry.subject).toBe(`commercialOutcome:${outcomeId}`);
    expect(entry.evidence.executionIds).toEqual([outcomeId]);
  });
});
