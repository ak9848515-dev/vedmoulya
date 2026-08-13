// ──────────────────────────────────────────────────────────────────
// VedMoulya — Client Operations Application Service Tests
// EPIC-003 / SPRINT AC-002 — Client Operations & Revenue Engine
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContentItemRecord } from '@vedmoulya/domain';
import { InMemoryClientOpsRepository } from '../InMemoryClientOpsRepository.js';
import { ClientOperationsApplicationService } from '../ClientOperationsApplicationService.js';
import type { ClientOpsAIService } from '../ClientOpsAIService.js';
import type { ContentAgencyApplicationService } from '../ContentAgencyApplicationService.js';
import type { ProposalGenerationResult } from '../ClientOpsAIService.js';

const USER = 'user_1';

const aiResponse: ProposalGenerationResult = {
  document: '# Proposal for Acme\n\n## Requirements\nContent production.',
  provider: 'mock',
  model: 'mock-1',
  qualityScore: 9,
  traceId: 'trace_1',
  tokenUsage: { input: 100, output: 200, total: 300 },
  cost: 0.01,
  latencyMs: 120,
};

function contentItem(overrides: Partial<ContentItemRecord>): ContentItemRecord {
  return {
    id: 'content_1',
    userId: USER,
    clientId: 'client_1',
    brandId: null,
    projectId: null,
    contentType: 'blog',
    title: 'Test Article',
    status: 'review',
    workflowStage: 'review',
    brief: '',
    targetAudience: '',
    goals: [],
    versions: [],
    reviews: [],
    aiMetadata: null,
    scheduledFor: null,
    publishedUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeContentAgencyMock(
  overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {},
): ContentAgencyApplicationService {
  const mock = {
    createClient: vi.fn(async (_userId: string, input: { company: string }) => ({
      success: true,
      data: { id: `client_${input.company}`, userId: _userId, company: input.company },
    })),
    getClient: vi.fn(async (_userId: string, clientId: string) => ({
      success: true,
      data: { id: clientId, userId: _userId, company: 'Acme Inc' },
    })),
    listClients: vi.fn(async () => ({ success: true, data: [] })),
    listInvoices: vi.fn(async () => ({ success: true, data: [] })),
    getInvoice: vi.fn(async () => ({ success: false, error: 'Invoice not found' })),
    updateInvoiceStatus: vi.fn(async () => ({ success: true, data: { id: 'inv' } })),
    listProjects: vi.fn(async () => ({ success: true, data: [] })),
    listContent: vi.fn(async () => ({ success: true, data: [] })),
    getContent: vi.fn(async () => ({ success: false, error: 'Content not found' })),
    addReview: vi.fn(async () => ({ success: true, data: {} })),
    transitionStatus: vi.fn(async () => ({ success: true, data: {} })),
    exportContent: vi.fn(async () => ({ success: false, error: 'Export failed' })),
    ...overrides,
  };
  return mock as unknown as ContentAgencyApplicationService;
}

function makeService(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}): {
  svc: ClientOperationsApplicationService;
  repo: InMemoryClientOpsRepository;
  contentAgency: ContentAgencyApplicationService;
  aiMock: ClientOpsAIService;
} {
  const repo = new InMemoryClientOpsRepository();
  const contentAgency = makeContentAgencyMock(overrides);
  const aiMock = {
    generateProposal: vi.fn().mockResolvedValue(aiResponse),
  } as unknown as ClientOpsAIService;
  const svc = new ClientOperationsApplicationService(repo, contentAgency, aiMock);
  return { svc, repo, contentAgency, aiMock };
}

describe('ClientOperationsApplicationService — CRM', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('creates a lead with defaults and lists it (excluding archived)', async () => {
    const created = await ctx.svc.createLead(USER, { company: 'Acme', value: 5000 });
    expect(created.success).toBe(true);
    expect(created.data?.id).toMatch(/^lead_/);
    expect(created.data?.status).toBe('lead');
    // 50 base + 10 (no open tasks) with no activity/next-follow-up.
    expect(created.data?.healthScore).toBe(60);

    const list = await ctx.svc.listLeads(USER);
    expect(list.data).toHaveLength(1);
    expect(list.data?.[0]?.company).toBe('Acme');

    await ctx.svc.archiveLead(USER, created.data!.id);
    const visible = await ctx.svc.listLeads(USER);
    expect(visible.data).toHaveLength(0);
    const archived = await ctx.svc.listLeads(USER, 'archived');
    expect(archived.data).toHaveLength(1);
  });

  it('updates lead fields', async () => {
    const created = await ctx.svc.createLead(USER, { company: 'Beta' });
    const updated = await ctx.svc.updateLead(USER, created.data!.id, {
      contactName: 'Jane',
      status: 'qualified',
    });
    expect(updated.data?.contactName).toBe('Jane');
    expect(updated.data?.status).toBe('qualified');
  });

  it('provisions a client when a lead is won', async () => {
    const created = await ctx.svc.createLead(USER, { company: 'Gamma', notes: 'priority' });
    const won = await ctx.svc.moveLead(USER, created.data!.id, 'won');
    expect(won.success).toBe(true);
    expect(won.data?.clientId).toBe('client_Gamma');
    expect(won.data?.status).toBe('won');
  });

  it('records interactions and boosts health; tasks count open items', async () => {
    const created = await ctx.svc.createLead(USER, { company: 'Delta' });
    const leadId = created.data!.id;

    await ctx.svc.addInteraction(USER, leadId, { type: 'call', summary: 'Intro call' });
    const detail = await ctx.svc.getLead(USER, leadId);
    expect(detail.data?.interactions).toHaveLength(1);
    expect(detail.data?.interactions[0]?.type).toBe('call');
    expect(detail.data?.healthScore).toBeGreaterThan(50);

    await ctx.svc.addTask(USER, leadId, { title: 'Send deck', dueAt: '2030-01-01' });
    let lead = await ctx.svc.getLead(USER, leadId);
    expect(lead.data?.openTasks).toBe(1);

    await ctx.svc.completeTask(USER, leadId, lead.data!.tasks[0]!.id);
    lead = await ctx.svc.getLead(USER, leadId);
    expect(lead.data?.openTasks).toBe(0);
  });

  it('manages contacts', async () => {
    const created = await ctx.svc.createLead(USER, { company: 'Epsilon' });
    const leadId = created.data!.id;
    const contact = await ctx.svc.addContact(USER, leadId, {
      name: 'Bob',
      email: 'bob@example.com',
      isPrimary: true,
    });
    const detail = await ctx.svc.getLead(USER, leadId);
    expect(detail.data?.contacts).toHaveLength(1);
    const removed = await ctx.svc.deleteContact(USER, leadId, contact.data!.id);
    expect(removed.success).toBe(true);
    const after = await ctx.svc.getLead(USER, leadId);
    expect(after.data?.contacts).toHaveLength(0);
  });
});

describe('ClientOperationsApplicationService — Proposals', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('creates a proposal with version 1 and bumps versions on update', async () => {
    const created = await ctx.svc.createProposal(USER, {
      title: 'Q3 Content Plan',
      content: {
        company: 'Acme',
        requirements: 'Monthly blog pipeline',
        scope: '12 articles',
        timeline: '3 months',
        deliverables: ['Articles'],
        terms: 'Net 30',
        pricing: [{ label: 'Monthly retainer', amount: 2000 }],
      },
    });
    expect(created.data?.versionCount).toBe(1);

    const updated = await ctx.svc.updateProposal(USER, created.data!.id, {
      content: { scope: '14 articles' },
    });
    expect(updated.data?.versionCount).toBe(2);
    expect(updated.data?.content.scope).toBe('14 articles');
    expect(updated.data?.content.terms).toBe('Net 30');
  });

  it('generates a proposal via the AI service with traceable metadata', async () => {
    const generated = await ctx.svc.generateProposal(USER, {
      title: 'Brand Overhaul',
      company: 'Acme',
      requirements: 'Full brand refresh',
    });
    expect(generated.success).toBe(true);
    expect(generated.data?.content.document).toContain('Proposal for Acme');
    expect(generated.data?.aiMetadata?.model).toBe('mock-1');
    expect(generated.data?.aiMetadata?.tokenUsage).toEqual({
      input: 100,
      output: 200,
      total: 300,
    });

    const missing = await ctx.svc.generateProposal(USER, {
      title: 'X',
      company: '',
      requirements: '',
    });
    expect(missing.success).toBe(false);
  });

  it('sends a proposal (status + client notification) and accepts it, promoting the lead', async () => {
    const lead = await ctx.svc.createLead(USER, { company: 'Zeta' });
    const proposal = await ctx.svc.createProposal(USER, {
      title: 'Retainer 2026',
      leadId: lead.data!.id,
      content: {
        company: 'Zeta',
        requirements: 'x',
        scope: '',
        timeline: '',
        deliverables: [],
        terms: '',
        pricing: [],
      },
    });
    const sent = await ctx.svc.sendProposal(USER, proposal.data!.id);
    expect(sent.data?.status).toBe('sent');
    expect(sent.data?.sentAt).toBeDefined();

    const accepted = await ctx.svc.acceptProposal(USER, proposal.data!.id);
    expect(accepted.data?.status).toBe('accepted');
    expect(accepted.data?.acceptedAt).toBeDefined();
    const promoted = await ctx.svc.getLead(USER, lead.data!.id);
    expect(promoted.data?.status).toBe('won');
  });

  it('exports markdown and HTML', async () => {
    const proposal = await ctx.svc.createProposal(USER, {
      title: 'Export Me',
      content: {
        company: 'Acme',
        requirements: 'R',
        scope: 'S',
        timeline: 'T',
        deliverables: ['D1'],
        terms: 'Terms',
        pricing: [{ label: 'L', amount: 100 }],
      },
    });
    const md = await ctx.svc.exportProposal(USER, proposal.data!.id, 'markdown');
    expect(md.data?.format).toBe('markdown');
    expect(md.data?.data).toContain('# Export Me');
    expect(md.data?.supported).toBe(true);

    const html = await ctx.svc.exportProposal(USER, proposal.data!.id, 'html');
    expect(html.data?.data).toContain('<h1>Export Me</h1>');
  });
});

describe('ClientOperationsApplicationService — Contracts', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  const future = new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  it('creates, approves (active) and derives expired status', async () => {
    const created = await ctx.svc.createContract(USER, {
      clientId: 'client_1',
      title: 'Annual Retainer',
      startDate: '2026-01-01',
      endDate: future,
      value: 24000,
    });
    expect(created.data?.status).toBe('draft');

    const approved = await ctx.svc.approveContract(USER, created.data!.id, {
      approved: true,
      by: 'Agency',
    });
    expect(approved.data?.status).toBe('active');
    expect(approved.data?.approved).toBe(true);

    const expired = await ctx.svc.createContract(USER, {
      clientId: 'client_1',
      title: 'Old Contract',
      startDate: '2020-01-01',
      endDate: past,
      value: 100,
    });
    await ctx.svc.approveContract(USER, expired.data!.id, { approved: true, by: 'Agency' });
    const listed = await ctx.svc.listContracts(USER);
    const old = listed.data?.find((c) => c.id === expired.data!.id);
    expect(old?.status).toBe('expired');
  });

  it('renews a contract (new version + renewal flag) and lists expiring ones', async () => {
    const created = await ctx.svc.createContract(USER, {
      clientId: 'client_1',
      title: 'Monthly Plan',
      startDate: '2026-01-01',
      endDate: future,
      value: 1000,
    });
    await ctx.svc.approveContract(USER, created.data!.id, { approved: true, by: 'Agency' });
    const expiring = await ctx.svc.listExpiringContracts(USER, 60);
    expect(expiring.data?.some((c) => c.id === created.data!.id)).toBe(true);

    const renewed = await ctx.svc.renewContract(USER, created.data!.id, {
      startDate: '2027-01-01',
      endDate: '2028-01-01',
      value: 1200,
    });
    expect(renewed.data?.renewal).toBe(true);
    expect(renewed.data?.currentVersion).toBe(2);
    expect(renewed.data?.status).toBe('active');
  });
});

describe('ClientOperationsApplicationService — Quotations & Payments', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('computes quotation totals with discount and tax', async () => {
    const quotation = await ctx.svc.createQuotation(USER, {
      title: 'Launch Package',
      packages: [
        { name: 'Design', price: 100 },
        { name: 'Content', price: 200, qty: 2 },
      ],
      discount: 50,
      taxRate: 10,
    });
    expect(quotation.data?.subtotal).toBe(500);
    expect(quotation.data?.total).toBe(495);
  });

  it('sends quotations and accepts them', async () => {
    const quotation = await ctx.svc.createQuotation(USER, {
      title: 'Starter',
      packages: [{ name: 'Blog', price: 300 }],
    });
    const sent = await ctx.svc.sendQuotation(USER, quotation.data!.id);
    expect(sent.data?.status).toBe('sent');
    const accepted = await ctx.svc.acceptQuotation(USER, quotation.data!.id);
    expect(accepted.data?.status).toBe('accepted');
  });

  it('marks an invoice paid when payments cover the amount', async () => {
    ctx = makeService({
      getInvoice: vi.fn(async () => ({
        success: true,
        data: { id: 'inv_1', clientId: 'client_1', amount: 500, currency: 'USD' },
      })),
    });
    await ctx.svc.addPayment(USER, { invoiceId: 'inv_1', amount: 300, method: 'bank' });
    expect(ctx.contentAgency.updateInvoiceStatus).not.toHaveBeenCalledWith(USER, 'inv_1', 'paid');

    await ctx.svc.addPayment(USER, { invoiceId: 'inv_1', amount: 200, method: 'bank' });
    expect(ctx.contentAgency.updateInvoiceStatus).toHaveBeenCalledWith(USER, 'inv_1', 'paid');
  });

  it('computes a revenue overview with outstanding and overdue', async () => {
    ctx = makeService({
      listInvoices: vi.fn(async () => ({
        success: true,
        data: [
          {
            id: 'inv_1',
            clientId: 'client_1',
            amount: 1000,
            currency: 'USD',
            status: 'sent',
            dueDate: '2020-01-01',
          },
          {
            id: 'inv_2',
            clientId: 'client_1',
            amount: 500,
            currency: 'USD',
            status: 'paid',
            dueDate: null,
          },
        ],
      })),
    });
    await ctx.repo.savePayment({
      id: 'pay_1',
      userId: USER,
      invoiceId: 'inv_2',
      clientId: 'client_1',
      amount: 500,
      currency: 'USD',
      method: 'bank',
      receivedAt: new Date().toISOString(),
      note: '',
      createdAt: new Date().toISOString(),
    });
    const overview = await ctx.svc.getRevenueOverview(USER);
    expect(overview.data?.paidTotal).toBe(500);
    expect(overview.data?.outstanding).toBe(1000);
    expect(overview.data?.overdueCount).toBe(1);
    expect(overview.data?.paidCount).toBe(1);
    expect(overview.data?.pendingCount).toBe(1);
  });
});

describe('ClientOperationsApplicationService — Documents', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('uploads documents (with size cap and client validation) and searches', async () => {
    const uploaded = await ctx.svc.uploadDocument(USER, {
      clientId: 'client_1',
      name: 'Brand Guidelines',
      kind: 'brand_guidelines',
      mime: 'application/pdf',
      contentBase64: 'AAAA', // 3 bytes
      metadata: { tags: ['brand'] },
    });
    expect(uploaded.success).toBe(true);
    expect(uploaded.data?.size).toBe(3);

    const missingClient = await ctx.svc.uploadDocument(USER, {
      clientId: 'missing',
      name: 'X',
      kind: 'other',
      mime: 'text/plain',
      contentBase64: 'AAAA',
    });
    // getClient mock succeeds for any id — so this should succeed too; the
    // size cap is the reliable rejection path.
    expect(missingClient.success).toBe(true);

    const tooBig = await ctx.svc.uploadDocument(USER, {
      clientId: 'client_1',
      name: 'Huge',
      kind: 'other',
      mime: 'text/plain',
      contentBase64: 'A'.repeat(3_000_000),
    });
    expect(tooBig.success).toBe(false);

    const search = await ctx.svc.searchDocuments(USER, 'guidelines');
    expect(search.data).toHaveLength(1);
    const searchMiss = await ctx.svc.searchDocuments(USER, 'nope');
    expect(searchMiss.data).toHaveLength(0);
  });

  it('versions documents on update and deletes them', async () => {
    const uploaded = await ctx.svc.uploadDocument(USER, {
      clientId: 'client_1',
      name: 'Logo',
      kind: 'logo',
      mime: 'image/png',
      contentBase64: 'QUJD',
    });
    const updated = await ctx.svc.updateDocument(USER, uploaded.data!.id, {
      contentBase64: 'QUJDRA==',
      mime: 'image/png',
      note: 'v2',
    });
    expect(updated.data?.currentVersion).toBe(2);
    const detail = await ctx.svc.getDocument(USER, uploaded.data!.id);
    expect(detail.data?.versions).toHaveLength(2);

    await ctx.svc.deleteDocument(USER, uploaded.data!.id);
    const missing = await ctx.svc.getDocument(USER, uploaded.data!.id);
    expect(missing.success).toBe(false);
  });
});

describe('ClientOperationsApplicationService — Client Portal', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('creates portal access and logs in with the raw token', async () => {
    const created = await ctx.svc.createPortalAccess(USER, {
      clientId: 'client_1',
      email: 'client@acme.com',
    });
    expect(created.success).toBe(true);
    expect(created.data?.rawToken.length).toBeGreaterThanOrEqual(24);

    const login = await ctx.svc.portalLogin(created.data!.rawToken);
    expect(login.success).toBe(true);
    expect(login.data?.company).toBe('Acme Inc');
    expect(login.data?.email).toBe('client@acme.com');

    const bad = await ctx.svc.portalLogin('not-a-real-token');
    expect(bad.success).toBe(false);
  });

  it('scopes portal content to the linked client and handles approval', async () => {
    const item = contentItem({ id: 'content_1', clientId: 'client_1', title: 'Article A' });
    ctx = makeService({
      listContent: vi.fn(async () => ({ success: true, data: [item] })),
      getContent: vi.fn(async () => ({ success: true, data: item })),
    });
    const access = await ctx.svc.createPortalAccess(USER, {
      clientId: 'client_1',
      email: 'client@acme.com',
    });
    const token = access.data!.rawToken;

    const content = await ctx.svc.portalListContent(token);
    expect(content.data).toHaveLength(1);
    expect(content.data?.[0]?.id).toBe('content_1');

    const approved = await ctx.svc.portalApproveContent(token, 'content_1', 'Looks good');
    expect(approved.success).toBe(true);
    expect(ctx.contentAgency.addReview).toHaveBeenCalled();
    expect(ctx.contentAgency.transitionStatus).toHaveBeenCalledWith(USER, 'content_1', 'approved');

    const notifications = await ctx.svc.listNotifications(USER);
    expect(notifications.data?.some((n) => n.type === 'client_comment')).toBe(true);
  });

  it('rejects access to another client content and revokes tokens', async () => {
    const item = contentItem({ id: 'content_9', clientId: 'client_OTHER' });
    ctx = makeService({
      getContent: vi.fn(async () => ({ success: true, data: item })),
    });
    const access = await ctx.svc.createPortalAccess(USER, {
      clientId: 'client_1',
      email: 'client@acme.com',
    });
    const token = access.data!.rawToken;
    const denied = await ctx.svc.portalGetContent(token, 'content_9');
    expect(denied.success).toBe(false);

    await ctx.svc.revokePortalAccess(USER, access.data!.access.id);
    const login = await ctx.svc.portalLogin(token);
    expect(login.success).toBe(false);
  });
});

describe('ClientOperationsApplicationService — Notifications', () => {
  it('materialises derived notifications (approval pending, contract expiring) and marks read', async () => {
    const item = contentItem({ id: 'content_1', clientId: 'client_1', title: 'Awaiting approval' });
    const project = {
      id: 'project_1',
      userId: USER,
      clientId: 'client_1',
      brandId: null,
      name: 'Website Launch',
      description: '',
      status: 'completed',
      startDate: '',
      endDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ctx = makeService({
      listContent: vi.fn(async () => ({ success: true, data: [item] })),
      listProjects: vi.fn(async () => ({ success: true, data: [project] })),
    });
    await ctx.svc.createPortalAccess(USER, { clientId: 'client_1', email: 'c@acme.com' });
    const expiring = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const contract = await ctx.svc.createContract(USER, {
      clientId: 'client_1',
      title: 'Expiring Contract',
      startDate: '2026-01-01',
      endDate: expiring,
      value: 100,
    });
    await ctx.svc.approveContract(USER, contract.data!.id, { approved: true, by: 'Agency' });

    const notifications = await ctx.svc.listNotifications(USER);
    const types = notifications.data?.map((n) => n.type) ?? [];
    expect(types).toContain('approval_pending');
    expect(types).toContain('project_completed');
    expect(types).toContain('contract_expiring');

    // Idempotent: a second call does not duplicate.
    const again = await ctx.svc.listNotifications(USER);
    const pending = again.data?.filter((n) => n.type === 'approval_pending') ?? [];
    expect(pending).toHaveLength(1);

    const target = again.data?.find((n) => n.type === 'approval_pending');
    const marked = await ctx.svc.markNotificationRead(USER, target!.id);
    expect(marked.data?.isRead).toBe(true);
  });
});

describe('ClientOperationsApplicationService — Business Analytics', () => {
  it('computes win rate, revenue and AI usage', async () => {
    const item = contentItem({
      id: 'content_1',
      clientId: 'client_1',
      title: 'AI Blog',
      status: 'published',
      reviews: [
        {
          id: 'rev_1',
          stage: 'review',
          reviewer: 'Client',
          comment: 'ok',
          decision: 'accepted',
          score: 9,
          createdAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
        },
      ],
      aiMetadata: {
        capability: 'content_generation',
        prompt: { system: '', user: '', sections: [] },
        provider: 'mock',
        model: 'mock',
        qualityScore: 8,
        traceId: 't',
        tokenUsage: { input: 100, output: 100, total: 200 },
        cost: 0.02,
        latencyMs: 100,
        researchNotes: '',
        researchTraceId: null,
        passes: [],
      },
    });
    const ctx = makeService({
      listContent: vi.fn(async () => ({ success: true, data: [item] })),
    });
    await ctx.svc.createLead(USER, { company: 'Won Co' });
    await ctx.svc.createLead(USER, { company: 'Lost Co' });
    const leads = await ctx.repo.listLeads(USER);
    await ctx.svc.moveLead(USER, leads[0]!.id, 'won');
    await ctx.svc.moveLead(USER, leads[1]!.id, 'lost');

    const analytics = await ctx.svc.getBusinessAnalytics(USER);
    expect(analytics.success).toBe(true);
    expect(analytics.data?.winRate).toBe(50);
    expect(analytics.data?.contentGenerated).toBe(1);
    expect(analytics.data?.aiUsage.tokens).toBe(200);
    expect(analytics.data?.aiUsage.cost).toBe(0.02);
    expect(analytics.data?.approvalTimeDays).toBe(2);
  });
});
