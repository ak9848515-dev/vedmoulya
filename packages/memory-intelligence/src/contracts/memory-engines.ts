// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Engine Ports
// EI-010 — Enterprise Memory Intelligence Platform
// The Memory Layer CONSUMES every Enterprise Intelligence Engine
// through narrow ports — it OWNS none and duplicates no logic. The
// ports are used to (1) link memories to the live engine entities
// they record experience about (a provider memory about "OpenAI"
// links provider `openai`), and (2) register which engines retrieve
// which memories. Each port is structurally satisfied by the owning
// engine's application service — the same seam pattern as
// `BrainEngines` (EI-008) and `KnowledgeEngines` (EI-009).
//
//   Goals (EI-006) · Capabilities (EI-001) · Providers (EI-002)
//   Context (EI-003) · Strategies (EI-004) · Orchestrator (EI-005)
//   Learning (EI-007) · Brain (EI-008) · Knowledge (EI-009)
// ──────────────────────────────────────────────────────────────────

import type { GoalSummaryDTO } from '@vedmoulya/goals';
import type { CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';
import type { ProviderMarketplaceDTO } from '@vedmoulya/providers';
import type { ContextRegistrySummaryDTO } from '@vedmoulya/context';
import type { StrategySummaryDTO } from '@vedmoulya/execution-strategy';
import type { OrchestratorSummaryDTO } from '@vedmoulya/execution-orchestrator';
import type { LearningDashboardDTO } from '@vedmoulya/learning-intelligence';
import type { BrainDashboardDTO } from '@vedmoulya/enterprise-brain';
import type { KnowledgeDashboardDTO } from '@vedmoulya/knowledge-intelligence';

// ── Enterprise Goal & Task Intelligence Engine (EI-006 / goals) ─────────────

export interface MemoryGoalEnginePort {
  getSummary(): Promise<{ success: boolean; data?: GoalSummaryDTO; error?: string }>;
}

// ── Enterprise Capability Registry (EI-001) ─────────────────────────────────

export interface MemoryCapabilityEnginePort {
  getMarketplace(): Promise<{ success: boolean; data?: CapabilityMarketplaceDTO; error?: string }>;
}

// ── Enterprise Provider Registry (EI-002) ───────────────────────────────────

export interface MemoryProviderEnginePort {
  getMarketplace(): Promise<{ success: boolean; data?: ProviderMarketplaceDTO; error?: string }>;
}

// ── Enterprise Context Intelligence Engine (EI-003) ─────────────────────────

export interface MemoryContextEnginePort {
  getContextSummary(): Promise<{
    success: boolean;
    data?: ContextRegistrySummaryDTO;
    error?: string;
  }>;
}

// ── Enterprise Execution Strategy Engine (EI-004) ───────────────────────────

export interface MemoryStrategyEnginePort {
  getSummary(): Promise<{ success: boolean; data?: StrategySummaryDTO; error?: string }>;
}

// ── Enterprise Execution Orchestrator (EI-005) ──────────────────────────────

export interface MemoryOrchestratorEnginePort {
  getSummary(): Promise<{ success: boolean; data?: OrchestratorSummaryDTO; error?: string }>;
}

// ── Enterprise Learning Intelligence Platform (EI-007) ─────────────────────

export interface MemoryLearningEnginePort {
  getDashboard(): Promise<{ success: boolean; data?: LearningDashboardDTO; error?: string }>;
}

// ── Enterprise Brain (EI-008) ───────────────────────────────────────────────

export interface MemoryBrainEnginePort {
  getDashboard(): Promise<{ success: boolean; data?: BrainDashboardDTO; error?: string }>;
}

// ── Enterprise Knowledge Intelligence Platform (EI-009) ────────────────────

export interface MemoryKnowledgeEnginePort {
  getDashboard(): Promise<{ success: boolean; data?: KnowledgeDashboardDTO; error?: string }>;
}

// ── Combined engine bundle consumed by the Memory Layer ─────────────────────

export interface MemoryEngines {
  goals: MemoryGoalEnginePort;
  capabilities: MemoryCapabilityEnginePort;
  providers: MemoryProviderEnginePort;
  context: MemoryContextEnginePort;
  strategies: MemoryStrategyEnginePort;
  orchestrator: MemoryOrchestratorEnginePort;
  learning: MemoryLearningEnginePort;
  brain: MemoryBrainEnginePort;
  knowledge: MemoryKnowledgeEnginePort;
}
