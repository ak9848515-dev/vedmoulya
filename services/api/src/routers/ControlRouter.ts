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
import type {
  ActiveIntelligenceControlPlane,
  OpportunityLifecycleRecord,
} from '@vedmoulya/control-plane';
import type { TRPCContext } from '../services/RouterRegistry.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import type { ErrorCode } from '../middleware/error.js';
import { successResponse } from '../services/ResponseMapper.js';
import type { OpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { normalizeExternalOpportunity } from '../services/OpportunitySourceAdapter.js';
import type { OpportunityQualification } from '../services/OpportunityQualification.js';
import type { MissionLaunchPort } from '../infrastructure/OpportunityMissionPorts.js';

/** S5 — the acquisition dependencies a router needs. Deliberately narrow: the
 *  approval authority and nothing else. The normalizer is a pure import. No
 *  Mission service, no payment, no bidding — the router cannot reach them. */
export interface OpportunityAcquisitionDeps {
  approval: OpportunityApprovalPort;
  /** S5.1 — qualification (reuses the canonical assessor). */
  qualify: (record: OpportunityLifecycleRecord) => OpportunityQualification;
  /** S5.1 — the EXISTING canonical Mission creation path. Injected so the
   *  acquisition layer can never reach a Mission engine directly. */
  mission: MissionLaunchPort;
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
  // S5.1 — qualification + Mission handoff. `userId` is never an input
  // field: these procedures read identity from the session, so a client
  // cannot qualify, approve or launch against another account.
  opportunityQualify: z.object({ id: z.string().min(1).max(128) }),
  opportunityStartMission: z.object({ id: z.string().min(1).max(128) }),
  opportunityMissionLookup: z.object({ opportunityId: z.string().min(1).max(128) }),
  missionOpportunityLookup: z.object({ missionId: z.string().min(1).max(128) }),
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
  qualifyOpportunity: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  startMissionForOpportunity: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getMissionForOpportunity: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getOpportunityForMission: (
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
        ...(normalized.data.requiredCapabilities !== undefined
          ? { requiredCapabilities: normalized.data.requiredCapabilities }
          : {}),
      });
      return Promise.resolve(successResponse(record));
    },

    // ── S5.1 — qualification ────────────────────────────────────────────────
    // Loads the canonical record with the SESSION user, so another user's
    // opportunity is simply not found. Its ONLY effect is the legal
    // DISCOVERED → ASSESSED step. It never approves, never creates a Mission.
    qualifyOpportunity: async (input): Promise<ApiResponse> => {
      const ownerId = input.userId as string;
      const id = input.id as string;
      const record = plane.listOpportunities(ownerId).find((o) => o.id === id);
      if (record === undefined) {
        return Promise.resolve(acquisitionError('NOT_FOUND', 'Opportunity not found.', 404));
      }
      if (acquisition === undefined) {
        return Promise.resolve(
          acquisitionError('QUALIFICATION_UNAVAILABLE', 'Qualification is not configured.', 503),
        );
      }
      if (record.status !== 'DISCOVERED') {
        // Idempotent read: re-qualifying an already-assessed opportunity is
        // refused rather than silently re-scoring a moved-on record.
        return Promise.resolve(
          acquisitionError(
            'INVALID_STATE',
            `Only a DISCOVERED opportunity can be qualified (this one is ${record.status}).`,
            409,
          ),
        );
      }
      const result = acquisition.qualify(record);
      // The one and only structural effect: the legal ASSESSED transition.
      // No approval is attached, so the lifecycle can never move past
      // PRESENTED on the strength of a score.
      plane.transitionOpportunity({
        ownerId,
        id: record.id,
        to: 'ASSESSED',
        note: 'qualified — advisory only, no approval granted',
      });
      const updated = plane.listOpportunities(ownerId).find((o) => o.id === id);
      return Promise.resolve(
        successResponse({
          ...result,
          // The stored state is returned so the caller sees ASSESSED, not
          // APPROVED, and can never infer an approval from the score.
          status: updated?.status ?? 'ASSESSED',
        }),
      );
    },

    // ── S5.1 — approved opportunity → canonical Mission ──────────────────────
    // Order matters: verify APPROVED → create the Mission through the EXISTING
    // path → only then persist the association. A Mission failure therefore
    // never leaves a dangling association, and a persistence failure is
    // reported honestly instead of being reported as a completed linkage.
    startMissionForOpportunity: async (input): Promise<ApiResponse> => {
      const ownerId = input.userId as string;
      const id = input.id as string;
      if (acquisition === undefined) {
        return Promise.resolve(
          acquisitionError('MISSION_UNAVAILABLE', 'Mission creation is not configured.', 503),
        );
      }
      const record = plane.listOpportunities(ownerId).find((o) => o.id === id);
      if (record === undefined) {
        return Promise.resolve(acquisitionError('NOT_FOUND', 'Opportunity not found.', 404));
      }
      if (record.status !== 'APPROVED') {
        return Promise.resolve(
          acquisitionError(
            'APPROVAL_REQUIRED',
            `Only an APPROVED opportunity may start a Mission (this one is ${record.status}).`,
            403,
          ),
        );
      }

      // Idempotency BEFORE creating anything: an approved opportunity that
      // already has a Mission must never create a second one.
      const existing = plane.getMissionForOpportunity(ownerId, record.id);
      if (existing !== undefined) {
        return Promise.resolve(
          successResponse({
            opportunityId: record.id,
            missionId: existing.missionId,
            created: false,
            alreadyLinked: true,
          }),
        );
      }

      const launched = await acquisition.mission.launch({
        userId: ownerId,
        title: record.title,
        description: record.description,
      });
      if (!launched.success) {
        // No association is written. Nothing claims a Mission exists.
        return Promise.resolve(acquisitionError(launched.code, launched.message, 502));
      }

      let missionId: string;
      try {
        const link = plane.linkOpportunityToMission({
          userId: ownerId,
          opportunityId: record.id,
          missionId: launched.missionId,
          createdAt: new Date().toISOString(),
        });
        missionId = link.missionId;
      } catch (error) {
        // The Mission WAS created but the association was not persisted. We
        // say exactly that — we never report a linkage that does not exist,
        // and we never pretend the Mission does not exist either.
        return Promise.resolve(
          acquisitionError(
            'ASSOCIATION_PERSIST_FAILED',
            `Mission ${launched.missionId} was created but the opportunity association could not be persisted: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
            500,
          ),
        );
      }

      return Promise.resolve(
        successResponse({
          opportunityId: record.id,
          missionId,
          created: true,
          alreadyLinked: false,
        }),
      );
    },

    // ── S5.1 — owner-scoped association lookups (minimum read surface) ───────
    getMissionForOpportunity: async (input): Promise<ApiResponse> => {
      const ownerId = input.userId as string;
      const link = plane.getMissionForOpportunity(ownerId, input.opportunityId as string);
      return Promise.resolve(successResponse(link ?? null));
    },

    getOpportunityForMission: async (input): Promise<ApiResponse> => {
      const ownerId = input.userId as string;
      const link = plane.getOpportunityForMission(ownerId, input.missionId as string);
      return Promise.resolve(successResponse(link ?? null));
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
