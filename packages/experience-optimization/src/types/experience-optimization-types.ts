// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization + Self-Improvement: Domain Types
//
//   VERIFIED EXECUTION → LEARNING → MEMORY → EXPERIENCE OPTIMIZATION →
//   STRATEGY RECOMMENDATION → PLANNING / ADAPTIVE DECISION → NORMAL
//   VALIDATION → GOVERNANCE → EXECUTION → VERIFICATION → MEASURED OUTCOME
//
// Memory stores evidence. OPTIMIZATION interprets evidence into an
// ADVISORY recommendation. Nothing here authorizes, bypasses
// ToolRuntime/AIOrchestrationService/governance/verification/budgets or
// current runtime truth, and nothing self-modifies code/configuration.
//
// Safety invariants (Phase 26):
//   MEMORY cannot authorize. OPTIMIZATION cannot authorize. PLANNER
//   cannot authorize. MODEL cannot authorize. Only governance/runtime
//   authorization can authorize. Only verification establishes truth.
//
// Conflict priority (Phase 18), highest first:
//   1. explicit current user instruction
//   2. governance / security
//   3. current capability availability
//   4. current tool availability
//   5. current verification
//   6. current health / runtime evidence
//   7. recent measured execution evidence
//   8. historical memory / experience
//   9. generic model preference
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { RuntimeTruth } from '@vedmoulya/execution-memory';

// ── Optimization targets (closed set — what may be optimized) ─────
// Permissions, governance, safety boundaries, capability authority and
// budgets are NEVER optimization targets.

export const OPTIMIZATION_TARGETS = [
  'PLAN_PATTERN',
  'TOOL_SELECTION',
  'RECOVERY_STRATEGY',
  'VERIFICATION_STRATEGY',
  'ROUTING_SIGNAL',
  'EXECUTION_SEQUENCE',
] as const;

export type OptimizationTarget = (typeof OPTIMIZATION_TARGETS)[number];

// ── Evidence levels (Phase 4) — conservative, sample-gated ────────

export const EVIDENCE_LEVELS = ['INSUFFICIENT', 'EMERGING', 'RELIABLE', 'HIGH_CONFIDENCE'] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

// ── Strategy evidence (aggregated from verified memory entries) ───

export interface StrategyEvidence {
  target: OptimizationTarget;
  /** e.g. plan-pattern signature, tool name, recovery strategy, verification kind, provider/model combo. */
  subject: string;
  capability?: CapabilityType;
  sampleCount: number;
  successCount: number;
  failureCount: number;
  /** Verified executions (deterministic verification evidence). */
  verifiedCount: number;
  /** verified / sample — correctness evidence. */
  verificationSuccessRate: number;
  /** achieved / sample — goal completion evidence. */
  goalCompletionRate: number;
  averageCostUsd: number;
  averageLatencyMs: number;
  averageRetries: number;
  averageToolFailures: number;
  /** [0,1] — decays with age (reused execution-memory recency semantics). */
  recency: number;
  confidenceScore: number;
  evidenceLevel: EvidenceLevel;
  /** Success rate of the most recent executions (recent consistency). */
  recentConsistency: number;
  /** Whether cost/latency/retries come from MEASURED online signals. */
  hasPerformanceData: boolean;
  /** Provenance: memory entry ids. */
  sources: string[];
}

// ── Strategy candidate (one scored option) ────────────────────────

export interface ScoreFactor {
  factor: string;
  weight: number;
  value: number;
}

export interface StrategyCandidate {
  target: OptimizationTarget;
  subject: string;
  capability?: CapabilityType;
  evidence: StrategyEvidence;
  /** Transparent multi-objective score in [0,1] (correctness-dominant). */
  score: number;
  scoreBreakdown: ScoreFactor[];
}

// ── Optimization context / constraints ────────────────────────────

export interface OptimizationConstraint {
  capability?: CapabilityType;
  /** Permitted subjects (e.g. allowed tool names) — never widened by optimization. */
  allowedSubjects?: string[];
  /** Conservative exploration: prefer proven strategies, explore rarely. */
  allowExploration?: boolean;
  /** Fraction of decisions that may explore (default 0.1, max 0.25). */
  maxExplorationShare?: number;
  maxRecommendations?: number;
}

export interface OptimizationContext {
  /** Cross-user isolation: only USER-scoped entries for this user qualify. */
  userId?: string;
  goalType?: string;
  capabilities?: CapabilityType[];
  tools?: string[];
  provider?: string;
  model?: string;
  planPattern?: string;
  /** Failure class for recovery optimization (e.g. TIMEOUT, TOOL_UNAVAILABLE). */
  failureClass?: string;
  verificationKind?: string;
  /** Explicit current user instruction (highest priority, Phase 18). */
  explicitInstruction?: { subject: string; value: string };
  constraints?: OptimizationConstraint;
  runtimeTruth?: RuntimeTruth;
}

// ── Strategy recommendation (advisory, explainable) ───────────────

export interface StrategyRecommendation {
  recommendationId: string;
  target: OptimizationTarget;
  subject: string;
  capability?: CapabilityType;
  evidenceLevel: EvidenceLevel;
  confidence: { score: number; level: EvidenceLevel };
  /** Deterministic, evidence-backed sentences (Phase 17). */
  explanation: string[];
  score: number;
  /** Bounded ranked alternatives (never the full cohort). */
  alternatives: StrategyCandidate[];
  /** Advisory only — never authority. */
  advisory: true;
  createdAt: string;
}

// ── Recommendation outcomes (feedback loop, Phase 21) ─────────────

export type RecommendationDecision = 'accepted' | 'rejected';
export type RecommendationOutcomeKind = 'verified_success' | 'failure' | 'blocked' | 'unverified';

export interface RecommendationOutcomeInput {
  recommendationId: string;
  decision: RecommendationDecision;
  outcome?: RecommendationOutcomeKind;
  executionId?: string;
}

export interface RecommendationOutcomeRecord {
  recommendationId: string;
  decision: RecommendationDecision;
  outcome?: RecommendationOutcomeKind;
  executionId?: string;
  recordedAt: string;
}

// ── Conservative A/B comparison (Phase 22) ────────────────────────

export type ComparisonVerdict =
  'A_CREDIBLY_BETTER' | 'B_CREDIBLY_BETTER' | 'INSUFFICIENT_TO_CONCLUDE';

export interface StrategyComparison {
  a: { subject: string; sampleCount: number; successRate: number; verifiedCount: number };
  b: { subject: string; sampleCount: number; successRate: number; verifiedCount: number };
  verdict: ComparisonVerdict;
  /** Conservative 1-sigma uncertainty interval per strategy. */
  uncertainty: { a: [number, number]; b: [number, number] };
  reasons: string[];
}

// ── Optimization decision (what the optimizer concluded; Phase 2/18/20) ──

export type OptimizationDecisionKind = 'recommended' | 'insufficient' | 'conflict_resolved';

export interface OptimizationDecision {
  target: OptimizationTarget;
  decided: OptimizationDecisionKind;
  candidatesConsidered: number;
  recommendation?: { subject: string; level: EvidenceLevel; score: number };
  at: string;
  /** Advisory only — never authority. */
  advisory: true;
}

// ── Effectiveness analytics (Phase 20/21) ─────────────────────────

export interface RecommendationEffectiveness {
  recommendationId: string;
  accepted: number;
  rejected: number;
  verifiedSuccess: number;
  failures: number;
  blocked: number;
  unverified: number;
  accuracy: number | undefined;
}

export interface OptimizationAuditRecord extends OptimizationDecision {
  query: string;
}
