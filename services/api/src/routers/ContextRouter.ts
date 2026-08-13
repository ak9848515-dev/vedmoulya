// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Context Router
// Enterprise Context Intelligence Engine procedures (EPIC-004 / EI-003)
// ─────────────────────────────────────────────────────────────────────────────

import type { ContextApplicationService } from '@vedmoulya/context';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry) using
// JSON-safe shapes; the application service re-validates business rules.

export interface ContextHandlers {
  // Registry
  getContext: (input: { userId: string; id: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  registerContext: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  bulkRegisterContext: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  deleteContext: (input: { userId: string; id: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getSummary: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getMetrics: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Intelligence pipeline
  rank: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  filter: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  compress: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  assemble: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Discovery
  discover: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  search: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  preview: (input: { userId: string; id: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  explain: (
    input: { userId: string; id: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Lookups
  listBySource: (
    input: { userId: string; source: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listByCategory: (
    input: { userId: string; category: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listByPriority: (
    input: { userId: string; priority: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listByCapability: (
    input: { userId: string; capability: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

export function createContextRouter(contextService: ContextApplicationService): ContextHandlers {
  const svc = contextService;
  return {
    // ── Registry ───────────────────────────────────────────────────────────
    getContext: async (input, _ctx) => fromServiceResult(await svc.getContext(input.id)),
    registerContext: async (input, _ctx) =>
      fromServiceResult(
        await svc.registerContext(input as unknown as Parameters<typeof svc.registerContext>[0]),
      ),
    bulkRegisterContext: async (input, _ctx) =>
      fromServiceResult(
        await svc.bulkRegisterContext(
          (input as { items?: unknown[] }).items as Parameters<typeof svc.bulkRegisterContext>[0],
        ),
      ),
    deleteContext: async (input, _ctx) => fromServiceResult(await svc.deleteContext(input.id)),
    getSummary: async (_input, _ctx) => fromServiceResult(await svc.getContextSummary()),
    getMetrics: async (_input, _ctx) => fromServiceResult(await svc.getContextMetrics()),

    // ── Intelligence pipeline ─────────────────────────────────────────────
    rank: async (input, _ctx) =>
      fromServiceResult(
        await svc.rankContext(
          input as unknown as Parameters<typeof svc.rankContext>[0],
          (input as { capability?: string }).capability as Parameters<typeof svc.rankContext>[1],
          (input as { requestIntent?: string }).requestIntent,
          (input as { businessContext?: string[] }).businessContext,
          (input as { maxResults?: number }).maxResults,
        ),
      ),
    filter: async (input, _ctx) =>
      fromServiceResult(
        await svc.filterContext(input as unknown as Parameters<typeof svc.filterContext>[0]),
      ),
    compress: async (input, _ctx) =>
      fromServiceResult(
        await svc.compressContext(
          input as unknown as Parameters<typeof svc.compressContext>[0],
          (input as { targetTokens?: number }).targetTokens ?? 4000,
          (input as { strategy?: string }).strategy as Parameters<typeof svc.compressContext>[2],
          (input as { preserveCritical?: boolean }).preserveCritical,
          (input as { minConfidence?: number }).minConfidence,
        ),
      ),
    assemble: async (input, _ctx) =>
      fromServiceResult(
        await svc.assembleContext(
          input as unknown as Parameters<typeof svc.assembleContext>[0],
          (input as { goal?: string }).goal ?? 'Enterprise request',
          (input as { capability?: Parameters<typeof svc.assembleContext>[2] }).capability ??
            'general_conversation',
          (input as { prompt?: string }).prompt ?? '',
          (input as { requestIntent?: string }).requestIntent,
          (input as { businessContext?: string[] }).businessContext,
          (input as { targetTokens?: number }).targetTokens,
          (input as { strategy?: string }).strategy as Parameters<typeof svc.assembleContext>[7],
        ),
      ),

    // ── Discovery ─────────────────────────────────────────────────────────
    discover: async (input, _ctx) =>
      fromServiceResult(
        await svc.discoverContext(
          input as unknown as Parameters<typeof svc.discoverContext>[0],
          (input as { capability?: Parameters<typeof svc.discoverContext>[1] }).capability,
          (input as { businessContext?: string[] }).businessContext,
        ),
      ),
    search: async (input, _ctx) =>
      fromServiceResult(
        await svc.searchContext(input as unknown as Parameters<typeof svc.searchContext>[0]),
      ),
    preview: async (input, _ctx) =>
      fromServiceResult(
        await svc.previewContext(
          input.id,
          (input as { capability?: Parameters<typeof svc.previewContext>[1] }).capability,
        ),
      ),
    explain: async (input, _ctx) =>
      fromServiceResult(
        await svc.explainContext(
          input.id,
          (input as { capability?: Parameters<typeof svc.explainContext>[1] }).capability,
          (input as { originalTokens?: number }).originalTokens,
          (input as { compressedTokens?: number }).compressedTokens,
        ),
      ),

    // ── Lookups ───────────────────────────────────────────────────────────
    listBySource: async (input, _ctx) =>
      fromServiceResult(
        await svc.listBySource(input.source as Parameters<typeof svc.listBySource>[0]),
      ),
    listByCategory: async (input, _ctx) =>
      fromServiceResult(
        await svc.listByCategory(input.category as Parameters<typeof svc.listByCategory>[0]),
      ),
    listByPriority: async (input, _ctx) =>
      fromServiceResult(
        await svc.listByPriority(input.priority as Parameters<typeof svc.listByPriority>[0]),
      ),
    listByCapability: async (input, _ctx) =>
      fromServiceResult(
        await svc.listByCapability(input.capability as Parameters<typeof svc.listByCapability>[0]),
      ),
  };
}
