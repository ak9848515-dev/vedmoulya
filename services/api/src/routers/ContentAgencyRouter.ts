// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Content Agency Router
// AI Content Agency procedures (EPIC-003 / SPRINT AC-001)
// ─────────────────────────────────────────────────────────────────────────────

import type { ContentAgencyApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry) using
// JSON-safe shapes; the application service re-validates business rules.

export interface ContentAgencyHandlers {
  // Dashboard + analytics
  getDashboard: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getAnalytics: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Clients
  listClients: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getClient: (
    input: { userId: string; clientId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  createClient: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  updateClient: (
    input: { userId: string; clientId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  deleteClient: (
    input: { userId: string; clientId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Brands
  listBrands: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getBrand: (input: { userId: string; brandId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  upsertBrand: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  deleteBrand: (
    input: { userId: string; brandId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Projects
  listProjects: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getProject: (
    input: { userId: string; projectId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  createProject: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  updateProject: (
    input: { userId: string; projectId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  deleteProject: (
    input: { userId: string; projectId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Content
  listContent: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getContent: (
    input: { userId: string; contentId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  generateContent: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  createDraft: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  transitionStatus: (
    input: { userId: string; contentId: string; to: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  scheduleContent: (
    input: { userId: string; contentId: string; scheduledFor: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  publishContent: (
    input: { userId: string; contentId: string; publishedUrl?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  addReview: (
    input: { userId: string; contentId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  regenerateContent: (
    input: { userId: string; contentId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Calendar
  getCalendar: (
    input: { userId: string; range: string; anchor?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Invoices
  listInvoices: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getInvoice: (
    input: { userId: string; invoiceId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  createInvoice: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  updateInvoiceStatus: (
    input: { userId: string; invoiceId: string; status: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  deleteInvoice: (
    input: { userId: string; invoiceId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Delivery
  exportContent: (
    input: { userId: string; contentId: string; format: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

export function createContentAgencyRouter(
  contentAgencyService: ContentAgencyApplicationService,
): ContentAgencyHandlers {
  const svc = contentAgencyService;
  return {
    // ── Dashboard + analytics ────────────────────────────────────────────
    getDashboard: async (input, _ctx) => fromServiceResult(await svc.getDashboard(input.userId)),
    getAnalytics: async (input, _ctx) => fromServiceResult(await svc.getAnalytics(input.userId)),

    // ── Clients ──────────────────────────────────────────────────────────
    listClients: async (input, _ctx) => fromServiceResult(await svc.listClients(input.userId)),
    getClient: async (input, _ctx) =>
      fromServiceResult(await svc.getClient(input.userId, input.clientId)),
    createClient: async (input, _ctx) =>
      fromServiceResult(
        await svc.createClient(
          input.userId,
          input as unknown as Parameters<typeof svc.createClient>[1],
        ),
      ),
    updateClient: async (input, _ctx) =>
      fromServiceResult(
        await svc.updateClient(
          input.userId,
          input.clientId,
          input as unknown as Parameters<typeof svc.updateClient>[2],
        ),
      ),
    deleteClient: async (input, _ctx) =>
      fromServiceResult(await svc.deleteClient(input.userId, input.clientId)),

    // ── Brands ───────────────────────────────────────────────────────────
    listBrands: async (input, _ctx) => fromServiceResult(await svc.listBrands(input.userId)),
    getBrand: async (input, _ctx) =>
      fromServiceResult(await svc.getBrand(input.userId, input.brandId)),
    upsertBrand: async (input, _ctx) =>
      fromServiceResult(
        await svc.upsertBrand(
          input.userId,
          input as unknown as Parameters<typeof svc.upsertBrand>[1],
        ),
      ),
    deleteBrand: async (input, _ctx) =>
      fromServiceResult(await svc.deleteBrand(input.userId, input.brandId)),

    // ── Projects ─────────────────────────────────────────────────────────
    listProjects: async (input, _ctx) => fromServiceResult(await svc.listProjects(input.userId)),
    getProject: async (input, _ctx) =>
      fromServiceResult(await svc.getProject(input.userId, input.projectId)),
    createProject: async (input, _ctx) =>
      fromServiceResult(
        await svc.createProject(
          input.userId,
          input as unknown as Parameters<typeof svc.createProject>[1],
        ),
      ),
    updateProject: async (input, _ctx) =>
      fromServiceResult(
        await svc.updateProject(
          input.userId,
          input.projectId,
          input as unknown as Parameters<typeof svc.updateProject>[2],
        ),
      ),
    deleteProject: async (input, _ctx) =>
      fromServiceResult(await svc.deleteProject(input.userId, input.projectId)),

    // ── Content ──────────────────────────────────────────────────────────
    listContent: async (input, _ctx) => fromServiceResult(await svc.listContent(input.userId)),
    getContent: async (input, _ctx) =>
      fromServiceResult(await svc.getContent(input.userId, input.contentId)),
    generateContent: async (input, _ctx) =>
      fromServiceResult(
        await svc.generateContent(
          input.userId,
          input as unknown as Parameters<typeof svc.generateContent>[1],
        ),
      ),
    createDraft: async (input, _ctx) =>
      fromServiceResult(
        await svc.createDraft(
          input.userId,
          input as unknown as Parameters<typeof svc.createDraft>[1],
        ),
      ),
    transitionStatus: async (input, _ctx) =>
      fromServiceResult(
        await svc.transitionStatus(
          input.userId,
          input.contentId,
          input.to as 'draft' | 'review' | 'approved' | 'scheduled' | 'published',
        ),
      ),
    scheduleContent: async (input, _ctx) =>
      fromServiceResult(
        await svc.scheduleContent(input.userId, input.contentId, input.scheduledFor),
      ),
    publishContent: async (input, _ctx) =>
      fromServiceResult(
        await svc.publishContent(input.userId, input.contentId, input.publishedUrl),
      ),
    addReview: async (input, _ctx) =>
      fromServiceResult(
        await svc.addReview(
          input.userId,
          input.contentId,
          input as unknown as Parameters<typeof svc.addReview>[2],
        ),
      ),
    regenerateContent: async (input, _ctx) =>
      fromServiceResult(
        await svc.regenerateContent(
          input.userId,
          input.contentId,
          input as unknown as Parameters<typeof svc.regenerateContent>[2],
        ),
      ),

    // ── Calendar ─────────────────────────────────────────────────────────
    getCalendar: async (input, _ctx) =>
      fromServiceResult(
        await svc.getCalendar(input.userId, input.range as 'month' | 'week' | 'day', input.anchor),
      ),

    // ── Invoices ─────────────────────────────────────────────────────────
    listInvoices: async (input, _ctx) => fromServiceResult(await svc.listInvoices(input.userId)),
    getInvoice: async (input, _ctx) =>
      fromServiceResult(await svc.getInvoice(input.userId, input.invoiceId)),
    createInvoice: async (input, _ctx) =>
      fromServiceResult(
        await svc.createInvoice(
          input.userId,
          input as unknown as Parameters<typeof svc.createInvoice>[1],
        ),
      ),
    updateInvoiceStatus: async (input, _ctx) =>
      fromServiceResult(
        await svc.updateInvoiceStatus(
          input.userId,
          input.invoiceId,
          input.status as 'draft' | 'sent' | 'paid',
        ),
      ),
    deleteInvoice: async (input, _ctx) =>
      fromServiceResult(await svc.deleteInvoice(input.userId, input.invoiceId)),

    // ── Delivery ─────────────────────────────────────────────────────────
    exportContent: async (input, _ctx) =>
      fromServiceResult(
        await svc.exportContent(
          input.userId,
          input.contentId,
          input.format as 'markdown' | 'html' | 'pdf' | 'docx',
        ),
      ),
  };
}
