// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Approval Runtime (PHASE 3)
// EPIC-014 — integrates the existing EPIC-013 ApprovalEngine semantics.
// The execution engine STOPS before any irreversible action and sets
// WAITING_FOR_APPROVAL. After approval it resumes from the correct
// checkpoint. Rejection blocks the step and the run. No approval
// bypass: recovery/hand-off completion never skips the gate.
// ──────────────────────────────────────────────────────────────────

import { ApprovalEngine } from '@vedmoulya/capability-marketplace';
import type { PlanStep } from '@vedmoulya/capability-marketplace';

export interface ApprovalDecisionRecord {
  stepId: string;
  decision: 'approved' | 'rejected';
  actions: string[];
  note?: string;
  decidedAt: string;
}

export class ApprovalRuntime {
  private readonly engine = new ApprovalEngine();

  /**
   * Re-derive the approval requirement from the plan step using the
   * frozen ApprovalEngine (same keyword semantics the planner used) —
   * a belt-and-braces re-check so an execution can never bypass it.
   */
  requiresApproval(step: PlanStep): { required: boolean; actions: string[]; reasons: string[] } {
    const decision = this.engine.decide(step.title, step.purpose);
    return {
      required: decision.irreversible,
      actions: decision.actions,
      reasons: decision.reasons,
    };
  }

  /**
   * What the user must understand before approving (no dark patterns):
   * WHAT will happen · WHY it is needed · WHICH tool · expected cost ·
   * what data is sent · what cannot be undone.
   */
  describe(step: PlanStep, provider?: string, model?: string, expectedCostUsd?: number): string[] {
    const decision = this.engine.decide(step.title, step.purpose);
    const lines: string[] = [
      `WHAT: execute “${step.title}”${provider ? ` via ${provider}${model ? ` · ${model}` : ''}` : ''}.`,
      `WHY: this step performs an irreversible action (${decision.actions.join(', ') || 'unknown'}).`,
      decision.actions.length > 0
        ? `IRREVERSIBLE: ${decision.actions.join(', ')} — this cannot be undone.`
        : 'IRREVERSIBLE: this action cannot be undone.',
    ];
    if (expectedCostUsd !== undefined) {
      lines.push(
        `COST: approximately $${expectedCostUsd.toFixed(4)} (estimate where evidence exists).`,
      );
    }
    lines.push(
      'DATA: only the step instruction and your plan are sent to the provider — never credentials.',
    );
    return lines;
  }
}
