// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Engine Ports
// EI-009 — Enterprise Knowledge Intelligence Platform
// The Knowledge Layer CONSUMES every Enterprise Intelligence Engine
// through narrow ports — it OWNS none and duplicates no logic. The
// ports are used to (1) link knowledge items to the live engine
// entities they describe (a knowledge item about "OpenAI" links the
// provider `openai`), and (2) register which engines consume which
// knowledge. Each port is structurally satisfied by the owning
// engine's application service — the same seam pattern as
// `BrainEngines` (EI-008).
//
//   Goals (EI-006) · Capabilities (EI-001) · Providers (EI-002)
//   Context (EI-003) · Strategies (EI-004) · Orchestrator (EI-005)
//   Learning (EI-007) · Brain (EI-008)
// ──────────────────────────────────────────────────────────────────

import type { GoalSummaryDTO } from '@vedmoulya/goals';
import type { CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';
import type { ProviderMarketplaceDTO } from '@vedmoulya/providers';
import type { ContextRegistrySummaryDTO } from '@vedmoulya/context';
import type { StrategySummaryDTO } from '@vedmoulya/execution-strategy';
import type { OrchestratorSummaryDTO } from '@vedmoulya/execution-orchestrator';
import type { LearningDashboardDTO } from '@vedmoulya/learning-intelligence';
import type { BrainDashboardDTO } from '@vedmoulya/enterprise-brain';

// ── Enterprise Goal & Task Intelligence Engine (EI-006 / goals) ─────────────

export interface KnowledgeGoalEnginePort {
  getSummary(): Promise<{ success: boolean; data?: GoalSummaryDTO; error?: string }>;
}

// ── Enterprise Capability Registry (EI-001) ─────────────────────────────────

export interface KnowledgeCapabilityEnginePort {
  getMarketplace(): Promise<{ success: boolean; data?: CapabilityMarketplaceDTO; error?: string }>;
}

// ── Enterprise Provider Registry (EI-002) ───────────────────────────────────

export interface KnowledgeProviderEnginePort {
  getMarketplace(): Promise<{ success: boolean; data?: ProviderMarketplaceDTO; error?: string }>;
}

// ── Enterprise Context Intelligence Engine (EI-003) ─────────────────────────

export interface KnowledgeContextEnginePort {
  getContextSummary(): Promise<{
    success: boolean;
    data?: ContextRegistrySummaryDTO;
    error?: string;
  }>;
}

// ── Enterprise Execution Strategy Engine (EI-004) ───────────────────────────

export interface KnowledgeStrategyEnginePort {
  getSummary(): Promise<{ success: boolean; data?: StrategySummaryDTO; error?: string }>;
}

// ── Enterprise Execution Orchestrator (EI-005) ──────────────────────────────

export interface KnowledgeOrchestratorEnginePort {
  getSummary(): Promise<{ success: boolean; data?: OrchestratorSummaryDTO; error?: string }>;
}

// ── Enterprise Learning Intelligence Platform (EI-007) ─────────────────────

export interface KnowledgeLearningEnginePort {
  getDashboard(): Promise<{ success: boolean; data?: LearningDashboardDTO; error?: string }>;
}

// ── Enterprise Brain (EI-008) ───────────────────────────────────────────────

export interface KnowledgeBrainEnginePort {
  getDashboard(): Promise<{ success: boolean; data?: BrainDashboardDTO; error?: string }>;
}

// ── Combined engine bundle consumed by the Knowledge Layer ──────────────────

export interface KnowledgeEngines {
  goals: KnowledgeGoalEnginePort;
  capabilities: KnowledgeCapabilityEnginePort;
  providers: KnowledgeProviderEnginePort;
  context: KnowledgeContextEnginePort;
  strategies: KnowledgeStrategyEnginePort;
  orchestrator: KnowledgeOrchestratorEnginePort;
  learning: KnowledgeLearningEnginePort;
  brain: KnowledgeBrainEnginePort;
}
