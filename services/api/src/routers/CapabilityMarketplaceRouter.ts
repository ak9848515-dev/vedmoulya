// ──────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Capability Marketplace Router
// EPIC-013 — AI Capability Marketplace & Factory Intelligence
//
// The capability.* namespace: plan (outcome → FactoryCapabilityPlan),
// getPlan / listPlans (owner-scoped plan history — IDOR refused at
// the service), capabilities (marketplace view model). All
// procedures are authenticated + rate-limited + owner-scoped.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityMarketplaceApplicationService } from '@vedmoulya/capability-marketplace';
import type { TRPCContext } from '../services/RouterRegistry.js';
import { assertRateLimit, RateLimitTiers } from '../middleware/rate-limit.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { fromServiceResult } from '../services/ResponseMapper.js';

export interface CapabilityMarketplaceHandlers {
  plan: (input: { userId: string; outcome: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  getPlan: (input: { userId: string; planId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  listPlans: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  capabilities: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createCapabilityMarketplaceRouter(
  service: CapabilityMarketplaceApplicationService,
): CapabilityMarketplaceHandlers {
  return {
    plan: async (input, _ctx): Promise<ApiResponse> => {
      assertRateLimit(input.userId, RateLimitTiers.heavy);
      const plan = await service.plan(input.userId, {
        outcome: input.outcome,
      });
      return fromServiceResult({ success: true, data: plan });
    },

    getPlan: async (input, _ctx): Promise<ApiResponse> => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      const plan = await service.getPlan(input.userId, input.planId);
      return fromServiceResult({ success: true, data: plan ?? null });
    },

    listPlans: async (input, _ctx): Promise<ApiResponse> => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      const plans = await service.listPlans(input.userId);
      return fromServiceResult({ success: true, data: plans });
    },

    capabilities: async (input, _ctx): Promise<ApiResponse> => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      const view = await service.capabilities(input.userId);
      return fromServiceResult({ success: true, data: view });
    },
  };
}
