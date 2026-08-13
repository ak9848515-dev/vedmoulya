// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: DTOs
// EPIC-006 — Phase 14. The typed public contract for the loop.* API.
// Internal engine details (ports, execution internals) are never
// exposed — the DTO is the boundary.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  CriticAssessment,
  EvidenceState,
  GoalPattern,
  LoopBudgetConfig,
  LoopBudgetUsage,
  LoopRiskLevel,
  LoopRunStatus,
  LoopTask,
  LoopTraceStep,
  ProposedMemory,
  TerminationReason,
} from '../types/loop-types.js';

/** Start response: the derived specification + the plan, before execution. */
export interface LoopStartResultDTO {
  runId: string;
  goalId: string;
  specification: GoalSpecificationDTO;
  graph: LoopTaskGraphDTO;
}

export interface LoopStatusDTO {
  runId: string;
  status: LoopRunStatus;
  terminationReason?: TerminationReason;
  iterations: number;
  providerCalls: number;
  tokensTotal: number;
  costUsd: number;
  latencyMs: number;
}

export interface LoopRunDTO {
  runId: string;
  goalId: string;
  userId: string;
  goal: string;
  specification: GoalSpecificationDTO;
  graph: LoopTaskGraphDTO;
  steps: LoopTraceStep[];
  budgetConfig: LoopBudgetConfig;
  budgetUsage: LoopBudgetUsage;
  status: LoopRunStatus;
  terminationReason?: TerminationReason;
  finalContent?: string;
  finalCritic?: CriticAssessment;
  evidenceStates: EvidenceState[];
  proposedMemories: ProposedMemory[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface LoopRunSummaryDTO {
  runId: string;
  goal: string;
  pattern: GoalPattern;
  status: LoopRunStatus;
  terminationReason?: TerminationReason;
  iterations: number;
  tokensTotal: number;
  costUsd: number;
  latencyMs: number;
  createdAt: string;
}

export interface LoopPatternDTO {
  id: GoalPattern;
  label: string;
  description: string;
}

export interface GoalSpecificationDTO {
  goalId: string;
  rawGoal: string;
  objective: string;
  constraints: string[];
  requiredCapabilities: CapabilityType[];
  evidenceRequirements: Array<{
    collection: string;
    queryTemplate: string;
    topK?: number;
    groundingRequired: boolean;
    reason: string;
  }>;
  successCriteria: Array<{
    criterionId: string;
    description: string;
    requiredSections?: string[];
    minLength?: number;
    format?: string;
  }>;
  riskLevel: LoopRiskLevel;
  budget: LoopBudgetConfig;
  latencyPreference: 'latency_first' | 'balanced' | 'quality_first';
  allowedTools: string[];
  maxIterations: number;
  pattern: GoalPattern;
  derivationReasons: string[];
  qualityTier: 'premium' | 'standard' | 'economy' | 'free';
  clarificationNeeded?: { reason: string };
}

export interface LoopTaskGraphDTO {
  goalId: string;
  tasks: LoopTask[];
  entryTaskIds: string[];
  terminalTaskIds: string[];
  validated: boolean;
  validationReasons: string[];
  createdAt: string;
  version: string;
}

export interface LoopCancelResultDTO {
  runId: string;
  cancelled: boolean;
  status: LoopRunStatus;
}

export type {
  CriticAssessment,
  EvidenceState,
  GoalPattern,
  LoopRiskLevel,
  LoopRunStatus,
  LoopTask,
  LoopTraceStep,
  ProposedMemory,
  TerminationReason,
};
