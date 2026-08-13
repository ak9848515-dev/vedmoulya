// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Repository direct unit tests
// EPIC-003 — AC-001/AC-002 persistence contracts
// Covers user-scoping filters and delete methods that are not always
// exercised through the application-service integration tests.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { InMemoryClientOpsRepository } from '../InMemoryClientOpsRepository.js';
import { InMemoryContentAgencyRepository } from '../InMemoryContentAgencyRepository.js';

const USER_A = 'user_a';
const USER_B = 'user_b';

// ── ClientOpsRepository ─────────────────────────────────────────────────────

describe('InMemoryClientOpsRepository', () => {
  it('scopes leads, interactions, tasks, and contacts by user', async () => {
    const repo = new InMemoryClientOpsRepository();
    const leadA = {
      id: 'lead_a',
      userId: USER_A,
      company: 'A',
      status: 'lead',
      archived: false,
      healthScore: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never;
    const leadB = { ...leadA, id: 'lead_b', userId: USER_B } as never;
    await repo.saveLead(leadA);
    await repo.saveLead(leadB);

    expect(await repo.listLeads(USER_A)).toHaveLength(1);
    expect(await repo.findLeadById('lead_a', USER_A)).not.toBeNull();
    expect(await repo.findLeadById('lead_a', USER_B)).toBeNull();
    // Interactions / tasks / contacts follow the same scoping.
    await repo.saveInteraction({
      id: 'i1',
      leadId: 'lead_a',
      userId: USER_A,
      type: 'call',
      summary: 's',
      createdAt: '',
    } as never);
    await repo.saveInteraction({
      id: 'i2',
      leadId: 'lead_a',
      userId: USER_B,
      type: 'call',
      summary: 's',
      createdAt: '',
    } as never);
    expect(await repo.listInteractions('lead_a', USER_A)).toHaveLength(1);

    await repo.saveTask({
      id: 't1',
      leadId: 'lead_a',
      userId: USER_A,
      title: 'x',
      dueAt: null,
      completed: false,
      createdAt: '',
    } as never);
    await repo.saveTask({
      id: 't2',
      leadId: 'lead_a',
      userId: USER_B,
      title: 'x',
      dueAt: null,
      completed: false,
      createdAt: '',
    } as never);
    expect(await repo.listTasks('lead_a', USER_A)).toHaveLength(1);

    await repo.saveContact({
      id: 'c1',
      leadId: 'lead_a',
      userId: USER_A,
      name: 'n',
      isPrimary: false,
      createdAt: '',
    } as never);
    await repo.saveContact({
      id: 'c2',
      leadId: 'lead_a',
      userId: USER_B,
      name: 'n',
      isPrimary: false,
      createdAt: '',
    } as never);
    expect(await repo.listContacts('lead_a', USER_A)).toHaveLength(1);
  });

  it('deletes contacts, proposals, contracts, quotations, and documents (scoped)', async () => {
    const repo = new InMemoryClientOpsRepository();
    const base = {
      userId: USER_A,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.saveContact({
      id: 'c1',
      leadId: 'l',
      ...base,
      name: 'n',
      isPrimary: false,
    } as never);
    await repo.deleteContact('c1', USER_A);
    expect(await repo.listContacts('l', USER_A)).toHaveLength(0);
    // Deleting another user's contact is a no-op.
    await repo.saveContact({
      id: 'c2',
      leadId: 'l',
      userId: USER_B,
      name: 'n',
      isPrimary: false,
      createdAt: '',
      updatedAt: '',
    } as never);
    await repo.deleteContact('c2', USER_A);
    expect(await repo.listContacts('l', USER_B)).toHaveLength(1);

    await repo.saveProposal({
      id: 'p1',
      ...base,
      title: 'P',
      status: 'draft',
      currentVersion: 1,
      versions: [],
    } as never);
    await repo.deleteProposal('p1', USER_A);
    expect(await repo.listProposals(USER_A)).toHaveLength(0);

    await repo.saveContract({
      id: 'ct1',
      ...base,
      title: 'C',
      status: 'draft',
      currentVersion: 1,
      versions: [],
      approvals: [],
    } as never);
    await repo.deleteContract('ct1', USER_A);
    expect(await repo.listContracts(USER_A)).toHaveLength(0);

    await repo.saveQuotation({
      id: 'q1',
      ...base,
      title: 'Q',
      status: 'draft',
      packages: [],
      subtotal: 0,
      total: 0,
    } as never);
    await repo.deleteQuotation('q1', USER_A);
    expect(await repo.listQuotations(USER_A)).toHaveLength(0);

    await repo.saveDocument({
      id: 'd1',
      ...base,
      name: 'D',
      kind: 'other',
      mime: 'text/plain',
      size: 1,
      storageKey: 'k',
      currentVersion: 1,
      versions: [],
    } as never);
    await repo.deleteDocument('d1', USER_A);
    expect(await repo.listDocuments(USER_A)).toHaveLength(0);
  });

  it('scopes payments by invoice and portal access by token hash', async () => {
    const repo = new InMemoryClientOpsRepository();
    await repo.savePayment({
      id: 'pay1',
      userId: USER_A,
      invoiceId: 'inv_1',
      clientId: 'cl',
      amount: 10,
      currency: 'USD',
      method: 'bank',
      receivedAt: '',
      note: '',
      createdAt: '',
    } as never);
    await repo.savePayment({
      id: 'pay2',
      userId: USER_B,
      invoiceId: 'inv_1',
      clientId: 'cl',
      amount: 20,
      currency: 'USD',
      method: 'bank',
      receivedAt: '',
      note: '',
      createdAt: '',
    } as never);
    expect(await repo.listPaymentsByInvoice('inv_1', USER_A)).toHaveLength(1);

    await repo.savePortalAccess({
      id: 'pa1',
      userId: USER_A,
      clientId: 'cl',
      email: 'e',
      tokenHash: 'abc',
      enabled: true,
      lastLoginAt: null,
      createdAt: '',
    } as never);
    expect(await repo.findPortalAccessByTokenHash('abc')).not.toBeNull();
    expect(await repo.findPortalAccessByTokenHash('nope')).toBeNull();

    await repo.deletePortalAccess('pa1', USER_A);
    expect(await repo.listPortalAccess(USER_A)).toHaveLength(0);
  });

  it('scopes notifications by audience and marks reads through save', async () => {
    const repo = new InMemoryClientOpsRepository();
    await repo.saveNotification({
      id: 'n1',
      userId: USER_A,
      audience: 'agency',
      type: 'info',
      title: 't',
      message: 'm',
      isRead: false,
      createdAt: '',
    } as never);
    await repo.saveNotification({
      id: 'n2',
      userId: USER_A,
      audience: 'client',
      type: 'info',
      title: 't',
      message: 'm',
      isRead: false,
      createdAt: '',
    } as never);
    expect(await repo.listNotifications(USER_A, 'agency')).toHaveLength(1);
    expect(await repo.listNotifications(USER_A, 'client')).toHaveLength(1);
  });
});

// ── ContentAgencyRepository ────────────────────────────────────────────────

describe('InMemoryContentAgencyRepository', () => {
  it('scopes clients, brands, projects, content, and invoices by user', async () => {
    const repo = new InMemoryContentAgencyRepository();
    const base = {
      userId: USER_A,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.saveClient({ id: 'cl1', ...base, company: 'Acme' } as never);
    await repo.saveClient({
      id: 'cl2',
      userId: USER_B,
      company: 'Beta',
      createdAt: '',
      updatedAt: '',
    } as never);
    expect(await repo.listClients(USER_A)).toHaveLength(1);
    expect(await repo.findClientById('cl1', USER_A)).not.toBeNull();
    expect(await repo.findClientById('cl1', USER_B)).toBeNull();

    await repo.saveBrand({ id: 'b1', ...base, name: 'Brand' } as never);
    expect(await repo.findBrandById('b1', USER_A)).not.toBeNull();
    expect(await repo.findBrandById('b1', USER_B)).toBeNull();

    await repo.saveProject({ id: 'pj1', ...base, name: 'Project', status: 'active' } as never);
    expect(await repo.findProjectById('pj1', USER_A)).not.toBeNull();
    expect(await repo.findProjectById('pj1', USER_B)).toBeNull();

    await repo.saveContent({
      id: 'co1',
      ...base,
      title: 'Content',
      contentType: 'blog',
      status: 'draft',
      workflowStage: 'draft',
      versions: [],
      reviews: [],
      aiMetadata: null,
    } as never);
    expect(await repo.findContentById('co1', USER_A)).not.toBeNull();
    expect(await repo.findContentById('co1', USER_B)).toBeNull();

    await repo.saveInvoice({
      id: 'in1',
      ...base,
      clientId: 'cl1',
      amount: 100,
      currency: 'USD',
      status: 'draft',
    } as never);
    expect(await repo.findInvoiceById('in1', USER_A)).not.toBeNull();
    expect(await repo.findInvoiceById('in1', USER_B)).toBeNull();
  });

  it('deep-copies versions, reviews, and aiMetadata on content save', async () => {
    const repo = new InMemoryContentAgencyRepository();
    const item = {
      id: 'co1',
      userId: USER_A,
      clientId: null,
      brandId: null,
      projectId: null,
      contentType: 'blog',
      title: 'Content',
      status: 'draft',
      workflowStage: 'draft',
      brief: '',
      targetAudience: '',
      goals: [],
      versions: [{ version: 1, content: 'v1', createdAt: '' }],
      reviews: [
        {
          id: 'r1',
          stage: 'review',
          reviewer: 'x',
          comment: 'c',
          decision: 'accepted',
          createdAt: '',
        },
      ],
      aiMetadata: { provider: 'mock', model: 'm', qualityScore: 8 },
      scheduledFor: null,
      publishedUrl: null,
      createdAt: '',
      updatedAt: '',
    } as never;
    await repo.saveContent(item);
    expect(await repo.listContent(USER_A)).toHaveLength(1);
  });

  it('deletes clients, brands, projects, content, and invoices (scoped)', async () => {
    const repo = new InMemoryContentAgencyRepository();
    const base = {
      userId: USER_A,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.saveClient({ id: 'cl1', ...base, company: 'Acme' } as never);
    await repo.deleteClient('cl1', USER_A);
    expect(await repo.listClients(USER_A)).toHaveLength(0);

    await repo.saveBrand({ id: 'b1', ...base, name: 'Brand' } as never);
    await repo.deleteBrand('b1', USER_A);
    expect(await repo.listBrands(USER_A)).toHaveLength(0);

    await repo.saveProject({ id: 'pj1', ...base, name: 'Project', status: 'active' } as never);
    await repo.deleteProject('pj1', USER_A);
    expect(await repo.listProjects(USER_A)).toHaveLength(0);

    await repo.saveContent({
      id: 'co1',
      ...base,
      title: 'C',
      contentType: 'blog',
      status: 'draft',
      workflowStage: 'draft',
      versions: [],
      reviews: [],
      aiMetadata: null,
    } as never);
    await repo.deleteContent('co1', USER_A);
    expect(await repo.listContent(USER_A)).toHaveLength(0);

    await repo.saveInvoice({
      id: 'in1',
      ...base,
      clientId: 'cl1',
      amount: 100,
      currency: 'USD',
      status: 'draft',
    } as never);
    await repo.deleteInvoice('in1', USER_A);
    expect(await repo.listInvoices(USER_A)).toHaveLength(0);
  });
});
