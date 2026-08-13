// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy: Domain Types
// EI-004 — Enterprise Execution Strategy Engine (EES)
// Given a Goal, the EES determines WHAT to execute, WHICH capabilities
// are required, WHICH providers are eligible, HOW work should be divided,
// HOW MUCH context/tokens/budget to use, whether execution is sequential
// or parallel, WHAT quality must be achieved, and WHAT fallback strategy
// to use. The engine creates the strategy — it does NOT execute work.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type { ProviderFamily, ProviderStatus } from '@vedmoulya/ai';

// ── Execution Modes ─────────────────────────────────────────────────────────

export type ExecutionMode = 'sequential' | 'parallel' | 'hybrid' | 'pipeline';

export const EXECUTION_MODES: readonly ExecutionMode[] = [
  'sequential',
  'parallel',
  'hybrid',
  'pipeline',
] as const;

// ── Priority & Risk ─────────────────────────────────────────────────────────

export type StrategyPriority = 'critical' | 'high' | 'medium' | 'low' | 'background';

export const STRATEGY_PRIORITIES: readonly StrategyPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
  'background',
] as const;

export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'critical';

export const RISK_LEVELS: readonly RiskLevel[] = [
  'very_low',
  'low',
  'medium',
  'high',
  'critical',
] as const;

// ── Capability Plan ─────────────────────────────────────────────────────────

export type CapabilitySupport = 'required' | 'optional' | 'conditional';

export type CapabilityFlowType = 'sequential' | 'parallel' | 'optional' | 'conditional';

export const CAPABILITY_FLOW_TYPES: readonly CapabilityFlowType[] = [
  'sequential',
  'parallel',
  'optional',
  'conditional',
] as const;

/** A single step in the capability plan for a goal. */
export interface CapabilityPlanStep {
  stepId: string;
  capability: CapabilityType;
  /** What this step accomplishes (e.g. "Research", "Writing", "SEO"). */
  label: string;
  description: string;
  /** How this step relates to its siblings/children. */
  flowType: CapabilityFlowType;
  support: CapabilitySupport;
  /** Whether this step can be skipped if context is insufficient. */
  skippable: boolean;
  /** Estimated share of work/tokens 0–1 (weights the budget split). */
  weight: number;
  /** Provider families that are eligible for this step (empty = any). */
  eligibleFamilies: ProviderFamily[];
  /** Nested sub-steps (sequential/parallel decomposition). */
  children: CapabilityPlanStep[];
}

export interface CapabilityPlan {
  goal: string;
  steps: CapabilityPlanStep[];
  /** Capabilities required somewhere in the plan (deduped). */
  requiredCapabilities: CapabilityType[];
  /** Whether the plan is executable with the available context. */
  feasible: boolean;
  /** Human-readable summary of the plan flow. */
  summary: string;
}

// ── Provider Candidates ─────────────────────────────────────────────────────
// EI-004 only ranks eligible providers — it never chooses one.

export interface ProviderCandidate {
  providerId: string;
  family: ProviderFamily;
  name: string;
  modelId: string;
  /** 0–1 capability match for the goal. */
  capabilityMatch: number;
  /** 0–1 expected quality. */
  qualityEstimate: number;
  /** Expected p50 latency in ms. */
  latencyEstimateMs: number;
  /** Expected cost in USD for the full strategy. */
  costEstimateUsd: number;
  /** Context window tokens available on the chosen model. */
  contextWindow: number;
  /** Provider operational status. */
  availability: ProviderStatus;
  /** Registry/estimate confidence 0–1. */
  confidence: number;
  /** Measured historical success rate 0–1. */
  historicalSuccess: number;
  /** Fleet health score 0–1 (from the provider registry). */
  healthScore: number;
  /** Composite candidacy score 0–1 (ranking only, NO selection). */
  rankScore: number;
}

// ── Token Budget ────────────────────────────────────────────────────────────

export interface TokenBudget {
  inputTokens: number;
  outputTokens: number;
  contextTokens: number;
  reservedTokens: number;
  maximumTokens: number;
  expectedTokens: number;
  confidence: number; // 0–1
}

// ── Cost Budget ─────────────────────────────────────────────────────────────

export type BudgetCategory = 'minimum' | 'standard' | 'premium' | 'maximum';

export const BUDGET_CATEGORIES: readonly BudgetCategory[] = [
  'minimum',
  'standard',
  'premium',
  'maximum',
] as const;

export interface CostBudget {
  expectedCostUsd: number;
  maximumCostUsd: number;
  category: BudgetCategory;
  confidence: number; // 0–1
}

// ── Latency Budget ──────────────────────────────────────────────────────────

export interface LatencyBudget {
  expectedTimeMs: number;
  maximumTimeMs: number;
  confidence: number; // 0–1
}

// ── Quality Target ──────────────────────────────────────────────────────────

export interface QualityTarget {
  targetScore: number; // 0–1 minimum acceptable quality
  minimumScore: number; // 0–1 hard floor
  retryThreshold: number; // 0–1 below which retries trigger
  approvalRequired: boolean;
  humanReview: boolean;
  tier: QualityTier;
}

// ── Execution Plans ─────────────────────────────────────────────────────────

export interface SequentialPlan {
  /** Ordered step execution (stepIds in plan order). */
  order: string[];
  /** Whether a step failure stops the whole sequence. */
  failFast: boolean;
  expectedTotalMs: number;
}

export interface ParallelPlan {
  /** StepIds allowed to run concurrently. */
  groups: string[][];
  maxConcurrency: number;
  expectedTotalMs: number;
}

export interface ExecutionModePlan {
  mode: ExecutionMode;
  sequential: SequentialPlan;
  parallel: ParallelPlan;
  description: string;
}

// ── Risk Assessment ─────────────────────────────────────────────────────────

export interface RiskAssessment {
  providerRisk: number; // 0–1
  executionRisk: number; // 0–1
  budgetRisk: number; // 0–1
  latencyRisk: number; // 0–1
  confidence: number; // 0–1
  overallRisk: number; // 0–1
  level: RiskLevel;
  factors: string[];
}

// ── Fallback Plan ───────────────────────────────────────────────────────────

export interface FallbackPlan {
  primaryPlanId: string;
  secondaryPlanId: string;
  emergencyPlanId: string;
  localExecutionPlanId: string;
  /** Human-readable fallback explanation. */
  description: string;
  /** Active fallback tier (primary initially — not executing, just strategy). */
  activeTier: 'primary' | 'secondary' | 'emergency' | 'local';
}

// ── Retry Policy ────────────────────────────────────────────────────────────

export interface StrategyRetryPolicy {
  maximumRetries: number;
  retryDelayMs: number;
  escalation: 'none' | 'double-delay' | 'switch-provider' | 'switch-capability';
  stopConditions: string[];
}

// ── Context Reference ───────────────────────────────────────────────────────

export interface ContextReference {
  /** Source categories to pull (mirrors the context registry taxonomy). */
  sources: string[];
  /** Maximum context tokens to assemble. */
  maxContextTokens: number;
  /** Capabilities whose context should be prioritized. */
  priorityCapabilities: CapabilityType[];
  /** Whether context assembly (EI-003) will be invoked before execution. */
  requiresAssembly: boolean;
  /** Reference to the assembled context package (populated at execution time). */
  contextPackageId?: string;
}

// ── Execution Strategy ──────────────────────────────────────────────────────

export interface ExecutionStrategy {
  strategyId: string;
  goalId: string;
  goal: string;
  business: string[];
  capabilityPlan: CapabilityPlan;
  providerCandidates: ProviderCandidate[];
  contextReference: ContextReference;
  executionMode: ExecutionMode;
  modePlan: ExecutionModePlan;
  priority: StrategyPriority;
  risk: RiskAssessment;
  confidence: number; // 0–1 overall strategy confidence
  tokenBudget: TokenBudget;
  costBudget: CostBudget;
  latencyBudget: LatencyBudget;
  qualityTarget: QualityTarget;
  fallbackPlan: FallbackPlan;
  retryPolicy: StrategyRetryPolicy;
  validation: StrategyValidation;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  version: string;
}

// ── Validation ──────────────────────────────────────────────────────────────

export interface StrategyValidationCheck {
  check: string;
  passed: boolean;
  detail: string;
}

export interface StrategyValidation {
  passed: boolean;
  checks: StrategyValidationCheck[];
  /** Summary of why the strategy passed/failed. */
  summary: string;
  score: number; // 0–1
}

// ── Strategy Input (create) ─────────────────────────────────────────────────

export interface StrategyInput {
  goalId: string;
  goal: string;
  business: string[];
  priority: StrategyPriority;
  qualityTier: QualityTier;
  maxCostUsd?: number;
  maxLatencyMs?: number;
  maxTokens?: number;
  availableProviders?: string[]; // provider family allow-list (empty = all)
}

// ── Estimates ───────────────────────────────────────────────────────────────

export interface TokenEstimate {
  expectedTokens: number;
  inputTokens: number;
  outputTokens: number;
  contextTokens: number;
  reservedTokens: number;
  confidence: number;
}

export interface CostEstimate {
  expectedCostUsd: number;
  minimumCostUsd: number;
  maximumCostUsd: number;
  confidence: number;
}

export interface LatencyEstimate {
  expectedTimeMs: number;
  minimumTimeMs: number;
  maximumTimeMs: number;
  confidence: number;
}

// ── Search ──────────────────────────────────────────────────────────────────

export interface StrategySearchCriteria {
  query?: string;
  priority?: StrategyPriority;
  executionMode?: ExecutionMode;
  capabilities?: CapabilityType[];
  business?: string[];
  minConfidence?: number;
  page?: number;
  limit?: number;
}
