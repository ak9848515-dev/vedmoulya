// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · WorkflowExecutionBlueprint
// SPRINT-033 (Part E) — the CONTROLLED mechanism:
//
//   Opportunity → founder approval → workflow specification →
//   provider/capability selection → execution (EXISTING bridge ONLY) →
//   verification → outcome → learning
//
// A blueprint is a REPRESENTATION of that path for ONE opportunity/workflow:
//   • every step is classified A/B/C/D through the EXISTING action authority
//     (ActionClassPolicy over the frozen SENSITIVE_ACTIONS) — this module
//     records the class, it never decides;
//   • steps classified C (sensitive/irreversible) carry an approval gate that
//     ONLY the existing approval authority can clear — no voice-only
//     authorization, no hidden execution, no autonomous spending;
//   • the plan is validated against the EXISTING WorkflowBounds (SPRINT-030);
//   • `executed:false` and `authorizationRequired:true` are STRUCTURAL — a
//     blueprint can never launch itself.
// ─────────────────────────────────────────────────────────────────────────────

import type { WorldActionPort } from '../contracts/world-ports.js';
import type { RevenueFigure, WorkflowExecutionBlueprint } from '../types/world-types.js';
import { planWithinBounds, type WorkflowLimits } from './WorkflowFactory.js';

export type BlueprintResult<T> =
  { success: true; data: T } | { success: false; error: string; code: string };

function ok<T>(data: T): BlueprintResult<T> {
  return { success: true, data };
}
function err<T>(error: string, code: string): BlueprintResult<T> {
  return { success: false, error, code };
}

export interface BlueprintStepInput {
  id: string;
  label: string;
  capability?: string;
  roleName?: string;
  verificationRequirement?: string;
  dependsOn: string[];
}

export class WorkflowExecutionBlueprintFactory {
  private readonly action: WorldActionPort;
  private readonly now: () => string;

  constructor(action: WorldActionPort, now?: () => string) {
    this.action = action;
    this.now = now ?? ((): string => new Date().toISOString());
  }

  /** Build the blueprint for one opportunity → workflow path. Never executes.
   *  `steps` are the workflow specification steps (capability/role named, NO
   *  provider ids — provider binding stays advisory via the Intelligence
   *  Fabric). */
  build(input: {
    ownerId: string;
    sourceTitle: string;
    sourceGoal: string;
    businessUnitId?: string;
    steps: BlueprintStepInput[];
    /** Advisory estimated cost (evidence-only) — never fabricated. */
    estimatedCostUsd?: RevenueFigure;
    /** Optional explicit limits; falls back to the documented SPRINT-030
     *  bounds (the gateway validates against the fabric's actual limits). */
    limits?: WorkflowLimits;
  }): BlueprintResult<WorkflowExecutionBlueprint> {
    const sourceTitle = input.sourceTitle.trim();
    const sourceGoal = input.sourceGoal.trim();
    if (sourceTitle.length === 0 || sourceGoal.length === 0) {
      return err('A blueprint needs a source opportunity title and goal.', 'INVALID_SOURCE');
    }
    if (input.steps.length === 0) {
      return err('A blueprint needs at least one step.', 'NO_STEPS');
    }
    if (input.steps.length > 24) {
      return err('A blueprint cannot exceed 24 steps (SPRINT-030 bound).', 'TOO_MANY_STEPS');
    }
    if (input.estimatedCostUsd !== undefined && input.estimatedCostUsd.evidence.length === 0) {
      return err('Estimated cost requires evidence — nothing is fabricated.', 'NO_EVIDENCE');
    }

    const steps = input.steps.slice(0, 24).map((step) => {
      const decision = this.action.classify(step.label);
      const actionClass = decision.actionClass;
      const approvalGateRequired = actionClass === 'C';
      return {
        id: step.id,
        label: step.label.slice(0, 160),
        capability: step.capability?.slice(0, 80),
        roleName: step.roleName?.slice(0, 120),
        actionClass,
        approvalGateRequired,
        approvalReason: approvalGateRequired
          ? `Classified ${actionClass} by the existing authority (${decision.authority}) — the existing approval authority must approve before this step.`
          : undefined,
        verificationRequirement: step.verificationRequirement?.slice(0, 200),
        dependsOn: step.dependsOn.slice(0, 12),
      };
    });

    // Bounds from the EXISTING WorkflowBounds — plan metrics derived
    // deterministically from the blueprint steps (same discipline as the
    // WorkflowFactory decomposition).
    const aiSteps = steps.filter((s) => s.capability !== undefined).length;
    const plan = {
      taskCount: steps.length,
      depth: Math.min(steps.length, 8),
      maxParallelFanout: Math.min(steps.length, 8),
      estimatedProviderCalls: aiSteps + Math.min(aiSteps, 8),
      estimatedCostUsd: input.estimatedCostUsd?.value,
      estimatedTimeMs: undefined,
    };
    const bounds = planWithinBounds(plan, input.limits);

    const approvalGates = steps
      .filter((s) => s.approvalGateRequired)
      .map((s) => ({ stepId: s.id, label: s.label, actionClass: s.actionClass }));

    return ok({
      id: `bp-${Math.random().toString(36).slice(2, 10)}`,
      ownerId: input.ownerId,
      sourceTitle,
      sourceGoal: sourceGoal.slice(0, 300),
      businessUnitId: input.businessUnitId?.slice(0, 120),
      steps,
      estimatedCostUsd: input.estimatedCostUsd
        ? {
            value: input.estimatedCostUsd.value,
            status: input.estimatedCostUsd.status,
            evidence: input.estimatedCostUsd.evidence.slice(0, 4),
          }
        : undefined,
      bounds,
      approvalGates,
      executed: false,
      authorizationRequired: true,
      createdAt: this.now(),
    });
  }
}
