// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Client Ops / Content Agency / Portal Router Coverage
// PR-003C — Coverage Gate Certification Sprint
//
// ClientOpsRouter (55 handlers), ContentAgencyRouter (35 handlers) and
// PortalRouter (10 handlers) are thin delegators: every handler forwards
// its input to the application service and wraps the result with
// fromServiceResult. They had 0% coverage, dragging the gateway's function
// coverage below the 80% gate. These tests exercise every handler through a
// generic mock service (success + failure paths) — hermetic, no I/O.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { createClientOpsRouter } from '../routers/ClientOpsRouter.js';
import { createContentAgencyRouter } from '../routers/ContentAgencyRouter.js';
import { createPortalRouter } from '../routers/PortalRouter.js';
import type { ClientOperationsApplicationService } from '@vedmoulya/services';
import type { ContentAgencyApplicationService } from '@vedmoulya/services';

// ── Generic mock services ────────────────────────────────────────────────────
// Every router handler delegates to `svc.<method>(...)` and maps the result
// through fromServiceResult. A Proxy that answers ANY method with a
// success-returning async fn exercises every handler body with zero mocks
// to maintain. The failure path test overrides one method to return an
// error so the fromServiceResult error branch is also covered.
function successService<T>(): T {
  const handler = async () => ({ success: true as const, data: { ok: true }, latency: 0 });
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => {
      if (prop === 'then') return undefined; // not a thenable
      return handler;
    },
  }) as unknown as T;
}

function failingService<T>(method: string): T {
  const handler = async () => ({ success: true as const, data: { ok: true }, latency: 0 });
  const target: Record<string, unknown> = {
    [method]: async () => ({ success: false as const, error: 'boom' }),
  };
  return new Proxy(target, {
    get: (_t, prop: string) => {
      if (prop in target) return target[prop];
      if (prop === 'then') return undefined;
      return handler;
    },
  }) as unknown as T;
}

const ctx = { userId: 'test-user', email: 'test@vedmoulya.com', role: 'user' };

// ── ClientOpsRouter ──────────────────────────────────────────────────────────

describe('ClientOpsRouter', () => {
  const router = createClientOpsRouter(successService<ClientOperationsApplicationService>());
  const handlers: Array<[string, Record<string, unknown>]> = [
    ['listLeads', { userId: 'u' }],
    ['listLeads', { userId: 'u', status: 'won' }],
    ['getLead', { userId: 'u', leadId: 'l1' }],
    ['createLead', { userId: 'u', name: 'Acme' }],
    ['updateLead', { userId: 'u', leadId: 'l1', name: 'Acme' }],
    ['moveLead', { userId: 'u', leadId: 'l1', to: 'won' }],
    ['archiveLead', { userId: 'u', leadId: 'l1' }],
    ['addInteraction', { userId: 'u', leadId: 'l1', kind: 'call' }],
    ['addTask', { userId: 'u', leadId: 'l1', title: 'Follow up' }],
    ['completeTask', { userId: 'u', leadId: 'l1', taskId: 't1' }],
    ['addContact', { userId: 'u', leadId: 'l1', email: 'x@y.com' }],
    ['deleteContact', { userId: 'u', leadId: 'l1', contactId: 'c1' }],
    ['listProposals', { userId: 'u' }],
    ['getProposal', { userId: 'u', proposalId: 'p1' }],
    ['createProposal', { userId: 'u', title: 'Proposal' }],
    ['updateProposal', { userId: 'u', proposalId: 'p1', title: 'P2' }],
    ['generateProposal', { userId: 'u', goal: 'grow' }],
    ['sendProposal', { userId: 'u', proposalId: 'p1' }],
    ['acceptProposal', { userId: 'u', proposalId: 'p1' }],
    ['rejectProposal', { userId: 'u', proposalId: 'p1' }],
    ['exportProposal', { userId: 'u', proposalId: 'p1', format: 'pdf' }],
    ['listContracts', { userId: 'u' }],
    ['getContract', { userId: 'u', contractId: 'k1' }],
    ['createContract', { userId: 'u', title: 'Contract' }],
    ['updateContract', { userId: 'u', contractId: 'k1', title: 'C2' }],
    ['approveContract', { userId: 'u', contractId: 'k1', signed: true }],
    ['terminateContract', { userId: 'u', contractId: 'k1' }],
    ['renewContract', { userId: 'u', contractId: 'k1', months: 12 }],
    ['listExpiringContracts', { userId: 'u' }],
    ['listExpiringContracts', { userId: 'u', days: 30 }],
    ['listQuotations', { userId: 'u' }],
    ['getQuotation', { userId: 'u', quotationId: 'q1' }],
    ['createQuotation', { userId: 'u', amount: 100 }],
    ['updateQuotation', { userId: 'u', quotationId: 'q1', amount: 200 }],
    ['sendQuotation', { userId: 'u', quotationId: 'q1' }],
    ['acceptQuotation', { userId: 'u', quotationId: 'q1' }],
    ['rejectQuotation', { userId: 'u', quotationId: 'q1' }],
    ['listPayments', { userId: 'u' }],
    ['addPayment', { userId: 'u', amount: 50 }],
    ['getRevenueOverview', { userId: 'u' }],
    ['listDocuments', { userId: 'u' }],
    ['getDocument', { userId: 'u', documentId: 'd1' }],
    ['uploadDocument', { userId: 'u', name: 'doc.pdf' }],
    ['updateDocument', { userId: 'u', documentId: 'd1', name: 'd2.pdf' }],
    ['deleteDocument', { userId: 'u', documentId: 'd1' }],
    ['searchDocuments', { userId: 'u', query: 'invoice' }],
    ['createPortalAccess', { userId: 'u', clientId: 'c1' }],
    ['listPortalAccess', { userId: 'u' }],
    ['revokePortalAccess', { userId: 'u', accessId: 'a1' }],
    ['listNotifications', { userId: 'u' }],
    ['markNotificationRead', { userId: 'u', notificationId: 'n1' }],
    ['markAllNotificationsRead', { userId: 'u' }],
    ['getBusinessAnalytics', { userId: 'u' }],
  ];

  it.each(handlers)('handler %s succeeds', async (name, input) => {
    const handler = router[name as keyof typeof router] as (
      i: Record<string, unknown>,
      c: typeof ctx,
    ) => Promise<unknown>;
    const response = (await handler(input, ctx)) as { success: boolean };
    expect(response.success).toBe(true);
  });

  it('maps a service error to a failure envelope', async () => {
    const failing = createClientOpsRouter(
      failingService<ClientOperationsApplicationService>('listLeads'),
    );
    const response = await failing.listLeads({ userId: 'u' }, ctx);
    expect(response.success).toBe(false);
    expect(response.error?.message).toBe('boom');
  });
});

// ── ContentAgencyRouter ──────────────────────────────────────────────────────

describe('ContentAgencyRouter', () => {
  const router = createContentAgencyRouter(successService<ContentAgencyApplicationService>());
  const handlers: Array<[string, Record<string, unknown>]> = [
    ['getDashboard', { userId: 'u' }],
    ['getAnalytics', { userId: 'u' }],
    ['listClients', { userId: 'u' }],
    ['getClient', { userId: 'u', clientId: 'c1' }],
    ['createClient', { userId: 'u', name: 'Acme' }],
    ['updateClient', { userId: 'u', clientId: 'c1', name: 'Acme2' }],
    ['deleteClient', { userId: 'u', clientId: 'c1' }],
    ['listBrands', { userId: 'u' }],
    ['getBrand', { userId: 'u', brandId: 'b1' }],
    ['upsertBrand', { userId: 'u', name: 'Brand' }],
    ['deleteBrand', { userId: 'u', brandId: 'b1' }],
    ['listProjects', { userId: 'u' }],
    ['getProject', { userId: 'u', projectId: 'p1' }],
    ['createProject', { userId: 'u', name: 'Project' }],
    ['updateProject', { userId: 'u', projectId: 'p1', name: 'P2' }],
    ['deleteProject', { userId: 'u', projectId: 'p1' }],
    ['listContent', { userId: 'u' }],
    ['getContent', { userId: 'u', contentId: 'x1' }],
    ['generateContent', { userId: 'u', brief: 'blog' }],
    ['createDraft', { userId: 'u', title: 'Draft' }],
    ['transitionStatus', { userId: 'u', contentId: 'x1', to: 'review' }],
    ['scheduleContent', { userId: 'u', contentId: 'x1', scheduledFor: '2026-08-01' }],
    ['publishContent', { userId: 'u', contentId: 'x1' }],
    ['publishContent', { userId: 'u', contentId: 'x1', publishedUrl: 'https://x' }],
    ['addReview', { userId: 'u', contentId: 'x1', rating: 5 }],
    ['regenerateContent', { userId: 'u', contentId: 'x1', note: 'redo' }],
    ['getCalendar', { userId: 'u', range: 'month' }],
    ['getCalendar', { userId: 'u', range: 'month', anchor: '2026-08-01' }],
    ['listInvoices', { userId: 'u' }],
    ['getInvoice', { userId: 'u', invoiceId: 'i1' }],
    ['createInvoice', { userId: 'u', clientId: 'c1' }],
    ['updateInvoiceStatus', { userId: 'u', invoiceId: 'i1', status: 'paid' }],
    ['deleteInvoice', { userId: 'u', invoiceId: 'i1' }],
    ['exportContent', { userId: 'u', contentId: 'x1', format: 'html' }],
  ];

  it.each(handlers)('handler %s succeeds', async (name, input) => {
    const handler = router[name as keyof typeof router] as (
      i: Record<string, unknown>,
      c: typeof ctx,
    ) => Promise<unknown>;
    const response = (await handler(input, ctx)) as { success: boolean };
    expect(response.success).toBe(true);
  });

  it('maps a service error to a failure envelope', async () => {
    const failing = createContentAgencyRouter(
      failingService<ContentAgencyApplicationService>('getDashboard'),
    );
    const response = await failing.getDashboard({ userId: 'u' }, ctx);
    expect(response.success).toBe(false);
  });
});

// ── PortalRouter ─────────────────────────────────────────────────────────────

describe('PortalRouter', () => {
  const router = createPortalRouter(successService<ClientOperationsApplicationService>());
  const handlers: Array<[string, Record<string, unknown>]> = [
    ['login', { token: 'tok-1234567890abcdef' }],
    ['getDashboard', { token: 'tok-1234567890abcdef' }],
    ['listContent', { token: 'tok-1234567890abcdef' }],
    ['getContent', { token: 'tok-1234567890abcdef', contentId: 'x1' }],
    ['approveContent', { token: 'tok-1234567890abcdef', contentId: 'x1', comment: 'ok' }],
    ['rejectContent', { token: 'tok-1234567890abcdef', contentId: 'x1', comment: 'no' }],
    ['commentContent', { token: 'tok-1234567890abcdef', contentId: 'x1', comment: 'nice' }],
    ['downloadDeliverable', { token: 'tok-1234567890abcdef', contentId: 'x1', format: 'pdf' }],
    ['listInvoices', { token: 'tok-1234567890abcdef' }],
    ['getInvoice', { token: 'tok-1234567890abcdef', invoiceId: 'i1' }],
  ];

  it.each(handlers)('handler %s succeeds', async (name, input) => {
    const handler = router[name as keyof typeof router] as (
      i: Record<string, unknown>,
      c: typeof ctx,
    ) => Promise<unknown>;
    const response = (await handler(input, ctx)) as { success: boolean };
    expect(response.success).toBe(true);
  });

  it('maps a service error to a failure envelope', async () => {
    const failing = createPortalRouter(
      failingService<ClientOperationsApplicationService>('portalLogin'),
    );
    const response = await failing.login({ token: 'tok-1234567890abcdef' }, ctx);
    expect(response.success).toBe(false);
  });
});
