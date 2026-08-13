// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Execution Policy
// EPIC-007 — Phase 9. Explicit policy over every action the factory
// can take. Classified: READ_ONLY / SAFE_WRITE / DESTRUCTIVE_WRITE /
// NETWORK / DATABASE / DEPLOYMENT / SECRET_ACCESS / CODE_EXECUTION.
//
// Default posture (per the epic):
//   READ_ONLY          → allowed
//   SAFE_WRITE         → controlled (approval only for destructive ops)
//   DESTRUCTIVE_WRITE  → blocked unless explicitly authorized
//   SECRET_ACCESS      → prohibited unless explicitly configured
//   DEPLOYMENT         → requires explicit authorization
//   NETWORK/DATABASE/CODE_EXECUTION → blocked by default (no arbitrary
//     shell, filesystem, network or package installation)
// ──────────────────────────────────────────────────────────────────

import type { ExecutionActionClass, ExecutionPolicy } from '../types/app-types.js';

export const DEFAULT_EXECUTION_POLICY: ExecutionPolicy = {
  rules: [
    { actionClass: 'READ_ONLY', default: 'allowed' },
    { actionClass: 'SAFE_WRITE', default: 'allowed', requiresApproval: false },
    { actionClass: 'DESTRUCTIVE_WRITE', default: 'blocked', requiresApproval: true },
    { actionClass: 'NETWORK', default: 'blocked', requiresApproval: true },
    { actionClass: 'DATABASE', default: 'blocked', requiresApproval: true },
    { actionClass: 'DEPLOYMENT', default: 'blocked', requiresApproval: true },
    { actionClass: 'SECRET_ACCESS', default: 'blocked', requiresApproval: true },
    { actionClass: 'CODE_EXECUTION', default: 'blocked', requiresApproval: true },
  ],
  grants: {},
};

export class ExecutionPolicyService {
  /** Query the posture for an action class. */
  posture(
    policy: ExecutionPolicy,
    actionClass: ExecutionActionClass,
  ): { default: string; requiresApproval: boolean } {
    const rule = policy.rules.find((r) => r.actionClass === actionClass);
    if (!rule) return { default: 'blocked', requiresApproval: true };
    return {
      default: rule.default,
      requiresApproval: rule.requiresApproval === true || rule.default === 'controlled',
    };
  }

  /** Whether an action may proceed with the current grants. */
  isAllowed(policy: ExecutionPolicy, actionClass: ExecutionActionClass): boolean {
    const { default: posture, requiresApproval } = this.posture(policy, actionClass);
    if (posture === 'allowed') return true;
    if (posture === 'blocked') return policy.grants[actionClass] === true && requiresApproval;
    // controlled
    return !requiresApproval || policy.grants[actionClass] === true;
  }

  /** Grant explicit authorization for one action class (user decision). */
  grant(
    policy: ExecutionPolicy,
    actionClass: ExecutionActionClass,
    allow: boolean,
  ): ExecutionPolicy {
    return { ...policy, grants: { ...policy.grants, [actionClass]: allow } };
  }
}
