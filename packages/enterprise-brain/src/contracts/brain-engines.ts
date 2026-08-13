// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain: Engine Ports
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// The Enterprise Brain coordinates every Enterprise Intelligence
// Engine through narrow ports. Each port is structurally satisfied by
// the owning engine's application service — the Brain CONSUMES every
// engine and OWNS none. No engine logic is duplicated; no engine
// contract is modified.
//
//   Goals (EI-006/goals) · Learning (EI-007) · Capabilities (EI-001)
//   Providers (EI-002) · Context (EI-003) · Strategies (EI-004)
//   Orchestrator (EI-005)
//
// The ports are typed against the engines' public DTOs so the gateway
// and the web dashboard share exactly the same shapes.
// ──────────────────────────────────────────────────────────────────

import type { GoalDTO, GoalSummaryDTO, TaskDTO } from '@vedmoulya/goals';
import type {
  LearningDashboardDTO,
  LearningModelDTO,
  LearningRecommendationDTO,
} from '@vedmoulya/learning-intelligence';
import type { CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';
import type { ProviderMarketplaceDTO } from '@vedmoulya/providers';
import type { ContextRegistrySummaryDTO } from '@vedmoulya/context';
import type { StrategySummaryDTO } from '@vedmoulya/execution-strategy';
import type { OrchestratorSummaryDTO } from '@vedmoulya/execution-orchestrator';

// ── Goal & Task Intelligence Engine (EI-006 / goals) ───────────────────────

export interface BrainGoalEnginePort {
  getGoal(goalId: string): Promise<{ success: boolean; data?: GoalDTO; error?: string }>;
  listTasks(goalId: string): Promise<{ success: boolean; data?: TaskDTO[]; error?: string }>;
  getSummary(): Promise<{ success: boolean; data?: GoalSummaryDTO; error?: string }>;
}

// ── Enterprise Learning Intelligence Platform (EI-007) ─────────────────────

export interface BrainLearningEnginePort {
  getDashboard(): Promise<{ success: boolean; data?: LearningDashboardDTO; error?: string }>;
  getRecommendations(): Promise<{
    success: boolean;
    data?: LearningRecommendationDTO[];
    error?: string;
  }>;
  getModels(): Promise<{ success: boolean; data?: LearningModelDTO[]; error?: string }>;
}

// ── Enterprise Capability Registry (EI-001) ────────────────────────────────

export interface BrainCapabilityEnginePort {
  getMarketplace(): Promise<{ success: boolean; data?: CapabilityMarketplaceDTO; error?: string }>;
}

// ── Enterprise Provider Registry (EI-002) ─────────────────────────────────

export interface BrainProviderEnginePort {
  getMarketplace(): Promise<{ success: boolean; data?: ProviderMarketplaceDTO; error?: string }>;
}

// ── Enterprise Context Intelligence Engine (EI-003) ────────────────────────

export interface BrainContextEnginePort {
  getContextSummary(): Promise<{
    success: boolean;
    data?: ContextRegistrySummaryDTO;
    error?: string;
  }>;
}

// ── Enterprise Execution Strategy Engine (EI-004) ──────────────────────────

export interface BrainStrategyEnginePort {
  getSummary(): Promise<{ success: boolean; data?: StrategySummaryDTO; error?: string }>;
}

// ── Enterprise Execution Orchestrator (EI-005) ─────────────────────────────

export interface BrainOrchestratorEnginePort {
  getSummary(): Promise<{ success: boolean; data?: OrchestratorSummaryDTO; error?: string }>;
}

// ── Combined engine bundle passed to the Enterprise Brain ──────────────────

export interface BrainEngines {
  goals: BrainGoalEnginePort;
  learning: BrainLearningEnginePort;
  capabilities: BrainCapabilityEnginePort;
  providers: BrainProviderEnginePort;
  context: BrainContextEnginePort;
  strategies: BrainStrategyEnginePort;
  orchestrator: BrainOrchestratorEnginePort;
}
