// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Client Portal Router
// Secure client portal procedures (EPIC-003 / SPRINT AC-002, Module 7).
// These are PUBLIC procedures — the credential is the portal access token
// issued by the agency (hashed at rest, SHA-256). Every handler resolves the
// token to a client session and scopes all data to that client.
// ─────────────────────────────────────────────────────────────────────────────

import type { ClientOperationsApplicationService } from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

export interface PortalHandlers {
  login: (input: { token: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getDashboard: (input: { token: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  listContent: (input: { token: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getContent: (
    input: { token: string; contentId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  approveContent: (
    input: { token: string; contentId: string; comment: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  rejectContent: (
    input: { token: string; contentId: string; comment: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  commentContent: (
    input: { token: string; contentId: string; comment: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  downloadDeliverable: (
    input: { token: string; contentId: string; format: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listInvoices: (input: { token: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getInvoice: (
    input: { token: string; invoiceId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

export function createPortalRouter(
  clientOpsService: ClientOperationsApplicationService,
): PortalHandlers {
  const svc = clientOpsService;
  return {
    login: async (input, _ctx) => fromServiceResult(await svc.portalLogin(input.token)),
    getDashboard: async (input, _ctx) => fromServiceResult(await svc.portalDashboard(input.token)),
    listContent: async (input, _ctx) => fromServiceResult(await svc.portalListContent(input.token)),
    getContent: async (input, _ctx) =>
      fromServiceResult(await svc.portalGetContent(input.token, input.contentId)),
    approveContent: async (input, _ctx) =>
      fromServiceResult(
        await svc.portalApproveContent(input.token, input.contentId, input.comment),
      ),
    rejectContent: async (input, _ctx) =>
      fromServiceResult(await svc.portalRejectContent(input.token, input.contentId, input.comment)),
    commentContent: async (input, _ctx) =>
      fromServiceResult(
        await svc.portalCommentContent(input.token, input.contentId, input.comment),
      ),
    downloadDeliverable: async (input, _ctx) =>
      fromServiceResult(
        await svc.portalDownloadDeliverable(
          input.token,
          input.contentId,
          input.format as 'markdown' | 'html' | 'pdf' | 'docx',
        ),
      ),
    listInvoices: async (input, _ctx) =>
      fromServiceResult(await svc.portalListInvoices(input.token)),
    getInvoice: async (input, _ctx) =>
      fromServiceResult(await svc.portalGetInvoice(input.token, input.invoiceId)),
  };
}
