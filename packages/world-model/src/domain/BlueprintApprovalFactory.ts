// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · BlueprintApprovalFactory (SPRINT-034)
//
// The controlled mechanism: a WorkflowExecutionBlueprint (SPRINT-033) can
// produce an APPROVAL REQUEST for its approval-required steps — but the world
// model NEVER approves anything. A request:
//   • exposes ACTION / REASON / BUSINESS / WORKFLOW / STEP / PROVIDER /
//     ESTIMATED COST / DATA SCOPE / RISK / EXPECTED OUTCOME / REVERSIBILITY /
//     AUTHORITY REQUIRED;
//   • carries `executed:false` STRUCTURALLY — nothing in this layer (or the
//     world model) can ever flip it to executed;
//   • becomes APPROVED only through the EXISTING approval authority
//     (WorldApprovalPort → BrainApplicationService.approve);
//   • composes execution ONLY through the existing execution bridge — there
//     is no alternate execution path, no voice shortcut, no model-generated
//     approval, no implicit approval.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BlueprintApprovalRequest,
  ExecutionBlueprintStep,
  WorkflowExecutionBlueprint,
} from '../types/world-types.js';
import type { WorldActionPort } from '../contracts/world-ports.js';

export interface BuildApprovalRequestInput {
  ownerId: string;
  blueprint: WorkflowExecutionBlueprint;
  step: ExecutionBlueprintStep;
  businessUnitId?: string;
  workflowId?: string;
  providerId?: string;
  estimatedCostUsd?: {
    value: number;
    status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
    evidence: string[];
  };
  dataScope?: string;
  expectedOutcome?: string;
}

export type BuildApprovalRequestResult =
  | { success: true; data: BlueprintApprovalRequest }
  | { success: false; error: string; code: string };

/** Risk label per existing A/B/C/D class — switch-based (no computed access
 *  over input-derived keys). */
function riskForClass(c: 'A' | 'B' | 'C' | 'D'): 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' {
  switch (c) {
    case 'A':
      return 'LOW';
    case 'B':
      return 'MEDIUM';
    case 'C':
    case 'D':
      return 'HIGH';
  }
}

/** Reversibility label per existing A/B/C/D class. */
function reversibilityForClass(
  c: 'A' | 'B' | 'C' | 'D',
): 'REVERSIBLE' | 'IRREVERSIBLE' | 'UNKNOWN' {
  switch (c) {
    case 'A':
    case 'B':
      return 'REVERSIBLE';
    case 'C':
    case 'D':
      return 'IRREVERSIBLE';
  }
}

export class BlueprintApprovalFactory {
  constructor(
    private readonly action: WorldActionPort,
    private readonly now: () => string,
  ) {}

  /** Build an approval request for ONE gated step of a blueprint. Only steps
   *  whose existing A/B/C/D class requires a gate may produce a request — a
   *  class-A step (low-risk per the existing policy) never becomes a request. */
  build(input: BuildApprovalRequestInput): BuildApprovalRequestResult {
    const step = input.step;
    // Re-classify through the EXISTING authority (never trust a stored class).
    const decision = this.action.classify(step.label, { recurring: false });
    const authorityRequired = decision.actionClass;
    const requiresApproval =
      decision.actionClass === 'C' || decision.actionClass === 'D' || step.approvalGateRequired;

    if (!requiresApproval) {
      return {
        success: false,
        error: `Step "${step.label}" is class ${authorityRequired} — the existing policy does not require approval.`,
        code: 'NOT_SENSITIVE',
      };
    }

    const ts = this.now();
    const tsDigits = ts.replace(/\D/g, '').slice(-10);
    const id = `bpa-${tsDigits}-${Math.random().toString(36).slice(2, 8)}`;
    const stableKey = [input.ownerId, input.blueprint.id, step.id].join(':');

    return {
      success: true,
      data: {
        id,
        ownerId: input.ownerId,
        stableKey,
        blueprintId: input.blueprint.id,
        stepId: step.id,
        action: step.label.slice(0, 200),
        reason:
          step.approvalReason ??
          `Step "${step.label}" is class ${authorityRequired} under the existing ActionClassPolicy — explicit founder approval is required before it may execute.`,
        businessUnitId: input.businessUnitId ?? input.blueprint.businessUnitId,
        workflowId: input.workflowId,
        providerId: input.providerId,
        estimatedCostUsd: input.estimatedCostUsd,
        dataScope: input.dataScope,
        riskLevel: riskForClass(authorityRequired),
        expectedOutcome: input.expectedOutcome,
        reversibility: reversibilityForClass(authorityRequired),
        authorityRequired,
        status: 'WAITING_FOR_APPROVAL',
        executed: false,
        createdAt: ts,
        updatedAt: ts,
      },
    };
  }
}
