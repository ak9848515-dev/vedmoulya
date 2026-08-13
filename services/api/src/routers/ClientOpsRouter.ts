// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Client Operations Router
// Client Operations & Revenue Engine procedures (EPIC-003 / SPRINT AC-002)
// ─────────────────────────────────────────────────────────────────────────────

import type { ClientOperationsApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry) using
// JSON-safe shapes; the application service re-validates business rules.

export interface ClientOpsHandlers {
  // CRM
  listLeads: (
    input: { userId: string; status?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getLead: (input: { userId: string; leadId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  createLead: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  updateLead: (
    input: { userId: string; leadId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  moveLead: (
    input: { userId: string; leadId: string; to: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  archiveLead: (
    input: { userId: string; leadId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  addInteraction: (
    input: { userId: string; leadId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  addTask: (
    input: { userId: string; leadId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  completeTask: (
    input: { userId: string; leadId: string; taskId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  addContact: (
    input: { userId: string; leadId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  deleteContact: (
    input: { userId: string; leadId: string; contactId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Proposals
  listProposals: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getProposal: (
    input: { userId: string; proposalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  createProposal: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  updateProposal: (
    input: { userId: string; proposalId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  generateProposal: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  sendProposal: (
    input: { userId: string; proposalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  acceptProposal: (
    input: { userId: string; proposalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  rejectProposal: (
    input: { userId: string; proposalId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  exportProposal: (
    input: { userId: string; proposalId: string; format: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Contracts
  listContracts: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getContract: (
    input: { userId: string; contractId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  createContract: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  updateContract: (
    input: { userId: string; contractId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  approveContract: (
    input: { userId: string; contractId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  terminateContract: (
    input: { userId: string; contractId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  renewContract: (
    input: { userId: string; contractId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listExpiringContracts: (
    input: { userId: string; days?: number },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Quotations
  listQuotations: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getQuotation: (
    input: { userId: string; quotationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  createQuotation: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  updateQuotation: (
    input: { userId: string; quotationId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  sendQuotation: (
    input: { userId: string; quotationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  acceptQuotation: (
    input: { userId: string; quotationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  rejectQuotation: (
    input: { userId: string; quotationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Payments & revenue
  listPayments: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  addPayment: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getRevenueOverview: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Documents
  listDocuments: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getDocument: (
    input: { userId: string; documentId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  uploadDocument: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  updateDocument: (
    input: { userId: string; documentId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  deleteDocument: (
    input: { userId: string; documentId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  searchDocuments: (
    input: { userId: string; query: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Portal access management
  createPortalAccess: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listPortalAccess: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  revokePortalAccess: (
    input: { userId: string; accessId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Notifications
  listNotifications: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  markNotificationRead: (
    input: { userId: string; notificationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  markAllNotificationsRead: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Analytics
  getBusinessAnalytics: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createClientOpsRouter(
  clientOpsService: ClientOperationsApplicationService,
): ClientOpsHandlers {
  const svc = clientOpsService;
  return {
    // ── CRM ──────────────────────────────────────────────────────────────
    listLeads: async (input, _ctx) =>
      fromServiceResult(
        await svc.listLeads(
          input.userId,
          input.status as
            | 'lead'
            | 'qualified'
            | 'proposal'
            | 'negotiation'
            | 'won'
            | 'lost'
            | 'archived'
            | undefined,
        ),
      ),
    getLead: async (input, _ctx) =>
      fromServiceResult(await svc.getLead(input.userId, input.leadId)),
    createLead: async (input, _ctx) =>
      fromServiceResult(
        await svc.createLead(
          input.userId,
          input as unknown as Parameters<typeof svc.createLead>[1],
        ),
      ),
    updateLead: async (input, _ctx) =>
      fromServiceResult(
        await svc.updateLead(
          input.userId,
          input.leadId,
          input as unknown as Parameters<typeof svc.updateLead>[2],
        ),
      ),
    moveLead: async (input, _ctx) =>
      fromServiceResult(
        await svc.moveLead(
          input.userId,
          input.leadId,
          input.to as 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost',
        ),
      ),
    archiveLead: async (input, _ctx) =>
      fromServiceResult(await svc.archiveLead(input.userId, input.leadId)),
    addInteraction: async (input, _ctx) =>
      fromServiceResult(
        await svc.addInteraction(
          input.userId,
          input.leadId,
          input as unknown as Parameters<typeof svc.addInteraction>[2],
        ),
      ),
    addTask: async (input, _ctx) =>
      fromServiceResult(
        await svc.addTask(
          input.userId,
          input.leadId,
          input as unknown as Parameters<typeof svc.addTask>[2],
        ),
      ),
    completeTask: async (input, _ctx) =>
      fromServiceResult(await svc.completeTask(input.userId, input.leadId, input.taskId)),
    addContact: async (input, _ctx) =>
      fromServiceResult(
        await svc.addContact(
          input.userId,
          input.leadId,
          input as unknown as Parameters<typeof svc.addContact>[2],
        ),
      ),
    deleteContact: async (input, _ctx) =>
      fromServiceResult(await svc.deleteContact(input.userId, input.leadId, input.contactId)),

    // ── Proposals ────────────────────────────────────────────────────────
    listProposals: async (input, _ctx) => fromServiceResult(await svc.listProposals(input.userId)),
    getProposal: async (input, _ctx) =>
      fromServiceResult(await svc.getProposal(input.userId, input.proposalId)),
    createProposal: async (input, _ctx) =>
      fromServiceResult(
        await svc.createProposal(
          input.userId,
          input as unknown as Parameters<typeof svc.createProposal>[1],
        ),
      ),
    updateProposal: async (input, _ctx) =>
      fromServiceResult(
        await svc.updateProposal(
          input.userId,
          input.proposalId,
          input as unknown as Parameters<typeof svc.updateProposal>[2],
        ),
      ),
    generateProposal: async (input, _ctx) =>
      fromServiceResult(
        await svc.generateProposal(
          input.userId,
          input as unknown as Parameters<typeof svc.generateProposal>[1],
        ),
      ),
    sendProposal: async (input, _ctx) =>
      fromServiceResult(await svc.sendProposal(input.userId, input.proposalId)),
    acceptProposal: async (input, _ctx) =>
      fromServiceResult(await svc.acceptProposal(input.userId, input.proposalId)),
    rejectProposal: async (input, _ctx) =>
      fromServiceResult(await svc.rejectProposal(input.userId, input.proposalId)),
    exportProposal: async (input, _ctx) =>
      fromServiceResult(
        await svc.exportProposal(
          input.userId,
          input.proposalId,
          input.format as 'markdown' | 'html' | 'pdf' | 'docx',
        ),
      ),

    // ── Contracts ────────────────────────────────────────────────────────
    listContracts: async (input, _ctx) => fromServiceResult(await svc.listContracts(input.userId)),
    getContract: async (input, _ctx) =>
      fromServiceResult(await svc.getContract(input.userId, input.contractId)),
    createContract: async (input, _ctx) =>
      fromServiceResult(
        await svc.createContract(
          input.userId,
          input as unknown as Parameters<typeof svc.createContract>[1],
        ),
      ),
    updateContract: async (input, _ctx) =>
      fromServiceResult(
        await svc.updateContract(
          input.userId,
          input.contractId,
          input as unknown as Parameters<typeof svc.updateContract>[2],
        ),
      ),
    approveContract: async (input, _ctx) =>
      fromServiceResult(
        await svc.approveContract(
          input.userId,
          input.contractId,
          input as unknown as Parameters<typeof svc.approveContract>[2],
        ),
      ),
    terminateContract: async (input, _ctx) =>
      fromServiceResult(await svc.terminateContract(input.userId, input.contractId)),
    renewContract: async (input, _ctx) =>
      fromServiceResult(
        await svc.renewContract(
          input.userId,
          input.contractId,
          input as unknown as Parameters<typeof svc.renewContract>[2],
        ),
      ),
    listExpiringContracts: async (input, _ctx) =>
      fromServiceResult(await svc.listExpiringContracts(input.userId, input.days)),

    // ── Quotations ───────────────────────────────────────────────────────
    listQuotations: async (input, _ctx) =>
      fromServiceResult(await svc.listQuotations(input.userId)),
    getQuotation: async (input, _ctx) =>
      fromServiceResult(await svc.getQuotation(input.userId, input.quotationId)),
    createQuotation: async (input, _ctx) =>
      fromServiceResult(
        await svc.createQuotation(
          input.userId,
          input as unknown as Parameters<typeof svc.createQuotation>[1],
        ),
      ),
    updateQuotation: async (input, _ctx) =>
      fromServiceResult(
        await svc.updateQuotation(
          input.userId,
          input.quotationId,
          input as unknown as Parameters<typeof svc.updateQuotation>[2],
        ),
      ),
    sendQuotation: async (input, _ctx) =>
      fromServiceResult(await svc.sendQuotation(input.userId, input.quotationId)),
    acceptQuotation: async (input, _ctx) =>
      fromServiceResult(await svc.acceptQuotation(input.userId, input.quotationId)),
    rejectQuotation: async (input, _ctx) =>
      fromServiceResult(await svc.rejectQuotation(input.userId, input.quotationId)),

    // ── Payments & revenue ───────────────────────────────────────────────
    listPayments: async (input, _ctx) => fromServiceResult(await svc.listPayments(input.userId)),
    addPayment: async (input, _ctx) =>
      fromServiceResult(
        await svc.addPayment(
          input.userId,
          input as unknown as Parameters<typeof svc.addPayment>[1],
        ),
      ),
    getRevenueOverview: async (input, _ctx) =>
      fromServiceResult(await svc.getRevenueOverview(input.userId)),

    // ── Documents ────────────────────────────────────────────────────────
    listDocuments: async (input, _ctx) => fromServiceResult(await svc.listDocuments(input.userId)),
    getDocument: async (input, _ctx) =>
      fromServiceResult(await svc.getDocument(input.userId, input.documentId)),
    uploadDocument: async (input, _ctx) =>
      fromServiceResult(
        await svc.uploadDocument(
          input.userId,
          input as unknown as Parameters<typeof svc.uploadDocument>[1],
        ),
      ),
    updateDocument: async (input, _ctx) =>
      fromServiceResult(
        await svc.updateDocument(
          input.userId,
          input.documentId,
          input as unknown as Parameters<typeof svc.updateDocument>[2],
        ),
      ),
    deleteDocument: async (input, _ctx) =>
      fromServiceResult(await svc.deleteDocument(input.userId, input.documentId)),
    searchDocuments: async (input, _ctx) =>
      fromServiceResult(await svc.searchDocuments(input.userId, input.query)),

    // ── Portal access management ─────────────────────────────────────────
    createPortalAccess: async (input, _ctx) =>
      fromServiceResult(
        await svc.createPortalAccess(
          input.userId,
          input as unknown as Parameters<typeof svc.createPortalAccess>[1],
        ),
      ),
    listPortalAccess: async (input, _ctx) =>
      fromServiceResult(await svc.listPortalAccess(input.userId)),
    revokePortalAccess: async (input, _ctx) =>
      fromServiceResult(await svc.revokePortalAccess(input.userId, input.accessId)),

    // ── Notifications ────────────────────────────────────────────────────
    listNotifications: async (input, _ctx) =>
      fromServiceResult(await svc.listNotifications(input.userId)),
    markNotificationRead: async (input, _ctx) =>
      fromServiceResult(await svc.markNotificationRead(input.userId, input.notificationId)),
    markAllNotificationsRead: async (input, _ctx) =>
      fromServiceResult(await svc.markAllNotificationsRead(input.userId)),

    // ── Analytics ────────────────────────────────────────────────────────
    getBusinessAnalytics: async (input, _ctx) =>
      fromServiceResult(await svc.getBusinessAnalytics(input.userId)),
  };
}
