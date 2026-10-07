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
import type { ExternalSourceFailureCode } from '../infrastructure/OpportunityMonitoringPorts.js';
import type { OpportunityMonitor } from '../services/OpportunityMonitoring.js';
import { rankOpportunities } from '../services/OpportunityRecommendation.js';
import type { OpportunityProposalPort } from '../infrastructure/OpportunityProposalPorts.js';

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
  /** S7.1 — the bounded external monitoring pass (optional; absent = not
   *  configured, reported honestly rather than silently). It ingests only
   *  DISCOVERED records through the canonical lifecycle. */
  monitor?: OpportunityMonitor;
  /** S7.1 — the proposal DRAFT port. Preparation only: it has no submission
   *  method, so this router cannot send anything to anyone. */
  proposal?: OpportunityProposalPort;
}

// S5.2 — in-process launch collapse. Concurrent startMission calls for the
// same (owner, opportunity) in THIS process share one in-flight execution,
// so only ONE MissionLaunchPort.createAndRun can run per key. This is a
// request-collapsing join, NOT the production guarantee: the durable
// APPROVED → PLANNED claim + idempotent association below remain the real
// cross-process boundary.
const missionLaunchInFlight = new Map<string, Promise<ApiResponse>>();

/** Map an acquisition outcome onto the closed ErrorCode set, preserving the
 *  honest, specific reason in `details.opportunityCode` (same discipline as
 *  `fromControlResult`, which preserves `controlCode`). */
const acquisitionError = (
  opportunityCode: string,
  message: string,
  statusCode: number,
  /** S7.1 — optional extra operator detail (e.g. the full monitoring pass). */
  extraDetails?: Record<string, unknown>,
): ApiResponse => {
  const code: ErrorCode =
    statusCode === 403
      ? 'AUTHORIZATION_ERROR'
      : statusCode === 503
        ? 'SERVICE_UNAVAILABLE'
        : statusCode === 429
          ? 'RATE_LIMITED'
          : statusCode === 502
            ? 'DEPENDENCY_FAILURE'
            : opportunityCode === 'SECRET_REJECTED'
              ? 'VALIDATION_ERROR'
              : 'VALIDATION_ERROR';
  return {
    success: false,
    error: {
      code,
      message,
      statusCode,
      details: { opportunityCode, ...(extraDetails ?? {}) },
    },
    meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
  };
};

/** S7.1 — map an honest external-source failure onto an HTTP status. A source
 *  failure is NEVER reported as a successful pass and never becomes a
 *  candidate. */
const sourceFailureStatus = (code: ExternalSourceFailureCode): number => {
  switch (code) {
    case 'SOURCE_RATE_LIMITED':
      return 429;
    case 'SOURCE_NOT_CONFIGURED':
    case 'SOURCE_TIMEOUT':
    case 'SOURCE_UNAVAILABLE':
      return 503;
    case 'SOURCE_AUTH_FAILED':
    case 'MALFORMED_SOURCE_RESPONSE':
    case 'SOURCE_REQUEST_FAILED':
      return 502;
    case 'UNSUPPORTED_SOURCE_CAPABILITY':
      return 400;
    default:
      return 503;
  }
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
  // S6.4 — read-only value intelligence. Same key as qualification, but a
  // QUERY that never transitions the record (safe on any lifecycle state).
  opportunityValueIntelligence: z.object({ id: z.string().min(1).max(128) }),
  // S7.1 — monitoring. `userId` is never an input: the monitored owner is the
  // authenticated session, so a client cannot monitor another account.
  opportunityMonitor: z.object({}),
  // S7.1 — ranked/recommended read for the session owner (pure, no transition).
  opportunityRanked: z.object({}),
  // S7.1 — proposal DRAFT for ONE opportunity. A mutation because it may spend
  // a provider call; it never submits anything externally.
  opportunityProposalDraft: z.object({ id: z.string().min(1).max(128) }),
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
  getValueIntelligence: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
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
  /** S7.1 — run ONE bounded external monitoring pass for the session owner. */
  monitorOpportunities: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
  /** S7.1 — rank the session owner's opportunities on the EXISTING verdicts. */
  getRankedOpportunities: (
    input: Record<string, unknown>,
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  /** S7.1 — generate a reviewable proposal DRAFT. Never submits. */
  generateProposalDraft: (input: Record<string, unknown>, ctx: TRPCContext) => Promise<ApiResponse>;
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
      const { record, created } = plane.discoverOpportunityWithResult({
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
      // S7.0 — surface whether this acquisition CREATED a canonical opportunity
      // or resolved (idempotently) to an EXISTING one. This is advisory
      // reporting only: the record, its owner scope and its DISCOVERED state
      // are the canonical lifecycle's. Acquisition never approves, qualifies or
      // launches anything.
      return Promise.resolve(successResponse({ ...record, created }));
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

    // ── S6.4 — read-only value intelligence for an existing opportunity ──────
    // The S5.1 `qualifyOpportunity` mutation is a state-change (DISCOVERED →
    // ASSESSED) and refuses a moved-on record, so it cannot be used to READ an
    // opportunity's qualification. This procedure runs the SAME canonical
    // qualifier (no second scoring engine, no second economics engine) and
    // returns exactly the SAME result shape — but performs NO transition, holds
    // no approval power and is safe to call on an already-ASSESSED (or later)
    // opportunity. It is the read counterpart of the existing mutation.
    getValueIntelligence: async (input): Promise<ApiResponse> => {
      const ownerId = input.userId as string;
      const id = input.id as string;
      // Loaded with the SESSION user, so another user's opportunity is simply
      // not found (owner isolation is structural, not a client assertion).
      const record = plane.listOpportunities(ownerId).find((o) => o.id === id);
      if (record === undefined) {
        return Promise.resolve(acquisitionError('NOT_FOUND', 'Opportunity not found.', 404));
      }
      if (acquisition === undefined) {
        return Promise.resolve(
          acquisitionError('QUALIFICATION_UNAVAILABLE', 'Qualification is not configured.', 503),
        );
      }
      // Pure: the qualifier reads evidence and returns a verdict. Nothing is
      // written and the lifecycle is left exactly as it was.
      const result = acquisition.qualify(record);
      return Promise.resolve(
        successResponse({
          ...result,
          // The CURRENT stored state (never a manufactured ASSESSED).
          status: record.status,
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
      // S5.2 — collapse concurrent in-process launches for the same key onto
      // one shared execution. The first caller runs the body below; joiners
      // await the same promise. Cross-process duplicates are still handled by
      // the durable claim + idempotent association inside the body.
      const inFlightKey = `${ownerId}:${id}`;
      const joined = missionLaunchInFlight.get(inFlightKey);
      if (joined !== undefined) return joined;
      const execution = (async (): Promise<ApiResponse> => {
        const record = plane.listOpportunities(ownerId).find((o) => o.id === id);
        if (record === undefined) {
          return Promise.resolve(acquisitionError('NOT_FOUND', 'Opportunity not found.', 404));
        }
        if (record.status !== 'APPROVED') {
          // S5.2 — completed launch (PLANNED + association present) returns the
          // existing linkage deterministically: one Mission, one association,
          // no second createAndRun. An interrupted claim (PLANNED with NO
          // association — launch or link failed mid-flight) falls through and
          // is reclaimed below. Any other non-APPROVED status is refused.
          const completed =
            record.status === 'PLANNED' &&
            plane.getMissionForOpportunity(ownerId, record.id) !== undefined;
          if (completed) {
            const done = plane.getMissionForOpportunity(ownerId, record.id);
            return Promise.resolve(
              successResponse({
                opportunityId: record.id,
                missionId: done?.missionId,
                created: false,
                alreadyLinked: true,
              }),
            );
          }
          const interrupted =
            record.status === 'PLANNED' &&
            plane.getMissionForOpportunity(ownerId, record.id) === undefined;
          if (!interrupted) {
            return Promise.resolve(
              acquisitionError(
                'APPROVAL_REQUIRED',
                `Only an APPROVED opportunity may start a Mission (this one is ${record.status}).`,
                403,
              ),
            );
          }
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

        // S5.2 — synchronous launch claim using the EXISTING guarded lifecycle:
        // APPROVED → PLANNED is a legal one-step transition and the store write
        // is synchronous, so a concurrent duplicate in this process observes
        // PLANNED (not APPROVED) and is refused below instead of reaching
        // MissionLaunchPort.createAndRun a second time. No in-memory lock, no
        // new store, no Mission change — the lifecycle IS the atomic claim.
        const claimed = plane.transitionOpportunity({
          ownerId,
          id: record.id,
          to: 'PLANNED',
          note: 'mission launch claimed — association pending',
        });
        if (!claimed.success) {
          // A concurrent request already claimed (or moved) this opportunity.
          // Deterministic, recoverable: retrying after the winner finishes
          // returns the existing linkage via the alreadyLinked path above.
          return Promise.resolve(
            acquisitionError(
              'LAUNCH_IN_PROGRESS',
              'Another launch already claimed this opportunity. Retry to receive the existing Mission linkage.',
              409,
            ),
          );
        }

        const launched = await acquisition.mission.launch({
          userId: ownerId,
          title: record.title,
          description: record.description,
        });
        if (!launched.success) {
          // The launch failed AFTER the claim was taken. The
          // PLANNED-without-association state left behind is the durable,
          // explicitly recoverable interrupted-claim state that the guard above
          // already reclaims on the next call. No association is written.
          // Nothing claims a Mission exists.
          return Promise.resolve(acquisitionError(launched.code, launched.message, 502));
        }

        let missionId: string;
        let recovered = false;
        try {
          // Persist the association. The save is idempotent by
          // (userId, opportunityId) — if a concurrent request already wrote the
          // link, this returns the EXISTING one. When the existing missionId
          // differs from the one just launched, the loser does NOT silently
          // create a second Mission: it reconciles onto the winner and reports
          // the duplicate honestly. Retry once on transient failure.
          const persist = (): { missionId: string; duplicate: boolean } => {
            const link = plane.linkClaimedOpportunityToMission({
              userId: ownerId,
              opportunityId: record.id,
              missionId: launched.missionId,
              createdAt: new Date().toISOString(),
            });
            return { missionId: link.missionId, duplicate: link.missionId !== launched.missionId };
          };
          try {
            const first = persist();
            missionId = first.missionId;
            recovered = first.duplicate;
          } catch {
            // Retry once — the save is idempotent so this either creates
            // the link or returns the existing one without duplicating.
            const second = persist();
            missionId = second.missionId;
            recovered = second.duplicate;
          }
        } catch (error) {
          // The Mission WAS created but the association was not persisted even
          // after retry. The PLANNED-without-association state left behind is
          // the durable interrupted-claim state: a later call reclaims it via
          // the guard above (same Mission launch is NOT retried silently — the
          // caller retries the whole startMission call, which reclaims the
          // claim and launches exactly once). We say exactly what happened.
          return Promise.resolve(
            acquisitionError(
              'ASSOCIATION_PERSIST_FAILED',
              `Mission ${launched.missionId} was created but the opportunity association could not be persisted: ${error instanceof Error ? error.message : 'unknown error'}`,
              500,
            ),
          );
        }

        return Promise.resolve(
          successResponse({
            opportunityId: record.id,
            missionId,
            created: !recovered,
            alreadyLinked: recovered,
            ...(recovered ? { recoveredMissionId: launched.missionId } : {}),
          }),
        );
      })();
      missionLaunchInFlight.set(inFlightKey, execution);
      try {
        return await execution;
      } finally {
        if (missionLaunchInFlight.get(inFlightKey) === execution) {
          missionLaunchInFlight.delete(inFlightKey);
        }
      }
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

    // ── S7.1 — bounded external opportunity monitoring ──────────────────────
    //    Runs ONE bounded pass for the SESSION owner through the EXISTING
    //    canonical discovery (dedup + owner isolation). A source failure is
    //    reported AS a failure and ingests nothing — never a synthetic
    //    success, never a fabricated opportunity.
    monitorOpportunities: async (input): Promise<ApiResponse> => {
      const ownerId = input.userId as string;
      if (acquisition?.monitor === undefined) {
        return Promise.resolve(
          acquisitionError(
            'MONITORING_UNAVAILABLE',
            'External opportunity monitoring is not configured.',
            503,
          ),
        );
      }
      const result = await acquisition.monitor.monitor(ownerId);
      if (result.failure !== undefined) {
        // The pass ran; the SOURCE failed. Reported AS a failure, with the full
        // pass outcome carried in details so nothing is hidden and nothing is
        // mistaken for a successful (empty) pass.
        return Promise.resolve(
          acquisitionError(
            result.failure.code,
            result.failure.message,
            sourceFailureStatus(result.failure.code),
            { monitoring: result },
          ),
        );
      }
      return Promise.resolve(successResponse(result));
    },

    // ── S7.1 — ranking over the EXISTING verdicts ───────────────────────────
    //    Pure: it runs the SAME canonical qualifier the value-intelligence read
    //    uses, performs NO transition and holds no approval power.
    getRankedOpportunities: async (input): Promise<ApiResponse> => {
      const ownerId = input.userId as string;
      if (acquisition === undefined) {
        return Promise.resolve(
          acquisitionError('QUALIFICATION_UNAVAILABLE', 'Qualification is not configured.', 503),
        );
      }
      const recommendations = rankOpportunities(
        plane.listOpportunities(ownerId),
        acquisition.qualify,
      );
      return Promise.resolve(
        successResponse({
          recommendations,
          // Always true — ranking is advisory and can never approve or launch.
          authorizationRequired: true,
        }),
      );
    },

    // ── S7.1 — proposal DRAFT (preparation only) ────────────────────────────
    //    Loads the canonical record with the SESSION owner (a foreign
    //    opportunity is simply NOT_FOUND), asks the EXISTING AI orchestration
    //    for a draft through the narrow proposal port, and returns it for HUMAN
    //    review/edit. There is no submission method anywhere on this path.
    generateProposalDraft: async (input): Promise<ApiResponse> => {
      const ownerId = input.userId as string;
      const id = input.id as string;
      const record = plane.listOpportunities(ownerId).find((o) => o.id === id);
      if (record === undefined) {
        return Promise.resolve(acquisitionError('NOT_FOUND', 'Opportunity not found.', 404));
      }
      if (acquisition?.proposal === undefined) {
        return Promise.resolve(
          acquisitionError(
            'PROPOSAL_DRAFT_UNAVAILABLE',
            'Proposal drafting is not configured.',
            503,
          ),
        );
      }
      const evidence = record.evidence.map((e) => `${e.label} (${e.status})`);
      const result = await acquisition.proposal.draft({
        userId: ownerId,
        opportunity: {
          opportunityId: record.id,
          title: record.title,
          description: record.description,
          category: record.category,
          ...(record.requiredCapabilities !== undefined
            ? { requiredCapabilities: record.requiredCapabilities }
            : {}),
          ...(evidence.length > 0 ? { evidence } : {}),
          ...(record.estimatedValue !== undefined ? { estimatedValue: record.estimatedValue } : {}),
          ...(record.estimatedEffort !== undefined
            ? { estimatedEffort: record.estimatedEffort }
            : {}),
          riskLevel: record.riskLevel,
        },
      });
      if (!result.success) {
        return Promise.resolve(
          acquisitionError(
            result.code,
            result.message,
            result.code === 'PROPOSAL_DRAFT_UNAVAILABLE' ? 503 : 502,
          ),
        );
      }
      // The draft is returned for HUMAN review and editing. Nothing was sent.
      return Promise.resolve(successResponse({ ...result.data, status: record.status }));
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
