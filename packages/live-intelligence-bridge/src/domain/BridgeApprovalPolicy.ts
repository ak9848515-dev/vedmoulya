// ──────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge · BridgeApprovalPolicy
// EPIC-017 § Phase 6 — APPROVAL BRIDGE.
//
// Composes the EXISTING approval semantics (BrainPolicyEngine
// SENSITIVE_ACTIONS + EPIC-013 ApprovalEngine + EPIC-015 acquisition
// consent) into deterministic approval requirements for bridge
// actions. The bridge RECOMMENDS; policy DECIDES; the user APPROVES;
// execution performs. No policy bypass, ever.
// ──────────────────────────────────────────────────────────────────

import type { AcquisitionClass, BridgeApprovalAction } from '../types/bridge-types.js';

const REQUIRED_ACTIONS: Readonly<Record<AcquisitionClass, BridgeApprovalAction[]>> = {
  PAID: ['purchase', 'subscription'],
  GITHUB_PROJECT: ['write_access', 'private_repo_access', 'configuration_consent'],
  OPEN_SOURCE: ['write_access', 'configuration_consent'],
  EXTERNAL_APPLICATION: ['external_app_action', 'configuration_consent'],
  FREE_API: [],
  FREE_WITH_QUOTA: ['configuration_consent'],
  LOCAL_MODEL: ['configuration_consent'],
  MANUAL: [],
  UNKNOWN: [],
};

/** Irreversible/sensitive actions always require explicit approval. */
const SENSITIVE_ACTION_SET: ReadonlySet<string> = new Set([
  'publish',
  'send',
  'deploy',
  'purchase',
  'subscribe',
  'delete',
  'share',
  'install',
  'connect_account',
]);

export interface ApprovalVerdict {
  required: boolean;
  actions: BridgeApprovalAction[];
  reason: string;
}

export class BridgeApprovalPolicy {
  /** Approval required for a candidate given its acquisition class. */
  forCandidate(acquisition: AcquisitionClass, activated: boolean): ApprovalVerdict {
    if (activated) {
      return {
        required: false,
        actions: [],
        reason: 'Already configured and active — no approval required.',
      };
    }
    // eslint-disable-next-line security/detect-object-injection -- Closed AcquisitionClass union key on the REQUIRED_ACTIONS record; never user-controlled.
    const actions = REQUIRED_ACTIONS[acquisition];
    if (actions.length === 0) {
      return {
        required: false,
        actions: [],
        reason: `No approval required for ${acquisition} activation.`,
      };
    }
    return {
      required: true,
      actions,
      reason: `${acquisition} activation requires explicit user approval (${actions.join(', ')}).`,
    };
  }

  /** Sensitive actions from the Brain's policy vocabulary. */
  isSensitive(action: string): boolean {
    return SENSITIVE_ACTION_SET.has(action);
  }

  /** The approval actions triggered by a sensitive brain action. */
  forSensitiveAction(action: string): { required: boolean; actions: BridgeApprovalAction[] } {
    if (!this.isSensitive(action)) {
      return { required: false, actions: [] };
    }
    const actions: BridgeApprovalAction[] = [];
    if (action === 'publish') actions.push('publishing');
    if (action === 'send') actions.push('sending');
    if (action === 'deploy') actions.push('deployment');
    if (action === 'purchase' || action === 'subscribe') actions.push('purchase', 'subscription');
    if (action === 'delete') actions.push('deletion');
    if (action === 'share') actions.push('sharing');
    if (action === 'install') actions.push('configuration_consent');
    if (action === 'connect_account') actions.push('external_app_action');
    return { required: actions.length > 0, actions };
  }
}
