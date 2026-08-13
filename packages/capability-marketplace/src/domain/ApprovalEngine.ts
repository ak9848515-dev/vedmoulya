// ──────────────────────────────────────────────────────────────────
// VedMoulya — Approval Engine
// EPIC-013 — factories must clearly identify irreversible actions:
// publish, send, deploy, purchase, delete, externally share. Steps
// that perform an irreversible action require explicit user approval.
// ──────────────────────────────────────────────────────────────────

import type { IrreversibleAction } from '../types/capability-types.js';
import { IRREVERSIBLE_ACTIONS } from '../types/capability-types.js';

export interface ApprovalDecision {
  irreversible: boolean;
  /** Which irreversible actions the step performs (when any). */
  actions: string[];
  reasons: string[];
}

/** Keyword signals per irreversible action. */
const ACTION_KEYWORDS: Record<IrreversibleAction, string[]> = {
  publish: ['publish', 'post', 'release', 'go live', 'launch to'],
  send: ['send', 'email', 'message', 'submit to', 'deliver to'],
  deploy: ['deploy', 'ship', 'production', 'push to prod'],
  purchase: ['purchase', 'buy', 'pay', 'subscription', 'upgrade to paid'],
  delete: ['delete', 'remove permanently', 'destroy'],
  share: ['share publicly', 'share externally', 'make public', 'publish externally'],
};

export class ApprovalEngine {
  decide(stepTitle: string, stepPurpose: string): ApprovalDecision {
    const text = `${stepTitle} ${stepPurpose}`.toLowerCase();
    const actions = IRREVERSIBLE_ACTIONS.filter((action) =>
      ACTION_KEYWORDS[action].some((keyword) => text.includes(keyword)),
    );

    if (actions.length === 0) {
      return {
        irreversible: false,
        actions: [],
        reasons: ['This step does not perform an irreversible action.'],
      };
    }
    return {
      irreversible: true,
      actions,
      reasons: [
        `This step performs an irreversible action (${actions.join(', ')}) — explicit user approval is required.`,
      ],
    };
  }
}
