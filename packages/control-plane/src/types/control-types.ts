// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · types
// SPRINT-031 — the ACTIVE INTELLIGENCE & AUTONOMY CONTROL PLANE.
//
// A narrow COMPOSITION layer. Nothing here is an engine: no discovery, no
// provider selection, no approval, no execution, no memory, no learning. The
// types describe (a) the user's explicit autonomy control (settings + emergency
// stop), (b) the typed opportunity lifecycle, and (c) the fail-closed GATE that
// composes the existing authorities (AutonomyPolicy A/B/C/D + CostPolicyGuard +
// EmergencyStop + user restrictions) into ONE decision. The frozen estate
// remains the source of truth for every authority.
// ─────────────────────────────────────────────────────────────────────────────

import type { AutonomyLevel } from '@vedmoulya/intelligence-fabric';

// ── Autonomy settings (user-owned, persisted, fail-closed) ─────────────────

export type NotificationPreference = 'all' | 'briefing-only' | 'none';

export interface QuietHours {
  /** 24h clock "HH:MM". Absent = no quiet window. */
  start?: string;
  end?: string;
}

/** The user's explicit autonomy control. FAIL-CLOSED defaults: level 0
 *  (observe only) until the user raises it; no unrestricted spending; no
 *  implicit provider access beyond the registry; quiet hours default off. */
export interface AutonomySettings {
  ownerId: string;
  /** 0..5 — the global autonomy ceiling (SPRINT-030 AutonomyPolicy semantics). */
  autonomyLevel: AutonomyLevel;
  /** Recommendation categories the system may PROPOSE (empty = all allowed). */
  allowedCategories?: string[];
  /** Recommendation categories NEVER proposed (policy — never overridden). */
  prohibitedCategories?: string[];
  /** Daily spend ceiling in USD (0 = no spend allowed at all, fail-closed). */
  maxDailyCostUsd?: number;
  /** Per-task spend ceiling in USD. */
  maxTaskCostUsd?: number;
  /** Provider ids the system may route to (empty = only registry-available). */
  allowedProviders?: string[];
  /** Provider ids NEVER used (privacy/security). */
  prohibitedProviders?: string[];
  /** When true, only local/private processing is permitted. */
  privateOnly: boolean;
  /** True once the user explicitly approved this settings shape. */
  userConfirmed: boolean;
  notificationPreference: NotificationPreference;
  quietHours?: QuietHours;
  /** Explicit automation permissions (workflow ids the user pre-authorized). */
  automationPermissions?: string[];
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_AUTONOMY_SETTINGS: Omit<
  AutonomySettings,
  'ownerId' | 'updatedAt' | 'updatedBy'
> = {
  autonomyLevel: 0,
  allowedCategories: [],
  prohibitedCategories: [],
  maxDailyCostUsd: 0,
  maxTaskCostUsd: 0,
  allowedProviders: [],
  prohibitedProviders: [],
  privateOnly: true,
  userConfirmed: false,
  notificationPreference: 'briefing-only',
  quietHours: {},
  automationPermissions: [],
};

// ── Emergency stop (narrow, audited, never destructive) ────────────────────

export interface EmergencyStopEvent {
  id: string;
  ownerId: string;
  action: 'ENGAGE' | 'RELEASE';
  /** WHO */
  actor: string;
  /** WHEN */
  timestamp: string;
  /** WHY / SOURCE */
  reason: string;
  source: 'user' | 'system' | 'operator';
  /** STATE BEFORE */
  engagedBefore: boolean;
  /** STATE AFTER */
  engagedAfter: boolean;
}

export interface EmergencyStopState {
  ownerId: string;
  engaged: boolean;
  engagedAt?: string;
  engagedBy?: string;
  reason?: string;
  history: EmergencyStopEvent[];
}

// ── Opportunity lifecycle (typed, guarded transitions) ─────────────────────

export type OpportunityStatus =
  | 'DISCOVERED'
  | 'ASSESSED'
  | 'SHORTLISTED'
  | 'PRESENTED'
  | 'APPROVED'
  | 'PLANNED'
  | 'EXECUTED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'COMPLETED';

/** Legal one-step transitions of the lifecycle state machine. */
export const OPPORTUNITY_TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  DISCOVERED: ['ASSESSED', 'REJECTED'],
  ASSESSED: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['PRESENTED', 'REJECTED'],
  PRESENTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['PLANNED', 'REJECTED'],
  PLANNED: ['EXECUTED', 'REJECTED'],
  EXECUTED: ['VERIFIED'],
  VERIFIED: ['COMPLETED', 'REJECTED'],
  REJECTED: [],
  COMPLETED: [],
};

export interface OpportunityEvidence {
  label: string;
  status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
}

export interface OpportunityLifecycleRecord {
  id: string;
  ownerId: string;
  /** Stable key (owner + title) — idempotency. */
  stableKey: string;
  title: string;
  description: string;
  category: string;
  status: OpportunityStatus;
  evidence: OpportunityEvidence[];
  /** 0..1 — only when evidence supports it. */
  confidence?: number;
  estimatedValue?: OpportunityEvidence;
  estimatedCost?: OpportunityEvidence;
  estimatedEffort?: OpportunityEvidence;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  automationPotential: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  recommendedWorkflow?: string[];
  /** Approval record — ONLY from the existing approval authority. */
  approval?: { id: string; grantedBy: string; grantedAt: string; scope: string };
  /** Execution evidence — ONLY from the existing execution authority. */
  execution?: { id: string; completedAt: string; verified: boolean };
  transitions: Array<{ from: OpportunityStatus; to: OpportunityStatus; at: string; note: string }>;
  createdAt: string;
  updatedAt: string;
}

// ── The fail-closed gate (composes existing authorities) ───────────────────

export type GateVerdict =
  | 'ALLOWED'
  | 'WAITING_FOR_APPROVAL'
  | 'BLOCKED_BY_POLICY'
  | 'BLOCKED_BY_BUDGET'
  | 'EMERGENCY_STOP'
  | 'NEEDS_REVIEW';

export interface GateDecision {
  verdict: GateVerdict;
  /** The existing action class (A/B/C/D) from ActionClassPolicy. */
  actionClass?: 'A' | 'B' | 'C' | 'D';
  allowed: boolean;
  /** Human-readable reasons — why this exact verdict. */
  reasons: string[];
  /** Which authority informed the decision. */
  authorities: string[];
  /** True when execution would still require the EXISTING approval authority. */
  approvalRequired: boolean;
}

// ── Observation / cycle (bounded — never executes) ─────────────────────────

export interface ObservationSnapshot {
  ownerId: string;
  observedAt: string;
  providerHealth: Array<{ providerId: string; state: string; observedCalls: number }>;
  cost: { dailyUsd?: number; providerUsd?: number };
  pendingApprovals: Array<{ taskId: string; title: string; approvalRequired: string[] }>;
  activeRecommendations: number;
  outcomeCount: number;
  emergencyStopEngaged: boolean;
}

export interface CycleOutcome {
  ownerId: string;
  ranAt: string;
  observed: ObservationSnapshot;
  /** Recommendations proposed (gated — never executed). */
  proposed: Array<{ id: string; title: string; category: string; verdict: GateVerdict }>;
  blockedByPolicy: number;
  blockedByBudget: number;
  waitingForApproval: number;
  emergencyStopped: boolean;
  /** The cycle NEVER executes anything — this is a structural guarantee. */
  executedNothing: true;
}
