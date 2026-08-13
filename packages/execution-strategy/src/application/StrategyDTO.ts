// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Application DTOs
// Data Transfer Objects for the Enterprise Execution Strategy Engine
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type {
  BudgetCategory,
  CapabilityFlowType,
  CapabilitySupport,
  ExecutionMode,
  RiskLevel,
  StrategyPriority,
} from '../types/strategy-types.js';

// ── Command DTOs ─────────────────────────────────────────────────────────

export interface CreateStrategyDTO {
  goalId: string;
  goal: string;
  business: string[];
  priority: StrategyPriority;
  qualityTier: QualityTier;
  maxCostUsd?: number;
  maxLatencyMs?: number;
  maxTokens?: number;
  availableProviders?: string[];
}

export interface StrategySearchDTO {
  query?: string;
  priority?: StrategyPriority;
  executionMode?: ExecutionMode;
  capabilities?: CapabilityType[];
  business?: string[];
  minConfidence?: number;
  page?: number;
  limit?: number;
}

// ── Response DTOs ─────────────────────────────────────────────────────────

export interface CapabilityPlanStepDTO {
  stepId: string;
  capability: CapabilityType;
  label: string;
  description: string;
  flowType: CapabilityFlowType;
  support: CapabilitySupport;
  skippable: boolean;
  weight: number;
  eligibleFamilies: string[];
  children: CapabilityPlanStepDTO[];
}

export interface CapabilityPlanDTO {
  goal: string;
  steps: CapabilityPlanStepDTO[];
  requiredCapabilities: CapabilityType[];
  feasible: boolean;
  summary: string;
}

export interface ProviderCandidateDTO {
  providerId: string;
  family: string;
  name: string;
  modelId: string;
  capabilityMatch: number;
  qualityEstimate: number;
  latencyEstimateMs: number;
  costEstimateUsd: number;
  contextWindow: number;
  availability: string;
  confidence: number;
  historicalSuccess: number;
  healthScore: number;
  rankScore: number;
}

export interface TokenBudgetDTO {
  inputTokens: number;
  outputTokens: number;
  contextTokens: number;
  reservedTokens: number;
  maximumTokens: number;
  expectedTokens: number;
  confidence: number;
}

export interface CostBudgetDTO {
  expectedCostUsd: number;
  maximumCostUsd: number;
  category: BudgetCategory;
  confidence: number;
}

export interface LatencyBudgetDTO {
  expectedTimeMs: number;
  maximumTimeMs: number;
  confidence: number;
}

export interface QualityTargetDTO {
  targetScore: number;
  minimumScore: number;
  retryThreshold: number;
  approvalRequired: boolean;
  humanReview: boolean;
  tier: QualityTier;
}

export interface RiskAssessmentDTO {
  providerRisk: number;
  executionRisk: number;
  budgetRisk: number;
  latencyRisk: number;
  confidence: number;
  overallRisk: number;
  level: RiskLevel;
  factors: string[];
}

export interface FallbackPlanDTO {
  primaryPlanId: string;
  secondaryPlanId: string;
  emergencyPlanId: string;
  localExecutionPlanId: string;
  description: string;
  activeTier: string;
}

export interface RetryPolicyDTO {
  maximumRetries: number;
  retryDelayMs: number;
  escalation: string;
  stopConditions: string[];
}

export interface ContextReferenceDTO {
  sources: string[];
  maxContextTokens: number;
  priorityCapabilities: CapabilityType[];
  requiresAssembly: boolean;
  contextPackageId?: string;
}

export interface ExecutionModePlanDTO {
  mode: ExecutionMode;
  sequential: { order: string[]; failFast: boolean; expectedTotalMs: number };
  parallel: { groups: string[][]; maxConcurrency: number; expectedTotalMs: number };
  description: string;
}

export interface StrategyValidationDTO {
  passed: boolean;
  checks: Array<{ check: string; passed: boolean; detail: string }>;
  summary: string;
  score: number;
}

export interface ExecutionStrategyDTO {
  strategyId: string;
  goalId: string;
  goal: string;
  business: string[];
  capabilityPlan: CapabilityPlanDTO;
  providerCandidates: ProviderCandidateDTO[];
  contextReference: ContextReferenceDTO;
  executionMode: ExecutionMode;
  modePlan: ExecutionModePlanDTO;
  priority: StrategyPriority;
  risk: RiskAssessmentDTO;
  confidence: number;
  tokenBudget: TokenBudgetDTO;
  costBudget: CostBudgetDTO;
  latencyBudget: LatencyBudgetDTO;
  qualityTarget: QualityTargetDTO;
  fallbackPlan: FallbackPlanDTO;
  retryPolicy: RetryPolicyDTO;
  validation: StrategyValidationDTO;
  createdAt: string;
  updatedAt: string;
  version: string;
}

export interface StrategySummaryDTO {
  total: number;
  averageConfidence: number;
  countByPriority: Record<StrategyPriority, number>;
  countByExecutionMode: Record<ExecutionMode, number>;
}

export interface StrategyExplanationDTO {
  strategyId: string;
  goal: string;
  capabilitySummary: string;
  providerSummary: string;
  budgetSummary: string;
  riskSummary: string;
  modeSummary: string;
  validationSummary: string;
}

export interface TokenEstimateDTO {
  expectedTokens: number;
  inputTokens: number;
  outputTokens: number;
  contextTokens: number;
  reservedTokens: number;
  confidence: number;
}

export interface CostEstimateDTO {
  expectedCostUsd: number;
  minimumCostUsd: number;
  maximumCostUsd: number;
  confidence: number;
}

export interface LatencyEstimateDTO {
  expectedTimeMs: number;
  minimumTimeMs: number;
  maximumTimeMs: number;
  confidence: number;
}
