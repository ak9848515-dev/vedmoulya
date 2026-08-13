// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain Decision Ids
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// Branded identifiers for decisions and plans. Decision ids are
// deterministic per (planId, type) so a plan's decisions are stable
// across regeneration, and plan ids carry a timestamp so re-deciding a
// goal produces a fresh plan (superseding the previous one).
// ──────────────────────────────────────────────────────────────────

export type BrainDecisionId = string & { readonly __brainDecisionId: unique symbol };

export type BrainPlanId = string & { readonly __brainPlanId: unique symbol };

/** Create a branded BrainDecisionId from a raw string. */
export function createBrainDecisionId(id: string): BrainDecisionId {
  return id as BrainDecisionId;
}

/** Deterministic decision id within a plan: bd_<planId>_<type>. */
export function createPlanDecisionId(planId: string, type: string): BrainDecisionId {
  return createBrainDecisionId(`bd_${planId}_${type}`);
}

/** Generate a unique plan id for a goal: plan_<goalId>_<timestamp>. */
export function generateBrainPlanId(goalId: string): BrainPlanId {
  return `plan_${goalId}_${Date.now().toString(36)}` as BrainPlanId;
}

/** Generate a unique history entry id. */
export function generateHistoryId(): string {
  return `bhist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a unique audit entry id. */
export function generateAuditId(): string {
  return `baud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
