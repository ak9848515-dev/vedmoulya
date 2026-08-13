// ──────────────────────────────────────────────────────────────────
// VedMoulya — CapabilityPlanStore port
// EPIC-013 — plans are owner-scoped (IDOR-safe by construction:
// reads only ever key on the caller's own id) and bounded (plan
// history can never become an unbounded memory sink).
// ──────────────────────────────────────────────────────────────────

import type { FactoryCapabilityPlan, CapabilityPlanSummary } from '../types/capability-types.js';

export interface CapabilityPlanStore {
  save(ownerId: string, plan: FactoryCapabilityPlan): Promise<void>;
  /** Read only the caller's own plan — foreign ids resolve to undefined. */
  get(ownerId: string, planId: string): Promise<FactoryCapabilityPlan | undefined>;
  /** List only the caller's own plans. */
  list(ownerId: string): Promise<CapabilityPlanSummary[]>;
}
