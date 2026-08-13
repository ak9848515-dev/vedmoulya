// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · BrainPolicyEngine
// EPIC-016 §21 — Safety / governance.
//
// Explicit Brain policies with FINAL authority. The Brain cannot:
// grant itself permissions · disable security · bypass approval ·
// exceed budgets · hide failures · fabricate evidence · conceal
// uncertainty · silently purchase / subscribe / publish / install.
// User approval is authoritative for designated sensitive actions.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';

export const SENSITIVE_ACTIONS = [
  'publish',
  'send',
  'deploy',
  'purchase',
  'subscribe',
  'delete',
  'share',
  'install',
  'connect_account',
] as const;

export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number];

export type PolicyVerdict =
  { allowed: true; reason: string } | { allowed: false; reason: string; policy: string };

export interface PolicyContext {
  /** Actions the user explicitly authorized in the task input. */
  authorizedActions: string[];
  approvalGranted: string[];
  /** Budget verdict from the budget guard. */
  budgetAllowed: boolean;
  evidenceSufficient: boolean;
  capabilityAvailable: boolean;
}

export class BrainPolicyEngine {
  /** Sensitive actions require explicit approval — always. */
  requiresApproval(action: string): boolean {
    return (SENSITIVE_ACTIONS as readonly string[]).includes(action);
  }

  /**
   * Gate for an action the Brain would take. Fail-closed: unless the
   * user explicitly authorized + approved, a sensitive action is denied.
   */
  checkAction(ctx: PolicyContext, action: string): PolicyVerdict {
    const sensitive = this.requiresApproval(action);

    if (sensitive) {
      const explicit = ctx.authorizedActions.includes(action);
      const granted = ctx.approvalGranted.includes(action);
      if (explicit && granted) {
        return { allowed: true, reason: `User explicitly authorized and approved "${action}".` };
      }
      return {
        allowed: false,
        reason: `"${action}" requires explicit user authorization and approval.`,
        policy: 'SENSITIVE_ACTION_APPROVAL',
      };
    }

    // Non-sensitive actions still respect budget + evidence + capability.
    if (!ctx.budgetAllowed) {
      return { allowed: false, reason: 'Budget guard denied execution.', policy: 'BUDGET' };
    }
    if (!ctx.evidenceSufficient) {
      return {
        allowed: false,
        reason: 'Insufficient evidence — ABSTAIN rather than fabricate.',
        policy: 'EVIDENCE_FIRST',
      };
    }
    if (!ctx.capabilityAvailable) {
      return {
        allowed: false,
        reason: 'Capability unavailable — no fake execution.',
        policy: 'NO_FAKE_EXECUTION',
      };
    }
    return { allowed: true, reason: 'Policy permits this action.' };
  }

  /** Evidence policy: ABSTAIN / REQUEST_MORE_INFORMATION / USE_LOWER_CONFIDENCE. */
  evidenceVerdict(
    evidenceRequirement: 'NONE' | 'OPTIONAL' | 'REQUIRED' | 'STRONG_REQUIRED',
    evidenceCount: number,
  ): PolicyVerdict {
    if (evidenceRequirement === 'NONE') return { allowed: true, reason: 'No evidence required.' };
    if (evidenceRequirement === 'OPTIONAL') return { allowed: true, reason: 'Evidence optional.' };
    if (evidenceRequirement === 'REQUIRED' && evidenceCount === 0) {
      return {
        allowed: false,
        reason: 'Evidence required but none available — ABSTAIN / REQUEST_MORE_INFORMATION.',
        policy: 'EVIDENCE_FIRST',
      };
    }
    if (evidenceRequirement === 'STRONG_REQUIRED' && evidenceCount < 2) {
      return {
        allowed: false,
        reason:
          'Strong evidence required (≥2 sources) — insufficient, use lower confidence or abstain.',
        policy: 'EVIDENCE_FIRST',
      };
    }
    return { allowed: true, reason: 'Evidence requirement satisfied.' };
  }

  /** Capability availability: a required-but-unavailable capability is never faked. */
  capabilityAvailable(required: CapabilityId[], available: CapabilityId[]): PolicyVerdict {
    const missing = required.filter((c) => !available.includes(c));
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `Unavailable capabilities (never faked): ${missing.join(', ')}`,
        policy: 'NO_FAKE_EXECUTION',
      };
    }
    return { allowed: true, reason: 'All required capabilities available.' };
  }
}
