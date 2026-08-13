// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/brain — Outcome & Revenue Intelligence types
// EPIC-020 (Outcome & Revenue layer)
//
// A GENERIC, extensible outcome model — the user's life is never
// hardcoded into it. Every outcome carries:
//   desired result · measurable success condition (where possible) ·
//   priority · deadline (where applicable) · constraints ·
//   estimated effort (only where evidence exists) · expected value
//   (only where evidence exists) · confidence · provenance.
//
// Honesty invariants (mission §1/§2/§3):
//   - UNKNOWN stays UNKNOWN — money, time, ROI, probability and
//     savings are NEVER fabricated.
//   - expectedValue appears only when evidence supports it.
//   - The hierarchy is transparent: quality and evidence sit ABOVE
//     cost and free/local — a free option never beats quality.
// ──────────────────────────────────────────────────────────────────

import type { EvidenceStatus } from './continuous-types.js';

// ── Outcome vocabulary (mission §1) ────────────────────────────────
export type OutcomeType =
  | 'SOLVE_PROBLEM'
  | 'SAVE_TIME'
  | 'SAVE_MONEY'
  | 'MAKE_MONEY'
  | 'LEARN'
  | 'BUILD'
  | 'AUTOMATE'
  | 'DECIDE'
  | 'CREATE'
  | 'RESEARCH'
  | 'CAREER'
  | 'BUSINESS'
  | 'PERSONAL'
  | 'UNKNOWN';

export const OUTCOME_TYPES: readonly OutcomeType[] = [
  'SOLVE_PROBLEM',
  'SAVE_TIME',
  'SAVE_MONEY',
  'MAKE_MONEY',
  'LEARN',
  'BUILD',
  'AUTOMATE',
  'DECIDE',
  'CREATE',
  'RESEARCH',
  'CAREER',
  'BUSINESS',
  'PERSONAL',
  'UNKNOWN',
] as const;

export type OutcomePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type OutcomeStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'USER_REJECTED'
  | 'BLOCKED'
  | 'UNKNOWN';

/** An explicit user-stated constraint (deadline, budget, privacy, local…). */
export interface OutcomeConstraint {
  kind: 'deadline' | 'budget' | 'privacy' | 'local' | 'free' | 'other';
  value: string;
}

/** Expected value — ONLY populated when evidence supports it. */
export interface OutcomeValue {
  category: 'MONEY' | 'TIME' | 'QUALITY' | 'CAREER' | 'BUSINESS' | 'PERSONAL' | 'UNKNOWN';
  /** Unit of measure (USD, hours/week, score…). */
  unit?: string;
  amount?: number;
  label: string;
  status: EvidenceStatus;
}

export interface OutcomeEvidence {
  claim: string;
  source: string;
  status: EvidenceStatus;
}

/** Effort estimate — only when evidence exists. */
export interface OutcomeEffort {
  label: string;
  status: EvidenceStatus;
}

// ── The generic Outcome (mission §1) ───────────────────────────────
export interface Outcome {
  id: string;
  userId: string;
  /** Short human title. */
  title: string;
  /** The desired end state (what success looks like). */
  desiredResult: string;
  /** Measurable success condition where possible. */
  successCondition?: string;
  type: OutcomeType;
  priority: OutcomePriority;
  /** Where applicable. */
  deadline?: string;
  constraints: OutcomeConstraint[];
  /** Estimated effort — only where evidence exists. */
  estimatedEffort?: OutcomeEffort;
  /** Expected value — only where evidence exists. */
  expectedValue: OutcomeValue[];
  /** 0..1 — evidence-backed, never invented. */
  confidence: number;
  /** Provenance of every claim. */
  provenance: string[];
  status: OutcomeStatus;
  /** Where applicable: the Brain task that realizes this outcome. */
  linkedTaskId?: string;
  /** Where applicable: the opportunity that produced this outcome. */
  linkedOpportunityId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Satisfaction loop (mission §10) ────────────────────────────────
/** Lightweight user feedback: "Did this solve your problem?" */
export type OutcomeSatisfaction = 'YES' | 'PARTIALLY' | 'NO' | 'UNKNOWN';

export const OUTCOME_SATISFACTIONS: readonly OutcomeSatisfaction[] = [
  'YES',
  'PARTIALLY',
  'NO',
  'UNKNOWN',
] as const;

// ── Honest outcome verdict (SPRINT-024 Phase 2) ───────────────────
export type OutcomeVerdict =
  'SUCCESS' | 'FAILED' | 'UNKNOWN' | 'AWAITING_APPROVAL' | 'CANCELLED' | 'BUDGET_EXHAUSTED';

export const OUTCOME_VERDICTS: readonly OutcomeVerdict[] = [
  'SUCCESS',
  'FAILED',
  'UNKNOWN',
  'AWAITING_APPROVAL',
  'CANCELLED',
  'BUDGET_EXHAUSTED',
] as const;

// ── Daily Outcome Engine (mission §8) ──────────────────────────────
export type DailyActionCategory =
  | 'EARNING'
  | 'PROBLEM'
  | 'CAREER'
  | 'AUTOMATION'
  | 'PRODUCT'
  | 'APPROVAL'
  | 'CONTINUE'
  | 'COST_SAVING'
  | 'LEARNING'
  | 'UNKNOWN';

export interface DailyAction {
  id: string;
  title: string;
  category: DailyActionCategory;
  /** Why it matters (short, transparent). */
  whyItMatters: string[];
  /** The exact next action. */
  recommendedNextAction: string;
  /** Transparent priority 0..1 — breakdown available on request. */
  priorityScore: number;
  /** Approved actions that need user input. */
  requiresApproval?: string;
  source: { kind: 'task' | 'opportunity' | 'event' | 'learning' | 'approval'; id: string };
  expectedValue?: OutcomeValue;
  uncertainty?: number;
}

export interface DailyPriorityPlan {
  generatedAt: string;
  items: DailyAction[];
}
