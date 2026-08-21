// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Proactive Router
// SPRINT-029 — proactive.* procedures.
//
//   proactive.refresh              — refresh recommendations from the EXISTING
//                                    Brain pipeline (idempotent; rides
//                                    brain.discoverIntelligence).
//   proactive.list                 — owner-scoped recommendations.
//   proactive.dismiss              — explicit user choice, never resurrected.
//   proactive.accept               — ACCEPTED for safe items; APPROVAL_REQUIRED
//                                    for anything sensitive (no self-authorization).
//   proactive.briefing             — no-spam daily briefing.
//   proactive.assessBusiness       — business-opportunity research/score ONLY
//                                    (never executes, never commits).
//
// Every procedure is authenticated + rate-limited + owner-checked by the
// central middleware (input.userId must match the session user). The proactive
// layer composes the frozen estate — it owns no authority.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { ProactiveIntelligenceService, ProactiveResult } from '@vedmoulya/proactive';
import type { TRPCContext } from '../services/RouterRegistry.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { successResponse } from '../services/ResponseMapper.js';

/** Map a proactive result to the standard envelope (same discipline as the
 *  voice router — the honest code is preserved in error.details.proactiveCode). */
function fromProactiveResult<T>(result: ProactiveResult<T>): ApiResponse<T> {
  if (result.success) {
    return successResponse(result.data);
  }
  const statusCode =
    result.code === 'NOT_FOUND'
      ? 404
      : result.code === 'APPROVAL_REQUIRED'
        ? 403
        : result.code === 'NOT_CONFIGURED'
          ? 503
          : result.code === 'BRAIN_UNAVAILABLE'
            ? 503
            : 500;
  return {
    success: false,
    error: {
      code: result.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      message: result.error || 'Proactive service error',
      statusCode,
      details: result.code ? { proactiveCode: result.code } : undefined,
    },
    meta: {
      timestamp: new Date().toISOString(),
      duration: 0,
      version: '1.0.0',
    },
  };
}

export interface ProactiveHandlers {
  refresh: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  list: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  dismiss: (
    input: { userId: string; recommendationId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  accept: (
    input: { userId: string; recommendationId: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  briefing: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  assessBusiness: (
    input: { userId: string; title: string; description: string; requiredCapabilities: string[] },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

export const proactiveInputs = {
  refresh: z.object({ userId: z.string().min(1) }),
  list: z.object({ userId: z.string().min(1) }),
  dismiss: z.object({ userId: z.string().min(1), recommendationId: z.string().min(1) }),
  accept: z.object({ userId: z.string().min(1), recommendationId: z.string().min(1) }),
  briefing: z.object({ userId: z.string().min(1) }),
  assessBusiness: z.object({
    userId: z.string().min(1),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(1000),
    requiredCapabilities: z.array(z.string()).max(20).default([]),
  }),
};

export function createProactiveRouter(service: ProactiveIntelligenceService): ProactiveHandlers {
  return {
    refresh: async (input): Promise<ApiResponse> => {
      const result = await service.refresh(input.userId);
      return fromProactiveResult(result);
    },
    list: (input): Promise<ApiResponse> =>
      Promise.resolve(fromProactiveResult(service.list(input.userId))),
    dismiss: (input): Promise<ApiResponse> =>
      Promise.resolve(fromProactiveResult(service.dismiss(input.userId, input.recommendationId))),
    accept: (input): Promise<ApiResponse> =>
      Promise.resolve(fromProactiveResult(service.accept(input.userId, input.recommendationId))),
    briefing: (input): Promise<ApiResponse> =>
      Promise.resolve(fromProactiveResult(service.briefing(input.userId))),
    assessBusiness: (input): Promise<ApiResponse> =>
      Promise.resolve(
        fromProactiveResult(
          service.assessBusiness(input.userId, {
            title: input.title,
            description: input.description,
            requiredCapabilities: input.requiredCapabilities,
          }),
        ),
      ),
  };
}
