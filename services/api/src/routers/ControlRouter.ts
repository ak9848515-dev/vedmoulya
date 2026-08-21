// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Control Plane Router
// SPRINT-031 — control.* procedures.
//
//   control.settings.get / update       — user autonomy control (explicit +
//                                         confirmed only; fail-closed).
//   control.emergencyStop.status/engage/release — audited stop; never destructive.
//   control.cycle.run                   — ONE bounded observe→propose pass.
//                                         NEVER executes anything.
//   control.briefing.today              — composed no-spam briefing.
//   control.opportunities.list / transition — typed lifecycle with guarded
//                                         transitions (APPROVED/EXECUTED require
//                                         evidence from the EXISTING authorities).
//   control.gate.action                 — one fail-closed gate decision
//                                         (advisory — never authorizes).
//
// Every procedure is authenticated + rate-limited + owner-checked by the
// central middleware (input.userId must match the session user). The control
// plane composes the frozen estate — it owns no authority.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { ActiveIntelligenceControlPlane } from '@vedmoulya/control-plane';
import type { TRPCContext } from '../services/RouterRegistry.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { successResponse } from '../services/ResponseMapper.js';

const userIdInput = z.object({ userId: z.string().min(1) });

export const controlInputs = {
  settingsGet: userIdInput,
  settingsUpdate: z.object({
    userId: z.string().min(1),
    autonomyLevel: z.number().int().min(0).max(5),
    allowedCategories: z.array(z.string()).max(20).optional(),
    prohibitedCategories: z.array(z.string()).max(20).optional(),
    maxDailyCostUsd: z.number().min(0).optional(),
    maxTaskCostUsd: z.number().min(0).optional(),
    allowedProviders: z.array(z.string()).max(50).optional(),
    prohibitedProviders: z.array(z.string()).max(50).optional(),
    privateOnly: z.boolean().optional(),
    userConfirmed: z.boolean().optional(),
    notificationPreference: z.enum(['all', 'briefing-only', 'none']).optional(),
    quietHours: z.object({ start: z.string().optional(), end: z.string().optional() }).optional(),
    automationPermissions: z.array(z.string()).max(50).optional(),
  }),
  stopStatus: userIdInput,
  stopEngage: z.object({
    userId: z.string().min(1),
    reason: z.string().min(1).max(500),
    source: z.enum(['user', 'system', 'operator']).default('user'),
  }),
  stopRelease: z.object({
    userId: z.string().min(1),
    reason: z.string().min(1).max(500),
    source: z.enum(['user', 'system', 'operator']).default('user'),
  }),
  cycle: z.object({ userId: z.string().min(1), runDiscovery: z.boolean().optional() }),
  briefing: userIdInput,
  opportunitiesList: userIdInput,
  opportunityTransition: z.object({
    userId: z.string().min(1),
    id: z.string().min(1),
    to: z.enum([
      'DISCOVERED',
      'ASSESSED',
      'SHORTLISTED',
      'PRESENTED',
      'APPROVED',
      'PLANNED',
      'EXECUTED',
      'VERIFIED',
      'REJECTED',
      'COMPLETED',
    ]),
    note: z.string().max(400),
    approval: z
      .object({
        id: z.string().min(1),
        grantedBy: z.string().min(1),
        grantedAt: z.string().min(1),
        scope: z.string().min(1),
      })
      .optional(),
    execution: z
      .object({
        id: z.string().min(1),
        completedAt: z.string().min(1),
        verified: z.boolean(),
      })
      .optional(),
  }),
  gate: z.object({
    userId: z.string().min(1),
    action: z.string().min(1).max(300),
    category: z.string().min(1).max(40),
    providerId: z.string().optional(),
    additionalUsd: z.number().min(0).optional(),
  }),
};

export interface ControlHandlers {
  getSettings: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  updateSettings: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  stopStatus: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  engageStop: (
    input: { userId: string; reason: string; source: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  releaseStop: (
    input: { userId: string; reason: string; source: string },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  cycle: (
    input: { userId: string; runDiscovery?: boolean },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  briefing: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  listOpportunities: (input: { userId: string }, ctx: TRPCContext) => Promise<ApiResponse>;
  transitionOpportunity: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  gateAction: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
}

/** Map a control-plane result to the standard envelope (same discipline as
 *  the proactive/voice routers — the honest code is preserved in
 *  error.details.controlCode). */
function fromControlResult<T>(
  result: { success: true; data: T } | { success: false; error: string; code: string },
  statusCode: number,
): ApiResponse<T> {
  if (result.success) return successResponse(result.data);
  return {
    success: false,
    error: {
      code: result.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      message: result.error || 'Control plane error',
      statusCode,
      details: { controlCode: result.code },
    },
    meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
  };
}

export function createControlRouter(plane: ActiveIntelligenceControlPlane): ControlHandlers {
  return {
    getSettings: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(plane.getSettings(input.userId) ?? null)),

    updateSettings: async (input): Promise<ApiResponse> => {
      const result = plane.updateSettings({
        ownerId: input.userId as string,
        autonomyLevel: input.autonomyLevel as number,
        allowedCategories: input.allowedCategories as string[] | undefined,
        prohibitedCategories: input.prohibitedCategories as string[] | undefined,
        maxDailyCostUsd: input.maxDailyCostUsd as number | undefined,
        maxTaskCostUsd: input.maxTaskCostUsd as number | undefined,
        allowedProviders: input.allowedProviders as string[] | undefined,
        prohibitedProviders: input.prohibitedProviders as string[] | undefined,
        privateOnly: input.privateOnly as boolean | undefined,
        userConfirmed: input.userConfirmed as boolean | undefined,
        notificationPreference: input.notificationPreference as
          'all' | 'briefing-only' | 'none' | undefined,
        quietHours: input.quietHours as { start?: string; end?: string } | undefined,
        automationPermissions: input.automationPermissions as string[] | undefined,
        // The central IDOR middleware has already enforced input.userId ===
        // the authenticated session user — the caller IS the actor.
        updatedBy: input.userId as string,
      });
      return Promise.resolve(fromControlResult(result, 400));
    },

    stopStatus: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(plane.stopStatus(input.userId))),

    engageStop: async (input): Promise<ApiResponse> => {
      const result = plane.engageStop({
        ownerId: input.userId,
        actor: input.userId,
        reason: input.reason,
        source: input.source as 'user' | 'system' | 'operator',
      });
      return Promise.resolve(successResponse(result.state));
    },

    releaseStop: async (input): Promise<ApiResponse> => {
      const result = plane.releaseStop({
        ownerId: input.userId,
        actor: input.userId,
        reason: input.reason,
        source: input.source as 'user' | 'system' | 'operator',
      });
      return Promise.resolve(successResponse(result.state));
    },

    cycle: async (input): Promise<ApiResponse> => {
      const result = await plane.cycle(input.userId, { runDiscovery: input.runDiscovery ?? false });
      return Promise.resolve(fromControlResult(result, 500));
    },

    briefing: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(plane.todayBriefing(input.userId))),

    listOpportunities: async (input): Promise<ApiResponse> =>
      Promise.resolve(successResponse(plane.listOpportunities(input.userId))),

    transitionOpportunity: async (input): Promise<ApiResponse> => {
      const result = plane.transitionOpportunity({
        ownerId: input.userId as string,
        id: input.id as string,
        to: input.to as never,
        note: input.note as string,
        approval: input.approval as
          { id: string; grantedBy: string; grantedAt: string; scope: string } | undefined,
        execution: input.execution as
          { id: string; completedAt: string; verified: boolean } | undefined,
      });
      return result.success
        ? Promise.resolve(successResponse(result.record))
        : Promise.resolve(fromControlResult(result, 400));
    },

    gateAction: async (input): Promise<ApiResponse> => {
      const settings = plane.getSettings(input.userId as string);
      const decision = plane.gateAction({
        ownerId: input.userId as string,
        action: input.action as string,
        category: input.category as string,
        settings,
        emergencyStop: plane.emergencyStop,
        emergencyStopEngaged: plane.stopStatus(input.userId as string).engaged,
        providerId: input.providerId as string | undefined,
        additionalUsd: input.additionalUsd as number | undefined,
        cost: plane.observe(input.userId as string).cost,
      });
      return Promise.resolve(successResponse(decision));
    },
  };
}
