// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Enterprise Learning Intelligence Router
// Enterprise Learning Intelligence Platform procedures (EPIC-004 / EI-007)
// ─────────────────────────────────────────────────────────────────────────────

import type { LearningIntelligenceApplicationService } from '@vedmoulya/learning-intelligence';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry) using
// JSON-safe shapes; the application service re-validates business rules and
// enforces the learning safety gates (human approval, confidence thresholds).

export interface LearningIntelligenceHandlers {
  // Events
  recordEvent: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listEvents: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getEvent: (input: { userId: string; eventId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getTimeline: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Models & insights
  getModels: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getInsights: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Recommendations + safety workflow
  getRecommendations: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getRecommendation: (
    input: { userId: string; recommendationId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  approveRecommendation: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  rejectRecommendation: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  rollbackRecommendation: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Analytics, reports, dashboard
  getAnalytics: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getReports: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getDashboard: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createLearningIntelligenceRouter(
  learningIntelligence: LearningIntelligenceApplicationService,
): LearningIntelligenceHandlers {
  const svc = learningIntelligence;
  return {
    // ── Events ─────────────────────────────────────────────────────────────
    recordEvent: async (input, _ctx) =>
      fromServiceResult(
        await svc.recordEvent(input as unknown as Parameters<typeof svc.recordEvent>[0]),
      ),
    listEvents: async (input, _ctx) =>
      fromServiceResult(
        await svc.listEvents(input as unknown as Parameters<typeof svc.listEvents>[0]),
      ),
    getEvent: async (input, _ctx) => fromServiceResult(await svc.getEvent(input.eventId)),
    getTimeline: async (input, _ctx) =>
      fromServiceResult(
        await svc.getTimeline(input as unknown as Parameters<typeof svc.getTimeline>[0]),
      ),

    // ── Models & insights ─────────────────────────────────────────────────
    getModels: async (input, _ctx) =>
      fromServiceResult(
        await svc.getModels(input as unknown as Parameters<typeof svc.getModels>[0]),
      ),
    getInsights: async (input, _ctx) =>
      fromServiceResult(
        await svc.getInsights(input as unknown as Parameters<typeof svc.getInsights>[0]),
      ),

    // ── Recommendations + safety workflow ─────────────────────────────────
    getRecommendations: async (input, _ctx) =>
      fromServiceResult(
        await svc.getRecommendations(
          input as unknown as Parameters<typeof svc.getRecommendations>[0],
        ),
      ),
    getRecommendation: async (input, _ctx) =>
      fromServiceResult(await svc.getRecommendation(input.recommendationId)),
    approveRecommendation: async (input, _ctx) =>
      fromServiceResult(
        await svc.approveRecommendation(
          input as unknown as Parameters<typeof svc.approveRecommendation>[0],
        ),
      ),
    rejectRecommendation: async (input, _ctx) =>
      fromServiceResult(
        await svc.rejectRecommendation(
          input as unknown as Parameters<typeof svc.rejectRecommendation>[0],
        ),
      ),
    rollbackRecommendation: async (input, _ctx) =>
      fromServiceResult(
        await svc.rollbackRecommendation(
          input as unknown as Parameters<typeof svc.rollbackRecommendation>[0],
        ),
      ),

    // ── Analytics, reports, dashboard ─────────────────────────────────────
    getAnalytics: async (input, _ctx) =>
      fromServiceResult(
        await svc.getAnalytics(input as unknown as Parameters<typeof svc.getAnalytics>[0]),
      ),
    getReports: async (input, _ctx) =>
      fromServiceResult(
        await svc.getReports(input as unknown as Parameters<typeof svc.getReports>[0]),
      ),
    getDashboard: async (_input, _ctx) => fromServiceResult(await svc.getDashboard()),
  };
}
