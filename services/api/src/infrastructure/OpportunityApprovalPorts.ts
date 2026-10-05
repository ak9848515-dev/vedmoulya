// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S5 — Opportunity approval port (acquisition FOUNDATION)
//
// Phase 7: approval stays MANDATORY, EXPLICIT and user-scoped. This port is
// the ONLY way an opportunity reaches APPROVED, and it delegates to the
// EXISTING Brain approval authority — it never mints an approval on its own.
//
// This mirrors the established `createWorldApprovalPort` precedent
// (infrastructure/WorldBridgePorts.ts) exactly, so the acquisition path reuses
// the SAME authority rather than introducing a second one.
//
// Why this exists: the control plane's `transition()` requires an ApprovalRecord
// and its own comment states the record must come from "the EXISTING approval
// authority — this layer can never grant it". Before this port the tRPC
// transport accepted that record as a client-typed literal, so a caller could
// satisfy the guard by writing the record themselves. Now the APPROVED
// transition carries only a brain TASK id; the authority's decision produces
// the record, and the record id IS the task id so the grant stays traceable to
// a real, owner-scoped approval task.
// ─────────────────────────────────────────────────────────────────────────────

import type { BrainApplicationService } from '@vedmoulya/brain';

export interface OpportunityApprovalRecord {
  id: string;
  grantedBy: string;
  grantedAt: string;
  scope: string;
}

export type OpportunityApprovalResult =
  { success: true; data: { taskId: string } } | { success: false; code: string; message: string };

/** The EXISTING Brain sensitive action that represents "commit to this external
 *  work". It is deliberately a fixed policy name, never a caller-supplied
 *  string, so the authority's policy engine is what classifies the action. */
export const OPPORTUNITY_APPROVAL_ACTION = 'accept_work' as const;

export interface OpportunityApprovalPort {
  /** Register the approval request with the EXISTING Brain authority. */
  requestApproval(input: { userId: string; opportunityId: string }): OpportunityApprovalResult;
  /** Ask the authority to decide. The record is MINTED HERE, never supplied. */
  approve(input: {
    userId: string;
    taskId: string;
    opportunityId: string;
  }):
    | { success: true; data: OpportunityApprovalRecord }
    | { success: false; code: string; message: string };
  /** Ask the authority to refuse. */
  reject(input: {
    userId: string;
    taskId: string;
    opportunityId: string;
  }): { success: true } | { success: false; code: string; message: string };
}

export function createOpportunityApprovalPort(
  brain: BrainApplicationService,
): OpportunityApprovalPort {
  return {
    requestApproval: (input) => {
      // The Brain is the only way a sensitive action is registered; the action
      // becomes the task objective, then is registered for approval.
      const task = brain.createTask(input.userId, OPPORTUNITY_APPROVAL_ACTION);
      if (!task.success || !task.data) {
        return {
          success: false,
          code: 'APPROVAL_REQUEST_FAILED',
          message: task.error ?? 'Could not create the approval task.',
        };
      }
      const registered = brain.requestApproval(
        input.userId,
        task.data.id,
        OPPORTUNITY_APPROVAL_ACTION,
      );
      if (!registered.success) {
        return {
          success: false,
          code: 'APPROVAL_REQUEST_FAILED',
          message: registered.error ?? 'Could not register the approval.',
        };
      }
      return { success: true, data: { taskId: task.data.id } };
    },

    approve: (input) => {
      // The authority decides. A refusal here is an honest refusal — never a
      // fallback to a self-asserted record.
      const result = brain.approve(input.userId, input.taskId, OPPORTUNITY_APPROVAL_ACTION);
      if (!result.success || !result.data) {
        return {
          success: false,
          code: 'APPROVAL_REFUSED',
          message: result.error ?? 'Approval refused by the authority.',
        };
      }
      // Server-minted. The caller never supplies grantedBy/grantedAt/scope,
      // and the id is the authority's own task id so the grant is traceable.
      return {
        success: true,
        data: {
          id: input.taskId,
          grantedBy: input.userId,
          grantedAt: result.data.updatedAt,
          scope: `${OPPORTUNITY_APPROVAL_ACTION}:${input.opportunityId}`,
        },
      };
    },

    reject: (input) => {
      const result = brain.reject(input.userId, input.taskId, OPPORTUNITY_APPROVAL_ACTION);
      if (!result.success) {
        return {
          success: false,
          code: 'REJECTION_REFUSED',
          message: result.error ?? 'Rejection refused by the authority.',
        };
      }
      return { success: true };
    },
  };
}
