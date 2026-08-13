// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Problem Understanding Types
// SPRINT-023 — Outcome Intelligence & Real-Problem Execution
//
// A typed ProblemDefinition is the front door of the problem→outcome
// flow: raw request → normalized problem → intent (ANSWER / ACTION /
// OUTCOME) → desired outcome → constraints → urgency → required
// capabilities → missing information → risk → approval requirements →
// success criteria.
//
// Honesty invariants (SPRINT-023 §1/§2):
//   - missingInformation is ALWAYS explicit — the system never
//     hallucinates what it could not determine.
//   - intent/domain/outcome/criteria are derived deterministically from
//     the request text; UNKNOWN stays UNKNOWN.
//   - riskLevel and confidence are estimates and are labeled as such in
//     provenance — never presented as ground truth.
//   - approval requirements surface whenever the request implies
//     irreversible / financial / external actions.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { RiskLevel } from './goal-types.js';

/** The mission's ANSWER vs ACTION vs OUTCOME distinction (§2). */
export type ProblemIntent = 'ANSWER' | 'ACTION' | 'OUTCOME' | 'UNKNOWN';

export const PROBLEM_INTENTS: readonly ProblemIntent[] = [
  'ANSWER',
  'ACTION',
  'OUTCOME',
  'UNKNOWN',
] as const;

/** Explicit user-stated or deterministically detected constraint. */
export type ProblemConstraintKind = 'deadline' | 'budget' | 'privacy' | 'local' | 'free' | 'other';

export const PROBLEM_CONSTRAINT_KINDS: readonly ProblemConstraintKind[] = [
  'deadline',
  'budget',
  'privacy',
  'local',
  'free',
  'other',
] as const;

export interface ProblemConstraint {
  kind: ProblemConstraintKind;
  /** The matched value from the request (e.g. "by Friday", "under $100"). */
  value: string;
}

/** Why human approval would be required before acting. */
export interface ProblemApprovalRequirement {
  /** Irreversible / financial / external action detected. */
  action: string;
  /** Human-readable reason (never fabricated — tied to a text signal). */
  reason: string;
}

/** The typed problem definition produced by ProblemUnderstandingService. */
export interface ProblemDefinition {
  problemId: string;
  /** The user's original request, verbatim. */
  originalRequest: string;
  /** Whitespace-normalized copy of the request. */
  normalizedProblem: string;
  /** ANSWER vs ACTION vs OUTCOME (UNKNOWN when not determinable). */
  intent: ProblemIntent;
  /** Derived business/life domain (from the goal category taxonomy). */
  domain: string;
  /** The desired end state, stated conservatively from the request. */
  desiredOutcome: string;
  constraints: ProblemConstraint[];
  /** 0..1 urgency signal (derived from the goal priority signals). */
  urgency: number;
  /** Capabilities the request implies (shared capability taxonomy). */
  requiredCapabilities: CapabilityType[];
  /** What could NOT be determined — the minimum useful clarifications. */
  missingInformation: string[];
  /** Estimated risk (labeled as an estimate in provenance). */
  riskLevel: RiskLevel;
  approvalRequirements: ProblemApprovalRequirement[];
  /** Explicit success criteria only; empty + missingInformation when absent. */
  successCriteria: string[];
  /** 0..1 — how much of the definition could be determined. */
  confidence: number;
  /** Every determination/estimate the service made, traceable. */
  provenance: string[];
}
