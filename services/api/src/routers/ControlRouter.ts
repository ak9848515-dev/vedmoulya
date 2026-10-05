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
import type { ErrorCode } from '../middleware/error.js';
import { successResponse } from '../services/ResponseMapper.js';
import type { OpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { normalizeExternalOpportunity } from '../services/OpportunitySourceAdapter.js';

/** S5 — the acquisition dependencies a router needs. Deliberately narrow: the
 *  approval authority and nothing else. The normalizer is a pure import. No
 *  Mission service, no payment, no bidding — the router cannot reach them. */
export interface OpportunityAcquisitionDeps {
  approval: OpportunityApprovalPort;
}

/** Map an acquisition outcome onto the closed ErrorCode set, preserving the
 *  honest, specific reason in `details.opportunityCode` (same discipline as
 *  `fromControlResult`, which preserves `controlCode`). */
const acquisitionError = (
  opportunityCode: string,
  message: string,
  statusCode: number,
): ApiResponse => {
  const code: ErrorCode =
    statusCode === 403
      ? 'AUTHORIZATION_ERROR'
      : statusCode === 503
        ? 'SERVICE_UNAVAILABLE'
        : opportunityCode === 'SECRET_REJECTED'
          ? 'VALIDATION_ERROR'
          : 'VALIDATION_ERROR';
  return {
    success: false,
    error: { code, message, statusCode, details: { opportunityCode } },
    meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
  };
};

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
    // S5 — the APPROVED transition no longer accepts a client-written approval
    // record. The client supplies the EXISTING Brain approval task id and the
    // authority mints the record (infrastructure/OpportunityApprovalPorts).
    // `approvalTaskId` is IGNORED for every other target state.
    approvalTaskId: z.string().min(1).max(128).optional(),
    execution: z
      .object({
        id: z.string().min(1),
        completedAt: z.string().min(1),
        verified: z.boolean(),
      })
      .optional(),
  }),
  // S5 — acquisition entry point. The payload is UNTRUSTED external input and
  // is validated field-by-field by the normalizer, not by a wide zod object.
  opportunityImport: z.object({
    userId: z.string().min(1),
    opportunity: z.unknown(),
  }),
  // S5 — ask the EXISTING approval authority to register a request. It does
  // not approve; it returns the task id the human decides on.
  opportunityApprovalRequest: z.object({
    userId: z.string().min(1),
    opportunityId: z.string().min(1).max(128),
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
  importOpportunity: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  requestOpportunityApproval: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
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

export function createControlRouter(
  plane: ActiveIntelligenceControlPlane,
  /** S5 — optional acquisition dependencies. Absent (e.g. a slim test double)
   *  the APPROVED transition fails closed rather than trusting an input record. */
  acquisition?: OpportunityAcquisitionDeps,
): ControlHandlers {
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
      const ownerId = input.userId as string;
      const to = input.to as string;
      let approval: { id: string; grantedBy: string; grantedAt: string; scope: string } | undefined;

      // S5 — APPROVED is the ONLY state that needs authority, and the authority
      // now produces the record. There is deliberately NO path where a
      // caller-supplied record satisfies the guard.
      if (to === 'APPROVED') {
        if (acquisition === undefined) {
          return Promise.resolve(
            acquisitionError(
              'APPROVAL_UNAVAILABLE',
              'The approval authority is not configured.',
              503,
            ),
          );
        }
        const taskId = input.approvalTaskId;
        if (typeof taskId !== 'string' || taskId.length === 0) {
          return Promise.resolve(
            acquisitionError(
              'APPROVAL_REQUIRED',
              'APPROVED requires an approval task from the approval authority (approvalTaskId).',
              400,
            ),
          );
        }
        const decision = acquisition.approval.approve({
          userId: ownerId,
          taskId,
          opportunityId: String(input.id),
        });
        if (!decision.success) {
          return Promise.resolve(acquisitionError(decision.code, decision.message, 403));
        }
        approval = decision.data;
      }

      const result = plane.transitionOpportunity({
        ownerId,
        id: input.id as string,
        to: to as never,
        note: input.note as string,
        ...(approval !== undefined ? { approval } : {}),
        execution: input.execution as
          { id: string; completedAt: string; verified: boolean } | undefined,
      });
      if (result.success) return Promise.resolve(successResponse(result.record));
      return Promise.resolve(
        fromControlResult(
          result as
            { success: true; data: unknown } | { success: false; error: string; code: string },
          400,
        ),
      );
    },

    // S5 — the missing acquisition entry point. Normalizes an untrusted
    // external payload into the EXISTING canonical record. Idempotent through
    // the canonical stable key (owner + source + sourceReference).
    importOpportunity: async (input): Promise<ApiResponse> => {
      const ownerId = input.userId as string;
      const normalized = normalizeExternalOpportunity(input.opportunity);
      if (!normalized.success) {
        return Promise.resolve(acquisitionError(normalized.code, normalized.message, 400));
      }
      const record = plane.discoverOpportunity({
        ownerId,
        title: normalized.data.title,
        description: normalized.data.description,
        category: normalized.data.category,
        evidence: normalized.data.evidence,
        ...(normalized.data.estimatedValue !== undefined
          ? { estimatedValue: normalized.data.estimatedValue }
          : {}),
        ...(normalized.data.estimatedEffort !== undefined
          ? { estimatedEffort: normalized.data.estimatedEffort }
          : {}),
        riskLevel: normalized.data.riskLevel,
        automationPotential: normalized.data.automationPotential,
        sourceRef: normalized.data.sourceRef,
      });
      return Promise.resolve(successResponse(record));
    },

    // S5 — register the approval request with the EXISTING Brain authority.
    // It never approves; it only creates the task the human will decide on.
    requestOpportunityApproval: async (input): Promise<ApiResponse> => {
      if (acquisition === undefined) {
        return Promise.resolve(
          acquisitionError(
            'APPROVAL_UNAVAILABLE',
            'The approval authority is not configured.',
            503,
          ),
        );
      }
      const ownerId = input.userId as string;
      const result = acquisition.approval.requestApproval({
        userId: ownerId,
        opportunityId: typeof input.opportunityId === 'string' ? input.opportunityId : '',
      });
      return result.success
        ? Promise.resolve(successResponse(result.data))
        : Promise.resolve(acquisitionError(result.code, result.message, 403));
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
