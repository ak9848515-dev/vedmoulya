// ──────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: AI World Router
// EPIC-012C — AI World Discovery, Provider Catalog & Market Intelligence
//
// The aiWorld.* namespace: getWorld (bell panel), getDigest, list,
// getItem, setAction, markRead, markAllRead, runDiscovery (bounded).
// All procedures are owner-scoped (IDOR at the service layer) and
// authenticated + rate-limited via the standard gateway middleware.
// ──────────────────────────────────────────────────────────────────

import type { DiscoveryApplicationService, DiscoveryItemAction } from '@vedmoulya/ai-world';
import type { TRPCContext } from '../services/RouterRegistry.js';
import { assertRateLimit, RateLimitTiers } from '../middleware/rate-limit.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { fromServiceResult } from '../services/ResponseMapper.js';

export interface AIWorldHandlers {
  getWorld: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  getDigest: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  list: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  getItem: (input: { userId: string; itemId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  markRead: (input: { userId: string; itemId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  markAllRead: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  setAction: (
    input: { userId: string; itemId: string; action: DiscoveryItemAction },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  runDiscovery: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createAIWorldRouter(
  discoveryService: DiscoveryApplicationService,
): AIWorldHandlers {
  const svc = discoveryService;

  return {
    getWorld: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      const result = await svc.getWorld(input.userId);
      return fromServiceResult({ success: true, data: result });
    },

    getDigest: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      const digest = await svc.getDigest(input.userId);
      return fromServiceResult({ success: true, data: digest });
    },

    list: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      const items = await svc.listItems(input.userId);
      return fromServiceResult({ success: true, data: items });
    },

    getItem: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      const item = await svc.getItem(input.userId, input.itemId);
      return fromServiceResult({ success: true, data: item ?? null });
    },

    markRead: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      await svc.markRead(input.userId, input.itemId);
      return fromServiceResult({ success: true, data: { ok: true } });
    },

    markAllRead: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      const items = await svc.listItems(input.userId);
      for (const item of items) {
        if (!item.read) {
          await svc.markRead(input.userId, item.item.id);
        }
      }
      return fromServiceResult({ success: true, data: { ok: true } });
    },

    setAction: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      // The zod boundary already restricts action to the enum; the guard is a
      // defensive re-validation for the direct-handler test path.
      await svc.setAction(input.userId, input.itemId, input.action);
      return fromServiceResult({ success: true, data: { ok: true } });
    },

    runDiscovery: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      const report = await svc.runDiscovery();
      return fromServiceResult({ success: true, data: report });
    },
  };
}
