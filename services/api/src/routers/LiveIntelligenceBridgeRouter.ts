// ──────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Live Intelligence Bridge Router
// EPIC-017 — the LIVE INTELLIGENCE BRIDGE
//
// The liveIntelligence.* namespace runs the full loop through the
// existing Brain → Intelligence → Marketplace → Execution ecosystem:
//   start (understand) → discover → compare → recommend → approve /
//   reject → handOff (configuration/execution) → verify →
//   evaluateAndLearn (outcome + feedback + notification) → reads.
// Every procedure is authenticated + rate-limited; ownership is
// enforced at the service boundary (IDOR refused there) AND by the
// auth middleware (input.userId must match the session user).
// ──────────────────────────────────────────────────────────────────

import type { LiveIntelligenceBridgeService } from '@vedmoulya/live-intelligence-bridge';
import type { BridgeNotificationKind } from '@vedmoulya/live-intelligence-bridge';
import type { TRPCContext } from '../services/RouterRegistry.js';
import { assertRateLimit, RateLimitTiers } from '../middleware/rate-limit.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { fromServiceResult } from '../services/ResponseMapper.js';

export interface LiveIntelligenceHandlers {
  start: (input: { userId: string; objective: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  discover: (input: { userId: string; loopId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  compare: (input: { userId: string; loopId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  recommend: (input: { userId: string; loopId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  approve: (
    input: { userId: string; loopId: string; recommendationId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  reject: (
    input: { userId: string; loopId: string; recommendationId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  handOff: (input: { userId: string; loopId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  verify: (
    input: { userId: string; loopId: string },
    ctx: TRPCContext,
  ) => ApiResponse | Promise<ApiResponse>;
  evaluateAndLearn: (
    input: { userId: string; loopId: string; outputAccepted: boolean },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  get: (
    input: { userId: string; loopId: string },
    ctx: TRPCContext,
  ) => ApiResponse | Promise<ApiResponse>;
  list: (input: { userId: string }, ctx: TRPCContext) => ApiResponse | Promise<ApiResponse>;
  performanceProfile: (
    input: { userId: string },
    ctx: TRPCContext,
  ) => ApiResponse | Promise<ApiResponse>;
  emitNotification: (
    input: {
      userId: string;
      loopId: string;
      kind: BridgeNotificationKind;
      title: string;
      body: string;
      relevance: number;
    },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

export function createLiveIntelligenceBridgeRouter(
  service: LiveIntelligenceBridgeService,
): LiveIntelligenceHandlers {
  return {
    start: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(await service.start(input.userId, input.objective));
    },

    discover: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(await service.discover(input.userId, input.loopId));
    },

    compare: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(await service.compare(input.userId, input.loopId));
    },

    recommend: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(await service.recommend(input.userId, input.loopId));
    },

    approve: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(
        await service.approve(input.userId, input.loopId, input.recommendationId),
      );
    },

    reject: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(
        await service.reject(input.userId, input.loopId, input.recommendationId),
      );
    },

    handOff: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(await service.handOff(input.userId, input.loopId));
    },

    verify: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.verify(input.userId, input.loopId));
    },

    evaluateAndLearn: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(
        await service.evaluateAndLearn(input.userId, input.loopId, input.outputAccepted),
      );
    },

    get: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.get(input.userId, input.loopId));
    },

    list: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.list(input.userId));
    },

    performanceProfile: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult(service.performanceProfile(input.userId));
    },

    emitNotification: async (input, _ctx): Promise<ApiResponse> => {
      await assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(
        await service.emitNotification(input.userId, input.loopId, {
          kind: input.kind,
          title: input.title,
          body: input.body,
          relevance: input.relevance,
        }),
      );
    },
  };
}
