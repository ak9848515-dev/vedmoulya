// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Learning Intelligence: Engine Ports
// EI-007
// The Learning Intelligence Platform observes the six existing
// Enterprise Intelligence engines through narrow ports. Each port is
// structurally satisfied by the owning engine's application service, so
// learning REUSES every registry and engine — it never duplicates their
// logic and never modifies their contracts.
//
//   Goals (EI-006/goals) · Capabilities (EI-001) · Providers (EI-002)
//   Context (EI-003) · Strategies (EI-004) · Orchestrator (EI-005)
//
// The ports are typed against the engines' public DTOs so the gateway
// and the web dashboard share exactly the same shapes.
// ──────────────────────────────────────────────────────────────────

import type { GoalSummaryDTO } from '@vedmoulya/goals';
import type { CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';
import type { ProviderMarketplaceDTO } from '@vedmoulya/providers';
import type { ContextRegistrySummaryDTO } from '@vedmoulya/context';
import type { StrategySummaryDTO } from '@vedmoulya/execution-strategy';
import type { OrchestratorSummaryDTO } from '@vedmoulya/execution-orchestrator';

// ── Goal & Task Intelligence Engine (EI-006 / goals) ───────────────────────

export interface LearningGoalEnginePort {
  getSummary(): Promise<{ success: boolean; data?: GoalSummaryDTO; error?: string }>;
}

// ── Enterprise Capability Registry (EI-001) ────────────────────────────────

export interface LearningCapabilityEnginePort {
  getMarketplace(): Promise<{ success: boolean; data?: CapabilityMarketplaceDTO; error?: string }>;
}

// ── Enterprise Provider Registry (EI-002) ─────────────────────────────────

export interface LearningProviderEnginePort {
  getMarketplace(): Promise<{ success: boolean; data?: ProviderMarketplaceDTO; error?: string }>;
}

// ── Enterprise Context Intelligence Engine (EI-003) ────────────────────────

export interface LearningContextEnginePort {
  getContextSummary(): Promise<{
    success: boolean;
    data?: ContextRegistrySummaryDTO;
    error?: string;
  }>;
}

// ── Enterprise Execution Strategy Engine (EI-004) ──────────────────────────

export interface LearningStrategyEnginePort {
  getSummary(): Promise<{ success: boolean; data?: StrategySummaryDTO; error?: string }>;
}

// ── Enterprise Execution Orchestrator (EI-005) ─────────────────────────────

export interface LearningOrchestratorEnginePort {
  getSummary(): Promise<{ success: boolean; data?: OrchestratorSummaryDTO; error?: string }>;
}

// ── Combined engine bundle passed to the learning platform ─────────────────

export interface LearningEngines {
  goals: LearningGoalEnginePort;
  capabilities: LearningCapabilityEnginePort;
  providers: LearningProviderEnginePort;
  context: LearningContextEnginePort;
  strategies: LearningStrategyEnginePort;
  orchestrator: LearningOrchestratorEnginePort;
}
